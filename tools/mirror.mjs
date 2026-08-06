/**
 * Mirrors https://www.shopify.com/editions/winter2026 into
 * reference/editions/index.html, with its stylesheets and fonts under assets/.
 * The mirror is the design reference the portfolio at ./index.html is built
 * from; it is not the site itself.
 *
 * Usage:
 *   node tools/mirror.mjs probe            # report how many/how big the remote assets are
 *   node tools/mirror.mjs build            # stylesheets + fonts local, media off the CDN
 *   node tools/mirror.mjs build --media    # also mirror all 1200+ images/videos (~1.4 GB)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://www.shopify.com/editions/winter2026';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CACHE = path.join(ROOT, 'tools', '.cache');
const CONCURRENCY = 16;

// ---------------------------------------------------------------- helpers

async function ensureDir(p) {
  await fs.mkdir(p, {recursive: true});
}

async function fetchBuf(url, {retries = 3} = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {headers: {'user-agent': UA}, redirect: 'follow'});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return {
        buf: Buffer.from(await res.arrayBuffer()),
        type: res.headers.get('content-type') || '',
      };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw new Error(`${url} -> ${lastErr.message}`);
}

async function pool(items, worker) {
  const queue = [...items];
  const out = [];
  const runners = Array.from({length: Math.min(CONCURRENCY, queue.length)}, async () => {
    while (queue.length) {
      const item = queue.shift();
      out.push(await worker(item));
    }
  });
  await Promise.all(runners);
  return out;
}

/** Stable, readable local filename for a remote asset. */
function localName(url, fallbackExt) {
  const u = new URL(url);
  let base = decodeURIComponent(path.posix.basename(u.pathname)) || 'asset';
  base = base.replace(/[^a-zA-Z0-9._-]/g, '_');
  let ext = path.extname(base);
  if (!ext && fallbackExt) {
    ext = fallbackExt;
    base += ext;
  }
  // Different query strings (?v=) can point at different bytes -> keep them apart.
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
  const stem = base.slice(0, base.length - ext.length).slice(0, 60);
  return `${stem}-${hash}${ext}`;
}

const EXT_BY_TYPE = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'font/woff2': '.woff2',
  'application/json': '.json',
  'application/octet-stream': '.bin',
};

// ---------------------------------------------------------------- source page

async function getSourceHtml() {
  await ensureDir(CACHE);
  const cached = path.join(CACHE, 'winter2026.html');
  try {
    const buf = await fs.readFile(cached);
    if (buf.length > 100_000) return buf.toString('utf8');
  } catch {}
  const {buf} = await fetchBuf(SRC);
  await fs.writeFile(cached, buf);
  return buf.toString('utf8');
}

// ---------------------------------------------------------------- URL scraping

