// A1 三段平均速度接口验证：segments() + readouts 前置三条 + 静止分支 + 参数档复核
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18199;
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
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await sleep(700);

const expCalc = (thDeg, L, mu) => {
  const G = 9.8, DEG = Math.PI / 180;
  const cartLen = Math.min(0.34, Math.max(L - 0.25, 0.12));
  const travel = Math.max(L - cartLen - 2 * 0.06, 0.02);
  const a = G * (Math.sin(thDeg * DEG) - mu * Math.cos(thDeg * DEG));
  const s1 = travel / 2, t1 = Math.sqrt(2 * s1 / a), t = Math.sqrt(2 * travel / a);
  return { travel, a, v1: s1 / t1, v2: (travel - s1) / (t - t1), v: travel / t, t };
};

let fails = 0;
const chk = (name, ok, extra = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) fails++;
};

const CALC_SRC = expCalc.toString();

// 1) 默认档 segments() 数值 vs 闭式解
const def = await page.evaluate((CALC_SRC) => {
  const calc = eval('(' + CALC_SRC + ')');
  const c = window.__LAB.current().exp;
  const e = c._impl || c;
  const seg = e.segments();
  const th = e.p.theta, L = e.p.length, mu = e.p.mu;
  const exp = calc(th, L, mu);
  return { th, L, mu, seg, exp, static: e.static, travel: e._travel, a: e.aVal };
}, CALC_SRC);
console.log('默认档: θ=%s L=%s μ=%s', def.th, def.L, def.mu);
console.log('segments():', JSON.stringify(def.seg));
console.log('期望闭式:', JSON.stringify({ ...def.exp, v1: +def.exp.v1.toFixed(3), v2: +def.exp.v2.toFixed(3), v: +def.exp.v.toFixed(3) }));
chk('默认档 enabled', def.seg.enabled === true);
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
chk('s1=travel/2', near(def.seg.s1, def.exp.travel / 2));
chk('v1=0.625', near(def.seg.v1, 0.6247, 1e-3), 'v1=' + def.seg.v1.toFixed(4));
chk('v2=1.508', near(def.seg.v2, 1.508, 1e-3), 'v2=' + def.seg.v2.toFixed(4));
chk('v̄=0.884', near(def.seg.v, 0.8836, 1e-3), 'v=' + def.seg.v.toFixed(4));
chk('单调 v1<v̄<v2', def.seg.v1 < def.seg.v && def.seg.v < def.seg.v2);
chk('t1+t2=t 全程', near(def.seg.t1 + def.seg.t2, def.seg.t));
chk('duration 一致', near(def.seg.t * 1.6, 0.978, 1e-3));

// 2) readouts() 前置三条
const ro = await page.evaluate(() => window.__LAB.current().exp.readouts());
console.log('readouts():', ro.map(r => r.label + '=' + r.value).join(' | '));
chk('readouts 前置 v₁', ro[0].label === '前段平均速度 v₁' && near(ro[0].value, 0.625, 1e-2));
chk('readouts 前置 v₂', ro[1].label === '后段平均速度 v₂' && near(ro[1].value, 1.508, 1e-2));
chk('readouts 前置 v̄', ro[2].label === '全程平均速度 v̄' && near(ro[2].value, 0.884, 1e-2));

// 2b) 外壳 api 层透传 segments()（数据表取数路径：window.__LAB.current().exp.segments()）
const apiSeg = await page.evaluate(() => window.__LAB.current().exp.segments());
chk('api.segments() 透传可用', apiSeg !== null && apiSeg.enabled === true, `api.enabled=${apiSeg && apiSeg.enabled}`);
chk('api.segments() 与 impl 一致', near(apiSeg.v1, def.seg.v1, 1e-9) && near(apiSeg.t, def.seg.t, 1e-9));

