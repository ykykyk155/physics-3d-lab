// 发布包验收：无头浏览器逐个切换 25 个场景，断言 0 个 404、0 个报错、绘制预算不超红线。
//
// 用法:
//   node tools/verify-release.mjs                      # 验本地 release/physics-3d-lab（严格根目录，无回退）
//   node tools/verify-release.mjs <目录>               # 验任意本地目录（如解压后的 zip）
//   node tools/verify-release.mjs https://xxx/         # 验线上站点
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ARG = process.argv[2];
const REMOTE = ARG && /^https?:/i.test(ARG) ? ARG.replace(/\/+$/, '') : null;
const ROOT = REMOTE
  ? null
  : (ARG ? path.resolve(ARG) : path.resolve(import.meta.dirname, '..', 'release', 'physics-3d-lab'));
const PORT = 18321;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

if (!REMOTE && !fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`NO RELEASE: ${ROOT}`);
  process.exit(2);
}

// 本地模式：严格以 ROOT 为根，不回退到父目录——缺文件必须暴露成 404
const notFound = [];
let server = null;
if (!REMOTE) {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      notFound.push(p);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
}

const BASE = REMOTE || `http://127.0.0.1:${PORT}`;

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
// 远程模式下的 HTTP 错误与网络失败，本地模式由服务器自己记录
page.on('response', r => { if (r.status() >= 400) notFound.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', r => {
  const f = r.failure();
  errors.push(`REQFAIL ${r.url()} ${f ? f.errorText : ''}`);
});

let ready = false;
try {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });
  ready = true;
} catch (e) {
  console.log('READY FAIL', String(e).slice(0, 300));
}

const IDS = ['A1-incline-speed','A2-newton-first','A3-friction','A4-liquid-pressure','A5-buoyancy','A6-energy','A7-lever','B1-pinhole','B2-reflection','B3-plane-mirror','B4-refraction','B5-convex-lens','C1-sound-medium','C2-sound-chars','C3-noise-control','D1-series-parallel','D2-resistance-factor','D3-rheostat-lamp','D4-ohm-law','D5-power-joule','D6-magnet-solenoid','D7-motor-generator','F1-melting-curve','F2-boiling','F3-heat-engine'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, maxCalls = 0, maxTris = 0, worst = '', over = [];
if (ready) {
  for (const id of IDS) {
    try {
      await page.evaluate(i => window.__LAB.switch(i), id);
      await sleep(700);
      const info = await page.evaluate(() => {
        const r = window.__LAB.renderer();
        return { calls: r.info.render.calls, tris: r.info.render.triangles };
      });
      ok++;
      if (info.calls > maxCalls) maxCalls = info.calls;
      if (info.tris > maxTris) { maxTris = info.tris; worst = id; }
      if (info.calls > 60 || info.tris >= 200000) over.push({ id, ...info });
    } catch (e) {
      errors.push(`SWITCH ${id} FAIL ${String(e).slice(0, 160)}`);
    }
  }
}

console.log('TARGET    ', REMOTE ? BASE : ROOT);
console.log('MODE      ', REMOTE ? 'remote (线上)' : 'local (目录)');
console.log('READY     ', ready);
console.log('SCENARIOS ', `${ok}/25`);
console.log('MAX       ', maxCalls, 'calls /', maxTris, 'tris  worst =', worst);
console.log('OVER RED  ', JSON.stringify(over));
console.log('404s      ', notFound.length, JSON.stringify([...new Set(notFound)].slice(0, 20)));
console.log('ERRORS    ', errors.length, JSON.stringify([...new Set(errors)].slice(0, 10)));

await browser.close();
if (server) server.close();
const pass = ready && ok === 25 && notFound.length === 0 && errors.length === 0 && over.length === 0;
console.log(pass ? 'RESULT    PASS' : 'RESULT    FAIL');
process.exit(pass ? 0 : 1);