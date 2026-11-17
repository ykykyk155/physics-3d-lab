// 25 场景快速冒烟：逐个切换，收集控制台错误 + 稳态 calls/tris
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18111;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { const alt = path.join(ROOT, '..', p); if (fs.existsSync(alt)) file = alt; else { res.writeHead(404); res.end(); return; } }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const IDS = ['A1-incline-speed','A2-newton-first','A3-friction','A4-liquid-pressure','A5-buoyancy','A6-energy','A7-lever','B1-pinhole','B2-reflection','B3-plane-mirror','B4-refraction','B5-convex-lens','C1-sound-medium','C2-sound-chars','C3-noise-control','D1-series-parallel','D2-resistance-factor','D3-rheostat-lamp','D4-ohm-law','D5-power-joule','D6-magnet-solenoid','D7-motor-generator','F1-melting-curve','F2-boiling','F3-heat-engine'];
let maxCalls = 0, maxTris = 0, worst = '';
let over = [];
for (const id of IDS) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(900);
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  if (info.calls > maxCalls) { maxCalls = info.calls; }
  if (info.tris > maxTris) { maxTris = info.tris; worst = id; }
  if (info.calls > 60 || info.tris >= 200000) over.push({ id, ...info });
}
console.log('MAX', maxCalls, maxTris, worst);
console.log('OVER', JSON.stringify(over));
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 10)));
await browser.close(); server.close();
