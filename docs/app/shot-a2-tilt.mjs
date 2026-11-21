// A2 车身贴坡姿态截图：坡顶/中段/水平段三张 + 一张近景放大
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18162;
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

// 暂停播放（避免帧动画跟 seek 抢）
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);

// 固定视角：拉近看坡
await page.evaluate(() => {
  const ctl = window.__LAB.controls();
  ctl.target.set(-1.8, 0.25, 0);
  ctl.update();
  const cam = window.__LAB.camera();
  cam.position.set(-3.6, 1.6, 5.2);
  cam.lookAt(-1.8, 0.25, 0);
  ctl.update();
});

const shot = async (t, file) => {
  await page.evaluate(tt => {
    const exp = window.__LAB.current().exp;
    if (exp.seek) exp.seek(tt); else window.__LAB.current().seek(tt);
  }, t);
  await sleep(320);
  await page.screenshot({ path: file });
  // 记录倾角
  const tilt = await page.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    return e.tiltG ? e.tiltG.rotation.z : null;
  });
  console.log(`t=${t} tilt=${tilt} → ${path.basename(file)}`);
};

const OUT = path.join(ROOT, 'shots');
await shot(0.0, path.join(OUT, 'a2-tilt-top.png'));      // 坡顶
await shot(0.55, path.join(OUT, 'a2-tilt-mid.png'));     // 直线中段
await shot(2.5, path.join(OUT, 'a2-tilt-flat.png'));     // 水平段
// 近景侧视：看车身贴坡
await page.evaluate(() => {
  const ctl = window.__LAB.controls();
  ctl.target.set(-2.6, 0.3, 0);
  ctl.update();
  const cam = window.__LAB.camera();
  cam.position.set(-4.6, 1.0, 2.8);
  cam.lookAt(-2.6, 0.3, 0);
  ctl.update();
});
await shot(0.4, path.join(OUT, 'a2-tilt-close.png'));

console.log('ERRORS:', errors.length, errors.slice(0, 3));
await browser.close();