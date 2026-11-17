// C2 定点诊断：onParam 调用是否抛错、current.exp 引用是否稳定、rAF 是否存活
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18095;
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
page.on('console', m => { if (m.type() === 'error') console.log('PAGE-ERR:', m.text().slice(0, 260)); });
page.on('pageerror', e => console.log('PAGE-EXC:', String(e).slice(0, 260)));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('C2-sound-chars'));
await sleep(900);
const out = await page.evaluate(async () => {
  const L = window.__LAB, meta = L.DATA().byId['C2-sound-chars'];
  const exp = L.current().exp;
  const log = [];
  const orig = exp.onParam.bind(exp);
  let ok = 0, err = 0;
  exp.onParam = (k, v) => { try { orig(k, v); ok++; } catch (e) { err++; log.push('onParam(' + k + ') threw: ' + e.message); } };
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  for (const p of meta.params) {
    const blk = document.querySelector('.param-block[data-pid="' + p.id + '"]');
    const before = ok;
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
    await raf2();
    log.push(`${p.id}: okDelta=${ok - before} errDelta=${err} store=${JSON.stringify(L.store.params[p.id])} expSame=${L.current().exp === exp}`);
  }
  return log;
});
console.log(out.join('\n'));
await browser.close(); server.close();
