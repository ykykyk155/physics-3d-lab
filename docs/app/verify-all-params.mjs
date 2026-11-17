// 权威复核：对全部参数，取「min / mid / max / 一个非零小值」多个候选值，
// 逐字段对比快照（对象位置/缩放/朝向/颜色/发光/透明度/实例矩阵哈希、读数、3D 标签），
// 只要存在任意两值产生差异 → 该参数有效，并给出具体证据字段；全部相同 → 失效。
// 规避「0 被代码里的 || 默认值吃掉」的陷阱：额外测试一个非零小值。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18135;
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
    const hashArr = (arr) => {
      let h = 2166136261;
      const step = Math.max(1, Math.floor(arr.length / 300));
      for (let k = 0; k < arr.length; k += step) {
        const v = arr[k];
        if (!Number.isFinite(v)) { h = (h ^ 0x7fffffff) >>> 0; continue; }
        h ^= (Math.round(v * 10000) | 0); h = Math.imul(h, 16777619) >>> 0;
      }
      return h.toString(16) + ':' + arr.length;
    };
    scene.traverse(o => {
      const rec = {
        i, type: o.type, vis: o.visible,
        p: [o.position.x, o.position.y, o.position.z].map(v => +v.toFixed(3)),
        s: [o.scale.x, o.scale.y, o.scale.z].map(v => +v.toFixed(3)),
        q: [o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w].map(v => +v.toFixed(3)),
        col: o.material && o.material.color ? o.material.color.getHexString() : null,
        emi: o.material && o.material.emissive ? o.material.emissive.getHexString() : null,
        emiI: o.material && o.material.emissiveIntensity != null ? +o.material.emissiveIntensity.toFixed(3) : null,
        op: o.material && o.material.opacity != null ? +o.material.opacity.toFixed(3) : null,
        geo: null, inst: null,
      };
      if (o.geometry) {
        const g = o.geometry, ga = g.attributes || {};
        const sig = [];
        if (ga.position) sig.push(hashArr(ga.position.array));
        if (ga.instanceStart) sig.push(hashArr(ga.instanceStart.data.array));
        if (g.index) sig.push('idx' + g.index.count);
        rec.geo = sig.join('/');
      }
      if (o.isInstancedMesh && o.instanceMatrix) rec.inst = hashArr(o.instanceMatrix.array) + '#' + o.count;
      objs.push(rec);
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
    const b = blk.querySelector('.seg button[data-oid="' + String(val) + '"]');
    if (b) { b.click(); return 'seg'; }
    const li = blk.querySelector('.dropdown li[data-oid="' + String(val) + '"]');
    if (li) { li.click(); return 'li'; }
    return 'none';
  };
});

function diff(a, b) {
  const ev = { ro: [], lbl: [], obj: [] };
  for (const k of new Set([...Object.keys(a.ro), ...Object.keys(b.ro)])) if (a.ro[k] !== b.ro[k]) ev.ro.push(`${k}:${a.ro[k]}→${b.ro[k]}`);
  const nl = Math.max(a.labels.length, b.labels.length);
  for (let i = 0; i < nl; i++) if (a.labels[i] !== b.labels[i]) ev.lbl.push(`[${i}]${(a.labels[i] || '').slice(0, 24)}→${(b.labels[i] || '').slice(0, 24)}`);
  const no = Math.max(a.objs.length, b.objs.length);
  for (let i = 0; i < no; i++) {
    const x = a.objs[i], y = b.objs[i];
    if (!x || !y) { ev.obj.push(`obj#${i}增删`); continue; }
    const f = [];
    for (const k of ['vis', 'p', 's', 'q', 'col', 'emi', 'emiI', 'op', 'geo', 'inst']) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) f.push(k);
    if (f.length) ev.obj.push(`#${i}(${x.type}:${f.join('/')})`);
  }
  return ev;
}
const hasDiff = ev => ev.ro.length || ev.lbl.length || ev.obj.length;

