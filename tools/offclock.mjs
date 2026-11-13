/**
 * Checks the off-the-clock page and the iris that joins it to the work page:
 * the contact sheet matches the manifest, the viewer opens, pages and closes,
 * teentaal plays and stops, and a click on the switch closes the iris, lands on
 * the other page and opens it again.
 *
 *   node tools/offclock.mjs [origin]
 */

import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ORIGIN = (process.argv[2] || 'http://127.0.0.1:8123').replace(/\/$/, '');

const results = [];
const check = (name, pass, detail) => {
  results.push(pass);
  console.log(`${pass ? 'OK  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900});

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failed = [];
page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

await page.goto(`${ORIGIN}/hobbies.html`, {waitUntil: 'networkidle0'});
await wait(1600);

// ---------------------------------------------------------------- arrival

const arrival = await page.evaluate(() => ({
  pending: document.documentElement.classList.contains('iris-pending'),
  curtain: document.querySelector('.iris')?.hasAttribute('data-on'),
  topbar: document.querySelector('[data-topbar]').dataset.theme,
}));
check('the iris has opened and cleared', !arrival.pending && !arrival.curtain);
check('the page opens on paper, with dark chrome', arrival.topbar === 'light', arrival.topbar);

// ---------------------------------------------------------- contact sheet

const sheet = await page.evaluate(() => ({
  manifest: (window.PHOTOS || []).length,
  frames: document.querySelectorAll('[data-photos] button.frame').length,
  empties: document.querySelectorAll('[data-photos] .frame--empty').length,
  columns: document.querySelectorAll('[data-photos] .sheet__col').length,
  count: document.querySelector('[data-photos-count]').textContent,
}));
check(
  'contact sheet matches the manifest',
  sheet.frames === sheet.manifest && Number(sheet.count) === sheet.manifest,
  `${sheet.manifest} in the manifest, ${sheet.frames} frames, counter ${sheet.count}`,
);
check(
  'an empty manifest shows unexposed frames, a full one shows none',
  sheet.manifest ? sheet.empties === 0 : sheet.empties > 0,
  `${sheet.empties} placeholders`,
);
check('sheet is laid out in three columns at 1440px', sheet.columns === 3, `${sheet.columns}`);

if (sheet.manifest) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-photos]');
    window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 160, behavior: 'instant'});
  });
  await wait(900);
  await page.click('[data-photos] button.frame[data-index="0"]');
  await wait(900);
  const opened = await page.evaluate(() => ({
    open: document.querySelector('[data-viewer]').open,
    locked: document.documentElement.dataset.modalOpen,
    count: document.querySelector('[data-viewer-count]').textContent,
    decoded: document.querySelector('[data-viewer-img]').naturalWidth > 0,
  }));
  check('clicking a frame opens the viewer and locks the page', opened.open && opened.locked === 'true');
  check('the photograph decodes', opened.decoded, opened.count);

  // Whatever is on screen must sit inside the stage, clear of the caption.
  const fit = await page.evaluate(() => {
    const img = document.querySelector('[data-viewer-img]').getBoundingClientRect();
    const foot = document.querySelector('.viewer__foot').getBoundingClientRect();
    return {bottom: Math.round(img.bottom), foot: Math.round(foot.top)};
  });
  check('the photograph stays above its caption', fit.bottom <= fit.foot, `${fit.bottom}px vs ${fit.foot}px`);

  await page.keyboard.press('ArrowRight');
  await wait(300);
  const paged = await page.evaluate(() => document.querySelector('[data-viewer-count]').textContent);
  check('the right arrow moves to the next frame', sheet.manifest < 2 || paged.startsWith('02'), paged);

  await page.keyboard.press('Escape');
  await wait(300);
  const closed = await page.evaluate(() => ({
    open: document.querySelector('[data-viewer]').open,
    locked: document.documentElement.dataset.modalOpen ?? null,
  }));
  check('Esc closes it and releases the page', !closed.open && closed.locked === null);
}

// ---------------------------------------------------------------- teentaal

await page.evaluate(() => {
  const el = document.querySelector('[data-taal]');
  window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 200, behavior: 'instant'});
});
await wait(700);
const wheel = await page.evaluate(() => ({
  dots: document.querySelectorAll('.taal__wheel .dot').length,
  beat: document.querySelector('.taal__wheel .beatno').textContent,
}));
check('the wheel draws sixteen beats, resting on sam', wheel.dots === 16 && wheel.beat.startsWith('01'), wheel.beat);

await page.click('[data-taal-play]');
await wait(1900);
const playing = await page.evaluate(() => ({
  beat: Number(document.querySelector('.taal__wheel .beatno').textContent.slice(0, 2)),
  pressed: document.querySelector('[data-taal-play]').getAttribute('aria-pressed'),
}));
check('play advances the cycle', playing.pressed === 'true' && playing.beat > 2, `on beat ${playing.beat}`);

await page.click('[data-taal-play]');
await wait(200);
const before = await page.evaluate(() => document.querySelector('.taal__wheel .beatno').textContent);
await wait(900);
const after = await page.evaluate(() => document.querySelector('.taal__wheel .beatno').textContent);
check('stop holds it where it is', before === after, after);

// ------------------------------------------------------------------- rally

const rally = await page.evaluate(async () => {
  const court = document.querySelector('[data-court]');
  const at = async (offset) => {
    window.scrollTo({top: court.getBoundingClientRect().top + window.scrollY - offset, behavior: 'instant'});
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Number(court.style.getPropertyValue('--rally'));
  };
  return {early: await at(window.innerHeight * 0.85), late: await at(window.innerHeight * 0.2)};
});
check('the rally plays out with the scroll', rally.early > rally.late, `${rally.early} -> ${rally.late} left to draw`);

// -------------------------------------------------------------------- iris

await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
await wait(500);
const navigation = page.waitForNavigation({waitUntil: 'domcontentloaded'});
await page.click('.sides__a[data-iris]');
await wait(250);
const closing = await page.evaluate(() => ({
  on: document.querySelector('.iris').hasAttribute('data-on'),
  here: location.pathname,
}));
check('the switch closes the iris before leaving', closing.on && closing.here.endsWith('hobbies.html'));
await navigation;
await wait(1800);
const landed = await page.evaluate(() => ({
  path: location.pathname,
  curtain: document.querySelector('.iris')?.hasAttribute('data-on'),
  pending: document.documentElement.classList.contains('iris-pending'),
}));
check(
  'and opens again on the work page',
  landed.path.endsWith('index.html') && !landed.curtain && !landed.pending,
  landed.path,
);

check('no 4xx responses', failed.length === 0, failed.join(', '));
check('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
