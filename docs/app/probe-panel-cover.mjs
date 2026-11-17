// 统计面板遮挡量测：把每个场景里「桌面以上」的实体包围盒投影到屏幕坐标，
// 量出内容右边界有没有伸进右侧统计面板（#stats）的矩形里。
// 不把地面网格、台面板算进去——它们本来就铺满画面，被盖住不算问题。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18109;
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
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const measure = () => page.evaluate(() => {
  const vp = document.getElementById('viewport').getBoundingClientRect();
  const panel = document.getElementById('stats');
  const pr = panel ? panel.getBoundingClientRect() : null;
  const cam = window.__LAB.camera();
  const cur = window.__LAB.current();
  cam.updateMatrixWorld(true);
  let maxX = -Infinity, who = '';
  const v = new (Object.getPrototypeOf(cam.position).constructor)();
  cur.scene.updateMatrixWorld(true);
  cur.scene.traverse(o => {
    if (!o.geometry || o.isCSS2DObject || o.type === 'GridHelper') return;
    if (!o.visible) return;
    // 跳过贴在地面上的底板/桌面：取包围盒中心高度判断
    const bb = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
    if (!bb) return;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
      v.applyMatrix4(o.matrixWorld);
      if (v.y < 0.15) continue;                       // 桌面以下的东西不算内容
      v.project(cam);
      if (v.z > 1) continue;
      const sx = vp.x + (v.x * 0.5 + 0.5) * vp.width;
      if (sx > maxX) { maxX = sx; who = o.type + '#' + (o.name || ''); }
    }
  });
  return {
    contentRight: Math.round(maxX),
    panelLeft: pr ? Math.round(pr.left) : null,
    panelRight: pr ? Math.round(pr.right) : null,
    panelOpen: pr ? pr.width > 60 : false,
    viewportRight: Math.round(vp.right),
    who,
  };
});

const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const rows = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  const m = await measure();
  const covered = m.panelOpen && m.contentRight > m.panelLeft;
  rows.push({ id, ...m, covered });
  const flag = covered ? `覆盖 ${m.contentRight - m.panelLeft}px` : 'ok';
  console.log(`[${covered ? 'COVER' : '  ok '}] ${id.padEnd(20)} 内容右边界 ${String(m.contentRight).padStart(4)}  面板左 ${m.panelLeft}  ${flag}`);
}

const bad = rows.filter(r => r.covered);
console.log(`\n被面板遮挡的场景：${bad.length}/${rows.length}` + (bad.length ? ' → ' + bad.map(r => r.id + '(' + (r.contentRight - r.panelLeft) + 'px)').join(', ') : ''));
fs.writeFileSync(path.join(ROOT, 'panel-cover.json'), JSON.stringify(rows, null, 2));
await browser.close(); server.close();