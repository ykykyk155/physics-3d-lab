/* 实物器材工厂：把「积木方块」换成一眼能认出的教学仪器。
 *
 * 三条硬约束（与公共层一致）：
 *   1. 每个工厂内部用 mergeByMaterial 把同材质的静态构件合成 1 个 draw call；
 *      只有需要独立运动的零件（轮子、指针、弹簧、活塞、摆球）才单独留 mesh。
 *   2. 不引入任何外部模型 / 贴图 / 字体，全部用基本几何体拼。
 *   3. 透明体（玻璃、水）不投影；装饰件（刻度线、色环）不投影。
 *
 * 材质语言集中在 MATERIALS 里，换配色只改这一处。
 */
import { THREE, mat, box, cyl, sphere, torus, decor, mergeByMaterial } from './common.js';

/* ---------- 材质语言（实物器材统一口径） ----------
 * MATERIALS 是常驻单例：25 个场景共用同一批材质对象，永不重建、永不释放。
 * 每个材质都标了 userData.shared = true，外壳 disposeObject 会跳过它们
 * （客户端工程师在加 PERSISTENT 白名单，材质级 shared 必须被识别）。
 *
 * 会随参数/动画改变自身属性的材质（灯丝亮度、玻璃泡透明度、燃烧室气体颜色）
 * 不能共用——共用会串场景。这类件用 matClone(name) 从池里克隆一份，
 * 克隆体是场景私有的，交给外壳正常释放。 */
export const MATERIALS = {
  wood:        mat('#8a5a2b', { roughness: 0.82, metalness: 0.02 }),
  woodDark:    mat('#5f3d1d', { roughness: 0.88, metalness: 0.02 }),
  woodLight:   mat('#b5854a', { roughness: 0.78, metalness: 0.02 }),
  steel:       mat('#b9c4d2', { roughness: 0.35, metalness: 0.85 }),
  steelBright: mat('#dfe7f2', { roughness: 0.18, metalness: 0.92 }),
  iron:        mat('#8a93a3', { roughness: 0.45, metalness: 0.78 }),
  copper:      mat('#B87346', { roughness: 0.38, metalness: 0.55 }),   // 铜：金属度压到 0.55，无 envMap 时才显出铜色
  aluminum:    mat('#c9d1da', { roughness: 0.42, metalness: 0.75 }),
  brass:       mat('#C9A24B', { roughness: 0.34, metalness: 0.6 }),   // 黄铜（接线柱/螺口/旋钮，规范色）
  rubber:      mat('#2b2f38', { roughness: 0.95, metalness: 0.03 }),
  rubberRed:   mat('#a83a3a', { roughness: 0.92, metalness: 0.03 }),
  plastic:     mat('#e8ecf2', { roughness: 0.50, metalness: 0.02 }),
  plasticDark: mat('#3a4150', { roughness: 0.62, metalness: 0.04 }),
  ceramic:     mat('#e6ddc6', { roughness: 0.70, metalness: 0.02 }),
  glass:       mat('#cfe3f5', { roughness: 0.06, metalness: 0.02, transparent: true, opacity: 0.24, depthWrite: false }),
  glassWall:   mat('#eaf6ff', { roughness: 0.03, metalness: 0.02, transparent: true, opacity: 0.10, depthWrite: false, side: THREE.FrontSide }),
  red:         mat('#d94a4a', { roughness: 0.45, metalness: 0.08 }),
  blue:        mat('#3b82f6', { roughness: 0.45, metalness: 0.08 }),
  white:       mat('#f2f5fa', { roughness: 0.55, metalness: 0.02 }),
  dark:        mat('#22283a', { roughness: 0.80, metalness: 0.05 }),
  water:       mat('#3b82f6', { roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.30, depthWrite: false }),
  flame:       mat('#ffb020', { roughness: 0.40, metalness: 0.00, emissive: '#ff8a00', emissiveIntensity: 1, transparent: true, opacity: 0.95 }),
  band:        mat('#d9a066', { roughness: 0.60, metalness: 0.10 }),   // 电阻色环
  needleRed:   mat('#C23B3B', { roughness: 0.40, metalness: 0.10 }),   // 表针 / 指示针
  candleWax:   mat('#f2e6cc', { roughness: 0.62, metalness: 0.02 }),   // 蜡身
  magnetN:     mat('#C23B3B', { roughness: 0.50, metalness: 0.10 }),   // 磁极 N（规范色）
  magnetS:     mat('#3B5BC2', { roughness: 0.50, metalness: 0.10 }),   // 磁极 S（规范色）
  mercury:     mat('#d94a4a', { roughness: 0.35, metalness: 0.05 }),   // 温度计液柱
  engineBlock: mat('#a7b6ca', { roughness: 0.30, metalness: 0.50, transparent: true, opacity: 0.62, depthWrite: false }), // 热机缸体（半透看活塞）
  engineHead:  mat('#8494ab', { roughness: 0.40, metalness: 0.45 }),   // 缸盖
  crankcase:   mat('#4a5568', { roughness: 0.60, metalness: 0.50 }),   // 曲轴箱
  pistonAlu:   mat('#dbe6f5', { roughness: 0.35, metalness: 0.25 }),   // 活塞
  pistonRing:  mat('#6f7b8e', { roughness: 0.45, metalness: 0.50 }),   // 活塞环
  leadWireRed: mat('#c23b3b', { roughness: 0.75, metalness: 0.05 }),   // 导线皮（红）
  leadWireBlk: mat('#2b2f38', { roughness: 0.78, metalness: 0.05 }),   // 导线皮（黑）
  glassTube:   mat('#C4D6DE', { roughness: 0.06, metalness: 0.02, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.FrontSide }), // 玻璃管/钟罩（淡青）
  ironDark:    mat('#4A4E55', { roughness: 0.5, metalness: 0.7 }),     // 镍铬丝深灰
  manganin:    mat('#c07a45', { roughness: 0.35, metalness: 0.8 }),    // 锰铜（橙铜）
  waterBlue:   mat('#4A90B8', { roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.55, depthWrite: false }), // 水体（分层的蓝）
  barrierGrey: mat('#3A3F45', { roughness: 0.9, metalness: 0.05 }),    // 隔音板（哑光中性深灰）
};
Object.values(MATERIALS).forEach(m => { m.userData.shared = true; });

