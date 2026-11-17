/* 力学 A1~A7 */
import { THREE, COLORS, DEG, G, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, mkArrow, setArrow, fatLine, setFatLine, addGround, clamp } from './common.js';
import { MATS, matClone, registerMaterials, cart, rollCart, woodBlock, metalBlock, beaker, springScale, setSpringScale, slottedMass } from './props.js';

const C = COLORS.mechanics;

/* ===================== A1 斜面小车测平均速度 ===================== */
const A1 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    this.group = new THREE.Group(); ctx.scene.add(this.group);

    // 底座承台（接接触阴影）
    this.basePlate = box(6.5, 0.08, 2.4, '#3a2c14', { roughness: 0.95 });
    this.basePlate.position.set(1.5, -0.04, 0); this.basePlate.receiveShadow = true; this.basePlate.userData.noFit = true; ctx.scene.add(this.basePlate);
    this.support = null;

    // 斜面：真实木板（薄板 + 侧面挡条），不是一根厚黄条
    this.ramp = box(1, 0.06, 0.86, MATS.wood());
    this.ramp.position.y = -0.03;
    this.ramp.castShadow = true; this.ramp.receiveShadow = false;
    this.rampGroup = new THREE.Group(); this.rampGroup.add(this.ramp);
    // 木板两侧的薄挡边（防止小车跑偏）
    const rims = [];
    [-1, 1].forEach(s => { const r = box(1, 0.05, 0.03, MATS.woodDark()); r.position.set(0, 0.03, s * 0.42); rims.push(r); });
    this.rampGroup.add(mergeByMaterial(rims));
    this.group.add(this.rampGroup);

    // 小车：车身 + 四轮 + 车轴（真实小车，随质量缩放的是车身不是方块）
    this.cartG = cart({ len: 0.62, wid: 0.44, wheelR: 0.10 });
    this.cartG.scale.setScalar(0.95);
    this.block = this.cartG;                   // 车随斜面一起倾斜，贴住斜面
    this.rampGroup.add(this.cartG);

    // 力矢量统一用力学识别色 #F59E0B（附录 B）
    this.aG = mkArrow('#F59E0B'); this.aN = mkArrow('#F59E0B'); this.aF = mkArrow('#F59E0B');
    ctx.scene.add(this.aG, this.aN, this.aF);
    this.lG = mkLabel('G', '#F59E0B'); this.lN = mkLabel('N', '#F59E0B'); this.lF = mkLabel('f', '#F59E0B');
    ctx.scene.add(this.lG, this.lN, this.lF);

    this.lAngle = mkLabel('θ', C); this.group.add(this.lAngle);
    this.u = 0; this.v = 0;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'theta') { this.rampGroup.rotation.z = v * DEG; this.lAngle.position.set(0.55, 0.15, 0.5); this.u = 0; this.v = 0; }
    if (k === 'length') { this.L = v; this.ramp.scale.x = v; this.u = 0; this.v = 0; }
    const L = this.p.length || 1;
    this.ramp.position.x = L / 2;              // 低端落在原点，避免斜插入地
    this.buildSupport();
    this._t = 0;
    this.recompute();
    this.place();
  },
  // 斜面支架：木板搭在两条竖直支腿上（教材就是木板搭支架），不是实心楔形块
  buildSupport() {
    if (!this.ctx) return;
    if (this.support) { this.support.traverse(o => o.geometry && o.geometry.dispose()); this.scene.remove(this.support); this.support = null; }
    const L = this.p.length || 1, th = (this.p.theta || 0) * DEG;
    const hiX = L * Math.cos(th), hiY = L * Math.sin(th);
    this.support = new THREE.Group();
    if (hiY > 0.02) {
      const legH = hiY;
      [-1, 1].forEach(s => {
        const leg = box(0.09, legH, 0.1, MATS.woodDark());
        leg.position.set(hiX - 0.12, legH / 2, s * 0.34);
        leg.castShadow = true; leg.receiveShadow = true; this.support.add(leg);
      });
      // 支腿间横撑
      const bar = box(0.09, 0.08, 0.78, MATS.woodDark());
      bar.position.set(hiX - 0.12, legH * 0.45, 0); this.support.add(bar);
    }
    // 地面底脚（接接触阴影）
    const foot = box(Math.max(hiX, 0.3), 0.06, 0.86, MATS.woodDark());
    foot.position.set(hiX / 2, 0.03, 0); foot.receiveShadow = true; this.support.add(foot);
    this.scene.add(this.support);
  },
  accel() {
    const th = this.p.theta * DEG, mu = this.p.mu;
    if (Math.tan(th) <= mu) return 0;
    return G * (Math.sin(th) - mu * Math.cos(th));
  },
  recompute() {
    const th = this.p.theta * DEG, m = this.p.mass, mu = this.p.mu, L = this.p.length || 1;
    const a = this.accel();
    const staticCase = Math.tan(th) <= mu;
    this.aVal = a; this.static = staticCase;
    this.Fg = m * G; this.Fn = m * G * Math.cos(th);
    this.Ff = staticCase ? m * G * Math.sin(th) : mu * m * G * Math.cos(th);
    // 时间轴：静止（μ≥tanθ）→ duration 0（没有过程）；能动 → 物理下滑时长慢放 1.4 倍作为呈现时长
    if (staticCase) { this.duration = 0; this.kA = 0; }
    else {
      this.durPhys = Math.sqrt(2 * Math.max(L - 0.3, 0.05) / a);
      this.duration = this.durPhys * 1.4;
      this.kA = this.durPhys / this.duration;      // 呈现时间 → 物理时间
    }
    if (this.ctx) this.ctx.emitReadout({ acc: staticCase ? '静止' : a });
  },
  // 时间轴：匀加速直线运动有闭式解，seek 直接算（解析型）
  seek(t) {
    const tv = Math.max(0, Number.isFinite(t) ? t : 0);
    this._t = this.duration > 0 ? Math.min(tv, this.duration) : tv;
    if (!this.static) {
      const L = this.p.length || 1;
      const tp = Math.min(this._t * (this.kA || 0), this.durPhys || 0);
      this.u = Math.min(0.5 * this.aVal * tp * tp, Math.max(L - 0.3, 0));
      this.v = this.aVal * tp;
    } else { this.u = 0; this.v = 0; }
    this.place();
  },
  place() {
    const L = this.p.length || 1, th = this.p.theta * DEG;
    const bx = (L - 0.15) - this.u;
    this.block.position.set(bx, 0.005, 0);      // 车轮底面贴住斜面
    rollCart(this.cartG, this.u / 0.10);         // 车轮随位移滚动
    this.rampGroup.updateMatrixWorld(true);
    const wp = this.rampGroup.localToWorld(new THREE.Vector3(bx, 0.20, 0));
    const s = 0.13;
    const gd = new THREE.Vector3(0, -1, 0);
    const nd = new THREE.Vector3(-Math.sin(th), Math.cos(th), 0);
    const fd = new THREE.Vector3(Math.cos(th), Math.sin(th), 0);
    const gLen = this.Fg * s, nLen = this.Fn * s, fLen = this.Ff * s;
    setArrow(this.aG, gd, gLen); this.aG.position.copy(wp);
    setArrow(this.aN, nd, nLen); this.aN.position.copy(wp);
    setArrow(this.aF, fd, fLen); this.aF.position.copy(wp);
    const tip = (dir, len) => wp.clone().addScaledVector(dir.clone().normalize(), len + 0.08);
    this.lG.position.copy(tip(gd, gLen));
    this.lN.position.copy(tip(nd, nLen));
    this.lF.position.copy(tip(fd, fLen));
    setLabel(this.lAngle, 'θ=' + this.p.theta + '°');
  },
  step(dt) {
    if (dt <= 0) return;
    if (this.static) { this.place(); return; }
    const L = this.p.length || 1;
    const tPhys = Math.min((this._t = clamp((this._t || 0) + dt, 0, this.duration || 0)) * (this.kA || 0), this.durPhys || 0);
    this.u = Math.min(0.5 * this.aVal * tPhys * tPhys, Math.max(L - 0.3, 0));
    this.v = this.aVal * tPhys;
    this.place();
  },
  reset() { this._t = 0; this.u = 0; this.v = 0; this.recompute(); this.place(); },
  dispose() {},
};

