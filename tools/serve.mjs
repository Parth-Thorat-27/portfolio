/**
 * Static server for the portfolio, plus the Shopify Editions reference mirror.
 *
 *   /                        -> index.html, the portfolio
 *   /editions/winter2026     -> reference/editions/index.html, the mirror
 *
 * The mirror needs that exact path. Shopify's client bundle is a Remix app: on
 * hydration its router matches `location.pathname` against the route table, and
 * anything else matches nothing, so React discards the server-rendered markup
 * and the page goes blank.
 *
 *   node tools/serve.mjs [port]
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8123);
const ROUTE = '/editions/winter2026';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.riv': 'application/octet-stream',
};

async function sendFile(res, filePath, status = 200) {
  const body = await fs.readFile(filePath);
  res.writeHead(status, {
    'content-type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-cache',
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  if (pathname === '/' || pathname === '/index.html') {
    return sendFile(res, path.join(ROOT, 'index.html'));
  }

  if (pathname === ROUTE || pathname === ROUTE + '/') {
    return sendFile(res, path.join(ROOT, 'reference', 'editions', 'index.html'));
  }

  // Everything else is a real file under the repo root; reject traversal.
  const target = path.join(ROOT, pathname);
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  try {
    await sendFile(res, target);
  } catch {
    res.writeHead(404, {'content-type': 'text/plain'}).end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT}`);
  console.log(`  portfolio  http://127.0.0.1:${PORT}/`);
  console.log(`  reference  http://127.0.0.1:${PORT}${ROUTE}`);
});