/* 常驻池取用：静态构件直接引用，禁止在场景里 new */
export const MATS = {};
for (const k in MATERIALS) MATS[k] = () => MATERIALS[k];
/* 需要单独改属性的件：从池里克隆（克隆体私有，外壳正常释放） */
export function matClone(k) { return MATERIALS[k].clone(); }

/* 每个用到器材的场景在 build 里调一次：把常驻材质登记进外壳白名单。
 * 光有 userData.shared 不够——材质的贴图槽位还要靠 PERSISTENT 兜住。 */
export function registerMaterials(ctx) {
  if (ctx && typeof ctx.keep === 'function') ctx.keep.apply(null, Object.values(MATERIALS));
}

/* 合桶：默认投影；decorative=true 时不投影（刻度、色环、装饰件） */
function merged(meshes, decorative) {
  const g = mergeByMaterial(meshes);
  g.children.forEach(c => {
    c.castShadow = !decorative && !c.material.transparent;
    c.receiveShadow = !decorative;
  });
  return g;
}

/* ============ 小车（车身 + 四轮 + 车轴） ============
 * 轮子用 InstancedMesh（4 实例 = 1 draw call），rollCart() 每帧只改实例矩阵。 */
export function cart(opts = {}) {
  const L = opts.len != null ? opts.len : 0.62;
  const W = opts.wid != null ? opts.wid : 0.46;
  const r = opts.wheelR != null ? opts.wheelR : 0.115;
  const g = new THREE.Group();
  const wood = MATS.wood(), steel = MATS.steel(), rubber = MATS.rubber();
  const deckY = r * 1.25;
  const parts = [];
  // 车板 + 侧栏 + 前后挡板（同一块木头，1 个 draw call）
  const bed = box(L, 0.05, W, wood); bed.position.y = deckY; parts.push(bed);
  [-1, 1].forEach(s => {
    const rail = box(L, 0.12, 0.03, wood); rail.position.set(0, deckY + 0.085, s * (W / 2 - 0.015)); parts.push(rail);
    const end = box(0.03, 0.12, W, wood); end.position.set(s * (L / 2 - 0.015), deckY + 0.085, 0); parts.push(end);
  });
  // 车轴 + 轴座（钢件，1 个 draw call）
  [-1, 1].forEach(s => {
    const ax = cyl(0.016, 0.016, W + 0.05, steel); ax.rotation.x = Math.PI / 2; ax.position.set(s * L * 0.3, r, 0); parts.push(ax);
    const brk = box(0.05, 0.05, 0.05, steel); brk.position.set(s * L * 0.3, r * 1.15, 0); parts.push(brk);
  });
  g.add(merged(parts));
  // 四轮：胎 + 轮毂各 1 个 InstancedMesh
  const tireGeo = new THREE.TorusGeometry(r * 0.7, r * 0.3, 8, 18);
  const hubGeo = new THREE.CylinderGeometry(r * 0.4, r * 0.4, 0.035, 12); hubGeo.rotateX(Math.PI / 2);
  const tires = new THREE.InstancedMesh(tireGeo, rubber, 4);
  const hubs = new THREE.InstancedMesh(hubGeo, steel, 4);
  tires.castShadow = true; hubs.castShadow = false;
  tires.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hubs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const pos = [];
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => pos.push(new THREE.Vector3(sx * L * 0.3, r, sz * (W / 2 + 0.012)))));
  g.add(tires, hubs);
  g.userData.cart = { tires, hubs, pos, r };
  rollCart(g, 0);
  return g;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s3 = new THREE.Vector3(1, 1, 1);
const _zAxis = new THREE.Vector3(0, 0, 1);
export function rollCart(g, angle) {
  const u = g && g.userData && g.userData.cart; if (!u) return;
  _q.setFromAxisAngle(_zAxis, angle);
  for (let i = 0; i < u.pos.length; i++) {
    _m4.compose(u.pos[i], _q, _s3);
    u.tires.setMatrixAt(i, _m4); u.hubs.setMatrixAt(i, _m4);
  }
  u.tires.instanceMatrix.needsUpdate = true; u.hubs.instanceMatrix.needsUpdate = true;
}

