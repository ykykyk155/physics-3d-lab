// 性能基准：逐场景采集「稳态 calls」「播放峰值 calls」「强制阴影重建帧 calls」+ triangles + 单帧耗时。
// 口径：
//   稳态      = 切换完成 800ms、暂停播放、不改参数，连采 30 帧取中位数（每帧真实开销，红线按它判）
//   播放峰值  = 播放态连采 20 帧的最大值（含冲程枚举回写触发的偶发阴影重建，仍应 ≤60）
//   阴影重建  = 手动 shadowMap.needsUpdate=true 后那一帧（峰值参考，不计入红线）
// 稳定性：SwiftShader 长时间跑会崩 Tab，故每 5 个场景重启一次浏览器。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18098;
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });   // 侧栏 320 → 3D 取景区 1100×700
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
  return { browser, page };
}

const sample = (page, n) => page.evaluate((n) => new Promise(res => {
  const r = window.__LAB.renderer();
  const rows = [];
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    rows.push({ calls: r.info.render.calls, tris: r.info.render.triangles, ms: now - last });
    last = now;
    if (rows.length >= n) res(rows); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}), n);

let { browser, page } = await launch();
const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const out = [];
for (let idx = 0; idx < ids.length; idx++) {
  const id = ids[idx];
  if (idx > 0 && idx % 5 === 0) { try { await browser.close(); } catch {} ({ browser, page } = await launch()); }
  try {
    await page.evaluate(i => window.__LAB.switch(i), id);
    await sleep(800);
    await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
    await sleep(250);
    await sample(page, 2);
    const steady = (await sample(page, 30)).slice(1);
    const sorted = steady.map(r => r.calls).sort((a, b) => a - b);
    const sMed = sorted[Math.floor(sorted.length / 2)];
    const sLast = steady[steady.length - 1];
    const sMs = steady.reduce((a, r) => a + r.ms, 0) / steady.length;
    await page.evaluate(() => { window.__LAB.store.playback.playing = true; });
    const pMax = Math.max(...(await sample(page, 20)).map(r => r.calls));
    await page.evaluate(() => { window.__LAB.renderer().shadowMap.needsUpdate = true; });
    const shMax = Math.max(...(await sample(page, 6)).map(r => r.calls));
    out.push({ id, steady: sMed, playMax: pMax, tris: sLast.tris, ms: +sMs.toFixed(1), shadowCalls: shMax });
    console.log(`${id} | 稳态 ${sMed} | 播放峰值 ${pMax} | ${sLast.tris} tris | ${sMs.toFixed(1)}ms | 强制阴影帧 ${shMax}`);
  } catch (e) {
    console.log(`${id} | ERROR ${e.message.slice(0, 60)} — 重启浏览器重试`);
    try { await browser.close(); } catch {}
    ({ browser, page } = await launch());
    try {
      await page.evaluate(i => window.__LAB.switch(i), id);
      await sleep(900);
      await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
      await sleep(250);
      const steady = (await sample(page, 20)).slice(1);
      const sorted = steady.map(r => r.calls).sort((a, b) => a - b);
      const sLast = steady[steady.length - 1];
      const sMs = steady.reduce((a, r) => a + r.ms, 0) / steady.length;
      out.push({ id, steady: sorted[Math.floor(sorted.length / 2)], playMax: null, tris: sLast.tris, ms: +sMs.toFixed(1), shadowCalls: null });
      console.log(`${id} | 稳态 ${sorted[Math.floor(sorted.length / 2)]} (retry)`);
    } catch (e2) { console.log(`${id} | RETRY FAILED ${e2.message.slice(0, 60)}`); }
  }
}
try { await browser.close(); } catch {}
server.close();
fs.writeFileSync(path.join(ROOT, 'bench-raw.json'), JSON.stringify(out, null, 2));
console.log('saved bench-raw.json');
