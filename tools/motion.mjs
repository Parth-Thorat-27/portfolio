/**
 * Checks the scroll behaviour that screenshots cannot see: that a wheel tick
 * eases over several frames instead of jumping, that opener titles pin, that
 * parallax transforms actually change with scroll, and that all of it switches
 * off under prefers-reduced-motion.
 *
 *   node tools/motion.mjs [url]
 */

import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGE_URL = process.argv[2] || 'http://127.0.0.1:8123/';

const results = [];
const check = (name, pass, detail) => {
  results.push({name, pass, detail});
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--no-sandbox'],
});

async function open({reduceMotion = false} = {}) {
  const page = await browser.newPage();
  await page.setViewport({width: 1440, height: 900});
  if (reduceMotion) {
    await page.emulateMediaFeatures([
      {name: 'prefers-reduced-motion', value: 'reduce'},
    ]);
  }
  await page.goto(PAGE_URL, {waitUntil: 'networkidle0'});
  await new Promise((r) => setTimeout(r, 1500));
  return page;
}

// --------------------------------------------------------------- full motion

const page = await open();

// 1. One wheel tick should ease over several frames, not land instantly.
await page.mouse.move(720, 450);
const samples = [];
await page.mouse.wheel({deltaY: 900});
for (let i = 0; i < 14; i++) {
  samples.push(await page.evaluate(() => Math.round(window.scrollY)));
  await new Promise((r) => setTimeout(r, 40));
}
const distinct = new Set(samples).size;
const settled = samples.at(-1);
check(
  'wheel input eases over frames',
  distinct >= 5 && settled > 400,
  `${distinct} distinct positions, settled at ${settled}px`,
);
check(
  'eased scroll converges on the target',
  Math.abs(settled - 900) < 60,
  `wanted ~900px, got ${settled}px`,
);

// 2. Opener titles should hold still while the section scrolls beneath them.
const pin = await page.evaluate(async () => {
  const opener = document.querySelector('#projects .opener');
  const inner = opener.querySelector('.opener__inner');
  const top = opener.getBoundingClientRect().top + window.scrollY;

  const at = async (y) => {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return inner.getBoundingClientRect().top;
  };

  return {a: await at(top + 60), b: await at(top + 320), openerHeight: opener.offsetHeight};
});
check(
  'opener title pins while scrolling',
  Math.abs(pin.b - pin.a) < 140 && pin.openerHeight > 1000,
  `title moved ${Math.abs(pin.b - pin.a).toFixed(0)}px over 260px of scroll`,
);

// 3. Parallax transforms must differ between two scroll positions.
const parallax = await page.evaluate(async () => {
  const grid = document.querySelector('#projects .opener__grid');
  const at = async (y) => {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return grid.style.transform;
  };
  const top = document.querySelector('#projects .opener').getBoundingClientRect().top + window.scrollY;
  return {near: await at(top + 40), far: await at(top + 700)};
});
check(
  'opener artwork parallaxes',
  Boolean(parallax.near) && parallax.near !== parallax.far,
  `${parallax.near || '(none)'} -> ${parallax.far || '(none)'}`,
);

// 4. The hero is pinned, and its frame opens into the paper as the page scrolls.
const heroMotion = await page.evaluate(async () => {
  const hero = document.querySelector('.hero');
  const pin = hero.querySelector('.hero__pin');
  const paper = hero.querySelector('.hero__paper');
  const ink = paper.querySelector('.hero__title');
  const travel = hero.offsetHeight - window.innerHeight;
  const at = async (frac) => {
    window.scrollTo(0, travel * frac);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      top: Math.round(pin.getBoundingClientRect().top),
      clip: paper.style.clipPath,
      scale: Number(ink.style.getPropertyValue('--s')),
      band: hero.dataset.band,
    };
  };
  return {start: await at(0), mid: await at(0.5), end: await at(0.95), travel};
});
check(
  'hero stays pinned while its frame opens',
  heroMotion.travel > 600 && heroMotion.mid.top === 0 && heroMotion.end.top === 0,
  `pin at ${heroMotion.mid.top}px and ${heroMotion.end.top}px over ${Math.round(heroMotion.travel)}px of scroll`,
);
check(
  'hero frame opens to the full screen',
  heroMotion.start.clip !== heroMotion.mid.clip && heroMotion.end.clip.replace(/[^0-9.]+/g, ' ').trim().split(' ').every((n) => Number(n) === 0),
  `${heroMotion.start.clip} -> ${heroMotion.end.clip}`,
);
check(
  'hero name grows and the band turns light',
  heroMotion.end.scale > heroMotion.start.scale && heroMotion.start.band === 'dark' && heroMotion.end.band === 'light',
  `scale ${heroMotion.start.scale} -> ${heroMotion.end.scale}, band ${heroMotion.start.band} -> ${heroMotion.end.band}`,
);

