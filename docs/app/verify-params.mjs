// 定点复核：对参数联动探针报 INERT 的参数逐个打印「改前/改后」的具体差异，
// 用于区分真失效 vs 探针漏检。输出：读数、3D 标签、以及发生变化的场景对象明细。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18131;
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
    const objs = [];
    let i = 0;
    scene.traverse(o => {
      objs.push({
        i, type: o.type, vis: o.visible,
        p: [o.position.x, o.position.y, o.position.z].map(v => +v.toFixed(4)),
        s: [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(4)),
        q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(v => +v.toFixed(4)),
        col: o.material && o.material.color ? o.material.color.getHexString() : null,
        emi: o.material && o.material.emissive ? o.material.emissive.getHexString() : null,
        emiI: o.material && o.material.emissiveIntensity != null ? +o.material.emissiveIntensity.toFixed(4) : null,
        op: o.material && o.material.opacity != null ? +o.material.opacity.toFixed(4) : null,
        instN: o.isInstancedMesh ? o.count : null,
      });
      i++;
    });
    const ro = {};
    document.querySelectorAll('.rval[data-rid]').forEach(n => { ro[n.dataset.rid] = n.textContent; });
    const labels = Array.from(document.querySelectorAll('#labelRoot div')).map(d => d.textContent);
    return { objs, ro, labels };
  };
  window.__setUI = (pid, val) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    if (!blk) return 'no-block';
    const input = blk.querySelector('input[type=range]');
    if (input) { input.value = String(val); input.dispatchEvent(new Event('input', { bubbles: true })); return 'range'; }
    const btn = blk.querySelector('.seg button[data-oid="' + String(val) + '"]');
    if (btn) { btn.click(); return 'seg'; }
    const li = blk.querySelector('.dropdown li[data-oid="' + String(val) + '"]');
    if (li) { li.click(); return 'dropdown'; }
    return 'no-control';
  };
});

const CASES = [
  ['A4-liquid-pressure', 'orient', 0, 360, 'number'],
  ['A4-liquid-pressure', 'vessel', 'cyl', 'neck', 'enum'],
  ['A5-buoyancy', 'submerge', 0, 30, 'number'],
  ['D2-resistance-factor', 'temp', 0, 100, 'number'],
  ['D3-rheostat-lamp', 'rating', 20, 50, 'enum'],
  ['D5-power-joule', 'time', 0, 10, 'number'],
  ['D6-magnet-solenoid', 'dir', 1, -1, 'enum'],
  ['B1-pinhole', 'hole', 1, 10, 'number'],
  ['B1-pinhole', 'shape', 'circle', 'triangle', 'enum'],
  ['B3-plane-mirror', 'altHeight', 1, 10, 'number'],
  ['B4-refraction', 'scene', 'laser', 'fiber', 'enum'],
  ['B5-convex-lens', 'cover', 'off', 'half', 'enum'],
  ['B5-convex-lens', 'source', 'F', 'candle', 'enum'],
  ['C1-sound-medium', 'temp', -20, 40, 'number'],
  ['F3-heat-engine', 'rpm', 0, 3000, 'number'],
];

function diffSnap(a, b) {
  const changes = [];
  const n = Math.max(a.objs.length, b.objs.length);
  for (let i = 0; i < n; i++) {
    const oa = a.objs[i], ob = b.objs[i];
    if (!oa || !ob) { changes.push(`obj#${i} 增删`); continue; }
    const fields = [];
    for (const k of ['vis', 'p', 's', 'q', 'col', 'emi', 'emiI', 'op', 'instN']) {
      if (JSON.stringify(oa[k]) !== JSON.stringify(ob[k])) fields.push(`${k}: ${JSON.stringify(oa[k])}→${JSON.stringify(ob[k])}`);
    }
    if (fields.length) changes.push(`obj#${i}(${oa.type}) ` + fields.join(' | '));
  }
  const roDiff = [];
  for (const k of new Set([...Object.keys(a.ro), ...Object.keys(b.ro)])) if (a.ro[k] !== b.ro[k]) roDiff.push(`${k}: ${a.ro[k]}→${b.ro[k]}`);
  const lblDiff = [];
  const maxL = Math.max(a.labels.length, b.labels.length);
  for (let i = 0; i < maxL; i++) if (a.labels[i] !== b.labels[i]) lblDiff.push(`[${i}] ${a.labels[i]} → ${b.labels[i]}`);
  return { changes, roDiff, lblDiff };
}

for (const [id, pid, v1, v2, type] of CASES) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  await sleep(150);
  const k1 = await page.evaluate((p, v) => window.__setUI(p, v), pid, v1);
  await sleep(250);
  const snapA = await page.evaluate(() => window.__snap());
  const k2 = await page.evaluate((p, v) => window.__setUI(p, v), pid, v2);
  await sleep(250);
  const snapB = await page.evaluate(() => window.__snap());
  const d = diffSnap(snapA, snapB);
  console.log(`\n### ${id} · ${pid}  [${type}]  set=${k1}/${k2}  ${v1} → ${v2}`);
  console.log(`  读数变化: ${d.roDiff.length ? d.roDiff.join(' ; ') : '（无）'}`);
  console.log(`  标签变化: ${d.lblDiff.length ? d.lblDiff.join(' ; ') : '（无）'}`);
  console.log(`  场景变化: ${d.changes.length ? d.changes.length + ' 处: ' + d.changes.slice(0, 6).join(' ; ') : '（无）'}`);
}
await browser.close(); server.close();
