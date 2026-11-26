/* 实验注册表 + 逐场景机位表（拉近、居中）。键 = 附录 A 的 id。 */
import { MECHANICS } from './exp/mechanics.js';
import { OPTICS } from './exp/optics.js';
import { ACOUSTICS } from './exp/acoustics.js';
import { ELECTRICITY } from './exp/electricity.js';
import { THERMAL } from './exp/thermal.js';
import { updateLineResolution } from './exp/common.js';

const RAW = Object.assign({}, MECHANICS, OPTICS, ACOUSTICS, ELECTRICITY, THERMAL);

// p=相机位置, t=观察目标；已按“内容占画面约 70%、居中”逐个收紧
const CAM = {
  'A1-incline-speed': { p: [2.4, 2.2, 3.6], t: [0.5, 0.15, 0] },
  'A2-newton-first': { p: [-0.4, 5.0, 7.2], t: [-0.4, 0.25, 0] },
  'A3-friction': { p: [1.6, 2.7, 5.3], t: [1.6, 0.9, 0] },   // 居中到行程中段：木块+水平测力计拉到 x≈5.2 仍在画面内
  'A4-liquid-pressure': { p: [1.70, 2.99, 6.72], t: [-0.2, 1.2, 0] },   // 拉远 12%：右侧 U 形管别落进统计面板
  'A5-buoyancy': { p: [1.7, 3.3, 7.0], t: [0, 1.5, 0] },
  'A6-energy': { p: [1.0, 3.0, 6.6], t: [0.3, 1.5, 0] },
  'A7-lever': { p: [0, 3.08, 8.19], t: [0, 1.35, 0] },   // 拉远 5%：梁端别贴到统计面板
  'B1-pinhole': { p: [0, 2.6, 6.4], t: [0, 0.9, 0] },
  'B2-reflection': { p: [0, 2.8, 6.0], t: [0, 0.6, 0] },
  'B3-plane-mirror': { p: [0, 1.4, 2.6], t: [0, 0.6, 0] },
  'B4-refraction': { p: [0, 3.2, 7.0], t: [0, 0, 0] },
  'B5-convex-lens': { p: [1.4, 2.3, 6.2], t: [0.3, 1.1, 0] },
  'C1-sound-medium': { p: [0, 3.2, 7.0], t: [0, 1.8, 0] },
  'C2-sound-chars': { p: [0, 2.0, 8.29], t: [0, 2.0, 0] },   // 拉远 12%：示波器面板 6 单位宽
  'C3-noise-control': { p: [0, 3.06, 9.89], t: [0, 1.1, 0] },   // 拉远 15%：反射墙在 x=4，别落进统计面板
  'D1-series-parallel': { p: [0, 2.6, 9.2], t: [0, 2.0, 0] },   // 拉长 1.32× 后拉远：整电路+双表+顶栏不裁切
  'D2-resistance-factor': { p: [0, 2.2, 5.8], t: [0.3, 1.3, 0] },
  'D3-rheostat-lamp': { p: [0, 2.07, 5.82], t: [0, 1.4, 0] },   // 拉远 12%
  'D4-ohm-law': { p: [0.3, 2.6, 8.6], t: [0.2, 1.5, 0] },
  'D5-power-joule': { p: [0, 2.2, 5.4], t: [0, 1.0, 0] },
  'D6-magnet-solenoid': { p: [0, 2.8, 7.0], t: [0, 1.5, 0] },
  'D7-motor-generator': { p: [0, 2.4, 5.6], t: [0, 1.5, 0] },
  'F1-melting-curve': { p: [0, 2.6, 8.2], t: [-0.4, 1.7, 0] },
  'F2-boiling': { p: [0, 2.2, 5.6], t: [0, 1.2, 0] },
  'F3-heat-engine': { p: [0, 2.6, 8.2], t: [-0.2, 1.6, 0] },
};