// 5. The rail leader fills with progress through the section.
const leader = await page.evaluate(async () => {
  const section = document.getElementById('experience');
  const at = async (frac) => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + section.offsetHeight * frac);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const item = document.querySelector('.rail__item[aria-current="true"]');
    return item ? item.style.getPropertyValue('--p') : '';
  };
  return {early: await at(0.15), late: await at(0.7)};
});
check(
  'rail leader tracks section progress',
  leader.early !== '' && Number(leader.late) > Number(leader.early),
  `--p ${leader.early || '(unset)'} -> ${leader.late || '(unset)'}`,
);

// 6. Contact copy buttons.
//
// Headless Chrome refuses real clipboard writes ("Write permission denied")
// even with clipboard-write granted via CDP, so the actual write cannot be
// exercised here. Stub navigator.clipboard instead: that is the part this
// codebase owns, and it lets both the success and failure branches be driven
// deterministically.
await page.evaluate(() => document.getElementById('contact').scrollIntoView());
await new Promise((r) => setTimeout(r, 900));

await page.evaluate(() => {
  window.__writes = [];
  window.__failNext = false;
  navigator.clipboard.writeText = (text) => {
    if (window.__failNext) return Promise.reject(new DOMException('denied', 'NotAllowedError'));
    window.__writes.push(text);
    return Promise.resolve();
  };
});

await (await page.$('.cta .copy')).click();
await new Promise((r) => setTimeout(r, 200));

const copied = await page.evaluate(() => ({
  writes: window.__writes,
  label: document.querySelector('.cta .copy [data-copy-label]').textContent,
  state: document.querySelector('.cta .copy').dataset.copied,
  status: document.querySelector('[data-copy-status]').textContent,
}));

check(
  'copy button sends the email to the clipboard API',
  copied.writes.length === 1 && copied.writes[0] === 'pt47275@gmail.com',
  `wrote ${JSON.stringify(copied.writes)}`,
);
check(
  'copy button confirms visually and to screen readers',
  copied.label === 'Copied' && copied.state === 'true' && copied.status.includes('copied'),
  `label "${copied.label}", status "${copied.status}"`,
);

// The confirmation must not stick around forever.
await new Promise((r) => setTimeout(r, 2100));
const reverted = await page.evaluate(() => ({
  label: document.querySelector('.cta .copy [data-copy-label]').textContent,
  state: document.querySelector('.cta .copy').dataset.copied,
}));
check(
  'copy button reverts after a couple of seconds',
  reverted.label === 'Copy' && reverted.state === undefined,
  `label "${reverted.label}"`,
);

// A rejected write must not claim success.
await page.evaluate(() => {
  window.__failNext = true;
});
await (await page.$('.cta .copy')).click();
await new Promise((r) => setTimeout(r, 200));
const denied = await page.evaluate(() => ({
  label: document.querySelector('.cta .copy [data-copy-label]').textContent,
  status: document.querySelector('[data-copy-status]').textContent,
}));
check(
  'a denied clipboard write reports honestly',
  denied.label === 'Copy' && /could not copy/i.test(denied.status),
  `label "${denied.label}", status "${denied.status}"`,
);

// 7. The local clock renders a real time rather than the placeholder.
const clock = await page.evaluate(() => document.querySelector('[data-clock]').textContent);
check('local time renders', /^\d{2}:\d{2} IST$/.test(clock), clock);

// 8. Nothing in the contact section overflows its column.
const contactOverflow = await page.evaluate(() => {
  const footer = document.getElementById('contact');
  const bounds = footer.getBoundingClientRect();
  const bad = [];
  for (const el of footer.querySelectorAll('.cta, .footer__meta, .footer__base, .status')) {
    const r = el.getBoundingClientRect();
    if (r.right > bounds.right + 1 || r.left < bounds.left - 1) bad.push(el.className);
  }
  return bad;
});
check('contact content stays inside the section', contactOverflow.length === 0, contactOverflow.join(', '));

await page.close();

// ------------------------------------------------------------ reduced motion

const calm = await open({reduceMotion: true});

const calmState = await calm.evaluate(async () => {
  const before = Math.round(window.scrollY);
  window.scrollTo(0, 600);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return {
    before,
    after: Math.round(window.scrollY),
    heroTransform: document.querySelector('.hero__frame').style.transform,
    scrollBehavior: document.documentElement.style.scrollBehavior,
    titleSplit: document.querySelectorAll('.opener__title .mask').length,
    ledeOpacity: getComputedStyle(document.querySelector('.opener__lede')).opacity,
  };
});

check(
  'reduced motion: no smooth-scroll hijack',
  calmState.after === 600 && calmState.scrollBehavior !== 'auto',
  `scrollTo(600) landed at ${calmState.after}px`,
);
check('reduced motion: no parallax transforms', calmState.heroTransform === '');
check('reduced motion: titles not split into masks', calmState.titleSplit === 0);
check('reduced motion: ledes visible', calmState.ledeOpacity === '1');

await calm.close();
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
