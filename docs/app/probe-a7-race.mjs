// A7 竞态回归探针：先进 A2（把引擎缓存好）再进 A7，复现 CEO 抓到的
// `[A7 ammo] TypeError: Cannot read properties of undefined (reading 'toFixed')`。
// 根因：loadAmmo 秒回时外壳 recompute() 还没跑到，A7 的 _render→_syncLabels 读到 t1/t2=undefined。
// 断言：A7 进入后 _physReady、无 [A7 ammo] / toFixed 报错、图例力矩能显示。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18134;
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
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 200)));
await page.setViewport({ width: 1420, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const check = (n, c, d) => { if (!c) fails++; console.log(`[${c ? ' ok ' : 'FAIL'}] ${n}${d ? '  ' + d : ''}`); };

// 先进 A2：把引擎下载并缓存（A7 之后进入就会命中竞态）
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
let a2Ready = false;
const t0 = Date.now();
while (Date.now() - t0 < 20000) {
  a2Ready = await page.evaluate(() => {
    const e = window.__LAB.current().exp;
    return !!(e && e._impl && e._impl._physReady === true);
  });
  if (a2Ready) break;
  await sleep(100);
}
check('A2 引擎就绪（预热缓存）', a2Ready);

// 立即进 A7——此时 loadAmmo 秒回，正是 CEO 抓到的竞态路径
await page.evaluate(() => window.__LAB.switch('A7-lever'));
let a7Ready = false, durStable = false;
const t1 = Date.now();
while (Date.now() - t1 < 10000) {
  const st = await page.evaluate(() => {
    const e = window.__LAB.current().exp; const i = e && e._impl;
    return { ready: !!(i && i._physReady === true), t1ok: Number.isFinite(i && i.t1) };
  });
  if (st.ready && st.t1ok) { a7Ready = true; durStable = true; break; }
  await sleep(100);
}
check('A7 进入后 _physReady 且 t1 已赋值', a7Ready, a7Ready ? '' : '未就绪或 t1=undefined');

// 图例力矩应能渲染（不再 toFixed undefined）
const lblText = await page.evaluate(() => {
  const e = window.__LAB.current().exp;
  return (e._impl.lbl && e._impl.lbl.element) ? e._impl.lbl.element.textContent : 'NO_LBL';
});
check('A7 力矩图例已渲染且含数字', /F1L1=\d/.test(lblText), lblText.slice(0, 60));

// 无 [A7 ammo] / toFixed 报错
const bad = errors.filter(e => /\[A7 ammo\]|toFixed|_.* is not a function/i.test(e));
check('无 [A7 ammo] / toFixed 报错', bad.length === 0, bad.length ? bad.slice(0, 3).join(' | ') : '无');

await browser.close(); server.close();
console.log(`\n结果：${fails ? fails + ' 项失败' : '全部通过'}`);
process.exit(fails ? 1 : 0);