/* ============ 电池组（两节干电池 + 电池盒 + 接线柱） ============ */
export function battery(opts = {}) {
  const cells = opts.cells || 2, h = opts.h || 0.46;
  const g = new THREE.Group();
  const body = MATS.plasticDark(), cap = MATS.brass(), holder = MATS.plastic();
  const parts = [], caps = [], holders = [], bands = [], marks = [];
  const gap = opts.gap || 0.34;                 // 节距拉开，能看清是多节电池
  for (let i = 0; i < cells; i++) {
    const x = (i - (cells - 1) / 2) * gap;
    const c = cyl(0.115, 0.115, h, body); c.position.set(x, h / 2, 0); parts.push(c);
    // 正极凸帽（上）+ 负极平底（下）
    const top = cyl(0.045, 0.045, 0.05, cap); top.position.set(x, h + 0.024, 0); caps.push(top);
    const bot = cyl(0.115, 0.115, 0.02, cap); bot.position.set(x, 0.01, 0); caps.push(bot);
    // 外壳分色标识带（每节一节颜色环）
    const bd = cyl(0.118, 0.118, h * 0.42, MATS.red()); bd.position.set(x, h * 0.52, 0); bands.push(bd);
    // 极性符号
    const plus = box(0.05, 0.014, 0.014, MATS.white()); plus.position.set(x, h * 0.78, 0.118); marks.push(plus);
    const plus2 = box(0.014, 0.05, 0.014, MATS.white()); plus2.position.set(x, h * 0.78, 0.118); marks.push(plus2);
  }
  g.add(merged(parts), merged(caps, true), merged(bands, true), merged(marks, true));
  // 电池盒底板 + 两节之间的隔板（让「多节并排」一眼可见）
  const base = box(cells * gap + 0.1, 0.04, 0.26, holder); base.position.set(0, -0.02, 0); holders.push(base);
  for (let i = 0; i < cells - 1; i++) {
    const x = (i - (cells - 2) / 2) * gap;
    const div = box(0.02, h * 0.7, 0.24, holder); div.position.set(x, h * 0.35, 0); holders.push(div);
  }
  g.add(merged(holders));
  g.userData.topY = h;
  return g;
}

/* ============ 小灯泡（玻璃泡 + 螺口 + 灯丝） ============ */
export function bulb(opts = {}) {
  const R = opts.r || 0.11;
  const g = new THREE.Group();
  // 玻璃泡透明度、灯丝亮度都会随电流变 → 必须是场景私有的克隆材质
  const glass = matClone('glass'); glass.opacity = 0.12;
  const brass = MATS.brass();
  const fil = matClone('flame');
  const shell = sphere(R, glass); shell.position.y = R * 1.5; shell.scale.set(1, 1.15, 1);
  const neck = cyl(R * 0.42, R * 0.5, R * 0.7, glass); neck.position.y = R * 0.65;
  const gGlass = merged([shell, neck], true);
  const screw = [];
  for (let i = 0; i < 3; i++) { const t = torus(R * 0.44, R * 0.07, brass); t.rotation.x = Math.PI / 2; t.position.y = R * 0.5 - i * R * 0.22; screw.push(t); }
  const tip = cyl(R * 0.3, R * 0.3, R * 0.14, brass); tip.position.y = -R * 0.15; screw.push(tip);
  const filParts = [];
  const f1 = box(0.016, R * 0.9, 0.016, fil); f1.position.y = R * 1.5; filParts.push(f1);
  const f2 = box(R * 0.5, 0.016, 0.016, fil); f2.position.y = R * 1.95; filParts.push(f2);
  const f3 = box(R * 0.5, 0.016, 0.016, fil); f3.position.y = R * 1.05; filParts.push(f3);
  const core = sphere(R * 0.22, fil); core.position.y = R * 1.5; filParts.push(core);
  g.add(gGlass, merged(screw), merged(filParts, true));
  g.userData.glass = gGlass.children[0];
  // 灯丝是合并后 Group 里的 mesh，取第一个 mesh（取 Group 本身没有 material）
  const filG = g.children[2];
  g.userData.filament = filG.isMesh ? filG : filG.children.find(c => c.isMesh);
  return g;
}
/* 灯丝亮度（0~1）：改 emissiveIntensity，不改物理 */
export function setBulbGlow(g, k) {
  const f = g && g.userData && g.userData.filament; if (!f) return;
  f.material.emissiveIntensity = 1.4 + k * 5.5;
  const gl = g.userData.glass;
  if (gl) { gl.material.opacity = 0.10 + k * 0.14; }
}

/* ============ 定值电阻（陶瓷体 + 色环 + 引线） ============ */
export function resistor(opts = {}) {
  const L = opts.len || 0.6, R = opts.r || 0.1;
  const g = new THREE.Group();
  const body = MATS.ceramic(), band = MATS.band(), lead = MATS.steel();
  const parts = [];
  const b = cyl(R, R, L, body); b.rotation.z = Math.PI / 2; parts.push(b);
  // 两端加粗的端帽
  [-1, 1].forEach(s => { const e = cyl(R * 1.08, R * 1.08, L * 0.1, body); e.rotation.z = Math.PI / 2; e.position.x = s * L * 0.45; parts.push(e); });
  g.add(merged(parts));
  // 色环（装饰、不投影）：同材质合 1 个 call
  const bands = [];
  [-0.22, -0.1, 0.02, 0.2].forEach(f => { const t = torus(R * 1.02, R * 0.13, band); t.rotation.y = Math.PI / 2; t.position.x = L * f; bands.push(t); });
  g.add(merged(bands, true));
  // 引线
  const leads = [];
  [-1, 1].forEach(s => { const w = cyl(0.012, 0.012, L * 0.34, lead); w.rotation.z = Math.PI / 2; w.position.x = s * (L * 0.5 + L * 0.17); leads.push(w); });
  g.add(merged(leads, true));
  return g;
}

