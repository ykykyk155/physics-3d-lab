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
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
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
fs.writeFileSync(path.join(ROOT, 'ui-probe-report.md'), md, 'utf8');
console.log(`total=${total} delivered=${delivered}`);
console.log(md.split('\n').filter(l => l.includes('❌')).join('\n') || 'ALL DELIVERED');
await browser.close(); server.close();
