/**
 * ProcessGrit static server — zero dependencies, Node >= 18.
 * Serves /public, redirects "/" to the app shell, exposes /healthz for Railway.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const ENTRY = '/ProcessGrit.dc.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.md']);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });

  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return send(res, 400, 'Bad request'); }

  if (urlPath === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store' });
  if (urlPath === '/' || urlPath === '/index.html') {
    res.writeHead(302, { Location: ENTRY });
    return res.end();
  }

  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return send(res, 404, 'Not found');

    const ext = path.extname(filePath).toLowerCase();
    const isVendor = urlPath.startsWith('/vendor/');
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      // App files change on each deploy; vendored libraries are pinned versions.
      'Cache-Control': isVendor ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Last-Modified': stat.mtime.toUTCString(),
    };

    if (!isVendor && req.headers['if-modified-since'] &&
        new Date(req.headers['if-modified-since']) >= new Date(stat.mtime.toUTCString())) {
      res.writeHead(304, headers);
      return res.end();
    }

    const gzip = COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gzip) { headers['Content-Encoding'] = 'gzip'; headers['Vary'] = 'Accept-Encoding'; }
    else headers['Content-Length'] = stat.size;

    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => res.destroy());
    (gzip ? stream.pipe(zlib.createGzip()) : stream).pipe(res);
  });
});

server.listen(PORT, HOST, () => console.log(`ProcessGrit running on http://localhost:${PORT}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