/* ============ 电流表（方壳 + 圆白表盘 + 黑指针 + 三个接线柱） ============ */
export function ammeter(opts = {}) {
  const w = opts.w || 0.6, h = opts.h || 0.5, d = opts.d || 0.22;
  const R = Math.min(w, h) * 0.40;
  const g = new THREE.Group();
  const shellM = MATS.plasticDark(), faceM = MATS.white(), brass = MATS.brass();
  const needleM = MATS.needleRed();                  // 红指针（设计规范标准色 #C23B3B）
  // 方壳
  const c = box(w, h, d, shellM);
  g.add(merged([c]));
  // 圆白表盘：朝向 +z 的圆盘，略突出壳面
  const dial = cyl(R, R, 0.02, faceM); dial.rotation.x = Math.PI / 2; dial.position.z = d / 2 + 0.012;
  g.add(merged([dial], true));
  // 表盘上的刻度弧（深色细条，装饰）
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const a = (-0.62 + i / 8 * 1.24);
    const t = box(0.012, R * 0.16, 0.006, MATS.dark());
    t.position.set(Math.sin(a) * R * 0.82, Math.cos(a) * R * 0.82, d / 2 + 0.024);
    t.rotation.z = -a; ticks.push(t);
  }
  g.add(merged(ticks, true));
  // 黑指针：枢轴在表盘下缘中心
  const needle = box(0.014, R * 1.0, 0.008, needleM); needle.position.set(0, R * 0.5, d / 2 + 0.03);
  const pivotG = new THREE.Group(); pivotG.position.set(0, -R * 0.16, d / 2 + 0.03); pivotG.add(needle);
  const hub = cyl(0.028, 0.028, 0.012, MATS.dark()); hub.rotation.x = Math.PI / 2; hub.position.z = d / 2 + 0.03;
  g.add(pivotG, hub);
  // 三个接线柱（左、中、右，红/黑/红）
  const posts = [];
  const postCols = [MATS.red(), MATS.dark(), MATS.red()];
  for (let i = 0; i < 3; i++) {
    const p = cyl(0.032, 0.032, 0.1, postCols[i]);
    p.position.set((i - 1) * w * 0.3, -h / 2 - 0.03, d / 2 - 0.02); posts.push(p);
  }
  g.add(merged(posts, true));
  g.userData.needle = pivotG;
  return g;
}
/* frac: 0~1 → 指针 -55°~+55° */
export function setMeterNeedle(g, frac) {
  const n = g && g.userData && g.userData.needle; if (!n) return;
  n.rotation.z = (0.5 - Math.max(0, Math.min(1, frac))) * 1.9;
}

/* ============ 电压表（与电流表同型，表盘标 V、红黑两接线柱） ============ */
export function voltmeter(opts = {}) {
  const w = opts.w || 0.66, h = opts.h || 0.54, d = opts.d || 0.22;
  const R = Math.min(w, h) * 0.40;
  const g = new THREE.Group();
  const shellM = MATS.plasticDark(), faceM = MATS.white(), needleM = MATS.needleRed();
  // 方壳
  g.add(merged([box(w, h, d, shellM)]));
  // 圆白表盘（朝向 +z，略突出壳面）
  const dial = cyl(R, R, 0.02, faceM); dial.rotation.x = Math.PI / 2; dial.position.z = d / 2 + 0.012;
  g.add(merged([dial], true));
  // 表盘标注 V：Canvas 画字，无外部资源
  const cv = document.createElement('canvas'); cv.width = 72; cv.height = 72;
  const px = cv.getContext('2d');
  px.clearRect(0, 0, 72, 72);
  px.fillStyle = '#22283a';
  px.font = '700 46px Arial, sans-serif';
  px.textAlign = 'center'; px.textBaseline = 'middle';
  px.fillText('V', 36, 39);
  const tex = new THREE.CanvasTexture(cv);
  const vMark = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.6, R * 0.6),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  vMark.rotation.x = Math.PI / 2; vMark.position.z = d / 2 + 0.026;
  g.add(vMark);
  g.userData.vText = tex;
  // 刻度弧
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const a = (-0.62 + i / 8 * 1.24);
    const t = box(0.012, R * 0.16, 0.006, MATS.dark());
    t.position.set(Math.sin(a) * R * 0.82, Math.cos(a) * R * 0.82, d / 2 + 0.024);
    t.rotation.z = -a; ticks.push(t);
  }
  g.add(merged(ticks, true));
  // 黑指针（枢轴在表盘下缘中心）
  const needle = box(0.014, R * 1.0, 0.008, needleM); needle.position.set(0, R * 0.5, d / 2 + 0.03);
  const pivotG = new THREE.Group(); pivotG.position.set(0, -R * 0.16, d / 2 + 0.03); pivotG.add(needle);
  const hub = cyl(0.028, 0.028, 0.012, MATS.dark()); hub.rotation.x = Math.PI / 2; hub.position.z = d / 2 + 0.03;
  g.add(pivotG, hub);
  // 红黑两接线柱
  const posts = [];
  const postCols = [MATS.red(), MATS.dark()];
  for (let i = 0; i < 2; i++) {
    const p = cyl(0.032, 0.032, 0.1, postCols[i]);
    p.position.set((i - 0.5) * w * 0.6, -h / 2 - 0.03, d / 2 - 0.02); posts.push(p);
  }
  g.add(merged(posts, true));
  g.userData.needle = pivotG;
  return g;
}

