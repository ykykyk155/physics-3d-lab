/* 力学 A1~A7 */
import { THREE, COLORS, DEG, G, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, mkArrow, setArrow, fatLine, setFatLine, addGround, clamp, rd, rgba } from './common.js';
import { MATS, matClone, registerMaterials, cart, rollCart, woodBlock, metalBlock, beaker, springScale, setSpringScale, slottedMass } from './props.js';
import { loadAmmo, createWorld, disposeWorld, STEP } from './ammo-bridge.js';

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
    // 木板两侧的薄挡边（防止小车跑偏）：低矮贴面，不遮挡车轮、不挡轮
    const rims = [];
    [-1, 1].forEach(s => { const r = box(1, 0.024, 0.03, MATS.woodDark()); r.position.set(0, 0.012, s * 0.415); rims.push(r); });
    this.rimMesh = mergeByMaterial(rims); this.rampGroup.add(this.rimMesh);
    this.group.add(this.rampGroup);

    // 小车：车身 + 四轮 + 车轴（真实小车，随质量缩放的是车身不是方块）
    this.cartG = cart({ len: 0.34, wid: 0.24, wheelR: 0.055 });
    this.cartG.scale.setScalar(1);
    this.block = this.cartG;                   // 车随斜面一起倾斜，贴住斜面
    this.rampGroup.add(this.cartG);

    // 力矢量统一用力学识别色 #F59E0B（附录 B）
    this.aG = mkArrow(C); this.aN = mkArrow(C); this.aF = mkArrow(C);
    ctx.scene.add(this.aG, this.aN, this.aF);
    this.lG = mkLabel('G', C); this.lN = mkLabel('N', C); this.lF = mkLabel('f', C);
    ctx.scene.add(this.lG, this.lN, this.lF);

    this.lAngle = mkLabel('θ', C); this.group.add(this.lAngle);
    this.u = 0; this.v = 0;
    this._layout();
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'theta') { this.rampGroup.rotation.z = v * DEG; this.lAngle.position.set(0.55, 0.15, 0.5); this.u = 0; this.v = 0; }
    if (k === 'length') { this.L = v; this.ramp.scale.x = v; this.u = 0; this.v = 0; }
    const L = this.p.length || 1;
    this.ramp.position.x = L / 2;              // 低端落在原点，避免斜插入地
    this._layout();
    this.buildSupport();
    this._t = 0;
    this.recompute();
    this.place();
  },
  // 斜面支架：两条竖直支腿顶到木板底面（精确不穿板），下端立在承台顶面上
  buildSupport() {
    if (!this.ctx) return;
    if (this.support) { this.support.traverse(o => o.geometry && o.geometry.dispose()); this.scene.remove(this.support); this.support = null; }
    const L = this.p.length || 1, th = (this.p.theta || 0) * DEG, t = 0.06;
    const cosT = Math.cos(th), sinT = Math.sin(th), tanT = Math.tan(th);
    const hiX = L * cosT;                        // 坡顶（木板最高端）世界 x
    this.support = new THREE.Group();
    const legX = hiX - 0.10;
    // 板底面世界高度：底 ≈ tanθ·(X − t·sinθ)；取支腿 footprint 低端，保证腿顶不穿出板底
    const legTop = tanT * ((legX - 0.03) - t * sinT);
    if (legTop > 0.02) {
      [-1, 1].forEach(sd => {
        const leg = box(0.06, legTop, 0.07, MATS.woodDark());
        leg.position.set(legX, legTop / 2, sd * 0.30);
        leg.castShadow = true; leg.receiveShadow = true; this.support.add(leg);
      });
      const bar = box(0.06, 0.05, 0.66, MATS.woodDark());   // 腿间横撑（低于板面，不穿板）
      bar.position.set(legX, legTop * 0.42, 0); this.support.add(bar);
    }
    this.scene.add(this.support);
  },
  // 布局：按板长动态缩放小车 + 算可用行程 + 抬坡体使板底与承台相切 + 挡边贴合板长
  _layout() {
    const L = this.p.length || 1;
    const th = (this.p.theta || 0) * DEG;
    const baseLen = 0.34;                        // cart 车长基准（scale=1）
    const margin = 0.06;                         // 起终点整车距板端各留 6cm（≥5cm 要求）
    const cartLen = Math.min(baseLen, Math.max(L - 0.25, 0.12));
    const s = cartLen / baseLen;
    this._s = s; this._cartLen = cartLen; this._margin = margin;
    this._travel = Math.max(L - cartLen - 2 * margin, 0.02);
    if (this.cartG) this.cartG.scale.setScalar(s);
    // 坡体整体抬到「板底最低点与承台顶面 y=0 精确相切」，板不再扎进承台
    this.rampGroup.position.y = 0.06 * Math.cos(th);
    // 挡边随板长对齐到 0..L
    if (this.rimMesh) { this.rimMesh.scale.x = L; this.rimMesh.position.x = L / 2; }
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
    // 时间轴：静止（μ≥tanθ）→ duration 0（没有过程）；能动 → 物理下滑时长慢放 1.6 倍作为呈现时长
    if (staticCase) { this.duration = 0; this.kA = 0; }
    else {
      this.durPhys = Math.sqrt(2 * Math.max(this._travel != null ? this._travel : (L - 0.3), 0.02) / a);
      this.duration = this.durPhys * 1.6;
      this.kA = this.durPhys / this.duration;      // 呈现时间 → 物理时间
    }
    if (this.ctx) this.ctx.emitReadout({ acc: staticCase ? '静止' : a });
    this._setupSegments();
  },
  // 三段平均速度（对照 xiaobinlaoshi）：沿斜面位移等分——前段 [0, travel/2]、后段 [travel/2, travel]、全程。
  // 匀加速闭式解：到段终点的时刻 t=√(2s/a)；平均速度 v=段长/段用时（后段用 t−t₁，不是全程时刻）。
  _setupSegments() {
    const a = this.aVal, tr = this._travel;
    if (this.static || !(a > 0) || !(tr >= 0.02)) {
      this.seg = { enabled: false, s1: 0, t1: 0, v1: 0, s2: 0, t2: 0, v2: 0, s: 0, t: 0, v: 0 };
      return;
    }
    const s1 = tr / 2;
    const t1 = Math.sqrt(2 * s1 / a);
    const t = Math.sqrt(2 * tr / a);
    const s2 = tr - s1;
    const t2 = t - t1;
    this.seg = {
      enabled: true, s1, t1, v1: s1 / t1,
      s2, t2, v2: s2 / t2,
      s: tr, t, v: tr / t,
    };
  },
  // 三段平均速度接口（前端数据表直接消费；只读，勿改字段）：
  // enabled=false = 静止分支（μ≥tanθ，无过程，各量为 0）。
  // s1/t1/v1 前段（车到前段终点时刻 t₁）、s2/t2/v2 后段（t₂=后段用时=到达时刻−t₁）、s/t/v 全程。
  segments() {
    if (!this.seg) this._setupSegments();
    return this.seg;
  },
  // 时间轴：匀加速直线运动有闭式解，seek 直接算（解析型）
  seek(t) {
    const tv = Math.max(0, Number.isFinite(t) ? t : 0);
    this._t = this.duration > 0 ? Math.min(tv, this.duration) : tv;
    if (!this.static) {
      const L = this.p.length || 1;
      const tp = Math.min(this._t * (this.kA || 0), this.durPhys || 0);
      this.u = Math.min(0.5 * this.aVal * tp * tp, this._travel);
      this.v = this.aVal * tp;
    } else { this.u = 0; this.v = 0; }
    this.place();
  },
  place() {
    const th = this.p.theta * DEG;
    const startCenter = (this.p.length || 1) - this._margin - this._cartLen / 2;
    const bx = startCenter - this.u;
    this.block.position.set(bx, 0, 0);           // 轮底与板面精确相切（间隙 0）
    rollCart(this.cartG, this.u / (0.055 * (this._s || 1)));   // 车轮随位移滚动（按实际轮径）
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
    this.u = Math.min(0.5 * this.aVal * tPhys * tPhys, this._travel);
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
  // 引擎实测/理论比值（标定后 h=0.35 实测：毛0.584/0.583≈1.002、棉1.169/1.167≈1.002、木2.943/2.917≈1.009）。
  // 加了摩擦标定 k(μ) 后实测≈理论（Δ≤0.03m），此因子≈1，仅用于让标记条严格贴到车的真实停点。
  // CEO 拍板 A：图例/标记条显示实测值。
  MEASURED_C: { 0.6: 1.002, 0.3: 1.002, 0.12: 1.009 },
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);
    this.base = box(11.0, 0.06, 3.0, '#2a3448', { roughness: 0.95 });
    this.base.position.y = -0.03; this.base.receiveShadow = true; this.base.userData.noFit = true; ctx.scene.add(this.base);
    this.tracksG = new THREE.Group(); ctx.scene.add(this.tracksG);
    // 实验小车（车身 + 四轮 + 车轴）：刚体驱动，从坡顶释放 → 滑行+摩擦+停住。
    // 视觉整体向下偏 0.06：物理盒半高 0.06、轮底在原点，刚体静止时盒心在轨道顶面上方 0.06，
    // 向下偏 0.06 让四轮正好落在轨道顶面（物理盒与视觉对齐，不再悬空或陷进轨道）。
    this.cartG = new THREE.Group(); this.cartG.name = 'A2-cart';
    // 姿态层：车身随坡面倾转（球体刚体锁旋转、车体本身恒水平，不随坡转会看起来「车尾翘起」）。
    // 枢轴放在车心（cartG 原点 = 球心）：绕车心转 θ，车两端升降正好匹配坡面高差，
    // 轮底相对车心仅 0.06，倾转后轮底位置偏差 ~0.06·(1−cosθ)≈1mm，视觉上轮子依旧贴坡。
    this.tiltG = new THREE.Group();
    this.cartVis = cart({ len: 0.52, wid: 0.36, wheelR: 0.09 });
    this.cartVis.position.y = -0.06;
    this.tiltG.add(this.cartVis);
    this.cartG.add(this.tiltG);
    this._cartHalf = 0.26;      // 车半长（len 0.52/2）：末端钳停/循环瞬移时整车不悬空
    this.block = this.tiltG; ctx.scene.add(this.cartG);
    this.makeLegend();
    this.duration = 3.4;        // 在 build 期就有值：外壳切场景时会立刻读 duration
    this.t = 0;
    this._phys = null; this._physReady = false; this._physPromise = null;
    this._cartB = null;
    this._subSteps = 4;         // A2 用 4 子步：接触/摩擦更准、能量守恒更好（默认 1，不动 A7）
    this._bootPhys();
  },
  _bootPhys() {
    if (this._physPromise) return this._physPromise;
    this._physPromise = (async () => {
      try {
        await loadAmmo();
        this._physReady = true;
        this._rebuildPhys();
        this._render(this.t || 0);
      } catch (e) { console.error('[A2 ammo]', e); this._physReady = false; }
    })();
    return this._physPromise;
  },
  _cartZ() {
    const idx = this.list ? Math.max(0, this.list.indexOf(this.sel)) : 1;
    const n = this.SURFACES.length, ZSP = 0.6;
    return -((n - 1) / 2) * ZSP + idx * ZSP;
  },
  // 释放点/滑行位移零点 = 坡脚圆弧落点（=摩擦段起点 XF0）。
  // 理论 s=v0²/(2μg) 从坡脚起算；坡上+圆弧不计滑行距离。
  startX() { return this._sx != null ? this._sx : this.XF0; },
  // 斜坡+圆弧过渡几何（物理与视觉共用，世界坐标 x、y）。
  // 直线斜坡从坡顶 T 下来，到 A 点与半径 R 的圆弧相切；圆弧在 B=(XF0,0) 与水平段相切（切线连续）。
  // R 取 0.3（CEO 定的 0.15~0.3 上界，过渡更平缓）；NA 为圆弧分段数。
  _geometry() {
    const H = this.H_ramp, RL = this.RL, XF0 = this.XF0, R = 0.3;
    const theta = Math.atan(H / RL), sinT = Math.sin(theta), cosT = Math.cos(theta);
    const Ax = XF0 - R * sinT, Ay = R * (1 - cosT);       // 弧顶（与直线相切）
    const rise = H - Ay, Lstr = rise / sinT;              // 直线斜坡长度
    const Tx = Ax - Lstr * cosT, Ty = H;                  // 坡顶
    return { R, theta, sinT, cosT, Ax, Ay, Tx, Ty, Lstr, NA: 8, XF0 };
  },
  // ===== 摩擦输入标定 k(μ)（方案 B，CEO 定）=====
  // 为什么需要：Bullet 的接触是离散穿透求解，车在平面上滑行时**有效摩擦比输入值偏高**，且越高 μ 越明显
  // （全量程实测：输入 0.02→有效 1.03×、0.30→1.09×、0.60→1.19×、0.70→1.23×），导致停止距离系统性偏短
  // （√(2gh) 理论对实测的偏差从低 μ 的 −7% 到高 μ 的 −22%）。这是引擎数值偏差，不是物理。
  // 做法：给引擎的摩擦「输入量程」乘一条标定曲线 k(μ)，让**有效摩擦回到标称 μ**，车仍全程由引擎推走——
  // 相当于给仪器校表，不改中途速度、不改答案。
  // 曲线由同一份引擎(ammo/子步=4/球体)一次全量程扫描拟合：k(μ)=0.945·μ − 0.19·μ²，单调、过原点。
  //   · 过原点：k(0)=0 → μ=0 理想光滑严格无残余摩擦。
  //   · 单调：k'(μ)=0.945−0.38μ >0（μ<2.48），量程 0~0.7 内单调递增。
  //   · 三档材料(0.12/0.30/0.60)只是这条曲线上的采样点，不单独手调。
  // ⚠ 若换 ammo 版本或改子步数，有效摩擦会变、此标定失效——常驻探针「标定后全量程≤5%」会立刻报红。
  _calibFriction(mu) {
    return Math.max(0, 0.945 * mu - 0.19 * mu * mu);
  },
  _rebuildPhys() {
    const w = createWorld({ gravity: [0, -9.8, 0] });
    this._phys = w;
    if (this._subSteps) w.subSteps = this._subSteps;
    this._loopT = 0;            // 理想光滑循环时钟：每回到坡顶清零，物理只步进到本次单程内
    const z = this._cartZ();
    const mu = this._testMu != null ? this._testMu : (this.sel ? this.sel.mu : 0.3);
    const g = this._geo = this._geometry();
    const { R, theta, sinT, cosT, Tx, Ty, NA, XF0 } = g;

    // ===== 斜坡 + 圆弧过渡：一条 2D 轮廓（顶面 = 直线斜坡 → 圆弧 → 水平切点）沿 z 挤出成三角网格 =====
    // 为什么用圆弧：车是滑动体（锁旋转），下到坡脚时速度方向要从沿斜面（倾斜 θ）转到水平；
    // 折角会让它一次性受法向冲击掉速（离散步长下更甚）。补一段切线连续的圆弧，法向力始终垂直于速度、
    // 不做功，车平滑转入水平段 —— 这才是真实器材「斜坡底部有圆弧过渡」的样子。
    // 摩擦 0：斜坡/圆弧段无摩擦，材料摩擦只作用在水平段（标准实验形态）。
    const prof = [[Tx, Ty]];
    for (let i = 0; i <= NA; i++) { const phi = theta * (1 - i / NA); prof.push([XF0 - R * Math.sin(phi), R * (1 - Math.cos(phi))]); }
    const W = 0.22, verts = [], idx = [];
    for (const [x, y] of prof) { verts.push(x, y, z - W, x, y, z + W); }
    for (let i = 0; i < prof.length - 1; i++) { const Li = 2 * i, Ri = 2 * i + 1, Li1 = 2 * (i + 1), Ri1 = 2 * (i + 1) + 1; idx.push(Li, Ri, Ri1, Li, Ri1, Li1); }
    w.addTriMesh(null, { vertices: verts, indices: idx, friction: 0 });

    // ===== 摩擦段：一整块连续板，顶面 y=0，从 XF0 向左垫一点（藏在弧下）一直向右 200m（无接缝）=====
    // 轨道侧 friction=1.0，与车 μ 相乘（Bullet 默认 combine=multiply）→ 有效摩擦 = 车 μ。
    const EXT = 200;
    this._sx = XF0;                                     // 滑行位移零点 = 坡脚（圆弧落点）
    {
      const xL = XF0 - 0.2, xR = XF0 + EXT;
      w.addBox(null, { mass: 0, halfExtents: [(xR - xL) / 2, 0.04, W], pos: [(xL + xR) / 2, -0.04, z], friction: 1.0 });
    }

    // ===== 小车：从坡顶 T 静止释放（无初速、真下滑），光滑球体（点接触、横向天然居中）与坡面接触 =====
    // 球心沿法向偏 r 贴住坡面（零初始穿透），lockRot 锁旋转纯滑行。
    // 摩擦输入走标定 k(μ)（见 _calibFriction）：车始终由引擎推着走，只把「摩擦输入量程」校准到使
    // 引擎的有效摩擦等于标称 μ（Bullet 离散穿透导致有效摩擦比输入偏高，越高 μ 越明显）。
    const fr = mu > 1e-6 ? (this._rawFric ? mu : this._calibFriction(mu)) : 0;
    const mass = clamp(this.p.mass || 0.4, 0.1, 1.0);
    const r = 0.06;
    const topX = Tx + sinT * r, topY = Ty + cosT * r;
    this._topX = topX; this._topY = topY;
    this._cartB = w.addBox(this.cartG, { shape: 'sphere', mass: mass, halfExtents: [r, r, r], pos: [topX, topY, z], friction: fr, dampingLin: 0, dampingAng: 1, lockRot: true });

    // ===== 极端材料终点行为（CEO 口径：不画出本页、无延伸渐隐）=====
    // 判断用「滑行位移 s 是否被钳到轨道长 BL」：只有理论停距超过轨道（本页只有冰面 μ0.02，
    // 停距 17.5m > BL）才这样；普通三档 s<BL − ε 永远到不了末端，此分支不触发。
    // 冰面：到末端刹停（位置钳在 xEnd、速度归零）——duration 有限（recompute 已按到末端时刻算）；
    // 理想光滑 μ=0：到末端立刻瞬移回坡顶重新滑，无限循环——duration=Infinity（时间条禁拖）。
    // afterStep 每 1/60 步调用（bridge stepN/stepTo 内），此刻 mesh 未同步 → 先 syncBody 读真实位置。
    const xEnd = this.XF0 + this.BL;
    this._odo = 0;                                        // 轮子累计里程（循环瞬移回坡顶后轮子不倒转）
    w.afterStep = () => {
      if (!this._cartB) return;
      w.syncBody(this._cartB);
      const vx = w.linearSpeedX(this._cartB);
      this._odo += Math.abs(vx) * (1 / 60);
      const x = this.cartG.position.x;
      if (mu <= 1e-6) {
        // 理想光滑：到末端瞬移回坡顶（零速重新滑）；过渡先做瞬移，CEO 看效果再定是否加动画
        if (x >= xEnd) w.setState(this._cartB, [this._topX, this._topY, z], [0, 0, 0]);
      } else if (this.s >= this.BL - 1e-9) {
        // 冰面：到末端刹停（位置钳在末端、速度归零，整段轨道内）
        if (x >= xEnd) w.setState(this._cartB, [xEnd, 0.06, z], [0, 0, 0]);
      }
    };
  },
  // 诊断：测「车进入水平摩擦段时（坡脚 x=startX=XF0 附近）的水平峰值速度」→ 供当面校核 v_entry/√(2gh)。
  measureEntrySpeed() {
    if (!this._physReady || !this._phys || !this._cartB) return null;
    this._rebuildPhys();
    const w = this._phys, sx = this.startX();
    let peak = 0, xe = null;
    for (let i = 0; i < 60 * 6; i++) {
      w.stepN(1);
      const x = this.cartG.position.x;
      const vx = w.linearSpeedX(this._cartB);
      if (x < sx + 0.15 && vx > peak) { peak = vx; xe = x; }
      if (x > sx + 0.3) break;
    }
    return peak > 0 ? { vEntry: peak, x: xe, t: null } : null;
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
    el.style.cssText = `position:absolute;left:12px;top:46px;z-index:7;font:600 11px/1.5 ui-monospace,Consolas,monospace;color:${COLORS.ink};background:${rgba(COLORS.bg, .82)};border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:7px 9px;pointer-events:none;`;
    host.appendChild(el);
    this.legendEl = el;
  },
  updateLegend() {
    if (!this.legendEl || !this.list) return;
    const head = '<div style="color:#ffd479;margin-bottom:5px">' + this.sel.label + ' · 滑行 s=' + (isFinite(this.s) ? this.s.toFixed(2) + ' m' : '∞（循环往复）') + ' · h=' + (this.p.height || 0.15).toFixed(2) + ' m</div>';
    const rows = this.list.map(o => {
      const on = (o === this.sel);
      const dot = '<span style="display:inline-block;width:11px;height:11px;border-radius:2px;background:' + o.color + ';margin-right:7px;vertical-align:middle;border:1px solid rgba(255,255,255,.3)"></span>';
      const d = isFinite(o.s) ? o.s.toFixed(2) + ' m' : '循环往复';
      const st = on ? 'color:#fff;font-weight:700;' : 'color:#aab6c8;';
      return '<div style="' + st + 'margin:1px 0">' + dot + o.label + ' · μ=' + o.mu.toFixed(2) + ' · ' + d + '</div>';
    }).join('');
    this.legendEl.innerHTML = head + rows;
  },
  recompute() {
    const h = this.p.height || 0.35;
    this.v0 = Math.sqrt(2 * G * h);
    // 质量不改变滑行距离（v0 由高度决定）
    const ms = clamp(this.p.mass || 0.4, 0.1, 1.0);
    this.syncWeights(ms);
    // 几何常量：五条等长水平轨道（顶面 y=0，从 XF0 向右） + 一条释放坡（坡脚圆弧在 XF0，切线转到水平）
    this.BL = 7.0; this.XF0 = -1.2; this.RL = 2.0;
    this.H_ramp = h;
    this.theta = Math.atan(this.H_ramp / this.RL);
    this._geo = this._geometry();
    const list = this.SURFACES.map(o => {
      // CEO 拍板 A：图例/标记条显示实测值。修正因子 MEASURED_C 乘理论值（无实测档 = 理论 1.0）。
      const c = this.MEASURED_C[o.mu] || 1.0;
      const sTheory = o.mu > 0 ? (this.v0 * this.v0) / (2 * o.mu * G) : Infinity;
      return { mu: o.mu, label: o.label, color: o.color, s: isFinite(sTheory) ? sTheory * c : Infinity };
    });
    // 标记条真实尺度：标尺 1 单位 = 1 米。只 clamp 到轨道物理长度。
    list.forEach(o => { if (isFinite(o.s)) o.s = Math.min(o.s, this.BL); });
    this.list = list;
    const selMu = Number(this.p.surface);
    this.sel = list.find(o => Math.abs(o.mu - selMu) < 1e-6) || list[1];
    this.s = this.sel.s;
    // 时长口径：斜坡(直线段 + 圆弧段)下滑时间 + 摩擦段滑到停时间 + 余量。
    // 理想光滑 μ=0 是无限过程 → duration = Infinity（禁拖、不自动暂停）。
    if (isFinite(this.s)) {
      const g2 = this._geo;
      const pathL = g2.Lstr + g2.R * g2.theta;                         // 直线斜坡 + 圆弧路程
      const tRamp = Math.sqrt(2 * pathL / (G * Math.sin(this.theta))); // 无摩擦下滑时间
      const mu = this.sel.mu;
      // 到达停止点的时间：轨道内停 → v0/(μg)（匀减速到停，disc=0）；
      // 冰面 μ=0.02 理论停距 17.5m 超出轨道 → s 已 clamp 到 BL=7.0，车在轨道末端被刹车，
      // 到末端的时刻解 v0·t − ½μg·t² = s 的二次式小根：t=(v0−√(v0²−2μg·s))/(μg)。
      // μ=0 时 s=∞，走 else 分支（duration=Infinity），不会到这里。
      const disc = Math.max(0, this.v0 * this.v0 - 2 * mu * G * this.s);
      const tFlat = (this.v0 - Math.sqrt(disc)) / (mu * G);
      this.duration = clamp(Math.ceil((tRamp + tFlat + 0.4) * 10) / 10, 1.2, 12);
    } else this.duration = Infinity;
    if (this.ctx) this.ctx.emitReadout({ slide: isFinite(this.s) ? this.s : '理想光滑：循环往复' });
    this.buildTracks();
    this.t = 0;
    this.updateLegend();
    if (this._physReady) this._rebuildPhys();
    this._render(this.t);
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
    // 清场
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
    const marks = [], ramps = [], slideParts = [];
    const th = this.theta, sinT = Math.sin(th), cosT = Math.cos(th);
    this.list.forEach((o, idx) => {
      const z = -((n - 1) / 2) * ZSP + idx * ZSP;
      const isSel = (o === this.sel);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(BL, 0.08, 0.44), this.mkBoardMat(isSel, o.color));
      bar.position.set(XF0 + BL / 2, 0.04, z); bar.userData.noFit = true; bar.receiveShadow = true; bar.castShadow = false;
      this.tracksG.add(bar);
      // CEO 口径：冰面/理想光滑都到轨道末端就结束（冰面刹停、理想光滑循环），不再有延伸渐隐段。
      // 标记条：真实米数标尺（1 单位 = 1m，不压缩整幅）。冰面/理想光滑无终点标记。
      if (isFinite(o.s) && o.s < BL - 0.05) {
        const sW = clamp(o.s, 0.15, BL - 0.05);
        const mk = box(sW, 0.015, 0.075, C, { emissive: C, emissiveIntensity: 0.7, transparent: true, opacity: 0.85, depthWrite: false });
        mk.position.set(XF0 + sW / 2, 0.085, z); mk.castShadow = false; marks.push(mk);
        const tk = box(0.04, 0.012, 0.34, '#FDE68A', { transparent: true, opacity: 0.85, depthWrite: false });
        tk.position.set(XF0 + sW, 0.085, z); tk.castShadow = false; marks.push(tk);
      }
      if (isSel) {
        // 视觉斜坡+圆弧：与物理完全同一轮廓（直线斜坡 → 半径 R 圆弧 → 水平切点 B=(XF0,0)）挤出的实心木楔。
        // 这样学生看到的就是真实器材：斜坡底部是圆弧过渡，不是折角。
        const g = this._geo || this._geometry();
        const sp = new THREE.Shape();
        sp.moveTo(g.Tx, g.Ty);
        for (let i = 0; i <= g.NA; i++) { const phi = g.theta * (1 - i / g.NA); sp.lineTo(g.XF0 - g.R * Math.sin(phi), g.R * (1 - Math.cos(phi))); }
        const bottomY = -0.06;
        sp.lineTo(g.XF0, bottomY); sp.lineTo(g.Tx, bottomY); sp.closePath();
        const eg = new THREE.ExtrudeGeometry(sp, { depth: 0.44, bevelEnabled: false, curveSegments: 4 });
        eg.translate(0, 0, -0.22);
        const rampMesh = new THREE.Mesh(eg, mat(COLORS.mechanics, { roughness: 0.45, metalness: 0 }));
        rampMesh.position.z = z; rampMesh.castShadow = false; rampMesh.receiveShadow = false; rampMesh.userData.noFit = true;
        this.tracksG.add(rampMesh);
        slideParts.push(...this._slideParts(g, z, this.H_ramp));
        // 理想光滑 μ=0：配「无阻力 → 循环往复」说明（到末端自动回坡顶重滑，永不停止）
        if (o.mu <= 1e-6) {
          const lb = mkLabel('无阻力 → 循环往复', '#9ad2ff');
          lb.position.set(XF0 + BL + 1.5, 0.95, z); this.tracksG.add(lb);
        }
      }
    });
    if (marks.length) { const mg = mergeByMaterial(marks); mg.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; }); this.tracksG.add(mg); }
    if (ramps.length) this.tracksG.add(mergeByMaterial(ramps));
    if (slideParts.length) { const sg = mergeByMaterial(slideParts); sg.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; c.userData.noFit = true; }); this.tracksG.add(sg); }
  },
  // ===== 02 滑梯外观（纯视觉层，规格见 docs/design/A2-滑梯坡道设计规格.md）=====
  // 所有尺寸由 _geometry() 的 g 与 H(=H_ramp) 推导，禁止硬编码 0.35；全部 noFit、无阴影、无碰撞体。
  // 只挂在 buildTracks 的 isSel 分支，随现有 traverse dispose 在切材料/切高度时整体清理，无残留。
  _slideParts(g, z, H) {
    const parts = [];
    const P = (m) => { m.userData.noFit = true; m.castShadow = false; m.receiveShadow = false; parts.push(m); return m; };
    const cPanel = mat(COLORS.primary, { roughness: 0.5, metalness: 0 });
    const cRail = mat(COLORS.slideRail, { roughness: 0.35, metalness: 0.05 });
    const cDeck = mat(COLORS.slideDeck, { roughness: 0.8, metalness: 0 });
    const cStep = mat(COLORS.slideStep, { roughness: 0.85, metalness: 0 });
    const cAmber = mat(COLORS.mechanics, { roughness: 0.45, metalness: 0 });
    const HT = 0.13;                 // 侧板高（低于车侧栏顶 ≈0.1975，车身始终可见）
    // 坡面顶边采样点（T → 圆弧 → B），直线段取 6 段、圆弧取 NA 段，供包边管复用
    const edge = (offY) => {
      const pts = [], N = 6;
      for (let i = 0; i <= N; i++) { const t = i / N; pts.push([g.Tx + (g.Ax - g.Tx) * t, g.Ty + (g.Ay - g.Ty) * t + offY]); }
      for (let i = 1; i <= g.NA; i++) { const phi = g.theta * (1 - i / g.NA); pts.push([g.XF0 - g.R * Math.sin(phi), g.R * (1 - Math.cos(phi)) + offY]); }
      return pts;
    };
    // ①② 侧板（低护带）×2 + 顶部包边圆管 ×2 + 圆头
    [1, -1].forEach(sgn => {
      const shp = new THREE.Shape();
      shp.moveTo(g.Tx, g.Ty);
      for (let i = 0; i <= g.NA; i++) { const phi = g.theta * (1 - i / g.NA); shp.lineTo(g.XF0 - g.R * Math.sin(phi), g.R * (1 - Math.cos(phi))); }
      shp.lineTo(g.XF0, HT);
      for (let i = g.NA - 1; i >= 0; i--) { const phi = g.theta * (1 - i / g.NA); shp.lineTo(g.XF0 - g.R * Math.sin(phi), g.R * (1 - Math.cos(phi)) + HT); }
      shp.lineTo(g.Tx, g.Ty + HT);
      shp.closePath();
      const eg = new THREE.ExtrudeGeometry(shp, { depth: 0.05, bevelEnabled: false, curveSegments: 4 });
      eg.translate(0, 0, -0.025);
      const panel = new THREE.Mesh(eg, cPanel);
      panel.position.z = z + sgn * 0.25;                 // 内面 ±0.225、外面 ±0.275（轮外缘 0.219 → 6mm 间隙）
      P(panel);
      const etp = edge(HT).map(([x, y]) => new THREE.Vector3(x, y, z + sgn * 0.25));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(etp), 48, 0.024, 8, false), cRail);
      P(tube);                                            // 内缘 0.25−0.024=0.226 > 0.219
      const cap = sphere(0.024, cRail); cap.position.set(g.XF0, HT, z + sgn * 0.25); P(cap);
    });
    // ④ 起滑平台（顶面 y=H，x∈[Tx-0.45, Tx]，z±0.22）
    const deck = box(0.45, 0.05, 0.44, cDeck); deck.position.set(g.Tx - 0.225, H - 0.025, z); P(deck);
    const deckTrim = box(0.02, 0.012, 0.44, cAmber); deckTrim.position.set(g.Tx - 0.01, H + 0.006, z); P(deckTrim);
    // ⑤ 平台护栏（U 形，前方无横杆=小车出口）；railH 随坡高缩放
    const railH = clamp(0.6 * H, 0.12, 0.26);
    [g.Tx - 0.45, g.Tx - 0.02].forEach(px => [1, -1].forEach(sgn => { const c = cyl(0.02, 0.02, railH, cRail); c.position.set(px, H + railH / 2, z + sgn * 0.25); P(c); }));
    [1, -1].forEach(sgn => { const bar = cyl(0.018, 0.018, 0.43, cRail); bar.rotation.z = Math.PI / 2; bar.position.set(g.Tx - 0.235, H + railH, z + sgn * 0.25); P(bar); });
    const backBar = cyl(0.018, 0.018, 0.5, cRail); backBar.rotation.x = Math.PI / 2; backBar.position.set(g.Tx - 0.45, H + railH, z); P(backBar);
    // ⑥ 背后台阶 ×3（实体盒从 y=-0.06 叠到各自顶面 i·H/3）
    for (let i = 1; i <= 3; i++) {
      const x0 = g.Tx - 0.45 - (4 - i) * 0.16, x1 = g.Tx - 0.45 - (3 - i) * 0.16;
      const top = i * H / 3, hgt = top + 0.06;
      const st = box(0.16, hgt, 0.44, cStep); st.position.set((x0 + x1) / 2, (-0.06 + top) / 2, z); P(st);
      const tr = box(0.015, 0.012, 0.44, cAmber); tr.position.set(x1 - 0.0075, top + 0.006, z); P(tr);
    }
    return parts;
  },
  _render(t) {
    const tt = t == null ? 0 : t;
    if (this._physReady) {
      // 每次新建干净世界再重放：reset() 无法完全清掉 Body 在碰撞/接触中的求解器残留
      // （A7 是这样解决 NaN 与漂移的），A2 带初速更必须如此，否则连续 seek 末态会漂（实测差 0.018m）。
      // A2 只 3.4s、build 阶段几十个刚体+约束，重建毫秒级，可接受。
      this._rebuildPhys();
      this._phys.stepTo(tt);
      this._rollWheels();
      this._applyTilt();
    } else {
      this._drawFallback(tt);
    }
  },
  // 车身随坡面倾转：直线坡段绕车心转 −θ（车头朝 +x、坡下行，车头低车尾高=顺时针=负角），
  // 圆弧段从 −θ 平滑转到 0（切线连续），水平段为 0。枢轴在车心：车两端升降正好匹配坡面高差。
  _applyTilt() {
    if (!this.tiltG || !this._geo) return;
    const { R, theta, sinT, XF0 } = this._geo;
    const x = this.cartG.position.x;
    let ang = 0;
    if (x < XF0) {
      const Ax = XF0 - R * sinT;                 // 直线段与圆弧切点
      if (x > Ax) {
        // 圆弧段：车在圆弧上的坡降角 = π/2 − acos((XF0−x)/R)，值域 [θ, 0]
        const phi = Math.acos(Math.min(1, (XF0 - x) / R));
        const down = Math.PI / 2 - phi;          // 车头相对水平向下倾角（A 处=θ，B 处=0）
        ang = -Math.min(down, theta);
      } else ang = -theta;                       // 直线坡段：倾角 = −θ
    }
    this.tiltG.rotation.z = ang;
  },
  _rollWheels() {
    if (!this.cartVis) return;
    // 理想光滑循环：轮子随累计里程 _odo 单调转（回坡顶后不倒转）；其余走位置差。
    const o = this._odo != null ? this._odo : Math.max(0, this.cartG.position.x - this.XF0);
    rollCart(this.cartVis, o / 0.09);
  },
  // 加载期间的解析式 fallback：斜坡加速（无摩擦）→ 水平 μ 匀减速，与物理模型同构。
  // 小车从坡顶 (XF0−RL, H) 静止释放，到坡脚速度 v0=√(2gH)，然后按 μ 减速。
  _drawFallback(t) {
    if (!this.list) return;
    const v0 = this.v0, mu = this.sel.mu;
    const z = this._cartZ();
    const d = this.duration;
    const tt = Number.isFinite(d) ? clamp(t, 0, d) : t;
    // 坡上段：匀加速，路程 s_ramp = RL（坡脚=位移零点）。tt_slope = √(2·RL/ a)，a = g·sinθ
    const a_ramp = G * Math.sin(this.theta);
    const t_foot = Math.sqrt(2 * this.RL / a_ramp);
    if (tt < t_foot) {
      // 还在坡上：沿坡面位移 u = ½a t²，位置 x = XF0−RL+u·cosθ, y = H−u·sinθ
      const u = 0.5 * a_ramp * tt * tt;
      this.cartG.position.set(this.XF0 - this.RL + u * Math.cos(this.theta), this.H_ramp - u * Math.sin(this.theta), z);
      this._applyFallbackTilt(this.XF0 - this.RL + u * Math.cos(this.theta));   // 车身随坡面倾转
      rollCart(this.cartVis, (u * Math.cos(this.theta)) / 0.09);
      return;
    }
    // 水平段：从坡脚起 v0 匀减速
    const xt = tt - t_foot;
    if (mu <= 1e-6) {
      // 理想光滑：到末端回坡顶循环。单程水平段时长 t_flat=BL/v0，落点 xm=v0·(xt % t_flat)，
      // 里程 odo=已完圈数×BL+当前位置（轮子单调转不倒转）——与物理 afterStep 循环同构。
      const t_flat = this.BL / v0;
      const lap = Math.floor(xt / t_flat);
      const xm = v0 * (xt - lap * t_flat);
      rollCart(this.cartVis, (lap * this.BL + xm) / 0.09);
      this.cartG.position.set(this.XF0 + xm, 0, z);
      this._applyFallbackTilt(this.XF0 + xm);   // 水平段倾 0
      return;
    }
    let xm = v0 * xt - 0.5 * mu * G * xt * xt;
    if (xm < 0) xm = 0;
    if (isFinite(this.s) && xm > this.s) xm = this.s;
    this.cartG.position.set(this.XF0 + xm, 0, z);
    this._applyFallbackTilt(this.XF0 + xm);
    rollCart(this.cartVis, xm / 0.09);
  },
  // fallback 期车身倾转（与 _applyTilt 同源）：直线坡 −θ、圆弧从 −θ 平滑转 0、水平 0。
  _applyFallbackTilt(x) {
    if (!this.tiltG || !this._geo) return;
    const { R, theta, sinT, XF0 } = this._geo;
    let ang = 0;
    if (x < XF0) {
      const Ax = XF0 - R * sinT;
      if (x > Ax) {
        const phi = Math.acos(Math.min(1, (XF0 - x) / R));
        const down = Math.PI / 2 - phi;
        ang = -Math.min(down, theta);
      } else ang = -theta;
    }
    this.tiltG.rotation.z = ang;
  },
  step(dt) {
    if (dt <= 0) return;
    const d = this.duration;
    this.t = Number.isFinite(d) ? clamp(this.t + dt, 0, d) : Math.max(0, this.t + dt);
    // 确定性：播放与 seek 走同一 _render（每次重建世界 + 步进到 t），保证「播放到 t」与「拖到 t」逐位一致
    this._render(this.t);
  },
  reset() { this.t = 0; this.recompute(); },
  // 时间轴：seek = 重置世界 → 固定步长跑到 t（确定性）
  seek(t) {
    if (!this.list) return;
    const tt = Number.isFinite(t) ? Math.max(0, t) : 0;
    const d = this.duration;
    this.t = Number.isFinite(d) ? clamp(tt, 0, d) : tt;
    this._render(this.t);
  },
  dispose() {
    try { disposeWorld(); } catch (e) {}
    this._phys = null; this._physReady = false;
    const el = document.getElementById('a2-legend'); if (el) el.remove(); this.legendEl = null;
  },
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
    // 砝码堆（槽码）：独立 group，不挂 blockG —— area=small 时 block.scale.x/z 会缩到 0.55/0.7，挂进去会被压扁
    this.weightsG = new THREE.Group();
    this.weightsG.userData.noFit = true;
    ctx.scene.add(this.weightsG);
    this._weightsN = 0; this._weightsH = 0;
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
    this._rebuildWeights();
    this.weightsG.position.set(this.x, 0.20, 0);
  },
  _rebuildWeights() {
    const cnt = clamp(Math.round((this.p.normal || 2) / 0.5), 1, 10);
    if (cnt === this._weightsN) return;
    this._weightsN = cnt;
    const g = this.weightsG;
    if (!g) return;
    for (let i = g.children.length - 1; i >= 0; i--) {
      const c = g.children[i]; g.remove(c);
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    const R = 0.115, H = 0.045;
    // 每片槽码：浅钢色圆盘 + 略深上缘凸环，片间留缝，能一眼数出片数（不是一根圆柱）
    // 材质只建一次并复用，避免每片/每次拖动重新建材质
    if (!this._discMat) this._discMat = mat('#cfd6df', { roughness: 0.46, metalness: 0.32 });
    if (!this._rimMat) this._rimMat = mat('#93a0b2', { roughness: 0.50, metalness: 0.42 });
    const discMat = this._discMat, rimMat = this._rimMat;
    const discs = [], rims = [];
    for (let i = 0; i < cnt; i++) {
      const y0 = i * H;
      const d = cyl(R, R, H * 0.82, discMat); d.position.y = y0 + H * 0.41; discs.push(d);
      const rim = cyl(R * 1.03, R * 1.03, H * 0.12, rimMat); rim.position.y = y0 + H * 0.9; rims.push(rim);
    }
    g.add(mergeByMaterial(discs));
    g.add(mergeByMaterial(rims));
    // 中心吊杆 + 顶部提环：套在吊杆上的槽码组
    const postH = cnt * H + 0.08;
    const post = cyl(0.014, 0.014, postH, MATS.steelBright()); post.position.y = postH / 2; g.add(post);
    const hook = torus(R * 0.42, 0.016, MATS.steelBright()); hook.position.y = postH + R * 0.2; g.add(hook);
    g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    this._weightsH = cnt * H + 0.12;
  },
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'area') this.block.scale.set(v === 'big' ? 1 : 0.55, 1, v === 'big' ? 1 : 0.7);
    this.recompute();
  },
  recompute() {
    const f = (this.p.mu || 0.4) * (this.p.normal || 2);
    this.f = f;
    // 固定 12s 观察窗：x = pull·t，同一时刻不同速度档位置差一眼可见
    // （pull=0.05→0.6m、0.1→1.2m、0.3→3.6m；x 上限 4 不变）
    this.duration = 12;
    this._rebuildWeights();
    if (this.ctx) this.ctx.emitReadout({ read: f });
  },
  drawAt(tPres) {
    const v = Math.max(this.p.pull || 0.1, 0.02);
    const d = this.duration || 8;
    this._t = Math.min(Math.max(Number.isFinite(tPres) ? tPres : 0, 0), d);
    this.x = Math.min(v * this._t, 4);
    this.block.position.set(this.x, 0.0, 0);
    if (this.weightsG) this.weightsG.position.set(this.x, 0.20, 0);
    // 测力计固定在铁架台横臂上，指针随拉力下移（不再悬空、也不跟着木块跑）
    setSpringScale(this.scaleG, clamp(this.f / 4, 0.04, 1));
    // 提环挂到横臂上
    this.hang.geometry.setPositions([0.16, 2.02, 0, -0.05, 2.0, 0]);
    this.hang.computeLineDistances();
    // 底部挂钩勾住木块左侧挂钩：细绳从木块侧钩斜拉到测力计挂钩，让开块顶砝码堆
    this.hook.geometry.setPositions([0.16, 0.98, 0, this.x - 0.44 * (this.block.scale ? this.block.scale.x : 1), 0.11, 0]);
    this.hook.computeLineDistances();
    setArrow(this.pullArrow, new THREE.Vector3(1, 0, 0), clamp(this.f * 0.35, 0.2, 1.2));
    this.pullArrow.position.set(this.x + 0.46, 0.22, 0);
    setArrow(this.fArrow, new THREE.Vector3(-1, 0, 0), clamp(this.f * 0.35, 0.2, 1.2));
    this.fArrow.position.set(this.x - 0.46, 0.08, 0);
    this.lbl.position.set(this.x, clamp(0.20 + (this._weightsH || 0) + 0.13, 0.48, 0.86), 0);
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
    this.barEk = box(0.3, 1, 0.3, COLORS.energyEk); this.barEk.position.set(1.4, 0.5, 0); ctx.scene.add(this.barEk);
    this.barEp = box(0.3, 1, 0.3, COLORS.energyEp); this.barEp.position.set(2.0, 0.5, 0); ctx.scene.add(this.barEp);
    this.lEk = mkLabel('Ek', COLORS.energyEk); this.lEp = mkLabel('Ep', COLORS.energyEp); ctx.scene.add(this.lEk, this.lEp);
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

/* ===================== A7 杠杆平衡（ammo.js 刚体试点） =====================
 * 教学核心：梁的倾角由两侧钩码重力矩真实驱动，转到 ±25° 被铰链限位挡住停住；
 * 钩码是独立刚体、用点对点约束挂在梁的挂点上，梁转动时它们保持竖直下垂、有真实摆动。
 * 场景不直接碰 window.Ammo，只走 exp/ammo-bridge.js。
 *
 * 确定性：seek(t) = 复位世界 → 固定步长 1/60 跑到 t；step(dt) 与 seek 走同一条「无状态重放」路径，
 * 所以「顺序播放到 t」与「直接拖到 t」逐位一致。平衡（|net|<TOL）时 duration=0、时间条置灰。 */
const A7 = {
  p: {},
  MAX_TILT: 25,          // 极限倾角（度）：铰链限位挡住
  TOL: 0.05,             // 力矩差容差（N·m）：小于它算平衡
  BEAM_MASS: 1.0,        // 梁质量（kg）：调小使转动更快、2.2s 内能看出明显倾角
  HOOK_Y: 0.1125,        // 钩码 root 原点到钩环的局部高度（= 槽码几何半高，视觉与刚体锚点一致）
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a2c14);

    // 梁组：梁 + 刻度都挂在 beamG 下，刚体控制 beamG 的世界变换（绕支点 (0,1.6,0) 转）
    this.beamG = new THREE.Group(); this.beamG.position.set(0, 1.6, 0); this.beamG.name = 'A7-beam'; ctx.scene.add(this.beamG);
    this.beam = box(8, 0.16, 0.4, MATS.woodDark()); this.beamG.add(this.beam);
    // 梁面刻度（每 0.32 一格，读力臂用；细线槽，不从板面凸出来）
    const ticks = [];
    for (let i = -12; i <= 12; i++) {
      const big = (i % 4 === 0);
      const t = box(big ? 0.018 : 0.010, 0.006, big ? 0.34 : 0.22, MATS.woodLight());
      t.position.set(i * 0.32, 0.083, 0); ticks.push(t);
    }
    this.beamG.add(mergeByMaterial(ticks));

    // 支点柱 + 三脚架（静态视觉，不参与刚体）
    this.pivot = cyl(0.16, 0.24, 1.6, MATS.iron()); this.pivot.position.y = 0.8; ctx.scene.add(this.pivot);
    this.tripod = box(1.6, 0.1, 1.2, MATS.iron()); this.tripod.position.y = 0.05; ctx.scene.add(this.tripod);

    // 两侧钩码：独立 Group 作为物理根（body 控制），槽码 mesh 下移让几何中心对齐 root 原点
    this.w1root = new THREE.Group(); this.w1root.name = 'A7-w1'; ctx.scene.add(this.w1root);
    this.w2root = new THREE.Group(); this.w2root.name = 'A7-w2'; ctx.scene.add(this.w2root);
    this.w1 = slottedMass({ n: 3, r: 0.15, h: 0.06 }); this.w1.position.y = -this.HOOK_Y; this.w1root.add(this.w1);
    this.w2 = slottedMass({ n: 3, r: 0.15, h: 0.06 }); this.w2.position.y = -this.HOOK_Y; this.w2root.add(this.w2);

    this.lbl1 = mkLabel('', '#ff8a5a'); ctx.scene.add(this.lbl1);
    this.lbl2 = mkLabel('', '#9ad2ff'); ctx.scene.add(this.lbl2);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);

    this.angle = 0; this.t = 0; this.duration = 0;
    this._phys = null; this._physReady = false; this._physPromise = null;
    this._beamB = null; this._pivotB = null; this._hookB1 = null; this._hookB2 = null;
    this._bootPhys();
  },
  // 惰性加载引擎：首次显示「正在加载物理引擎…」遮罩（bridge 负责），完成后建世界。
  // 加载完成前的 seek/step 走解析式 fallback，画面不白等。
  _bootPhys() {
    if (this._physPromise) return this._physPromise;
    this._physPromise = (async () => {
      try {
        await loadAmmo();
        // 引擎已缓存时 loadAmmo 只隔一个微任务就 resolve，外壳的 recompute() 可能还没跑、
        // 本场景的 t1/t2 还是 undefined。_render 走 _syncLabels 会读到 undefined 的 toFixed 抛错
        // （只有「A7 不是第一个刚体场景」时命中，因为首个要下载 300ms、recompute 早跑完）。
        // 所以 _render 前先自我 recompute()，保证力矩值就位。
        this.recompute();
        this._physReady = true;
        this._rebuildPhys();
        this._render(this.t || 0);
      } catch (e) {
        console.error('[A7 ammo]', e);
        this._physReady = false;
      }
    })();
    return this._physPromise;
  },
  // 按当前参数重建刚体世界：钩码质量随 F 变、挂点随 L 变，铰链限位 ±25°。
  _rebuildPhys() {
    const w = createWorld({ gravity: [0, -9.8, 0] });
    this._phys = w;
    const unit = 0.32;
    const x1 = -(this.p.l1 || 1) * unit, x2 = (this.p.l2 || 1) * unit;
    // 支点：静态体（纯物理锚点，视觉用 pivot 柱）
    this._pivotB = w.addBox(null, { mass: 0, halfExtents: [0.12, 0.12, 0.22], pos: [0, 1.6, 0] });
    // 梁：动态刚体，质心在支点；绕 z 轴铰链，限位 ±25°
    this._beamB = w.addBox(this.beamG, { mass: this.BEAM_MASS, halfExtents: [4, 0.08, 0.2], pos: [0, 1.6, 0] });
    w.addHinge(this._pivotB, this._beamB, [0, 0, 0], [0, 0, 1], { low: -this.MAX_TILT * DEG, high: this.MAX_TILT * DEG });
    // 钩码：质量 = F/g（牛顿 → kg），用点对点约束把钩环挂在梁的挂点上
    const m1 = (this.p.f1 || 1) / G, m2 = (this.p.f2 || 1) / G;
    const hangY = 1.6 - 0.30;                        // 梁挂点世界 y（梁局部 y=-0.30）
    this._hookB1 = w.addBox(this.w1root, { mass: m1, halfExtents: [0.15, 0.12, 0.15], pos: [x1, hangY - this.HOOK_Y, 0] });
    this._hookB2 = w.addBox(this.w2root, { mass: m2, halfExtents: [0.15, 0.12, 0.15], pos: [x2, hangY - this.HOOK_Y, 0] });
    w.addP2P(this._beamB, this._hookB1, [x1, -0.30, 0], [0, this.HOOK_Y, 0]);
    w.addP2P(this._beamB, this._hookB2, [x2, -0.30, 0], [0, this.HOOK_Y, 0]);
    // 槽码外观随力的大小缩放（视觉提示；物理质量已随 F 变）
    this.w1.scale.setScalar(0.9 + (this.p.f1 || 1) * 0.12);
    this.w2.scale.setScalar(0.9 + (this.p.f2 || 1) * 0.12);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const t1 = (this.p.f1 || 1) * (this.p.l1 || 1);
    const t2 = (this.p.f2 || 1) * (this.p.l2 || 1);
    this.t1 = t1; this.t2 = t2;
    this.net = t1 - t2;
    this.balanced = Math.abs(this.net) < this.TOL;
    // 时间轴：平衡时没有过程（0）；不平衡时呈现时长 2.2s（转到极限角的过程）
    this.duration = this.balanced ? 0 : 2.2;
    // 不在这里重建世界：_render 每次都会建一个干净世界，重复重建只是浪费
    this.t = 0;
    this._render(0);
  },
  // 梁绕 z 的当前倾角（从刚体同步后的四元数读，世界状态）
  _physAngle() {
    if (!this.beamG) return 0;
    const q = this.beamG.quaternion;
    return 2 * Math.atan2(q.z, q.w);
  },
  // 梁局部点 → 世界坐标（用当前 beamG 世界变换）
  _beamToWorld(lx, ly) {
    return new THREE.Vector3(lx, ly, 0).applyQuaternion(this.beamG.quaternion).add(this.beamG.position);
  },
  _render(t) {
    const tt = t == null ? 0 : t;
    if (this._physReady) {
      // 每次都重建一个干净世界再重放：btRigidBody 的 reset() 无法完全清掉铰链/点对点约束的
      // 求解器残留冲量（实测同一 t 连续重放会卡在错误角度），而 A7 只有 132 步，
      // 重建 4 个刚体 + 3 个约束的开销远小于物理步进本身。这样 seek 与 step 走完全同一条
      // 「全新世界 → 固定步长跑到 t」，确定性和一致性都成立。
      this._rebuildPhys();
      this._phys.stepTo(tt);
      this.angle = this._physAngle();
    } else {
      this._renderFallback(tt);
    }
    this._syncLabels();
  },
  // 加载期间的解析式 fallback：与旧实现同构，保证引擎下载那 ~1s 内画面仍可交互
  _renderFallback(t) {
    const ang = this._angleFallback(t);
    this.beamG.rotation.z = ang;
    this.angle = ang;
    const unit = 0.32;
    const x1 = -(this.p.l1 || 1) * unit, x2 = (this.p.l2 || 1) * unit;
    const p1 = this._beamToWorld(x1, -0.30), p2 = this._beamToWorld(x2, -0.30);
    this.w1root.position.set(p1.x, p1.y - this.HOOK_Y, 0);   // 钩码竖直下垂，不随梁转
    this.w2root.position.set(p2.x, p2.y - this.HOOK_Y, 0);
    this.w1root.quaternion.identity(); this.w2root.quaternion.identity();
  },
  _angleFallback(t) {
    if (this.balanced) return 0;
    const d = this.duration || 2.2;
    const tt = clamp(t, 0, d) / d;
    const k = clamp(Math.abs(this.net) / 3, 0.35, 1);
    const p = clamp(tt * (0.55 + 0.45 * k), 0, 1);
    const e = p * p * (3 - 2 * p);
    return (this.net > 0 ? 1 : -1) * (this.MAX_TILT * DEG) * e;
  },
  _syncLabels() {
    const unit = 0.32;
    const x1 = -(this.p.l1 || 1) * unit, x2 = (this.p.l2 || 1) * unit;
    const p1 = this._beamToWorld(x1, -0.30), p2 = this._beamToWorld(x2, -0.30);
    this.lbl1.position.set(p1.x, p1.y - 0.32, 0);
    this.lbl2.position.set(p2.x, p2.y - 0.32, 0);
    setLabel(this.lbl1, 'F1=' + (this.p.f1 || 1) + 'N · L1=' + (this.p.l1 || 1));
    setLabel(this.lbl2, 'F2=' + (this.p.f2 || 1) + 'N · L2=' + (this.p.l2 || 1));
    this.lbl.position.set(0, 2.75, 0);
    const dir = this.balanced ? '平衡（保持水平）' : (this.net > 0 ? '左侧力矩大 → 向左侧下沉' : '右侧力矩大 → 向右侧下沉');
    // t1/t2 由 recompute() 赋值，加载完成前后都可能被调到这里 → 兜底 ?? 0
    setLabel(this.lbl, 'F1L1=' + (this.t1 ?? 0).toFixed(1) + ' N·m   F2L2=' + (this.t2 ?? 0).toFixed(1) + ' N·m · ' + dir);
  },
  step(dt) {
    if (dt <= 0) return;
    this.t = Math.min((this.t || 0) + dt, this.duration || 0);
    if (this._physReady) {
      // 播放走增量步进（不重建，快）：从当前世界连续推进 round(dt/STEP) 步。
      // 它与 seek 的「重建世界 + 跑 n 步」等价——都是从全新初始状态连续跑 n 步，所以
      // 「顺序播放到 t」与「直接拖到 t」逐位一致。
      this._phys.stepN(Math.max(1, Math.round(dt / STEP)));
      this.angle = this._physAngle();
    } else {
      this._renderFallback(this.t);
    }
    this._syncLabels();
  },
  // 时间轴：seek = 重建干净世界 → 1/60 固定步长跑到 t（确定性；reset 不清约束残留冲量，只能重建）
  seek(t) {
    this.t = Math.max(0, Number.isFinite(t) ? t : 0);
    if (this.duration > 0) this.t = Math.min(this.t, this.duration);
    this._render(this.t);
  },
  reset() { this.t = 0; this.recompute(); },
  dispose() {
    try { disposeWorld(); } catch (e) {}
    this._phys = null;
    this._physReady = false;
  },
};

