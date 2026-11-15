/**
 * The work page's own motion, on top of portfolio.js.
 *
 *  1. project plates — sticky, stacking, each sinking back as the next covers it
 *  2. the skills orbit — labels riding three rings around Python & SQL
 *  3. GitHub — refreshes each plate's "updated" date from the API. Only the
 *     projects written into the page are shown; other repositories are ignored.
 */

(() => {
  const PF = window.PF;
  if (!PF) return;
  const {clamp, reduceMotion} = PF;

  // ================================================================== plates

  (() => {
    const host = document.querySelector('[data-plates]');
    if (!host) return;
    const plates = [...host.querySelectorAll('.plate')].map((el) => ({
      el,
      inner: el.querySelector('.plate__inner'),
      cover: -1,
    }));

    // The figures only animate while their plate is on screen.
    const live = new IntersectionObserver((entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-live', entry.isIntersecting);
    });
    for (const plate of plates) live.observe(plate.el);

    if (reduceMotion) return;

    // Stacking needs a screen tall and wide enough to hold a whole plate.
    const roomy = window.matchMedia('(min-width: 1000px) and (min-height: 620px)');
    let stacked = false;

    function layout() {
      stacked = roomy.matches;
      host.classList.toggle('is-stacked', stacked);
      for (const plate of plates) {
        plate.el.style.top = '';
        plate.cover = -1;
        if (!stacked) {
          plate.inner.style.transform = '';
          plate.inner.style.opacity = '';
        }
      }
      if (!stacked) return;
      // A plate taller than the screen sticks by its bottom edge instead of its
      // top, so the end of it is read before the next one arrives.
      const vh = window.innerHeight;
      for (const plate of plates) {
        plate.el.style.top = `${Math.min(0, vh - plate.el.offsetHeight)}px`;
      }
    }

    layout();
    roomy.addEventListener('change', layout);
    window.addEventListener('resize', () => setTimeout(layout, 140), {passive: true});
    document.fonts?.ready.then(layout);

    PF.onFrame((y, vh) => {
      if (!stacked) return;
      const box = host.getBoundingClientRect();
      if (box.bottom < -vh || box.top > vh * 2) return;

      for (let i = 0; i < plates.length - 1; i++) {
        const next = plates[i + 1].el.getBoundingClientRect().top;
        const cover = Number(clamp(1 - next / vh, 0, 1).toFixed(3));
        const plate = plates[i];
        if (cover === plate.cover) continue;
        plate.cover = cover;
        plate.inner.style.transform = `scale(${(1 - cover * 0.07).toFixed(4)})`;
        plate.inner.style.opacity = (1 - cover * 0.8).toFixed(3);
      }
    });
  })();

  // =================================================================== orbit

  (() => {
    const orbit = document.querySelector('[data-orbit]');
    if (!orbit) return;

    // Radii match the circles drawn in the SVG, as fractions of the box.
    const RADIUS = [100 / 600, 185 / 600, 270 / 600];
    const SPEED = [0.085, -0.055, 0.036]; // radians a second
    const rings = [[], [], []];
    for (const el of orbit.querySelectorAll('.orbit__item')) {
      rings[Number(el.dataset.ring) || 0].push(el);
    }

    let size = orbit.clientWidth;
    let phase = 0;
    let last = performance.now();
    let raf = null;
    let visible = false;

    function place() {
      rings.forEach((ring, r) => {
        const step = (Math.PI * 2) / ring.length;
        ring.forEach((el, i) => {
          const a = i * step + r * 0.7 + phase * SPEED[r];
          const x = size / 2 + Math.cos(a) * RADIUS[r] * size;
          const y = size / 2 + Math.sin(a) * RADIUS[r] * size;
          el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`;
        });
      });
    }

    function tick(now) {
      raf = null;
      if (!visible) return;
      // Scrolling winds the rings on a little faster; time alone keeps them
      // turning when the page is still.
      phase += Math.min(now - last, 64) / 1000 + Math.abs(PF.velocity()) * 0.012;
      last = now;
      place();
      raf = requestAnimationFrame(tick);
    }

    place();
    orbit.classList.add('is-placed');
    window.addEventListener(
      'resize',
      () => {
        size = orbit.clientWidth;
        place();
      },
      {passive: true},
    );

    if (reduceMotion) return;

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && raf === null) {
        size = orbit.clientWidth;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    }).observe(orbit);
  })();

  // ================================================================== github

  (() => {
    const USER = 'Parth-Thorat-27';
    const CACHE = 'pf:repos';
    const MAX_AGE = 60 * 60 * 1000;

    const plates = new Map();
    for (const el of document.querySelectorAll('.plate[data-repo]')) {
      plates.set(el.dataset.repo.toLowerCase(), el);
    }
    if (!plates.size) return;

    const month = new Intl.DateTimeFormat('en-GB', {month: 'short', year: 'numeric'});

    function apply(repos) {
      for (const repo of repos) {
        const plate = plates.get(repo.name.toLowerCase());
        // A repository with no plate is not one of the projects on this page.
        if (!plate) continue;
        const stamp = plate.querySelector('[data-repo-pushed]');
        const when = new Date(repo.pushed);
        if (stamp && !Number.isNaN(when.getTime())) stamp.textContent = `Updated ${month.format(when)}`;
      }
    }

    function cached() {
      try {
        const hit = JSON.parse(sessionStorage.getItem(CACHE));
        return hit && Date.now() - hit.at < MAX_AGE ? hit.repos : null;
      } catch {
        return null;
      }
    }

    const hit = cached();
    if (hit) {
      apply(hit);
      return;
    }

    // Unauthenticated, so 60 requests an hour per visitor address — one call a
    // session is well inside that. If it fails the written plates simply stand.
    fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=pushed`, {
      headers: {Accept: 'application/vnd.github+json'},
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(response.status))))
      .then((data) => {
        if (!Array.isArray(data)) return;
        const repos = data.map((r) => ({name: r.name, pushed: r.pushed_at}));
        try {
          sessionStorage.setItem(CACHE, JSON.stringify({at: Date.now(), repos}));
        } catch {
          // Storage is full or blocked; the next page view just asks again.
        }
        apply(repos);
      })
      .catch(() => {});
  })();
})();
