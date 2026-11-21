// 线上复验：去阴影后 25 场景无报错 + shadowMap.enabled === false
import puppeteer from 'puppeteer-core';
const URL = 'https://ykykyk155.github.io/physics-3d-lab/?v=' + Date.now();
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700 });
await page.setCacheEnabled(false);
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 120000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 120000 });
const shadowOff = await page.evaluate(() => window.__LAB.renderer().shadowMap.enabled === false);
console.log('SHADOW_OFF', shadowOff);
console.log('SHADOW_TYPE', await page.evaluate(() => JSON.stringify(window.__LAB.renderer().shadowMap.type)));
const IDS = ['A1-incline-speed','A2-newton-first','A3-friction','A4-liquid-pressure','A5-buoyancy','A6-energy','A7-lever','B1-pinhole','B2-reflection','B3-plane-mirror','B4-refraction','B5-convex-lens','C1-sound-medium','C2-sound-chars','C3-noise-control','D1-series-parallel','D2-resistance-factor','D3-rheostat-lamp','D4-ohm-law','D5-power-joule','D6-magnet-solenoid','D7-motor-generator','F1-melting-curve','F2-boiling','F3-heat-engine'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let maxCalls = 0, maxTris = 0;
for (const id of IDS) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  if (info.calls > maxCalls) maxCalls = info.calls;
  if (info.tris > maxTris) maxTris = info.tris;
}
console.log('MAX', maxCalls, maxTris);
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 8)));
await browser.close();