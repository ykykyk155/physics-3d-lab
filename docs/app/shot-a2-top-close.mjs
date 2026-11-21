// A2 坡顶近景：拉近相机重拍 t=0（顶部车身姿态确认）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18163;
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
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
await page.setViewport({ width: 1420, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  const st = await page.evaluate(() => {
    const e = window.__LAB.current().exp;
    return !!(e && e._impl && e._impl._physReady);
  });
  if (st) break;
  await sleep(100);
}
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);

// 坡顶近景侧视
await page.evaluate(() => {
  const ctl = window.__LAB.controls();
  ctl.target.set(-3.0, 0.32, 0);
  ctl.update();
  const cam = window.__LAB.camera();
  cam.position.set(-5.0, 1.15, 2.6);
  cam.lookAt(-3.0, 0.32, 0);
  ctl.update();
});
await page.evaluate(tt => {
  const exp = window.__LAB.current().exp;
  if (exp.seek) exp.seek(tt); else window.__LAB.current().seek(tt);
}, 0.0);
await sleep(350);
const tilt = await page.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  return e.tiltG ? e.tiltG.rotation.z : null;
});
const x = await page.evaluate(() => {
  const s = window.__LAB.current().scene;
  const c = s.getObjectByName('A2-cart');
  return c ? c.position.x : NaN;
});
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-tilt-top-close.png') });
console.log(`t=0 top-close: x=${x} tilt=${tilt}`);
console.log('ERRORS:', errors.length);
await browser.close();