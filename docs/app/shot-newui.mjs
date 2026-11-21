// 平台层六件套目检截图（可复跑）：章节视图 / 指导抽屉 / 分步引导 / 三视角预设 / A1 三段记录表 / 安全条
// 用法：node shot-newui.mjs（自起 http 服务 + 无头 Edge，截图落 docs/benchmark/，产物仅人工核对用）
// 说明：一次性补丁器 _patch.cjs 已删（其目标 _diag-segtable.mjs 亦删）；回归以 ui-probe.mjs + acceptance.mjs 为准
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18102;
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
await page.setViewport({ width: 1420, height: 800, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: path.join(ROOT, 'shots', name) });
const out = path.join(ROOT, 'shots');
fs.mkdirSync(out, { recursive: true });

// 1. A1 场景进入，三段记录表
await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await sleep(1500);
await shot('ui-a1-default.png');

// 记录一组
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#panel button')];
  const b = btns.find(x => /记录/.test(x.textContent));
  if (b) b.click();
});
await sleep(400);
await shot('ui-a1-record1.png');

// 改 θ=30 再记一组
await page.evaluate(() => {
  const sliders = [...document.querySelectorAll('#panel input[type=range]')];
  const th = sliders.find(x => /倾角|θ|角度/.test(x.labels?.[0]?.textContent ?? '') || (x.parentElement?.textContent ?? '').includes('倾角'));
  if (th) { th.value = 30; th.dispatchEvent(new Event('input', { bubbles: true })); }
});
await sleep(1200);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#panel button')];
  const b = btns.find(x => /记录/.test(x.textContent));
  if (b) b.click();
});
await sleep(400);
await shot('ui-a1-record2.png');
await page.evaluate(() => window.__LAB.switch('A1-incline-speed') , 0);

// 2. 分步引导 overlay
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const b = btns.find(x => /引导|❓|步骤/.test(x.textContent) || x.title && /引导/.test(x.title));
  if (b) b.click();
});
await sleep(800);
await shot('ui-guide-overlay.png');
// 点下一步几次
for (let i = 0; i < 2; i++) {
  const clicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /下一步/.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  });
  if (!clicked) break;
  await sleep(500);
}
await shot('ui-guide-step2.png');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /✕|关闭|跳过/.test(x.textContent));
  if (b) b.click();
});
await sleep(300);

// 3. 章节视图切换
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('#panel label, #panel .seg, #panel button')];
  const seg = labels.find(x => /课本章节/.test(x.textContent) || /章节/.test(x.textContent));
  if (seg) seg.click();
});
await sleep(800);
await shot('ui-chapter-view.png');
// 切回按模块
await page.evaluate(() => {
  const labels = [...document.querySelectorAll('#panel label, #panel .seg, #panel button')];
  const seg = labels.find(x => /按模块/.test(x.textContent));
  if (seg) seg.click();
});
await sleep(500);

// 4. 指导抽屉
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, #panel [role=button]')];
  const b = btns.find(x => /指导|目标|学案/.test(x.textContent) || (x.title && /指导/.test(x.title)));
  if (b) b.click();
});
await sleep(600);
await shot('ui-guide-drawer.png');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /✕|关闭/.test(x.textContent));
  if (b) b.click();
});
await sleep(300);

// 5. 三视角预设 + 安全条
await shot('ui-presets-safe.png');

console.log('ERRORS:', errs.length ? errs.join(' | ') : '0');
await browser.close(); server.close();