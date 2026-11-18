/* ===================== ammo.js 刚体引擎桥 =====================
 * 场景侧不直接接触 window.Ammo，只走本模块，为以后「学生自由搭建」预留统一接口。
 *
 * 对外（CEO 定）：
 *   loadAmmo()            惰性加载 vendor/ammo/ammo.js，缓存 Promise，只注入一次 script；
 *                         首次加载显示「正在加载物理引擎…」遮罩，完成后消失，缓存命中不再显示。
 *   createWorld({gravity}) 创建（并替换）当前物理世界，返回 world 句柄。
 *   addBody(mesh, opts)    向当前世界加刚体，返回 body 句柄。
 *   stepTo(t)              复位世界 → 固定步长 1/60 跑到 t（确定性重放）。
 *   reset()                复位到初始快照。
 *
 * 确定性约定：stepSimulation 每步 fixedTimeStep=1/60、maxSubSteps=1，不引入随机量；
 * 相同初始状态 + 相同步数 → 位姿逐位一致。stepTo 的步数 = round(t/STEP)，
 * 避免 t=2.2 时 2.2/(1/60)=131.999… 被 floor 吃掉一步。
 *
 * 内存约定：临时 btTransform/btVector3 在 World 上预分配复用；
 * world.dispose() 负责释放所有 shape/motionState/body/constraint/求解器。
 */

const STEP = 1 / 60;

/* ---------- Ammo 加载：注入、遮罩、下载计数都归外壳（index.html 的 loadAmmo） ----------
 * bridge 只负责「调用」，绝不自己注 script——否则首次进 A7 会下载两次，探针直接报红。
 * 三条铁律：
 *   1) 只在调用时读 window.__LAB，模块顶层不能取（exp 是静态 import，会早于 window.__LAB 赋值）
 *   2) ammo.js 是 UMD 工厂，`root.Ammo = factory()` 同步返回【库对象】，所以 window.Ammo 本身就是库，不是函数。
 *      外壳若写成 `window.Ammo().then(...)` 会抛 TypeError —— 这里做兜底：脚本已注入时直接用 window.Ammo。
 *   3) 不缓存 window.__LAB.loadAmmo 引用，每次调用时现取。 */
function ammoUsable(lib) {
  return !!(lib && (lib.btVector3 || lib.btDiscreteDynamicsWorld));
}

export function loadAmmo() {
  // 已经可用（含外壳先前注入过的情况）
  if (ammoUsable(window.Ammo)) return Promise.resolve(window.Ammo);
  const shell = (window.__LAB && typeof window.__LAB.loadAmmo === 'function') ? window.__LAB.loadAmmo : null;
  if (!shell) {
    return Promise.reject(new Error('外壳未提供 loadAmmo()，无法加载物理引擎'));
  }
  return Promise.resolve()
    .then(() => shell.call(window.__LAB))
    .then(lib => {
      if (ammoUsable(lib)) return lib;
      // 外壳 loader 可能 resolve 了不可用的值（如把库对象当工厂调）；退回用已注入的 window.Ammo
      if (ammoUsable(window.Ammo)) return window.Ammo;
      throw new Error('ammo.js 加载后不可用（window.Ammo 缺 bt* 接口）');
    })
    .catch(err => {
      // 外壳 loader 内部崩（如 `window.Ammo is not a function`）时，脚本其实已注入成功，window.Ammo 可直接用
      if (ammoUsable(window.Ammo)) return window.Ammo;
      throw err;
    });
}