/* ============ 烧杯 / 玻璃缸（玻璃壁 + 刻度线） ============ */
export function beaker(opts = {}) {
  const R = opts.r || 0.9, H = opts.h || 1.6;
  const g = new THREE.Group();
  const wall = MATS.glassWall();
  const glassParts = [];
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, H, 36, 1, true), wall);
  body.position.y = H / 2; glassParts.push(body);
  const bottom = cyl(R * 0.97, R * 0.97, 0.03, wall); bottom.position.y = 0.015; glassParts.push(bottom);
  const rim = torus(R, R * 0.028, wall); rim.rotation.x = Math.PI / 2; rim.position.y = H; glassParts.push(rim);
  g.add(merged(glassParts, true));
  // 刻度线（装饰；小烧杯可省，省 1 个 draw call）
  if (opts.marks !== false) {
    const marks = [];
    for (let i = 1; i <= 5; i++) {
      const y = (H / 6) * i;
      const t = box(R * 0.34, 0.012, 0.012, MATS.white()); t.position.set(R * 0.62, y, 0); marks.push(t);
    }
    g.add(merged(marks, true));
  }
  g.userData.R = R; g.userData.H = H;
  return g;
}

/* ============ 条形磁铁（N 红 / S 蓝） ============ */
export function magnetBar(opts = {}) {
  const L = opts.len || 1.0, W = opts.w || 0.3;
  const g = new THREE.Group();
  const nP = box(L, W, W, MATS.magnetN()); nP.position.x = L / 2;
  const sP = box(L, W, W, MATS.magnetS()); sP.position.x = -L / 2;
  g.add(merged([nP]), merged([sP]));
  g.userData.half = L / 2;
  return g;
}

/* ============ 凸透镜（镜片 + 镜框 + 支架） ============ */
export function lens(opts = {}) {
  const R = opts.r || 0.34, T = opts.thickness || 0.12;
  const cy = opts.centerY != null ? opts.centerY : R;      // 光心离底座高度
  const g = new THREE.Group();
  const glassM = MATS.glass(), frameM = MATS.brass(), stemM = MATS.steel();
  // 光学组件单独成组（光心为原点）：口径变化时只缩放它，支架长度不动
  const optical = new THREE.Group(); optical.position.y = cy;
  const lensM = sphere(R, glassM); lensM.scale.set(T / R, 1, 1);
  optical.add(merged([lensM], true));
  const frame = torus(R, R * 0.09, frameM); frame.rotation.y = Math.PI / 2;
  const ring = torus(R * 0.99, R * 0.05, frameM); ring.rotation.y = Math.PI / 2;
  optical.add(merged([frame, ring]));
  g.add(optical);
  // 支架：从底座升到镜框下沿
  const stemH = Math.max(0.08, cy - R);
  const stem = cyl(0.035, 0.035, stemH, stemM); stem.position.y = stemH / 2;
  const foot = box(R * 0.9, 0.05, R * 0.5, stemM); foot.position.y = 0.025;
  g.add(merged([stem, foot]));
  g.userData.R = R; g.userData.centerY = cy; g.userData.optical = optical;
  return g;
}
/* 口径 0~1：镜片/镜框在竖直平面内缩放（支架不动） */
export function setLensAperture(g, ap) {
  const o = g && g.userData && g.userData.optical; if (!o) return;
  o.scale.set(1, Math.max(0.12, ap), Math.max(0.12, ap));
}

/* ============ 光屏（白屏 + 木框 + 支架） ============ */
export function screen(opts = {}) {
  const W = opts.w || 0.9, H = opts.h || 1.2;
  const g = new THREE.Group();
  const face = box(W, H, 0.02, MATS.white()); face.position.y = H / 2 + 0.12;
  g.add(merged([face]));
  const frame = MATS.woodDark();
  const fp = [];
  const b1 = box(W + 0.06, 0.04, 0.05, frame); b1.position.y = H + 0.14; fp.push(b1);
  const b2 = box(W + 0.06, 0.04, 0.05, frame); b2.position.y = 0.10; fp.push(b2);
  [-1, 1].forEach(s => { const v = box(0.04, H + 0.06, 0.05, frame); v.position.set(s * (W / 2 + 0.02), H / 2 + 0.12, 0); fp.push(v); });
  const post = cyl(0.03, 0.03, 0.12, frame); post.position.y = 0.06; fp.push(post);
  const base = box(W * 0.5, 0.04, 0.3, frame); base.position.y = 0.02; fp.push(base);
  g.add(merged(fp));
  g.userData.w = W; g.userData.h = H;
  return g;
}

/* ============ 蜡烛（光学实验光源：烛身 + 火焰，火焰独立可闪动） ============ */
export function candle(opts = {}) {
  const H = opts.h || 0.7;
  const g = new THREE.Group();
  const body = cyl(0.075, 0.08, H, MATS.candleWax());
  body.position.y = H / 2;
  const wick = cyl(0.012, 0.012, 0.06, MATS.dark()); wick.position.y = H + 0.03;
  g.add(merged([body]), merged([wick], true));
  // 火焰：内焰亮黄 + 外焰橙（亮度会变 → 私有克隆材质）
  const fl = sphere(0.075, matClone('flame'));
  fl.scale.set(1, 1.8, 1); fl.position.y = H + 0.15;
  const haloM = matClone('flame'); haloM.emissiveIntensity = 0.7; haloM.opacity = 0.35;
  const halo = sphere(0.115, haloM);
  halo.scale.set(1, 1.7, 1); halo.position.y = H + 0.16;
  g.add(fl, halo);
  g.userData.flame = fl; g.userData.halo = halo; g.userData.h = H; g.userData.flameY = H + 0.15;
  return g;
}
export function setCandleFlicker(g, k) {
  const u = g && g.userData; if (!u || !u.flame) return;
  u.flame.material.emissiveIntensity = 1.2 + k * 1.2;
  u.halo.material.opacity = 0.25 + k * 0.2;
}

