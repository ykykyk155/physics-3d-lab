// 右侧统计面板读数探针：25 场景逐个取 readouts()，校验条数/字段/数值合法性，并检验播放中变化。
// 断言：
//   1) 返回数组、3~6 项、label 非空、unit 为字符串
//   2) value 非 NaN / 非 ±Infinity / 非空串 / 非 undefined
//   3) duration > 0 的场景，播放 1.2s 后至少有一项数值变化（证明是"实时"而不是快照）
//   4) 反复 seek 到同一 t 两次，读数逐位一致（与时间条拖动一致性同一口径）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18105;
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
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const grab = () => page.evaluate(() => {
  const cur = window.__LAB.current();
  return cur && cur.exp && typeof cur.exp.readouts === 'function' ? cur.exp.readouts() : null;
});

let fails = 0;
const rows = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  const dur = await page.evaluate(() => {
    const c = window.__LAB.current();
    return c && c.exp ? c.exp.duration : 0;
  });

  // t = 0 的读数
  await page.evaluate(() => { window.__LAB.current().exp.seek(0); });
  await sleep(60);
  const r0 = await grab();

  const bad = [];
  if (!Array.isArray(r0)) bad.push('readouts 不是数组');
  else {
    if (r0.length < 3 || r0.length > 6) bad.push(`条数 ${r0.length} 越界(3~6)`);
    for (const r of r0) {
      if (!r || typeof r.label !== 'string' || !r.label.trim()) bad.push('label 空');
      const v = r && r.value;
      if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(`「${r.label}」数值非法 ${v}`); }
      else if (typeof v === 'string') { if (!v.trim()) bad.push(`「${r.label}」空字符串`); }
      else bad.push(`「${r.label}」值类型 ${typeof v}`);
      if (r && typeof r.unit !== 'string') bad.push(`「${r.label}」unit 非字符串`);
    }
  }

  // 播放中是否真的在变（duration > 0 才算）
  let changed = null;
  if (Array.isArray(r0) && Number.isFinite(dur) && dur > 0) {
    await page.evaluate(() => { const c = window.__LAB.current(); c.exp.seek(0); });
    const before = await grab();
    await page.evaluate(() => { window.__LAB.store.playback.playing = true; });
    await sleep(1200);
    await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
    const after = await grab();
    changed = JSON.stringify(before) !== JSON.stringify(after);
    if (!changed) bad.push('播放 1.2s 后读数完全没变');
  }

  // seek 确定性：同一 t 两次读数逐位一致
  if (Number.isFinite(dur) && dur > 0) {
    const t = Math.min(dur * 0.4, dur);
    await page.evaluate(tt => { window.__LAB.current().exp.seek(tt); }, t);
    await sleep(40);
    const a = await grab();
    await page.evaluate(tt => { window.__LAB.current().exp.seek(tt); }, t);
    await sleep(40);
    const b = await grab();
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push('同一 t 两次 seek 读数不一致');
  }

  if (bad.length) fails++;
  rows.push({ id, dur, n: Array.isArray(r0) ? r0.length : -1, changed, bad, sample: r0 });
  const mark = bad.length ? 'FAIL' : ' ok ';
  const head = Array.isArray(r0) ? r0.map(r => `${r.label}=${r.value}${r.unit}`).join(' | ') : String(r0);
  console.log(`[${mark}] ${id}  (${Array.isArray(r0) ? r0.length : '?'} 项, dur=${dur})  ${head}`);
  if (bad.length) console.log('        ↳ ' + bad.join('; '));
}

await browser.close();
server.close();

fs.writeFileSync(path.join(ROOT, 'readouts-raw.json'), JSON.stringify(rows, null, 2));
console.log(`\n读数额取自 ${path.join(ROOT, 'readouts-raw.json')}`);
console.log(`结果：${ids.length - fails}/${ids.length} 通过；控制台报错 ${errors.length} 条`);
if (errors.length) console.log('报错样例：', [...new Set(errors)].slice(0, 5).join(' / '));
process.exit(fails ? 1 : 0);