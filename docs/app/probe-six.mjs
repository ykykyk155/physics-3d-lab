// 六个「有 step() 却没接时间轴」场景的判据探针（CEO 定的可验证判据）：
//   把时间轴拖到 t = 0.5×duration，画面是否与 t = 0 不同？
//   - 不同 → 必须有 duration/seek，且 seek 两次结果一致；
//   - 相同 → 才允许归入 static（duration 必须为 0）。
// 「画面」用场景里所有物体的位姿签名近似：位置 + 四元数 + 缩放，四舍五入到 4 位。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18107;
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

// 位姿签名：用世界矩阵（含父节点继承的旋转），只取带几何体的对象，避免 CSS2D 标签干扰。
// 只读局部 position/quaternion 会漏掉「父节点在转、子网格没动」的情况（D7 的线圈就是这种）。
const SIG = () => page.evaluate(() => {
  const cur = window.__LAB.current();
  cur.scene.updateMatrixWorld(true);
  const out = [];
  let n = 0;
  cur.scene.traverse(o => {
    if (!o.geometry || o.isCSS2DObject) return;
    n++;
    const e = o.matrixWorld.elements;
    out.push(n + ':' + Array.prototype.map.call(e, v => v.toFixed(3)).join(','));
  });
  return out.join('|');
});

const CASES = [
  { id: 'C1-sound-medium', expect: 'process' },
  { id: 'C3-noise-control', expect: 'process' },
  { id: 'D7-motor-generator', expect: 'process' },
  { id: 'A4-liquid-pressure', expect: 'static' },
  { id: 'A5-buoyancy', expect: 'static' },
  { id: 'D6-magnet-solenoid', expect: 'static' },
  { id: 'D4-ohm-law', expect: 'static' },   // 全表最后一个「表里写 4s、实现返回 0」的场景
];

let fails = 0;
for (const c of CASES) {
  await page.evaluate(i => window.__LAB.switch(i), c.id);
  await sleep(700);
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });

  const dur = await page.evaluate(() => window.__LAB.current().exp.duration);
  const jsonDur = await page.evaluate(id => {
    const D = window.__LAB.DATA();
    for (const m of ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal']) {
      const hit = (D.byModule[m] || []).find(e => e.id === id);
      if (hit) return hit.duration;
    }
    return null;
  }, c.id);

  let verdict, note = '';
  if (Number.isFinite(dur) && dur > 0) {
    await page.evaluate(() => window.__LAB.current().exp.seek(0));
    const s0 = await SIG();
    await page.evaluate(d => window.__LAB.current().exp.seek(d / 2), dur);
    const sHalf = await SIG();
    await page.evaluate(d => window.__LAB.current().exp.seek(d / 2), dur);
    const sHalf2 = await SIG();
    const moved = s0 !== sHalf;
    const stable = sHalf === sHalf2;
    verdict = moved && stable && c.expect === 'process' ? 'PASS' : 'FAIL';
    note = `t=0 与 t=半程 ${moved ? '不同' : '相同'}；同一 t 两次 seek ${stable ? '一致' : '不一致'}`;
    // 空转检查：t=0 与 t=duration 也要能区分（避免只是抖动）
  } else {
    await page.evaluate(() => window.__LAB.current().exp.seek(0));
    const s0 = await SIG();
    await page.evaluate(() => window.__LAB.store.playback.playing = true);
    await sleep(700);
    await page.evaluate(() => window.__LAB.store.playback.playing = false);
    const sLater = await SIG();
    verdict = s0 === sLater && c.expect === 'static' ? 'PASS' : 'FAIL';
    note = `播放 0.7s 前后画面 ${s0 === sLater ? '完全相同' : '有变化'}`;
  }

  const jsonOk = Number.isFinite(dur) ? Math.abs(jsonDur - dur) < 1e-6 : jsonDur === 0;
  if (!jsonOk) { verdict = 'FAIL'; note += `；JSON duration=${jsonDur} 与实现 ${dur} 不符`; }
  if (verdict === 'FAIL') fails++;
  console.log(`[${verdict}] ${c.id.padEnd(20)} 期望=${c.expect}  duration=${dur}  JSON=${jsonDur}  ${note}`);
}

await browser.close(); server.close();
console.log(`\n结果：${CASES.length - fails}/${CASES.length} 通过；控制台报错 ${errors.length} 条`);
if (errors.length) console.log([...new Set(errors)].slice(0, 4).join(' / '));
process.exit(fails ? 1 : 0);