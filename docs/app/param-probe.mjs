// 参数联动探针：对每个实验的每个参数，取 min/mid/max（枚举取全部选项），
// 采集「场景图指纹」前后对比，找出调了画面不动的失效参数。
// 指纹 = 所有 Object3D 的 position/quaternion/scale/可见性 + 材质颜色 + 读数 + 播放状态。
// 对暂停态指纹不变的参数，再做「重置 → 播放 1 秒」动态对比，避免把只影响随时间演化的参数误判为失效。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18130;
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
await page.setViewport({ width: 1420, height: 700, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 注入指纹与设置参数的辅助函数（在页面内执行）
await page.evaluate(() => {
  window.__fp = () => {
    const scene = window.__LAB.current().scene;
    const parts = [];
    const f = v => (typeof v === 'number' ? (Math.abs(v) < 1e-6 ? '0' : v.toFixed(4)) : String(v));
    // 数值数组 → 轻量哈希（NaN 记 1），用于顶点/实例矩阵这类大数组的变更检测
    const hashArr = (arr, stride = 1) => {
      let h = 2166136261;
      const step = Math.max(1, Math.floor(arr.length / 400));   // 抽样，最多 400 个
      for (let i = 0; i < arr.length; i += step) {
        const v = arr[i];
        if (!Number.isFinite(v)) { h = (h ^ 0x7fffffff) >>> 0; continue; }
        const q = Math.round(v * 10000) | 0;
        h ^= q; h = Math.imul(h, 16777619) >>> 0;
      }
      return h.toString(16) + ':' + arr.length;
    };
    let i = 0;
    scene.traverse(o => {
      const r = [];
      r.push(o.type, o.visible ? 1 : 0);
      r.push(f(o.position.x), f(o.position.y), f(o.position.z));
      r.push(f(o.quaternion.x), f(o.quaternion.y), f(o.quaternion.z), f(o.quaternion.w));
      r.push(f(o.scale.x), f(o.scale.y), f(o.scale.z));
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      mats.forEach(m => {
        if (m && m.color) r.push('c' + m.color.getHexString());
        if (m && m.emissive) r.push('e' + m.emissive.getHexString(), f(m.emissiveIntensity));
        if (m && m.opacity != null) r.push('o' + f(m.opacity));
        if (m && m.visible === false) r.push('mv0');
      });
      // 几何：顶点坐标哈希（覆盖 Line2 的 instanceStart/instanceEnd、被改写的顶点）
      if (o.geometry) {
        const g = o.geometry;
        const ga = g.attributes || {};
        if (ga.position) r.push('gp' + hashArr(ga.position.array));
        if (ga.instanceStart) r.push('gs' + hashArr(ga.instanceStart.data.array));
        if (ga.instanceEnd) r.push('ge' + hashArr(ga.instanceEnd.data.array));
        if (g.index) r.push('gi' + g.index.count);
        // InstancedMesh：把每个实例的变换矩阵也纳入指纹（描点、气泡、电子等）
        if (o.isInstancedMesh && o.instanceMatrix) {
          r.push('im' + hashArr(o.instanceMatrix.array), 'ic' + o.count);
        }
      }
      parts.push(i + ':' + r.join(','));
      i++;
    });
    // 读数卡文本
    const ro = {};
    document.querySelectorAll('.rval[data-rid]').forEach(n => { ro[n.dataset.rid] = n.textContent; });
    // 画布上 CSS2D 标签文本
    const labels = Array.from(document.querySelectorAll('#labelRoot div')).map(d => d.textContent).join('|');
    return parts.join('\n') + '\nREAD:' + JSON.stringify(ro) + '\nLBL:' + labels;
  };

  // 通过真实 UI 控件设置参数（滑杆派发 input；枚举点分段按钮/下拉项）
  window.__setParamUI = (pid, val) => {
    const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
    if (!blk) return { ok: false, reason: 'no-block' };
    const input = blk.querySelector('input[type=range]');
    if (input) {
      input.value = String(val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return { ok: true, kind: 'range' };
    }
    // 枚举：优先分段按钮
    const btn = blk.querySelector('.seg button[data-oid="' + String(val) + '"]');
    if (btn) { btn.click(); return { ok: true, kind: 'seg' }; }
    // 下拉项
    const li = blk.querySelector('.dropdown li[data-oid="' + String(val) + '"]');
    if (li) { li.click(); return { ok: true, kind: 'dropdown' }; }
    return { ok: false, reason: 'no-control' };
  };
});

const ids = await page.evaluate(() => {
  const M = ['mechanics', 'electricity', 'optics', 'acoustics', 'thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

const results = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(700);
  // 暂停，保证静态对比时画面不动
  await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
  await sleep(200);

  const meta = await page.evaluate(() => {
    const m = window.__LAB.DATA().byId[window.__LAB.store.experimentId];
    return { params: m.params.map(p => ({ id: p.id, type: p.type || 'number', min: p.min, max: p.max, step: p.step, options: p.options ? p.options.map(o => o.value) : null })) };
  });

  for (const p of meta.params) {
    let values;
    if (p.type === 'enum') values = p.options;
    else {
      const mid = p.min + (p.max - p.min) / 2;
      values = [p.min, mid, p.max];
    }
    // 去重
    values = Array.from(new Set(values.map(v => (typeof v === 'number' ? +v.toFixed(6) : v))));

    // ---- 静态对比（暂停）----
    const fps = [];
    for (const v of values) {
      const set = await page.evaluate((pid, val) => window.__setParamUI(pid, val), p.id, v);
      if (!set.ok) { fps.push({ v, fp: 'SETFAIL:' + set.reason }); continue; }
      await sleep(120);   // 等 rAF 合并 + onParam
      await sleep(80);
      const fp = await page.evaluate(() => window.__fp());
      fps.push({ v, fp });
    }
    const uniqueStatic = new Set(fps.map(x => x.fp)).size;
    const staticEffective = uniqueStatic > 1;
    let verdict = staticEffective ? 'EFFECTIVE(static)' : null;
    let evidence = staticEffective ? `暂停态不同取值指纹有 ${uniqueStatic} 种` : '';

    // ---- 动态对比（仅当静态无变化）----
    let dynamicEffective = false;
    if (!staticEffective) {
      const dynFps = [];
      for (const v of [values[0], values[values.length - 1]]) {
        await page.evaluate((pid, val) => window.__setParamUI(pid, val), p.id, v);
        await page.evaluate(() => { const e = window.__LAB.current().exp; if (e && e.reset) e.reset(); });
        await sleep(60);
        await page.evaluate(() => { window.__LAB.store.playback.playing = true; });
        await sleep(1000);
        await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
        await sleep(120);
        dynFps.push(await page.evaluate(() => window.__fp()));
      }
      dynamicEffective = new Set(dynFps).size > 1;
      if (dynamicEffective) { verdict = 'EFFECTIVE(dynamic)'; evidence = '暂停态不变，但重置后播放 1s 两端取值指纹不同'; }
      else { verdict = 'INERT'; evidence = '暂停态与播放 1s 后，两端取值指纹都完全相同'; }
    }
    results.push({ id, param: p.id, type: p.type, verdict, evidence, values: values.length });
    if (verdict === 'INERT' || verdict === 'EFFECTIVE(static)') {
      console.log(`${id} · ${p.id} → ${verdict}`);
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'param-probe-raw.json'), JSON.stringify(results, null, 2));
const inert = results.filter(r => r.verdict === 'INERT');
console.log('\n=== 失效参数汇总 ===');
console.log('总计参数', results.length, '｜ 失效', inert.length);
inert.forEach(r => console.log(`  ${r.id} · ${r.param}`));
await browser.close(); server.close();
