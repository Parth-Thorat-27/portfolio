/**
 * Rebuilds assets/photos/photos.js from whatever is in assets/photos/.
 *
 *   node tools/photos.mjs
 *
 * For every image it records the pixel size (so the contact sheet can lay
 * itself out before anything has loaded), the camera settings from EXIF where
 * a JPEG carries them, and a title taken from the file name. A subfolder is a
 * series: assets/photos/cricket/final-over.jpg lands under "Cricket".
 *
 * Anything already in the manifest that was typed by hand — title, place, alt,
 * series — is kept, and so is the order. New files are appended; entries whose
 * file has gone are dropped. No dependencies: the headers are read directly.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'assets', 'photos');
const MANIFEST = path.join(DIR, 'photos.js');
const TYPES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const HEAVY = 1.5 * 1024 * 1024;

// ------------------------------------------------------------------ sizes

function pngSize(buf) {
  if (buf.length < 24 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {w: buf.readUInt32BE(16), h: buf.readUInt32BE(20)};
}

function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') return {w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3)};
  if (kind === 'VP8 ') return {w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff};
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return {w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1};
  }
  return null;
}

/** AVIF keeps its size in an `ispe` box; find the box rather than walk the tree. */
function avifSize(buf) {
  const at = buf.indexOf('ispe', 0, 'ascii');
  if (at < 0 || at + 16 > buf.length) return null;
  return {w: buf.readUInt32BE(at + 8), h: buf.readUInt32BE(at + 12)};
}

/** Walks the JPEG segments once, collecting the frame size and the EXIF block. */
function jpegInfo(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let size = null;
  let exif = null;
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // image data from here on
    const length = buf.readUInt16BE(i + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isFrame && !size) size = {w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5)};
    if (marker === 0xe1 && !exif && buf.toString('ascii', i + 4, i + 8) === 'Exif') {
      exif = buf.subarray(i + 10, i + 2 + length);
    }
    i += 2 + length;
  }
  return size ? {...size, exif} : null;
}

// ------------------------------------------------------------------- exif

/** Just the handful of tags a caption wants. Anything odd returns {}. */
function readExif(tiff) {
  try {
    const little = tiff.toString('ascii', 0, 2) === 'II';
    const u16 = (o) => (little ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
    const u32 = (o) => (little ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
    const BYTES = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8};

    function ifd(offset) {
      const tags = new Map();
      const count = u16(offset);
      for (let n = 0; n < count; n++) {
        const at = offset + 2 + n * 12;
        const type = u16(at + 2);
        const len = u32(at + 4);
        const where = (BYTES[type] || 1) * len > 4 ? u32(at + 8) : at + 8;
        let value = null;
        if (type === 2) value = tiff.toString('ascii', where, where + len).replace(/\0.*$/, '').trim();
        else if (type === 3) value = u16(where);
        else if (type === 4) value = u32(where);
        else if (type === 5) value = u32(where + 4) ? u32(where) / u32(where + 4) : 0;
        tags.set(u16(at), value);
      }
      return tags;
    }

    const base = ifd(u32(4));
    const sub = base.has(0x8769) ? ifd(base.get(0x8769)) : new Map();
    return {
      orientation: base.get(0x0112),
      model: base.get(0x0110),
      exposure: sub.get(0x829a),
      aperture: sub.get(0x829d),
      iso: sub.get(0x8827),
      focal: sub.get(0x920a),
    };
  } catch {
    return {};
  }
}

function caption(exif) {
  const parts = [];
  if (exif.model) parts.push(String(exif.model));
  if (exif.focal) parts.push(`${Math.round(exif.focal)}mm`);
  if (exif.aperture) parts.push(`f/${Number(exif.aperture.toFixed(1))}`);
  if (exif.exposure) {
    parts.push(exif.exposure >= 1 ? `${Number(exif.exposure.toFixed(1))}s` : `1/${Math.round(1 / exif.exposure)}`);
  }
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.join(' · ');
}

// ------------------------------------------------------------------ files

async function inspect(file) {
  const buf = await fs.readFile(file);
  const info = measure(buf, file);
  return info ? {...info, hash: crypto.createHash('sha1').update(buf).digest('hex')} : null;
}

function measure(buf, file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return pngSize(buf);
  if (ext === '.webp') return webpSize(buf);
  if (ext === '.avif') return avifSize(buf);

  const info = jpegInfo(buf);
  if (!info) return null;
  const exif = info.exif ? readExif(info.exif) : {};
  // Orientations 5 to 8 are stored on their side; the browser turns them.
  const turned = exif.orientation >= 5 && exif.orientation <= 8;
  return {w: turned ? info.h : info.w, h: turned ? info.w : info.h, exif: caption(exif)};
}

const words = (s) => s.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
const sentence = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * IMG_4821, DSC01234, "WhatsApp Image 2025-12-21 at 1.10.30 PM", "Untitled
 * design (6)": what a camera or an app called a file is not a title. Those get
 * a blank one, to be typed into the manifest by hand.
 */
const machineName = (s) =>
  /^(img|dsc|dscf|dscn|pxl|mvimg|mg|whatsapp|screenshot|untitled|image|photo|picture|gemini|snapchat|signal|telegram)\b/i.test(s) ||
  /\d{4,}/.test(s) ||
  // a single token mixing letters and digits, like Zk1kQ2E, is an upload id
  /\b(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]{5,}\b/i.test(s) ||
  /^[\d\s().]+$/.test(s);

async function walk(dir, series = '') {
  const found = [];
  for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, series || sentence(words(entry.name)))));
    else if (TYPES.has(path.extname(entry.name).toLowerCase())) found.push({full, series});
  }
  return found.sort((a, b) => a.full.localeCompare(b.full, 'en', {numeric: true}));
}

