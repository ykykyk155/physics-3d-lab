// 线上复验：A2 车身贴坡姿态（tiltG.rotation.z）+ 0 报错
// 访问线上 https://ykykyk155.github.io/physics-3d-lab/ 真机浏览器
import puppeteer from 'puppeteer-core';

const pageURL = 'https://ykykyk155.github.io/physics-3d-lab/index.html?v=' + Date.now();
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
await page.setViewport({ width: 1420, height: 700 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const check = (n, c, d) => { if (!c) fails++; console.log(`[${c ? ' ok ' : 'FAIL'}] ${n}${d ? '  ' + d : ''}`); };

await page.goto(pageURL, { waitUntil: 'load', timeout: 90000 });
let booted = false;
for (let i = 0; i < 30; i++) {
  booted = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (booted) break;
  await sleep(500);
}
check('页面 boot 就绪', booted);

// 进 A2
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
const t0 = Date.now();
while (Date.now() - t0 < 30000) {
  const st = await page.evaluate(() => {
    const e = window.__LAB.current().exp;
    return !!(e && e._impl && e._impl._physReady);
  });
  if (st) break;
  await sleep(150);
}
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(250);

const theta = Math.atan(0.35 / 2.0);
const probe = async (t) => page.evaluate((tt) => {
  const exp = window.__LAB.current().exp;
  if (exp.seek) exp.seek(tt); else window.__LAB.current().seek(tt);
  return new Promise((resolve) => {
    setTimeout(() => {
      const sc = window.__LAB.current().scene;
      const c = sc.getObjectByName('A2-cart');
      const impl = exp._impl;
      resolve({ x: c ? c.position.x : NaN, tilt: impl && impl.tiltG ? impl.tiltG.rotation.z : null });
    }, 300);
  });
}, t);

const r0 = await probe(0.0);
const rMid = await probe(0.55);
const rFlat = await probe(2.5);
check('坡顶 tilt≈−θ', r0.tilt != null && Math.abs(r0.tilt + theta) < 0.005, `tilt=${r0.tilt}`);
check('直线中段 tilt≈−θ', rMid.tilt != null && Math.abs(rMid.tilt + theta) < 0.005, `tilt=${rMid.tilt}`);
check('水平段 tilt=0', rFlat.tilt != null && Math.abs(rFlat.tilt) < 0.005, `tilt=${rFlat.tilt}`);
check('位置连续性', isFinite(r0.x) && isFinite(rMid.x) && isFinite(rFlat.x) && r0.x < rMid.x && rMid.x < rFlat.x,
  `x ${r0.x.toFixed(2)}→${rMid.x.toFixed(2)}→${rFlat.x.toFixed(2)}`);
check('0 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);