/* 热学 F1~F3 */
import { THREE, COLORS, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, mkArrow, setArrow, fatLine, setFatLine, addGround, clamp, G, rd } from './common.js';
import { MATS, matClone, registerMaterials, engineFins, muffler, beaker, alcoholLamp, setLampFlame, thermometer, setThermometer, testTube } from './props.js';

const C = COLORS.thermal;

/* Antoine：气压 kPa → 沸点 ℃（水） */
function boilPoint(pKPa) {
  const mmHg = pKPa * 7.50062;
  return 1730.63 / (8.07131 - Math.log10(mmHg)) - 233.426;
}

/* ===================== F1 熔化与凝固曲线 ===================== */
const F1 = {
  p: {}, CONST: {
    ice: { mp: 0, cSolid: 2.1, cLiquid: 4.2, L: 334 },
    hypo: { mp: 48, cSolid: 1.9, cLiquid: 2.1, L: 250 },
    wax: { mp: null, cSolid: 2.1, cLiquid: 2.1, L: null, soft: [40, 60] },
  },
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a1c22);
    registerMaterials(ctx);
    this.board = box(3.0, 3.2, 0.08, '#1a1220', { roughness: 0.85 }); this.board.position.set(1.7, 1.95, -0.4); ctx.scene.add(this.board);
    // 酒精灯 + 烧杯（内装待熔物）+ 温度计：烧杯架在铁三脚架上，酒精灯火焰从架下露出来
    this.lamp = alcoholLamp(); this.lamp.position.set(-3.2, 0, 0.6); ctx.scene.add(this.lamp);
    // 铁三脚架（三腿 + 承托环），把烧杯架高到火焰上方，火焰可见
    const tripod = [];
    const ring = torus(0.52, 0.03, MATS.iron()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.98; tripod.push(ring);
    for (let i = 0; i < 3; i++) {
      const ang = i / 3 * Math.PI * 2 + 0.5;
      const leg = box(0.05, 1.0, 0.05, MATS.iron());
      leg.position.set(Math.cos(ang) * 0.46, 0.5, Math.sin(ang) * 0.46);
      leg.rotation.y = -ang; tripod.push(leg);
    }
    this.tripod = mergeByMaterial(tripod); this.tripod.position.set(-3.2, 0, 0.6); ctx.scene.add(this.tripod);
    this.beakerG = beaker({ r: 0.62, h: 1.1 }); this.beakerG.position.set(-3.2, 1.0, 0.6); ctx.scene.add(this.beakerG);
    this.beaker = this.beakerG;
    this.ice = cyl(0.5, 0.55, 0.9, matClone('water')); this.ice.position.set(-3.2, 1.45, 0.6); ctx.scene.add(this.ice);
    this.therm = thermometer({ h: 1.3 }); this.therm.position.set(-2.7, 1.0, 0.6); ctx.scene.add(this.therm);
    // 曲线图缩到右侧约 1/3 宽：坐标轴 + 网格 + 刻度
    this.CX0 = 0.45; this.CX1 = 2.95; this.CY0 = 0.6; this.CY1 = 3.4;
    this.axX = fatLine([new THREE.Vector3(this.CX0, this.CY0, 0), new THREE.Vector3(this.CX1, this.CY0, 0)], '#8fa0bd', 2.4); ctx.scene.add(this.axX);
    this.axY = fatLine([new THREE.Vector3(this.CX0, this.CY0, 0), new THREE.Vector3(this.CX0, this.CY1, 0)], '#8fa0bd', 2.4); ctx.scene.add(this.axY);
    // 网格线（4 横 4 纵，装饰）
    for (let i = 1; i <= 4; i++) {
      const gy = this.CY0 + (this.CY1 - this.CY0) * i / 5;
      const gx = this.CX0 + (this.CX1 - this.CX0) * i / 5;
      ctx.scene.add(fatLine([new THREE.Vector3(this.CX0, gy, -0.02), new THREE.Vector3(this.CX1, gy, -0.02)], '#3a3348', 1, { opacity: 0.7 }));
      ctx.scene.add(fatLine([new THREE.Vector3(gx, this.CY0, -0.02), new THREE.Vector3(gx, this.CY1, -0.02)], '#3a3348', 1, { opacity: 0.7 }));
    }
    this.lblAxY = mkLabel('T / ℃', '#8fa0bd'); this.lblAxY.position.set(this.CX0 - 0.05, this.CY1 + 0.15, 0); ctx.scene.add(this.lblAxY);
    this.lblAxX = mkLabel('t / min', '#8fa0bd'); this.lblAxX.position.set(this.CX1 - 0.1, this.CY0 - 0.28, 0); ctx.scene.add(this.lblAxX);
    this.lblYmax = mkLabel('', '#E6EDF7'); ctx.scene.add(this.lblYmax);
    this.lblYmin = mkLabel('', '#E6EDF7'); ctx.scene.add(this.lblYmin);
    // 曲线固定 201 点建一次：点数恒定，避免 Line2 实例缓冲区增长后不刷新（只画出起头一小段）
    this.CURVE_N = 201;
    const stub = [];
    for (let i = 0; i < this.CURVE_N; i++) stub.push(new THREE.Vector3(this.CX0, this.CY0, 0));
    this.curve = fatLine(stub, C, 2.8); ctx.scene.add(this.curve);
    this.cursor = decor(sphere(0.1, '#fff', { emissive: C, emissiveIntensity: 1 })); ctx.scene.add(this.cursor);
    this.lbl = mkLabel('', C); this.lbl.position.set(1.7, 3.85, 0); ctx.scene.add(this.lbl);
    this.lblT = mkLabel('', '#ffd479'); this.lblT.position.set(-3.2, 1.6, 0.6); ctx.scene.add(this.lblT);
    this.duration = 600;        // build 期先给默认值（10min×60），参数回灌后在 recompute 里再算
    this.t = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  cfg() { return this.CONST[this.p.substance || 'ice']; },
  segTimes() {
    const c = this.cfg();
    const m = (this.p.mass || 200) / 1000;
    const P = this.p.power || 150;
    const t0 = this.p.t0 != null ? this.p.t0 : -10;
    if (c.mp == null) { return { wax: true, rate: P / (m * c.cSolid * 1000) }; }
    const tHeat = t0 < c.mp ? m * c.cSolid * 1000 * (c.mp - t0) / P : 0;
    const tPlateau = m * c.L * 1000 / P;
    return { tHeat, tPlateau, t0, mp: c.mp, c, m, P, rateLiquid: P / (m * c.cLiquid * 1000) };
  },
  tempAt(t) {
    const s = this.seg;
    if (s.wax) return s.t0w + s.rate * t;
    if (this.p.t0 > s.mp) return this.p.t0 + s.rateLiquid * (t);
    if (t < s.tHeat) return this.p.t0 + (s.mp - this.p.t0) * (t / Math.max(s.tHeat, 1e-6));
    if (t < s.tHeat + s.tPlateau) return s.mp;
    return s.mp + s.rateLiquid * (t - s.tHeat - s.tPlateau);
  },
  recompute() {
    this.seg = this.segTimes();
    this.seg.t0w = this.p.t0 != null ? this.p.t0 : 0;
    this.duration = (this.p.duration || 10) * 60;   // 时间轴总长（秒），供时间条用
    this.t = 0;
    this.redraw();
  },
  // 时间轴：F1 是解析型——温度是 t 的闭式解，seek 直接算，不重放
  seek(t) {
    let tt = Number.isFinite(t) ? t : 0;
    tt = Math.max(0, Math.min(tt, this.duration || 0));
    this.t = tt;
    this.redraw();
  },
  redraw() {
    const dur = (this.p.duration || 10) * 60;
    const tNow = clamp(this.t, 0, dur);                          // 当前时刻（读数与液柱用它）
    const tEnd = Math.max(tNow, dur * 0.03);                     // 曲线至少画出起头一小段，避免空框
    // Y 轴按本次实验温度范围自适应（不再固定 -30~120）
    const c = this.cfg();
    const t0 = this.p.t0 != null ? this.p.t0 : -10;
    const mpc = c.mp != null ? c.mp : t0;
    const Tmin = Math.min(t0, mpc) - 12;
    const Tmax = Math.max(mpc, t0) + 55;
    const X0 = this.CX0, X1 = this.CX1, Y0 = this.CY0, Y1 = this.CY1;
    const xOf = tt => X0 + tt / dur * (X1 - X0);
    const yOf = T => Y0 + clamp((T - Tmin) / (Tmax - Tmin), 0, 1) * (Y1 - Y0);
    const pts = [];
    const N = this.CURVE_N || 201;
    for (let k = 0; k < N; k++) {                       // 固定 N 点：点数恒定，setFatLine 只改坐标
      const tt = tEnd * k / (N - 1);
      pts.push(new THREE.Vector3(xOf(tt), yOf(this.tempAt(tt)), 0));
    }
    const Tcur = this.tempAt(tNow);                     // 读数取真实时刻 t，不受曲线起头补偿影响
    pts.push(new THREE.Vector3(xOf(tNow), yOf(Tcur), 0));
    if (pts.length < 2) pts.push(pts[0].clone());
    setFatLine(this.curve, pts);
    this.cursor.position.copy(pts[pts.length - 1]);
    if (this.ctx) this.ctx.emitReadout({ temp: Tcur });
    this.lbl.position.set(1.7, 3.85, 0);
    setLabel(this.lbl, 'T = ' + Tcur.toFixed(1) + '℃  t = ' + (tNow / 60).toFixed(1) + 'min');
    setLabel(this.lblT, Tcur.toFixed(0) + '℃');
    // 刻度数字（自适应 min/max）
    if (this.lblYmax) { this.lblYmax.position.set(X0 - 0.32, Y1 - 0.04, 0); setLabel(this.lblYmax, Tmax.toFixed(0)); }
    if (this.lblYmin) { this.lblYmin.position.set(X0 - 0.32, Y0 - 0.04, 0); setLabel(this.lblYmin, Tmin.toFixed(0)); }
    // 冰融化视觉
    const melted = this.seg.wax ? 0.5 : clamp((tNow - this.seg.tHeat) / Math.max(this.seg.tPlateau, 1), 0, 1);
    this.ice.scale.y = clamp(1 - melted * 0.85, 0.12, 1); this.ice.position.y = 1.03 + 0.9 * this.ice.scale.y / 2;
    // 温度计液柱随当前温度；酒精灯火焰随功率
    if (this.therm) setThermometer(this.therm, clamp((Tcur - Tmin) / Math.max(Tmax - Tmin, 1), 0.04, 1));
    if (this.lamp) setLampFlame(this.lamp, clamp((this.p.power || 150) / 300, 0.15, 1));
  },
  step(dt) {
    if (dt <= 0) return;
    this.t = Math.min(this.t + dt, this.duration || 0);
    if (this._f = (this._f || 0) + 1, this._f % 4 === 0 || this.t < 1) this.redraw();
  },
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== F2 水的沸腾 ===================== */
const F2 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a1c22);
    registerMaterials(ctx);
    // 酒精灯 + 铁架台 + 烧杯（水）+ 温度计
    this.lamp = alcoholLamp(); this.lamp.position.set(0, 0, 0); ctx.scene.add(this.lamp);
    this.beaker = beaker({ r: 1.05, h: 2.0 }); this.beaker.position.set(0, 0.62, 0); ctx.scene.add(this.beaker);
    this.water = cyl(1.0, 1.0, 1.8, matClone('water')); this.water.position.set(0, 0.72, 0); ctx.scene.add(this.water);
    this.therm = thermometer({ h: 2.2 }); this.therm.position.set(0.7, 0.62, 0); ctx.scene.add(this.therm);
    this.bubbles = [];
    const bg = new THREE.SphereGeometry(1, 8, 6), bm = new THREE.MeshStandardMaterial({ color: new THREE.Color('#dff3ff'), transparent: true, opacity: 0.6, depthWrite: false });
    this.bubbleInst = new THREE.InstancedMesh(bg, bm, 80); this.bubbleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); ctx.scene.add(this.bubbleInst);
    this.bstate = new Array(80).fill(0).map(() => ({ x: (Math.random() - 0.5) * 1.6, y: Math.random() * 1.8, r: 0.05 + Math.random() * 0.08, spd: 0.3 + Math.random() * 0.5 }));
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.0, 0); ctx.scene.add(this.lbl);
    this.lblT = mkLabel('', '#ffd479'); this.lblT.position.set(1.5, 2.6, 0); ctx.scene.add(this.lblT);
    this.duration = 200;
    this.t = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    this.Tb = boilPoint(this.p.pressure != null ? this.p.pressure : 101.3);
    this.t = 0; this.T = this.p.t0 != null ? this.p.t0 : 20;
    // 火力 1~5 档 → 60/120/180/240/300 W；升温速率按真实比热算 rate = P/(m·c水)
    const flame = this.p.flame || 3, vol = this.p.volume || 100;
    this.P = flame * 60;
    this.heatRate = this.P / ((vol / 1000) * 4200);          // ℃/s
    this.t0v = this.p.t0 != null ? this.p.t0 : 20;
    this.duration = Math.max((this.Tb - this.t0v) / this.heatRate, 1) + 60;   // 升到沸点 + 60s 沸腾观察
    if (this.ctx) this.ctx.emitReadout({ boil: this.Tb });
    this.lbl.position.set(0, 3.0, 0);
    setLabel(this.lbl, '沸点 = ' + this.Tb.toFixed(2) + '℃（气压 ' + (this.p.pressure || 101.3).toFixed(1) + 'kPa · 火力 ' + flame + ' 档 ≈ ' + this.P + 'W）');
    this.update();
  },
  // 解析型：温度是 t 的闭式解 T = min(t0 + rate·t, Tb)
  tempAt(t) { return Math.min(this.t0v + this.heatRate * Math.max(t, 0), this.Tb); },
  seek(t) {
    const tt = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration || 0);
    this.t = tt; this.T = this.tempAt(tt);
    this.layoutBubbles(tt);
    this.update();
  },
  // 气泡按 t 的确定式给出（去随机化），保证同一 t 两次 seek 画面完全一致
  layoutBubbles(t) {
    const boiling = this.T >= this.Tb - 0.05;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (let i = 0; i < 80; i++) {
      const b = this.bstate[i];
      const spd = 0.4 + b.r * 3;
      const y = ((t * spd * (boiling ? 1.6 : 0.7) + (i * 0.137) % 1.8) % 1.8);
      const r = boiling ? b.r * (0.6 + y) : b.r * (1.2 - y * 0.5);
      s.setScalar(Math.max(0.02, r));
      m.compose(new THREE.Vector3(b.x, y + 0.1, 0), q, s);
      this.bubbleInst.setMatrixAt(i, m);
    }
    this.bubbleInst.instanceMatrix.needsUpdate = true;
  },
  step(dt) {
    if (dt <= 0) return;
    this.t = Math.min(this.t + dt, this.duration || 0);
    this.T = this.tempAt(this.t);
    this.layoutBubbles(this.t);
    this.update();
  },
  update() {
    setLabel(this.lblT, 'T=' + this.T.toFixed(1) + '℃' + (this.T >= this.Tb - 0.05 ? ' 沸腾' : ''));
    const hs = clamp((this.T - 20) / (this.Tb - 20), 0.2, 1) * 1.8;
    this.water.scale.y = clamp(hs / 1.8, 0.2, 1); this.water.position.y = 0.68 + this.water.scale.y * 1.8 / 2;
    if (this.therm) setThermometer(this.therm, clamp((this.T + 10) / 130, 0.04, 1));
    if (this.lamp) setLampFlame(this.lamp, clamp((this.p.flame || 3) / 5, 0.2, 1));
  },
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== F3 比热容与四冲程热机 ===================== */
const F3 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a1c22);
    // 左侧：三材质升温条
    this.mats = [
      { c: 4.2, color: '#3b82f6', label: '水' },
      { c: 2.1, color: '#f59e0b', label: '煤油' },
      { c: 0.92, color: '#a16207', label: '砂石' },   // 教材表原值 0.92×10³（教材用词「砂石」）
    ];
    this.bars = []; this.qlabels = [];
    this.mats.forEach((mt, i) => {
      const x = -3.0 + i * 0.85;
      // 真实烧杯 + 内部液体柱（同一热源加热，液柱越高表示温升越大）
      const bk = beaker({ r: 0.34, h: 2.2, marks: false }); bk.position.set(x, 0, 0); ctx.scene.add(bk);
      const b = cyl(0.30, 0.30, 1, matClone('water')); b.material.color = new THREE.Color(mt.color);
      b.material.opacity = 0.72; b.material.transparent = true; b.material.depthWrite = false;
      b.position.set(x, 0.5, 0); b.castShadow = false; ctx.scene.add(b);
      const l = mkLabel(mt.label + ' ' + mt.c + '×10³', mt.color); l.position.set(x, -0.24, 0); ctx.scene.add(l);
      const q = mkLabel('', '#ffd479'); q.position.set(x, 2.6, 0); ctx.scene.add(q);
      this.bars.push(b); this.qlabels.push(q);
    });
    // 右侧：四冲程汽油机（按《F3 四冲程造型参照清单》九件套）
    // 约定：曲轴角 φ=0 为上止点 TDC、吸气起点；活塞 s 为自上止点向下位移，piston.y = topY − s
    const EX = 1.7, D = 1.0, RAD = D / 2;
    this.EX = EX; this.R = 0.45; this.L = 1.3; this.pistonH = 0.28;
    this.topY = 2.40; this.cylTop = 2.54; this.crankY = 0.51; this.maxLift = 0.20;
    this.valveClosedY = 2.50;
    const cylTop = this.cylTop, crankY = this.crankY;
    // ① 气缸筒：半透明，能看内部
    this.cylBody = new THREE.Mesh(new THREE.CylinderGeometry(RAD, RAD, 1.5, 40, 1, true), mat('#a7b6ca', { metalness: 0.5, roughness: 0.3, transparent: true, opacity: 0.62, depthWrite: false }));
    this.cylBody.material.side = THREE.DoubleSide; this.cylBody.position.set(EX, 1.80, 0); ctx.scene.add(this.cylBody);
    // ② 缸盖：不透明实心盘
    this.head = cyl(RAD + 0.12, RAD + 0.12, 0.16, '#8494ab', { metalness: 0.45, roughness: 0.4 }); this.head.position.set(EX, cylTop + 0.08, 0); ctx.scene.add(this.head);
    // 燃烧室气体（随活塞高度伸缩）
    this.gas = cyl(RAD - 0.04, RAD - 0.04, 0.3, '#9fc6e8', { transparent: true, opacity: 0.32, depthWrite: false }); this.gas.position.set(EX, (cylTop + 2.26) / 2, 0); ctx.scene.add(this.gas);
    // ③ 活塞组：活塞体 + 两道环 + 活塞销
    this.pistonGroup = new THREE.Group(); this.pistonGroup.position.set(EX, 2.26, 0); ctx.scene.add(this.pistonGroup);
    const pBody = cyl(RAD - 0.04, RAD - 0.04, this.pistonH, '#dbe6f5', { metalness: 0.25, roughness: 0.35 }); this.pistonGroup.add(pBody);
    // 两道活塞环 + 活塞销：同属活塞刚体、同节拍运动，合并成 1 个 draw call
    const pParts = [];
    [0.10, 0.055].forEach(yy => { const rg = torus(RAD - 0.045, 0.016, '#6f7b8e', { metalness: 0.5 }); rg.rotation.x = Math.PI / 2; rg.position.y = yy; pParts.push(rg); });
    const ppin = cyl(0.05, 0.05, RAD * 1.4, '#9aa3b2', { metalness: 0.7 }); ppin.rotation.x = Math.PI / 2; pParts.push(ppin);
    this.pistonGroup.add(mergeByMaterial(pParts));
    // ④ 曲轴箱 + 飞轮 + 曲轴臂 + 曲柄销
    this.crankBase = box(1.5, 0.5, 1.0, '#4a5568', { metalness: 0.5, roughness: 0.6 }); this.crankBase.position.set(EX, 0.28, -0.15); ctx.scene.add(this.crankBase);
    this.flywheel = new THREE.Group(); this.flywheel.position.set(EX, crankY, 0.55); ctx.scene.add(this.flywheel);
    const fwDisc = cyl(0.42, 0.42, 0.08, '#a7b3c6', { metalness: 0.35, roughness: 0.4 }); fwDisc.rotation.x = Math.PI / 2; this.flywheel.add(fwDisc);
    // 三根辐条：同一飞轮刚体、同节拍旋转，合并成 1 个 draw call
    const spokes = [];
    for (let k = 0; k < 3; k++) { const sp = box(0.72, 0.055, 0.03, '#8a95a8', { metalness: 0.5 }); sp.rotation.z = k * Math.PI / 3; spokes.push(sp); }
    this.flywheel.add(mergeByMaterial(spokes));
    this.crankArm = cyl(0.05, 0.05, 1, '#8a95a8', { metalness: 0.6 }); ctx.scene.add(this.crankArm);
    this.crankPin = decor(cyl(0.06, 0.06, 0.16, '#d9a066', { metalness: 0.5 })); this.crankPin.rotation.x = Math.PI / 2; this.crankPin.position.set(EX, crankY + this.R, 0.55); ctx.scene.add(this.crankPin);
    this.rod = cyl(0.05, 0.05, 1, '#aab6c8', { metalness: 0.6 }); ctx.scene.add(this.rod);
    // ⑤ 气门：杆 + 盘，竖直向下开（关闭时门头贴缸盖座圈，开启时向下伸入缸内）
    const mkValve = (x, color) => {
      const g = new THREE.Group(); g.position.set(x, this.valveClosedY, 0);
      // 气门盘/杆细小，投影在画面上看不出来，却会在阴影重建时各占一个 draw call → 不投影
      const disc3 = decor(cyl(0.14, 0.09, 0.07, color, { metalness: 0.35, roughness: 0.4, emissive: color, emissiveIntensity: 0.35 })); disc3.position.y = -0.03;
      const stem = decor(cyl(0.03, 0.03, 0.55, '#c9d4e6', { metalness: 0.6 })); stem.position.y = 0.27;
      g.add(disc3, stem); ctx.scene.add(g); return g;
    };
    this.valveIn = mkValve(EX - 0.30, '#22c55e');   // 进气门在左（绿）
    this.valveEx = mkValve(EX + 0.30, '#ef4444');   // 排气门在右（红）
    // 两个气门座圈：静态、同材质，合并成 1 个 draw call
    const seats = [EX - 0.30, EX + 0.30].map(x => { const st = decor(torus(0.14, 0.022, '#aab6c8', { metalness: 0.6 })); st.rotation.x = Math.PI / 2; st.position.set(x, cylTop - 0.01, 0); return st; });
    ctx.scene.add(mergeByMaterial(seats));
    // ⑥ 进/排气管（区分两颗气门的唯一直观判据）
    const pipe = (p1, p2, color) => {
      const dir2 = p2.clone().sub(p1); const len2 = dir2.length();
      const m = decor(cyl(0.06, 0.06, len2, color, { metalness: 0.55, roughness: 0.4 }));
      m.position.copy(p1).addScaledVector(dir2, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir2.clone().normalize());
      ctx.scene.add(m); return m;
    };
    this.intakePipe = pipe(new THREE.Vector3(EX - 0.30, cylTop + 0.30, 0), new THREE.Vector3(EX - 0.80, cylTop + 0.64, 0), '#7ec8ff');
    this.exhaustPipe = pipe(new THREE.Vector3(EX + 0.30, cylTop + 0.30, 0), new THREE.Vector3(EX + 0.80, cylTop + 0.64, 0), '#f0a58a');
    // 管口标注（从管子读哪颗是进气/排气，不依赖缸盖缝隙）
    this.inValvePt = new THREE.Vector3(EX - 0.30, cylTop + 0.30, 0); this.inOuterPt = new THREE.Vector3(EX - 0.80, cylTop + 0.64, 0);
    this.exValvePt = new THREE.Vector3(EX + 0.30, cylTop + 0.30, 0); this.exOuterPt = new THREE.Vector3(EX + 0.80, cylTop + 0.64, 0);
    this.lblInPipe = mkLabel('进气管', '#7ec8ff'); this.lblInPipe.visible = false; ctx.scene.add(this.lblInPipe);
    this.lblExPipe = mkLabel('排气管', '#f0a58a'); this.lblExPipe.visible = false; ctx.scene.add(this.lblExPipe);
    // 开启时的流向箭头（吸气朝缸内、排气朝缸外）
    this.flowIn = mkArrow('#7ec8ff'); ctx.scene.add(this.flowIn);
    this.flowEx = mkArrow('#f0a58a'); ctx.scene.add(this.flowEx);
    // ⑦ 火花塞：陶瓷 + 金属壳 + 电极 + 闪光
    this.sparkCeramic = decor(cyl(0.07, 0.07, 0.26, '#efe9d8', { roughness: 0.6 })); this.sparkCeramic.position.set(EX, cylTop + 0.34, 0); ctx.scene.add(this.sparkCeramic);
    this.sparkShell = decor(cyl(0.095, 0.095, 0.1, '#8a93a6', { metalness: 0.7 })); this.sparkShell.position.set(EX, cylTop + 0.18, 0); ctx.scene.add(this.sparkShell);
    this.sparkElectrode = decor(cyl(0.018, 0.018, 0.22, '#9aa3b2', { metalness: 0.8 })); this.sparkElectrode.position.set(EX, cylTop - 0.06, 0); ctx.scene.add(this.sparkElectrode);
    this.sparkFlash = decor(sphere(0.1, '#fff7c2', { emissive: '#ffe14d', emissiveIntensity: 0, transparent: true, opacity: 0.95 })); this.sparkFlash.position.set(EX, cylTop - 0.16, 0); ctx.scene.add(this.sparkFlash);
    // 活塞运动方向箭头
    this.moveArrow = mkArrow('#cfd8e6'); ctx.scene.add(this.moveArrow);
    this.lbl = mkLabel('', C); this.lbl.position.set(EX, 3.55, 0); ctx.scene.add(this.lbl);
    this.lblEta = mkLabel('', '#f0abfc'); this.lblEta.position.set(-3.0, 3.35, 0); ctx.scene.add(this.lblEta);
    this.lblQ = mkLabel('', '#ffd479'); this.lblQ.position.set(-2.2, 3.3, 0); ctx.scene.add(this.lblQ);
    this.lblIn = mkLabel('进气门 · 闭', '#22c55e'); this.lblIn.position.set(EX - 0.86, cylTop + 0.82, 0); ctx.scene.add(this.lblIn);
    this.lblEx = mkLabel('排气门 · 闭', '#ef4444'); this.lblEx.position.set(EX + 0.86, cylTop + 0.82, 0); ctx.scene.add(this.lblEx);
    this.lblSpk = mkLabel('火花塞', '#ffe14d'); this.lblSpk.position.set(EX, cylTop + 0.60, 0); ctx.scene.add(this.lblSpk);
    this.lblFw = mkLabel('曲轴/飞轮', '#9aa3b2'); this.lblFw.position.set(EX - 0.95, crankY, 0); ctx.scene.add(this.lblFw);
    // 缸体外散热片（风冷发动机的识别特征，静态装饰、不投影）
    this.fins = engineFins({ r: RAD + 0.05, n: 5, h: 1.1 }); this.fins.position.set(EX, 1.28, 0); ctx.scene.add(this.fins);
    // 消声器（排气端，接在排气管外侧）
    this.muf = muffler(); this.muf.position.set(EX + 1.15, cylTop + 0.72, 0); ctx.scene.add(this.muf);
    this.crankAngle = 90;
    this.duration = 1.2;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'stroke') {
      if (this._progStroke === v) { this._progStroke = null; }   // 程序化同步触发的回写，不跳角
      else { this.crankAngle = { intake: 90, compress: 270, power: 450, exhaust: 630 }[v] || 90; }
    }
    this.recompute();
  },
  recompute() {
    const c = Number(this.p.material) || 4.2, m = this.p.mass || 0.5;
    const Q = this.p.heatQ != null ? this.p.heatQ : 15;      // kJ，参数（相同热源加热 → 吸热相同）
    const dTwater = Q / (4.2 * m);                           // 副读数固定为「水温升 ΔT = Q/(c水·m)」
    const qT = this.p.qTotal != null ? this.p.qTotal : 100;
    const wU = this.p.wUseful != null ? this.p.wUseful : 30;
    let eta;
    if (qT <= 0) eta = null; else eta = wU / qT * 100;
    this.Q = Q; this.eta = eta; this.dTwater = dTwater;
    if (this.ctx) this.ctx.emitReadout({ eta: eta == null ? '—' : eta, dT: dTwater });
    // 同一吸收热量 Q、同质量：ΔT = Q/(c·m)，比热容越大升得越少 → 水最低、砂石最高
    // 条高按固定 90℃ 满量程，Q 变大三根条整体变高（直观「加热越多温度越高」）；schema 已保证砂石 ΔT≤90，不越界
    const dTs = this.mats.map(mt => (mt.c * m > 0 ? Q / (mt.c * m) : 0));
    const selIdx = this.mats.findIndex(mt => Math.abs(mt.c - c) < 0.05);
    this.mats.forEach((mt, i) => {
      const dTi = dTs[i];
      const h = clamp(dTi / 90, 0.06, 1) * 2.0;
      this.bars[i].scale.y = h; this.bars[i].position.y = h / 2 + 0.02;
      this.bars[i].material.emissive = new THREE.Color(i === selIdx ? mt.color : '#000000');
      this.bars[i].material.emissiveIntensity = i === selIdx ? 0.35 : 0;
      setLabel(this.qlabels[i], 'ΔT=' + dTi.toFixed(1) + '℃');
      this.qlabels[i].position.set(-3.0 + i * 0.85, h + 0.28, 0);
    });
    const overHeat = Math.max.apply(null, dTs) > 100;
    const maxH = Math.max.apply(null, this.bars.map(b => b.scale.y));
    this.lblQ.position.set(-2.15, maxH + 0.42, 0);
    setLabel(this.lblQ, '同一热源 Q=' + Q + ' kJ · ΔT = Q/(c·m)' + (overHeat ? '  ⚠ 温升>100℃，建议调小 Q' : ''));
    this.lblEta.position.set(-3.0, 3.35, 0);   // 移到左上方空白区，避免右端被画面切掉
    setLabel(this.lblEta, eta == null ? 'η = —（Q总=0）' : 'η = W有/Q总 = ' + eta.toFixed(1) + '%');
    const inBand = eta != null && (eta < 20 || eta > 45);
    this.inBand = inBand;
    // 时间轴：转速 0 → 曲轴不转，没有过程（duration 0）；否则 6 个 720° 工作循环
    const rpm = this.p.rpm || 0;
    this.duration = rpm > 0 ? 6 * (120 / rpm) : 0;
  },
  step(dt) {
    const rpm = this.p.rpm || 0;
    if (dt > 0 && rpm) this.crankAngle = (this.crankAngle + 6 * rpm * dt) % 720;
    this.renderCrank();
  },
  // 时间轴：曲轴角是 t 的闭式函数（→ 活塞/气门/气体全是解析量），seek 直接算，不必重放
  seek(t) {
    const rpm = this.p.rpm || 0;
    const tt = Math.max(0, Number.isFinite(t) ? t : 0);
    if (rpm > 0) this.crankAngle = (90 + 6 * rpm * tt) % 720;   // 与 reset 的初始角 90° 对齐
    this.renderCrank();
  },
  renderCrank() {
    const p720 = ((this.crankAngle % 720) + 720) % 720;   // 720° 一个工作循环
    const phi = (p720 % 360) * Math.PI / 180;             // 活塞按 360°；φ=0 为上止点 TDC
    const r = this.R, l = this.L, EX = this.EX;
    // 曲柄连杆：s 为活塞自上止点向下位移，piston.y = topY − s（φ=0 时 s=0，最上方）
    const s = r * (1 - Math.cos(phi)) + (r * r / (2 * l)) * Math.sin(phi) ** 2;
    const pistonCenter = this.topY - s - this.pistonH / 2;
    this.pistonGroup.position.y = pistonCenter;
    // 曲柄销（相位=曲轴角）+ 曲轴臂
    const pinX = EX + Math.sin(phi) * r, pinY = this.crankY + Math.cos(phi) * r, CZ = 0.55;
    this.crankPin.position.set(pinX, pinY, CZ);
    this.flywheel.rotation.z = -phi;   // 飞轮随曲轴角旋转，肉眼可见在转
    this.placeCyl(this.crankArm, new THREE.Vector3(EX, this.crankY, CZ), new THREE.Vector3(pinX, pinY, CZ));
    // 连杆：活塞销 → 曲柄销（随曲轴摆动倾斜）
    this.placeCyl(this.rod, new THREE.Vector3(EX, pistonCenter, 0), new THREE.Vector3(pinX, pinY, CZ));
    // 气门升程：正弦半波，峰值在冲程中点；压缩/做功必须全闭（lift=0）
    const liftIn = (p720 >= 0 && p720 < 180) ? Math.sin(Math.PI * p720 / 180) : 0;
    const liftEx = (p720 >= 540 && p720 < 720) ? Math.sin(Math.PI * (p720 - 540) / 180) : 0;
    this.valveIn.position.y = this.valveClosedY - liftIn * this.maxLift;
    this.valveEx.position.y = this.valveClosedY - liftEx * this.maxLift;
    // 气门标签：动态状态词（开=气门色加粗调亮，闭=灰暗），与升程一一对应
    const setV = (lbl, open, color, base) => {
      setLabel(lbl, base + (open ? ' · 开' : ' · 闭'));
      const dv = lbl.userData.div;
      if (dv) { dv.style.color = open ? color : '#7b8798'; dv.style.opacity = open ? '1' : '0.55'; dv.style.fontWeight = open ? '700' : '600'; }
    };
    setV(this.lblIn, liftIn > 0.02, '#22c55e', '进气门');
    setV(this.lblEx, liftEx > 0.02, '#ef4444', '排气门');
    // 流向箭头：吸气沿进气管朝缸内，排气沿排气管朝缸外，仅在该门开启时显示
    const inOn = liftIn > 0.02, exOn = liftEx > 0.02;
    this.flowIn.visible = inOn;
    if (inOn) { const d = this.inValvePt.clone().sub(this.inOuterPt).normalize(); setArrow(this.flowIn, d, 0.36); this.flowIn.position.copy(this.inOuterPt).lerp(this.inValvePt, 0.5); }
    this.flowEx.visible = exOn;
    if (exOn) { const d = this.exOuterPt.clone().sub(this.exValvePt).normalize(); setArrow(this.flowEx, d, 0.36); this.flowEx.position.copy(this.exValvePt).lerp(this.exOuterPt, 0.5); }
    // 冲程判定按 720°
    const idx = Math.floor(p720 / 180);
    const names = ['吸气', '压缩', '做功', '排气'];
    const vals = ['intake', 'compress', 'power', 'exhaust'];
    const stroke = names[idx];
    this.syncStrokeUI(vals[idx]);
    // 燃烧室气体：随活塞伸缩 + 按冲程变颜色/亮度
    const chamberTop = this.cylTop, chamberBot = pistonCenter + this.pistonH / 2;
    const ch = Math.max(0.05, chamberTop - chamberBot);
    this.gas.scale.y = ch / 0.3; this.gas.position.y = (chamberTop + chamberBot) / 2;
    const gm = this.gas.material;
    let col = '#9fc6e8', em = 0.05, op = 0.3;
    if (idx === 0) { col = '#9fc6e8'; em = 0.05; op = 0.32; }                                      // 吸气：淡蓝
    else if (idx === 1) { const t = s / (2 * r); col = '#e2a15a'; em = 0.25 + 0.9 * t; op = 0.4; } // 压缩：渐暖变亮
    else if (idx === 2) { const t = (p720 - 360) / 180; col = '#ff5a1f'; em = 0.4 + 1.5 * (1 - 0.8 * t); op = 0.5; } // 做功：最亮红
    else { col = '#8a7f78'; em = 0.08; op = 0.4; }                                                 // 排气：灰暗
    gm.color.set(col); gm.emissive.set(col); gm.emissiveIntensity = em; gm.opacity = op;
    // 火花塞：做功起点 360°~395° 电极闪光
    const sparkOn = (p720 >= 360 && p720 < 395);
    this.sparkFlash.visible = sparkOn;
    this.sparkFlash.material.emissiveIntensity = sparkOn ? (6 * (1 - (p720 - 360) / 35) + 0.5) : 0;
    // 运动方向箭头：吸气/做功 下行，压缩/排气 上行
    const down = (idx === 0 || idx === 2);
    setArrow(this.moveArrow, new THREE.Vector3(0, down ? -1 : 1, 0), 0.34);
    this.moveArrow.position.set(EX + 0.64, pistonCenter, 0);
    this.lbl.position.set(EX, 3.55, 0);
    setLabel(this.lbl, stroke + '冲程（曲轴 ' + p720.toFixed(0) + '°）');
  },
  placeCyl(mesh, a, b) {
    const dir = b.clone().sub(a); const len = dir.length() || 1e-3;
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    mesh.scale.y = len;
  },
  reset() { this.crankAngle = 90; this._shown = null; this._progStroke = null; this.recompute(); },
  // 播放时让「冲程」枚举跟着曲轴角走：优先走外壳 ctx.ui.setEnum，回写时用 _progStroke 抑制跳角
  syncStrokeUI(v) {
    if (this._shown === v) return;
    this._shown = v;
    if (this.ctx && this.ctx.ui && typeof this.ctx.ui.setEnum === 'function') {
      this._progStroke = v;
      this.ctx.ui.setEnum('stroke', v);
      return;
    }
    const btns = document.querySelectorAll('.seg button[data-oid]');
    if (!btns || !btns.length) return;
    btns.forEach(b => {
      const oid = b.getAttribute('data-oid');
      if (oid === 'intake' || oid === 'compress' || oid === 'power' || oid === 'exhaust') {
        b.classList.toggle('active', oid === v);
      }
    });
  },
  dispose() {},
};

