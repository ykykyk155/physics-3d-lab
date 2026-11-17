// 全量巡检 + flush 计数：定位 C2 参数 2-5 未送达的确切机制
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18094;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json' };
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGE-EXC:', String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text().slice(0, 200)); });
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const ids = await page.evaluate(() => {
  const M = ['mechanics','electricity','optics','acoustics','thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(800);
  const rows = await page.evaluate(async (id) => {
    const L = window.__LAB, meta = L.DATA().byId[id];
    const exp = L.current().exp;
    const orig = exp.onParam.bind(exp);
    let count = 0;
    exp.onParam = (k, v) => { try { orig(k, v); count++; } catch (e) { log.push('THREW ' + k + ': ' + e.message); } };
    const log = [];
    const out = [];
    for (const p of meta.params) {
      const blk = document.querySelector('.param-block[data-pid="' + p.id + '"]');
      const f0 = L.flushes || 0;
      const before = count;
      if (p.type === 'enum') {
        const cur = String(L.store.params[p.id]);
        const t = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid !== cur);
        if (t) t.click();
      } else {
        const input = blk.querySelector('input[type=range]');
        const lo = parseFloat(input.min), hi = parseFloat(input.max), cur = parseFloat(input.value);
        const v = Math.abs(cur - lo) < 1e-9 ? hi : lo;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const f1 = L.flushes || 0;
      out.push(`${p.id}: d=${count - before} flushes+${f1 - f0} pend=[${L.pendingKeys().join(',')}] expSame=${L.current().exp === exp}`);
    }
    exp.onParam = orig;
    return out;
  }, id);
  const bad = rows.filter(r => !r.includes('d=1') && !r.includes('d=2') && !r.includes('d=3'));
  if (bad.length) {
    console.log('=== ' + id + ' ===');
    rows.forEach(r => console.log('  ' + r));
  }
}
console.log('TOUR DONE');
await browser.close(); server.close();
