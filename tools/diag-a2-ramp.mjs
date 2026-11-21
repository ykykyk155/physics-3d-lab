// A2 斜坡旋转 & 小车是否下滑的诊断
import puppeteer from 'puppeteer-core';
const url = process.argv[2] || 'http://127.0.0.1:8941/app/index.html';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 760 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await page.waitForFunction(() => {
  const e = window.__LAB.current();
  return e && e._physReady;
}, { timeout: 60000 });
await new Promise(r => setTimeout(r, 500));

const dump = await page.evaluate(() => {
  const e = window.__LAB.current();
  const phys = e._phys;
  const out = { bodies: [], t: e.t, H_ramp: e.H_ramp, theta: e.theta, RL: e.RL, XF0: e.XF0 };
  phys.bodies.forEach((rec, i) => {
    const tr = rec.motionState.getWorldTransform();
    const o = tr.getOrigin(), q = tr.getRotation();
    out.bodies.push({
      i,
      mass: rec.body.getMass(),
      pos: [+o.x().toFixed(3), +o.y().toFixed(3), +o.z().toFixed(3)],
      quat: [+q.x().toFixed(4), +q.y().toFixed(4), +q.z().toFixed(4), +q.w().toFixed(4)],
      shape: rec.shape && rec.shape.getShapeType ? rec.shape.getShapeType() : '?',
      hasMesh: !!rec.mesh,
    });
  });
  return out;
});
console.log('A2 参数', JSON.stringify({ H: dump.H_ramp, theta_deg: +(dump.theta * 180 / Math.PI).toFixed(2), RL: dump.RL, XF0: dump.XF0 }));
console.log('刚体清单:');
for (const b of dump.bodies) console.log(' ', JSON.stringify(b));

// 播放看车动不动
const track = [];
for (const t of [0, 0.5, 1, 1.5, 2, 2.5, 3]) {
  await page.evaluate(tt => window.__LAB.current().seek(tt), t);
  await new Promise(r => setTimeout(r, 120));
  const p = await page.evaluate(() => {
    const e = window.__LAB.current();
    const cart = e._phys.bodies.find(r => r.mesh && r.mesh.parent && r.mesh.parent.name === 'A2-cart') || e._phys.bodies.find(r => r.mesh);
    const tr = cart.motionState.getWorldTransform();
    const o = tr.getOrigin();
    return { x: +o.x().toFixed(3), y: +o.y().toFixed(3), t: +e.t.toFixed(2) };
  });
  track.push({ seek: t, ...p });
}
console.log('\nseek 序列下的车位置:');
for (const r of track) console.log(' ', JSON.stringify(r));
console.log('\nERRORS', errs.length, errs.slice(0, 3));
await browser.close();