export const EXPERIMENTS = {};
/* ---------- 右侧统计面板的遮挡补偿 ----------
 * 统计面板是浮在 3D 视区右侧的一层（桌面端约 236px，可收起），会盖住画面右边一条。
 * 不改画布尺寸、不改 FOV（那会把场景横向裁掉），而是把相机和观察目标一起沿「相机右向量」
 * 平移，让内容居中到未被遮挡的那块区域。平移量 = 遮挡宽度的一半。
 * 面板收起时遮挡为 0，视图自动回到正中；用 ResizeObserver 跟随开合，且只补「变化量」，
 * 不重置用户已经拖出来的视角。 */
let _curInset = 0;
let _ctx = null;

function panelInset() {
  const p = document.getElementById('stats');
  const vp = document.getElementById('viewport');
  if (!p || !vp) return 0;
  const pr = p.getBoundingClientRect(), vr = vp.getBoundingClientRect();
  if (pr.width < 40 || pr.height < 40) return 0;           // 已收起
  if (pr.left < vr.left + vr.width * 0.55) return 0;       // 不是右侧浮层（例如窄屏抽屉）就不算
  return Math.max(0, Math.min(pr.width, vr.right - pr.left));
}

function shiftByPx(ctx, px) {
  if (!ctx || !ctx.camera || !ctx.controls || !px) return;
  const cam = ctx.camera, tgt = ctx.controls.target;
  if (!cam || !tgt || !tgt.isVector3) return;
  cam.updateMatrixWorld(true);
  const el = ctx.renderer && ctx.renderer.domElement;
  const h = (el && el.clientHeight) ? el.clientHeight : 700;
  const dist = cam.position.distanceTo(tgt);
  if (!(dist > 1e-6)) return;
  const worldPerPx = (2 * Math.tan((cam.fov || 50) * Math.PI / 360) * dist) / h;
  const d = px * worldPerPx;
  const m = cam.matrixWorld.elements;                       // 第 0 列 = 相机右向量
  cam.position.set(cam.position.x + m[0] * d, cam.position.y + m[1] * d, cam.position.z + m[2] * d);
  tgt.set(tgt.x + m[0] * d, tgt.y + m[1] * d, tgt.z + m[2] * d);
  if (ctx.controls.update) ctx.controls.update();
}

function syncPanelInset(ctx) {
  const want = panelInset();
  const delta = want - _curInset;
  _curInset = want;
  if (delta) shiftByPx(ctx || _ctx, delta / 2);             // 遮挡宽的一半 = 内容需要左移的像素
}

