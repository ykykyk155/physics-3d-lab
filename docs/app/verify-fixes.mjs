// 针对本轮修改过的参数，直接做「两取值场景快照」对比，确认修复生效（不受读数刷新拖累：同时比读数+标签+对象）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18142;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) f = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const M = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
  res.writeHead(200, { 'Content-Type': M[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
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

await page.evaluate(() => {
  window.__snap = () => {
    const scene = window.__LAB.current().scene;
    const objs = []; let i = 0;
    scene.traverse(o => {
      objs.push([i++, o.type, o.visible ? 1 : 0,
        [o.position.x, o.position.y, o.position.z].map(v => +v.toFixed(3)),
        [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(3)),
        [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(v => +v.toFixed(3)),
        o.material && o.material.color ? o.material.color.getHexString() : null,
        o.material && o.material.opacity != null ? +o.material.opacity.toFixed(2) : null,
        o.geometry ? (o.geometry.parameters ? JSON.stringify(o.geometry.parameters) : (o.geometry.attributes.position ? o.geometry.attributes.position.count : 0)) : 0].join('|'));
    });
    const ro = {}; document.querySelectorAll('.rval[data-rid]').forEach(n => ro[n.dataset.rid] = n.textContent);
    const lb = Array.from(document.querySelectorAll('#labelRoot div')).map(d => d.textContent).join('||');
    return objs.join('\n') + '\nR:' + JSON.stringify(ro) + '\nL:' + lb;
  };
  window.__setUI = (pid, val) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    if (!blk) return 'no-block';
    const input = blk.querySelector('input[type=range]');
    if (input) { input.value = String(val); input.dispatchEvent(new Event('input', { bubbles: true })); return 'range'; }
    const b = blk.querySelector('.seg button[data-oid="' + String(val) + '"]');
    if (b) { b.click(); return 'seg'; }
    const li = blk.querySelector('.dropdown li[data-oid="' + String(val) + '"]');
    if (li) { li.click(); return 'li'; }
    return 'none';
  };
});

// 需要动态播放验证的参数
const DYNAMIC = { 'D7-motor-generator': ['current', 'speed', 'moveDir', 'commutator'], 'A3-friction': ['pull'], 'F3-heat-engine': ['rpm'] };
const CASES = [
  ['A2-newton-first', 'mass', 0.1, 1.0],
  ['A4-liquid-pressure', 'orient', 0, 180],
  ['A4-liquid-pressure', 'vessel', 'cyl', 'neck'],
  ['A5-buoyancy', 'submerge', 2, 28],
  ['A6-energy', 'height', 0.05, 0.5],
  ['D2-resistance-factor', 'temp', 0, 100],
  ['D3-rheostat-lamp', 'rating', 20, 50],
  ['D5-power-joule', 'time', 0, 10],
  ['D6-magnet-solenoid', 'dir', 1, -1],
  ['B1-pinhole', 'hole', 1, 10],
  ['B1-pinhole', 'shape', 'circle', 'triangle'],
  ['B3-plane-mirror', 'altHeight', 1, 10],
  ['B4-refraction', 'scene', 'laser', 'fiber'],
  ['B5-convex-lens', 'cover', 'off', 'half'],
  ['B5-convex-lens', 'source', 'F', 'candle'],
  ['C1-sound-medium', 'temp', -20, 40],
  ['C2-sound-chars', 'ruler', 5, 30],
  ['C2-sound-chars', 'pipe', 5, 40],
  ['C3-noise-control', 'stage', 'source', 'ear'],
];

let pass = 0, fail = 0;
for (const [id, pid, v1, v2] of CASES) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(600);
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  await sleep(120);
  await page.evaluate((p, v) => window.__setUI(p, v), pid, v1); await sleep(250);
  const a = await page.evaluate(() => window.__snap());
  await page.evaluate((p, v) => window.__setUI(p, v), pid, v2); await sleep(250);
  const b = await page.evaluate(() => window.__snap());
  const same = a === b;
  console.log(`${same ? '✗ INERT' : '✓ OK'}  ${id} · ${pid}  ${v1}→${v2}`);
  if (same) fail++; else pass++;
}
// 动态参数
for (const [id, pids] of Object.entries(DYNAMIC)) {
  for (const pid of pids) {
    await page.evaluate(i => window.__LAB.switch(i), id); await sleep(600);
    async function run(v) {
      await page.evaluate((p, v) => window.__setUI(p, v), pid, v);
      await page.evaluate(() => { const e = window.__LAB.current().exp; if (e && e.reset) e.reset(); });
      await sleep(50);
      await page.evaluate(() => { window.__LAB.store.playback.playing = true; });
      await sleep(1400);
      await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
      await sleep(80);
      return page.evaluate(() => window.__snap());
    }
    const vals = { current: [0, 3], speed: [0.1, 5], moveDir: ['cut', 'rev'], commutator: ['on', 'off'], pull: [0.05, 0.3], rpm: [0, 3000] }[pid];
    const a = await run(vals[0]); const b = await run(vals[1]);
    const same = a === b;
    console.log(`${same ? '✗ INERT' : '✓ OK'}  ${id} · ${pid}(动态)  ${vals[0]}→${vals[1]}`);
    if (same) fail++; else pass++;
  }
}
console.log(`\n通过 ${pass}，仍失效 ${fail}`);
await browser.close(); server.close();
