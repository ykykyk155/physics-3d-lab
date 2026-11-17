// 探针：逐场景稳态采样 calls/tris/geo/tex，两次采样对照 shadow pass 影响；geo=0 异常定位
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18097;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json' };
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ids = await page.evaluate(() => {
  const M = ['mechanics','electricity','optics','acoustics','thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});
const read = () => page.evaluate(() => {
  const r = window.__LAB.renderer();
  return { calls: r.info.render.calls, tris: r.info.render.triangles,
           geo: r.info.memory.geometries, tex: r.info.memory.textures,
           progs: r.info.programs.length, id: window.__LAB.store.experimentId };
});
console.log('id | s1(calls/tris/geo/tex) | s2(+500ms) | geos non0?');
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(800);
  const s1 = await read();
  await sleep(500);
  const s2 = await read();
  console.log(`${id} | ${s1.calls}/${s1.tris}/${s1.geo}/${s1.tex} | ${s2.calls}/${s2.tris}/${s2.geo}/${s2.tex} | ${s2.geo > 0}`);
}
await browser.close(); server.close();
