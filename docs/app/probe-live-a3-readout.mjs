// 线上复验：A3 新增「接触面积」读数行（平放/侧放文字切换，f 不变）
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
await page.evaluate(() => window.__LAB.switch('A3-friction'));
for (let i = 0; i < 40; i++) {
  const cur = await page.evaluate(() => { const c = window.__LAB.current(); return c && c.exp && c.exp._impl ? c.id : null; });
  if (cur === 'A3-friction') break;
  await tick(250);
}
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });

async function readAreaReadout() {
  return page.evaluate(() => {
    const ro = {};
    for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    const I = window.__LAB.current().exp._impl;
    return { area: ro['接触面积'], f: ro['摩擦力 f'], implArea: I.p.area };
  });
}

const out = [];
const ok = (name, cond, detail) => out.push([name, !!cond, detail]);

// 默认平放
const d0 = await readAreaReadout();
ok('默认平放：接触面积=平放（大）· f 不变，f=0.80N', d0.area === '平放（大） · f 不变' && Math.abs(parseFloat(d0.f) - 0.8) < 0.01 && d0.implArea === 'big', JSON.stringify(d0));

// 切侧放
await page.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam('area', 'small'); e.recompute(); });
await tick(300);
const d1 = await readAreaReadout();
ok('切侧放：接触面积=侧放（小）· f 不变，f 仍 0.80N', d1.area === '侧放（小） · f 不变' && Math.abs(parseFloat(d1.f) - 0.8) < 0.01 && d1.implArea === 'small', JSON.stringify(d1));

// 切回平放
await page.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam('area', 'big'); e.recompute(); });
await tick(300);
const d2 = await readAreaReadout();
ok('切回平放：接触面积恢复平放（大）· f 不变', d2.area === '平放（大） · f 不变' && d2.implArea === 'big', JSON.stringify(d2));

// 侧放时截图
await page.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam('area', 'small'); e.recompute(); });
await tick(400);
const vp = await page.$('#viewport');
await vp.screenshot({ path: path.join(import.meta.dirname, 'shots', 'live-a3-readout-side.png') });

ok('全程 0 报错', errors.length === 0, errors.slice(0, 5).join(' | '));
for (const [name, pass, detail] of out) console.log((pass ? '[ ok ] ' : '[FAIL] ') + name + '  ' + detail);
const failed = out.filter(x => !x[1]).length;
console.log('RESULT', failed ? 'FAIL ' + failed : 'ALL PASS');
await browser.close();
process.exit(failed ? 1 : 0);