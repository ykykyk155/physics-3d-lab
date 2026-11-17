// 逐场景截图 + 5×5 总览拼图（格内标 id）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18101;
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
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });   // 侧栏占 320，3D 区 = 1100×700，与基准规格一致
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const outDir = path.join(ROOT, 'shots', 'all');
fs.mkdirSync(outDir, { recursive: true });
const only = process.argv[2];
for (const id of ids) {
  if (only && !id.startsWith(only)) continue;
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(1200);
  const vp = await page.$('#viewport');
  await vp.screenshot({ path: path.join(outDir, id + '.png') });
  console.log('shot', id);
}
await browser.close(); server.close();
