// A2 / F1 时间轴验收图：走真实 UI 路径（驱动时间条 #timeRange）定格到指定时刻
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18123;
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

const grab = async (name) => {
  await sleep(420);
  await page.evaluate(() => { const r = window.__LAB.renderer(), c = window.__LAB.camera(), s = window.__LAB.current().scene; if (s) r.render(s, c); });
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(ROOT, 'shots', 'all', name + '.png') });
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  const label = await page.evaluate(() => document.querySelector('#tbTime') && document.querySelector('#tbTime').textContent);
  console.log(name, JSON.stringify(info), '| tb:', label);
};
// 真实拖时间条路径：写值 + 派发 input（等于学生拖动）
const scrub = (t) => page.evaluate(tt => {
  const inp = document.querySelector('#timeRange');
  inp.value = tt;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}, t);

// ---- A2（短过程，duration 3.4s）----
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(800);
const setA2 = async (surface, t) => { await page.evaluate(s => window.__LAB.current().exp.onParam('surface', s), surface); await scrub(t); };
await setA2(0.6, 0);      await grab('A2-towel-t0');            // 毛巾：坡顶起始
await setA2(0.6, 3.4);    await grab('A2-towel');               // 毛巾：出坡后滑 0.25m 停住
await setA2(0.02, 3.4);   await grab('A2-ice');                 // 冰面：同一时刻已滑 7.5m
await setA2(0.3, 1.9);    await grab('A2-newton-first');        // 默认棉布：出坡进平面
await setA2(0, 20);       await grab('A2-smooth-20s');          // 理想光滑：20s 观察窗末端停在边界

// ---- F1（解析型，duration 600s，8× 播放）----
await page.evaluate(() => window.__LAB.switch('F1-melting-curve'));
await sleep(800);
await scrub(180);  await grab('F1-t180');                        // 升温段
await scrub(300);  await grab('F1-t300');                        // 熔化平台 0℃
await scrub(560);  await grab('F1-melting-curve');               // 熔完继续升温

console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 6)));
await browser.close(); server.close();