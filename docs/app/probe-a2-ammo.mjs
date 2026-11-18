// A2 ammo.js 刚体验收探针。
// CEO 四条（A7 同款）：
//   1) 同一 t 两次 seek 位姿逐位一致
//   2) 顺序播放到 t vs 直接拖到 t，结果一致
//   3) 首屏不下载；进 A2 后引擎 ≤400KB(gzip)；只注入1次；二次进入不重复
//   4) 加载遮罩出现→消失
// CEO 新增三条：
//   5) 静止必须真静止：摩擦足够大（毛巾 μ=0.6）时小车彻底停住，不慢速蠕动
//   6) 滑动距离有区分度：毛巾<棉布<木板，两两相对差距 ≥15%（轨道侧摩擦 1.0 后有效 μ=μ）
//   7) 刚体停止距离与解析式 v0²/(2μg) 偏差 ≤5%（CEO：不能把物理量做错）
// 另：读数来自物理世界（读速度/位移/静止态）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18150;
const AMMO = path.join(ROOT, 'vendor', 'ammo', 'ammo.js');
const AMMO_GZIP = zlib.gzipSync(fs.readFileSync(AMMO)).length;
let ammoReq = 0;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  if (/vendor\/ammo\/ammo\.js$/.test(p) && (req.method || 'GET') === 'GET') ammoReq++;
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

check('首屏不下载引擎', ammoReq === 0, `GET ${ammoReq} 次`);

// 进 A2（默认棉布 μ=0.3）
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
let sawLoading = false, readyAt = -1;
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  const st = await page.evaluate(() => {
    const ov = document.getElementById('ammoLoad');
    const vis = !!(ov && getComputedStyle(ov).display !== 'none');
    const e = window.__LAB.current().exp;
    return { loading: vis, ready: !!(e && e._impl && e._impl._physReady) };
  });
  if (st.loading) sawLoading = true;
  if (st.ready) { readyAt = Date.now() - t0; break; }
  await sleep(100);
}
const after = await page.evaluate(() => { const ov = document.getElementById('ammoLoad'); return !!(ov && getComputedStyle(ov).display !== 'none'); });
const reqCount = await page.evaluate(() => window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : -1);
check('首次进入出现加载遮罩', sawLoading, sawLoading ? `(ready @ ${readyAt}ms)` : '未出现');
check('加载完成后遮罩消失', !after, after ? '仍存在' : '');
check('引擎 gzip ≤ 400KB', AMMO_GZIP <= 400 * 1024, `${(AMMO_GZIP / 1024).toFixed(0)} KB`);
check('引擎只注入 1 次', reqCount === 1, `ammoRequests=${reqCount}`);

await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);
// 暂停！否则 animate 每帧 step 与 seek 抢时间轴

const cartPose = () => page.evaluate(() => {
  const s = window.__LAB.current().scene;
  const c = s.getObjectByName('A2-cart');
  return c ? c.position.x.toFixed(4) : 'MISSING';
});

/* --- CEO 新增 5：静止真静止（毛巾 μ=0.6） --- */
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.6); e.onParam('height', 0.15); });
await sleep(300);
const dur = await page.evaluate(() => window.__LAB.current().exp.duration);
await page.evaluate(d => { window.__LAB.current().exp.seek(d); }, dur);
await sleep(50);
const xEnd = Number(await cartPose());
// 再往前推进 60 帧，小车若在蠕动，x 会继续变大
await page.evaluate(() => { const e = window.__LAB.current().exp._impl; e._phys.stepN(60); });
const xEndMore = Number(await cartPose());
const drift = Math.abs(xEndMore - xEnd);
check('毛巾(μ=0.6)真静止：停住后再走60帧位不移', drift < 0.02, `x ${xEnd} → ${xEndMore}（漂移 ${drift.toFixed(3)}m）`);

/* --- CEO 新增 6：滑动距离有区分度 --- */
const stopDist = async (mu) => {
  await page.evaluate(m => { const e = window.__LAB.current().exp; e.onParam('surface', m); e.onParam('height', 0.15); }, mu);
  await sleep(250);
  const d = await page.evaluate(() => window.__LAB.current().exp.duration);
  await page.evaluate(dd => { window.__LAB.current().exp.seek(dd); }, d);
  await sleep(50);
  const x = Number(await cartPose());
  // 释放点才是滑行位移零点（小车从坡脚 startX() 出发，不是 XF0）
  const startX = await page.evaluate(() => window.__LAB.current().exp._impl.startX());
  return { x, dist: Math.max(0, x - startX) };
};
const rTowel = await stopDist(0.6);
const rCloth = await stopDist(0.3);
const rWood = await stopDist(0.12);

