// 七个试点场景：截图 + draw call/tris 采样 + 控制台错误收集
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18102;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PILOT = ['A1-incline-speed', 'A3-friction', 'A5-buoyancy', 'B5-convex-lens', 'D1-series-parallel', 'D6-magnet-solenoid', 'F3-heat-engine'];
const outDir = path.join(ROOT, 'shots', 'v2');
fs.mkdirSync(outDir, { recursive: true });

const rows = [];
for (const id of PILOT) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(1300);
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(outDir, id + '.png') });
  const info = await page.evaluate(() => {
    const r = window.__LAB.renderer();
    return r && r.info ? { calls: r.info.render.calls, tris: r.info.render.triangles } : null;
  });
  rows.push({ id, ...info });
  console.log('shot', id, JSON.stringify(info));
}
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 10)));
fs.writeFileSync(path.join(outDir, 'stats.json'), JSON.stringify(rows, null, 2));
await browser.close(); server.close();
