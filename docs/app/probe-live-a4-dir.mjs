// 线上复验：A4 四向朝向（上/下/左/右）切换 p/Δh 不变 + Δh cm 大号标签
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
await page.evaluate(() => window.__LAB.switch('A4-liquid-pressure'));
for (let i = 0; i < 40; i++) {
  const cur = await page.evaluate(() => { const c = window.__LAB.current(); return c && c.exp && c.exp._impl ? c.id : null; });
  if (cur === 'A4-liquid-pressure') break;
  await tick(250);
}
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });

async function setOrient(v) { await page.evaluate(v => { const e = window.__LAB.current().exp._impl; e.onParam('orient', v); e.recompute(); }, v); await tick(250); }
async function readA4() {
  return page.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    return { p: ro['液体压强 p'], dhmm: ro['U 管液面差 Δh'], orient: ro['探头朝向'], label: e._dirName, lblCm: (e.lblCm ? e.lblCm.userData.div.textContent : null) };
  });
}

const out = [];
const ok = (name, cond, detail) => out.push([name, !!cond, detail]);

const d0 = await readA4();
ok('默认朝下：p=980Pa、Δh=100mm、cm 标签存在', Math.abs(parseFloat(d0.p) - 980) < 1 && d0.dhmm === 100 && d0.orient === '下' && d0.lblCm && d0.lblCm.includes('10.0'), JSON.stringify(d0));

for (const [tag, val, name] of [['右', 90, '右'], ['上', 180, '上'], ['左', 270, '左'], ['下', 0, '下']]) {
  await setOrient(val);
  const r = await readA4();
  ok(`朝向${name}：p/Δh 不变、label=朝向 ${name}、读数=探头朝向 ${name}`, Math.abs(parseFloat(r.p) - 980) < 1 && r.dhmm === 100 && r.orient === name && r.label === name, JSON.stringify(r));
}

// 切盐水深度 20cm 再验证读数随深度变化（非死值）
await page.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam('liquid', 1.3); e.onParam('depth', 20); e.recompute(); });
await tick(300);
const d1 = await readA4();
ok('盐水深度20cm：p 随密度/深度增大、读数联动', parseFloat(d1.p) > 2000 && parseFloat(d1.p) < 2600 && d1.lblCm && d1.lblCm.includes('26.0'), JSON.stringify(d1));

// 截图线上四向（下拉）
await setOrient(180);
const vp = await page.$('#viewport');
await vp.screenshot({ path: path.join(import.meta.dirname, 'shots', 'live-a4-up.png') });
await setOrient(0);

ok('全程 0 报错', errors.length === 0, errors.slice(0, 5).join(' | '));
for (const [name, pass, detail] of out) console.log((pass ? '[ ok ] ' : '[FAIL] ') + name + '  ' + detail);
const failed = out.filter(x => !x[1]).length;
console.log('RESULT', failed ? 'FAIL ' + failed : 'ALL PASS');
await browser.close();
process.exit(failed ? 1 : 0);