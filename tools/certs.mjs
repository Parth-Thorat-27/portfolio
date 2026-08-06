/**
 * Drives the certificate viewer: that nothing is fetched until a name is
 * clicked, that each name opens its own scan, and that every way out — the
 * button, the backdrop, Esc — closes it and releases the scroll lock.
 *
 *   node tools/serve.mjs &
 *   node tools/certs.mjs [url]
 */
import puppeteer from 'puppeteer-core';

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const CHROME =
  process.env.CHROME ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

let pass = 0;
let fail = 0;
const ok = (m, d) => (pass++, console.log(`OK    ${m}${d ? ` — ${d}` : ''}`));
const bad = (m, d) => (fail++, console.log(`FAIL  ${m}${d ? ` — ${d}` : ''}`));

const browser = await puppeteer.launch({executablePath: CHROME, headless: 'new'});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900});

const bad404 = [];
page.on('response', (r) => {
  if (r.status() >= 400) bad404.push(`${r.status()} ${r.url()}`);
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(URL, {waitUntil: 'networkidle0'});

/**
 * Open by a real mouse press, having first put the card clear of the fixed top
 * bar — puppeteer's own scroll-into-view can park it underneath, where the
 * click lands on the header instead of the card.
 */
async function openByMouse(index = 0) {
  const box = await page.evaluate((i) => {
    const b = document.querySelectorAll('.cert__open')[i];
    const r = b.getBoundingClientRect();
    window.scrollTo({top: window.scrollY + r.top - 300, behavior: 'instant'});
    const after = b.getBoundingClientRect();
    return {x: Math.round(after.x + after.width / 2), y: Math.round(after.y + after.height / 2)};
  }, index);
  await page.mouse.click(box.x, box.y);
  await page.waitForFunction(
    () => document.querySelector('dialog.lightbox')?.open === true,
    {timeout: 3000},
  );
}


// --- nothing fetched up front -------------------------------------------
const eager = await page.evaluate(() =>
  performance.getEntriesByType('resource').filter((r) => r.name.includes('/certificates/')).length,
);
eager === 0
  ? ok('no certificate scan is fetched on load')
  : bad('no certificate scan is fetched on load', `${eager} were`);

// --- a closed dialog must not be laid out -------------------------------
// Setting display on .lightbox rather than .lightbox[open] beats the user
// agent's dialog:not([open]) rule, leaving an invisible block at the end of the
// page that still swallows clicks over it.
const closedBox = await page.evaluate(() => {
  const d = document.querySelector('dialog.lightbox');
  const r = d.getBoundingClientRect();
  return {display: getComputedStyle(d).display, area: Math.round(r.width * r.height)};
});
closedBox.display === 'none' && closedBox.area === 0
  ? ok('a closed viewer takes up no space')
  : bad('a closed viewer takes up no space', JSON.stringify(closedBox));

// --- count matches the card count ---------------------------------------
const counts = await page.evaluate(() => ({
  cards: document.querySelectorAll('.cert').length,
  buttons: document.querySelectorAll('.cert__open').length,
  label: document.querySelector('#certifications .slab__count')?.textContent.trim(),
}));
counts.cards === counts.buttons
  ? ok('every certification card has an open button', `${counts.cards}`)
  : bad('every certification card has an open button', JSON.stringify(counts));
Number(counts.label) === counts.cards
  ? ok('the stated count matches the cards', counts.label)
  : bad('the stated count matches the cards', `label ${counts.label} vs ${counts.cards} cards`);

// --- every path resolves -------------------------------------------------
const paths = await page.$$eval('.cert__open', (bs) => bs.map((b) => b.dataset.cert));
const missing = [];
for (const p of paths) {
  const res = await page.evaluate(async (u) => {
    const r = await fetch(u, {method: 'HEAD'});
    return r.status;
  }, p);
  if (res !== 200) missing.push(`${p} -> ${res}`);
}
missing.length === 0
  ? ok('every certificate path resolves', `${paths.length} files`)
  : bad('every certificate path resolves', missing.join(', '));

// --- opening -------------------------------------------------------------
await openByMouse(0);
const opened = await page.evaluate(() => {
  const d = document.querySelector('dialog.lightbox');
  const img = d.querySelector('[data-lightbox-img]');
  return {
    open: d.open,
    src: img.getAttribute('src'),
    loaded: img.complete && img.naturalWidth > 0,
    caption: d.querySelector('[data-lightbox-cap]').textContent.trim(),
    alt: img.alt,
    locked: document.documentElement.dataset.modalOpen,
    overflow: document.documentElement.style.overflow,
  };
});
opened.open ? ok('clicking a name opens the viewer') : bad('clicking a name opens the viewer');
opened.src === paths[0]
  ? ok('it opens that card’s certificate', opened.src.split('/').pop())
  : bad('it opens that card’s certificate', `${opened.src} vs ${paths[0]}`);
await page.waitForFunction(
  () => {
    const i = document.querySelector('[data-lightbox-img]');
    return i.complete && i.naturalWidth > 0;
  },
  {timeout: 5000},
);
ok('the scan actually decodes');
opened.caption.length > 0 && opened.alt.includes(opened.caption)
  ? ok('caption and alt text carry the name', opened.caption.slice(0, 44))
  : bad('caption and alt text carry the name', JSON.stringify(opened));
opened.locked === 'true' && opened.overflow === 'hidden'
  ? ok('the page behind is locked')
  : bad('the page behind is locked', JSON.stringify(opened));

// --- the page does not move behind it ------------------------------------
const before = await page.evaluate(() => window.scrollY);
await page.mouse.wheel({deltaY: 600});
await new Promise((r) => setTimeout(r, 400));
const after = await page.evaluate(() => window.scrollY);
after === before
  ? ok('wheeling does not scroll the page behind', `held at ${after}px`)
  : bad('wheeling does not scroll the page behind', `${before} -> ${after}`);

// --- Esc -----------------------------------------------------------------
await page.keyboard.press('Escape');
// close is dispatched as a queued task, so wait for the cleanup, not just open.
await page.waitForFunction(
  () =>
    document.querySelector('dialog.lightbox')?.open === false &&
    document.documentElement.dataset.modalOpen === undefined,
  {timeout: 3000},
);
const afterEsc = await page.evaluate(() => ({
  flag: document.documentElement.dataset.modalOpen,
  overflow: document.documentElement.style.overflow,
}));
afterEsc.flag === undefined && afterEsc.overflow === ''
  ? ok('Esc closes and releases the scroll lock')
  : bad('Esc closes and releases the scroll lock', JSON.stringify(afterEsc));

// --- the close button ----------------------------------------------------
await openByMouse(0);
await page.click('[data-lightbox-close]');
await page.waitForFunction(() => document.querySelector('dialog.lightbox')?.open === false, {
  timeout: 3000,
});
ok('the close button closes it');

// --- the backdrop --------------------------------------------------------
await openByMouse(0);
await page.mouse.click(20, 450); // well outside the dialog box
await new Promise((r) => setTimeout(r, 300));
const backdropClosed = await page.evaluate(
  () => document.querySelector('dialog.lightbox')?.open === false,
);
backdropClosed ? ok('clicking the backdrop closes it') : bad('clicking the backdrop closes it');

// --- focus returns -------------------------------------------------------
const restored = await page.evaluate(() =>
  document.activeElement?.classList.contains('cert__open'),
);
restored ? ok('focus returns to the card that opened it') : bad('focus returns to the card');

// --- a different card opens a different scan -----------------------------
await openByMouse(4);
const fifth = await page.evaluate(() =>
  document.querySelector('[data-lightbox-img]').getAttribute('src'),
);
fifth === paths[4]
  ? ok('a different card opens a different scan', fifth.split('/').pop())
  : bad('a different card opens a different scan', `${fifth} vs ${paths[4]}`);

console.log('');
bad404.length ? bad('no 4xx responses', bad404.join(', ')) : ok('no 4xx responses');
errors.length ? bad('no console errors', errors.join(' | ')) : ok('no console errors');

console.log(`\n${pass}/${pass + fail} passed`);
await browser.close();
process.exit(fail ? 1 : 0);
