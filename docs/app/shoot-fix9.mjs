// 返工 9 格重截：D6 D7 C1 A2 D4 B4 D2 D5 F1
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18109;
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
const IDS = ['D6-magnet-solenoid', 'D7-motor-generator', 'C1-sound-medium', 'A2-newton-first', 'D4-ohm-law', 'B4-refraction', 'D2-resistance-factor', 'D5-power-joule', 'F1-melting-curve'];
const outDir = path.join(ROOT, 'shots', 'all');
const rows = [];
for (const id of IDS) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(1500);
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(outDir, id + '.png') });
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  rows.push({ id, ...info });
  console.log('shot', id, JSON.stringify(info));
}
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 10)));
fs.writeFileSync(path.join(ROOT, 'fix9-stats.json'), JSON.stringify(rows, null, 2));
await browser.close(); server.close();
