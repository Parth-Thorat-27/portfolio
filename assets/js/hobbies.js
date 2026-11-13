/**
 * The off-the-clock page's own motion, on top of portfolio.js.
 *
 *  1. viewfinder — a focus point that follows the pointer, a readout that stops
 *     down as the hero scrolls away, and a title that falls out of focus
 *  2. contact sheet — built from window.PHOTOS, with series filters, columns
 *     that drift against each other, and a full-screen viewer
 *  3. teentaal — the sixteen-beat cycle drawn as a wheel, playable
 *  4. the rally — a shuttle that crosses the court as the section scrolls
 *  5. the approach — an aircraft that turns onto final on a radar plot
 */

(() => {
  const PF = window.PF;
  if (!PF) return;
  const {clamp, lerp, reduceMotion, finePointer} = PF;
  const root = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';

  const svgEl = (name, attrs = {}, text) => {
    const el = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // ============================================================== viewfinder

  (() => {
    const hero = document.querySelector('[data-viewfinder]');
    if (!hero || reduceMotion) return;

    const center = hero.querySelector('[data-vf-center]');
    const grid = hero.querySelector('.vf__grid');
    const reticle = hero.querySelector('[data-vf-reticle]');
    const fStop = hero.querySelector('[data-vf-f]');
    const shutter = hero.querySelector('[data-vf-s]');
    const xy = hero.querySelector('[data-vf-xy]');

    // Stopping down a full stop halves the light, so the shutter slows a stop
    // to hold the exposure. The pairs below all let in the same amount.
    const STOPS = ['f/1.8', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16'];
    const SPEEDS = ['1/250', '1/100', '1/50', '1/25', '1/13', '1/6', '1/3'];
    let stop = -1;

    PF.onFrame((y, vh) => {
      const p = clamp(y / Math.max(1, hero.offsetHeight), 0, 1);
      if (p >= 1) return;
      // The title drifts up and out of focus, as if the lens were being pulled
      // to something further down the page.
      center.style.transform = `translate3d(0, ${(-p * 150).toFixed(1)}px, 0)`;
      center.style.filter = p > 0.01 ? `blur(${(p * 18).toFixed(1)}px)` : '';
      center.style.opacity = clamp(1 - p * 1.25, 0, 1).toFixed(3);
      grid.style.transform = `scale(${(1 + p * 0.25).toFixed(4)})`;

      const index = Math.min(STOPS.length - 1, Math.floor(p * 1.6 * STOPS.length));
      if (index !== stop) {
        stop = index;
        fStop.textContent = STOPS[index];
        shutter.textContent = SPEEDS[index];
      }
    });

    if (!finePointer || !reticle) return;
    const at = {x: 0, y: 0, tx: 0, ty: 0};
    let raf = null;

    function tick() {
      at.x = lerp(at.x, at.tx, 0.14);
      at.y = lerp(at.y, at.ty, 0.14);
      reticle.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
      raf = Math.abs(at.tx - at.x) + Math.abs(at.ty - at.y) > 0.2 ? requestAnimationFrame(tick) : null;
    }

    hero.addEventListener(
      'pointermove',
      (event) => {
        const r = hero.getBoundingClientRect();
        at.tx = event.clientX - r.left - r.width / 2;
        at.ty = event.clientY - r.top - r.height / 2;
        const px = String(Math.round(event.clientX - r.left)).padStart(4, '0');
        const py = String(Math.round(event.clientY - r.top)).padStart(4, '0');
        xy.textContent = `X ${px} · Y ${py}`;
        if (raf === null) raf = requestAnimationFrame(tick);
      },
      {passive: true},
    );
  })();

  // =========================================================== contact sheet

  (() => {
    const sheet = document.querySelector('[data-photos]');
    if (!sheet) return;

    const all = (Array.isArray(window.PHOTOS) ? window.PHOTOS : []).filter((p) => p && p.src);
    const filters = document.querySelector('[data-photo-filters]');
    const counter = document.querySelector('[data-photos-count]');
    const emptyNote = document.querySelector('[data-photos-empty]');
    const two = (n) => String(n).padStart(2, '0');

    let shown = all;
    let columns = [];

    const columnCount = () => {
      const w = sheet.clientWidth;
      return w < 520 ? 1 : w < 1000 ? 2 : 3;
    };

    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          reveal.unobserve(entry.target);
        }
      },
      {rootMargin: '0px 0px -6% 0px', threshold: 0.08},
    );

    /** A frame nobody has exposed yet: the box, and a focusing screen in it. */
    function emptyFrame(index, ratio) {
      const frame = document.createElement('div');
      frame.className = 'frame frame--empty';
      const box = document.createElement('span');
      box.className = 'frame__img';
      box.style.aspectRatio = String(ratio);
      const svg = svgEl('svg', {viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true'});
      svg.append(
        svgEl('path', {d: 'M0 0 100 100M100 0 0 100M50 0V100M0 50H100'}),
        svgEl('rect', {x: 33.3, y: 33.3, width: 33.4, height: 33.4}),
      );
      box.appendChild(svg);
      const cap = document.createElement('span');
      cap.className = 'frame__cap';
      cap.innerHTML = `<span class="frame__n">${two(index + 1)}</span><span>Unexposed</span>`;
      frame.append(box, cap);
      return frame;
    }

    function photoFrame(photo, index) {
      const frame = document.createElement('button');
      frame.type = 'button';
      frame.className = 'frame';
      frame.dataset.cursor = 'View';
      frame.dataset.index = String(index);

      const box = document.createElement('span');
      box.className = 'frame__img';
      box.style.aspectRatio = `${photo.w || 3} / ${photo.h || 2}`;
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = photo.thumb || photo.src;
      img.alt = photo.alt || photo.title || 'Photograph';
      if (photo.w && photo.h) {
        img.width = photo.w;
        img.height = photo.h;
      }
      box.appendChild(img);

      const cap = document.createElement('span');
      cap.className = 'frame__cap';
      const n = document.createElement('span');
      n.className = 'frame__n';
      n.textContent = two(index + 1);
      const t = document.createElement('span');
      t.className = 'frame__t';
      t.textContent = photo.title || '';
      cap.append(n, t);
      if (photo.place) {
        const p = document.createElement('span');
        p.className = 'frame__p';
        p.textContent = photo.place;
        cap.appendChild(p);
      }

      frame.append(box, cap);
      return frame;
    }

    /**
     * Each frame goes to whichever column is shortest so far, using the ratios
     * from the manifest — so the sheet reads left to right in order, and no
     * image has to load before the layout is known.
     */
    function render() {
      reveal.disconnect();
      sheet.textContent = '';
      const count = columnCount();
      columns = Array.from({length: count}, () => {
        const col = document.createElement('div');
        col.className = 'sheet__col';
        sheet.appendChild(col);
        return {el: col, height: 0};
      });

      const empty = shown.length === 0;
      const ratios = [3 / 2, 2 / 3, 1, 4 / 5, 3 / 2, 3 / 2, 2 / 3, 16 / 9, 1];
      const total = empty ? ratios.length : shown.length;

      for (let i = 0; i < total; i++) {
        const ratio = empty ? ratios[i] : (shown[i].w || 3) / (shown[i].h || 2);
        const frame = empty ? emptyFrame(i, ratio) : photoFrame(shown[i], i);
        const target = columns.reduce((a, b) => (b.height < a.height ? b : a));
        target.el.appendChild(frame);
        target.height += 1 / ratio + 0.12;
        if (reduceMotion) frame.classList.add('is-in');
        else reveal.observe(frame);
      }

      if (emptyNote) emptyNote.hidden = !empty || all.length > 0;
      if (counter) counter.textContent = empty ? '00' : two(shown.length);
      PF.requestTick();
    }

    // -------------------------------------------------------------- filters

    const series = [...new Set(all.map((p) => p.series).filter(Boolean))];
    if (filters && series.length > 1) {
      const make = (label, value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter';
        button.textContent = label;
        button.setAttribute('aria-pressed', String(value === null));
        button.addEventListener('click', () => {
          for (const other of filters.children) other.setAttribute('aria-pressed', 'false');
          button.setAttribute('aria-pressed', 'true');
          shown = value === null ? all : all.filter((p) => p.series === value);
          render();
        });
        filters.appendChild(button);
      };
      make('All', null);
      for (const name of series) make(name, name);
    }

    render();

    let lastCount = columnCount();
    window.addEventListener(
      'resize',
      () => {
        const next = columnCount();
        if (next === lastCount) return;
        lastCount = next;
        render();
      },
      {passive: true},
    );

    // The columns drift against each other while the sheet is on screen.
    if (!reduceMotion) {
      PF.onFrame((y, vh) => {
        if (columns.length < 2) return;
        const r = sheet.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        const p = clamp((vh - r.top) / (vh + r.height), 0, 1) - 0.5;
        columns.forEach((col, i) => {
          const drift = (i % 2 ? -1 : 1) * p * 64;
          col.el.style.transform = `translate3d(0, ${drift.toFixed(1)}px, 0)`;
        });
      });
    }

    // --------------------------------------------------------------- viewer

    const dialog = document.querySelector('[data-viewer]');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    const img = dialog.querySelector('[data-viewer-img]');
    const stage = dialog.querySelector('[data-viewer-stage]');
    const title = dialog.querySelector('[data-viewer-title]');
    const meta = dialog.querySelector('[data-viewer-meta]');
    const count = dialog.querySelector('[data-viewer-count]');
    let current = 0;

    function show(index) {
      if (!shown.length) return;
      current = (index + shown.length) % shown.length;
      const photo = shown[current];

      img.dataset.loading = '';
      img.alt = photo.alt || photo.title || 'Photograph';
      img.src = photo.src;
      title.textContent = photo.title || '';
      meta.textContent = [photo.place, photo.series, photo.exif].filter(Boolean).join(' · ');
      count.textContent = `${two(current + 1)} / ${two(shown.length)}`;

      // Have the next one ready before it is asked for.
      const ahead = shown[(current + 1) % shown.length];
      if (ahead && ahead !== photo) new Image().src = ahead.src;
    }

    img.addEventListener('load', () => delete img.dataset.loading);
    img.addEventListener('error', () => {
      delete img.dataset.loading;
      title.textContent = 'That photograph could not be loaded.';
    });

    sheet.addEventListener('click', (event) => {
      const frame = event.target.closest('button.frame');
      if (!frame) return;
      show(Number(frame.dataset.index));
      // Same contract as the certificate viewer: the momentum scroller reads
      // the attribute, the overflow covers native scrolling.
      root.dataset.modalOpen = 'true';
      root.style.overflow = 'hidden';
      dialog.showModal();
    });

    dialog.querySelector('[data-viewer-prev]').addEventListener('click', () => show(current - 1));
    dialog.querySelector('[data-viewer-next]').addEventListener('click', () => show(current + 1));
    dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());

    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') show(current - 1);
      else if (event.key === 'ArrowRight') show(current + 1);
    });

    // A sideways swipe on the picture moves between frames.
    let downX = null;
    stage.addEventListener('pointerdown', (event) => {
      downX = event.clientX;
    });
    stage.addEventListener('pointerup', (event) => {
      if (downX === null) return;
      const dx = event.clientX - downX;
      downX = null;
      if (Math.abs(dx) > 48) show(current + (dx < 0 ? 1 : -1));
    });

    dialog.addEventListener('close', () => {
      delete root.dataset.modalOpen;
      root.style.overflow = '';
      const frame = sheet.querySelector(`button.frame[data-index="${current}"]`);
      frame?.focus({preventScroll: true});
    });
  })();

  // ================================================================ teentaal

  (() => {
    const host = document.querySelector('[data-taal]');
    const wheel = document.querySelector('[data-taal-wheel]');
    if (!host || !wheel) return;

    const BOLS = [
      'Dha', 'Dhin', 'Dhin', 'Dha',
      'Dha', 'Dhin', 'Dhin', 'Dha',
      'Dha', 'Tin', 'Tin', 'Ta',
      'Ta', 'Dhin', 'Dhin', 'Dha',
    ];
    // Clap, clap, wave, clap: sam, the second tali, khali, the third tali.
    const MARKS = {0: 'X', 4: '2', 8: '0', 12: '3'};
    const STEP = 360 / BOLS.length;
    const polar = (deg, r) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return [Math.cos(a) * r, Math.sin(a) * r];
    };

    wheel.textContent = '';
    wheel.append(
      svgEl('circle', {class: 'ln ln--dim', r: 200}),
      svgEl('circle', {class: 'ln', r: 150}),
      svgEl('circle', {class: 'ln ln--dim', r: 78}),
    );

    // The four bar lines, halfway between the last beat of one bar and the
    // first of the next.
    for (let bar = 0; bar < 4; bar++) {
      const [x1, y1] = polar(bar * 90 - STEP / 2, 78);
      const [x2, y2] = polar(bar * 90 - STEP / 2, 200);
      wheel.appendChild(svgEl('line', {class: 'ln ln--dim', x1, y1, x2, y2}));
    }

    const hand = svgEl('g', {class: 'hand'});
    hand.appendChild(svgEl('line', {class: 'ln', x1: 0, y1: -158, x2: 0, y2: -200}));
    wheel.appendChild(hand);

    const dots = [];
    const labels = [];
    BOLS.forEach((bol, i) => {
      const [dx, dy] = polar(i * STEP, 150);
      const dot = svgEl('circle', {class: 'dot', cx: dx, cy: dy, r: MARKS[i] ? 7 : 4.5});
      const [tx, ty] = polar(i * STEP, 116);
      const label = svgEl('text', {x: tx, y: ty}, bol);
      dots.push(dot);
      labels.push(label);
      wheel.append(dot, label);
      if (MARKS[i]) {
        const [mx, my] = polar(i * STEP, 222);
        wheel.appendChild(svgEl('text', {class: 'mark', x: mx, y: my}, MARKS[i]));
      }
    });

    const bolText = svgEl('text', {class: 'bol', x: 0, y: -8}, 'Dha');
    const beatText = svgEl('text', {class: 'beatno', x: 0, y: 30}, '01 / 16');
    wheel.append(bolText, beatText);

    let turns = 0;
    let lit = -1;

    function light(beat) {
      if (lit >= 0) {
        dots[lit].classList.remove('is-on');
        labels[lit].classList.remove('is-on');
      }
      lit = beat;
      dots[beat].classList.add('is-on');
      labels[beat].classList.add('is-on');
      bolText.textContent = BOLS[beat];
      beatText.textContent = `${String(beat + 1).padStart(2, '0')} / 16`;
      // Counted in whole turns so the hand never sweeps backwards from 16 to 1.
      hand.style.transform = `rotate(${turns * 360 + beat * STEP}deg)`;
    }

    light(0);

    // ---------------------------------------------------------------- sound

    const playButton = host.querySelector('[data-taal-play]');
    const tempo = host.querySelector('[data-taal-tempo]');
    const bpmLabel = host.querySelector('[data-taal-bpm]');
    if (!playButton) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let ctx = null;
    let out = null;
    let noise = null;
    let playing = false;
    let timer = null;
    let nextTime = 0;
    let beat = 0;
    const pending = new Set();

    /** The bayan: a low sine whose pitch falls away as the palm lifts. */
    function bass(t) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, t);
      osc.frequency.exponentialRampToValueAtTime(68, t + 0.2);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 0.55);
    }

    /** The dayan: a pitched ring with a short stick of noise on the front. */
    function treble(t, ring) {
      const decay = ring ? 0.42 : 0.11;
      for (const [freq, level] of [[392, 0.34], [784, 0.16], [1176, 0.06]]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(level, t + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        osc.connect(gain).connect(out);
        osc.start(t);
        osc.stop(t + decay + 0.05);
      }
      const click = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      click.buffer = noise;
      filter.type = 'highpass';
      filter.frequency.value = 2400;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      click.connect(filter).connect(gain).connect(out);
      click.start(t);
      click.stop(t + 0.04);
    }

    const STROKES = {
      Dha: (t) => (bass(t), treble(t, false)),
      Dhin: (t) => (bass(t), treble(t, true)),
      Tin: (t) => treble(t, true),
      Ta: (t) => treble(t, false),
    };

    function setUp() {
      if (ctx || !AudioCtx) return;
      ctx = new AudioCtx();
      out = ctx.createGain();
      out.gain.value = 0.7;
      out.connect(ctx.destination);
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }

    const interval = () => 60 / Number(tempo?.value || 150);
    const clock = () => (ctx ? ctx.currentTime : performance.now() / 1000);

    /** Schedule a little ahead of the audio clock; a timer alone drifts. */
    function pump() {
      while (nextTime < clock() + 0.12) {
        const at = nextTime;
        const which = beat;
        if (ctx) STROKES[BOLS[which]](at);
        const id = setTimeout(() => {
          pending.delete(id);
          if (!playing) return;
          if (which === 0 && lit === BOLS.length - 1) turns += 1;
          light(which);
        }, Math.max(0, (at - clock()) * 1000));
        pending.add(id);
        nextTime += interval();
        beat = (beat + 1) % BOLS.length;
      }
      timer = setTimeout(pump, 30);
    }

    function start() {
      setUp();
      ctx?.resume();
      playing = true;
      beat = 0;
      turns += lit > 0 ? 1 : 0;
      nextTime = clock() + 0.06;
      playButton.setAttribute('aria-pressed', 'true');
      playButton.firstChild.nodeValue = 'Stop';
      pump();
    }

    function stop() {
      playing = false;
      clearTimeout(timer);
      for (const id of pending) clearTimeout(id);
      pending.clear();
      playButton.setAttribute('aria-pressed', 'false');
      playButton.firstChild.nodeValue = 'Play the theka';
    }

    playButton.addEventListener('click', () => (playing ? stop() : start()));
    tempo?.addEventListener('input', () => {
      bpmLabel.textContent = `${tempo.value} bpm`;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && playing) stop();
    });

    // Nobody wants a drum they cannot see.
    new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting && playing) stop();
    }).observe(host);
  })();

  // =================================================================== rally

  (() => {
    const court = document.querySelector('[data-court]');
    const rally = court?.querySelector('[data-court-rally]');
    const shuttle = court?.querySelector('[data-court-shuttle]');
    if (!court || !rally || !shuttle) return;

    const length = rally.getTotalLength();
    const place = (p) => {
      const point = rally.getPointAtLength(length * p);
      shuttle.setAttribute('cx', point.x.toFixed(1));
      shuttle.setAttribute('cy', point.y.toFixed(1));
      court.style.setProperty('--rally', (1 - p).toFixed(4));
    };

    if (reduceMotion) {
      place(1);
      return;
    }

    place(0);
    PF.onFrame((y, vh) => {
      const r = court.getBoundingClientRect();
      if (r.bottom < -60 || r.top > vh + 60) return;
      // Starts as the court comes in at the bottom, ends as it nears the top.
      place(clamp((vh * 0.92 - r.top) / (vh * 0.8), 0, 1));
    });
  })();

  // ================================================================== flight

  (() => {
    const plot = document.querySelector('[data-flight]');
    const path = plot?.querySelector('[data-flight-path]');
    const plane = plot?.querySelector('[data-flight-plane]');
    if (!plot || !path || !plane) return;

    const length = path.getTotalLength();
    const place = (p) => {
      const at = path.getPointAtLength(length * p);
      // The heading is the path's own tangent, sampled a little either side.
      const a = path.getPointAtLength(Math.max(0, length * p - 2));
      const b = path.getPointAtLength(Math.min(length, length * p + 2));
      const heading = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      plane.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) rotate(${heading.toFixed(1)})`);
      plot.style.setProperty('--flown', (1 - p).toFixed(4));
    };

    if (reduceMotion) {
      place(1);
      return;
    }

    place(0);
    PF.onFrame((y, vh) => {
      const r = plot.getBoundingClientRect();
      if (r.bottom < -60 || r.top > vh + 60) return;
      place(clamp((vh * 0.95 - r.top) / (vh * 0.85), 0, 1));
    });
  })();
})();
