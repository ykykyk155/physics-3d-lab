// audioAt 探针：三个声学场景的参数联动校验。
// 断言：形状合法、gain∈(0,1]、无 NaN；改参数时 freq / interval / filterHz / gain 必须按预期方向变；
// 真空（气压 0）必须返回 null；非声学场景必须返回 null（不许误发声）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18114;
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
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
await page.setViewport({ width: 1420, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const set = (id, kv) => page.evaluate(({ id, kv }) => {
  const exp = window.__LAB.current().exp;
  for (const k in kv) exp.onParam(k, kv[k]);
  return exp.audioAt(0);
}, { id, kv });

const sw = id => page.evaluate(i => window.__LAB.switch(i), id);

let fails = 0;
const check = (name, cond, detail) => {
  if (!cond) fails++;
  console.log(`[${cond ? ' ok ' : 'FAIL'}] ${name}${detail ? '  ' + detail : ''}`);
};
const shapeOk = o => o && typeof o === 'object' && ['tone', 'noise', 'pulse'].includes(o.mode)
  && Number.isFinite(o.gain) && o.gain > 0 && o.gain <= 1
  && ['freq', 'interval', 'filterHz'].every(k => o[k] == null || Number.isFinite(o[k]));

/* ---------- C2 音调 / 响度 / 音色 ---------- */
await sw('C2-sound-chars'); await sleep(800);
const c2a = await set('C2', { freq: 440, amp: 50, wave: 'sine' });
check('C2 基准形状', shapeOk(c2a) && c2a.mode === 'tone', JSON.stringify(c2a));
const c2b = await set('C2', { freq: 880 });
check('C2 音调翻倍 → freq 翻倍', c2b.freq === 880, `${c2a.freq} → ${c2b.freq}`);
const c2c = await set('C2', { amp: 90 });
check('C2 响度变大 → gain 变大', c2c.gain > c2b.gain, `${c2b.gain.toFixed(3)} → ${c2c.gain.toFixed(3)}`);
const c2d = await set('C2', { wave: 'square' });
check('C2 音色→方波', c2d.wave === 'square', c2d.wave);
const c2e = await set('C2', { wave: 'saw' });
check('C2 音色→锯齿', c2e.wave === 'sawtooth', c2e.wave);
const c2f = await set('C2', { wave: 'noise' });
check('C2 音色→噪声走 noise 模式', c2f.mode === 'noise' && Number.isFinite(c2f.filterHz), JSON.stringify(c2f));
const c2g = await set('C2', { wave: 'sine', amp: 0 });
check('C2 振幅 0 → 静音(null)', c2g === null, String(c2g));

/* ---------- C1 介质 / 距离 / 气压 ---------- */
await sw('C1-sound-medium'); await sleep(800);
const c1air = await set('C1', { medium: '340', dist: 1, pressure: 101.3 });
check('C1 空气形状', shapeOk(c1air) && c1air.mode === 'pulse', JSON.stringify(c1air));
const c1water = await set('C1', { medium: 1500 });
check('C1 空气→水：间隔变密', c1water.interval < c1air.interval, `${c1air.interval.toFixed(3)}s → ${c1water.interval.toFixed(3)}s`);
const c1steel = await set('C1', { medium: 5200 });
check('C1 水→钢：再变密', c1steel.interval < c1water.interval, `${c1water.interval.toFixed(3)}s → ${c1steel.interval.toFixed(3)}s`);
const c1far = await set('C1', { medium: '340', dist: 3 });
check('C1 距离变远 → 间隔变疏', c1far.interval > c1air.interval, `${c1air.interval.toFixed(3)}s → ${c1far.interval.toFixed(3)}s`);
const c1vac = await set('C1', { pressure: 0 });
check('C1 真空 → 不发声(null)', c1vac === null, String(c1vac));

/* ---------- C3 降噪 ---------- */
await sw('C3-noise-control'); await sleep(800);
const c3off = await set('C3', { material: 0, level: 80 });
check('C3 未降噪形状', shapeOk(c3off) && c3off.mode === 'noise', JSON.stringify(c3off));
const c3on = await set('C3', { material: 20 });
check('C3 降噪后 gain 下降', c3on.gain < c3off.gain, `${c3off.gain.toFixed(3)} → ${c3on.gain.toFixed(3)}`);
check('C3 降噪后低通压低', c3on.filterHz < c3off.filterHz, `${c3off.filterHz}Hz → ${c3on.filterHz}Hz`);
check('C3 降噪后仍可闻（不是静音）', c3on.gain > 0.02, `gain=${c3on.gain.toFixed(3)}`);

/* ---------- 非声学场景不许误发声 ---------- */
for (const id of ['A1-incline-speed', 'F2-boiling', 'D5-power-joule']) {
  await sw(id); await sleep(600);
  const o = await page.evaluate(() => window.__LAB.current().exp.audioAt(0));
  check(`${id} 不发声`, o === null, String(o));
}

await browser.close(); server.close();
console.log(`\n结果：${fails ? fails + ' 项失败' : '全部通过'}；控制台报错 ${errors.length} 条`);
if (errors.length) console.log([...new Set(errors)].slice(0, 3).join(' / '));
process.exit(fails ? 1 : 0);