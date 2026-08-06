import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--hide-scrollbars', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({width: 1440, height: 900});
await page.goto('http://127.0.0.1:8123/editions/winter2026', {waitUntil: 'domcontentloaded'});
await new Promise((r) => setTimeout(r, 8000));

const out = await page.evaluate(() => {
  const bgCounts = {};
  const colorCounts = {};
  const fontSamples = {};
  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width * r.height > 40000) {
      const bg = cs.backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)') bgCounts[bg] = (bgCounts[bg] || 0) + 1;
    }
    if (el.children.length === 0 && el.textContent.trim()) {
      colorCounts[cs.color] = (colorCounts[cs.color] || 0) + 1;
      const key = `${cs.fontFamily.split(',')[0]} | ${cs.fontWeight} | ${cs.fontSize} | ${cs.lineHeight} | ${cs.letterSpacing}`;
      fontSamples[key] = (fontSamples[key] || 0) + 1;
    }
  }
  const top = (o, n) =>
    Object.entries(o)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  return {
    bg: top(bgCounts, 14),
    color: top(colorCounts, 14),
    fonts: top(fontSamples, 22),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
  };
});

console.log('BACKGROUNDS'); for (const [k, v] of out.bg) console.log(`  ${v.toString().padStart(4)}  ${k}`);
console.log('TEXT COLORS'); for (const [k, v] of out.color) console.log(`  ${v.toString().padStart(4)}  ${k}`);
console.log('TYPE (family | weight | size | line-height | tracking)');
for (const [k, v] of out.fonts) console.log(`  ${v.toString().padStart(4)}  ${k}`);

await browser.close();