/* ===================== A2 阻力对运动的影响（多轨迹对比） ===================== */
const A2 = {
  p: {},
  SURFACES: [
    { mu: 0.60, label: '毛巾', color: '#E8E0D0' },
    { mu: 0.30, label: '棉布', color: '#B9BEC4' },
    { mu: 0.12, label: '木板', color: '#8a5a2b' },
    { mu: 0.02, label: '冰面', color: '#CFE8F2' },
    { mu: 0.00, label: '理想光滑', color: '#2E4A6B' },
  ],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    this.base = box(11.0, 0.06, 3.0, '#2a3448', { roughness: 0.95 });
    this.base.position.y = -0.03; this.base.receiveShadow = true; this.base.userData.noFit = true; ctx.scene.add(this.base);
    this.tracksG = new THREE.Group(); ctx.scene.add(this.tracksG);
    // 实验小车（车身 + 四轮 + 车轴）：五条不同粗糙度的轨道上各跑一次
    this.cartG = cart({ len: 0.52, wid: 0.36, wheelR: 0.09 });
    this.block = this.cartG; ctx.scene.add(this.cartG);
    this.makeLegend();
    this.duration = 3.4;        // 在 build 期就有值：外壳切场景时会立刻读 duration，不能等到参数回灌
    this.t = 0;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'surface' || k === 'height' || k === 'mass') { this.t = 0; }
    this.recompute();
  },
  // 左上角固定图例（DOM 覆盖在 3D 视口上，不压跑道）
  makeLegend() {
    const old = document.getElementById('a2-legend'); if (old) old.remove();
    const host = document.getElementById('viewport') || document.body;
    const el = document.createElement('div');
    el.id = 'a2-legend';
    el.style.cssText = 'position:absolute;left:12px;top:46px;z-index:7;font:600 11px/1.5 ui-monospace,Consolas,monospace;color:#E6EDF7;background:rgba(11,17,32,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 9px;pointer-events:none;';
    host.appendChild(el);
    this.legendEl = el;
  },
  updateLegend() {
    if (!this.legendEl || !this.list) return;
    const head = '<div style="color:#ffd479;margin-bottom:5px">' + this.sel.label + ' · 滑行 s=' + (isFinite(this.s) ? this.s.toFixed(2) + ' m' : '∞（永不停止）') + ' · h=' + (this.p.height || 0.15).toFixed(2) + ' m</div>';
    const rows = this.list.map(o => {
      const on = (o === this.sel);
      const dot = '<span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:' + o.color + ';margin-right:7px;vertical-align:middle;border:1px solid rgba(255,255,255,.3)"></span>';
      const d = isFinite(o.s) ? o.s.toFixed(2) + ' m' : '永不停止';
      const st = on ? 'color:#fff;font-weight:700;' : 'color:#aab6c8;';
      return '<div style="' + st + 'margin:1px 0">' + dot + o.label + ' · μ=' + o.mu.toFixed(2) + ' · ' + d + '</div>';
    }).join('');
    this.legendEl.innerHTML = head + rows;
  },
  recompute() {
    const h = this.p.height || 0.15;
    this.v0 = Math.sqrt(2 * G * h);
    // 质量不改变滑行距离（v0 由高度决定，s=v0²/(2μg) 与 m 无关）——这正是教学点。
    const ms = clamp(this.p.mass || 0.4, 0.1, 1.0);
    this.syncWeights(ms);
    const list = this.SURFACES.map(o => ({ mu: o.mu, label: o.label, color: o.color, s: o.mu > 0 ? (this.v0 * this.v0) / (2 * o.mu * G) : Infinity }));
    const finite = list.filter(o => isFinite(o.s)).map(o => o.s);
    const finMax = finite.length ? Math.max.apply(null, finite) : 1;
    this.scale = 7 / Math.max(finMax, 0.4);
    this.list = list;
    const selMu = Number(this.p.surface);
    this.sel = list.find(o => Math.abs(o.mu - selMu) < 1e-6) || list[1];
    this.s = this.sel.s;
    // 几何常量：五条等长平直跑道 + 仅一条释放坡（随选中材料平移）
    this.BL = 7.0; this.XF0 = -3.3; this.RL = 1.5;
    this.H_ramp = clamp(0.42 + h * 2.0, 0.5, 1.05);
    this.theta = Math.atan(this.H_ramp / this.RL);
    this.Tramp = clamp(1.15 - h * 2.0, 0.45, 1.1);   // 坡上零摩擦，仅用于呈现下滑动画
    const tfStop = this.sel.mu > 0 ? this.v0 / (this.sel.mu * G) : 6;
    // 时长口径（CEO 定）：有终点的小过程 3.4s 呈现；理想光滑是无限过程 → duration = Infinity（禁拖、不自动暂停）
    if (isFinite(this.s)) {
      this.physTrip = this.Tramp + tfStop;
      this.duration = 3.4;
      this.kTime = this.physTrip / this.duration;
    } else {
      const xmNeed = (this.BL - 0.3) / Math.max(this.scale, 1e-6);   // 滑到板子右端所需的物理距离
      this.physTrip = this.Tramp + xmNeed / this.v0;
      this.duration = Infinity;
      this.kTime = this.physTrip / 20;               // 约 20s 滑到板端，之后继续匀速滑出画面（不循环）
    }
    if (this.ctx) this.ctx.emitReadout({ slide: isFinite(this.s) ? this.s : '理想光滑：永不停止' });
    this.buildTracks();
    this.t = 0;
    this.updateLegend();
    this.draw();
  },
  // 配重块：质量越大，车上摞的砝码越多（外形不变、载重变，学生看得见「更重」）
  syncWeights(ms) {
    if (!this.block || !this.block.userData) return;
    const want = Math.round(ms * 4);
    if (this._weightsN === want) return;
    this._weightsN = want;
    if (this.weightG) { this.block.remove(this.weightG); this.weightG.traverse(o => o.geometry && o.geometry.dispose()); }
    this.weightG = new THREE.Group();
    for (let i = 0; i < want; i++) {
      const w = box(0.16, 0.05, 0.16, MATS.iron());
      w.position.set(0, 0.055 + i * 0.055, 0);
      this.weightG.add(w);
    }
    this.block.add(this.weightG);
  },
  mkBoardMat(isSel, hex) {
    const col = new THREE.Color(hex);
    if (!isSel) col.lerp(new THREE.Color('#565d6b'), 0.62);   // 未选中去饱和压暗
    return new THREE.MeshStandardMaterial({
      color: col, roughness: 0.82, metalness: 0.02,
      transparent: !isSel, opacity: isSel ? 1 : 0.25, depthWrite: true,
      emissive: new THREE.Color(isSel ? hex : '#000000'), emissiveIntensity: isSel ? 0.16 : 0,
    });
  },
  buildTracks() {
    // 清场：几何必释放；私有材质（非 shared）也释放，避免切材料累积
    while (this.tracksG.children.length) {
      const c = this.tracksG.children[0];
      this.tracksG.remove(c);
      c.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !(o.material.userData && o.material.userData.shared)) o.material.dispose();
        if (o.isCSS2DObject && o.element) o.element.remove();
      });
    }
    const n = this.list.length, ZSP = 0.6, BL = this.BL, XF0 = this.XF0;
    const marks = [], ramps = [];
    this.list.forEach((o, idx) => {
      const z = -((n - 1) / 2) * ZSP + idx * ZSP;
      const isSel = (o === this.sel);
      // 等长平直跑道（选中亮、其余压暗去饱和）
      const bar = new THREE.Mesh(new THREE.BoxGeometry(BL, 0.08, 0.44), this.mkBoardMat(isSel, o.color));
      bar.position.set(XF0 + BL / 2, 0.04, z); bar.userData.noFit = true; bar.receiveShadow = true; bar.castShadow = false;
      this.tracksG.add(bar);
      // 滑行距离标记条 + 终点刻度（数据元素，力学识别色；细条不抢画面）
      const sW = isFinite(o.s) ? clamp(o.s * this.scale, 0.15, BL - 0.05) : BL - 0.05;
      const mk = box(sW, 0.015, 0.075, '#F59E0B', { emissive: '#F59E0B', emissiveIntensity: 0.7, transparent: true, opacity: 0.85, depthWrite: false });
      mk.position.set(XF0 + sW / 2, 0.085, z); mk.castShadow = false; marks.push(mk);
      const tk = box(0.04, 0.012, 0.34, '#FDE68A', { transparent: true, opacity: 0.85, depthWrite: false });
      tk.position.set(XF0 + sW, 0.085, z); tk.castShadow = false; marks.push(tk);
      // 只有选中材料才有释放坡（随材料平移）；坡用浅木色，和小车（深木色）分得开
      if (isSel) {
        const rp = box(this.RL / Math.cos(this.theta), 0.05, 0.44, MATS.woodLight());
        rp.position.set(XF0 - this.RL / 2, 0.08 + this.H_ramp / 2, z); rp.rotation.z = -this.theta; ramps.push(rp);
        const riser = box(0.06, this.H_ramp, 0.44, MATS.woodDark());
        riser.position.set(XF0 - this.RL, 0.08 + this.H_ramp / 2, z); ramps.push(riser);
      }
    });
    if (marks.length) { const mg = mergeByMaterial(marks); mg.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; }); this.tracksG.add(mg); }
    if (ramps.length) this.tracksG.add(mergeByMaterial(ramps));
  },
  // 三段运动：ramp（零摩擦能量法）→ flat（μg 减速）→ stopped
  // 入参 t 是「呈现时间」（0~duration），内部按 kTime 换成物理时间，纯解析式、确定性
  stateAt(tPres) {
    const t = tPres * (this.kTime || 1);
    const XF0 = this.XF0, RL = this.RL, H = this.H_ramp, th = this.theta, Y = 0.08;
    if (t < this.Tramp) {
      const p = t / this.Tramp, u = p * p;                 // 加速下滑（零摩擦，v=√(2g·已下落高度)）
      const f = 0.16 + u * 0.84;                           // 起点略离坡顶，车身不悬空
      return { x: (XF0 - RL) + f * RL, y: Y + H * (1 - f), rot: -th, roll: (f * RL / Math.cos(th)), phase: 'ramp' };
    }
    const tf = t - this.Tramp, mu = this.sel.mu, v0 = this.v0;
    if (!isFinite(this.s)) {
      const xm = v0 * tf;
      return { x: XF0 + xm * this.scale, y: Y, rot: 0, roll: (RL / Math.cos(th)) + xm * this.scale, phase: 'flat', over: xm * this.scale > this.BL - 0.25 };
    }
    const tfStop = mu > 0 ? v0 / (mu * G) : Infinity;   // 平面段停下的时刻
    let xm = (tf >= tfStop) ? this.s : (v0 * tf - 0.5 * mu * G * tf * tf);
    if (!(xm >= 0)) xm = 0;
    if (xm > this.s) xm = this.s;
    const still = tf < tfStop;
    return { x: XF0 + xm * this.scale, y: Y, rot: 0, roll: (RL / Math.cos(th)) + xm * this.scale, phase: still ? 'flat' : 'stopped' };
  },
  step(dt) {
    if (dt <= 0) { this.draw(); return; }
    const d = this.duration;
    this.t = Number.isFinite(d) ? clamp(this.t + dt, 0, d) : Math.max(0, this.t + dt);   // ∞ 不封顶，也不循环
    this.draw();
  },
  draw() {
    if (!this.list) return;
    const idx = Math.max(0, this.list.indexOf(this.sel));
    const n = this.list.length, ZSP = 0.6;
    const z = -((n - 1) / 2) * ZSP + idx * ZSP;
    const st = this.stateAt(this.t || 0);
    this.block.position.set(st.x, st.y, z);
    this.block.rotation.z = st.rot;
    rollCart(this.cartG, st.roll / 0.09);
  },
  reset() { this.t = 0; this.recompute(); },
  // 时间轴：A2 状态是 t 的解析式（分段运动学有闭式解），seek 直接算，无需重放
  seek(t) {
    if (!this.list) return;
    const tt = Number.isFinite(t) ? Math.max(0, t) : 0;   // 非法值一律落到 0，∞ 时长下也不会出 NaN
    const d = this.duration;
    this.t = Number.isFinite(d) ? clamp(tt, 0, d) : tt;
    this.draw();
  },
  dispose() { const el = document.getElementById('a2-legend'); if (el) el.remove(); this.legendEl = null; },
};

