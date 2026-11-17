// B4 全反射分支校验：水→空气下把入射角推到临界角以上，读数应为「全反射」，且不出现 NaN。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18106;
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
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.setViewport({ width: 1420, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('B4-refraction'));
await sleep(800);

for (const set of [
  { pair: 'water-air', incidence: 30, note: '水→空气 · 折射' },
  { pair: 'water-air', incidence: 60, note: '水→空气 · 超临界' },
  { pair: 'glass-air', incidence: 45, note: '玻璃→空气 · 超临界' },
  { pair: 'air-water', incidence: 60, note: '空气→水 · 无论多大都没有临界角' },
]) {
  const out = await page.evaluate(s => {
    const exp = window.__LAB.current().exp;
    exp.onParam('pair', s.pair);
    exp.onParam('incidence', s.incidence);
    const rows = exp.readouts();
    return rows.map(r => `${r.label}=${r.value}${r.unit}`).join(' | ');
  }, set);
  console.log(`[${set.note}] ${out}`);
}

console.log('控制台报错:', errors.length ? errors.slice(0, 3).join(' / ') : '0 条');
await browser.close(); server.close();