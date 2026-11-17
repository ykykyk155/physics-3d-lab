// 量真实体验：首屏各阶段耗时 + 每个场景切换耗时。
// 用法: node tools/measure-perf.mjs <url>
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'https://ykykyk155.github.io/physics-3d-lab/';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700 });

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
const loadMs = Date.now() - t0;
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });
const readyMs = Date.now() - t0;

const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType('navigation')[0] || {};
  const paints = {};
  for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime);
  return {
    ttfb: Math.round(n.responseStart || 0),
    domContentLoaded: Math.round(n.domContentLoadedEventEnd || 0),
    loadEvent: Math.round(n.loadEventEnd || 0),
    firstPaint: paints['first-paint'] || null,
    firstContentfulPaint: paints['first-contentful-paint'] || null,
  };
});

console.log(`TARGET ${url}`);
console.log(`  TTFB            ${nav.ttfb} ms`);
console.log(`  first-paint     ${nav.firstPaint} ms`);
console.log(`  first-content   ${nav.firstContentfulPaint} ms`);
console.log(`  DOMContentLoaded ${nav.domContentLoaded} ms`);
console.log(`  load event      ${nav.loadEvent} ms`);
console.log(`  load 返回       ${loadMs} ms`);
console.log(`  __LAB.ready     ${readyMs} ms   <-- 场景可交互`);

const IDS = ['A1-incline-speed','A2-newton-first','A3-friction','A4-liquid-pressure','A5-buoyancy','A6-energy','A7-lever','B1-pinhole','B2-reflection','B3-plane-mirror','B4-refraction','B5-convex-lens','C1-sound-medium','C2-sound-chars','C3-noise-control','D1-series-parallel','D2-resistance-factor','D3-rheostat-lamp','D4-ohm-law','D5-power-joule','D6-magnet-solenoid','D7-motor-generator','F1-melting-curve','F2-boiling','F3-heat-engine'];

console.log('');
console.log('场景切换耗时（switch() 调用 → 下一帧画完）');
const times = [];
for (const id of IDS) {
  const ms = await page.evaluate(async (i) => {
    const t = performance.now();
    window.__LAB.switch(i);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Math.round(performance.now() - t);
  }, id);
  times.push({ id, ms });
}
times.sort((a, b) => b.ms - a.ms);
const avg = Math.round(times.reduce((s, t) => s + t.ms, 0) / times.length);
console.log(`  平均 ${avg} ms   最慢 5 个：`);
for (const t of times.slice(0, 5)) console.log(`     ${String(t.ms).padStart(5)} ms  ${t.id}`);

await browser.close();