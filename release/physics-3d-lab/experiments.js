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
  'A3-friction': { p: [0, 2.7, 5.3], t: [0, 1.0, 0] },
  'A4-liquid-pressure': { p: [1.5, 2.8, 6.0], t: [-0.2, 1.2, 0] },
  'A5-buoyancy': { p: [1.7, 3.3, 7.0], t: [0, 1.5, 0] },
  'A6-energy': { p: [1.0, 3.0, 6.6], t: [0.3, 1.5, 0] },
  'A7-lever': { p: [0, 3.0, 7.8], t: [0, 1.35, 0] },
  'B1-pinhole': { p: [0, 2.6, 6.4], t: [0, 0.9, 0] },
  'B2-reflection': { p: [0, 2.8, 6.0], t: [0, 0.6, 0] },
  'B3-plane-mirror': { p: [0, 1.4, 2.6], t: [0, 0.6, 0] },
  'B4-refraction': { p: [0, 3.2, 7.0], t: [0, 0, 0] },
  'B5-convex-lens': { p: [1.4, 2.3, 6.2], t: [0.3, 1.1, 0] },
  'C1-sound-medium': { p: [0, 3.2, 7.0], t: [0, 1.8, 0] },
  'C2-sound-chars': { p: [0, 2.0, 7.4], t: [0, 2.0, 0] },
  'C3-noise-control': { p: [0, 2.8, 8.6], t: [0, 1.1, 0] },
  'D1-series-parallel': { p: [0, 2.1, 6.2], t: [0, 1.55, 0] },
  'D2-resistance-factor': { p: [0, 2.2, 5.8], t: [0.3, 1.3, 0] },
  'D3-rheostat-lamp': { p: [0, 2.0, 5.2], t: [0, 1.4, 0] },
  'D4-ohm-law': { p: [0.3, 2.6, 8.6], t: [0.2, 1.5, 0] },
  'D5-power-joule': { p: [0, 2.2, 5.4], t: [0, 1.0, 0] },
  'D6-magnet-solenoid': { p: [0, 2.8, 7.0], t: [0, 1.5, 0] },
  'D7-motor-generator': { p: [0, 2.4, 5.6], t: [0, 1.5, 0] },
  'F1-melting-curve': { p: [0, 2.6, 8.2], t: [-0.4, 1.7, 0] },
  'F2-boiling': { p: [0, 2.2, 5.6], t: [0, 1.2, 0] },
  'F3-heat-engine': { p: [0, 2.6, 8.2], t: [-0.2, 1.6, 0] },
};

export const EXPERIMENTS = {};
for (const id in RAW) {
  const impl = RAW[id];
  const cam = CAM[id];
  const api = {
    build(ctx) {
      impl.build(ctx);
      if (cam && ctx.camera && ctx.controls && ctx.controls.target) {
        ctx.camera.position.set(cam.p[0], cam.p[1], cam.p[2]);
        ctx.controls.target.set(cam.t[0], cam.t[1], cam.t[2]);
        ctx.camera.lookAt(ctx.controls.target);
        if (ctx.controls.update) ctx.controls.update();
      }
    },
    onParam(k, v) { impl.onParam(k, v); },
    step(dt) { if (impl.step) impl.step(dt); },
    reset() { if (impl.reset) impl.reset(); },
    dispose() { if (impl.dispose) impl.dispose(); },
    // 时间轴接口：duration = 演示总时长（秒），0 表示无时间演化；
    // seek(t) 把状态设到 t 秒并重绘（确定性、可反复调用）
    seek(t) { if (typeof impl.seek === 'function') impl.seek(t); },
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