/* ---------- 世界 ---------- */
class World {
  constructor(Ammo, gravity) {
    this.Ammo = Ammo;
    this.bodies = [];        // { key, mesh, body, shape, motionState, initPos, initQuat }
    this.constraints = [];
    this._omega = {};        // key -> 最近一次 sync 的角速度（绕 z）

    this.collisionConfig = new Ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfig);
    this.broadphase = new Ammo.btDbvtBroadphase();
    this.solver = new Ammo.btSequentialImpulseConstraintSolver();
    this.dynamicsWorld = new Ammo.btDiscreteDynamicsWorld(
      this.dispatcher, this.broadphase, this.solver, this.collisionConfig,
    );
    this.dynamicsWorld.setGravity(new Ammo.btVector3(gravity[0] || 0, gravity[1] != null ? gravity[1] : -9.8, gravity[2] || 0));
    // 提高约束求解迭代：铰链限位 + 点对点挂钩这类刚性约束，默认 10 次在限位处容易发散成 NaN
    try { this.dynamicsWorld.getSolverInfo().set_m_numIterations(24); } catch (e) {}

    // 复用临时对象，避免每帧 new 导致 asm.js 堆增长
    this._tmpT = new Ammo.btTransform();
    this._tmpQ = new Ammo.btQuaternion(0, 0, 0, 1);
    this._tmpV = new Ammo.btVector3(0, 0, 0);
  }

  /* 加一个盒体刚体。mass=0 → 静态。mesh 可为 null（纯物理体，不参与渲染同步）。
   * halfExtents = 盒体半尺寸 [hx, hy, hz]；pos 为质心初始位置；quat 可选（默认单位四元数）。 */
  addBox(mesh, { mass = 1, halfExtents, pos = [0, 0, 0], quat = [0, 0, 0, 1], friction = 0.5, restitution = 0, dampingLin = 0.05, dampingAng = 0.3 } = {}) {
    const A = this.Ammo;
    const shape = new A.btBoxShape(new A.btVector3(halfExtents[0], halfExtents[1], halfExtents[2]));
    const t = new A.btTransform();
    t.setIdentity();
    t.getOrigin().setValue(pos[0], pos[1], pos[2]);
    t.getRotation().setValue(quat[0], quat[1], quat[2], quat[3]);
    const motionState = new A.btDefaultMotionState(t);
    const inertia = new A.btVector3(0, 0, 0);
    if (mass > 0) shape.calculateLocalInertia(mass, inertia);
    const body = new A.btRigidBody(new A.btRigidBodyConstructionInfo(mass, motionState, shape, inertia));
    body.setFriction(friction);
    body.setRestitution(restitution);
    if (mass > 0) body.setDamping(dampingLin, dampingAng);
    this.dynamicsWorld.addRigidBody(body);
    A.destroy(t); A.destroy(inertia);

    const key = 'b' + this.bodies.length;
    const rec = { key, mesh, body, shape, motionState, initPos: pos.slice(), initQuat: quat.slice(), initVel: [0, 0, 0] };
    this.bodies.push(rec);
    if (mesh) this.syncBody(rec);
    return rec;
  }

  /* 给刚体设初始线速度（m/s）。记进 rec.initVel，reset() 时会恢复——否则 seek 重放时初速被清零、物体不动。 */
  setLinearVelocity(rec, v) {
    const A = this.Ammo;
    const bv = new A.btVector3(v[0], v[1], v[2]);
    rec.body.setLinearVelocity(bv);
    rec.initVel = v.slice();
    A.destroy(bv);
  }

  /* 铰链：a/b 为 body 句柄，pivotA 是 a 局部锚点，axisA 是 a 局部转轴。
   * low/high 为转角限位（弧度）。用软限位（softness/bias/relaxation）：
   * 硬限位在撞到 ±25° 的瞬间速度突变，会让求解器发散出 NaN，软限位把它当弹簧阻尼处理。 */
  addHinge(a, b, pivotA, axisA, { low = -0.45, high = 0.45 } = {}) {
    const A = this.Ammo;
    const pa = new A.btVector3(pivotA[0], pivotA[1], pivotA[2]);
    const ax = new A.btVector3(axisA[0], axisA[1], axisA[2]);
    const c = new A.btHingeConstraint(a.body, b.body, pa, pa, ax, ax);
    c.setLimit(low, high, 0.9, 0.3, 1.0);          // softness, biasFactor, relaxationFactor
    this.dynamicsWorld.addConstraint(c, true);     // true：连接体之间禁用碰撞
    this.constraints.push(c);
    A.destroy(pa); A.destroy(ax);
    return c;
  }

  /* 点对点约束（挂钩）：a 局部锚点 pivotA 与 b 局部锚点 pivotB 保持重合。
   * 用于把钩码挂在梁的挂点上：梁转动时挂点跟着走，钩码作为独立刚体有真实摆动。 */
  addP2P(a, b, pivotA, pivotB) {
    const A = this.Ammo;
    const pa = new A.btVector3(pivotA[0], pivotA[1], pivotA[2]);
    const pb = new A.btVector3(pivotB[0], pivotB[1], pivotB[2]);
    const c = new A.btPoint2PointConstraint(a.body, b.body, pa, pb);
    this.dynamicsWorld.addConstraint(c, true);
    this.constraints.push(c);
    A.destroy(pa); A.destroy(pb);
    return c;
  }

  /* 复位到初始快照：位置/姿态/速度全部归零，不清除物体。
   * 注意：本场景不施加任何外力（只有全局重力，由 world 内部每步处理），
   * 所以不需要 clearForces——反而 asm.js 版没有这个方法，硬调会抛错中断循环，
   * 导致部分刚体没复位、同一 t 两次重放漂 1e-4。这里只做最小必要的三件事。 */
  /* 复位到初始快照：建体时的完整状态（位置/姿态/线速/角速）整体还原。
   * 关键：必须 activate()——Bullet 在低运动时会把刚体自动 sleep（休眠），
   * 复位后若不唤醒，下一次 stepTo/stepN 会推不动物体，现象和「丢初速」一样。
   * 所以这里不逐字段补，而是从 rec 记录的 snapshot 一次性还原 + activate。 */
  reset() {
    const A = this.Ammo;
    for (const b of this.bodies) {
      this._tmpT.setIdentity();
      this._tmpT.getOrigin().setValue(b.initPos[0], b.initPos[1], b.initPos[2]);
      this._tmpT.getRotation().setValue(b.initQuat[0], b.initQuat[1], b.initQuat[2], b.initQuat[3]);
      b.body.setWorldTransform(this._tmpT);
      b.body.getMotionState().setWorldTransform(this._tmpT);
      // 线速度：先清零再恢复 initVel（A7 无初速、A2 小车有初速）
      const lv = b.initVel ? new A.btVector3(b.initVel[0], b.initVel[1], b.initVel[2]) : new A.btVector3(0, 0, 0);
      b.body.setLinearVelocity(lv);
      this._tmpV.setValue(0, 0, 0);
      b.body.setAngularVelocity(this._tmpV);
      if (b.initVel) A.destroy(lv);
      // 唤醒，确保复位后能被推进
      try { b.body.setActivationState(1); } catch (e) {}   // 1=ACTIVE_TAG
      try { b.body.activate ? b.body.activate() : null; } catch (e) {}
      try { b.body.clearForces ? b.body.clearForces() : null; } catch (e) {}
    }
    this.sync();
  }

  /* 固定步长推进 n 步（不复位）。 */
  stepN(n) {
    for (let i = 0; i < n; i++) this.dynamicsWorld.stepSimulation(STEP, 1, STEP);
    this.sync();
  }

  /* 复位世界 → 按固定步长跑到 t（确定性重放；顺序播放与直接拖动同一条路径）。 */
  stepTo(t) {
    this.reset();
    const tt = Number.isFinite(t) ? Math.max(0, t) : 0;
    const n = Math.max(0, Math.floor(tt / STEP + 0.5));
    for (let i = 0; i < n; i++) this.dynamicsWorld.stepSimulation(STEP, 1, STEP);
    this.sync();
  }

  /* 把刚体变换写回 mesh，并缓存角速度（供 readouts 采样）。 */
  sync() {
    for (const b of this.bodies) this.syncBody(b);
  }
  syncBody(b) {
    if (!b.mesh) return;
    const A = this.Ammo;
    b.body.getMotionState().getWorldTransform(this._tmpT);
    const o = this._tmpT.getOrigin();
    const q = this._tmpT.getRotation();
    b.mesh.position.set(o.x(), o.y(), o.z());
    b.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
    try {
      const av = b.body.getAngularVelocity();
      b.omega = av.z();
    } catch (e) { b.omega = 0; }
  }

  /* 取某刚体绕 z 的角速度（rad/s，从最近一次 sync 缓存）。 */
  omegaZ(rec) { return rec && Number.isFinite(rec.omega) ? rec.omega : 0; }

  /* 取刚体 x 向线速度（m/s）。body 句柄可能在主循环里被 step 推进，直接读当前。 */
  linearSpeedX(rec) {
    if (!rec) return 0;
    const A = this.Ammo;
    try {
      const v = rec.body.getLinearVelocity();
      return v.x();
    } catch (e) { return 0; }
  }

  /* 是否已停住：速度 < 阈值。用阈值 0.02 m/s，避免微悬浮抖动误判成滑动（CEO 要求「静止必须真静止」）。 */
  isStopped(rec) {
    if (!rec) return true;
    const A = this.Ammo;
    try {
      const v = rec.body.getLinearVelocity();
      return Math.hypot(v.x(), v.y(), v.z()) < 0.02;
    } catch (e) { return true; }
  }

  dispose() {
    const A = this.Ammo;
    for (const c of this.constraints) { try { this.dynamicsWorld.removeConstraint(c); A.destroy(c); } catch (e) {} }
    this.constraints = [];
    for (const b of this.bodies) {
      try { this.dynamicsWorld.removeRigidBody(b.body); } catch (e) {}
      try { A.destroy(b.motionState); } catch (e) {}
      try { A.destroy(b.shape); } catch (e) {}
      try { A.destroy(b.body); } catch (e) {}
    }
    this.bodies = [];
    try { A.destroy(this.dynamicsWorld); } catch (e) {}
    try { A.destroy(this.solver); } catch (e) {}
    try { A.destroy(this.broadphase); } catch (e) {}
    try { A.destroy(this.dispatcher); } catch (e) {}
    try { A.destroy(this.collisionConfig); } catch (e) {}
    try { A.destroy(this._tmpT); A.destroy(this._tmpQ); A.destroy(this._tmpV); } catch (e) {}
  }
}

let currentWorld = null;

export function createWorld({ gravity }) {
  const A = window.Ammo;
  if (!A) throw new Error('createWorld 前必须先 await loadAmmo()');
  // 先彻底释放上一个世界并把模块引用置空：否则若它已被 dispose 过，
  // 再 dispose 一次会 destroy 已释放的 bt 对象，asm.js 直接 abort。
  if (currentWorld) {
    try { currentWorld.dispose(); } catch (e) {}
    currentWorld = null;
  }
  currentWorld = new World(A, gravity);
  return currentWorld;
}
export function addBody(mesh, opts) {
  if (!currentWorld) throw new Error('还没有物理世界，先 createWorld()');
  return currentWorld.addBox(mesh, opts);
}
export function stepTo(t) { if (currentWorld) currentWorld.stepTo(t); }
export function reset() { if (currentWorld) currentWorld.reset(); }
export function current() { return currentWorld; }
/* 场景 dispose 时用它：释放并置空 currentWorld，避免留下悬空引用被后续 createWorld 二次 dispose。 */
export function disposeWorld() {
  if (currentWorld) { try { currentWorld.dispose(); } catch (e) {} currentWorld = null; }
}

export { STEP };
