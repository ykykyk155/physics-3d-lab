// F3 播放态峰值 calls 采样
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18103;
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
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const id = process.argv[2] || 'F3-heat-engine';
await page.evaluate(i => window.__LAB.switch(i), id);
await sleep(1200);
// 触发播放：点击播放按钮
await page.evaluate(() => { const b = document.querySelector('[data-play]') || document.querySelector('.play'); if (b) b.click(); });
let max = 0, maxT = 0, samples = [];
for (let i = 0; i < 40; i++) {
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return r.info.render; });
  samples.push(info.calls); if (info.calls > max) { max = info.calls; maxT = info.triangles; }
  await sleep(100);
}
samples.sort((a, b) => b - a);
console.log(id, 'steady=', samples[samples.length - 1], 'peakCalls=', max, 'peakTris=', maxT, 'top5=', samples.slice(0, 5).join(','));
await browser.close(); server.close();
