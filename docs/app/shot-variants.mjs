// 变体抽查：B5 source=candle / cover=half，D1 switch=off，A2 mass=1
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18105;
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
const outDir = path.join(ROOT, 'shots', 'v2');
async function clickEnum(pid, val) {
  await page.evaluate(({ pid, val }) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    if (!blk) return;
    const b = [...blk.querySelectorAll('.seg button, .dropdown li')].find(n => (n.dataset.oid || n.dataset.value || n.textContent).indexOf(val) >= 0);
    if (b) b.click();
  }, { pid, val });
  await sleep(500);
}
// B5 candle + half
await page.evaluate(() => window.__LAB.switch('B5-convex-lens')); await sleep(1200);
await clickEnum('source', 'candle');
await clickEnum('cover', 'half');
let vp = await page.$('#viewport'); await vp.screenshot({ path: path.join(outDir, 'B5-candle-half.png') });
// D1 switch off
await page.evaluate(() => window.__LAB.switch('D1-series-parallel')); await sleep(1200);
await clickEnum('switch', 'off');
vp = await page.$('#viewport'); await vp.screenshot({ path: path.join(outDir, 'D1-off.png') });
// A2 mass max
await page.evaluate(() => window.__LAB.switch('A2-newton-first')); await sleep(1200);
await page.evaluate(() => { const blk=document.querySelector('.param-block[data-pid="mass"]'); const inp=blk&&blk.querySelector('input[type=range]'); if(inp){inp.value=inp.max; inp.dispatchEvent(new Event('input',{bubbles:true}));} });
await sleep(600);
vp = await page.$('#viewport'); await vp.screenshot({ path: path.join(outDir, 'A2-massmax.png') });
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0,5)));
await browser.close(); server.close();
