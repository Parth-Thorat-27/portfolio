/**
 * Screenshots the portfolio at every section, desktop and mobile, and reports
 * console errors, failed requests and any horizontal overflow.
 *
 *   node tools/shots.mjs [url]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = process.env.SHOT_DIR || path.resolve('shots');

await fs.mkdir(OUT, {recursive: true});

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--disable-gpu', '--no-sandbox'],
});

const problems = [];

async function run(label, width, height) {
  const page = await browser.newPage();
  await page.setViewport({width, height, deviceScaleFactor: 1});
  page.on('console', (m) => m.type() === 'error' && problems.push(`${label} console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`${label} pageerror: ${e}`));
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`${label} ${r.status()} ${r.url()}`);
  });

  await page.goto(URL, {waitUntil: 'networkidle0', timeout: 60_000});
  await new Promise((r) => setTimeout(r, 1400));
  await page.screenshot({path: path.join(OUT, `${label}-hero.png`)});

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  if (overflow > 0) problems.push(`${label} horizontal overflow: ${overflow}px`);

  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('main section[id], main footer[id]')]
      .map((el) => el.id)
      .filter((id) => id !== 'top'),
  );

  for (const id of ids) {
    await page.evaluate((target) => {
      const el = document.getElementById(target);
      window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY, behavior: 'auto'});
    }, id);
    // Long enough for the masked title to finish sliding up.
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({path: path.join(OUT, `${label}-${id}.png`)});

    // Openers pin for over a viewport, so aim at the content block by name
    // rather than guessing an offset.
    const found = await page.evaluate((target) => {
      const body = document.querySelector(`#${target} .wrap`);
      if (!body) return false;
      window.scrollTo({top: body.getBoundingClientRect().top + window.scrollY - 40});
      return true;
    }, id);
    if (!found) continue;
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({path: path.join(OUT, `${label}-${id}-body.png`)});
  }

  const height2 = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(`[${label}] ${width}x${height} — document ${height2}px, ${ids.length} sections`);
  await page.close();
}

await run('d', 1440, 900);
await run('m', 390, 844);

console.log(problems.length ? `\nPROBLEMS (${problems.length}):` : '\nno problems');
for (const p of [...new Set(problems)]) console.log('  ! ' + p);

await browser.close();
