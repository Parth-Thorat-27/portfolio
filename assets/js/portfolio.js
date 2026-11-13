/**
 * Portfolio motion. No dependencies, no build step.
 *
 *  1. momentum scrolling — wheel input is eased toward a target instead of
 *     jumping, which is what makes the whole page feel heavy and smooth
 *  2. scroll-linked parallax on the hero and on every section opener
 *  3. masked word reveals for the display titles
 *  4. reveal-on-enter for the body blocks, and counters for the impact figures
 *  5. chrome that recolours per band, and rails that track the current section
 *
 * Everything scroll-driven runs from one requestAnimationFrame loop that stops
 * itself once the page is still, and writes only transform and opacity.
 */

(() => {
  const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;

  /** Page scripts (work.js, hobbies.js) hang their per-frame work off this. */
  const frameHooks = [];
  let velocity = 0; // smoothed px/frame, signed — the marquees lean on it

  const topbar = document.querySelector('[data-topbar]');
  const rail = document.querySelector('[data-rail]');
  const railList = document.querySelector('.rail__list');
  const mrail = document.querySelector('[data-mrail]');
  const bands = [...document.querySelectorAll('[data-band]')];

  // ============================================================ smooth scroll

  /**
   * Wheel events move a target offset; each frame the real scroll position
   * eases a fraction of the way toward it. Native scrolling is left alone on
   * touch — it already has momentum — and wherever motion is not wanted.
   */
  const scroller = (() => {
    const wanted =
      !reduceMotion &&
      window.matchMedia('(pointer: fine)').matches &&
      window.matchMedia('(min-width: 1024px)').matches;

    if (!wanted) return null;

    const EASE = 0.105;
    const state = {target: window.scrollY, current: window.scrollY, active: false};

    // The CSS smooth behaviour would fight the loop for control of scrollTop.
    document.documentElement.style.scrollBehavior = 'auto';

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // Firefox reports deltas in lines, Chrome in pixels, some mice in pages.
    function pixels(event) {
      if (event.deltaMode === 1) return event.deltaY * 18;
      if (event.deltaMode === 2) return event.deltaY * window.innerHeight;
      return event.deltaY;
    }

    function onWheel(event) {
      // Leave anything with its own scrollbar — the mobile section strip, a
      // future code block — to the browser.
      if (event.target.closest && event.target.closest('[data-native-scroll]')) return;
      if (event.ctrlKey) return; // pinch zoom

      // The certificate viewer sits over the page; nothing behind it may move.
      if (document.documentElement.dataset.modalOpen === 'true') {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      state.target = clamp(state.target + pixels(event), 0, maxScroll());
      state.active = true;
      requestTick();
    }

    function scrollTo(y) {
      state.target = clamp(y, 0, maxScroll());
      state.active = true;
      requestTick();
    }

    /** Advance one frame. Returns true while there is still distance to cover. */
    function step() {
      if (!state.active) return false;

      const distance = state.target - state.current;
      if (Math.abs(distance) < 0.4) {
        state.current = state.target;
        window.scrollTo(0, state.current);
        state.active = false;
        return false;
      }

      state.current += distance * EASE;
      window.scrollTo(0, state.current);
      return true;
    }

    /**
     * Scrollbar drags, keyboard paging and anything else that moves the page
     * behind the loop's back. Anything further than a rounding error from where
     * the loop last wrote is treated as somebody else's scroll.
     */
    function resync() {
      if (Math.abs(window.scrollY - state.current) <= 3) return;
      state.current = window.scrollY;
      state.target = window.scrollY;
      state.active = false;
    }

    window.addEventListener('wheel', onWheel, {passive: false});
    return {step, scrollTo, resync};
  })();

  // Anchor links have to go through the scroller, or the two disagree about
  // where the page is.
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest?.('a[href^="#"]');
    if (!anchor) return;
    const id = anchor.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : document.body;
    if (!target) return;

    event.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - (id === 'top' ? 0 : 0);
    if (scroller) scroller.scrollTo(top);
    else window.scrollTo({top, behavior: reduceMotion ? 'auto' : 'smooth'});
    history.replaceState(null, '', id === 'top' ? location.pathname : `#${id}`);
  });

  // ================================================================= parallax

  const hero = document.querySelector('.hero');
  const heroPin = document.querySelector('.hero__pin');
  const heroPaper = document.querySelector('.hero__paper');
  const heroFrame = document.querySelector('.hero__dark .hero__frame');
  const heroTitle = document.querySelector('.hero__dark .hero__title');
  const heroInk = document.querySelector('.hero__paper .hero__title');
  const heroHud = document.querySelector('.hero__hud');
  const heroSay = document.querySelector('.hero__say');
  const heroPinned = Boolean(heroPin && heroPaper && heroFrame && heroTitle && heroInk) && !reduceMotion;
  if (heroPinned) hero.classList.add('is-pinned');

  /** Where the frame sits in the pinned viewport, and how far the name grows. */
  const heroBox = {w: 1, h: 1, l: 0, t: 0, r: 0, b: 0, scale: 1, travel: 1};

  /** One entry per opener: the pinned artwork and the pinned title block. */
  const openers = [...document.querySelectorAll('.opener')].map((host) => ({
    host,
    inner: host.querySelector('.opener__inner'),
    grid: host.querySelector('.opener__grid'),
    top: 0,
    height: 1,
  }));

  let heroHeight = window.innerHeight;

  function measure() {
    heroHeight = hero ? hero.offsetHeight : window.innerHeight;
    if (heroPinned) {
      const w = heroPin.clientWidth;
      const h = heroPin.clientHeight;
      const fw = heroFrame.offsetWidth;
      const fh = heroFrame.offsetHeight;
      heroBox.w = w;
      heroBox.h = h;
      heroBox.l = heroBox.r = (w - fw) / 2;
      heroBox.t = heroBox.b = (h - fh) / 2;
      heroBox.travel = Math.max(1, heroHeight - h);
      // The name ends as large as the screen allows: bounded by width on a
      // phone, by height on a short laptop.
      const tw = Math.max(1, heroTitle.offsetWidth);
      const th = Math.max(1, heroTitle.offsetHeight);
      heroBox.scale = Math.max(1, Math.min(((w < 700 ? 0.8 : 0.6) * w) / tw, (0.56 * h) / th));
    }
    for (const o of openers) {
      o.top = o.host.getBoundingClientRect().top + window.scrollY;
      o.height = Math.max(1, o.host.offsetHeight);
    }
  }

  function renderParallax(y) {
    if (reduceMotion) return;

    if (heroPinned) {
      const p = clamp(y / heroBox.travel, 0, 1);
      // Two beats. First the frame fills with paper from its bottom edge, like
      // a tray filling; then the filled frame opens until it is the screen.
      const fill = easeOut(clamp((p - 0.02) / 0.18, 0, 1));
      const open = easeInOut(clamp((p - 0.18) / 0.62, 0, 1));
      const keep = 1 - open;
      const top = lerp(heroBox.h - heroBox.b, heroBox.t, fill) * keep;
      heroPaper.style.clipPath = `inset(${top.toFixed(1)}px ${(heroBox.r * keep).toFixed(1)}px ${(
        heroBox.b * keep
      ).toFixed(1)}px ${(heroBox.l * keep).toFixed(1)}px)`;
      heroInk.style.setProperty('--s', lerp(1, heroBox.scale, open).toFixed(4));
      heroPin.style.setProperty('--gs', (1 + p * 0.22).toFixed(4));
      if (heroHud) heroHud.style.opacity = clamp(1 - p / 0.1, 0, 1).toFixed(3);
      if (heroSay) heroSay.style.opacity = clamp((p - 0.74) / 0.12, 0, 1).toFixed(3);
      // The top bar asks its band what colour to be; tell it the truth once
      // the paper has reached it.
      const band = fill > 0 && top < 30 ? 'light' : 'dark';
      if (hero.dataset.band !== band) hero.dataset.band = band;
    }

    for (const o of openers) {
      const raw = (y - o.top) / o.height;
      // Skip openers that are nowhere near the viewport.
      if (raw < -0.4 || raw > 1.4) continue;

      const p = clamp(raw, 0, 1);
      o.inner.style.transform = `translate3d(0, ${(-p * 110).toFixed(2)}px, 0)`;
      // Hold full strength through the pin, then fade out well before the
      // title would reach the top bar and collide with it.
      o.inner.style.opacity = clamp(1 - Math.max(0, p - 0.24) * 2.7, 0, 1).toFixed(3);
      o.grid.style.transform = `scale(${(1 + p * 0.16).toFixed(4)}) rotate(${(p * 2.4).toFixed(3)}deg)`;
    }
  }

  // ============================================================ word reveals

  /** Wrap each word in a clipping box so it can slide up from under a mask. */
  function splitWords(el) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const mask = document.createElement('span');
      mask.className = 'mask';
      const inner = document.createElement('span');
      inner.textContent = word;
      inner.style.transitionDelay = `${i * 90}ms`;
      mask.appendChild(inner);
      el.appendChild(mask);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  }

  const titles = [...document.querySelectorAll('.opener__title')];
  if (!reduceMotion) for (const t of titles) splitWords(t);

  // ================================================================= reveals

  const revealTargets = [
    ...document.querySelectorAll('[data-reveal], [data-reveal-stagger]'),
    ...titles,
  ];

  if (reduceMotion) {
    for (const el of revealTargets) el.classList.add('is-in');
  } else {
    for (const group of document.querySelectorAll('[data-reveal-stagger]')) {
      [...group.children].forEach((child, i) => {
        child.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
      });
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      },
      {rootMargin: '0px 0px -10% 0px', threshold: 0.05},
    );
    for (const el of revealTargets) revealObserver.observe(el);
  }

  // ================================================================ counters

  const counters = [...document.querySelectorAll('[data-count]')];

  function runCounter(el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (!Number.isFinite(target)) return;
    if (reduceMotion) {
      el.textContent = target + suffix;
      return;
    }

    const duration = 1200;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic, so it settles
      el.textContent = Math.round(target * eased) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };

    el.textContent = '0' + suffix;
    requestAnimationFrame(tick);
  }

  if (counters.length) {
    const countObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          runCounter(entry.target);
          countObserver.unobserve(entry.target);
        }
      },
      {threshold: 0.6},
    );
    for (const el of counters) countObserver.observe(el);
  }

  // ================================================================= contact

  /** Copy-to-clipboard on the email, with the button as the receipt. */
  (() => {
    const buttons = [...document.querySelectorAll('[data-copy]')];
    if (!buttons.length) return;

    // Clipboard writes need a secure context. Rather than offer a button that
    // silently fails, take it away and leave the plain link.
    if (!navigator.clipboard?.writeText) {
      for (const b of buttons) b.hidden = true;
      return;
    }

    const status = document.querySelector('[data-copy-status]');
    const timers = new WeakMap();

    for (const button of buttons) {
      const label = button.querySelector('[data-copy-label]');
      const value = button.dataset.copy;
      button.setAttribute('aria-label', `Copy ${value}`);

      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          if (status) status.textContent = 'Could not copy — select the text instead.';
          return;
        }

        label.textContent = 'Copied';
        button.dataset.copied = 'true';
        if (status) status.textContent = `${value} copied to clipboard`;

        clearTimeout(timers.get(button));
        timers.set(
          button,
          setTimeout(() => {
            label.textContent = 'Copy';
            delete button.dataset.copied;
          }, 2000),
        );
      });
    }
  })();

  /** Local time in Thane, so a visitor elsewhere knows whether it is a sane hour. */
  (() => {
    const el = document.querySelector('[data-clock]');
    if (!el) return;

    const format = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    function render() {
      el.textContent = `${format.format(new Date())} IST`;
      // Re-tick just after the next minute boundary rather than polling.
      const now = new Date();
      const delay = (60 - now.getSeconds()) * 1000 + 200;
      setTimeout(render, delay);
    }

    render();
  })();

  // ===================================================== certificate viewer

  /**
   * Clicking a certification name opens its scan. A native <dialog> carries the
   * focus trap, the Esc handling and the top layer, so the only work here is
   * the source, the scroll lock and the ways out.
   */
  (() => {
    const dialog = document.querySelector('[data-lightbox]');
    const buttons = [...document.querySelectorAll('.cert__open')];
    if (!dialog || !buttons.length) return;

    // No showModal means no focus trap and no top layer. Rather than ship a
    // half-modal, leave the names as plain headings.
    if (typeof dialog.showModal !== 'function') {
      for (const b of buttons) b.disabled = true;
      return;
    }

    const img = dialog.querySelector('[data-lightbox-img]');
    const stage = dialog.querySelector('[data-lightbox-stage]');
    const caption = dialog.querySelector('[data-lightbox-cap]');
    const closeButton = dialog.querySelector('[data-lightbox-close]');
    const zoomButton = dialog.querySelector('[data-lightbox-zoom]');
    const root = document.documentElement;

    /**
     * Fit or natural size. At fit a landscape scan on a phone lands around 20%,
     * where the certificate's own text cannot be read; zoomed, the stage pans.
     */
    function setZoom(on) {
      if (on) dialog.dataset.zoom = 'true';
      else delete dialog.dataset.zoom;
      zoomButton.setAttribute('aria-pressed', String(on));
      zoomButton.firstChild.nodeValue = on ? 'Fit' : 'Zoom';

      // Come in at the top-left of the scan rather than wherever the last one
      // was left, and centre it horizontally so the pan starts somewhere sane.
      if (on) {
        stage.scrollTop = 0;
        stage.scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      }
    }

    zoomButton.addEventListener('click', () => setZoom(dialog.dataset.zoom !== 'true'));
    img.addEventListener('click', () => setZoom(dialog.dataset.zoom !== 'true'));

    function open(button) {
      const src = button.dataset.cert;
      if (!src) return;
      const name = button.textContent.trim();

      caption.textContent = name;
      img.alt = `Certificate: ${name}`;
      setZoom(false);
      // Set here rather than in the markup: these scans are megabytes each,
      // and none of them should cross the wire until somebody asks.
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);

      // The custom scroller reads this; the overflow covers native scrolling
      // on touch and under reduced motion, where the scroller is not running.
      // Deliberately not named data-lightbox: that is the dialog's own hook,
      // and a matching attribute on <html> would shadow it in every
      // querySelector('[data-lightbox]') the moment the viewer opened.
      root.dataset.modalOpen = 'true';
      root.style.overflow = 'hidden';
      dialog.showModal();
    }

    for (const button of buttons) {
      button.addEventListener('click', () => open(button));

      // The name carries the affordance, but on a phone it is a 16px-tall
      // target. Let a tap anywhere on the card count as the same press —
      // except one that ends a text selection, which was not a tap at all.
      const card = button.closest('.cert');
      if (!card) continue;
      card.addEventListener('click', (event) => {
        if (event.target.closest('.cert__open')) return;
        if (window.getSelection?.().toString()) return;
        open(button);
      });
    }

    img.addEventListener('error', () => {
      caption.textContent = 'That certificate could not be loaded.';
    });

    closeButton.addEventListener('click', () => dialog.close());

    // The dialog box is narrower than the viewport, so a click landing on the
    // element itself rather than on the bar or the image came from the backdrop.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    // One place for every exit: the button, the backdrop and Esc.
    dialog.addEventListener('close', () => {
      delete root.dataset.modalOpen;
      root.style.overflow = '';
    });
  })();

  // ==================================================================== iris

  /**
   * A camera iris as two SVG paths: the regular polygon the blades leave open,
   * and one straight edge per blade running on past its corner — which is what
   * makes it read as a diaphragm rather than as a polygon. Shared by the page
   * transition and by the figure on the door to the other half.
   */
  function irisPaths(cx, cy, r, rot, n, reach) {
    const step = (Math.PI * 2) / n;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = rot + i * step;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    const f = (v) => v.toFixed(1);
    const hole = `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}Z`;
    let blades = '';
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      // The direction of a regular polygon's edge, taken from the angle rather
      // than from the two points, so it survives the radius reaching zero.
      const dir = rot + i * step + Math.PI / 2 + step / 2;
      blades += `M${f(a[0])} ${f(a[1])}L${f(b[0] + Math.cos(dir) * reach)} ${f(b[1] + Math.sin(dir) * reach)}`;
    }
    return {hole, blades};
  }

  /**
   * The transition between the two pages. Closes over the page being left,
   * then the next page — which was painted already covered — opens it again.
   */
  (() => {
    if (reduceMotion) {
      root.classList.remove('iris-pending');
      return;
    }

    const NS = 'http://www.w3.org/2000/svg';
    const BLADES = 8;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'iris');
    svg.setAttribute('aria-hidden', 'true');
    const fill = document.createElementNS(NS, 'path');
    fill.setAttribute('class', 'iris__fill');
    const lines = document.createElementNS(NS, 'path');
    lines.setAttribute('class', 'iris__lines');
    svg.append(fill, lines);
    document.body.appendChild(svg);

    let raf = null;

    /** 0 is shut, 1 is clear of every corner of the screen. */
    function draw(open) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const full = Math.hypot(w, h) / 2 / Math.cos(Math.PI / BLADES) + 4;
      const r = full * open;
      // The blades turn as they close, the way a real diaphragm does.
      const {hole, blades} = irisPaths(w / 2, h / 2, r, -0.35 - (1 - open) * 1.5, BLADES, Math.hypot(w, h));
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      fill.setAttribute('d', `M0 0H${w}V${h}H0Z${hole}`);
      lines.setAttribute('d', blades);
    }

    function run(from, to, duration, ease, done) {
      cancelAnimationFrame(raf);
      svg.dataset.on = '';
      const start = performance.now();
      const tick = (now) => {
        const t = clamp((now - start) / duration, 0, 1);
        draw(lerp(from, to, ease(t)));
        if (t < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        if (to >= 1) delete svg.dataset.on;
        done?.();
      };
      draw(from);
      raf = requestAnimationFrame(tick);
    }

    const open = () => run(0, 1, 1150, easeInOut);
    const close = (done) => run(1, 0, 720, easeInOut, done);

    // The page arrives covered by a plain black sheet from the stylesheet;
    // swap that for the real iris, shut, and open it.
    if (root.classList.contains('iris-pending')) {
      draw(0);
      svg.dataset.on = '';
      root.classList.remove('iris-pending');
      requestAnimationFrame(open);
    }

    // Coming back with the back button restores the page exactly as it was
    // left — which is shut.
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) open();
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('a[data-iris]');
      if (!link || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      close(() => {
        window.location.href = link.href;
      });
    });
  })();

  /** The iris on the door: the same construction, opened by scrolling to it. */
  (() => {
    const figures = [...document.querySelectorAll('[data-iris-figure]')];
    if (!figures.length) return;

    const items = figures.map((svg, index) => {
      const id = `iris-clip-${index}`;
      svg.innerHTML =
        `<clipPath id="${id}"><circle r="286" /></clipPath>` +
        '<circle r="286" /><circle r="298" />' +
        `<path clip-path="url(#${id})" /><path />`;
      const paths = svg.querySelectorAll('path');
      return {svg, blades: paths[0], hole: paths[1]};
    });

    function draw(item, p) {
      const open = 0.16 + 0.62 * easeInOut(clamp(p * 1.5, 0, 1));
      const {hole, blades} = irisPaths(0, 0, 286 * open, p * 1.3, 9, 620);
      item.blades.setAttribute('d', blades);
      item.hole.setAttribute('d', hole);
    }

    if (reduceMotion) {
      for (const item of items) draw(item, 0.5);
      return;
    }

    frameHooks.push((y, vh) => {
      for (const item of items) {
        const r = item.svg.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) continue;
        draw(item, clamp((vh - r.top) / (vh + r.height), 0, 1));
      }
    });
  })();

  // ================================================================== cursor

  /** A ring that trails the pointer and swells over anything that can be pressed. */
  (() => {
    if (reduceMotion || !finePointer) return;

    const ring = document.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'cursor__label';
    ring.appendChild(label);
    document.body.appendChild(ring);

    const pos = {x: 0, y: 0, tx: 0, ty: 0};
    let raf = null;
    let placed = false;

    function tick() {
      pos.x = lerp(pos.x, pos.tx, 0.22);
      pos.y = lerp(pos.y, pos.ty, 0.22);
      ring.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0)`;
      raf = Math.abs(pos.tx - pos.x) + Math.abs(pos.ty - pos.y) > 0.2 ? requestAnimationFrame(tick) : null;
    }

    window.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        pos.tx = event.clientX;
        pos.ty = event.clientY;
        if (!placed) {
          placed = true;
          pos.x = pos.tx;
          pos.y = pos.ty;
          ring.dataset.on = '';
        }

        const target = event.target.closest ? event.target : null;
        const named = target?.closest('[data-cursor]');
        if (named) {
          label.textContent = named.dataset.cursor;
          ring.dataset.state = 'label';
        } else if (target?.closest('a, button, summary, input, [role="button"], .cert')) {
          ring.dataset.state = 'link';
        } else {
          delete ring.dataset.state;
        }

        if (raf === null) raf = requestAnimationFrame(tick);
      },
      {passive: true},
    );

    document.addEventListener('pointerleave', () => delete ring.dataset.on);
    document.addEventListener('pointerenter', () => {
      if (placed) ring.dataset.on = '';
    });
  })();

  /** The hero's construction lines lean a few pixels away from the pointer. */
  (() => {
    if (!heroPinned || !finePointer) return;
    const at = {x: 0, y: 0, tx: 0, ty: 0};
    let raf = null;

    function tick() {
      at.x = lerp(at.x, at.tx, 0.07);
      at.y = lerp(at.y, at.ty, 0.07);
      heroPin.style.setProperty('--gx', `${at.x.toFixed(2)}px`);
      heroPin.style.setProperty('--gy', `${at.y.toFixed(2)}px`);
      raf = Math.abs(at.tx - at.x) + Math.abs(at.ty - at.y) > 0.05 ? requestAnimationFrame(tick) : null;
    }

    hero.addEventListener(
      'pointermove',
      (event) => {
        at.tx = (event.clientX / window.innerWidth - 0.5) * -28;
        at.ty = (event.clientY / window.innerHeight - 0.5) * -20;
        if (raf === null) raf = requestAnimationFrame(tick);
      },
      {passive: true},
    );
  })();

  // =============================================================== statement

  /**
   * Scroll-read paragraphs: every word starts as a ghost and inks in as the
   * paragraph crosses the screen. Text nodes are split in place, so inline
   * elements inside the paragraph survive.
   */
  (() => {
    if (reduceMotion) return;
    const blocks = [...document.querySelectorAll('[data-scrub]')].map((el) => {
      const words = [];
      for (const node of [...el.childNodes]) {
        if (node.nodeType !== Node.TEXT_NODE) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            node.classList.add('w');
            words.push(node);
          }
          continue;
        }
        const frag = document.createDocumentFragment();
        for (const part of node.nodeValue.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const span = document.createElement('span');
          span.className = 'w';
          span.textContent = part;
          words.push(span);
          frag.appendChild(span);
        }
        el.replaceChild(frag, node);
      }
      return {el, words, lit: 0};
    });
    if (!blocks.length) return;

    frameHooks.push((y, vh) => {
      for (const block of blocks) {
        const r = block.el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        // Starts as the first line clears the bottom fifth of the screen and
        // is done while the last line is still comfortably in view.
        const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.3), 0, 1);
        const lit = Math.round(p * block.words.length);
        if (lit === block.lit) continue;
        const from = Math.min(lit, block.lit);
        const to = Math.max(lit, block.lit);
        for (let i = from; i < to; i++) block.words[i].classList.toggle('is-lit', i < lit);
        block.lit = lit;
      }
    });
  })();

  // ================================================================= marquee

  /**
   * Rows of names that drift on their own and lean into the scroll: faster
   * when the page moves, and in the direction it is moving.
   */
  (() => {
    const rows = [...document.querySelectorAll('[data-marquee]')];
    if (!rows.length || reduceMotion) return;

    const items = rows.map((row) => {
      const sign = row.dataset.marquee === 'reverse' ? -1 : 1;
      const originals = [...row.children];
      const item = {row, sign, set: 1, x: 0, originals};
      return item;
    });

    function build(item) {
      for (const clone of item.row.querySelectorAll('[data-clone]')) clone.remove();
      item.set = Math.max(1, item.row.scrollWidth);
      const need = Math.ceil((item.row.parentElement.clientWidth + item.set) / item.set);
      for (let i = 1; i < need + 1; i++) {
        for (const node of item.originals) {
          const clone = node.cloneNode(true);
          clone.dataset.clone = '';
          clone.setAttribute('aria-hidden', 'true');
          item.row.appendChild(clone);
        }
      }
    }

    let visible = false;
    let raf = null;
    let lean = 1;

    function tick() {
      raf = null;
      if (!visible) return;
      const v = velocity;
      if (Math.abs(v) > 0.5) lean = v > 0 ? 1 : -1;
      const speed = (0.55 + Math.min(Math.abs(v), 60) * 0.32) * lean;
      for (const item of items) {
        item.x = (((item.x + speed * item.sign) % item.set) + item.set) % item.set;
        item.row.style.transform = `translate3d(${(-item.x).toFixed(2)}px, 0, 0)`;
      }
      // Velocity is only refreshed by the scroll loop; let it die away here so
      // the rows settle back to their idle drift once the page stops.
      velocity *= 0.92;
      raf = requestAnimationFrame(tick);
    }

    const start = () => {
      for (const item of items) build(item);
    };
    start();
    document.fonts?.ready.then(start);
    window.addEventListener('resize', () => setTimeout(start, 160), {passive: true});

    const onScreen = new Set();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      visible = onScreen.size > 0;
      if (visible && raf === null) raf = requestAnimationFrame(tick);
    });
    for (const host of new Set(items.map((i) => i.row.parentElement))) observer.observe(host);
  })();

  // ============================================================== wireframes

  /**
   * Three-dimensional wireframes without a canvas or a library: a model is a
   * list of points and the edges between them; each frame the points are
   * turned, projected with perspective and written into three SVG paths — the
   * far side faint, the near side stronger, and a chosen few edges at full
   * strength. They turn slowly on their own, faster with the scroll, and the
   * ones that take a pointer can be dragged round.
   */
  (() => {
    const hosts = [...document.querySelectorAll('[data-wire]')];
    if (!hosts.length) return;
    const NS = 'http://www.w3.org/2000/svg';

    /** Twelve points: the corners of three golden rectangles at right angles. */
    function icosahedron() {
      const phi = (1 + Math.sqrt(5)) / 2;
      const v = [];
      for (const a of [-1, 1]) for (const b of [-phi, phi]) v.push([0, a, b]);
      for (const a of [-1, 1]) for (const b of [-phi, phi]) v.push([a, b, 0]);
      for (const a of [-phi, phi]) for (const b of [-1, 1]) v.push([a, 0, b]);
      const e = [];
      const strong = [];
      for (let i = 0; i < 12; i++) {
        for (let k = i + 1; k < 12; k++) {
          const d = Math.hypot(v[i][0] - v[k][0], v[i][1] - v[k][1], v[i][2] - v[k][2]);
          const sameRect = Math.floor(i / 4) === Math.floor(k / 4);
          const differ = [0, 1, 2].filter((n) => v[i][n] !== v[k][n]).length;
          // The rectangles' own sides are drawn at full strength.
          if (sameRect && differ === 1) strong.push([i, k]);
          else if (Math.abs(d - 2) < 0.01) e.push([i, k]);
        }
      }
      return {v: v.map((q) => q.map((n) => n / 1.92)), e, strong, pitch: 0.42, spin: 0.16};
    }

    /** An airliner: fuselage rings, swept wings, two engines and a tail. Nose at -x. */
    function airliner() {
      const v = [];
      const e = [];
      const strong = [];
      const SIDES = 8;

      const ring = (x, r, cy = 0, cz = 0) => {
        const start = v.length;
        for (let i = 0; i < SIDES; i++) {
          const a = (i / SIDES) * Math.PI * 2;
          v.push([x, cy + Math.cos(a) * r, cz + Math.sin(a) * r]);
        }
        for (let i = 0; i < SIDES; i++) e.push([start + i, start + ((i + 1) % SIDES)]);
        return start;
      };
      const tube = (stations, cy = 0, cz = 0) => {
        let last = null;
        for (const [x, r] of stations) {
          const start = ring(x, r, cy, cz);
          if (last !== null) for (let i = 0; i < SIDES; i += 2) e.push([last + i, start + i]);
          last = start;
        }
      };
      const outline = (points, into = strong) => {
        const start = v.length;
        v.push(...points);
        for (let i = 0; i < points.length; i++) into.push([start + i, start + ((i + 1) % points.length)]);
      };

      tube([[-1.18, 0.012], [-1.08, 0.07], [-0.92, 0.105], [-0.5, 0.115], [0.45, 0.115], [0.85, 0.075], [1.14, 0.022]]);

      for (const side of [-1, 1]) {
        // wing, then the tailplane
        outline([[-0.2, side * 0.11, -0.04], [0.3, side * 1.02, 0.03], [0.42, side * 1.02, 0.03], [0.22, side * 0.11, -0.04]]);
        outline([[0.82, side * 0.06, 0.03], [1.02, side * 0.4, 0.05], [1.1, side * 0.4, 0.05], [1.04, side * 0.06, 0.03]]);
        // a rib or two, so the wing reads as a surface
        const rib = v.length;
        v.push([-0.02, side * 0.44, -0.015], [0.3, side * 0.44, -0.015], [0.14, side * 0.74, 0.01], [0.36, side * 0.74, 0.01]);
        e.push([rib, rib + 1], [rib + 2, rib + 3]);
        tube([[-0.2, 0.052], [-0.02, 0.058], [0.1, 0.04]], side * 0.4, -0.115);
      }
      outline([[0.66, 0, 0.1], [0.98, 0, 0.43], [1.1, 0, 0.43], [1.08, 0, 0.06]]);

      return {v, e, strong, pitch: 0.3, spin: 0.22, bank: true};
    }

    const MODELS = {icosa: icosahedron, plane: airliner};

    const items = hosts
      .map((svg) => {
        const model = MODELS[svg.dataset.wire]?.();
        if (!model) return null;
        const paths = ['wire__back', 'wire__front', 'wire__strong'].map((name) => {
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('class', name);
          svg.appendChild(path);
          return path;
        });
        return {svg, model, paths, yaw: 0.9, tilt: 0, visible: false, dragging: false};
      })
      .filter(Boolean);

    const CAMERA = 4.2;

    function draw(item) {
      const {model} = item;
      const cy = Math.cos(item.yaw);
      const sy = Math.sin(item.yaw);
      const pitch = model.pitch + item.tilt;
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      // A banked turn: the aircraft rolls a little about its own length.
      const roll = model.bank ? 0.28 * Math.sin(item.yaw * 0.5) : 0;
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);

      const pts = model.v.map(([x, y0, z0]) => {
        const y = y0 * cr - z0 * sr;
        const z = y0 * sr + z0 * cr;
        const x1 = x * cy - y * sy;
        const y1 = x * sy + y * cy;
        const depth = y1 * cp + z * sp;
        const up = z * cp - y1 * sp;
        const scale = CAMERA / (CAMERA + depth);
        return [x1 * scale, -up * scale, depth];
      });

      const seg = (a, b) => `M${pts[a][0].toFixed(3)} ${pts[a][1].toFixed(3)}L${pts[b][0].toFixed(3)} ${pts[b][1].toFixed(3)}`;
      let back = '';
      let front = '';
      for (const [a, b] of model.e) {
        if (pts[a][2] + pts[b][2] > 0) back += seg(a, b);
        else front += seg(a, b);
      }
      let strong = '';
      for (const [a, b] of model.strong) strong += seg(a, b);
      item.paths[0].setAttribute('d', back);
      item.paths[1].setAttribute('d', front);
      item.paths[2].setAttribute('d', strong);
    }

    for (const item of items) draw(item);
    if (reduceMotion) return;

    let raf = null;
    let last = performance.now();

    function tick(now) {
      raf = null;
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      let any = false;
      for (const item of items) {
        if (!item.visible) continue;
        any = true;
        if (!item.dragging) {
          item.yaw += dt * item.model.spin + velocity * 0.0016;
          item.tilt = lerp(item.tilt, 0, 0.04);
        }
        draw(item);
      }
      if (any) raf = requestAnimationFrame(tick);
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const item = items.find((i) => i.svg === entry.target);
        if (item) item.visible = entry.isIntersecting;
      }
      if (raf === null && items.some((i) => i.visible)) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    });
    for (const item of items) observer.observe(item.svg);

    // Drag to turn. Vertical touch movement is left to the page (pan-y), so a
    // phone can still scroll past with a thumb on the figure.
    for (const item of items) {
      if (item.svg.classList.contains('wire--ghost')) continue;
      let x = 0;
      let y = 0;
      item.svg.addEventListener('pointerdown', (event) => {
        item.dragging = true;
        x = event.clientX;
        y = event.clientY;
        item.svg.setPointerCapture?.(event.pointerId);
      });
      item.svg.addEventListener('pointermove', (event) => {
        if (!item.dragging) return;
        item.yaw += (event.clientX - x) * 0.008;
        item.tilt = clamp(item.tilt + (event.clientY - y) * 0.005, -0.7, 0.9);
        x = event.clientX;
        y = event.clientY;
      });
      const release = () => {
        item.dragging = false;
      };
      item.svg.addEventListener('pointerup', release);
      item.svg.addEventListener('pointercancel', release);
    }
  })();

  /** Figures lean toward the pointer, a few degrees in perspective. */
  (() => {
    if (reduceMotion || !finePointer) return;
    const targets = document.querySelectorAll('.plate__fig > svg, .hobby__fig > svg');
    for (const el of targets) {
      el.classList.add('tilt');
      const host = el.closest('.plate, .hobby') || el;
      host.addEventListener(
        'pointermove',
        (event) => {
          const r = el.getBoundingClientRect();
          const dx = clamp((event.clientX - (r.left + r.width / 2)) / r.width, -1.2, 1.2);
          const dy = clamp((event.clientY - (r.top + r.height / 2)) / r.height, -1.2, 1.2);
          el.style.setProperty('--ry', `${(dx * 9).toFixed(2)}deg`);
          el.style.setProperty('--rx', `${(-dy * 9).toFixed(2)}deg`);
        },
        {passive: true},
      );
      host.addEventListener('pointerleave', () => {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    }
  })();

  // ==================================================== chrome and rail state

  const sections = [...document.querySelectorAll('main section[id], main footer[id]')].filter(
    (el) => el.id !== 'top',
  );

  const railItems = new Map();
  for (const a of document.querySelectorAll('.rail__item a')) {
    railItems.set(a.getAttribute('href').slice(1), a.closest('.rail__item'));
  }
  const mrailItems = new Map();
  for (const a of document.querySelectorAll('.mrail a')) {
    mrailItems.set(a.getAttribute('href').slice(1), a);
  }

  let currentId = null;
  const lastTheme = new Map();

  /**
   * Light or dark for whatever band crosses a given viewport height. Each piece
   * of chrome asks about its own position: the top bar sits at the top edge, the
   * left rail's list hangs near the bottom, and those are often over different
   * bands at the same moment.
   */
  function themeAt(probe) {
    for (let i = bands.length - 1; i >= 0; i--) {
      const r = bands[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        return bands[i].dataset.band === 'light' ? 'light' : 'dark';
      }
    }
    return 'dark';
  }

  function applyTheme(el, probe) {
    if (!el) return;
    const theme = themeAt(probe);
    if (lastTheme.get(el) === theme) return;
    lastTheme.set(el, theme);
    el.dataset.theme = theme;
  }

  function updateChrome() {
    applyTheme(topbar, 30);
    applyTheme(mrail, window.innerHeight - 30);
    if (rail && railList) {
      const r = railList.getBoundingClientRect();
      applyTheme(rail, r.top + r.height / 2);
    }

    if (topbar) topbar.dataset.scrolled = window.scrollY > 24 ? 'true' : 'false';

    const pastHero = window.scrollY > heroHeight - window.innerHeight * 0.45;
    const atEnd =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const show = pastHero && !atEnd ? 'true' : 'false';
    if (rail) rail.dataset.visible = show;
    if (mrail) mrail.dataset.visible = show;

    // Which section holds the middle of the viewport, and how far through it.
    const probe = window.innerHeight * 0.4;
    let active = null;
    let progress = 0;
    for (const section of sections) {
      const r = section.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        active = section;
        progress = clamp((probe - r.top) / r.height, 0, 1);
        break;
      }
    }

    const id = active ? active.id : null;
    if (id !== currentId) {
      if (currentId) {
        railItems.get(currentId)?.removeAttribute('aria-current');
        mrailItems.get(currentId)?.removeAttribute('aria-current');
      }
      currentId = id;
      if (id) {
        railItems.get(id)?.setAttribute('aria-current', 'true');
        const chip = mrailItems.get(id);
        if (chip) {
          chip.setAttribute('aria-current', 'true');
          chip.scrollIntoView({block: 'nearest', inline: 'center', behavior: 'smooth'});
        }
      }
    }

    // The leader dots fill in as you move through the section.
    if (currentId) {
      railItems.get(currentId)?.style.setProperty('--p', progress.toFixed(3));
    }
  }

  // ============================================================== frame loop

  let rafId = null;

  function requestTick() {
    if (rafId === null) rafId = requestAnimationFrame(frame);
  }

  let lastY = window.scrollY;

  function frame() {
    rafId = null;
    const moving = scroller ? scroller.step() : false;
    const y = window.scrollY;
    velocity = lerp(velocity, y - lastY, 0.3);
    lastY = y;
    renderParallax(y);
    updateChrome();
    const vh = window.innerHeight;
    for (const hook of frameHooks) hook(y, vh);
    if (moving) requestTick();
  }

  window.addEventListener(
    'scroll',
    () => {
      scroller?.resync();
      requestTick();
    },
    {passive: true},
  );

  let resizeTimer = null;
  window.addEventListener(
    'resize',
    () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measure();
        requestTick();
      }, 120);
    },
    {passive: true},
  );

  measure();
  requestTick();

  window.PF = {
    clamp,
    lerp,
    easeInOut,
    easeOut,
    reduceMotion,
    finePointer,
    /** Run fn(scrollY, viewportHeight) on every frame the page moves. */
    onFrame(fn) {
      frameHooks.push(fn);
      requestTick();
    },
    requestTick,
    scrollTo: (y) => (scroller ? scroller.scrollTo(y) : window.scrollTo(0, y)),
    velocity: () => velocity,
    irisPaths,
  };

  // Sticky heights depend on the display face, which lands after first paint.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measure();
      requestTick();
    });
  }
  window.addEventListener('load', () => {
    measure();
    requestTick();
  });
})();