/* ===================== A3 滑动摩擦力 ===================== */
const A3 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    // 实验台面：木桌板（长木板 + 两侧包边），不是一块蓝板
    this.surface = box(9, 0.10, 1.4, MATS.wood()); this.surface.position.y = -0.05;
    this.surface.userData.noFit = true;
    ctx.scene.add(this.surface);
    const edge = [];
    [-1, 1].forEach(s => { const e = box(9, 0.04, 0.06, MATS.woodDark()); e.position.set(0, 0.0, s * 0.7); edge.push(e); });
    const eg = mergeByMaterial(edge); eg.userData.noFit = true; ctx.scene.add(eg);
    // 待测木块：浅色薄木板（木纹沿长边），带挂钩
    this.blockG = woodBlock({ w: 0.72, h: 0.20, d: 0.40 });
    this.block = this.blockG;
    ctx.scene.add(this.blockG);
    // 铁架台：底座 + 立杆 + 横臂夹持弹簧测力计（不让测力计悬空）
    this.stand = new THREE.Group();
    const sb = box(0.62, 0.07, 0.44, MATS.iron()); sb.position.y = 0.035; sb.receiveShadow = true;
    const rod = cyl(0.045, 0.045, 2.2, MATS.steel()); rod.position.set(-0.22, 1.1, 0);
    const arm = cyl(0.03, 0.03, 0.5, MATS.steel()); arm.rotation.z = Math.PI / 2; arm.position.set(-0.05, 2.0, 0);
    this.stand.add(sb, rod, arm); ctx.scene.add(this.stand);
    // 弹簧测力计：方壳带刻度窗口 + 顶部提环 + 底部挂钩
    this.scaleG = springScale({ h: 0.9, w: 0.2, d: 0.12 });
    this.scale = this.scaleG;
    this.scale.position.set(0.16, 1.5, 0); ctx.scene.add(this.scaleG);
    // 提环挂到横臂上（细线）
    this.hang = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)], '#cfd8e6', 1.5);
    ctx.scene.add(this.hang);
    this.hook = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)], '#e6edf7', 2);
    ctx.scene.add(this.hook);
    this.pullArrow = mkArrow('#ffe066'); ctx.scene.add(this.pullArrow);
    this.fArrow = mkArrow('#ff8a5a'); ctx.scene.add(this.fArrow);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.x = 0;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'area') this.block.scale.set(v === 'big' ? 1 : 0.55, 1, v === 'big' ? 1 : 0.7);
    this.recompute();
  },
  recompute() {
    const f = (this.p.mu || 0.4) * (this.p.normal || 2);
    this.f = f;
    // 时间轴：木块被匀速拖动的观察窗（读数 f 是静态量，拖动本身只是过程呈现）
    // 系数取 1.2 让 pull 全档（0.05~0.3）都能在 4~12s 之间活动：pull=0.3→4s，pull=0.1→12s
    const v = Math.max(this.p.pull || 0.1, 0.02);
    this.duration = clamp(1.2 / v, 4, 12);
    if (this.ctx) this.ctx.emitReadout({ read: f });
  },
  drawAt(tPres) {
    const v = Math.max(this.p.pull || 0.1, 0.02);
    const d = this.duration || 8;
    this._t = Math.min(Math.max(Number.isFinite(tPres) ? tPres : 0, 0), d);
    this.x = Math.min(v * this._t, 4);
    this.block.position.set(this.x, 0.0, 0);
    // 测力计固定在铁架台横臂上，指针随拉力下移（不再悬空、也不跟着木块跑）
    setSpringScale(this.scaleG, clamp(this.f / 4, 0.04, 1));
    // 提环挂到横臂上
    this.hang.geometry.setPositions([0.16, 2.02, 0, -0.05, 2.0, 0]);
    this.hang.computeLineDistances();
    // 底部挂钩勾住木块：一条细绳从挂钩斜拉到木块挂点
    this.hook.geometry.setPositions([0.16, 0.98, 0, this.x, 0.18, 0]);
    this.hook.computeLineDistances();
    setArrow(this.pullArrow, new THREE.Vector3(1, 0, 0), clamp(this.f * 0.35, 0.2, 1.2));
    this.pullArrow.position.set(this.x + 0.46, 0.22, 0);
    setArrow(this.fArrow, new THREE.Vector3(-1, 0, 0), clamp(this.f * 0.35, 0.2, 1.2));
    this.fArrow.position.set(this.x - 0.46, 0.08, 0);
    this.lbl.position.set(this.x, 0.48, 0);
    setLabel(this.lbl, 'f=' + this.f.toFixed(2) + ' N');
  },
  step(dt) { this.drawAt((this._t || 0) + Math.max(dt, 0)); },
  // 时间轴：匀速拖动，位置是 t 的线性函数（解析型）
  seek(t) { this.drawAt(t); },
  reset() { this._t = 0; this.x = 0; this.recompute(); this.drawAt(0); },
  dispose() {},
};

