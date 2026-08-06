/**
 * Structural diff between the local mirror and the live page.
 *
 * Pixel diffing a scroll-scrubbed page is unreliable — frames depend on scroll
 * velocity and on which lazy video happened to decode first. So compare the
 * things that must match instead: document height, the absolute offset of every
 * section landmark, the visible text, and the set of rendered image slots.
 *
 *   node tools/compare.mjs <localUrl> <liveUrl>
 */

import puppeteer from 'puppeteer-core';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [localUrl, liveUrl] = process.argv.slice(2);
if (!localUrl || !liveUrl) throw new Error('usage: node tools/compare.mjs <local> <live>');

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--disable-gpu', '--no-sandbox'],
});

async function snapshot(url) {
  const page = await browser.newPage();
  await page.setViewport({width: 1440, height: 900});
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 120_000});
  await new Promise((r) => setTimeout(r, 9000));

  const data = await page.evaluate(() => {
    const abs = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY);
    const sections = [...document.querySelectorAll('[id]')]
      .filter((el) => el.offsetHeight > 200)
      .map((el) => ({id: el.id, top: abs(el), height: el.offsetHeight}));

    const media = [...document.querySelectorAll('img, video, canvas')].map((el) =>
      [el.tagName, Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)].join(':'),
    );

    return {
      height: document.documentElement.scrollHeight,
      title: document.title,
      sections,
      mediaCount: media.length,
      mediaSig: media.join('|'),
      headings: [...document.querySelectorAll('h1, h2, h3')]
        .map((h) => h.textContent.trim().replace(/\s+/g, ' '))
        .filter(Boolean),
      textLength: document.body.innerText.replace(/\s+/g, ' ').length,
    };
  });

  await page.close();
  return data;
}

const [a, b] = [await snapshot(localUrl), await snapshot(liveUrl)];
await browser.close();

const line = (name, x, y) =>
  console.log(`${x === y ? 'OK  ' : 'DIFF'}  ${name.padEnd(16)} local=${x}  live=${y}`);

line('title', a.title, b.title);
line('scrollHeight', a.height, b.height);
line('media elements', a.mediaCount, b.mediaCount);
line('media geometry', a.mediaSig === b.mediaSig, true);
line('headings', a.headings.length, b.headings.length);
line('text length', a.textLength, b.textLength);
line('sections', a.sections.length, b.sections.length);

const byId = new Map(b.sections.map((s) => [s.id, s]));
let moved = 0;
for (const s of a.sections) {
  const t = byId.get(s.id);
  if (!t) {
    console.log(`DIFF  section only in local: ${s.id}`);
    moved++;
  } else if (t.top !== s.top || t.height !== s.height) {
    console.log(
      `DIFF  #${s.id} top ${s.top} vs ${t.top}, height ${s.height} vs ${t.height}`,
    );
    moved++;
  }
}
console.log(moved === 0 ? 'OK    all section offsets identical' : `DIFF  ${moved} section(s) differ`);

if (a.headings.length === b.headings.length) {
  const mismatched = a.headings.filter((h, i) => h !== b.headings[i]);
  console.log(
    mismatched.length === 0
      ? 'OK    all heading text identical'
      : `DIFF  ${mismatched.length} heading(s) differ: ${mismatched.slice(0, 5).join(' | ')}`,
  );
}
