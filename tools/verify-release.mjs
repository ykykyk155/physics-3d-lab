// 发布包验收：以 release/physics-3d-lab 为唯一根目录，不带任何回退。
// 目的：真机验证「整目录能独立静态部署」——缺一个文件就会 404，跑不通即拦下。
// 用法: node tools/verify-release.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

// 可选参数：指定发布根目录（用于验证「解压后的 zip」而不是源目录）
const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(import.meta.dirname, '..', 'release', 'physics-3d-lab');
const PORT = 18321;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`NO RELEASE: ${ROOT}`);
  process.exit(2);
}

const notFound = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  // 严格限制：不越出 ROOT，也不回退到任何父目录
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

let ready = false;
try {
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
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

console.log('ROOT      ', ROOT);
console.log('READY     ', ready);
console.log('SCENARIOS ', `${ok}/25`);
console.log('MAX       ', maxCalls, 'calls /', maxTris, 'tris  worst =', worst);
console.log('OVER RED  ', JSON.stringify(over));
console.log('404s      ', notFound.length, JSON.stringify([...new Set(notFound)].slice(0, 20)));
console.log('ERRORS    ', errors.length, JSON.stringify([...new Set(errors)].slice(0, 10)));

await browser.close();
server.close();
const pass = ready && ok === 25 && notFound.length === 0 && errors.length === 0 && over.length === 0;
console.log(pass ? 'RESULT    PASS' : 'RESULT    FAIL');
process.exit(pass ? 0 : 1);