/* ===================== A4 液体内部压强 ===================== */
const A4 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    // 容器：柱形 / 上宽下窄(flare) / 上窄下宽(neck)，用圆柱上下半径表现，vessel 参数真正生效
    this.tank = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.0, 32, 1, true), mat('#9fb6d4', { transparent: true, opacity: 0.16, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide }));
    this.tank.position.set(-1, 1.5, 0); this.tank.castShadow = false; ctx.scene.add(this.tank);
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.24, 2.6, 32), mat('#3b82f6', { transparent: true, opacity: 0.35, roughness: 0.15, depthWrite: false }));
    this.water.position.set(-1, 1.3, 0); this.water.castShadow = false; ctx.scene.add(this.water);
    // 探头：带橡皮膜的金属盒（压强计探头）+ 可绕竖直轴转的指针
    this.probeArm = new THREE.Group();
    const probeBox = box(0.22, 0.14, 0.22, MATS.steel()); probeBox.position.y = 0; this.probeArm.add(probeBox);
    const membrane = cyl(0.11, 0.11, 0.03, MATS.rubberRed()); membrane.position.y = -0.085; this.probeArm.add(membrane);
    this.probeArm.position.set(-1, 2.0, 0); ctx.scene.add(this.probeArm);
    // 橡胶软管：从探头连到 U 形管（压强计的传动链）
    this.hose = fatLine([new THREE.Vector3(-1, 2.0, 0), new THREE.Vector3(0.6, 2.0, 0), new THREE.Vector3(1.6, 1.6, 0), new THREE.Vector3(2.2, 1.9, 0)], '#4a4550', 5);
    ctx.scene.add(this.hose);
    // U 形管（右侧）：两根玻璃管 + 底部连通 + 红液柱
    this.utube = cyl(0.09, 0.09, 2.4, MATS.glass()); this.utube.position.set(2.2, 1.4, 0); this.utube.castShadow = false; ctx.scene.add(this.utube);
    this.utube2 = this.utube.clone(); this.utube2.position.set(2.9, 1.4, 0); ctx.scene.add(this.utube2);
    this.conn = cyl(0.09, 0.09, 0.7, MATS.glass()); this.conn.rotation.z = Math.PI / 2; this.conn.position.set(2.55, 0.28, 0); this.conn.castShadow = false; ctx.scene.add(this.conn);
    this.colA = cyl(0.07, 0.07, 1, matClone('mercury')); this.colA.position.set(2.2, 1, 0); this.colA.castShadow = false; ctx.scene.add(this.colA);
    this.colB = cyl(0.07, 0.07, 1, matClone('mercury')); this.colB.position.set(2.9, 1, 0); this.colB.castShadow = false; ctx.scene.add(this.colB);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.lblDh = mkLabel('', '#9ad2ff'); ctx.scene.add(this.lblDh);
  },
  onParam(k, v) { this.p[k] = v; if (k === 'vessel') this.buildVessel(); this.recompute(); },
  buildVessel() {
    const v = this.p.vessel || 'cyl';
    let rt = 1.3, rb = 1.3;
    if (v === 'flare') { rt = 1.55; rb = 1.0; }       // 上宽下窄
    else if (v === 'neck') { rt = 1.0; rb = 1.55; }   // 上窄下宽
    this.tank.geometry.dispose(); this.tank.geometry = new THREE.CylinderGeometry(rt, rb, 3.0, 32, 1, true);
    this.water.geometry.dispose(); this.water.geometry = new THREE.CylinderGeometry(rt - 0.06, rb - 0.06, 2.6, 32);
  },
  recompute() {
    const rho = Number(this.p.liquid) || 1.0, hcm = this.p.depth || 10;
    const p = rho * 1000 * G * (hcm / 100);           // Pa
    this.press = p;
    this.dhmm = rho * hcm * 10;                        // mm（水柱）
    if (this.ctx) this.ctx.emitReadout({ dh: this.dhmm });
    // 探头深度
    const y = 2.55 - (hcm / 30) * 2.4;
    if (this.probeArm) {
      this.probeArm.position.y = y;
      this.probeArm.rotation.y = (this.p.orient || 0) * DEG;   // 朝向：绕竖直轴转，读数不变（学生能看到探针在转）
      this.lbl.position.set(-1, y + 0.35, 0); setLabel(this.lbl, 'h=' + hcm + 'cm · 朝向 ' + Math.round(this.p.orient || 0) + '°');
    }
    // U 管液面
    const baseH = 1.6, d = this.dhmm / 1000 * 3.2;      // 视觉放大
    if (this.colA) { this.colA.scale.y = Math.max(0.05, (baseH - d) ); this.colA.position.y = (baseH - d) / 2 + 0.2; }
    if (this.colB) { this.colB.scale.y = Math.max(0.05, (baseH + d)); this.colB.position.y = (baseH + d) / 2 + 0.2; }
    if (this.lblDh) { this.lblDh.position.set(2.55, 3.1, 0); setLabel(this.lblDh, 'Δh=' + this.dhmm.toFixed(0) + ' mm'); }
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== A5 浮力 ===================== */
const A5 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    // 溢水杯：带刻度与缸口圆边的玻璃量杯 + 侧向溢水口 + 接水小桶（排水法看 V排）
    this.tankG = beaker({ r: 1.55, h: 2.6 });
    this.tank = this.tankG;
    ctx.scene.add(this.tankG);
    // 侧向溢水口：缸壁上部伸出的短嘴（真实溢水杯的识别特征）
    this.spout = cyl(0.09, 0.11, 0.55, MATS.glass());
    this.spout.rotation.z = Math.PI / 2 - 0.28;
    this.spout.position.set(1.62, 2.18, 0); this.spout.castShadow = false; ctx.scene.add(this.spout);
    // 接水小桶（带刻度的小烧杯）
    this.catchG = beaker({ r: 0.5, h: 0.75 }); this.catchG.position.set(2.75, 0, 0); ctx.scene.add(this.catchG);
    this.catchWater = cyl(0.46, 0.46, 0.4, mat('#3b82f6', { transparent: true, opacity: 0.35, roughness: 0.12, depthWrite: false }));
    this.catchWater.position.set(2.75, 0.2, 0); this.catchWater.castShadow = false; ctx.scene.add(this.catchWater);
    this.water = cyl(1.48, 1.48, 2.2, mat('#3b82f6', { transparent: true, opacity: 0.20, roughness: 0.12, depthWrite: false }));
    this.water.position.y = 1.1; this.water.castShadow = false; ctx.scene.add(this.water);
    // 被测物：金属块 + 吊环（真实器材），不是橙色方块
    this.objG = metalBlock({ size: 1.0 });
    this.obj = this.objG;
    ctx.scene.add(this.objG);
    this.string = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)], '#e6edf7', 2); ctx.scene.add(this.string);
    this.aG = mkArrow('#ff8a8a'); this.aF = mkArrow('#7ec8ff'); ctx.scene.add(this.aG, this.aF);
    this.lG = mkLabel('G', '#ff8a8a'); this.lF = mkLabel('F浮', '#9ad2ff'); ctx.scene.add(this.lG, this.lF);
    this.lRead = mkLabel('', C); ctx.scene.add(this.lRead);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const V = (this.p.volume || 200) * 1e-6;            // m³
    const rhoObj = this.p.rhoObj || 0.9, rhoL = this.p.rhoLiquid || 1.0;
    let rhoEff = rhoObj;
    if (this.p.hollow === 'hollow') rhoEff = rhoObj * 0.45;
    // 潜艇注水
    if (this.p.ballast) rhoEff *= (1 + this.p.ballast / 100 * 0.8);
    this.side = Math.cbrt(V);
    // 浸没深度：按「物块高度的比例」映射，0~30cm 整程都在 0~100% 范围，不再上半程全被 clamp
    const subFrac = clamp((this.p.submerge != null ? this.p.submerge : 8) / 30, 0, 1);
    const sub = subFrac * this.side;
    this.subFrac = subFrac;
    const Vsub = this.side * this.side * sub;
    this.G = rhoEff * 1000 * V * G;
    this.Fb = rhoL * 1000 * Vsub * G;
    this.read = Math.max(0, this.G - this.Fb);
    if (this.ctx) this.ctx.emitReadout({ read: this.read });
    this.floatUp = this.Fb > this.G;
    this.layout();
  },
  layout() {
    if (!this.obj) return;
    const s = this.side;
    // 物块显示尺寸放大到可读（物理量用真实 V，视觉用放大系数），避免 5cm 方块在 1.5m 缸里看不见
    const disp = clamp(s * 9, 0.5, 1.0);
    this.obj.scale.set(disp, disp, disp);
    const subY = (this.subFrac || 0) * disp;   // 视觉浸没深度按显示高度
    const bot = 2.0 - subY;                    // 器材组原点在底面，直接落在水线下方 subY
    this.obj.position.set(0, bot, 0);
    const cy = bot + disp / 2;                 // 物块几何中心（力矢起点）
    this.string.geometry.setPositions([0, 2.55, 0, 0, bot + disp, 0]);
    this.string.computeLineDistances();
    const scl = 0.06;
    setArrow(this.aG, new THREE.Vector3(0, -1, 0), this.G * scl); this.aG.position.set(0, cy, 0);
    setArrow(this.aF, new THREE.Vector3(0, 1, 0), this.Fb * scl); this.aF.position.set(0, cy, 0);
    this.lG.position.set(0.45, cy - this.G * scl, 0); setLabel(this.lG, 'G=' + this.G.toFixed(2) + 'N');
    this.lF.position.set(-0.5, cy + this.Fb * scl, 0); setLabel(this.lF, 'F浮=' + this.Fb.toFixed(2) + 'N');
    this.lRead.position.set(0, 3.1, 0);
    setLabel(this.lRead, (this.floatUp ? '上浮' : '下沉') + ' · 浸没 ' + Math.round(this.subFrac * 100) + '% · 示数 ' + this.read.toFixed(2) + 'N');
    // 接水桶水位随排水体积（V排）上升——排水法的直观证据
    if (this.catchWater) {
      const ch = Math.max(0.03, (this.subFrac || 0) * 0.62);
      this.catchWater.scale.y = ch / 0.4;
      this.catchWater.position.y = 0.03 + ch / 2;
    }
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== A6 动能势能 ===================== */
const A6 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    // 摆：铁架台（底座 + 立柱 + 顶梁）悬挂金属摆球
    this.stand = new THREE.Group();
    const sb = box(0.8, 0.07, 0.5, MATS.iron()); sb.position.set(-1.4, 0.035, 0); sb.receiveShadow = true;
    const pole = cyl(0.05, 0.05, 3.5, MATS.steel()); pole.position.set(-2.0, 1.75, 0);
    const beam = cyl(0.035, 0.035, 0.7, MATS.steel()); beam.rotation.z = Math.PI / 2; beam.position.set(-1.66, 3.42, 0);
    this.stand.add(sb, pole, beam); ctx.scene.add(this.stand);
    this.pivot = new THREE.Object3D(); this.pivot.position.set(-1.4, 3.4, 0); ctx.scene.add(this.pivot);
    this.rod = cyl(0.03, 0.03, 1, MATS.steelBright()); ctx.scene.add(this.rod);
    this.bob = sphere(0.22, MATS.steel()); ctx.scene.add(this.bob);
    // 能量条
    this.barEk = box(0.3, 1, 0.3, '#34D399'); this.barEk.position.set(1.4, 0.5, 0); ctx.scene.add(this.barEk);
    this.barEp = box(0.3, 1, 0.3, '#60A5FA'); this.barEp.position.set(2.0, 0.5, 0); ctx.scene.add(this.barEp);
    this.lEk = mkLabel('Ek', '#34D399'); this.lEp = mkLabel('Ep', '#60A5FA'); ctx.scene.add(this.lEk, this.lEp);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.theta = 0; this.omega = 0;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'height') this._src = 'h';
    else if (k === 'angle') this._src = 'a';
    this.recompute();
  },
  recompute() {
    const L = this.p.pendLen || 0.6, m = this.p.mass || 0.2;
    const hDer = Math.acos(clamp(1 - (this.p.height || 0.2) / L, -1, 1)) / DEG;
    // height 与 angle 都能定义释放角：取「最后改动的那个」为准，避免一个永远压住另一个
    let th0;
    if (this._src === 'h') th0 = clamp(hDer, 2, 85);
    else th0 = clamp(Math.min(this.p.angle || 20, hDer), 2, 85);
    this.L = L; this.m = m; this.th0 = th0 * DEG;
    this.EkMax = m * G * L * (1 - Math.cos(this.th0));
    // 时间轴：约 4 个周期（够看出阻尼衰减）；积分型，seek 用 1/120 定步长从头重放
    this.duration = 4 * 2 * Math.PI * Math.sqrt(L / G);
    if (this.ctx) this.ctx.emitReadout({ ek: this.EkMax });
    this.theta = this.th0; this.omega = 0;
    this.draw();
  },
  // 积分型 seek：清空状态后按固定步长 1/120 从 0 重放到 t（保证确定、可反复调用）
  seek(t) {
    const d = this.duration || 0;
    const tt = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), d);
    const L = this.L || 0.6, damp = this.p.damping || 0, h = 1 / 120;
    this.theta = this.th0 || 0; this.omega = 0;
    const n = Math.round(tt / h);
    for (let i = 0; i < n; i++) {
      const alpha = -(G / L) * Math.sin(this.theta) - damp * this.omega;
      this.omega += alpha * h; this.theta += this.omega * h;
    }
    this._t = tt;
    this.draw();
  },
  step(dt) {
    if (dt <= 0) { this.draw(); return; }
    const L = this.L, damp = this.p.damping || 0;
    const alpha = -(G / L) * Math.sin(this.theta) - damp * this.omega;
    this.omega += alpha * dt; this.theta += this.omega * dt;
    this.draw();
  },
  draw() {
    const L = this.L, m = this.m;
    const px = this.pivot.position.x + Math.sin(this.theta) * L;
    const py = this.pivot.position.y - Math.cos(this.theta) * L;
    this.rod.position.set((this.pivot.position.x + px) / 2, (this.pivot.position.y + py) / 2, 0);
    this.rod.scale.y = L; this.rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(px - this.pivot.position.x, py - this.pivot.position.y, 0).normalize());
    this.bob.position.set(px, py, 0);
    const v = Math.abs(this.omega) * L;
    const Ek = 0.5 * m * v * v;
    const h = L - Math.cos(this.theta) * L;
    const Ep = m * G * h;
    const tot = Math.max(this.EkMax, 1e-4);
    this.barEk.scale.y = Math.max(0.02, Ek / tot) * 2.4; this.barEk.position.y = this.barEk.scale.y / 2;
    this.barEp.scale.y = Math.max(0.02, Ep / tot) * 2.4; this.barEp.position.y = this.barEp.scale.y / 2;
    this.lEk.position.set(1.4, this.barEk.scale.y + 0.25, 0); setLabel(this.lEk, 'Ek ' + Ek.toFixed(2) + 'J');
    this.lEp.position.set(2.0, this.barEp.scale.y + 0.25, 0); setLabel(this.lEp, 'Ep ' + Ep.toFixed(2) + 'J');
    this.lbl.position.set(-1.4, 3.75, 0); setLabel(this.lbl, 'T=' + (2 * Math.PI * Math.sqrt(L / G)).toFixed(2) + 's');
  },
  reset() { this.theta = this.th0 || 0.3; this.omega = 0; this.recompute(); },
  dispose() {},
};