// 3) 静止分支 μ≥tanθ（经真实 DOM 滑块派发，外壳才同步状态）
const dispatch = (pid, v) => page.evaluate((pid, v) => {
  const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
  if (!blk) return false;
  const input = blk.querySelector('input[type=range]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, String(v));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, pid, v);
await dispatch('theta', 5); await sleep(120);
await dispatch('mu', 0.30); await sleep(400);
const st = await page.evaluate(() => {
  const e = window.__LAB.current().exp._impl || window.__LAB.current().exp;
  const seg = e.segments();
  return { seg, static: e.static, dur: e.duration, theta: e.p.theta, mu: e.p.mu };
});
console.log('静止档: θ=%s μ=%s static=%s dur=%s', st.theta, st.mu, st.static, st.dur);
chk('静止分支 static', st.static === true && st.dur === 0, `static=${st.static} dur=${st.dur}`);
chk('静止分支 enabled=false 全 0', st.seg.enabled === false && st.seg.v1 === 0 && st.seg.v2 === 0 && st.seg.v === 0 && st.seg.t === 0);

// 4) 参数档复核：θ20 L1.5 μ0.05、θ35 L0.75 μ0.1、θ30 L0.5 μ0.05
const cases = [
  { theta: 20, length: 1.5, mu: 0.05 },
  { theta: 35, length: 0.75, mu: 0.10 },
  { theta: 30, length: 0.5, mu: 0.05 },
];
for (const cs of cases) {
  await page.evaluate((cs) => {
    const e = window.__LAB.current().exp._impl || window.__LAB.current().exp;
    e.onParam('theta', cs.theta); e.onParam('length', cs.length); e.onParam('mu', cs.mu);
  }, cs);
  await sleep(250);
  const r = await page.evaluate((CALC_SRC) => {
    const calc = eval('(' + CALC_SRC + ')');
    const e = (window.__LAB.current().exp._impl || window.__LAB.current().exp);
    const seg = e.segments(), th = e.p.theta, L = e.p.length, mu = e.p.mu;
    const exp = calc(th, L, mu);
    return { seg, static: e.static, exp };
  }, CALC_SRC);
  const okMono = r.seg.enabled && r.seg.v1 < r.seg.v && r.seg.v < r.seg.v2;
  const okVals = near(r.seg.v, r.exp.v, 1e-6) && near(r.seg.s1, r.exp.travel / 2, 1e-6) && near(r.seg.t1 + r.seg.t2, r.seg.t, 1e-6);
  chk(`档 θ${cs.theta} L${cs.length} μ${cs.mu}: ${okVals && okMono ? '三段数值/单调对' : '错'}`, okVals && okMono,
    `v1=${r.seg.v1.toFixed(3)} v̄=${r.seg.v.toFixed(3)} v2=${r.seg.v2.toFixed(3)} static=${r.static}`);
}

// 5) seek 时 segments() 只读、不随时间轴变（reset 后先等外壳就绪再经 DOM 派发默认档）
await page.evaluate(() => window.__LAB.reset());
await sleep(700);
await dispatch('theta', 20); await sleep(150);
await dispatch('mu', 0.05); await sleep(150);
await dispatch('length', 1); await sleep(400);
const sA = await page.evaluate(() => (window.__LAB.current().exp._impl || window.__LAB.current().exp).segments());
await page.evaluate(() => window.__LAB.current().exp.seek(0.3));
const sB = await page.evaluate(() => (window.__LAB.current().exp._impl || window.__LAB.current().exp).segments());
chk('seek 不改变 segments()', JSON.stringify(sA) === JSON.stringify(sB), `sA=${sA.v1.toFixed(3)} sB=${sB.v1.toFixed(3)}`);

console.log('\n报错数:', errors.length, errors.length ? errors : '');
console.log(fails === 0 ? '\nALL PASS ✅' : `\n${fails} FAIL(s) ❌`);
await browser.close();
process.exit(fails === 0 && errors.length === 0 ? 0 : 1);