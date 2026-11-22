// 02 滑梯外观：极端高度 h=0.05 / 0.5 的坡顶走查截图（确认平台/护栏/侧板随高度正确缩放、无穿模）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18214;
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
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
await page.setViewport({ width: 1420, height: 800 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1200);
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);
for (const h of [0.05, 0.5]) {
  await page.evaluate(hh => { const e = window.__LAB.current().exp; e.onParam('height', hh); e.onParam('surface', 0.3); }, h);
  await sleep(300);
  await page.evaluate(() => window.__LAB.current().exp.seek(0));
  await sleep(300);
  const info = await page.evaluate(() => { const im = window.__LAB.current().exp._impl; const g = im._geo || im._geometry(); const c = window.__LAB.current().scene.getObjectByName('A2-cart'); return { Tx: g.Tx, Ty: g.Ty, z: c.position.z }; });
  await page.evaluate(a => { const c = window.__LAB.camera(), ct = window.__LAB.controls(); c.position.set(a.Tx + 1.5, a.Ty + 1.0, a.z + 2.9); ct.target.set(a.Tx - 0.35, a.Ty * 0.6, a.z); ct.update(); }, info);
  await sleep(500);
  await page.screenshot({ path: path.join(ROOT, 'shots', `a2-slide-h${String(h).replace('.', '')}.png`) });
  console.log('h', h, 'ok');
}
console.log('errs', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