/* ============ 弹簧测力计（方壳带刻度窗口 + 顶部提环 + 底部挂钩 + 红指针） ============ */
export function springScale(opts = {}) {
  const H = opts.h || 1.0, W = opts.w || 0.2, D = opts.d || 0.12;
  const g = new THREE.Group();
  const caseM = MATS.plastic(), glassM = matClone('glass'); glassM.opacity = 0.10;
  // 方壳（不透明外壳）
  const shellParts = [];
  const back = box(W, H, D * 0.5, caseM); back.position.z = -D * 0.24; shellParts.push(back);
  [-1, 1].forEach(sx => { const side = box(W * 0.1, H, D, caseM); side.position.set(sx * W * 0.45, 0, 0); shellParts.push(side); });
  const top = box(W, H * 0.06, D, caseM); top.position.y = H * 0.47; shellParts.push(top);
  const bot = box(W, H * 0.06, D, caseM); bot.position.y = -H * 0.47; shellParts.push(bot);
  g.add(merged(shellParts));
  // 刻度窗口（前面透明片）
  const win = box(W * 0.74, H * 0.82, 0.012, glassM); win.position.z = D * 0.5; g.add(merged([win], true));
  // 刻度板（白）
  const plate = box(W * 0.68, H * 0.8, 0.01, MATS.white()); plate.position.z = D * 0.36; g.add(merged([plate], true));
  // 刻度线
  const ticks = [];
  for (let i = 0; i < 10; i++) { const t = box(W * 0.4, 0.008, 0.006, MATS.dark()); t.position.set(-W * 0.06, H * 0.36 - i * H * 0.072, D * 0.42); ticks.push(t); }
  g.add(merged(ticks, true));
  // 顶部提环（黄铜圆环）
  const ring = torus(W * 0.22, W * 0.05, MATS.brass()); ring.position.y = H * 0.52; g.add(merged([ring]));
  // 红指针
  const ptr = box(W * 0.5, 0.014, 0.02, MATS.needleRed()); ptr.position.set(-W * 0.02, H * 0.36, D * 0.42);
  g.add(ptr);
  // 底部挂钩（钢钩）
  const hookParts = [];
  const stem = cyl(0.012, 0.012, H * 0.1, MATS.steel()); stem.position.y = -H * 0.52; hookParts.push(stem);
  const hook = torus(W * 0.13, W * 0.035, MATS.steel()); hook.rotation.x = Math.PI / 2; hook.position.y = -H * 0.58; hookParts.push(hook);
  g.add(merged(hookParts));
  g.userData.pointer = ptr; g.userData.H = H;
  return g;
}
/* frac: 0~1 拉伸量 → 指针下移 */
export function setSpringScale(g, frac) {
  const u = g && g.userData; if (!u || !u.pointer) return;
  const f = Math.max(0, Math.min(1, frac));
  u.pointer.position.y = u.H * 0.36 - f * u.H * 0.66;
}

/* ============ 音叉（钢叉 + 木座） ============ */
export function tuningFork(opts = {}) {
  const S = opts.scale || 1;
  const g = new THREE.Group();
  const steel = MATS.steelBright();
  const prongs = [];
  [-1, 1].forEach(s => { const p = cyl(0.028 * S, 0.028 * S, 0.72 * S, steel); p.position.set(s * 0.075 * S, 0.66 * S, 0); prongs.push(p); });
  const yoke = cyl(0.075 * S, 0.075 * S, 0.07 * S, steel); yoke.rotation.z = Math.PI / 2; yoke.position.y = 0.32 * S; prongs.push(yoke);
  const stem = cyl(0.03 * S, 0.03 * S, 0.3 * S, steel); stem.position.y = 0.17 * S; prongs.push(stem);
  g.add(merged(prongs));
  const base = box(0.34 * S, 0.06 * S, 0.22 * S, MATS.woodDark()); base.position.y = 0.03 * S;
  g.add(merged([base]));
  return g;
}

/* ============ 温度计（玻璃管 + 红色液柱 + 刻度） ============ */
export function thermometer(opts = {}) {
  const H = opts.h || 1.0;
  const g = new THREE.Group();
  const tube = cyl(0.045, 0.045, H, MATS.glass()); tube.position.y = H / 2;
  const ball = sphere(0.075, MATS.glass()); ball.position.y = 0.02;
  g.add(merged([tube, ball], true));
  // 液柱（独立缩放，0~1 表示量程）
  const col = cyl(0.026, 0.026, 1, matClone('mercury'));
  col.geometry.translate(0, 0.5, 0);        // 底部为原点，向上长
  col.position.y = 0.05; g.add(col);
  // 刻度（装饰）
  const ticks = [];
  for (let i = 1; i <= 8; i++) { const t = box(0.07, 0.008, 0.008, MATS.white()); t.position.set(0.05, (H / 9) * i, 0); ticks.push(t); }
  g.add(merged(ticks, true));
  g.userData.col = col; g.userData.H = H;
  return g;
}
export function setThermometer(g, frac) {
  const u = g && g.userData; if (!u || !u.col) return;
  u.col.scale.y = Math.max(0.04, Math.min(1, frac)) * (u.H * 0.86);
}

