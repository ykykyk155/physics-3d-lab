// UI→引擎通路探针：真实驱动每个控件，统计 exp.onParam 是否被送达
// 输出 docs/app/ui-probe-report.md
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18096;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end(); return; }
  }
  const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json' };
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox',
         '--autoplay-policy=no-user-gesture-required',
         '--js-flags=--max-old-space-size=4096', '--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
// 惰性加载断言的取证：记录 ammo.js 本体的网络请求（bridge 文件不算引擎下载）
const netLog = [];
await page.on('request', r => { if (/vendor\/ammo\/ammo\.js/i.test(r.url())) netLog.push(r.url()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const atBoot = netLog.length;                          // 首屏基线：此刻必须为 0（引擎未注入）
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

const ids = await page.evaluate(() => {
  const M = ['mechanics','electricity','optics','acoustics','thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});

let md = `# UI→引擎通路探针报告\n\n时间：${new Date().toISOString()}\n方法：包裹每个实验的 exp.onParam 计数；滑杆用原生 input 事件、枚举用真实点击驱动；每控件触发后等 2 帧再读计数。\n\n| 实验 | 控件 | 类型 | onParam 送达 | 判定 |\n|---|---|---|---|---|\n`;
let total = 0, delivered = 0, snapTotal = 0, snapOK = 0, unbTotal = 0, unbOK = 0, seekTotal = 0, seekOK = 0;
let zeroStaticN = 0, zeroStaticOK = 0, zeroBranchN = 0, zeroBranchOK = 0, hintTotal = 0, hintOK = 0;
let statTotal = 0, statOK = 0, speedTotal = 0, speedOK = 0, coverTotal = 0, coverOK = 0;
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id);
  await sleep(800);
  const rows = await page.evaluate(async (id) => {
    const L = window.__LAB, meta = L.DATA().byId[id];
    const exp = L.current().exp;
    const out = { hasExp: !!exp, hasOnParam: !!(exp && typeof exp.onParam === 'function'), params: [] };
    // 实时数据统计面板：exp.readouts() 形状 + 面板渲染一致 + 无 NaN
    let items = null;
    if (exp && typeof exp.readouts === 'function') {
      try { items = exp.readouts(); } catch (e) { items = null; }
    }
    const statBody = document.getElementById('statsBody');
    const statCards = statBody ? [...statBody.querySelectorAll('.readout-card')] : [];
    const n = Array.isArray(items) ? items.length : -1;
    const shapeOK = n >= 1 && items.every(it => it && typeof it.label === 'string' && it.label.length > 0 &&
      (typeof it.value === 'number' ? isFinite(it.value) : (typeof it.value === 'string' && it.value.length > 0)));
    const domOK = statCards.length === n &&
      statCards.every((c, i) => c.querySelector('.rlabel').textContent === items[i].label);
    out.stat = { n, cards: statCards.length, ok: shapeOK && domOK && !/NaN|undefined/i.test(statBody ? statBody.textContent : '') };
    // 播放速度六档：档位固定 0.25/0.5/1/2/4/8，默认档高亮与 JSON defaultSpeed 一致，置灰随 duration
    const btns = [...document.querySelectorAll('.pb-speed')];
    const expectActive = String(meta.defaultSpeed != null ? meta.defaultSpeed : 1) + '×';
    const expectDisabled = !!(exp && typeof exp.duration === 'number' && exp.duration <= 0);
    const gotActive = (btns.find(b => b.classList.contains('active')) || {}).textContent || null;
    out.speeds = { n: btns.length, labels: btns.map(b => b.textContent).join(), gotActive, expectActive, ok:
      btns.length === 6 && btns.map(b => b.textContent).join() === '0.25×,0.5×,1×,2×,4×,8×' &&
      btns.every(b => b.disabled === expectDisabled) && gotActive === expectActive };
    // 表实一致门禁：JSON 有 duration（>0 或 ∞）的场景必须带 durationIsSnapshot 或 durationZeroKind
    {
      const raw = meta.duration;
      const d = typeof raw === 'string' ? (raw === 'Infinity' ? Infinity : parseFloat(raw)) : raw;
      const hasDuration = typeof d === 'number' && d > 0;
      out.cover = { hasDuration, snap: !!meta.durationIsSnapshot, kind: meta.durationZeroKind || null,
        ok: !hasDuration || !!meta.durationIsSnapshot || !!meta.durationZeroKind };
    }
    if (!exp) return out;
    const orig = exp.onParam.bind(exp);
    let count = 0;
    exp.onParam = (k, v) => { try { orig(k, v); count++; } catch (e) { log.push('onParam(' + k + ') threw: ' + e.message); } };  // 只统计未抛错的送达
    let log = [];
    // duration 快照机器校验：durationIsSnapshot=true 时断言 |exp.duration − JSON快照| ≤ tolerance×快照
    // JSON 无 Infinity 字面量：字符串 "Infinity" 归一化为数值 Infinity 并跳过容差断言（无界场景走 unb 断言）
    out.snap = null;
    if (meta.durationIsSnapshot) {
      const raw = meta.duration;
      const snap = typeof raw === 'string' ? (raw === 'Infinity' ? Infinity : parseFloat(raw)) : raw;
      const tol = meta.snapshotTolerance != null ? meta.snapshotTolerance : 0.1;
      const actual = (typeof exp.duration === 'number') ? exp.duration : NaN;
      // 容差 = max(相对 10%, 绝对 0.1s)：快照为 0 的场景（如 A7 平衡态）相对容差退化为 0，须有绝对下限
      out.snap = isFinite(snap)
        ? { snap, actual, tol, ok: isFinite(actual) && Math.abs(actual - snap) <= Math.max(tol * Math.abs(snap), 0.1) }
        : { snap: '∞', actual, tol, ok: !isFinite(actual) };
    }
    // branch 置灰文案断言：读数必须等于 JSON 的 zeroHint。A7 默认即置灰；A1/F3 需先触发到静止/零转速态
    out.hint = null;
    if (meta.durationZeroKind === 'branch' && meta.zeroHint && typeof exp.duration === 'number') {
      const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const setParamTo = async (pid, v) => {
        const blk = document.querySelector('.param-block[data-pid="' + pid + '"]');
        if (!blk) return;
        const p = meta.params.find(x => x.id === pid);
        if (p && p.type === 'enum') {
          const t = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === String(v));
          if (t) t.click();
        } else {
          const input = blk.querySelector('input[type=range]');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, String(v));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await raf2();
      };
      const triggers = { 'A1-incline-speed': { mu: 0.3, theta: 5 }, 'F3-heat-engine': { rpm: 0 } }[id] || {};
      for (const [k, v] of Object.entries(triggers)) await setParamTo(k, v);
      await raf2();
      if (exp.duration <= 0) {                             // 已进入置灰态
        const got = document.getElementById('tbTime').textContent || '';
        out.hint = { expect: meta.zeroHint, got, ok: got === meta.zeroHint };
      }
      for (const [k] of Object.entries(triggers)) {        // 恢复默认
        const p = meta.params.find(x => x.id === k);
        if (p) await setParamTo(k, p.default);
      }
    }
    // 无界时长断言：exp.duration === Infinity 时，时间条必须禁拖、读数 t / ∞ 且无 NaN
    out.unb = null;
    if (exp && typeof exp.duration === 'number' && !isFinite(exp.duration)) {
      const input = document.getElementById('timeRange');
      const label = document.getElementById('tbTime').textContent || '';
      out.unb = { disabled: input.disabled, label, noNaN: !/NaN|undefined/i.test(label) && !/NaN/i.test(label) };
    }
    // seek 拖动一致性（验收第 9 条外壳侧）：t1→t2→t1 经真实时间条驱动，读数无 NaN、simTime 精确回位
    out.seekCheck = null;
    if (exp && typeof exp.seek === 'function' && typeof exp.duration === 'number' && isFinite(exp.duration) && exp.duration > 0) {
      const t1 = +(exp.duration * 0.37).toFixed(2), t2 = +(exp.duration * 0.73).toFixed(2);
      const scrub = async (v) => {
        const input = document.getElementById('timeRange');
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        await new Promise(r => setTimeout(r, 150));
      };
      await scrub(t1);
      const r1 = JSON.stringify(L.store.readouts);
      await scrub(t2);
      await scrub(t1);
      const r2 = JSON.stringify(L.store.readouts);
      out.seekCheck = { t1, t2, back: L.store.simTime === t1, noNaN: !/NaN|undefined/i.test(r1 + r2) };
    }
    // durationZeroKind 双类断言：static=参数极值下恒 0；branch=默认与触发参数下 0↔非 0 互斥
    out.zero = null;
    const zk = meta.durationZeroKind;
    if (zk === 'static' || zk === 'branch') {
      const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const dispatch = async (p, v) => {
        const blk = document.querySelector('.param-block[data-pid="' + p.id + '"]');
        if (!blk) return;
        if (p.type === 'enum') {
          const t = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === String(v));
          if (t) t.click();
        } else {
          const input = blk.querySelector('input[type=range]');
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, String(v));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await raf2();
      };
      if (zk === 'static') {
        let allZero = true;
        for (const p of meta.params) {                     // 每个参数打到对侧极值：duration 必须仍是 0
          const cur = L.store.params[p.id];
          const other = p.type === 'enum'
            ? (p.options.find(o => String(o.value) !== String(cur)) || {}).value
            : (Math.abs(cur - p.min) < 1e-9 ? p.max : p.min);
          if (other === undefined) continue;
          await dispatch(p, other);
          if (exp.duration !== 0) allZero = false;
        }
        out.zero = { kind: 'static', ok: allZero && exp.duration === 0 };
      } else {
        const B = { 'A7-lever': { trigger: { f1: 5.0 }, zeroAtDefault: true },
                    'A1-incline-speed': { trigger: { mu: 0.3, theta: 5 }, zeroAtDefault: false },
                    'F3-heat-engine': { trigger: { rpm: 0 }, zeroAtDefault: false } }[id];
        if (B) {
          const d0 = exp.duration;
          for (const [k, v] of Object.entries(B.trigger)) {
            const p = meta.params.find(x => x.id === k);
            if (p) await dispatch(p, v);
          }
          const d1 = exp.duration;
          if (exp.duration <= 0 && !out.hint && meta.zeroHint) {   // 触发后的置灰态：顺带断言 zeroHint
            out.hint = { expect: meta.zeroHint, got: document.getElementById('tbTime').textContent || '', ok: document.getElementById('tbTime').textContent === meta.zeroHint };
          }
          for (const [k, v] of Object.entries(B.trigger)) {  // 恢复默认，免污染后续检查
            const p = meta.params.find(x => x.id === k);
            if (p) await dispatch(p, p.default);
          }
          const ok = B.zeroAtDefault ? (d0 === 0 && d1 > 0) : (d0 > 0 && d1 === 0);
          out.zero = { kind: 'branch', d0, d1, ok };
        }
      }
    }
    for (const p of meta.params) {
      const blk = document.querySelector('.param-block[data-pid="' + p.id + '"]');
      const before = count;
      let note = '';
      if (!blk) { out.params.push({ pid: p.id, type: p.type || 'number', note: '控件未渲染', d: count - before, stored: null }); continue; }
      if (p.type === 'enum') {
        const cur = String(L.store.params[p.id]);
        const cands = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')];
        const target = cands.find(el => el.dataset.oid !== cur);
        if (target) target.click(); else note = '无其他档位可点';
      } else {
        const input = blk.querySelector('input[type=range]');
        if (!input) { out.params.push({ pid: p.id, type: 'number', note: '滑杆未渲染', d: count - before, stored: null }); continue; }
        const lo = parseFloat(input.min), hi = parseFloat(input.max), cur = parseFloat(input.value);
        const v = Math.abs(cur - lo) < 1e-9 ? hi : lo;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, String(v));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      out.params.push({ pid: p.id, type: p.type || 'number', note, d: count - before, stored: String(L.store.params[p.id]) });
    }
    out.errs = log;
    exp.onParam = orig;                                  // 恢复原方法，避免包装叠加
    return out;
  }, id);
  for (const r of rows.params) {
    total++;
    const ok = r.d > 0;
    if (ok) delivered++;
    md += `| ${id} | ${r.pid} | ${r.type} | ${r.d}（store=${r.stored}${r.note ? '，' + r.note : ''}） | ${ok ? '✅' : '❌ 未送达'} |\n`;
  }
  if (rows.errs && rows.errs.length) md += `| ${id} | ⚠ onParam 抛错 ${rows.errs.length} 次 | ${rows.errs[0].slice(0, 120)}${rows.errs.length > 1 ? ' …等' : ''} | | ❌ |\n`;
  if (rows.snap) {
    snapTotal++;
    if (rows.snap.ok) snapOK++;
    md += `| ${id} | duration 快照校验 | getter | actual=${rows.snap.actual} vs 快照 ${rows.snap.snap}（±${rows.snap.tol * 100}%） | ${rows.snap.ok ? '✅' : '❌ 快照脱节/未实现'} |\n`;
  }
  if (rows.unb) {
    unbTotal++;
    const ok = rows.unb.disabled && rows.unb.noNaN;
    if (ok) unbOK++;
    md += `| ${id} | 无界时长断言 | ∞ | 禁拖=${rows.unb.disabled}、读数「${rows.unb.label}」 | ${ok ? '✅' : '❌'} |\n`;
  }
  if (rows.hint) {
    hintTotal++;
    const ok = !!rows.hint.ok;
    if (ok) hintOK++;
    md += `| ${id} | 置灰文案=zeroHint | branch | 期望「${rows.hint.expect}」实际「${rows.hint.got}」 | ${ok ? '✅' : '❌'} |\n`;
  }
  if (rows.seekCheck) {
    seekTotal++;
    const ok = rows.seekCheck.back && rows.seekCheck.noNaN;
    if (ok) seekOK++;
    md += `| ${id} | seek 拖动一致性 | ${rows.seekCheck.t1}→${rows.seekCheck.t2}→${rows.seekCheck.t1} | simTime 回位=${rows.seekCheck.back}、无NaN=${rows.seekCheck.noNaN} | ${ok ? '✅' : '❌'} |\n`;
  }
  if (rows.zero) {
    const z = rows.zero;
    if (z.kind === 'static') {
      zeroStaticN++;
      if (z.ok) zeroStaticOK++;
      md += `| ${id} | zeroKind=static | 参数极值下恒 0 | | ${z.ok ? '✅' : '❌ 出现非零'} |\n`;
    } else {
      zeroBranchN++;
      if (z.ok) zeroBranchOK++;
      md += `| ${id} | zeroKind=branch | 默认 d0=${z.d0} → 触发后 d1=${z.d1} | | ${z.ok ? '✅ 0↔非0 互斥成立' : '❌ 分支未生效'} |\n`;
    }
  }
  if (rows.stat) {
    statTotal++;
    if (rows.stat.ok) statOK++;
    md += `| ${id} | 统计面板 | readouts() | ${rows.stat.cards}/${rows.stat.n} 项渲染一致、无NaN | ${rows.stat.ok ? '✅' : '❌ 缺 readouts 或形状/渲染不符'} |\n`;
  }
  if (rows.speeds) {
    speedTotal++;
    if (rows.speeds.ok) speedOK++;
    md += `| ${id} | 速度六档 | playbar | 档位[${rows.speeds.labels}] 高亮 ${rows.speeds.gotActive}（期望 ${rows.speeds.expectActive}） | ${rows.speeds.ok ? '✅' : '❌ 档位/高亮/置灰不符'} |\n`;
  }
  if (rows.cover) {
    coverTotal++;
    if (rows.cover.ok) coverOK++;
    md += `| ${id} | 表实门禁 | duration | 有时长=${rows.cover.hasDuration} snap=${rows.cover.snap} kind=${rows.cover.kind || '—'} | ${rows.cover.ok ? '✅' : '❌ 有 duration 却无快照/标注'} |\n`;
  }
  if (!rows.hasExp) md += `| ${id} | — | — | 实验未实现（experiments.js 缺失） | ❌ |\n`;
  else if (!rows.hasOnParam) md += `| ${id} | — | — | 实验缺 onParam 方法 | ❌ |\n`;
}
md += `\n## 结论\n\n- 控件总数 ${total}，onParam 送达 ${delivered}。${delivered === total ? '**UI→引擎通路完好：所有控件都能把改动送进 onParam。**画面不动的问题出在实验侧 onParam 实现。' : '**存在未送达控件，属外壳缺陷。**'}\n`;
md += `- duration 快照校验（durationIsSnapshot 场景）：${snapOK}/${snapTotal} 通过。${snapTotal && snapOK === snapTotal ? 'getter 与 JSON 快照一致，无脱节。' : ''}\n`;
md += `- 无界时长断言（duration=Infinity 场景）：${unbOK}/${unbTotal} 通过。${unbTotal ? '' : '（尚无场景声明 ∞）'}\n`;
md += `- seek 拖动一致性（验收第 9 条，有 seek 且 duration>0 的场景）：${seekOK}/${seekTotal} 通过。\n`;
md += `- durationZeroKind 双类断言：static（任何参数下恒 0）${zeroStaticOK}/${zeroStaticN}；branch（默认与触发参数下 0↔非 0）${zeroBranchOK}/${zeroBranchN}。两类分开统计，断言不同。\n`;
md += `- branch 置灰文案取 JSON zeroHint：${hintOK}/${hintTotal} 通过。\n`;
// 统计面板收起/展开（外壳行为，测一次）
const tog = await page.evaluate(async () => {
  const panel = document.getElementById('stats');
  const head = document.getElementById('statsHead');
  const before = !panel.classList.contains('collapsed');
  head.click();
  await new Promise(r => setTimeout(r, 80));
  const after = panel.classList.contains('collapsed');
  head.click();
  await new Promise(r => setTimeout(r, 80));
  const restored = !panel.classList.contains('collapsed');
  return { before, after, restored, ok: before && after && restored };
});
if (tog.ok) md += `- 统计面板收起/展开：默认展开 → 点击收起 → 再点恢复，✅。\n`;
else md += `- 统计面板收起/展开：❌ before=${tog.before} after=${tog.after} restored=${tog.restored}\n`;
md += `- 统计面板（exp.readouts() → 100ms 渲染）：${statOK}/${statTotal} 通过。\n`;
md += `- 播放速度六档（0.25/0.5/1/2/4/8，高亮=defaultSpeed，置灰=duration≤0）：${speedOK}/${speedTotal} 通过。\n`;
md += `- 表实一致门禁（有 duration 必带 durationIsSnapshot 或 durationZeroKind）：${coverOK}/${coverTotal} 通过。\n`;
// 平移视角：右键拖动 target 生效且在限内；越界被钳制；重置连 target 一起回场景初始机位
await page.evaluate(i => window.__LAB.switch(i), ids[0]);
await sleep(900);
const cam0 = await page.evaluate(() => { const t = window.__LAB.controls().target; return { x: t.x, y: t.y, z: t.z }; });
const cbox = await page.evaluate(() => { const r = document.querySelector('#viewport canvas').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });  // D1 起面板内有数据记录 canvas，必须取视口内的 WebGL 画布
await page.mouse.move(cbox.x, cbox.y);
await page.mouse.down({ button: 'right' });
for (let i = 1; i <= 12; i++) await page.mouse.move(cbox.x + 12 * i, cbox.y - 7 * i);
await page.mouse.up({ button: 'right' });
await frames();
const pan = await page.evaluate(o => { const t = window.__LAB.controls().target; return {
  moved: Math.hypot(t.x - o.x, t.y - o.y, t.z - o.z) > 0.01,
  inLimits: Math.hypot(t.x, t.z) <= 8.01 && t.y >= -0.01 && t.y <= 8.01 }; }, cam0);
await page.evaluate(() => { const t = window.__LAB.controls().target; t.set(20, -5, 0); });
await frames();
const clamp = await page.evaluate(() => { const t = window.__LAB.controls().target; return {
  x: t.x, y: t.y, z: t.z, ok: Math.hypot(t.x, t.z) <= 8.01 && t.y >= -0.01 }; });
await page.click('#btnReset'); await sleep(600);
const back = await page.evaluate(o => { const t = window.__LAB.controls().target;
  return Math.hypot(t.x - o.x, t.y - o.y, t.z - o.z) < 0.05; }, cam0);
if (pan.moved && pan.inLimits && clamp.ok && back) {
  md += `- 平移视角：右键拖动 target 生效且在限内、越界钳制（20,-5,0 → ${clamp.x.toFixed(2)},${clamp.y.toFixed(2)},${clamp.z.toFixed(2)}）、重置回初始机位，✅。\n`;
} else {
  md += `- 平移视角：❌ moved=${pan.moved} inLimits=${pan.inLimits} clampOK=${clamp.ok} resetBack=${back}\n`;
}
// 音频：开关+localStorage 记忆、非声学场景静音、声学三场景 audioAt 随参数联动（听感由人工录音验收）
const audioRes = await page.evaluate(async () => {
  const L = window.__LAB, out = {};
  const btn = document.getElementById('audioBtn');
  out.exists = !!btn;
  btn.click();                                          // 打开
  await new Promise(r => setTimeout(r, 200));
  out.on = btn.classList.contains('on');
  out.saved = localStorage.getItem('lab-audio');
  const raf2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const read = () => { const e = L.current().exp; return e && typeof e.audioAt === 'function' ? e.audioAt(L.store.simTime) : null; };
  const blkByLabel = part => [...document.querySelectorAll('.param-block')].find(b => {
    const s = b.querySelector('.param-head span'); return s && s.textContent.includes(part); });
  const slider = async (labelPart, to) => {
    const blk = blkByLabel(labelPart); if (!blk) return false;
    const input = blk.querySelector('input[type=range]'); if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(to));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await raf2(); return true;
  };
  const toggleParam = async labelPart => {              // 滑杆打到对侧极值 / 枚举点到另一档，通吃两类控件
    const blk = blkByLabel(labelPart); if (!blk) return null;
    const pid = blk.dataset.pid;
    const input = blk.querySelector('input[type=range]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      const to = Math.abs(parseFloat(input.value) - parseFloat(input.min)) < 1e-9 ? input.max : input.min;
      setter.call(input, String(to));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await raf2(); return String(to);
    }
    const cand = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid !== String(L.store.params[pid]));
    if (!cand) return null;
    cand.click(); await raf2(); return cand.dataset.oid;
  };
  L.switch('A1-incline-speed'); await new Promise(r => setTimeout(r, 800));
  out.silentOnA1 = read() === null;
  L.switch('C2-sound-chars'); await new Promise(r => setTimeout(r, 800));
  const c2a = read();
  const pitch = L.DATA().byId['C2-sound-chars'].params.find(p => p.type !== 'enum' && /音调|频率|freq/i.test(p.label || p.id));
  let c2b = null;
  if (pitch) { await slider(pitch.label, Math.abs(pitch.default - pitch.min) < 1e-9 ? pitch.max : pitch.min); c2b = read(); }
  out.c2 = { mode: c2a && c2a.mode, freqA: c2a && c2a.freq, freqB: c2b && c2b.freq,
    ok: !!(c2a && c2a.mode === 'tone' && isFinite(c2a.freq) && c2b && isFinite(c2b.freq) && c2b.freq !== c2a.freq) };
  L.switch('C1-sound-medium'); await new Promise(r => setTimeout(r, 800));
  const c1a = read();
  await toggleParam('介质');
  const c1b = read();
  out.c1 = { mode: c1a && c1a.mode, ivA: c1a && c1a.interval, ivB: c1b && c1b.interval,
    ok: !!(c1a && c1a.mode === 'pulse' && c1a.interval > 0 && c1b && c1b.interval > 0 && c1b.interval !== c1a.interval) };
  L.switch('C3-noise-control'); await new Promise(r => setTimeout(r, 800));
  const c3a = read();
  const fA = c3a && c3a.filterHz;
  await toggleParam('隔声材料');                        // C3 的降噪由隔声材料档位（dB）承载
  const c3b = read();
  const fB = c3b && c3b.filterHz;
  out.c3 = { mode: c3a && c3a.mode, gA: c3a && c3a.gain, gB: c3b && c3b.gain, fA, fB,
    ok: !!(c3a && c3a.mode === 'noise' && c3b && c3b.mode === 'noise' &&
           (c3b.gain !== c3a.gain || fB !== fA)) };
  btn.click();                                          // 恢复关闭
  await new Promise(r => setTimeout(r, 100));
  out.off = !btn.classList.contains('on') && localStorage.getItem('lab-audio') === '0';
  out.ok = !!(out.exists && out.on && out.saved === '1' && out.silentOnA1 && out.c2.ok && out.c1.ok && out.c3.ok && out.off);
  return out;
});
if (audioRes.ok) {
  md += `- 音频引擎：开关开/关+localStorage 记忆 ✅；非声学场景返回 null 静音 ✅；C2 tone（freq 跟音调 ${audioRes.c2.freqA}→${audioRes.c2.freqB}）✅；C1 pulse（interval ${audioRes.c1.ivA}→${audioRes.c1.ivB} 随介质）✅；C3 noise（gain ${audioRes.c3.gA}→${audioRes.c3.gB}、filterHz ${audioRes.c3.fA}→${audioRes.c3.fB} 隔声材料）✅。\n`;
} else {
  md += `- 音频引擎：❌ ${JSON.stringify(audioRes)}\n`;
}
// ammo.js 惰性加载：首屏不下载；默认路径解析式场景（A1/A3/A6）切换不触发；刚体场景（A7/A2）共享一次注入；
// 缓存复用（两个刚体场景合计注入 ≤1）；全新页面首进刚体场景有遮罩且会消失
const rigidIds = ['A7-lever', 'A2-newton-first'];
const pre = netLog.length;
for (const id of ['A1-incline-speed', 'A3-friction', 'A6-energy']) {   // 默认路径解析式：硬断言 0 新增
  await page.evaluate(i => window.__LAB.switch(i), id); await sleep(700);
}
const analyticDelta = netLog.length - pre;
for (const id of rigidIds) { await page.evaluate(i => window.__LAB.switch(i), id); await sleep(1200); }
const overlayGone = await page.evaluate(() => { const o = document.getElementById('ammoLoad'); return !o || o.style.display === 'none'; });
const viaHook = await page.evaluate(() => window.__LAB.ammoRequests ? window.__LAB.ammoRequests() : null);
// 全新页面（清缓存语义）首进刚体场景：遮罩必须出现→消失（headless 下 asm.js 可能秒解析，遮罩一闪而过；
// 以「注入恰好发生在进入刚体场景之后」为硬证据，遮罩 seen 记录但不否决——防空转等待把加载期错过）
const ovFirst = await (async () => {
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
  const bootAfterReload = await page.evaluate(() => window.__LAB.ammoRequests());
  let seen = false;
  const switchP = page.evaluate(() => window.__LAB.switch('A2-newton-first'));
  for (let i = 0; i < 20; i++) { seen = await page.evaluate(() => { const o = document.getElementById('ammoLoad'); return !!o && o.style.display !== 'none'; }); if (seen) break; await sleep(60); }
  await switchP; await sleep(600);
  const gone = await page.evaluate(() => { const o = document.getElementById('ammoLoad'); return !o || o.style.display === 'none'; });
  return { seen, gone, injects: await page.evaluate(() => window.__LAB.ammoRequests()), bootAfterReload };
})();
const lazyOK = atBoot === 0 && analyticDelta === 0 && viaHook <= 1 && ovFirst.gone && ovFirst.injects === 1 && ovFirst.bootAfterReload === 0;
if (lazyOK) {
  md += `- ammo.js 惰性加载：首屏 ${atBoot} 次（应为 0）、默认路径 A1/A3/A6 切换新增 ${analyticDelta} 次（应为 0）、刚体场景 ${rigidIds.join('/')} 合计注入 ${viaHook} 次（≤1，缓存复用）、全新页面首进 A2 遮罩出现→消失=${ovFirst.seen}→${ovFirst.gone}（headless 秒解析时 seen 允许为 false），✅。\n`;
} else {
  md += `- ammo.js 惰性加载：❌ 首屏 ${atBoot}、默认路径新增 ${analyticDelta}、注入 ${viaHook}、遮罩出现=${ovFirst.seen} 消失=${ovFirst.gone}、刷新后注入 ${ovFirst.injects}/首屏 ${ovFirst.bootAfterReload}（${netLog.join(', ') || '无 URL 记录'}）\n`;
}
// 刚体确定性（外壳侧）：进 A2 后 seek(0)→seek(duration) 连做两轮，末态小车世界位姿必须逐位一致。
// 正好覆盖 bridge reset() 还原不完整（丢初速/休眠标志）这类缺陷——还原不完整时第二轮末态必漂移。
const det = await page.evaluate(async () => {
  const L = window.__LAB;
  await L.switch('A2-newton-first');
  await new Promise(r => setTimeout(r, 1500));           // 等引擎就绪（首次含解析）
  const pose = () => { const c = L.current().exp; const b = c && (c.block || c.cartG || (c._impl && (c._impl.block || c._impl.cartG))); if (!b) return null;
    const p = b.position, q = b.quaternion; return [p.x, p.y, p.z, q.x, q.y, q.z, q.w].map(v => +v.toFixed(6)).join(','); };
  if (!pose()) return { ok: false, note: 'no cart root' };
  const d = L.current().exp.duration;
  if (!Number.isFinite(d) || d <= 0) return { ok: false, note: 'duration ' + d };
  await L.current().exp.seek(0);
  await new Promise(r => setTimeout(r, 100));
  await L.current().exp.seek(d); await new Promise(r => setTimeout(r, 150));
  const a1 = pose();
  await L.current().exp.seek(0);
  await new Promise(r => setTimeout(r, 100));
  await L.current().exp.seek(d); await new Promise(r => setTimeout(r, 150));
  const a2 = pose();
  return { ok: a1 === a2, a1, a2 };
});
if (det.ok) {
  md += `- A2 刚体确定性（外壳侧）：seek(0)→seek(duration) 两轮末态位姿逐位一致（${(det.a1 || '').slice(0, 40)}…），✅。\n`;
} else {
  md += `- A2 刚体确定性（外壳侧）：❌ ${det.note || ('末态漂移：' + det.a1 + ' vs ' + det.a2)}\n`;
}
// 刚体物理量通用门禁（CEO 定，不特指 A2）：seek 到末态后，「刚体实测停止距离」与解析式 v0²/(2μg) 偏差必须 ≤5%。
// 引擎只能让画面更真，不能把物理量做错；摩擦 combine 错误（默认相乘致 μ 减半）这类 bug 在此必红。
// 刚体物理量通用门禁（CEO 定，不特指 A2）：seek 到末态后，「刚体实测停止距离」与解析式 v0²/(2μg) 比对。
// 容差口径（CEO 定）：|实测−理论| ≤ max(5%×理论, 0.03m)——0.03m 吸收 Bullet 60Hz 离散步长与初始穿透地板；
// 真 bug（如摩擦 combine 错误 Δ=1.09m、零点错位 Δ=0.1m）远超此容差，照样报红。
const physGate = await page.evaluate(async () => {
  const L = window.__LAB;
  const c = L.current().exp;
  const e = c && (c._impl || c);                        // 实例字段（sel/t/duration）在 impl 上，公共接口只有方法
  if (!e || L.store.experimentId !== 'A2-newton-first') return { skip: true };
  const Gc = 9.8;
  const h = L.store.params.height != null ? L.store.params.height : 0.15;
  const v0 = Math.sqrt(2 * Gc * h);
  const mu = e.sel ? e.sel.mu : null;
  if (mu == null || mu <= 1e-6) return { skip: true, note: 'surface mu=' + mu };
  const th = v0 * v0 / (2 * mu * Gc);
  await c.seek(c.duration); await new Promise(r => setTimeout(r, 200));
  const ro = c.readouts().reduce((m, it) => (m[it.label] = it.value, m), {});
  const dist = ro['当前位移 s'];
  if (typeof dist !== 'number') return { skip: true, note: 's readout missing' };
  const tol = Math.max(0.05 * th, 0.03);
  const dev = Math.abs(dist - th);
  return { ok: dev <= tol, th: +th.toFixed(3), dist: +dist.toFixed(3), dev: +dev.toFixed(4), tol: +tol.toFixed(3) };
});
if (physGate.skip) {
  md += `- 刚体物理量门禁（位移 vs 解析式）：${physGate.note || '当前场景未启用刚体门禁'}，跳过。\n`;
} else if (physGate.ok) {
  md += `- 刚体物理量门禁（位移 vs 解析式）：停止距离 ${physGate.dist}m vs v0²/2μg=${physGate.th}m，|Δ|=${physGate.dev}m ≤ max(5%×理论, 0.03)=${physGate.tol}m，✅。\n`;
} else {
  md += `- 刚体物理量门禁（位移 vs 解析式）：❌ 停止距离 ${physGate.dist}m vs ${physGate.th}m，|Δ|=${physGate.dev}m > ${physGate.tol}m（摩擦 combine / 零点 / 参数错）\n`;
}
// A2 三档统一口径（CEO 定）：同一份代码、同一轮探针跑完，三组停止距离一次报全（毛巾/棉布/木板）。
const threeSurf = await page.evaluate(async () => {
  const L = window.__LAB;
  const c = L.current().exp;
  const e = c && (c._impl || c);
  if (!e || L.store.experimentId !== 'A2-newton-first') return { skip: true };
  const Gc = 9.8;
  const h = L.store.params.height != null ? L.store.params.height : 0.15;
  const v0 = Math.sqrt(2 * Gc * h);
  const surf = { '毛巾': 0.60, '棉布': 0.30, '木板': 0.12 };
  const out = [];
  const selPid = 'surface';
  const meta = L.DATA().byId['A2-newton-first'];
  const opt = v => meta.params.find(p => p.id === selPid).options.find(o => Math.abs(o.value - v) < 1e-9);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  for (const [label, mu] of Object.entries(surf)) {
    const o = opt(mu); if (!o) return { skip: true, note: 'option missing ' + mu };
    const blk = document.querySelector('.param-block[data-pid="surface"]');
    const btn = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === String(o.value));
    if (!btn) return { skip: true, note: 'control missing ' + o.value };
    btn.click(); await new Promise(r => setTimeout(r, 400));
    await c.seek(c.duration); await new Promise(r => setTimeout(r, 250));
    const ro = c.readouts().reduce((m, it) => (m[it.label] = it.value, m), {});
    const dist = ro['当前位移 s'];
    const th = v0 * v0 / (2 * mu * Gc);
    const d = Math.abs(dist - th);
    out.push({ label, mu, dist: +dist.toFixed(3), th: +th.toFixed(3), d: +d.toFixed(4),
      ok: d <= Math.max(0.05 * th, 0.03) });
  }
  // 恢复默认棉布
  const def = meta.params.find(p => p.id === selPid).default;
  const blk = document.querySelector('.param-block[data-pid="surface"]');
  const btn = [...blk.querySelectorAll('.seg button'), ...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === String(def));
  if (btn) btn.click();
  return { rows: out, gaps: out.length === 3 ? [
    { pair: out[0].label + '→' + out[1].label, pct: +(((out[1].dist - out[0].dist) / Math.max(out[0].dist, 1e-9)) * 100).toFixed(1) },
    { pair: out[1].label + '→' + out[2].label, pct: +(((out[2].dist - out[1].dist) / Math.max(out[1].dist, 1e-9)) * 100).toFixed(1) } ] : null };
});
if (threeSurf.skip) {
  md += `- A2 三档统一口径（同一轮）：${threeSurf.note || '当前非 A2'}，跳过。\n`;
} else {
  const line = threeSurf.rows.map(r => `${r.label} μ${r.mu} ${r.dist}m（理论 ${r.th}m，|Δ|=${r.d}m ${r.ok ? '✅' : '❌'}）`).join('；');
  const gaps = threeSurf.gaps ? `，两两差距 ${threeSurf.gaps.map(g => g.pair + ' +' + g.pct + '%').join('、')}` : '';
  md += `- A2 三档统一口径（同一轮）：${line}${gaps}。\n`;
}
fs.writeFileSync(path.join(ROOT, 'ui-probe-report.md'), md, 'utf8');
console.log(`total=${total} delivered=${delivered}`);
console.log(md.split('\n').filter(l => l.includes('❌')).join('\n') || 'ALL DELIVERED');
await browser.close(); server.close();