if (typeof window !== 'undefined' && typeof ResizeObserver !== 'undefined') {
  const attach = () => {
    const st = document.getElementById('stats');
    if (!st) return setTimeout(attach, 300);
    new ResizeObserver(() => syncPanelInset(_ctx)).observe(st);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
}

for (const id in RAW) {
  const impl = RAW[id];
  const cam = CAM[id];
  const api = {
    // 调试/探针只读句柄：拿到场景实现实例本身（api 只暴露公共接口，位姿等内部状态在 impl 上）。
    // 只读约定：探针不许通过它改状态；场景代码也不该用它当后门。
    _impl: impl,
    build(ctx) {
      impl.build(ctx);
      _ctx = ctx;
      _curInset = 0;                                        // 每个场景都是全新相机，从 0 起算
      if (cam && ctx.camera && ctx.controls && ctx.controls.target) {
        ctx.camera.position.set(cam.p[0], cam.p[1], cam.p[2]);
        ctx.controls.target.set(cam.t[0], cam.t[1], cam.t[2]);
        ctx.camera.lookAt(ctx.controls.target);
        if (ctx.controls.update) ctx.controls.update();
        syncPanelInset(ctx);                                // 再按面板实际遮挡量居中
      }
    },
    onParam(k, v) { impl.onParam(k, v); },
    step(dt) { if (impl.step) impl.step(dt); },
    reset() { if (impl.reset) impl.reset(); },
    dispose() { if (impl.dispose) impl.dispose(); },
    // 时间轴接口：duration = 演示总时长（秒），0 表示无时间演化；
    // seek(t) 把状态设到 t 秒并重绘（确定性、可反复调用）
    seek(t) { if (typeof impl.seek === 'function') impl.seek(t); },
    // 右侧统计面板：[] 不是 null，外壳可以无脑遍历；NaN/Infinity 在这里兜成 '—'，
    // 免得某个实验漏了一条分支就在界面上闪出 "NaN"。
    // 面板每 100ms 拉一次，所以这里只读状态、绝不许有副作用。
    readouts() {
      const f = impl.readouts;
      if (typeof f !== 'function') return [];
      let rows;
      try { rows = f.call(impl); } catch (e) { return []; }
      if (!Array.isArray(rows)) return [];
      return rows.filter(r => r && r.label).slice(0, 6).map(r => {
        let v = r.value;
        if (typeof v === 'number') v = Number.isFinite(v) ? v : '—';
        else if (v == null) v = '—';
        return { label: String(r.label), value: v, unit: r.unit == null ? '' : String(r.unit) };
      });
    },
    // 三段平均速度数据表接口（A1）：返回完整分段数据，供前端数据表直接消费；
    // 不受 readouts 6 行上限限制。字段见 exp/mechanics.js A1.segments()。
    segments() { if (typeof impl.segments === 'function') return impl.segments(); return null; },
    // D1 双表点选换位 / 数据记录程序接口（其他实验返回安全默认值，外壳可统一调用）
    placeMeter(m, slot) { return typeof impl.placeMeter === 'function' ? impl.placeMeter(m, slot) : false; },
    getMeterState() { return typeof impl.getMeterState === 'function' ? impl.getMeterState() : null; },
    toggleSwitch() { return typeof impl.toggleSwitch === 'function' ? impl.toggleSwitch() : null; },
    recordSample() { return typeof impl.recordSample === 'function' ? impl.recordSample() : { ok: false, msg: '本实验不支持数据记录' }; },
    recordData() { return typeof impl.recordData === 'function' ? impl.recordData() : []; },
    clearRecords() { if (typeof impl.clearRecords === 'function') impl.clearRecords(); },
    // 声音：audioAt(t) → null（不出声）或 { mode:'tone'|'noise'|'pulse', gain, freq?, wave?, interval?, filterHz? }
    // 外壳每帧都会调，所以这里只做校验和兜底：gain 非法 / 非正一律回 null（当成静音），
    // 频率、间隔、截止频率都钳到能用的范围。不做缓存、不产生副作用。
    audioAt(t) {
      const f = impl.audioAt;
      if (typeof f !== 'function') return null;
      let o;
      try { o = f.call(impl, Number.isFinite(t) ? t : 0); } catch (e) { return null; }
      if (!o || typeof o !== 'object') return null;
      const g = Number(o.gain);
      if (!Number.isFinite(g) || g <= 0) return null;
      const fin = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
      const out = { mode: (o.mode === 'noise' || o.mode === 'pulse') ? o.mode : 'tone', gain: Math.min(1, g) };
      const fr = fin(o.freq, 20, 20000); if (fr != null) out.freq = fr;
      if (typeof o.wave === 'string') out.wave = o.wave;
      const iv = fin(o.interval, 0.02, 10); if (iv != null) out.interval = iv;
      const fh = fin(o.filterHz, 20, 20000); if (fh != null) out.filterHz = fh;
      return out;
    },
  };
  // duration 由实验在 recompute 里按参数算；用 getter 实时取值。
  // Infinity（无界过程）必须原样透出，不能被 Number.isFinite 折成 0——那会误判成「无时间演化」
  Object.defineProperty(api, 'duration', {
    get() {
      const d = impl.duration;
      return (typeof d === 'number' && !Number.isNaN(d)) ? d : 0;
    },
    enumerable: true,
  });
  EXPERIMENTS[id] = api;
}

if (typeof window !== 'undefined') window.addEventListener('resize', updateLineResolution);

export default EXPERIMENTS;
