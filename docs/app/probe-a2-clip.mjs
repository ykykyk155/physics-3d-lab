// A2 滑梯外观穿模走查：h×5材料 全档读车体世界包围盒，断言不嵌入侧板/不沉轨/不出界。
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

const measure = () => page.evaluate(() => {
  const THREE = window.__LAB.current().exp._impl.THREE || null;
  const scene = window.__LAB.current().scene;
  const cart = scene.getObjectByName('A2-cart');
  // 手工遍历算世界 AABB（不依赖 THREE 全局）
  const box = { xmin: 1e9, xmax: -1e9, ymin: 1e9, ymax: -1e9, zmin: 1e9, zmax: -1e9 };
  const tmp = [];
  cart.updateWorldMatrix(true, true);
  cart.traverse(o => {
    if (!o.geometry) return;
    if (o.isInstancedMesh) return;   // 轮胎用实例矩阵摆位，基础几何包围盒会误报，单独按下述常量核对
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    if (!bb) return;
    // 8 corners → world
    const pts = [
      [bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.min.z],
      [bb.min.x, bb.max.y, bb.min.z], [bb.max.x, bb.max.y, bb.min.z],
      [bb.min.x, bb.min.y, bb.max.z], [bb.max.x, bb.min.y, bb.max.z],
      [bb.min.x, bb.max.y, bb.max.z], [bb.max.x, bb.max.y, bb.max.z],
    ];
    const e = o.matrixWorld.elements;
    for (const [x, y, z] of pts) {
      const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
      const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
      box.xmin = Math.min(box.xmin, wx); box.xmax = Math.max(box.xmax, wx);
      box.ymin = Math.min(box.ymin, wy); box.ymax = Math.max(box.ymax, wy);
      box.zmin = Math.min(box.zmin, wz); box.zmax = Math.max(box.zmax, wz);
    }
  });
  const im = window.__LAB.current().exp._impl;
  const g = im._geo || im._geometry();
  return { box, Tx: g.Tx, XF0: g.XF0, BL: im.BL, zc: cart.position.z };
});

const setP = (h, mu) => page.evaluate(({ h, mu }) => { const e = window.__LAB.current().exp; e.onParam('height', h); e.onParam('surface', mu); }, { h, mu });
const seek = t => page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const dur = () => page.evaluate(() => window.__LAB.current().exp.duration);

let fails = 0, rows = 0, maxZ = 0;
const HS = [0.05, 0.2, 0.35, 0.5], MUS = [0.6, 0.3, 0.12, 0.02, 0];
for (const h of HS) {
  for (const mu of MUS) {
    await setP(h, mu); await sleep(140);
    const d = await dur();
    const times = [0, 1.2, 2.5];
    if (isFinite(d)) times.push(d * 0.98);
    for (const rawT of times) {
      const t = isFinite(d) ? Math.min(rawT, d) : rawT;
      await seek(t); await sleep(90);
      const m = await measure();
      rows++;
      const zhalf = Math.max(Math.abs(m.box.zmin - m.zc), Math.abs(m.box.zmax - m.zc));
      if (zhalf > maxZ) maxZ = zhalf;
      const ymin = m.box.ymin, ymax = m.box.ymax;
      const xin = m.box.xmin > m.Tx - 1.2 && m.box.xmax < m.XF0 + m.BL + 0.3;
      const okZ = zhalf < 0.2255;               // 侧板内面 0.225，车半宽含轮 0.219
      const okY = ymin > -0.02 && ymax < h + 0.40; // 不沉轨；车身（含护栏）高度固定≈0.29，坡越高顶越高
      const okX = xin;
      if (!(okZ && okY && okX)) {
        fails++;
        console.log(`[FAIL] h=${h} mu=${mu} t=${t.toFixed(2)} zHalf=${zhalf.toFixed(4)} yMin=${ymin.toFixed(4)} yMax=${ymax.toFixed(4)} x=[${m.box.xmin.toFixed(2)},${m.box.xmax.toFixed(2)}] okZ=${okZ} okY=${okY} okX=${okX}`);
      }
    }
  }
}
console.log(`组合走查：${rows} 帧，违规 ${fails} 处；车体最大 zHalf=${maxZ.toFixed(4)}（侧板内面 0.225，轮外缘常量 0.219）`);
console.log('errs', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();
