// 로컬 미리보기: node scripts/serve.mjs [포트] → http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const DIST = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../dist');
const port = Number(process.argv[2] ?? 4321);
const types = { '.html': 'text/html; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(400).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(307, { location: p + '/' }).end(); return; }
    f = path.join(f, 'index.html');
  }
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': types['.html'] }).end(fs.readFileSync(path.join(DIST, '404.html'))); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }).end(fs.readFileSync(f));
}).listen(port, () => console.log(`http://localhost:${port}`));
