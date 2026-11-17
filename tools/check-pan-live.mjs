// 线上验证平移视角：右键拖动后 target 是否移动、是否被钳制、重置是否复位。
// 用法: node tools/check-pan-live.mjs <url>
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 760 });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));

await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });
await new Promise(r => setTimeout(r, 600));

const read = () => page.evaluate(() => {
  const c = window.__LAB.controls();
  const t = c.target, p = c.object.position;
  return {
    target: [+t.x.toFixed(2), +t.y.toFixed(2), +t.z.toFixed(2)],
    camPos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
    enablePan: c.enablePan,
    screenSpacePanning: c.screenSpacePanning,
    buttons: { LEFT: c.mouseButtons.LEFT, MIDDLE: c.mouseButtons.MIDDLE, RIGHT: c.mouseButtons.RIGHT },
  };
});

const before = await read();
console.log('初始    ', JSON.stringify(before));

// 在画布中间右键拖动
const box = await page.evaluate(() => {
  const el = document.querySelector('canvas');
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width * 0.6, y: r.y + r.height * 0.5 };
});
await page.mouse.move(box.x, box.y);
await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + i * 12, box.y + i * 6);
await page.mouse.up({ button: 'right' });
await new Promise(r => setTimeout(r, 500));
const afterDrag = await read();
console.log('右键拖动后', JSON.stringify(afterDrag));

const moved = afterDrag.target.some((v, i) => Math.abs(v - before.target[i]) > 0.02);
const r = Math.hypot(afterDrag.target[0], afterDrag.target[2]);
const inClamp = r <= 8.05 && afterDrag.target[1] >= -0.05 && afterDrag.target[1] <= 8.05;

// 越界钳制：直接把 target 推到很远
const clamped = await page.evaluate(async () => {
  const c = window.__LAB.controls();
  c.target.set(50, -30, 50);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return [+c.target.x.toFixed(2), +c.target.y.toFixed(2), +c.target.z.toFixed(2)];
});
console.log('强设(50,-30,50)后', JSON.stringify(clamped));

// 点重置
const resetBtn = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '重置');
  if (!b) return false;
  b.click();
  return true;
});
await new Promise(r => setTimeout(r, 1200));
const afterReset = await read();
console.log('重置后  ', JSON.stringify(afterReset));

const backDelta = Math.max(...afterReset.target.map((v, i) => Math.abs(v - before.target[i])));
console.log('');
console.log('enablePan        ', before.enablePan);
console.log('screenSpacePan   ', before.screenSpacePanning);
console.log('键位 LEFT/MID/RIGHT', JSON.stringify(before.buttons), '(0=旋转 1=推拉 2=平移)');
console.log('右键拖动生效      ', moved ? 'PASS' : 'FAIL');
console.log('拖动后仍在钳制内   ', inClamp ? 'PASS' : `FAIL r=${r.toFixed(2)} y=${afterDrag.target[1]}`);
console.log('越界被钳回        ', Math.hypot(clamped[0], clamped[2]) <= 8.05 && clamped[1] >= 0 ? 'PASS' : 'FAIL');
console.log('重置复位          ', resetBtn ? (backDelta < 0.05 ? 'PASS' : `FAIL Δ=${backDelta.toFixed(2)}`) : 'FAIL 找不到重置按钮');
console.log('页面报错          ', errors.length ? errors.slice(0, 3) : 0);

await browser.close();