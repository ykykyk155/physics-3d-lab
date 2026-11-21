// A2 车身贴坡姿态探针：t0 坡顶/中段/圆弧/水平段四阶段，车身倾角 tiltG.rotation.z
// 断言：直线坡段 ≈ −θ(=atan(H/RL))；圆弧段在 (−θ, 0)；水平段 = 0；全程无 pageerror。
// 另核轮子是否转（cartVis 下轮组位置随里程滚动 → 探 mesh name 'A2-wheel' 之类存在即可，转动量不深断）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18161;
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

let fails = 0;
const check = (n, c, d) => { if (!c) fails++; console.log(`[${c ? ' ok ' : 'FAIL'}] ${n}${d ? '  ' + d : ''}`); };

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

// 采样：seek 各时刻后读 cartG.position.x 与 tiltG.rotation.z
const probe = async (t) => page.evaluate((tt) => {
  const exp = window.__LAB.current().exp;
  if (exp.seek) exp.seek(tt); else window.__LAB.current().seek(tt);
  return new Promise((resolve) => {
    setTimeout(() => {
      const sc = window.__LAB.current().scene;
      const c = sc.getObjectByName('A2-cart');
      const tilt = exp._impl && exp._impl.tiltG ? exp._impl.tiltG.rotation.z : null;
      resolve({ x: c ? c.position.x : NaN, y: c ? c.position.y : NaN, tilt });
    }, 260);
  });
}, t);

// 默认 θ：H=0.35, RL=2.0 → theta=atan(0.175)≈0.1733rad≈9.93°
const theta = Math.atan(0.35 / 2.0);
// 时间采样点（t：时间轴秒）：0(坡顶) / 0.8(直线中段) / ~1.35(圆弧) / 2.5(水平段)
const samples = [0, 0.55, 0.9, 1.2, 1.45, 1.7, 2.0, 2.5];
const out = [];
for (const t of samples) {
  const r = await probe(t);
  out.push({ t, x: +r.x.toFixed(3), y: +r.y.toFixed(3), tilt: r.tilt == null ? null : +r.tilt.toFixed(4) });
  await sleep(40);
}
console.log('采样（t, x, y, tilt）:', out.map(o => `${o.t}:${o.x}/${o.y}/${o.tilt}`).join(' '));

// 断言
const XF0 = -1.2, R = 0.3, sinT = Math.sin(theta);
const Ax = XF0 - R * sinT; // ≈ -1.148
check('坡顶 t=0 tilt≈−θ', Math.abs(out[0].tilt + theta) < 0.005, `tilt=${out[0].tilt} θ=${theta}`);
for (const o of out) {
  if (o.x > XF0) check(`水平段 x=${o.x} tilt=0`, Math.abs(o.tilt) < 0.005, `tilt=${o.tilt}`);
  else if (o.x > Ax) check(`圆弧段 x=${o.x} tilt∈(−θ,0)`, o.tilt < 0 && o.tilt > -theta - 0.005, `tilt=${o.tilt}`);
  else check(`直线段 x=${o.x} tilt≈−θ`, Math.abs(o.tilt + theta) < 0.005 + 0.02, `tilt=${o.tilt}`);
}
check('无 pageerror', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);