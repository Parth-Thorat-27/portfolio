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
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const heroFrame = document.querySelector('.hero__frame');
  const heroGrid = document.querySelector('.hero__grid');

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
    for (const o of openers) {
      o.top = o.host.getBoundingClientRect().top + window.scrollY;
      o.height = Math.max(1, o.host.offsetHeight);
    }
  }

  function renderParallax(y) {
    if (reduceMotion) return;

    if (hero && heroFrame && heroGrid) {
      const p = clamp(y / heroHeight, 0, 1);
      // The title lifts and dissolves; the construction lines push past it, so
      // the two planes separate as the hero leaves.
      heroFrame.style.transform = `translate3d(0, ${(-p * 140).toFixed(2)}px, 0)`;
      heroFrame.style.opacity = clamp(1 - p * 1.6, 0, 1).toFixed(3);
      // Opacity here belongs to the entrance animation — transform only.
      heroGrid.style.transform = `scale(${(1 + p * 0.28).toFixed(4)})`;
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

    const pastHero = window.scrollY > window.innerHeight * 0.7;
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

  function frame() {
    rafId = null;
    const moving = scroller ? scroller.step() : false;
    renderParallax(window.scrollY);
    updateChrome();
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
