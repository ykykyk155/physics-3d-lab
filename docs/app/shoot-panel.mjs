// 统计面板视觉复核：整页截图（含右侧面板与播放条），检查面板是否遮挡 3D 内容、读数渲染是否正常。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18108;
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

const outDir = path.join(ROOT, 'shots');
const shots = ['B5-convex-lens', 'C3-noise-control', 'A4-liquid-pressure', 'C2-sound-chars'];
for (const id of shots) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(1500);
  await page.screenshot({ path: path.join(outDir, 'panel-' + id + '.png') });
  // 量一下面板与视区是否重叠
  const geo = await page.evaluate(() => {
    const r = el => { const b = el && el.getBoundingClientRect(); return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
    const vp = document.getElementById('viewport');
    let panel = null, best = 0;
    document.querySelectorAll('aside,section,div').forEach(el => {
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (b.width > 150 && b.width < 420 && b.height > 200 && cs.position !== 'static' && /panel|stat|readout/i.test(el.id + ' ' + el.className)) {
        if (b.width * b.height > best) { best = b.width * b.height; panel = el; }
      }
    });
    return { viewport: r(vp), panel: r(panel), panelId: panel ? (panel.id || panel.className) : null };
  });
  console.log(id, JSON.stringify(geo));
}

await browser.close(); server.close();