// 线上复验：A2 冰面刹停 + 理想光滑循环（2026-11-21）
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'https://ykykyk155.github.io/physics-3d-lab/index.html';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.setCacheEnabled(false);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
const tick = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 20; i++) {
  const ok = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (ok) break;
  await tick(500);
}

const out = [];
const fin = x => (x === null || x === Infinity ? 'Infinity' : (isFinite(x) ? x.toFixed(2) : 'Infinity'));
const cap = fn => page.evaluate(fn); // 每个 evaluate 内部用 II 取 _impl

// 切 A2
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
for (let i = 0; i < 40; i++) {
  const cur = await page.evaluate(() => window.__LAB.current());
  if (cur && cur.id === 'A2-newton-first' && cur.exp && cur.exp._impl && cur.exp._impl.p) break;
  await tick(250);
}

// 1) 默认棉布 duration 2.9
const dCloth = await page.evaluate(() => window.__LAB.current().exp.duration);
out.push(['A2 默认棉布 duration=2.9', Math.abs(dCloth - 2.9) < 0.05, `duration=${fin(dCloth)}`]);

// 2) 切冰面 μ=0.02 → duration 有限 ≈5.0
await page.evaluate(() => {
  const I = window.__LAB.current().exp._impl;
  I.p.surface.value = 0.02;
  I.onParam('surface', 0.02, I.p.surface);
});
await tick(800);
const dIce = await page.evaluate(() => window.__LAB.current().exp.duration);
out.push(['冰面 duration 有限可拖', isFinite(dIce) && dIce > 0 && dIce <= 6, `duration=${fin(dIce)}`]);

// 3) 冰面 seek 到 duration → 车在末端 x=5.8
await page.evaluate(t => {
  const I = window.__LAB.current().exp._impl;
  I.seek(t);
}, dIce);
await tick(120); // 等 rAF 把刚体变换同步到场景网格
const ice = await page.evaluate(() => {
  const c = window.__LAB.current().scene.getObjectByName('A2-cart');
  return { x: c.position.x, y: c.position.y };
});
out.push(['冰面末端钳停 x=5.8', Math.abs(ice.x - 5.79) < 0.11 && ice.y > 0.03, `x=${ice.x.toFixed(2)} y=${ice.y.toFixed(2)}`]);

// 4) 切理想光滑 μ=0 → duration Infinity、阶段「循环滑行中」
await page.evaluate(() => {
  const I = window.__LAB.current().exp._impl;
  I.p.surface.value = 0;
  I.onParam('surface', 0, I.p.surface);
});
await tick(800);
const zero = await page.evaluate(() => {
  const E = window.__LAB.current().exp;
  return { dur: E.duration, phase: (E.readouts ? E.readouts() : []).map(r => r.value + r.unit).join('|') };
});
out.push(['理想光滑 duration=Infinity', zero.dur === Infinity || zero.dur === null, `duration=${fin(zero.dur)}`]);
out.push(['阶段含「循环滑行中」', zero.phase.includes('循环'), `phase=${zero.phase.slice(0, 60)}`]);

// 5) μ=0 seek 大 t 后仍在坡顶↔末端间（已循环，未卡死）
const cycl = await page.evaluate(t => {
  const I = window.__LAB.current().exp._impl;
  I.seek(t);
  return t;
}, 30);
await tick(120);
const cyclP = await page.evaluate(() => {
  const c = window.__LAB.current().scene.getObjectByName('A2-cart');
  return { x: c.position.x, y: c.position.y };
});
out.push(['μ=0 t=30 已循环回坡顶', cyclP.x < 5.9 && cyclP.y > 0.03, `t=30 x=${cyclP.x.toFixed(2)} y=${cyclP.y.toFixed(2)}`]);

// 6) 0 报错
out.push(['0 报错', errors.length === 0, errors.slice(0, 3).join(' ; ')]);

let all = true;
for (const [n, ok, msg] of out) {
  console.log((ok ? '[ ok ] ' : '[FAIL] ') + n + (msg ? '  ' + msg : ''));
  if (!ok) all = false;
}
console.log(all ? '\nALL PASS' : '\nSOME FAILED');
await browser.close();
process.exit(all ? 0 : 1);