const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const results = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(600);
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  await sleep(120);
  const meta = await page.evaluate(() => {
    const m = window.__LAB.DATA().byId[window.__LAB.store.experimentId];
    return { params: m.params.map(p => ({ id: p.id, type: p.type || 'number', min: p.min, max: p.max, step: p.step, def: p.default, options: p.options ? p.options.map(o => o.value) : null })) };
  });
  for (const p of meta.params) {
    let candidates;
    if (p.type === 'enum') candidates = p.options.slice();
    else {
      const mid = p.min + (p.max - p.min) / 2;
      const smallNonZero = p.step ? p.min + p.step : (p.min + p.max) / 2;
      candidates = Array.from(new Set([p.min, smallNonZero, mid, p.max].map(v => +(+v).toFixed(6))));
    }
    // 采集所有候选值快照
    const snaps = [];
    for (const v of candidates) {
      const set = await page.evaluate((pid, val) => window.__setUI(pid, val), p.id, v);
      await sleep(160);
      snaps.push({ v, set, snap: await page.evaluate(() => window.__snap()) });
    }
    // 是否只有 SET 失败
    if (snaps.every(s => s.set === 'no-block' || s.set === 'no-control' || s.set === 'none')) {
      results.push({ id, param: p.id, type: p.type, verdict: 'NO-CONTROL', evidence: '画面上没有该控件（' + snaps[0].set + '）' });
      console.log(`✗ ${id} · ${p.id} → NO-CONTROL`);
      continue;
    }
    // 两两比较找差异
    let found = null;
    for (let a = 0; a < snaps.length && !found; a++) {
      for (let b = a + 1; b < snaps.length && !found; b++) {
        const ev = diff(snaps[a].snap, snaps[b].snap);
        if (hasDiff(ev)) found = { va: snaps[a].v, vb: snaps[b].v, ev };
      }
    }
    if (found) {
      const sum = [];
      if (found.ev.ro.length) sum.push('读数 ' + found.ev.ro.join(','));
      if (found.ev.lbl.length) sum.push('标签 ' + found.ev.lbl.slice(0, 2).join(','));
      if (found.ev.obj.length) sum.push(`场景 ${found.ev.obj.length}处(${found.ev.obj.slice(0, 4).join(',')})`);
      results.push({ id, param: p.id, type: p.type, verdict: 'EFFECTIVE', evidence: `${found.va}→${found.vb}: ` + sum.join(' | ') });
    } else {
      // 静态无差异 → 做动态对比：重置后播放 1.5s，比较两端取值最终快照
      const dyn = [];
      for (const v of [candidates[0], candidates[candidates.length - 1]]) {
        await page.evaluate((pid, val) => window.__setUI(pid, val), p.id, v);
        await page.evaluate(() => { const e = window.__LAB.current().exp; if (e && e.reset) e.reset(); });
        await sleep(50);
        await page.evaluate(() => { window.__LAB.store.playback.playing = true; });
        await sleep(1500);
        await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
        await sleep(80);
        dyn.push(await page.evaluate(() => window.__snap()));
      }
      const dev = diff(dyn[0], dyn[1]);
      if (hasDiff(dev)) {
        const sum = [];
        if (dev.ro.length) sum.push('读数 ' + dev.ro.join(','));
        if (dev.lbl.length) sum.push('标签 ' + dev.lbl.slice(0, 2).join(','));
        if (dev.obj.length) sum.push(`场景 ${dev.obj.length}处(${dev.obj.slice(0, 4).join(',')})`);
        results.push({ id, param: p.id, type: p.type, verdict: 'EFFECTIVE(dynamic)', evidence: `静态同,播放1.5s后 ${candidates[0]}→${candidates[candidates.length - 1]}: ` + sum.join(' | ') });
      } else {
        results.push({ id, param: p.id, type: p.type, verdict: 'INERT', evidence: `取值 ${candidates.join('/')} 静态与播放后快照都完全相同` });
        console.log(`✗ ${id} · ${p.id} → INERT`);
      }
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'param-probe-raw.json'), JSON.stringify(results, null, 2));
const inert = results.filter(r => r.verdict !== 'EFFECTIVE');
console.log(`\n=== 汇总：参数总数 ${results.length}，有效 ${results.length - inert.length}，疑似失效 ${inert.length} ===`);
inert.forEach(r => console.log(`  [${r.verdict}] ${r.id} · ${r.param}  — ${r.evidence}`));
await browser.close(); server.close();