async function existing() {
  try {
    const sandbox = {window: {}};
    vm.runInNewContext(await fs.readFile(MANIFEST, 'utf8'), sandbox);
    return Array.isArray(sandbox.window.PHOTOS) ? sandbox.window.PHOTOS : [];
  } catch {
    return [];
  }
}

const HEADER = `/**
 * The contact sheet on hobbies.html is built from this list.
 *
 * To add photographs:
 *   1. Drop the files into assets/photos/ (jpg, png, webp or avif).
 *      A subfolder becomes a series: assets/photos/cricket/final-over.jpg
 *      lands under "Cricket", and series show up as filter buttons.
 *   2. Run:  node tools/photos.mjs
 *
 * That rewrites this file — sizes, camera settings from EXIF, and a title taken
 * from the file name. Anything typed in by hand afterwards (title, place, alt)
 * is kept the next time it runs. Order here is the order on the page.
 *
 *   { src, w, h, title, place, series, alt, exif }
 */
`;

const files = await walk(DIR);
const before = await existing();
const known = new Map(before.map((p) => [p.src, p]));
const fresh = new Map();
const heavy = [];
const unread = [];
const twins = [];
const hashes = new Map();

for (const {full, series} of files) {
  const src = path.relative(ROOT, full).split(path.sep).join('/');
  const info = await inspect(full);
  if (!info || !info.w || !info.h) {
    unread.push(src);
    continue;
  }
  // "photo.jpg" and "photo (1).jpg": the same bytes twice is one photograph.
  if (hashes.has(info.hash)) {
    twins.push(`${src}  (same file as ${hashes.get(info.hash)})`);
    continue;
  }
  hashes.set(info.hash, src);
  if ((await fs.stat(full)).size > HEAVY) heavy.push(src);

  const old = known.get(src) || {};
  const name = words(path.basename(full, path.extname(full)));
  const entry = {
    src,
    w: info.w,
    h: info.h,
    title: old.title ?? (machineName(name) ? '' : sentence(name)),
    place: old.place ?? '',
    series: old.series ?? series,
    alt: old.alt ?? '',
    exif: info.exif || old.exif || '',
  };
  fresh.set(src, entry);
}

// Keep the order already on the page, then add whatever is new.
const ordered = [
  ...before.filter((p) => fresh.has(p.src)).map((p) => fresh.get(p.src)),
  ...[...fresh.values()].filter((p) => !known.has(p.src)),
];

const body = ordered.length
  ? `window.PHOTOS = [\n${ordered.map((p) => `  ${JSON.stringify(p)},`).join('\n')}\n];\n`
  : 'window.PHOTOS = [];\n';
await fs.writeFile(MANIFEST, HEADER + body);

const added = ordered.filter((p) => !known.has(p.src)).length;
const dropped = before.filter((p) => !fresh.has(p.src)).length;
console.log(`${ordered.length} photographs in the manifest (${added} new, ${dropped} removed).`);
if (twins.length) console.log(`\nSkipped as duplicates:\n  ${twins.join('\n  ')}`);
if (unread.length) console.log(`\nCould not read a size from:\n  ${unread.join('\n  ')}`);
if (heavy.length) {
  console.log(
    `\nOver 1.5 MB — every visitor downloads these in full. Exporting at about 2400px on the long edge is plenty:\n  ${heavy.join('\n  ')}`,
  );
}