/* ===================== A7 杠杆平衡 ===================== */
const A7 = {
  p: {},
  MAX_TILT: 25,          // 极限倾角（度）：转到此角停住
  TOL: 0.05,             // 力矩差容差（N·m）：小于它算平衡
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    // 梁做成枢轴组的子节点：绕支点转，钩码挂在梁上随之转动
    this.pivotG = new THREE.Group(); this.pivotG.position.set(0, 1.6, 0); ctx.scene.add(this.pivotG);
    this.beam = box(8, 0.16, 0.4, MATS.woodDark()); this.pivotG.add(this.beam);
    // 梁面刻度（每 0.32 一格，读力臂用；细线槽，不从板面凸出来）
    const ticks = [];
    for (let i = -12; i <= 12; i++) {
      const big = (i % 4 === 0);
      const t = box(big ? 0.018 : 0.010, 0.006, big ? 0.34 : 0.22, MATS.woodLight());
      t.position.set(i * 0.32, 0.083, 0); ticks.push(t);
    }
    this.pivotG.add(mergeByMaterial(ticks));
    this.pivot = cyl(0.16, 0.24, 1.6, MATS.iron()); this.pivot.position.y = 0.8; ctx.scene.add(this.pivot);
    this.tripod = box(1.6, 0.1, 1.2, MATS.iron()); this.tripod.position.y = 0.05; ctx.scene.add(this.tripod);
    // 两侧钩码（槽码叠块）：作为梁的子节点，跟着梁一起转
    this.w1 = slottedMass({ n: 3, r: 0.15, h: 0.06 }); this.pivotG.add(this.w1);
    this.w2 = slottedMass({ n: 3, r: 0.15, h: 0.06 }); this.pivotG.add(this.w2);
    this.lbl1 = mkLabel('', '#ff8a5a'); ctx.scene.add(this.lbl1);          // 标签留在世界坐标（不做 CSS2D 层级跟随）
    this.lbl2 = mkLabel('', '#9ad2ff'); ctx.scene.add(this.lbl2);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.angle = 0; this.t = 0; this.duration = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const t1 = (this.p.f1 || 1) * (this.p.l1 || 1);
    const t2 = (this.p.f2 || 1) * (this.p.l2 || 1);
    this.t1 = t1; this.t2 = t2;
    this.net = t1 - t2;
    this.balanced = Math.abs(this.net) < this.TOL;
    // 时间轴：平衡时没有过程（0）；不平衡时 t = 转到极限角所需时间
    this.duration = this.balanced ? 0 : 2.2;
    this.angleTarget = this.balanced ? 0 : (this.net > 0 ? 1 : -1) * (this.MAX_TILT * DEG);
    if (this.ctx) this.ctx.emitReadout({ torque: t1.toFixed(1) + ' / ' + t2.toFixed(1) });
    this.t = 0;
    this.layout(0);
  },
  // 转角是 t 的确定性函数：先匀角加速再在极限角停住（|net| 越大落得越快）
  angleAt(tPres) {
    if (this.balanced) return 0;
    const d = this.duration || 2.2;
    const tt = clamp(tPres, 0, d) / d;                  // 0→1
    const k = clamp(Math.abs(this.net) / 3, 0.35, 1);   // 力矩差越大越快
    const p = clamp(tt * (0.55 + 0.45 * k), 0, 1);
    const e = p * p * (3 - 2 * p);                      // 平滑起停
    return this.angleTarget * e;
  },
  layout(tPres) {
    const ang = tPres == null ? this.angle : this.angleAt(tPres);
    this.angle = ang;
    this.pivotG.rotation.z = ang;
    const unit = 0.32;
    const x1 = -(this.p.l1 || 1) * unit, x2 = (this.p.l2 || 1) * unit;
    this.w1.scale.setScalar(0.9 + (this.p.f1 || 1) * 0.12);
    this.w2.scale.setScalar(0.9 + (this.p.f2 || 1) * 0.12);
    // 钩码挂在梁下沿（梁局部坐标：梁厚 0.16，挂点下移让整套槽码吊在梁下方，不被梁体遮住）
    this.w1.position.set(x1, -0.30, 0);
    this.w2.position.set(x2, -0.30, 0);
    // 标签位置由梁的局部挂点换算到世界坐标（只用于定位，跟随没问题）
    const toWorld = (lx, ly) => new THREE.Vector3(lx, ly, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), ang).add(this.pivotG.position);
    const p1 = toWorld(x1, -0.55), p2 = toWorld(x2, -0.55);
    this.lbl1.position.copy(p1); setLabel(this.lbl1, 'F1=' + (this.p.f1 || 1) + 'N · L1=' + (this.p.l1 || 1));
    this.lbl2.position.copy(p2); setLabel(this.lbl2, 'F2=' + (this.p.f2 || 1) + 'N · L2=' + (this.p.l2 || 1));
    this.lbl.position.set(0, 2.75, 0);
    const dir = this.balanced ? '平衡（保持水平）' : (this.net > 0 ? '左侧力矩大 → 向左侧下沉' : '右侧力矩大 → 向右侧下沉');
    setLabel(this.lbl, 'F1L1=' + this.t1.toFixed(1) + ' N·m   F2L2=' + this.t2.toFixed(1) + ' N·m · ' + dir);
  },
  step(dt) {
    if (dt <= 0) { this.layout(this.t || 0); return; }
    this.t = Math.min((this.t || 0) + dt, this.duration || 0);
    this.layout(this.t);
  },
  // 时间轴：转角有闭式解，seek 直接算（转到位后停在极限角，不回摆）
  seek(t) {
    this.t = Math.max(0, Number.isFinite(t) ? t : 0);
    if (this.duration > 0) this.t = Math.min(this.t, this.duration);
    this.layout(this.t);
  },
  reset() { this.t = 0; this.recompute(); },
  dispose() {},
};

export const MECHANICS = {
  'A1-incline-speed': A1,
  'A2-newton-first': A2,
  'A3-friction': A3,
  'A4-liquid-pressure': A4,
  'A5-buoyancy': A5,
  'A6-energy': A6,
  'A7-lever': A7,
};
