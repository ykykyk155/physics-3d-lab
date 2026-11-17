// 诊断：① 布线抽查 FAIL 复现（fade 遮罩竞态？）② 按场景测驻留 heap，定位 12.84% 增幅来源
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18099;
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
         '--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const gcHeap = () => page.evaluate(() => { window.gc && window.gc(); window.gc && window.gc(); return performance.memory.usedJSHeapSize; });

/* ---------- Phase A：布线竞态复现 ---------- */
const probe1 = await page.evaluate(() => {
  const fade = document.getElementById('fade');
  const tab = document.querySelectorAll('#tabs .tab')[1];
  const r = tab.getBoundingClientRect();
  const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { fadeOn: fade.classList.contains('on'), fadePE: getComputedStyle(fade).pointerEvents,
           hit: el ? el.tagName + '.' + (el.className || '') : null };
});
await page.click('#tabs .tab:nth-child(2)');
await sleep(700);
const tabSwitch = await page.evaluate(() => window.__LAB.store.module);
console.log(`[wire] 点击瞬间 fadeOn=${probe1.fadeOn} fadePE=${probe1.fadePE} 命中元素=${probe1.hit} → tabSwitch=${tabSwitch}`);
// 若失败，等 400ms 后重试一次，验证是否纯竞态
if (tabSwitch !== 'electricity') {
  await page.click('#tabs .tab:nth-child(2)');
  await sleep(700);
  const retry = await page.evaluate(() => window.__LAB.store.module);
  console.log(`[wire] 重试（此时 fade 已结束）→ ${retry}`);
}

/* ---------- Phase B：按场景测驻留 heap ---------- */
const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});
const NEUTRAL = 'A2-newton-first';
const rows = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);                                    // build + 全量 onParam
  await sleep(2000);                                   // 播放 2s，让 step/seek 路径都跑到
  const before = await gcHeap();
  await page.evaluate(i => window.__LAB.switch(i), NEUTRAL);
  await sleep(700);
  const after = await gcHeap();
  rows.push({ id, kb: Math.round((after - before) / 1024) });
}
console.log('\n[heap] 离开场景后的驻留增量（gc 后，中性场景=A2）：');
rows.sort((a, b) => b.kb - a.kb).forEach(r => console.log(`  ${r.id.padEnd(20)} ${r.kb > 0 ? '+' : ''}${r.kb} KB`));

/* ---------- Phase C：A2 停留 12s，看闲时是否持续上涨 ---------- */
const t0 = await gcHeap();
const trend = [];
for (let i = 0; i < 6; i++) { await sleep(2000); trend.push(Math.round(((await gcHeap()) - t0) / 1024)); }
console.log(`\n[A2 停留] 每 2s 驻留增量(KB)：${trend.join(', ')}`);

await browser.close(); server.close();