/* ===================== 右侧统计面板读数 =====================
 * 返回 [{ label, value, unit }]，每场景 3~6 项；热学数值随播放实时变化，播放前给初值。 */
Object.assign(F1, {
  readouts() {
    const c = this.cfg ? this.cfg() : { mp: 0 };
    const T = this.tempAt ? this.tempAt(this.t || 0) : (this.p.t0 || 0);
    return [
      rd('当前温度 T', T, '℃', 1),
      rd('已加热', (this.t || 0) / 60, 'min', 1),
      { label: '熔点', value: c.mp == null ? '无固定熔点' : rd('', c.mp, '', 0).value, unit: c.mp == null ? '' : '℃' },
      rd('质量', this.p.mass || 0, 'g', 0),
      rd('加热功率', this.p.power || 0, 'W', 0),
    ];
  },
});
Object.assign(F2, {
  readouts() {
    const T = this.T != null ? this.T : (this.p.t0 || 20);
    return [
      rd('当前温度 T', T, '℃', 1),
      rd('沸点', this.Tb, '℃', 2),
      rd('加热功率', this.P, 'W', 0),
      rd('已加热', this.t, 's', 0),
      rd('气压', this.p.pressure != null ? this.p.pressure : 101.3, 'kPa', 1),
    ];
  },
});
Object.assign(F3, {
  readouts() {
    const p720 = (((this.crankAngle || 0) % 720) + 720) % 720;
    const names = ['吸气', '压缩', '做功', '排气'];
    return [
      { label: '当前冲程', value: names[Math.floor(p720 / 180)] || '—', unit: '' },
      rd('曲轴角', p720, '°', 0),
      rd('热机效率 η', this.eta == null ? 0 : this.eta, '%', 1),
      rd('水温升 ΔT', this.dTwater, '℃', 1),
      rd('转速', this.p.rpm || 0, 'r/min', 0),
    ];
  },
});

export const THERMAL = {
  'F1-melting-curve': F1,
  'F2-boiling': F2,
  'F3-heat-engine': F3,
};