// A2 极端材料行为截图：t0 / 中段 / 冰面末端刹停 / 理想光滑循环（近末端 + 回坡顶）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18201;
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
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
await page.setViewport({ width: 1420, height: 700 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await sleep(1200);
// 暂停播放循环，否则 animate 每帧 step 会与 seek 抢时间轴（探针同款处理）
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await sleep(200);

const state = () => page.evaluate(() => {
  const e = window.__LAB.current().exp;
  const c = window.__LAB.current().scene.getObjectByName('A2-cart');
  const d = window.__LAB.current().exp.duration;
  return { dur: d, x: c.position.x.toFixed(2), y: c.position.y.toFixed(3) };
});

// 1) 默认棉布 t0（坡顶）
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.3); e.onParam('height', 0.35); });
await sleep(300);
await page.evaluate(() => window.__LAB.current().exp.seek(0));
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-ext-t0.png') });
console.log('t0', await state());

// 2) 中段（棉布滑行中）
await page.evaluate(() => window.__LAB.current().exp.seek(1.8));
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-ext-mid.png') });
console.log('mid', await state());

// 3) 冰面 μ=0.02 末端刹停
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.02); e.onParam('height', 0.35); });
await sleep(300);
const di = await page.evaluate(() => window.__LAB.current().exp.duration);
await page.evaluate(dd => window.__LAB.current().exp.seek(dd), di);
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-ext-ice-end.png') });
console.log('ice-end', await state());

// 4) 理想光滑 μ=0：近末端（尚未瞬移；单程≈4.24s 到末端，4.15s 在末端前 0.09s）
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0); e.onParam('height', 0.35); });
await sleep(400);
await page.evaluate(() => window.__LAB.current().exp.seek(4.15));
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-ext-loop-near-end.png') });
console.log('near-end', await state());

// 5) 理想光滑 μ=0：回坡顶（4.24s 瞬移回坡顶后 0.08s，坡顶重新下滑）
await page.evaluate(() => window.__LAB.current().exp.seek(4.32));
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-ext-loop-restart.png') });
console.log('restart', await state());

// 6) 穿模走查：圆弧过渡瞬间（θ=atan(0.35/2)≈9.9°，t_foot=√(2·2.0/(9.8·sinθ))≈1.54s 车到坡脚圆弧处）
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.3); e.onParam('height', 0.35); });
await sleep(300);
await page.evaluate(() => window.__LAB.current().exp.seek(1.55));
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-walk-arc.png') });
console.log('arc', await state());

// 7) 穿模走查：木板停到最远（μ=0.12，停止位 x≈XF0+2.94）
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('surface', 0.12); e.onParam('height', 0.35); });
await sleep(300);
const dw = await page.evaluate(() => window.__LAB.current().exp.duration);
await page.evaluate(dd => window.__LAB.current().exp.seek(dd), dw);
await sleep(300);
await page.screenshot({ path: path.join(ROOT, 'shots', 'a2-walk-wood-stop.png') });
console.log('wood-stop', await state());

console.log('errs', errs.length ? errs.join(' | ') : 'none');
await browser.close(); server.close();