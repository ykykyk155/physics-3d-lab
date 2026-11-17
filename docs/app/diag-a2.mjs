// 诊断 A2：切换表面材料后，小车是否落在对应跑道
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18177;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) f = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const M = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': M[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1500);

const out = await page.evaluate(async () => {
  const exp = window.__LAB.current().exp;
  const res = [];
  const surfaces = [0.6, 0.3, 0.12, 0.02, 0];
  for (const v of surfaces) {
    exp.onParam('surface', v);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const cart = exp.cartG;
    res.push({
      surface: v,
      selLabel: exp.sel && exp.sel.label,
      cartPos: cart ? [cart.position.x, cart.position.y, cart.position.z].map(n => +n.toFixed(3)) : null,
      cartChildren: cart ? cart.children.length : 0,
      weights: exp.weightG ? exp.weightG.children.length : 0,
      blockY: exp.blockY,
    });
  }
  return res;
});
console.log(JSON.stringify(out, null, 2));

// 两张对比截图
for (const [name, v] of [['towel', 0.6], ['ice', 0.02]]) {
  await page.evaluate(vv => window.__LAB.current().exp.onParam('surface', vv), v);
  await sleep(800);
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(ROOT, 'diag-A2-' + name + '.png') });
  console.log('shot', name);
}
await browser.close(); server.close();