/* ===================== 右侧统计面板读数 =====================
 * 约定：返回 [{ label, value, unit }]，每场景 3~6 项，数值随播放实时变化。
 * 静止 / 零转速 / 无演化时也必须给合理值（0 或定性文字），不得出现 NaN —— rd() 已统一兜底。
 * 读数只读状态、不改状态：面板每 100ms 拉一次，不能有副作用。 */
Object.assign(A1, {
  readouts() {
    const seg = this.segments();
    const rows = [
      // 三段平均速度前置展示（对照 xiaobinlaoshi A1 数据表：前段/后段/全程）
      seg.enabled ? rd('前段平均速度 v₁', seg.v1, 'm/s') : rd('前段平均速度 v₁', 0, 'm/s'),
      seg.enabled ? rd('后段平均速度 v₂', seg.v2, 'm/s') : rd('后段平均速度 v₂', 0, 'm/s'),
      seg.enabled ? rd('全程平均速度 v̄', seg.v, 'm/s') : rd('全程平均速度 v̄', 0, 'm/s'),
      rd('速度 v', this.v, 'm/s'),
      rd('位移 s', this.u, 'm'),
      rd('加速度 a', this.static ? 0 : this.aVal, 'm/s²'),
    ];
    return this.static ? rows : rows.concat([
      rd('摩擦力 f', this.Ff, 'N'),
      rd('已用时 t', this._t, 's'),
    ]);
  },
});
Object.assign(A2, {
  readouts() {
    // 读数从物理世界采样：位移取小车位置，速度取线性速度，静止判断看是否 True 停住。
    // 位移零点 = 坡脚 XF0（=startX()，小车过接缝进入水平段开始计滑行）；坡上阶段 dist=0。
    let x = this.startX(), v = 0, stopped = false, onRamp = false;
    if (this._physReady && this._phys && this._cartB) {
      x = this.cartG.position.x;
      v = this._phys.linearSpeedX(this._cartB);
      stopped = this._phys.isStopped(this._cartB);
      onRamp = this._phys.isStopped(this._cartB) === false && x < this.startX();
    } else if (this.list) {
      // fallback：解析式——先在坡上匀加速（无摩擦），到坡脚后按 μ 匀减速
      const mu = this.sel.mu, tt = this.t || 0;
      const a_ramp = G * Math.sin(this.theta);
      const t_foot = Math.sqrt(2 * this.RL / a_ramp);
      if (tt < t_foot) { onRamp = true; x = this.XF0 - this.RL + 0.5 * a_ramp * tt * tt * Math.cos(this.theta); v = a_ramp * tt * Math.cos(this.theta); }
      else {
        const xt = tt - t_foot;
        if (mu <= 1e-6) { x = this.XF0 + this.v0 * xt; v = this.v0; }
        else {
          const sMax = isFinite(this.s) ? this.s : Infinity;
          x = this.XF0 + Math.min(this.v0 * xt - 0.5 * mu * G * xt * xt, sMax);
          v = Math.max(0, this.v0 - mu * G * xt);
          stopped = v <= 0.01;
        }
      }
    }
    const dist = Math.max(0, x - this.startX());
    // 阶段文案：冰面在末端刹停 →「滑到轨道末端·刹车停下」；理想光滑循环 →「循环滑行中（无限）」；
    // 其余：坡上下滑中 / 已停止 / 滑行中。
    let phase;
    if (this.sel && Math.abs(this.sel.mu) <= 1e-6) phase = '循环滑行中（无限）';
    else if (isFinite(this.s) && this.s >= this.BL - 1e-9 && dist >= this.BL - 0.05) phase = '滑到末端·刹停';
    else phase = onRamp ? '坡上下滑中' : (stopped ? '已停止' : (v > 0.01 ? '滑行中' : '静止'));
    return [
      rd('坡底速度 v₀', this.v0, 'm/s'),
      rd('所选材料 μ', this.sel ? this.sel.mu : 0, '', 2),
      rd('当前位移 s', dist, 'm'),
      rd('速度 v', v, 'm/s'),
      rd('已用时 t', this.t, 's'),
      { label: '运动阶段', value: phase, unit: '' },
    ];
  },
});
Object.assign(A3, {
  readouts() {
    return [
      rd('摩擦力 f', this.f, 'N'),
      rd('压力 N', this.p.normal || 0, 'N'),
      rd('摩擦因数 μ', this.p.mu || 0, '', 2),
      rd('拖动位移 x', this.x, 'm'),
      rd('已用时 t', this._t, 's'),
    ];
  },
});
Object.assign(A4, {
  readouts() {
    return [
      rd('液体压强 p', this.press, 'Pa', 0),
      rd('深度 h', this.p.depth || 0, 'cm', 0),
      rd('液体密度 ρ', this.p.liquid || 0, 'g/cm³'),
      rd('U 管液面差 Δh', this.dhmm, 'mm', 0),
      rd('探头朝向', this.p.orient || 0, '°', 0),
    ];
  },
});
Object.assign(A5, {
  readouts() {
    return [
      rd('重力 G', this.G, 'N'),
      rd('浮力 F浮', this.Fb, 'N'),
      rd('测力计示数', this.read, 'N'),
      rd('浸没比例', (this.subFrac || 0) * 100, '%', 0),
      { label: '浮沉状态', value: this.floatUp ? '上浮' : '下沉', unit: '' },
    ];
  },
});
Object.assign(A6, {
  readouts() {
    const L = this.L || 0.6, m = this.m || 0.2, th = this.theta || 0, w = this.omega || 0;
    const v = Math.abs(w) * L;
    return [
      rd('摆角 θ', th / DEG, '°', 1),
      rd('速度 v', v, 'm/s'),
      rd('动能 Ek', 0.5 * m * v * v, 'J', 3),
      rd('势能 Ep', m * G * (L - Math.cos(th) * L), 'J', 3),
      rd('周期 T', 2 * Math.PI * Math.sqrt(L / G), 's'),
    ];
  },
});
Object.assign(A7, {
  // 读数必须从物理世界采样（CEO 硬约束 2）：倾角取梁刚体四元数、角速度取 bridge 缓存的 ωz、
  // 钩码位置取 w1root/w2root 的实际世界坐标。不能用解析式 t1/t2 冒充，否则画面与读数会两套数据。
  readouts() {
    const ang = (this._physReady && this.beamG ? this._physAngle() : (this.angle || 0)) / DEG;
    const omega = (this._physReady && this._phys && this._beamB) ? this._phys.omegaZ(this._beamB) : 0;
    const y1 = this.w1root ? this.w1root.position.y : null;
    const y2 = this.w2root ? this.w2root.position.y : null;
    return [
      rd('左侧 F1·L1', this.t1, 'N·m', 1),
      rd('右侧 F2·L2', this.t2, 'N·m', 1),
      rd('梁倾角', ang, '°', 1),
      rd('角速度 ω', omega, 'rad/s', 2),
      rd('钩码高度', (y1 != null && y2 != null) ? (y1.toFixed(2) + ' / ' + y2.toFixed(2)) : '—', 'm'),
    ];
  },
});

export const MECHANICS = {
  'A1-incline-speed': A1,
  'A2-newton-first': A2,
  'A3-friction': A3,
  'A4-liquid-pressure': A4,
  'A5-buoyancy': A5,
  'A6-energy': A6,
  'A7-lever': A7,
};