/* ============ 闸刀开关（木底座 + 铜触点 + 可转动刀片） ============ */
export function knifeSwitch(opts = {}) {
  const g = new THREE.Group();
  const base = box(0.34, 0.05, 0.2, MATS.woodDark()); base.position.y = 0.025;
  g.add(merged([base]));
  const contacts = [];
  [-1, 1].forEach(s => { const c = cyl(0.03, 0.03, 0.07, MATS.brass()); c.position.set(s * 0.12, 0.085, 0); contacts.push(c); });
  g.add(merged(contacts, true));
  const blade = box(0.24, 0.022, 0.045, MATS.copper()); blade.position.set(0, 0.0, 0);
  const pivotG = new THREE.Group(); pivotG.position.set(-0.12, 0.09, 0); blade.position.x = 0.12; pivotG.add(blade);
  g.add(pivotG);
  g.userData.blade = pivotG;
  return g;
}
export function setSwitch(g, closed) {
  const b = g && g.userData && g.userData.blade; if (!b) return;
  b.rotation.z = closed ? 0 : -0.85;
}

/* ============ 光具座（导轨 + 刻度） ============ */
export function opticalRail(opts = {}) {
  const L = opts.len || 6.0;
  const g = new THREE.Group();
  const rail = box(L, 0.07, 0.18, MATS.steel()); rail.position.y = 0.035;
  g.add(merged([rail]));
  const marks = [];
  for (let i = 0; i <= 20; i++) {
    const t = box(0.012, 0.012, 0.05, MATS.white()); t.position.set(-L / 2 + (L / 20) * i, 0.075, 0.09); marks.push(t);
  }
  g.add(merged(marks, true));
  g.userData.len = L;
  return g;
}
/* 滑块：给导轨上的器材一个可读的底座 */
export function railRider(w) {
  const g = new THREE.Group();
  const b = box(w || 0.24, 0.09, 0.22, MATS.plasticDark()); b.position.y = 0.045;
  g.add(merged([b]));
  return g;
}

/* ============ 木块（力学实验用：木块 + 挂钩） ============ */
export function woodBlock(opts = {}) {
  const w = opts.w || 0.4, h = opts.h || 0.26, d = opts.d || 0.3;
  const g = new THREE.Group();
  const body = box(w, h, d, MATS.woodLight()); body.position.y = h / 2;
  g.add(merged([body]));
  const hooks = [];
  [-1, 1].forEach(s => {
    const e = cyl(0.012, 0.012, 0.1, MATS.steel()); e.rotation.z = Math.PI / 2;
    e.position.set(s * (w / 2 + 0.03), h * 0.55, 0); hooks.push(e);
  });
  g.add(merged(hooks, true));
  g.userData.h = h;
  return g;
}

/* ============ 金属块（浮力实验用：铝块 + 吊环） ============ */
export function metalBlock(opts = {}) {
  const s = opts.size || 0.6;
  const g = new THREE.Group();
  const body = box(s, s, s, MATS.aluminum()); body.position.y = s / 2;
  g.add(merged([body]));
  const ring = torus(s * 0.12, s * 0.025, MATS.steel()); ring.position.y = s + s * 0.12;
  g.add(merged([ring], true));
  g.userData.size = s;
  return g;
}

/* ============ 气缸散热片 / 消声器（热机补件） ============ */
export function engineFins(opts = {}) {
  const R = opts.r || 0.54, n = opts.n || 9, H = opts.h || 0.85;
  const g = new THREE.Group();
  const parts = [];
  // 一圈圈很薄的散热片、密集贴合缸壁（读成金属缸筒上的散热片，而不是一摞盘子）
  for (let i = 0; i < n; i++) {
    const t = torus(R, R * 0.028, MATS.iron()); t.rotation.x = Math.PI / 2;
    t.position.y = (H / (n - 1)) * i; parts.push(t);
  }
  g.add(merged(parts, true));
  return g;
}
export function muffler() {
  const g = new THREE.Group();
  const body = cyl(0.16, 0.16, 0.46, MATS.iron()); body.rotation.z = Math.PI / 2;
  const ends = [];
  [-1, 1].forEach(s => { const e = cyl(0.1, 0.16, 0.06, MATS.iron()); e.rotation.z = Math.PI / 2; e.position.x = s * 0.24; ends.push(e); });
  g.add(merged([body, ...ends]));
  const tip = cyl(0.05, 0.05, 0.18, MATS.steel()); tip.rotation.z = Math.PI / 2; tip.position.x = 0.36;
  g.add(merged([tip], true));
  return g;
}

/* ============ 钩码（带挂钩的槽码叠块） ============ */
export function slottedMass(opts = {}) {
  const n = opts.n || 1, R = opts.r || 0.13, H = opts.h || 0.07;
  const g = new THREE.Group();
  const disc = MATS.steel();
  const parts = [], hooks = [];
  for (let i = 0; i < n; i++) {
    const d = cyl(R, R, H, disc); d.position.y = H / 2 + i * H; parts.push(d);
  }
  g.add(merged(parts));
  const hook = torus(R * 0.35, R * 0.12, MATS.steel()); hook.position.y = H * n + R * 0.3; hooks.push(hook);
  g.add(merged(hooks, true));
  g.userData.h = H * n;
  return g;
}

