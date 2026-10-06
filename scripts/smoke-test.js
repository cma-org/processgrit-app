/* Starts the server on a spare port and checks every file the app needs is served. */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 4789;
const pub = path.join(__dirname, '..', 'public');
const paths = ['/healthz', '/ProcessGrit.dc.html', '/support.js', '/resources.js', '/pg-engine-v2.js',
  '/vendor/react.production.min.js', '/vendor/react-dom.production.min.js',
  ...fs.readdirSync(pub).filter(f => f.startsWith('PGv2')).map(f => '/' + f)];

const get = p => new Promise(r => http.get({ host: '127.0.0.1', port: PORT, path: p }, res => { res.resume(); r(res.statusCode); }).on('error', () => r(0)));

const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT } });
setTimeout(async () => {
  let fail = 0;
  for (const p of paths) { const s = await get(p); if (s !== 200) fail++; console.log(`${s === 200 ? 'ok  ' : 'FAIL'} ${s} ${p}`); }
  const root = await get('/'); console.log(`${root === 302 ? 'ok  ' : 'FAIL'} ${root} / (redirect)`); if (root !== 302) fail++;
  srv.kill(); console.log(fail ? `\n${fail} check(s) failed` : '\nAll checks passed'); process.exit(fail ? 1 : 0);
}, 600);
