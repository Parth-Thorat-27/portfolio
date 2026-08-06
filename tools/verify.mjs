/**
 * Screenshots a page at several scroll depths and reports console/network
 * failures. Used to diff the local mirror against the live page.
 *
 *   node tools/verify.mjs <url> <label>
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.env.SHOT_DIR || path.resolve('shots');

const url = process.argv[2];
const label = process.argv[3] || 'page';
if (!url) throw new Error('usage: node tools/verify.mjs <url> <label>');

await fs.mkdir(OUT, {recursive: true});

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900, deviceScaleFactor: 1});

const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('requestfailed', (r) =>
  failedRequests.push(`${r.failure()?.errorText} ${r.url().slice(0, 120)}`),
);
page.on('response', (r) => {
  if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url().slice(0, 120)}`);
});

// Streaming video and analytics beacons mean the page never reaches network
// idle, so settle on a fixed budget after DOM ready instead.
await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 120_000});
await new Promise((r) => setTimeout(r, 8000));

const height = await page.evaluate(() => document.documentElement.scrollHeight);
console.log(`[${label}] document height: ${height}px`);

// The page runs Lenis smooth scroll, which swallows programmatic scrollTo.
// Real wheel events are the only reliable way to move it.
async function wheelTo(target) {
  await page.mouse.move(720, 450);
  for (let guard = 0; guard < 400; guard++) {
    const y = await page.evaluate(() => window.scrollY);
    if (Math.abs(y - target) < 400) break;
    await page.mouse.wheel({deltaY: y < target ? 2000 : -2000});
    await new Promise((r) => setTimeout(r, 40));
  }
  await new Promise((r) => setTimeout(r, 2500));
}

const stops = [0, 0.08, 0.18, 0.32, 0.5, 0.75, 0.95];
for (const [i, frac] of stops.entries()) {
  const target = Math.round((height - 900) * frac);
  await wheelTo(target);
  const actual = await page.evaluate(() => Math.round(window.scrollY));
  console.log(`[${label}] stop ${i}: wanted ${target}px, at ${actual}px`);
  await page.screenshot({path: path.join(OUT, `${label}-${i}.png`)});
}

console.log(`[${label}] console errors: ${consoleErrors.length}`);
for (const e of [...new Set(consoleErrors)].slice(0, 15)) console.log('   ! ' + e);
console.log(`[${label}] failed requests: ${failedRequests.length}`);
for (const e of [...new Set(failedRequests)].slice(0, 20)) console.log('   x ' + e);

await browser.close();