/* ============ 平面镜（玻璃镜片 + 框 + 小支架） ============ */
export function planeMirror(opts = {}) {
  const W = opts.w || 1.0, H = opts.h || 1.6;
  const g = new THREE.Group();
  const glassParts = [];
  const face = box(W, H, 0.04, MATS.glass()); glassParts.push(face);
  g.add(merged(glassParts, true));
  // 镜面（镀银反射层）薄片
  const silver = box(W * 0.96, H * 0.96, 0.01, MATS.steelBright()); silver.position.z = 0.025;
  g.add(merged([silver], true));
  const frame = [];
  const t = 0.06;
  const top = box(W + t, t, 0.06, MATS.plasticDark()); top.position.set(0, H / 2, 0);
  const bot = box(W + t, t, 0.06, MATS.plasticDark()); bot.position.set(0, -H / 2, 0);
  [-1, 1].forEach(s => { const v = box(t, H + t, 0.06, MATS.plasticDark()); v.position.set(s * W / 2, 0, 0); frame.push(v); });
  frame.push(top, bot); g.add(merged(frame));
  return g;
}

/* ============ 激光笔（小方体 + 出光口） ============ */
export function laser() {
  const g = new THREE.Group();
  const body = box(0.5, 0.12, 0.12, MATS.plasticDark()); body.position.x = 0.25;
  g.add(merged([body]));
  const nose = cyl(0.045, 0.045, 0.08, MATS.brass()); nose.rotation.z = Math.PI / 2; nose.position.x = 0.02;
  g.add(merged([nose], true));
  return g;
}

/* ============ 玻璃水槽（长方形，光学折射用） ============ */
export function glassTank(opts = {}) {
  const W = opts.w || 2.4, H = opts.h || 1.6, D = opts.d || 1.6;
  const g = new THREE.Group();
  const wall = MATS.glassWall();
  const parts = [];
  const bottom = box(W, 0.04, D, wall); bottom.position.y = 0.02; parts.push(bottom);
  [-1, 1].forEach(s => { const side = box(W, H, 0.03, wall); side.position.set(0, H / 2, s * D / 2); parts.push(side); });
  [-1, 1].forEach(s => { const end = box(0.03, H, D, wall); end.position.set(s * W / 2, H / 2, 0); parts.push(end); });
  g.add(merged(parts, true));
  g.userData = { W, H, D };
  return g;
}

/* ============ 酒精灯（壶身 + 灯芯 + 火焰） ============ */
export function alcoholLamp(opts = {}) {
  const g = new THREE.Group();
  const body = cyl(0.34, 0.24, 0.42, MATS.glass());
  body.position.y = 0.21;
  const collar = cyl(0.14, 0.16, 0.1, MATS.brass()); collar.position.y = 0.46;
  const wick = cyl(0.05, 0.05, 0.12, MATS.dark()); wick.position.y = 0.56;
  g.add(merged([body], true), merged([collar, wick]));
  const fl = sphere(0.1, matClone('flame')); fl.scale.set(1, 2.0, 1); fl.position.y = 0.72;
  g.add(fl);
  g.userData.flame = fl; g.userData.flameY = 0.72;
  return g;
}
export function setLampFlame(g, k) {
  const f = g && g.userData && g.userData.flame; if (!f) return;
  f.material.emissiveIntensity = 1.0 + k * 2.5;
  f.scale.set(0.6 + k * 0.8, 1.2 + k * 1.8, 0.6 + k * 0.8);
}

/* ============ 试管（玻璃管 + 内容物） ============ */
export function testTube(opts = {}) {
  const R = opts.r || 0.12, H = opts.h || 0.8;
  const g = new THREE.Group();
  const tube = cyl(R, R, H, MATS.glass()); tube.position.y = H / 2;
  const bot = sphere(R, MATS.glass()); bot.scale.set(1, 0.6, 1); bot.position.y = 0.01;
  g.add(merged([tube, bot], true));
  g.userData = { R, H };
  return g;
}

/* ============ 量热器（金属罐 + 盖子 + 电热丝接线柱） ============ */
export function calorimeter(opts = {}) {
  const R = opts.r || 0.5, H = opts.h || 1.1;
  const g = new THREE.Group();
  const can = cyl(R, R, H, MATS.steelBright()); can.position.y = H / 2;
  g.add(merged([can]));
  const lid = cyl(R * 1.04, R * 1.04, 0.05, MATS.steel()); lid.position.y = H + 0.02;
  const posts = [];
  [-1, 1].forEach(s => { const p = cyl(0.03, 0.03, 0.1, MATS.brass()); p.position.set(s * R * 0.4, H + 0.1, 0); posts.push(p); });
  g.add(merged([lid, ...posts]));
  const heater = cyl(0.04, 0.04, H * 0.7, MATS.iron()); heater.position.y = H * 0.4;
  g.add(merged([heater], true));
  g.userData = { R, H };
  return g;
}

/* ============ 真空罩（玻璃钟罩 + 底座） ============ */
export function bellJar(opts = {}) {
  const R = opts.r || 1.4, H = opts.h || 1.9;
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.62), MATS.glassTube());
  dome.position.y = H - R * 0.3; dome.castShadow = false;
  const cylWall = cyl(R, R, H * 0.5, MATS.glassTube()); cylWall.position.y = H * 0.25; cylWall.castShadow = false;
  g.add(merged([dome, cylWall], true));
  const base = cyl(R * 1.12, R * 1.12, 0.12, MATS.iron()); base.position.y = 0.06; g.add(merged([base]));
  const valve = cyl(0.1, 0.1, 0.2, MATS.brass()); valve.position.y = H + 0.02; g.add(merged([valve], true));
  g.userData = { R, H };
  return g;
}

