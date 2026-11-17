// 诊断 C3：参数块结构 + audioAt 对每个参数的响应
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18101;
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
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('C3-noise-control'));
await sleep(900);
const r = await page.evaluate(async () => {
  const L = window.__LAB;
  const meta = L.DATA().byId['C3-noise-control'];
  const raf2 = () => new Promise(r2 => requestAnimationFrame(() => requestAnimationFrame(r2)));
  const read = () => { const e = L.current().exp; return e.audioAt(L.store.simTime); };
  const out = { params: meta.params.map(p => ({ id: p.id, label: p.label, type: p.type, min: p.min, max: p.max, default: p.default })), blocks: [], changes: [] };
  for (const blk of document.querySelectorAll('.param-block')) {
    const s = blk.querySelector('.param-head span');
    out.blocks.push({ pid: blk.dataset.pid, label: s && s.textContent,
      hasRange: !!blk.querySelector('input[type=range]'),
      range: (i => i ? { min: i.min, max: i.max, value: i.value } : null)(blk.querySelector('input[type=range]')),
      segs: [...blk.querySelectorAll('.seg button')].map(b => ({ oid: b.dataset.oid, text: b.textContent })),
      drops: [...blk.querySelectorAll('.dropdown li')].map(b => b.dataset.oid) });
  }
  const spec0 = read();
  for (const p of meta.params) {
    const blk = document.querySelector('.param-block[data-pid="' + p.id + '"]');
    if (!blk) { out.changes.push({ id: p.id, note: '块未渲染' }); continue; }
    const input = blk.querySelector('input[type=range]');
    const before = JSON.stringify(read());
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const to = Math.abs(parseFloat(input.value) - parseFloat(input.min)) < 1e-9 ? input.max : input.min;
      setter.call(input, String(to));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const cand = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid !== String(L.store.params[p.id]));
      if (cand) cand.click(); else { out.changes.push({ id: p.id, note: '无其他档' }); continue; }
    }
    await raf2();
    out.changes.push({ id: p.id, before, after: JSON.stringify(read()) });
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await browser.close(); server.close();
