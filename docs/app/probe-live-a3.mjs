// 线上复验：A3 砝码片数/读数 + 固定 12s 观察窗三档速度
import puppeteer from 'puppeteer-core';
import path from 'node:path';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SITE = 'https://ykykyk155.github.io/physics-3d-lab/index.html';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.setCacheEnabled(false);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const tick = ms => new Promise(r => setTimeout(r, ms));

await page.goto(SITE + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.__LAB && window.__LAB.ready))) break; await tick(500); }
const out = [];
const ok = (name, cond, detail) => out.push([name, !!cond, detail]);

await page.evaluate(() => window.__LAB.switch('A3-friction'));
for (let i = 0; i < 40; i++) {
  const cur = await page.evaluate(() => { const c = window.__LAB.current(); return c && c.exp && c.exp._impl ? c.id : null; });
  if (cur === 'A3-friction') break;
  await tick(250);
}
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });

async function setParam(pid, value) {
  await page.evaluate(({ pid, value }) => {
    const block = document.querySelector('.param-block[data-pid="' + pid + '"]');
    const input = block && block.querySelector('input');
    if (input) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
  }, { pid, value });
  await tick(180);
}
async function readState() {
  return page.evaluate(() => {
    const I = window.__LAB.current().exp._impl;
    const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    return { n: I._weightsN, f: ro['摩擦力 f'], normal: ro['压力 N'], mu: ro['摩擦因数 μ'], dur: window.__LAB.current().exp.duration, x: +I.block.position.x.toFixed(3) };
  });
}
const defaults = await readState();
ok('A3 默认 f=0.8N / 4片砝码', Math.abs(parseFloat(defaults.f) - 0.8) < 0.01 && defaults.n === 4, JSON.stringify(defaults));

await setParam('normal', 5); const n5 = await readState();
ok('压力 5N → 10片砝码 + f=2.00N', n5.n === 10 && Math.abs(parseFloat(n5.f) - 2) < 0.01, JSON.stringify(n5));
await setParam('normal', 0.5); const n05 = await readState();
ok('压力 0.5N → 1片砝码 + f=0.20N', n05.n === 1 && Math.abs(parseFloat(n05.f) - 0.2) < 0.01, JSON.stringify(n05));

async function measure(pull) {
  await page.evaluate(() => { const s = window.__LAB.store; s.playback.playing = false; s.simTime = 0; window.__LAB.current().exp._impl.reset(); });
  await setParam('normal', 2); await setParam('pull', pull);
  await page.evaluate(() => { window.__LAB.store.simTime = 0; window.__LAB.store.playback.playing = true; });
  await tick(2000);
  const r = await page.evaluate(() => {
    const I = window.__LAB.current().exp._impl; const s = window.__LAB.store; const ro = {};
    for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    return { x: +I.block.position.x.toFixed(3), sim: +s.simTime.toFixed(2), dur: window.__LAB.current().exp.duration, readout: ro['拖动位移 x'] };
  });
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  return r;
}
const p005 = await measure(0.05); ok('pull=0.05 2s → x≈0.10m', Math.abs(p005.x - 0.10) < 0.03 && p005.dur === 12, JSON.stringify(p005));
const p01 = await measure(0.10); ok('pull=0.10 2s → x≈0.20m', Math.abs(p01.x - 0.20) < 0.03 && p01.dur === 12, JSON.stringify(p01));
const p03 = await measure(0.30); ok('pull=0.30 2s → x≈0.60m', Math.abs(p03.x - 0.60) < 0.03 && p03.dur === 12, JSON.stringify(p03));

// 截图线上 A3（压力 2N，时间轴归零）
await setParam('normal', 2); await setParam('pull', 0.1);
await page.evaluate(() => {
  window.__LAB.store.playback.playing = false; window.__LAB.store.simTime = 0;
  const tr = document.querySelector('#timeRange'); tr.value = 0; tr.dispatchEvent(new Event('input', { bubbles: true }));
});
await tick(350);
const vp = await page.$('#viewport'); await vp.screenshot({ path: path.join(import.meta.dirname, 'shots', 'live-a3-default.png') });

ok('全程 0 报错', errors.length === 0, errors.slice(0, 5).join(' | '));
for (const [name, pass, detail] of out) console.log((pass ? '[ ok ] ' : '[FAIL] ') + name + '  ' + detail);
const failed = out.filter(x => !x[1]).length;
console.log('RESULT', failed ? 'FAIL ' + failed : 'ALL PASS');
await browser.close();
