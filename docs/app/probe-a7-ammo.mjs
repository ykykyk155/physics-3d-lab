// A7 ammo.js 刚体试点验收探针（CEO 四条 + 加载遮罩）。
//   1) 同一 t 两次 seek，位姿逐位一致（确定性）
//   2) 顺序播放到 t  vs  直接拖到 t，结果一致
//   3) 首屏不下载；进入 A7 后引擎下载 ≤ 400KB(gzip)；只注入 1 次；二次进入不重复
//   4) 首次进入显示「正在加载物理引擎…」，加载完消失；二次进入不再出现
// 位姿用 scene.getObjectByName('A7-beam'/'A7-w1'/'A7-w2') 取，比较到 4 位小数。
// 读数来自物理世界（倾角随刚体转），t=0 与 t=dur 应不同、末态接近 ±25°。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18133;
const AMMO_PATH = path.join(ROOT, 'vendor', 'ammo', 'ammo.js');
const AMMO_RAW = fs.statSync(AMMO_PATH).size;
const AMMO_GZIP = zlib.gzipSync(fs.readFileSync(AMMO_PATH)).length;
let ammoReqs = 0;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  // 只统计真正的引擎脚本 GET；浏览器会额外请求 ammo.js.map（不存在），别算进去
  if (/vendor\/ammo\/ammo\.js$/.test(p) && (req.method || 'GET') === 'GET') ammoReqs++;
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

check('首屏不下载引擎', ammoReqs === 0, `GET ${ammoReqs} 次`);

await page.evaluate(() => window.__LAB.switch('A7-lever'));
// 观察加载遮罩（外壳 #ammoLoad）与就绪
let sawLoading = false, readyAt = -1;
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  const st = await page.evaluate(() => {
    const ov = document.getElementById('ammoLoad');
    const visible = !!(ov && getComputedStyle(ov).display !== 'none');
    const e = window.__LAB.current().exp;
    return { loading: visible, ready: !!(e && e._impl && e._impl._physReady === true) };
  });
  if (st.loading) sawLoading = true;
  if (st.ready) { readyAt = Date.now() - t0; break; }
  await sleep(100);
}
const afterLoading = await page.evaluate(() => {
  const ov = document.getElementById('ammoLoad');
  return !!(ov && getComputedStyle(ov).display !== 'none');
});
const reqCount = await page.evaluate(() => window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : -1);
check('首次进入出现加载遮罩', sawLoading, sawLoading ? `(ready @ ${readyAt}ms)` : '未观察到');
check('加载完成后遮罩消失', !afterLoading, afterLoading ? '仍存在' : '');
check('引擎 gzip ≤ 400KB', AMMO_GZIP <= 400 * 1024, `gzip ${(AMMO_GZIP / 1024).toFixed(0)} KB / raw ${(AMMO_RAW / 1024).toFixed(0)} KB`);
check('引擎只注入 1 次', reqCount === 1, `ammoRequests=${reqCount}`);

// 关键：暂停播放。外壳 animate() 每帧调 exp.step(dt)，会和手动 seek 抢时间轴，
// 导致「seek(0) 之后又被推进几帧」。所有 seek 类断言必须先停播。
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);

// 改到不平衡：F1=5,L1=3 vs F2=1,L2=1 → 15 vs 1，左侧重 → 向左(+)
await page.evaluate(() => {
  const e = window.__LAB.current().exp;
  e.onParam('f1', 5); e.onParam('l1', 3); e.onParam('f2', 1); e.onParam('l2', 1);
});
await sleep(300);
const dur = await page.evaluate(() => window.__LAB.current().exp.duration);
check('不平衡 → duration > 0', Number.isFinite(dur) && dur > 0, `dur=${dur}`);

const pose = () => page.evaluate(() => {
  const s = window.__LAB.current().scene;
  const f = o => o ? [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(v => +v.toFixed(4)).join(',') : 'MISSING';
  return [f(s.getObjectByName('A7-beam')), f(s.getObjectByName('A7-w1')), f(s.getObjectByName('A7-w2'))].join(' | ');
});

// 1) 同一 t 两次 seek
const t = dur * 0.7;
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const a1 = await pose();
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const a2 = await pose();
check('位姿可取到（非 MISSING）', !/MISSING/.test(a1), a1.slice(0, 80));
check('同一 t 两次 seek 位姿逐位一致', a1 === a2 && !/MISSING/.test(a1), a1 === a2 ? '' : `\n   A=${a1}\n   B=${a2}`);

// 2) 顺序播放到 t vs 直接拖到 t
await page.evaluate(tt => window.__LAB.current().exp.seek(tt), t);
const dragPose = await pose();
const seqPose = await page.evaluate((tt) => {
  const e = window.__LAB.current().exp;
  const s = window.__LAB.current().scene;
  e.seek(0);
  const STEP = 1 / 60;
  let acc = 0;
  while (acc + STEP <= tt + 1e-9) { e.step(STEP); acc += STEP; }
  const f = o => [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(v => +v.toFixed(4)).join(',');
  return [f(s.getObjectByName('A7-beam')), f(s.getObjectByName('A7-w1')), f(s.getObjectByName('A7-w2'))].join(' | ');
}, t);
// step 累加到 t 与直接 seek(t) 应走同一重放路径；步数可能差一步，用逐分量容差比
const nums = s => s.match(/-?\d+\.\d+/g).map(Number);
const dn = nums(dragPose), sn = nums(seqPose);
const maxDiff = Math.max(...dn.map((v, i) => Math.abs(v - (sn[i] != null ? sn[i] : v))));
check('顺序播放到 t ≈ 直接拖到 t（每分量 <0.02）', dn.length === sn.length && maxDiff < 0.02, `最大分量差 ${maxDiff.toFixed(4)}`);

// 3) 读数来自物理世界
await page.evaluate(() => window.__LAB.current().exp.seek(0));
const r0 = await page.evaluate(() => window.__LAB.current().exp.readouts());
await page.evaluate(d => window.__LAB.current().exp.seek(d), dur);
const r1 = await page.evaluate(() => window.__LAB.current().exp.readouts());
const angRow = rs => (rs.find(r => /梁倾角/.test(r.label)) || {}).value;
check('读数含角速度/钩码高度', r1.some(r => /角速度/.test(r.label)) && r1.some(r => /钩码高度/.test(r.label)), r1.map(r => r.label).join('/'));
check('t=0 与 t=dur 倾角不同（物理在转）', angRow(r0) !== angRow(r1), `${angRow(r0)}° → ${angRow(r1)}°`);
check('末态倾角接近 +25°（左侧重→左倾）', angRow(r1) > 20 && angRow(r1) <= 25.5, `${angRow(r1)}°`);

// 4) 二次进入不重复下载
const before2 = ammoReqs;
await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await sleep(300);
await page.evaluate(() => window.__LAB.switch('A7-lever'));
await sleep(1200);
const reqCount2 = await page.evaluate(() => window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : -1);
check('二次进入 A7 不重复注入', reqCount2 === 1, `ammoRequests=${reqCount2}`);

check('控制台无报错', errors.length === 0, [...new Set(errors)].slice(0, 3).join(' / '));

await browser.close(); server.close();
console.log(`\n结果：${fails ? fails + ' 项失败' : '全部通过'}`);
process.exit(fails ? 1 : 0);