// 与解析式对比（轨道侧摩擦 1.0 → 有效摩擦 = μ）：dist = v0²/(2μg)
// 判据（CEO 拍板）：|实测−理论| ≤ max(5%×理论, 0.03m)——0.03 容差吸收 60Hz 离散步长与初始穿透
const G = 9.8, h = 0.15;
const v0T = Math.sqrt(2 * G * h);
const theory = mu => (v0T * v0T) / (2 * mu * G);
const within = (meas, mu) => {
  const t = theory(mu);
  return Math.abs(meas - t) <= Math.max(0.05 * t, 0.03);
};
check('木板 μ=0.12 停止距离≈理论1.25m（容差内）',
  within(rWood.dist, 0.12), `实测 ${rWood.dist.toFixed(3)} / 理论 ${theory(0.12).toFixed(3)}（Δ${(Math.abs(rWood.dist - theory(0.12))).toFixed(3)}）`);
check('棉布 μ=0.3 距≈理论0.50m（容差内）',
  within(rCloth.dist, 0.3), `实测 ${rCloth.dist.toFixed(3)} / 理论 ${theory(0.3).toFixed(3)}（Δ${(Math.abs(rCloth.dist - theory(0.3))).toFixed(3)}）`);
check('毛巾 μ=0.6 距≈理论0.25m（容差内）',
  within(rTowel.dist, 0.6), `实测 ${rTowel.dist.toFixed(3)} / 理论 ${theory(0.6).toFixed(3)}（Δ${(Math.abs(rTowel.dist - theory(0.6))).toFixed(3)}）`);

const diffs = { tow2cloth: rCloth.dist - rTowel.dist, cloth2wood: rWood.dist - rCloth.dist };
check('距离单调（毛巾<棉布<木板）', rTowel.dist < rCloth.dist && rCloth.dist < rWood.dist,
  `毛巾 ${rTowel.dist.toFixed(2)} < 棉布 ${rCloth.dist.toFixed(2)} < 木板 ${rWood.dist.toFixed(2)}`);
check('两两相对差距≥15%', (diffs.tow2cloth / rTowel.dist) >= 0.15 && (diffs.cloth2wood / rCloth.dist) >= 0.15,
  `毛巾→棉布 +${(diffs.tow2cloth / rTowel.dist * 100).toFixed(0)}%、棉布→木板 +${(diffs.cloth2wood / rCloth.dist * 100).toFixed(0)}%`);
check('最远一档≤轨道85%', rWood.dist <= 7.0 * 0.85, `木板 ${rWood.dist.toFixed(2)} ≤ ${(7.0 * 0.85).toFixed(2)}`);

/* --- CEO 四条基础 --- */
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.3); e.onParam('height', 0.15); });
await sleep(250);
const d2 = await page.evaluate(() => window.__LAB.current().exp.duration);
const t = d2 * 0.7;
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t); const a1 = await cartPose();
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t); const a2 = await cartPose();
check('同一 t 两次 seek 位姿一致', a1 === a2 && a1 !== 'MISSING', a1);
const seq = await page.evaluate(tt => {
  const e = window.__LAB.current().exp; const s = window.__LAB.current().scene;
  e.seek(0); let acc = 0; const STEP = 1 / 60;
  while (acc + STEP <= tt + 1e-9) { e.step(STEP); acc += STEP; }
  return (s.getObjectByName('A2-cart') || {}).position.x.toFixed(4);
}, t);
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const drag = await cartPose();
check('顺序播放≈拖到 t（±0.02m）', Math.abs(Number(seq) - Number(drag)) < 0.02, `seq=${seq} drag=${drag}`);

/* 读数来自物理世界 */
await page.evaluate(() => window.__LAB.current().exp.seek(0));
const r0 = await page.evaluate(() => window.__LAB.current().exp.readouts());
const hasSpeed = r0.some(r => /速度 v/.test(r.label));
const hasPhase = r0.some(r => /运动阶段/.test(r.label));
check('读数含速度/位移/阶段', hasSpeed && hasPhase, r0.map(r => r.label).join('/'));

/* 二次进入不重复下载 */
const before2 = ammoReq;
await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await sleep(300);
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1000);
const reqCount2 = await page.evaluate(() => window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : -1);
check('二次进入 A2 不重复注入', reqCount2 === 1, `ammoRequests=${reqCount2}`);

check('控制台无报错', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' / '));

await browser.close(); server.close();
console.log(`\n结果：${fails ? fails + ' 项失败' : '全部通过'}`);
process.exit(fails ? 1 : 0);