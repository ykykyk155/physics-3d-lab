// 线上复验：A3 平放 / 侧放真 90° 翻转（不是缩放）+ 水平绳随高度
import puppeteer from 'puppeteer-core';
import path from 'node:path';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SITE = 'https://ykykyk155.github.io/physics-3d-lab/index.html';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1420,800'] });
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 800 });
await page.setCacheEnabled(false);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const tick = ms => new Promise(r => setTimeout(r, ms));
await page.goto(SITE + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(window.__LAB && window.__LAB.ready))) break; await tick(500); }
await page.evaluate(() => window.__LAB.switch('A3-friction'));
for (let i = 0; i < 40; i++) { if (await page.evaluate(() => window.__LAB.current()?.id === 'A3-friction')) break; await tick(250); }
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });

const out = [];
const ok = (name, cond, detail) => out.push([name, !!cond, detail]);

async function geom() {
  return page.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    function bbox(obj) {
      obj.updateMatrixWorld(true);
      let n = { x: Infinity, y: Infinity, z: Infinity }, x = { x: -Infinity, y: -Infinity, z: -Infinity };
      obj.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld); n.x = Math.min(n.x, bb.min.x); n.y = Math.min(n.y, bb.min.y); n.z = Math.min(n.z, bb.min.z); x.x = Math.max(x.x, bb.max.x); x.y = Math.max(x.y, bb.max.y); x.z = Math.max(x.z, bb.max.z); } });
      return { min: n, max: x, size: { x: +(x.x - n.x).toFixed(3), y: +(x.y - n.y).toFixed(3), z: +(x.z - n.z).toFixed(3) } };
    }
    const b = bbox(e.block), w = bbox(e.weightsG);
    return { area: e.p.area, n: e.p.normal, weightsN: e._weightsN, block: b, weightBottom: +w.min.y.toFixed(3), weightSize: w.size };
  });
}
async function pick(pid, oid) {
  const done = await page.evaluate(({ pid, oid }) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    const btn = blk && [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === oid);
    if (!btn) return false; btn.click(); return true;
  }, { pid, oid });
  await tick(250);
  return done;
}
async function setRange(pid, v) {
  const done = await page.evaluate(({ pid, v }) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    const input = blk && blk.querySelector('input[type=range]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(v)); input.dispatchEvent(new Event('input', { bubbles: true })); return true;
  }, { pid, v });
  await tick(250);
  return done;
}

const flat = await geom();
ok('平放：block 0.88×0.20×0.40、顶面 y=0.20', flat.area === 'big' && Math.abs(flat.block.size.y - 0.2) < 0.01 && Math.abs(flat.block.size.z - 0.4) < 0.01 && Math.abs(flat.block.max.y - 0.2) < 0.01, JSON.stringify(flat));

const clicked = await pick('area', 'small');
const side = await geom();
ok('点「侧放」→ 真 90° 翻转：block 0.88×0.40×0.20、底 y≈0、顶 y≈0.40', clicked && side.area === 'small' && Math.abs(side.block.size.y - 0.4) < 0.01 && Math.abs(side.block.size.z - 0.2) < 0.01 && Math.abs(side.block.min.y) < 0.01 && Math.abs(side.block.max.y - 0.4) < 0.01, JSON.stringify(side));
ok('侧放：砝码 4 片落在顶面 y=0.40', side.weightsN === 4 && Math.abs(side.weightBottom - side.block.max.y) < 0.01, JSON.stringify(side));

await setRange('normal', 5);
const side5 = await geom();
ok('侧放 + 5N：10 片砝码仍在顶面', side5.weightsN === 10 && Math.abs(side5.weightBottom - side5.block.max.y) < 0.01, JSON.stringify(side5));

await pick('area', 'big'); await setRange('normal', 2);
const flat2 = await geom();
ok('切回平放：尺寸恢复且砝码仍在顶上', flat2.area === 'big' && Math.abs(flat2.block.size.y - 0.2) < 0.01 && Math.abs(flat2.weightBottom - flat2.block.max.y) < 0.01, JSON.stringify(flat2));

// 线上侧放截图
await pick('area', 'small'); await setRange('normal', 2);
await page.evaluate(() => { const s = window.__LAB.store; s.playback.playing = false; s.simTime = 0; const tr = document.querySelector('#timeRange'); if (tr) { tr.value = 0; tr.dispatchEvent(new Event('input', { bubbles: true })); } });
await tick(350);
const vp = await page.$('#viewport'); await vp.screenshot({ path: path.join(import.meta.dirname, 'shots', 'live-a3-side.png') });

ok('全程 0 报错', errors.length === 0, errors.slice(0, 5).join(' | '));
for (const [name, pass, detail] of out) console.log((pass ? '[ ok ] ' : '[FAIL] ') + name + '  ' + detail);
const failed = out.filter(x => !x[1]).length;
console.log('RESULT', failed ? 'FAIL ' + failed : 'ALL PASS');
await browser.close();
