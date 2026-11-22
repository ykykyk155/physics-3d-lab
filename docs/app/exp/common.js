/* 公共 3D 工具：材质 / 几何 / 标签 / 力矢箭头 / 粗线。
 * 所有实验共用，禁止外部资源。 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* 色彩 token 单一来源（附录 B.2 / B.8）：
 * - 五科识别色：UI 经 moduleColor() 注入 --tab-c/--tab-rgb，3D 数据元素直接读；
 * - bg/primary：与 :root CSS 变量同值双载体，外壳启动时自检防漂移；
 * - 教学功能色：白名单语义 token，个别值与识别色巧合相同，语义独立、禁止互相引用；
 * - 局部一次性材质色（木纹/金属/液体区分等）留在各文件材质表（props.js MATS），不入此表。 */
export const COLORS = {
  mechanics: '#F59E0B',
  electricity: '#FACC15',
  optics: '#A78BFA',
  acoustics: '#34D399',
  thermal: '#FB7185',
  bg: '#0B1120',          // 场景背景与雾色；= :root --color-bg
  primary: '#3B82F6',     // 模块色缺失时兜底；= :root --color-primary
  neutral: '#5B6B85',     // 中性参考线/结构件（2026-11 提亮后上限放宽）
  ink: '#E6EDF7',         // 3D 标签默认文字色
  energyEk: '#34D399',    // A6 动能条（与声学绿同值，语义独立）
  energyEp: '#60A5FA',    // A6 势能条
  slideRail: '#60A5FA',   // A2 滑梯顶部包边管/护栏（--color-primary-hover，暂与 energyEp 同值，语义独立）
  slideDeck: '#323F5C',   // A2 滑梯起滑平台（= :root --color-surface）
  slideStep: '#3C4A6B',   // A2 滑梯台阶（= :root --color-surface-hover）
  altPink: '#F0ABFC',     // 次级数据粉：次级光路 / 反向电流 / 图线动点 / 焦点标记
  currentFwd: '#A78BFA',  // D7 正向电流（与光学紫同值，语义独立）
};

/* hex → rgba 字符串：DOM 叠加层引用同源背景色用（如 A2 图例） */
export function rgba(hex, a){
  const h = hex.replace('#','');
  return 'rgba(' + parseInt(h.slice(0,2),16) + ',' + parseInt(h.slice(2,4),16) + ',' + parseInt(h.slice(4,6),16) + ',' + a + ')';
}

export const DEG = Math.PI / 180;
export const G = 9.8;

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness != null ? opts.roughness : 0.55,
    metalness: opts.metalness != null ? opts.metalness : 0.05,
    transparent: !!opts.transparent,
    opacity: opts.opacity != null ? opts.opacity : 1,
    emissive: opts.emissive != null ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 1,
    side: opts.side || THREE.FrontSide,
    depthWrite: opts.depthWrite != null ? opts.depthWrite : true,
  });
}

/* 投影口径：只有需要看位置关系的结构性实体投影（斜面、物块、容器、透镜、磁铁）。
 * 透明体（水、玻璃、气团、波壳）与装饰体（描点、刻度、脉冲、游标）一律不投影，
 * 否则阴影 pass 里会多出成打的 draw call，而画面上根本看不出对应阴影。 */
export function decor(m) { if (m) { m.castShadow = false; m.receiveShadow = false; } return m; }
function shade(m, transparent) { m.castShadow = !transparent; m.receiveShadow = true; return m; }

export function box(w, h, d, color, opts = {}) {
  return shade(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, opts) : color), !!opts.transparent);
}
export function cyl(rt, rb, h, color, opts = {}) {
  return shade(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, opts.seg || 24, 1, !!opts.open), typeof color === 'string' ? mat(color, opts) : color), !!opts.transparent);
}
export function sphere(r, color, opts = {}) {
  return shade(new THREE.Mesh(new THREE.SphereGeometry(r, opts.seg || 24, opts.seg2 || 16), typeof color === 'string' ? mat(color, opts) : color), !!opts.transparent);
}
export function torus(r, tube, color, opts = {}) {
  return shade(new THREE.Mesh(new THREE.TorusGeometry(r, tube, opts.tseg || 10, opts.seg || 32), typeof color === 'string' ? mat(color, opts) : color), !!opts.transparent);
}

/* ---------- CSS2D 标签 ---------- */
export function mkLabel(text, color) {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText =
    'font:600 12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;' +
    'color:' + (color || COLORS.ink) + ';white-space:nowrap;' +
    'background:rgba(11,17,32,.74);border:1px solid rgba(255,255,255,.14);' +
    'padding:1px 6px;border-radius:6px;pointer-events:none;';
  const o = new CSS2DObject(div);
  o.userData.div = div;
  return o;
}
export function setLabel(o, text) { if (o && o.userData.div) o.userData.div.textContent = text; }

/* ---------- 力矢箭头 ---------- */
export function mkArrow(color) {
  const a = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1, new THREE.Color(color), 0.24, 0.12);
  a.line.material.depthWrite = false;
  a.line.material.depthTest = false;
  a.line.renderOrder = 20;
  if (a.cone) { a.cone.material.depthWrite = false; a.cone.material.depthTest = false; a.cone.renderOrder = 20; }
  return a;
}
export function setArrow(a, dir, len) {
  if (len <= 1e-4) { a.visible = false; return; }
  a.visible = true;
  a.setDirection(dir.clone().normalize());
  a.setLength(len, Math.min(0.28, len * 0.34), Math.min(0.15, len * 0.2));
}

