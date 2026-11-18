// 诊断 A2 刚体接线：current().exp 是否有 block/cartG、_physReady、sel.mu
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18107;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox',
         '--autoplay-policy=no-user-gesture-required', '--js-flags=--max-old-space-size=4096', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const r = await page.evaluate(async () => {
  const L = window.__LAB;
  await L.switch('A2-newton-first');
  await new Promise(r2 => setTimeout(r2, 1800));
  const e = L.current().exp;
  return {
    scene: L.store.experimentId,
    keys: e ? Object.keys(e).filter(k => /phys|cart|block|sel|mu|t\b/.test(k)).slice(0, 15) : null,
    hasBlock: !!(e && e.block), hasCartG: !!(e && e.cartG),
    physReady: !!(e && e._physReady), sel: e && e.sel ? e.sel.mu : null,
    dur: e ? e.duration : null,
    implBlock: (() => { const i = e && e._impl; return !!(i && (i.block || i.cartG)); })(),
  };
});
console.log(JSON.stringify(r));
await browser.close(); server.close();