// Every absolute Shopify CDN asset reference in the document, whether it sits in
// an attribute, a srcset, or inside the escaped JSON of the Remix hydration
// payload. Trailing JSON/HTML delimiters are excluded by the character class.
const CDN_URL_RE =
  /https:\/\/cdn\.shopify\.com\/(?:s\/files|videos|b\/[a-z0-9-]+)\/[^\s"'\\)<>]+/g;

function collectAssetUrls(html) {
  const urls = new Set();
  for (const m of html.matchAll(CDN_URL_RE)) {
    // Strip characters that regularly ride along at the end of a match.
    const url = m[0].replace(/[.,;:]+$/, '');
    urls.add(url);
  }
  return [...urls];
}

function bucketFor(url) {
  const p = new URL(url).pathname.toLowerCase();
  if (p.includes('/videos/') || /\.(mp4|webm|mov)$/.test(p)) return 'video';
  if (/\.(woff2?|ttf|otf|eot)$/.test(p)) return 'fonts';
  if (/\.(riv|json|lottie)$/.test(p)) return 'data';
  return 'img';
}

// ---------------------------------------------------------------- commands

async function probe() {
  const html = await getSourceHtml();
  const urls = collectAssetUrls(html);
  const byBucket = {};
  for (const u of urls) (byBucket[bucketFor(u)] ??= []).push(u);

  console.log(`total unique CDN assets: ${urls.length}`);
  for (const [b, list] of Object.entries(byBucket)) {
    console.log(`  ${b}: ${list.length}`);
  }

  let bytes = 0;
  let unknown = 0;
  await pool(urls, async (url) => {
    try {
      const res = await fetch(url, {method: 'HEAD', headers: {'user-agent': UA}});
      const len = Number(res.headers.get('content-length'));
      if (Number.isFinite(len) && len > 0) bytes += len;
      else unknown++;
    } catch {
      unknown++;
    }
  });
  console.log(`measured size: ${(bytes / 1024 / 1024).toFixed(1)} MB (${unknown} unknown)`);
}

async function build({withMedia = false} = {}) {
  const html = await getSourceHtml();

  const outDirs = {
    css: path.join(ROOT, 'assets', 'css'),
    fonts: path.join(ROOT, 'assets', 'fonts'),
    img: path.join(ROOT, 'assets', 'img'),
    video: path.join(ROOT, 'assets', 'video'),
    data: path.join(ROOT, 'assets', 'data'),
    js: path.join(ROOT, 'assets', 'js'),
  };
  for (const d of Object.values(outDirs)) await ensureDir(d);

  /** remote url -> site-relative path, applied to the whole document at the end. */
  const rewrites = new Map();

  // --- 1. stylesheets (and the font files they reference) -------------------
  const cssUrls = [
    ...new Set(
      [...html.matchAll(/https:\/\/cdn\.shopify\.com\/[^\s"']+\.css/g)].map((m) => m[0]),
    ),
  ];

  for (const cssUrl of cssUrls) {
    const {buf} = await fetchBuf(cssUrl);
    let css = buf.toString('utf8');

    const fontUrls = [
      ...new Set(
        [...css.matchAll(/url\(\s*['"]?(https?:\/\/[^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
      ),
    ];
    await pool(fontUrls, async (fu) => {
      try {
        const {buf: fb, type} = await fetchBuf(fu);
        const name = localName(fu, EXT_BY_TYPE[type.split(';')[0].trim()]);
        const bucket = bucketFor(fu) === 'fonts' ? 'fonts' : 'img';
        await fs.writeFile(path.join(outDirs[bucket], name), fb);
        css = css.split(fu).join(`../${bucket}/${name}`);
      } catch (err) {
        console.warn(`  ! font ${err.message}`);
      }
    });

    const cssName = localName(cssUrl, '.css');
    await fs.writeFile(path.join(outDirs.css, cssName), css, 'utf8');
    rewrites.set(cssUrl, `/assets/css/${cssName}`);
    console.log(`css  ${cssName} (${fontUrls.length} font files)`);
  }

  // --- 2. preloaded fonts declared directly in <head> -----------------------
  const headFonts = [
    ...new Set(
      [...html.matchAll(/https:\/\/cdn\.shopify\.com\/[^\s"']+\.woff2?/g)].map((m) => m[0]),
    ),
  ].filter((u) => !rewrites.has(u));
  await pool(headFonts, async (fu) => {
    try {
      const {buf, type} = await fetchBuf(fu);
      const name = localName(fu, EXT_BY_TYPE[type.split(';')[0].trim()] || '.woff2');
      await fs.writeFile(path.join(outDirs.fonts, name), buf);
      rewrites.set(fu, `/assets/fonts/${name}`);
    } catch (err) {
      console.warn(`  ! head font ${err.message}`);
    }
  });
  console.log(`font ${headFonts.length} preloaded face(s)`);

  // --- 3. images, videos, rive files ---------------------------------------
  // ~1.4 GB in full, so it is opt-in. Without --media these stay on Shopify's
  // CDN, which serves them with `access-control-allow-origin: *`.
  if (withMedia) {
    const media = collectAssetUrls(html).filter((u) => !rewrites.has(u));
    let done = 0;
    let failed = 0;
    await pool(media, async (url) => {
      const bucket = bucketFor(url);
      try {
        const {buf, type} = await fetchBuf(url);
        const name = localName(url, EXT_BY_TYPE[type.split(';')[0].trim()]);
        await fs.writeFile(path.join(outDirs[bucket], name), buf);
        rewrites.set(url, `/assets/${bucket}/${name}`);
        done++;
        if (done % 50 === 0) console.log(`     ...${done}/${media.length}`);
      } catch (err) {
        failed++;
        console.warn(`  ! ${err.message}`);
      }
    });
    console.log(`media ${done} downloaded, ${failed} failed`);
  } else {
    console.log('media left on cdn.shopify.com (pass --media to mirror it locally)');
  }

  // --- 4. rewrite the document ---------------------------------------------
  // Longest URLs first so a URL that is a prefix of another can't clobber it.
  let out = html;
  for (const [remote, local] of [...rewrites].sort((a, b) => b[0].length - a[0].length)) {
    out = out.split(remote).join(local);
  }

  // The nonce belongs to Shopify's CSP response header, which we do not serve.
  out = out.replace(/ nonce="[a-f0-9]+"/g, '');

  // Local behaviour patch, loaded after Shopify's own hydration bundle.
  out = out.replace('</body>', '<script src="/assets/js/site.js" defer></script></body>');

  const dest = path.join(ROOT, 'reference', 'editions', 'index.html');
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, out, 'utf8');
  console.log(
    `\nreference/editions/index.html written (${(Buffer.byteLength(out) / 1024).toFixed(0)} KB)`,
  );
}

const cmd = process.argv[2] || 'build';
if (cmd === 'probe') await probe();
else if (cmd === 'build') await build({withMedia: process.argv.includes('--media')});
else {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

