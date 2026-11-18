// 验证 loadAmmo 修复：resolve 的是库对象、注入恰好 1 次、遮罩消失、World 能真的创建并步进
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18103;
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
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox',
         '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const r = await page.evaluate(async () => {
  const out = {};
  const lib = await window.__LAB.loadAmmo();
  out.libType = typeof lib;
  out.hasBtWorld = !!(lib && lib.btDefaultCollisionConfiguration);
  const lib2 = await window.__LAB.loadAmmo();          // 二次调用必须直接返回缓存
  out.cachedSame = lib2 === lib;
  out.injections = window.__LAB.ammoRequests();
  out.overlayGone = !document.getElementById('ammoLoad') || document.getElementById('ammoLoad').style.display === 'none';
  // 真实创建世界步进一步，确认库可用（bridge 的前置）
  const w = new lib.btDefaultCollisionConfiguration();
  const disp = new lib.btCollisionDispatcher(w);
  const broadphase = new lib.btDbvtBroadphase();
  const solver = new lib.btSequentialImpulseConstraintSolver();
  const world = new lib.btDiscreteDynamicsWorld(disp, broadphase, solver, w);
  world.setGravity(new lib.btVector3(0, -9.8, 0));
  out.worldStepped = world.stepSimulation(1 / 60, 1, 1 / 60);
  return out;
});
console.log(JSON.stringify(r));
await browser.close(); server.close();
