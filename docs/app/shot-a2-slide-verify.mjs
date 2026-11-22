// 02 滑梯外观复核截图（CEO 用）：侧视全貌 / 坡顶俯视 / 坡脚衔接特写
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18213;
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
await page.setViewport({ width: 1600, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1200);
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
const setH = (h, mu) => page.evaluate(({ h, mu }) => { const e = window.__LAB.current().exp; e.onParam('height', h); e.onParam('surface', mu); }, { h, mu });
const seek = t => page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const cam = (px, py, pz, tx, ty, tz) => page.evaluate(a => {
  const c = window.__LAB.camera(), ct = window.__LAB.controls();
  c.position.set(a.px, a.py, a.pz); ct.target.set(a.tx, a.ty, a.tz); ct.update();
}, { px, py, pz, tx, ty, tz });

await setH(0.35, 0.3); await sleep(300); await seek(0); await sleep(400);
const info = await page.evaluate(() => {
  const im = window.__LAB.current().exp._impl;
  const g = im._geo || im._geometry();
  const c = window.__LAB.current().scene.getObjectByName('A2-cart');
  return { Tx: g.Tx, Ty: g.Ty, XF0: g.XF0, z: c ? c.position.z : 0.6 };
});
console.log('geo', info);

// A) 侧视全貌（沿 -z 看，检查坡度、侧板高度、坡脚衔接）
await cam((info.Tx + info.XF0) / 2, 0.45, info.z + 4.6, (info.Tx + info.XF0) / 2, 0.22, info.z);
await sleep(600);
await page.screenshot({ path: path.join(ROOT, 'shots', 'verify-slide-side.png') });

// B) 坡顶俯视（检查滑道内宽 vs 车宽、平台、护栏）
await cam(info.Tx - 0.55, 2.6, info.z + 0.02, info.Tx - 0.55, 0, info.z);
await sleep(600);
await page.screenshot({ path: path.join(ROOT, 'shots', 'verify-slide-top.png') });

// C) 坡脚衔接特写（侧前方近看圆弧出口与水平轨道）
await cam(info.XF0 + 0.75, 0.32, info.z + 1.6, info.XF0 - 0.15, 0.10, info.z);
await sleep(600);
await page.screenshot({ path: path.join(ROOT, 'shots', 'verify-slide-join.png') });

await browser.close();
server.close();
console.log('done');
