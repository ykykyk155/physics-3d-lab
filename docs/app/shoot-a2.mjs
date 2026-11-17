import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18119;
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
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(700);
const shoot = async (name, surface, t) => {
  await page.evaluate((s, tt) => {
    const exp = window.__LAB.current().exp;
    exp.onParam('surface', s);
    if (typeof exp.seek === 'function') exp.seek(tt);      // 停在指定时刻，便于截到「刚出坡」的姿态
  }, surface, t);
  await sleep(650);
  await page.evaluate(() => {                             // 外壳主循环在改：这里直接渲染一帧取图
    const r = window.__LAB.renderer(), c = window.__LAB.camera(), s = window.__LAB.current().scene;
    if (s) r.render(s, c);
  });
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(ROOT, 'shots', 'all', name + '.png') });
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  console.log(name, JSON.stringify(info));
};
const dur = await page.evaluate(() => window.__LAB.current().exp.duration);
console.log('A2 duration', dur);
await shoot('A2-towel', 0.6, 0);                    // 毛巾：坡顶起始（看坡道是否完整入画）
await shoot('A2-ice', 0.02, dur * 0.55);            // 冰面：滑到中段
await shoot('A2-newton-first', 0.3, dur * 0.42);    // 默认棉布：出坡刚进平面
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 6)));
await browser.close(); server.close();