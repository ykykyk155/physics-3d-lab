// 时间轴接口自检（黑盒）：duration/seek 是否存在、固定 t 是否确定性、乱序 seek 是否 NaN/漂移
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18117;
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

const probe = async (id, reader) => {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  return await page.evaluate((id, readerSrc) => {
    const read = eval('(' + readerSrc + ')');
    const exp = window.__LAB.current().exp;
    const out = { duration: exp.duration, hasSeek: typeof exp.seek === 'function' };
    if (!out.hasSeek || !out.duration) return out;
    const picks = [0, out.duration * 0.13, out.duration * 0.5, out.duration * 0.77, out.duration];
    const snap = () => {
      const s = window.__LAB.current().scene; let bad = false;
      s.traverse(o => { if (o.position && (!Number.isFinite(o.position.x) || !Number.isFinite(o.position.y) || !Number.isFinite(o.position.z))) bad = true; });
      return bad;
    };
    const forward = picks.map(t => { exp.seek(t); return JSON.stringify(read()); });
    // 乱序来回拖：倒序 → 再正序，结果必须与正向逐位相同（无漂移、无累积）
    const backward = picks.slice().reverse().map(t => { exp.seek(t); return JSON.stringify(read()); }).reverse();
    const again = picks.map(t => { exp.seek(t); return JSON.stringify(read()); });
    out.deterministic = JSON.stringify(forward) === JSON.stringify(again) && JSON.stringify(forward) === JSON.stringify(backward);
    out.nan = snap();
    out.samples = picks.map((t, i) => ({ t: +t.toFixed(2), v: forward[i] }));
    return out;
  }, id, reader.toString());
};

const A2_READ = function () {
  let cart = null;
  window.__LAB.current().scene.traverse(o => { if (o.userData && o.userData.cart) cart = o; });
  return cart ? { x: +cart.position.x.toFixed(3), y: +cart.position.y.toFixed(3), rot: +cart.rotation.z.toFixed(3) } : null;
};
const F1_READ = function () { const r = window.__LAB.store.readouts || {}; return { temp: r.temp != null ? +Number(r.temp).toFixed(2) : null }; };

for (const [id, rd] of [['A2-newton-first', A2_READ], ['F1-melting-curve', F1_READ]]) {
  console.log(id, JSON.stringify(await probe(id, rd)));
}
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 8)));
await browser.close(); server.close();