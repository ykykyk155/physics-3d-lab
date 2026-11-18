// 最小诊断：全新页面首进 A2，逐 60ms 记录 ammoLoad 状态与 ammoRequests
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18105;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox',
         '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
console.log('after reload injects:', await page.evaluate(() => window.__LAB.ammoRequests()));
page.evaluate(() => window.__LAB.switch('A2-newton-first')).catch(e => console.log('switch threw', e.message));
const trace = [];
for (let i = 0; i < 30; i++) {
  trace.push(await page.evaluate(() => ({
    t: Math.round(performance.now()),
    ov: (() => { const o = document.getElementById('ammoLoad'); return o ? o.style.display : 'absent'; })(),
    n: window.__LAB.ammoRequests(),
    scene: window.__LAB.store.experimentId,
  })));
  await new Promise(r => setTimeout(r, 60));
}
console.log(trace.map(x => `${x.t}ms ov=${x.ov} n=${x.n} scene=${x.scene}`).join('\n'));
await browser.close(); server.close();
