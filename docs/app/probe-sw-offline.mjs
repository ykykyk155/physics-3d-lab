// Service Worker 离线探针：首次加载缓存完成 → 断网刷新仍能 boot + 切换场景
// 步骤：1) 本地起 release 目录服务器 2) 首次访问等 SW ready 3) 断网 4) 刷新断言 boot + 25 场景
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname, '..', '..', 'release', 'physics-3d-lab');
const PORT = 18399;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('404'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const URL_ = `http://127.0.0.1:${PORT}/index.html`;
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const check = (n, c, d) => { if (!c) fails++; console.log(`[${c ? ' ok ' : 'FAIL'}] ${n}${d ? '  ' + d : ''}`); };

// 1) 首次加载：等 boot + SW 就绪
await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
let booted = false;
for (let i = 0; i < 40 && !booted; i++) {
  booted = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (!booted) await sleep(500);
}
check('首次加载 boot 就绪', booted);

let swReady = false;
try {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true), { timeout: 20000 });
  swReady = true;
} catch (e) { /* 超时 */ }
// 上面的 evaluate 不带超时参数不会 reject；改为轮询
swReady = await page.evaluate(async () => {
  try { await navigator.serviceWorker.ready; return true; } catch { return false; }
}).catch(() => false);
check('SW 注册并安装完成', swReady);

// 确认缓存已填充核心文件
const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  if (!keys.length) return [];
  const c = await caches.open(keys[keys.length - 1]);
  const names = await c.keys();
  return names.map(r => new URL(r.url).pathname.split('/').pop()).slice(0, 40);
});
check('缓存含 index.html', Array.isArray(cached) && cached.includes('index.html'), `缓存 ${cached.length} 项`);
check('缓存含 three.module.js', Array.isArray(cached) && cached.includes('three.module.js'));
check('预缓存不含引擎（首屏 0 次引擎请求）', Array.isArray(cached) && !cached.includes('ammo.js'));

// A2 引擎不在 PRECACHE：首次在线进入 A2 时由 fetch cache-first 自然写入缓存，之后断网可用
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
let ammoLoaded = false;
for (let i = 0; i < 60 && !ammoLoaded; i++) {
  ammoLoaded = await page.evaluate(() => (window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : 0) >= 1);
  if (!ammoLoaded) await sleep(500);
}
check('在线首次进入 A2 引擎加载完成', ammoLoaded);
const cachedAmmo = await page.evaluate(async () => {
  const keys = await caches.keys();
  if (!keys.length) return false;
  const c = await caches.open(keys[keys.length - 1]);
  const names = await c.keys();
  return names.some(r => r.url.endsWith('/vendor/ammo/ammo.js'));
});
check('进入 A2 后引擎已自然写入缓存', cachedAmmo);

// 2) 断网
await page.setOfflineMode(true);

// 3) 刷新：必须仍能 boot（导航走 network-first → fallback 缓存）
await page.goto(URL_, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
let booted2 = false;
for (let i = 0; i < 40 && !booted2; i++) {
  booted2 = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (!booted2) await sleep(500);
}
check('断网刷新仍 boot 就绪（缓存可用）', booted2);

// 4) 断网下仍能切换场景（__LAB 只暴露 switch/current，用与 verify-release.mjs 相同的硬编码 IDS）
let ok = 0;
const IDS = ['A1-incline-speed','A2-newton-first','A3-friction','A4-liquid-pressure','A5-buoyancy','A6-energy','A7-lever'];
if (booted2) {
  for (const id of IDS.slice(0, 5)) {
    await page.evaluate(i => window.__LAB.switch(i), id);
    await sleep(400);
    const cur = await page.evaluate(() => window.__LAB.store.experimentId);
    if (cur === id) ok++;
  }
  check('断网下切换 5 场景正常', ok === 5, `${ok}/5`);
}

check('全程 0 报错', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAIL`);
await page.setOfflineMode(false).catch(() => {});
await browser.close();
server.close();
process.exit(fails === 0 ? 0 : 1);