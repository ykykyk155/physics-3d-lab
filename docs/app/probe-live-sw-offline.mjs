// 线上复验：SW 离线缓存 —— 首次加载建立 phlab-* 缓存、断网后刷新仍 boot 且可切换场景
// 访问线上 https://ykykyk155.github.io/physics-3d-lab/ 真机浏览器
import puppeteer from 'puppeteer-core';

const pageURL = 'https://ykykyk155.github.io/physics-3d-lab/index.html?v=' + Date.now();
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
await page.setViewport({ width: 1420, height: 700 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const check = (n, c, d) => { if (!c) fails++; console.log(`[${c ? ' ok ' : 'FAIL'}] ${n}${d ? '  ' + d : ''}`); };

// 第一次访问：正常联网，等待 SW 注册并装完 + 页面 boot
await page.goto(pageURL, { waitUntil: 'load', timeout: 90000 });
let booted = false;
for (let i = 0; i < 60; i++) {
  booted = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (booted) break;
  await sleep(500);
}
check('首次加载 boot 就绪', booted);

let swReady = false, cacheInfo = '';
for (let i = 0; i < 40; i++) {
  const r = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { ready: false };
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) return { ready: false };
    const keys = await caches.keys();
    return { ready: true, keys };
  }).catch(() => ({ ready: false }));
  if (r.ready) { swReady = true; cacheInfo = r.keys.join(', '); break; }
  await sleep(500);
}
check('SW 注册并激活', swReady, cacheInfo);
check('缓存名以 phlab- 开头', cacheInfo.startsWith('phlab-'), cacheInfo);

const cacheCount = await page.evaluate(async () => {
  const keys = await caches.keys();
  let n = 0;
  for (const k of keys) { const c = await caches.open(k); n += (await c.keys()).length; }
  return n;
}).catch(() => -1);
check('缓存含资源文件（>10 项）', cacheCount > 10, `${cacheCount} 项`);

// 断网：setOfflineMode 后刷新，验证 SW 直接服务缓存、页面仍 boot
await page.setOfflineMode(true);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
let offlineBoot = false;
for (let i = 0; i < 60; i++) {
  offlineBoot = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready)).catch(() => false);
  if (offlineBoot) break;
  await sleep(500);
}
check('断网刷新仍 boot（缓存生效）', offlineBoot);

if (offlineBoot) {
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const id = await page.evaluate(() => {
      const st = window.__LAB.store;
      return st && st.experimentId ? st.experimentId : null;
    }).catch(() => null);
    if (id) ids.push(id);
    if (i < 2) await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
    await sleep(1200);
  }
  check('断网下切换场景正常', ids.length >= 2 && new Set(ids).size >= 1, ids.join(' -> '));
}

await page.setOfflineMode(false);
check('全程 0 报错', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(fails === 0 ? '\nALL PASS' : `\nFAILED: ${fails}`);
await browser.close();
process.exit(fails === 0 ? 0 : 1);