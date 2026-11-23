import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = Number(process.env.PANPORT || 18132);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json' };
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
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
await new Promise(r => setTimeout(r, 900));
const cam0 = await page.evaluate(`(() => { const t = window.__LAB.controls().target; return { x: t.x, y: t.y, z: t.z }; })()`);
const cbox = await page.evaluate(`(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
await page.mouse.move(cbox.x, cbox.y);
await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 12; i++) await page.mouse.move(cbox.x + 12 * i, cbox.y - 7 * i);
await page.mouse.up({ button: 'right' });
await new Promise(r => setTimeout(r, 500));
const pan = await page.evaluate(`(o => { const t = window.__LAB.controls().target; return { moved: Math.hypot(t.x-o.x, t.y-o.y, t.z-o.z) > 0.01, t: {x:+t.x.toFixed(2), y:+t.y.toFixed(2), z:+t.z.toFixed(2)} }; })(${JSON.stringify(cam0)})`);
console.log('pan:', JSON.stringify(pan));
await browser.close(); server.close();