/* ---------- 粗线（Line2，像素线宽） ---------- */
const _lineMats = [];
export function fatLine(points, color, width = 2.5, opts = {}) {
  const pts = (points && points.length >= 2) ? points : [points[0] || new THREE.Vector3(), points[0] || new THREE.Vector3()];
  const geo = new LineGeometry();
  geo.setPositions(flatten(pts));
  const m = new LineMaterial({
    color: new THREE.Color(color),
    linewidth: width,
    transparent: opts.opacity != null && opts.opacity < 1,
    opacity: opts.opacity != null ? opts.opacity : 1,
    dashed: !!opts.dashed,
    dashSize: 0.15, gapSize: 0.1,
    depthWrite: false,
  });
  m.resolution.set(window.innerWidth, window.innerHeight);
  _lineMats.push(m);
  const line = new Line2(geo, m);
  line.frustumCulled = false;   // 避免单点/退化线各帧重算包围球触发 NaN 告警
  line.computeLineDistances();
  line.userData.fat = true;
  return line;
}
export function setFatLine(line, points) {
  // 过滤非有限坐标：构建期参数尚未全部就绪时可能传入 NaN，避免 LineGeometry 重算包围球报 NaN
  const clean = (points || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z));
  const pts = clean.length >= 2 ? clean : (clean.length === 1 ? [clean[0], clean[0].clone()] : [new THREE.Vector3(), new THREE.Vector3()]);
  line.geometry.setPositions(flatten(pts));
  line.computeLineDistances();
  line.geometry.attributes.instanceStart && (line.geometry.attributes.instanceStart.needsUpdate = true);
}
export function updateLineResolution() {
  const w = window.innerWidth, h = window.innerHeight;
  for (const m of _lineMats) { if (m && m.resolution) m.resolution.set(w, h); }
}
export function flatten(points) {
  const a = [];
  for (const p of points) { a.push(p.x, p.y, p.z); }
  return a;
}

/* ---------- 通用：接地网格 + 底座 ---------- */
export function addGround(scene, color) {
  const grid = new THREE.GridHelper(16, 32, color || 0x31405c, 0x1c2738);
  grid.position.y = -0.001;
  grid.material.transparent = true; grid.material.opacity = 0.5;
  scene.add(grid);
  return grid;
}
export function addBase(scene, color) {
  const base = box(10, 0.12, 6, color || '#26324a', { roughness: 0.9 });
  base.position.y = -0.06;
  base.receiveShadow = true;
  scene.add(base);
  return base;
}

/* ---------- 小件合并：把一组「同节拍运动」的小 mesh 按材质合桶，每桶 1 个 draw call ----------
 * 传进来的 mesh 不要已经 add 到场景里；返回一个 Group，请自己 add 到原父节点。
 * 只合一起运动的件（同属一个刚体/同一动画），会各自独立运动的件不能合。 */
export function mergeByMaterial(meshes) {
  const key = m => {
    const s = m.type + '|' + (m.color ? m.color.getHexString() : '') + '|' + (m.transparent ? 'T' + m.opacity.toFixed(3) : 'O') +
      '|' + (m.roughness != null ? m.roughness : '') + '|' + (m.metalness != null ? m.metalness : '') +
      '|' + (m.emissive ? m.emissive.getHexString() : '') + '|' + (m.emissiveIntensity != null ? m.emissiveIntensity : '');
    return s;
  };
  const buckets = new Map();
  for (const m of meshes) {
    m.updateMatrix();
    const g = m.geometry.clone().applyMatrix4(m.matrix);
    const k = key(m.material);
    if (!buckets.has(k)) buckets.set(k, { material: m.material, geos: [] });
    buckets.get(k).geos.push(g);
  }
  const grp = new THREE.Group();
  for (const { material, geos } of buckets.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (geos.length > 1) geos.forEach(g => g.dispose());
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = !material.transparent; mesh.receiveShadow = true;
    grp.add(mesh);
  }
  return grp;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

/* ---------- 右侧统计面板读数 ----------
 * 统一入口：格式化到固定小数位，并把 NaN / ±Infinity / null 换成 '—'。
 * 面板每 100ms 读一次、播放中数值每帧都在跳，任何一次透出 NaN 都会在界面上闪成 "NaN"，
 * 所以格式化与兜底放在这里做一次，各实验只报原始量，不再各写各的 toFixed。
 * digits=0 取整（压强、毫米汞柱这类大数用）。 */
export function rd(label, value, unit, digits = 2) {
  let v = value;
  if (typeof v === 'number') {
    v = Number.isFinite(v) ? (digits === 0 ? Math.round(v) : Number(v.toFixed(digits))) : '—';
  } else if (v == null) {
    v = '—';
  }
  return { label: label, value: v, unit: unit || '' };
}
export function lerp(a, b, t) { return a + (b - a) * t; }
export { THREE };
