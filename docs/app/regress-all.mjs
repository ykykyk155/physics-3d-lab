// 25 场景全量：切换 + 枚举分支 + 控制台错误 + draw call/tris
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18104;
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
const ids = await page.evaluate(() => { const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal']; return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id)); });
const rows = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  // 枚举分支：把每个实验的每个枚举控件逐档切一遍
  await page.evaluate(() => {
    const D = window.__LAB.DATA(); const cur = window.__LAB.current();
    // 从当前实验 schema 拿枚举参数
  });
  const info = await page.evaluate(() => { const r = window.__LAB.renderer(); return { calls: r.info.render.calls, tris: r.info.render.triangles }; });
  rows.push({ id, ...info });
  const bad = info.calls > 60 || info.tris > 200000;
  console.log((bad ? 'FAIL ' : 'ok   ') + id, info.calls + 'c/' + info.tris + 't');
}
// 枚举分支遍历：切到每个实验后，逐个点击它面板里的每个枚举分段按钮
let enumCount = 0;
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id); await sleep(450);
  const n = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.param-block .seg button, .param-block .dropdown li')];
    for (const b of btns) { try { b.click(); } catch (e) {} }
    return btns.length;
  });
  enumCount += n;
}
console.log('ENUM_CLICKS', enumCount);
console.log('ERRORS', errors.length);
errors.slice(0, 20).forEach(e => console.log('  ERR', e));
const maxCalls = Math.max(...rows.map(r => r.calls));
const maxTris = Math.max(...rows.map(r => r.tris));
console.log('MAXCALLS', maxCalls, 'MAXTRIS', maxTris);
fs.writeFileSync(path.join(ROOT, 'all-regress.json'), JSON.stringify({ rows, errors }, null, 2));
await browser.close(); server.close();
