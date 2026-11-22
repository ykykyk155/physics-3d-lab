// 02 滑梯外观定点截图：坡顶平台+护栏+台阶 / 中段侧板+包边 / 坡脚圆弧出口；并做切材质切高度重建残留检查。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18212;
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
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.setViewport({ width: 1420, height: 800 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1200);
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);

const setH = (h, mu) => page.evaluate(({ h, mu }) => { const e = window.__LAB.current().exp; e.onParam('height', h); e.onParam('surface', mu); }, { h, mu });
const seek = t => page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const cam = (px, py, pz, tx, ty, tz) => page.evaluate(a => {
  const c = window.__LAB.camera(), ct = window.__LAB.controls();
  c.position.set(a.px, a.py, a.pz); ct.target.set(a.tx, a.ty, a.tz); ct.update();
}, { px, py, pz, tx, ty, tz });

await setH(0.35, 0.3); await sleep(300); await seek(0); await sleep(300);
const info = await page.evaluate(() => {
  const im = window.__LAB.current().exp._impl;
  const g = im._geo || im._geometry();
  const c = window.__LAB.current().scene.getObjectByName('A2-cart');
  return { Tx: g.Tx, Ty: g.Ty, XF0: g.XF0, z: c ? c.position.z : 0.6 };
});
console.log('geo', info);

// A) 坡顶平台 + 护栏 + 台阶（从左后上俯视）
await cam(info.Tx + 1.4, 1.35, info.z + 3.0, info.Tx - 0.35, 0.28, info.z);
await sleep(500);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-slide-platform.png') });

// B) 中段侧板 + 包边管
await cam(-0.2, 0.95, info.z + 3.1, -1.6, 0.15, info.z);
await sleep(500);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-slide-mid.png') });

// C) 坡脚圆弧出口
await cam(info.XF0 + 1.3, 0.85, info.z + 2.6, info.XF0 - 0.1, 0.06, info.z);
await sleep(500);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-slide-arc.png') });

// 重建残留检查：切材质 3 轮 × 切高度 4 档，统计 renderer 内存几何/纹理数
const mem = () => page.evaluate(() => { const r = window.__LAB.renderer(); return { g: r.info.memory.geometries, t: r.info.memory.textures }; });
const base = await mem();
for (let r = 0; r < 3; r++) { for (const mu of [0.6, 0.3, 0.12, 0.02, 0]) { await setH(0.35, mu); await sleep(60); } }
for (const h of [0.05, 0.2, 0.35, 0.5]) { await setH(h, 0.3); await sleep(120); }
await setH(0.35, 0.3); await sleep(300);
const after = await mem();
console.log('mem base', base, 'after', after, 'Δg', after.g - base.g, 'Δt', after.t - base.t);

console.log('errs', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
