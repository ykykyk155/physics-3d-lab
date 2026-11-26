/* 电学 D1~D7 */
import { THREE, COLORS, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, mkArrow, setArrow, fatLine, setFatLine, addGround, clamp, G, rd } from './common.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { MATS, matClone, registerMaterials, battery, bulb, setBulbGlow, ammeter, setMeterNeedle, voltmeter, resistor, magnetBar, knifeSwitch, setSwitch, beaker, calorimeter, thermometer, setThermometer } from './props.js';

const C = COLORS.electricity;
const WIRE = '#c23b3b';      // 导线皮：教学功能色红（黄只留给电流粒子，避免满屏亮黄）

function electrons(n, color) {
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color || C), emissive: new THREE.Color(color || C), emissiveIntensity: 0.6 });
  const inst = new THREE.InstancedMesh(geo, m, n);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return inst;
}

/* 铁屑纹理：浅色板底 + 深色铁屑条（明暗对比强，1100px 下清晰可读）。
 * 1024×512 高分辨率、线宽 4.2px、长度 9~17px，沿磁感线切向排列。 */
function filingsTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d');
  g.fillStyle = '#E9EDF3'; g.fillRect(0, 0, 1024, 512);   // 浅色板底
  g.strokeStyle = '#23272E'; g.lineWidth = 6.0; g.lineCap = 'round';
  const cx = 512, cy = 256;
  for (let s = 1; s <= 4; s++) {
    const rx = 92 + s * 68, ry = 36 + s * 34;
    const n = 110 + s * 30;
    for (let a = 0; a < n; a++) {
      const t = a / n * Math.PI * 2 + (s % 2) * 0.02;
      const px = cx + Math.cos(t) * rx, py = cy + Math.sin(t) * ry;
      let tx = -Math.sin(t) * rx, ty = Math.cos(t) * ry;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const h = 9 + s * 2;
      g.beginPath(); g.moveTo(px - tx * h, py - ty * h); g.lineTo(px + tx * h, py + ty * h); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv); tex.needsUpdate = true; return tex;
}

/* ===================== D1 串并联（双表常显 · 点选换位） ===================== */
const D1 = {
  p: {}, elec: [],
  /* 规格 §14：横向加宽全部 x 坐标 x' = 0.375 + (x − 0.375) × 1.32 */
  _X(x) { return 0.375 + (x - 0.375) * 1.32; },
  /* ---------- 构建 ---------- */
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a3514);
    this._timers = []; this._down = null; this._conclTimer = null;
    this.records = [];
    // 电池组（底边，坐在导线上）
    this.battG = battery({ cells: 2, h: 0.5 }); this.battG.position.set(this._X(-1.15), 1.02, 0); ctx.scene.add(this.battG);
    this.battG.userData.pickTarget = { kind: 'slot', id: 'batt' };
    this.batt = this.battG;
    // 两只小灯泡（顶边 / 并联两条支路，坐在导线上）
    this.bulb1G = bulb({ r: 0.22 }); ctx.scene.add(this.bulb1G);
    this.bulb2G = bulb({ r: 0.22 }); ctx.scene.add(this.bulb2G);
    this.bulb1G.userData.pickTarget = { kind: 'slot', id: 'L1' };
    this.bulb2G.userData.pickTarget = { kind: 'slot', id: 'L2' };
    this.res1 = this.bulb1G; this.res2 = this.bulb2G;
    // 闸刀开关（底边，点击刀片/底座通断）
    this.switchG = knifeSwitch(); this.switchG.position.set(this._X(1.45), 1.0, 0); this.switchG.scale.setScalar(1.7); ctx.scene.add(this.switchG);
    this.switchG.userData.pickTarget = { kind: 'switch' };
    // 两只仪表（位置由槽位决定，build 后由 _layoutMeters 摆）
    this.meterG = ammeter({ w: 0.66, h: 0.54 }); this.meterG.userData.meter = 'amp'; ctx.scene.add(this.meterG);
    this.volMeterG = voltmeter({ w: 0.66, h: 0.54 }); this.volMeterG.userData.meter = 'vol'; ctx.scene.add(this.volMeterG);
    this.activeMeter = 'amp';
    // 选中表的光环（青色圆环，正面可见：位于 XY 平面、贴在表体前方，不压表盘）
    const ringM = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9, depthWrite: false });
    this.ampRing = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.018, 10, 40), ringM);
    this.ampRing.rotation.x = 0; this.ampRing.position.z = 0.10; this.meterG.add(this.ampRing);
    this.volRing = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.018, 10, 40), ringM);
    this.volRing.rotation.x = 0; this.volRing.position.z = 0.10; this.volMeterG.add(this.volRing);
    // 表笔引线（红/黑各一条，接入时显形）
    const redW = '#e0563d', blkW = '#3d4350';
    this.probes = {
      amp: [fatLine([], redW, 2.5), fatLine([], blkW, 2.5)],
      vol: [fatLine([], redW, 2.5), fatLine([], blkW, 2.5)],
    };
    Object.keys(this.probes).forEach(k => this.probes[k].forEach(l => { l.visible = false; ctx.scene.add(l); }));
    // 表读数标签（表盘下方）
    this.ampVal = mkLabel('电流表 I = —', '#ffe066'); ctx.scene.add(this.ampVal);
    this.volVal = mkLabel('电压表 U = —', '#7dd3fc'); ctx.scene.add(this.volVal);
    // 顶栏（只保留一个总状态标签）
    this.wires = []; this.parts = []; this.points = []; this.junctions = [];
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 4.28, 0); ctx.scene.add(this.lbl);
    // 结论卡（绿色大字，可手动关闭，5s 自动隐）
    this.conclDiv = document.createElement('div');
    Object.assign(this.conclDiv.style, {
      background: 'rgba(6,40,28,.92)', color: '#6ee7b7', border: '1.5px solid #34d399',
      borderRadius: '10px', padding: '8px 14px', fontSize: '17px', fontWeight: '700',
      fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap',
      display: 'none', cursor: 'default', boxShadow: '0 2px 12px rgba(0,0,0,.4)',
    });
    this.conclTextEl = document.createElement('span');
    this.conclDiv.appendChild(this.conclTextEl);
    const xBtn = document.createElement('span');
    xBtn.textContent = ' ✕';
    Object.assign(xBtn.style, { cursor: 'pointer', color: '#9ca3af', marginLeft: '10px', fontSize: '15px' });
    xBtn.title = '关闭结论';
    xBtn.onclick = () => this._hideConcl();
    this.conclDiv.appendChild(xBtn);
    this.concl = new CSS2DObject(this.conclDiv);
    this.concl.position.set(0, 3.95, 0);
    ctx.scene.add(this.concl);
    // 拾取交互：自建 raycast（不依赖 OrbitControls）
    this.raycaster = new THREE.Raycaster();
    this.ampSlot = 'A'; this.volSlot = 'L1';
    this.ampPoints = new Set(); this.volPoints = new Set();
    this.ampReading = null; this.volReading = null;
    this.ampError = false; this.volError = false;
    this.ampLeadEnds = null; this.volLeadEnds = null;
    this.pointBallM = new THREE.MeshStandardMaterial({ color: '#0f3d33', emissive: '#34d399', emissiveIntensity: 1.1, roughness: .3, metalness: .1 });
    this.pointRingM = new THREE.MeshStandardMaterial({ color: '#d9fbe8', emissive: '#b7f7dc', emissiveIntensity: .5, roughness: .4 });
    this._vp = document.getElementById('viewport');
    if (this._vp) {
      this._vp.addEventListener('pointerdown', this._hDown = e => { this._down = { x: e.clientX, y: e.clientY }; });
      this._vp.addEventListener('pointermove', this._hMove = e => this._onMove(e));
      this._vp.addEventListener('pointerup', this._hUp = e => this._onUp(e));
    }
    this.t = 0;
    this.duration = 4;          // 电子环行一个完整过程（build 期就有值）
    this.recompute();
  },
  /* ---------- 物理量（红线公式） ---------- */
  _vals() {
    const U = Number(this.p.voltage) || 3, r1 = Number(this.p.r1) || 10, r2 = Number(this.p.r2) || 20;
    const par = this.p.mode === 'parallel';
    const on = this.p.switch !== 'off';
    const Req = par ? (r1 * r2) / (r1 + r2) : r1 + r2;
    const I = on ? U / Req : 0;
    return { U, r1, r2, par, on, Req, I };
  },
  _ampVal(id, v) {
    if (!v.par) return v.I;                          // 串联 A/B/C 处处相等
    if (id === 'a') return v.U * (v.r1 + v.r2) / (v.r1 * v.r2);   // 干路
    if (id === 'b') return v.U / v.r1;               // L1 支路
    return v.U / v.r2;                               // c: L2 支路
  },
  _volVal(id, v) {
    if (id === 'batt') return v.U;
    if (!v.on) return 0;
    if (v.par) return v.U;
    return id === 'L1' ? v.U * v.r1 / (v.r1 + v.r2) : v.U * v.r2 / (v.r1 + v.r2);
  },
  /* ---------- 槽位 ---------- */
  _validSlots() { return this.p.mode === 'parallel' ? ['a', 'b', 'c', 'L1', 'L2', 'batt'] : ['A', 'B', 'C', 'L1', 'L2', 'batt']; },
  _slotKind(id) { return ['A', 'B', 'C', 'a', 'b', 'c'].includes(id) ? 'current' : (['L1', 'L2', 'batt'].includes(id) ? 'voltage' : null); },
  _slotC(id) {
    const par = this.p.mode === 'parallel';
    const map = par
      ? { a: { cx: this._X(2.30), y: 1.0 }, b: { cx: this._X(-1.20), y: 2.95 }, c: { cx: this._X(-1.20), y: 1.75 } }
      : { A: { cx: this._X(-1.45), y: 2.65 }, B: { cx: this._X(0.50), y: 2.65 }, C: { cx: this._X(2.25), y: 2.65 } };
    return map[id] || null;
  },
  _hasMeter(slot) { return this.ampSlot === slot || this.volSlot === slot; },
  /* ---------- 拾取与点选 ---------- */
  _pickMeta(obj) {
    let o = obj;
    while (o) { const u = o.userData; if (u && (u.pickTarget || u.meter)) return u; o = o.parent; }
    return null;
  },
  _ndc(e) {
    const r = this._vp.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  },
  _onMove(e) {
    if (!this._vp) return;
    this.raycaster.setFromCamera(this._ndc(e), this.ctx.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let hover = null;
    for (const h of hits) { const m = this._pickMeta(h.object); if (m && (m.pickTarget || m.meter)) { hover = m; break; } }
    const hoverId = hover && hover.pickTarget && hover.pickTarget.kind === 'slot' ? hover.pickTarget.id : null;
    this.points.forEach(p => { p.scale.setScalar(hoverId === p.userData.pid ? 1.35 : 1); });
    this._vp.style.cursor = hover ? 'pointer' : '';
  },
  _onUp(e) {
    if (!this._down || !this._vp) return;
    const dx = e.clientX - this._down.x, dy = e.clientY - this._down.y;
    this._down = null;
    if (dx * dx + dy * dy > 49) return;
    this.raycaster.setFromCamera(this._ndc(e), this.ctx.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      const m = this._pickMeta(h.object);
      if (!m) continue;
      if (m.meter) { this.selectMeter(m.meter); return; }
      if (m.pickTarget) {
        if (m.pickTarget.kind === 'switch') { this.toggleSwitch(); return; }
        if (m.pickTarget.kind === 'slot') { this.placeMeter(this.activeMeter, m.pickTarget.id); return; }
      }
    }
  },
  /* 程序 API：点测量点 = 当前选中的表放到该槽 */
  tapPoint(id) { return this.placeMeter(this.activeMeter, id); },
  selectMeter(m) { this.activeMeter = (m === 'vol') ? 'vol' : 'amp'; this._syncRings(); },
  /* ---------- 换位 ---------- */
  placeMeter(m, slot) {
    if (!this._validSlots().includes(slot)) return false;
    const other = m === 'amp' ? 'vol' : 'amp';
    const cur = m === 'amp' ? this.ampSlot : this.volSlot;
    const otherSlot = other === 'amp' ? this.ampSlot : this.volSlot;
    if (otherSlot === slot && slot !== cur) {           // 目标槽被另一只表占用 → 两表互换
      if (other === 'amp') this.ampSlot = cur; else this.volSlot = cur;
    }
    if (m === 'amp') this.ampSlot = slot; else this.volSlot = slot;
    this._applySlotState('amp', m !== 'amp');
    this._applySlotState('vol', m !== 'vol');
    this.buildCircuit();                                 // 换槽后重建导线断口/接线柱/空槽触点，断口跟随仪表
    const v = this._vals();
    this._refreshMeters(v); this._syncNeedles(); this._renderValLabels();
    this._layoutMeters();
    this._refreshConcl(v);
    if (this.ampError || this.volError) {
      if (this.ampError) this._dimBulbs(); else this._flashWires();
    }
    return true;
  },
  _applySlotState(which, quiet) {
    const slot = which === 'amp' ? this.ampSlot : this.volSlot;
    const kind = this._slotKind(slot);
    const expect = which === 'amp' ? 'current' : 'voltage';
    const err = slot != null && kind !== expect;
    if (which === 'amp') { this.ampError = err; if (err) this.ampPoints.delete(slot); else if (slot) this.ampPoints.add(slot); }
    else { this.volError = err; if (err) this.volPoints.delete(slot); else if (slot) this.volPoints.add(slot); }
    if (err && !quiet) {
      this.ctx.toast(which === 'amp'
        ? '错误：电流表应串联接入被测电路，不能并联在元件两端！'
        : '错误：电压表应与被测元件并联，不能串联进电路！');
    }
  },
  getMeterState() {
    const mk = (which) => {
      const slot = which === 'amp' ? this.ampSlot : this.volSlot;
      const ends = which === 'amp' ? this.ampLeadEnds : this.volLeadEnds;
      return {
        slot: slot,
        reading: which === 'amp' ? this.ampReading : this.volReading,
        error: which === 'amp' ? this.ampError : this.volError,
        leadEnds: ends ? [ends[0].clone(), ends[1].clone()] : [],
      };
    };
    return { amp: mk('amp'), vol: mk('vol') };
  },
  /* ---------- 仪表摆位与引线 ---------- */
  // 电压表直连引线几何（规格 §14.3）：删除矩形并联支路，表体仍在被测元件正上方，
  // 红黑两接线柱各一条直线直连元件左右接点；leadEnds = 元件两端接点
  // （L1/L2 半宽 0.40 → 距离≈0.80；batt 半宽 0.46 → 距离≈0.92）
  _volLeads(slot) {
    if (slot !== 'L1' && slot !== 'L2' && slot !== 'batt') return null;
    let ex, ey, half, lift, bodyZ;
    const par = this.p.mode === 'parallel';
    if (slot === 'batt') {
      ex = this._X(-1.15); ey = 1.0; half = 0.46; lift = 1.16; bodyZ = 0;      // 表体 y≈2.16 沿用 §13
    } else {
      const g = slot === 'L1' ? this.bulb1G : this.bulb2G;
      ex = g.position.x; ey = g.position.y; half = 0.40;
      // 抬高量沿用 §13 终版：串联两槽与并联下支路 0.94 → y≈3.60 / 2.70；
      // 并联上支路（头顶有顶栏「R总」）0.68 → y≈3.64，并联两槽表体 z 微前移避让
      if (par && slot === 'L1') { lift = 0.68; bodyZ = 0.30; }
      else if (par && slot === 'L2') { lift = 0.94; bodyZ = 0.30; }
      else { lift = 0.94; bodyZ = 0; }
    }
    return {
      ex, ny: ey, half, bodyX: ex, bodyY: ey + lift, bodyZ,
      ends: [new THREE.Vector3(ex - half, ey, 0.02), new THREE.Vector3(ex + half, ey, 0.02)],
    };
  },
  _slotPos(slot) {
    if (!slot) return null;
    const c = this._slotC(slot);
    // 电流槽（规格 §14.2）：表体上移到接线柱正好落在导线高度（bodyY=槽y+0.30、bodyZ=0），
    // 导线断口两端正好等于两接线柱 x（bodyX±0.198），水平导线直接接进接线柱
    if (c) return { bodyX: c.cx, bodyY: c.y + 0.30, bodyZ: 0, ends: [new THREE.Vector3(c.cx - 0.198, c.y, 0.09), new THREE.Vector3(c.cx + 0.198, c.y, 0.09)] };
    const vl = this._volLeads(slot);
    if (vl) return { bodyX: vl.bodyX, bodyY: vl.bodyY, bodyZ: vl.bodyZ, ends: vl.ends };
    return null;
  },
  _layoutMeters() {
    ['amp', 'vol'].forEach(which => {
      const g = which === 'amp' ? this.meterG : this.volMeterG;
      const label = which === 'amp' ? this.ampVal : this.volVal;
      const slot = which === 'amp' ? this.ampSlot : this.volSlot;
      const sp = this._slotPos(slot);
      if (!sp) { g.visible = false; label.visible = false; return; }
      g.visible = true; label.visible = true;
      g.position.set(sp.bodyX, sp.bodyY, sp.bodyZ);
      const pair = this.probes[which];
      const postA = new THREE.Vector3(sp.bodyX - 0.198, sp.bodyY - 0.30, sp.bodyZ + 0.09);
      const postB = new THREE.Vector3(sp.bodyX + 0.198, sp.bodyY - 0.30, sp.bodyZ + 0.09);
      // 电流槽：断口端点 == 接线柱投影，导线已直接接进接线柱，不再另画引线；
      // 电压槽：两柱各一条直线直连元件左右接点（一笔画、不折不分支）
      const onPost = sp.ends && sp.ends[0].distanceTo(postA) < 0.001 && sp.ends[1].distanceTo(postB) < 0.001;
      if (onPost) {
        pair.forEach(l => { l.visible = false; });
      } else {
        setFatLine(pair[0], [postA, sp.ends[0]]);
        setFatLine(pair[1], [postB, sp.ends[1]]);
        pair.forEach(l => { l.visible = true; });
      }
      if (which === 'amp') this.ampLeadEnds = sp.ends; else this.volLeadEnds = sp.ends;
      if (which === 'vol') label.position.set(sp.bodyX + 0.90, sp.bodyY + 0.06, 0.3);  // 电压表读数放表体右侧，避开灯泡光晕与表盘
      else label.position.set(sp.bodyX, sp.bodyY - 0.47, 0.3);                        // 电流表读数保持表体下方
    });
    this._syncRings();
  },
  _syncRings() {
    if (this.ampRing) this.ampRing.visible = this.activeMeter === 'amp';
    if (this.volRing) this.volRing.visible = this.activeMeter === 'vol';
  },
  /* ---------- 读数刷新 ---------- */
  _refreshMeters(v) {
    if (this.ampError) this.ampReading = '—';
    else if (!this.ampSlot) this.ampReading = null;
    else if (!v.on) this.ampReading = 0;
    else this.ampReading = this._ampVal(this.ampSlot, v);
    if (this.volError) this.volReading = '—';
    else if (!this.volSlot) this.volReading = null;
    else this.volReading = this._volVal(this.volSlot, v);
  },
  _syncNeedles() {
    const a = Number(this.ampReading);
    setMeterNeedle(this.meterG, Number.isFinite(a) ? clamp(a / 0.6, 0, 1) : 0);
    const u = Number(this.volReading);
    setMeterNeedle(this.volMeterG, Number.isFinite(u) ? clamp(u / 6, 0, 1) : 0);
  },
  _renderValLabels() {
    const a = this.ampReading;
    setLabel(this.ampVal, '电流表 I = ' + (a == null || a === '—' ? '—' : Number(a).toFixed(2)) + ' A');
    const u = this.volReading;
    setLabel(this.volVal, '电压表 U = ' + (u == null || u === '—' ? '—' : Number(u).toFixed(2)) + ' V');
  },
  /* ---------- 开关 ---------- */
  toggleSwitch() {
    const next = this.p.switch === 'off' ? 'on' : 'off';
    this.p.switch = next;
    if (this.ctx && this.ctx.ui && this.ctx.ui.setParamValue) this.ctx.ui.setParamValue('switch', next);
    this.recompute();
    return next;
  },
  /* ---------- 数据记录 ---------- */
  recordSample() {
    const v = this._vals();
    if (!v.on) return { ok: false, msg: '请先闭合开关并正确接入两只表' };
    if (this.ampError || this.volError || !this.ampSlot || !this.volSlot) return { ok: false, msg: '请先闭合开关并正确接入两只表' };
    const x = Number(this.volReading), y = Number(this.ampReading);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, msg: '请先闭合开关并正确接入两只表' };
    this.records.push({ x, y });
    return { ok: true, x, y };
  },
  recordData() { return this.records.map(r => ({ x: r.x, y: r.y })); },
  clearRecords() { this.records = []; },
  /* ---------- 结论卡 ---------- */
  _refreshConcl(v) {
    const par = v.par;
    const ampSet = this.ampPoints, volSet = this.volPoints;
    const lines = [];
    if (par) {
      if (ampSet.has('a') && ampSet.has('b') && ampSet.has('c')) lines.push('干路电流等于各支路电流之和：I = I1 + I2');
      if (['L1', 'L2', 'batt'].filter(id => volSet.has(id)).length >= 2) lines.push('并联各支路电压相等（均等于电源电压 U=' + (Number(v.U) || 0).toFixed(1) + 'V）');
    } else {
      if (ampSet.has('A') && ampSet.has('B') && ampSet.has('C')) {
        const I = Number(this.ampReading);
        lines.push('串联电流处处相等：I_A = I_B = I_C' + (Number.isFinite(I) ? ' = ' + I.toFixed(2) + 'A' : ''));
      }
      if (volSet.has('L1') && volSet.has('L2') && volSet.has('batt')) lines.push('且 U = U1 + U2（U=' + (Number(v.U) || 0).toFixed(1) + 'V）');
    }
    if (lines.length) { this.conclTextEl.textContent = lines.join('　｜　'); this._showConcl(); }
    else this._hideConcl();
  },
  _showConcl() {
    if (this.conclDiv) this.conclDiv.style.display = 'block';
    if (this.concl) this.concl.visible = true;
    if (this._conclTimer) { clearTimeout(this._conclTimer); this._conclTimer = null; }
    this._conclTimer = setTimeout(() => this._hideConcl(), 5000);
  },
  _hideConcl() {
    if (this._conclTimer) { clearTimeout(this._conclTimer); this._conclTimer = null; }
    if (this.conclDiv) this.conclDiv.style.display = 'none';
    if (this.concl) this.concl.visible = false;
  },
  /* 误接视觉反馈：导线闪烁 / 灯泡变暗一瞬 */
  _flashWires() {
    let n = 0;
    const iv = setInterval(() => {
      n++;
      this.wires.forEach(w => { if (w) w.visible = (n % 2 === 1); });
      if (n >= 4) { clearInterval(iv); this.wires.forEach(w => { if (w) w.visible = true; }); }
    }, 300);
    this._timers.push(iv);
  },
  _dimBulbs() {
    setBulbGlow(this.bulb1G, 0.04); setBulbGlow(this.bulb2G, 0.04);
    const t = setTimeout(() => { if (this.scene) this.recompute(); }, 600);
    this._timers.push(t);
  },
  /* ---------- 生命周期 ---------- */
  onParam(k, v) {
    this.p[k] = v;
    if (k === 'mode') {
      this.ampSlot = (v === 'parallel') ? 'a' : 'A';
      this.volSlot = 'L1';
      this.ampPoints = new Set(); this.volPoints = new Set();
      this.ampError = false; this.volError = false;
      this.records = [];
    }
    this.recompute();
  },
  recompute() {
    const v = this._vals();
    this.Req = v.Req; this.I = v.I;
    if (this.ctx) this.ctx.emitReadout({ cur: v.I });
    const bright = clamp(v.I * 3.0, 0, 1);
    setBulbGlow(this.bulb1G, bright);
    setBulbGlow(this.bulb2G, bright * 0.85);
    setSwitch(this.switchG, v.on);
    this.buildCircuit();
    this._layoutMeters();
    this._refreshMeters(v);
    this._syncNeedles();
    this._renderValLabels();
    setLabel(this.lbl, (v.par ? '并联电路' : '串联电路') + ' · R总=' + v.Req.toFixed(1) + 'Ω');
    this._refreshConcl(v);
  },
  /* ---------- 电路图 ---------- */
  buildCircuit() {
    this.wires.forEach(w => { w.geometry.dispose(); this.scene.remove(w); }); this.wires = [];
    this.elec.forEach(e => { if (e.geometry) e.geometry.dispose(); this.scene.remove(e); }); this.elec = [];
    this.points.forEach(p => this.scene.remove(p)); this.points = [];
    this.parts.forEach(p => this.scene.remove(p)); this.parts = [];
    this.junctions.forEach(j => this.scene.remove(j)); this.junctions = [];
    const par = this.p.mode === 'parallel';
    const xL = this._X(-2.2), xR = this._X(2.95), yB = 1.0;
    const yT = par ? 2.95 : 2.65, yM = 1.75;
    const battX = this._X(-1.15), swX = this._X(1.45);
    const bL = battX - 0.44, bR = battX + 0.44;
    const sL = swX - 0.22, sR = swX + 0.22;
    let bulbs;
    if (!par) bulbs = [{ g: this.bulb1G, x: this._X(-0.35) }, { g: this.bulb2G, x: this._X(1.35) }];
    else bulbs = [{ g: this.bulb1G, x: this._X(0.55) }, { g: this.bulb2G, x: this._X(0.55) }];
    bulbs[0].g.position.set(bulbs[0].x, yT + 0.01, 0);
    bulbs[1].g.position.set(bulbs[1].x, (par ? yM : yT) + 0.01, 0);
    const l1L = bulbs[0].x - 0.20, l1R = bulbs[0].x + 0.20;
    const l2L = bulbs[1].x - 0.20, l2R = bulbs[1].x + 0.20;
    const segs = [];
    const post = (x, y, z) => {
      const p = cyl(0.03, 0.03, 0.10, MATS.brass()); p.position.set(x, y + 0.05, z);
      this.parts.push(p); this.scene.add(p);
    };
    if (!par) {
      const A = this._slotC('A'), B = this._slotC('B'), Cc = this._slotC('C');
      segs.push([[xL, yB], [bL, yB]]);
      segs.push([[bR, yB], [sL, yB]]);
      // 电流槽断口（规格 §14.2）：断口两端 = 槽心 ± 0.198 = 表体两接线柱投影，水平导线直接接进接线柱
      if (this._hasMeter('C')) {
        segs.push([[sR, yB], [xR, yB], [xR, yT], [Cc.cx + 0.198, yT]]);
        segs.push([[Cc.cx - 0.198, yT], [l2R, yT]]);
      } else {
        segs.push([[sR, yB], [xR, yB], [xR, yT], [l2R, yT]]);
      }
      if (this._hasMeter('B')) {
        segs.push([[l2L, yT], [B.cx + 0.198, yT]]);
        segs.push([[B.cx - 0.198, yT], [l1R, yT]]);
      } else segs.push([[l2L, yT], [l1R, yT]]);
      if (this._hasMeter('A')) {
        segs.push([[l1L, yT], [A.cx + 0.198, yT]]);
        segs.push([[A.cx - 0.198, yT], [xL, yT], [xL, yB]]);
      } else segs.push([[l1L, yT], [xL, yT], [xL, yB]]);
      post(bL, yB, 0); post(bR, yB, 0); post(sL, yB, 0); post(sR, yB, 0);
      post(l1L, yT, 0); post(l1R, yT, 0); post(l2L, yT, 0); post(l2R, yT, 0);
    } else {
      const a = this._slotC('a'), b = this._slotC('b'), c = this._slotC('c');
      segs.push([[xL, yB], [bL, yB]]);
      segs.push([[bR, yB], [sL, yB]]);
      // 电流槽断口（规格 §14.2）：断口两端 = 槽心 ± 0.198 = 表体两接线柱投影，水平导线直接接进接线柱
      if (this._hasMeter('a')) {
        segs.push([[sR, yB], [a.cx - 0.198, yB]]);
        segs.push([[a.cx + 0.198, yB], [xR, yB]]);
      } else segs.push([[sR, yB], [xR, yB]]);
      segs.push([[xL, yB], [xL, yT]]);
      segs.push([[xR, yB], [xR, yT]]);
      // 上支路（L1）
      if (this._hasMeter('b')) {
        segs.push([[xL, yT], [b.cx - 0.198, yT]]);
        segs.push([[b.cx + 0.198, yT], [l1L, yT]]);
      } else segs.push([[xL, yT], [l1L, yT]]);
      segs.push([[l1R, yT], [xR, yT]]);
      // 下支路（L2）
      if (this._hasMeter('c')) {
        segs.push([[xL, yM], [c.cx - 0.198, yM]]);
        segs.push([[c.cx + 0.198, yM], [l2L, yM]]);
      } else segs.push([[xL, yM], [l2L, yM]]);
      segs.push([[l2R, yM], [xR, yM]]);
      post(bL, yB, 0); post(bR, yB, 0); post(sL, yB, 0); post(sR, yB, 0);
      post(l1L, yT, 0); post(l1R, yT, 0); post(l2L, yM, 0); post(l2R, yM, 0);
      // 分支节点实心圆点
      [[xL, yM], [xR, yM]].forEach(([jx, jy]) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), MATS.brass());
        dot.position.set(jx, jy, 0.02); this.junctions.push(dot); this.scene.add(dot);
      });
    }
    // 电压表直连引线（规格 §14.3）：不复画支路、不再画主wire支路节点球（并联分叉节点上面已画）；
    // 表体在元件正上方，两柱直线由 _layoutMeters 直连元件左右接点
    segs.forEach(pts => {
      const w = fatLine(this._roundedPath(pts, 0.12), WIRE, 3);
      this.scene.add(w); this.wires.push(w);
    });
    // 空槽位的测量点标记（青绿色小球 + 环）
    const slots = par ? ['a', 'b', 'c'] : ['A', 'B', 'C'];
    slots.forEach(id => {
      if (this._hasMeter(id)) return;
      const c = this._slotC(id);
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), this.pointBallM);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.011, 8, 24), this.pointRingM);
      ring.rotation.x = Math.PI / 2;
      g.add(ball, ring);
      g.position.set(c.cx, c.y, 0.16);
      g.name = 'd1-point-' + id;
      g.userData.pid = id;
      g.userData.pickTarget = { kind: 'slot', id };
      this.scene.add(g); this.points.push(g);
    });
    // 电子粒子沿外圈（直线段折线，不能用 CatmullRom——会把矩形拉成椭圆）
    this._loopPoly = [[xL, yB], [xR, yB], [xR, yT], [xL, yT]].map(a => new THREE.Vector3(a[0], a[1], 0));
    this._loopLen = 0;
    for (let i = 0; i < this._loopPoly.length; i++) this._loopLen += this._loopPoly[i].distanceTo(this._loopPoly[(i + 1) % this._loopPoly.length]);
    const n = 30;
    this.elec = [electrons(n)];
    this.elec.forEach(e => this.scene.add(e));
    this.phases = new Array(n).fill(0).map((_, i) => i / n);
  },
  _roundedPath(pts, r) {
    const P = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const out = [P[0].clone()];
    const seg = 6;
    for (let i = 1; i < P.length - 1; i++) {
      const prev = P[i - 1], cur = P[i], next = P[i + 1];
      const d1 = prev.clone().sub(cur); const l1 = d1.length(); if (l1 < 1e-6) continue; d1.normalize();
      const d2 = next.clone().sub(cur); const l2 = d2.length(); if (l2 < 1e-6) continue; d2.normalize();
      const dd = Math.min(r, l1 * 0.45, l2 * 0.45);
      const a = cur.clone().add(d1.clone().multiplyScalar(dd));
      const b = cur.clone().add(d2.clone().multiplyScalar(dd));
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        const q = a.clone().multiplyScalar((1 - t) * (1 - t))
          .add(cur.clone().multiplyScalar(2 * (1 - t) * t))
          .add(b.clone().multiplyScalar(t * t));
        out.push(q);
      }
    }
    out.push(P[P.length - 1].clone());
    return out.map(v => new THREE.Vector3(v.x, v.y, 0));
  },
  _loopAt(u) {
    const P = this._loopPoly; if (!P || !P.length || !this._loopLen) return new THREE.Vector3();
    let d = ((u % 1) + 1) % 1 * this._loopLen;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const L = a.distanceTo(b);
      if (d <= L) return a.clone().lerp(b, d / L);
      d -= L;
    }
    return P[0].clone();
  },
  step(dt) {
    if (!this.elec.length || !this._loopPoly) return;
    if (dt > 0) this.t = Math.min((this.t || 0) + dt, this.duration || 0);
    this.renderAt(this.t || 0);
  },
  seek(t) {
    if (!this.elec.length || !this._loopPoly) return;
    this.t = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration || 0);
    this.renderAt(this.t);
  },
  renderAt(t) {
    if (!this.elec.length || !this._loopPoly) return;
    const I = this.I || 0;
    const k = clamp(I / 0.15, 0.2, 3);
    const inst = this.elec[0];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.42, 0.42, 0.42);
    for (let i = 0; i < this.phases.length; i++) {
      const p = (this.phases[i] + (t / (this.duration || 4)) * k) % 1;
      const pos = this._loopAt(p); pos.z = -0.03;
      m.compose(pos, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.visible = I > 0.001 && this.p.switch !== 'off';
  },
  reset() { this.t = 0; this.records = []; this.recompute(); if (this.renderAt) this.renderAt(0); },
  dispose() {
    this._timers.forEach(id => { try { clearInterval(id); } catch (e) {} try { clearTimeout(id); } catch (e) {} });
    this._timers = [];
    this._hideConcl();
    if (this._vp) {
      this._vp.removeEventListener('pointerdown', this._hDown);
      this._vp.removeEventListener('pointermove', this._hMove);
      this._vp.removeEventListener('pointerup', this._hUp);
      this._vp.style.cursor = '';
    }
    this._vp = null;
  },
};


/* ===================== D2 电阻大小因素 ===================== */
const D2 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a3514);
    this._timers = []; this._down = null;
    // 电池组（底边，坐在导线上）
    this.battG = battery({ cells: 2, h: 0.5 });
    this.battG.position.set(-1.5, 0.9, 0);
    ctx.scene.add(this.battG);
    // 闸刀开关（底边，点击刀片/底座通断）
    this.switchG = knifeSwitch();
    this.switchG.position.set(1.3, 0.9, 0);
    this.switchG.scale.setScalar(1.6);
    this.switchG.userData.pickTarget = { kind: 'switch' };
    ctx.scene.add(this.switchG);
    // 小灯泡（左竖边，显示电流大小）
    this.bulbG = bulb({ r: 0.24 });
    this.bulbG.position.set(-2.6, 1.9, 0);
    ctx.scene.add(this.bulbG);
    this.bulb = this.bulbG;
    // 电流表（表位固定：顶边串入缺口）
    this.meterG = ammeter({ w: 0.66, h: 0.54 });
    this.meterG.userData.meter = 'amp';
    ctx.scene.add(this.meterG);
    this.ampVal = mkLabel('电流表 I = —', '#ffe066');
    ctx.scene.add(this.ampVal);
    // 顶栏（R 公式读数）
    this.lbl = mkLabel('', C);
    this.lbl.position.set(0, 3.75, 0);
    ctx.scene.add(this.lbl);
    // 容器
    this.wires = []; this.parts = []; this.junctions = []; this.elec = []; this.bar = null;
    // 拾取交互：自建 raycast（不依赖 OrbitControls），点击闸刀通断
    this.raycaster = new THREE.Raycaster();
    this._vp = document.getElementById('viewport');
    if (this._vp) {
      this._vp.addEventListener('pointerdown', this._hDown = e => { this._down = { x: e.clientX, y: e.clientY }; });
      this._vp.addEventListener('pointermove', this._hMove = e => this._onMove(e));
      this._vp.addEventListener('pointerup', this._hUp = e => this._onUp(e));
    }
    this.t = 0;
    this.duration = 4;
    this.recompute();
  },
  /* ---------- 电路几何 ---------- */
  _geo() {
    return { xL: -2.6, xR: 2.6, yB: 0.9, yT: 2.9, battX: -1.5, swX: 1.3, conX: 0.9, meterX: -1.5 };
  },
  _matColor(rho) {
    return (rho === 8 || rho === '8') ? '#d8dde4' : (rho === 6 || rho === '6') ? '#d4a04a' : (rho === 4 || rho === '4') ? '#5a6a7a' : '#d4785e';
  },
  _matIdx(rho) {
    const order = [8, 6, 2, 4];   // 与 JSON options 顺序一致：镍铬/锰铜/铜/铁
    const i = order.indexOf(Number(rho));
    return i < 0 ? 0 : i;
  },
  /* ---------- 数值（规格 §2：R = ρ0×(L/100)×(1/S)/strands×(1+temp×0.002)，U=6V） ---------- */
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const L = Number(this.p.len) || 50;
    const S = Number(this.p.area) || 1;
    const rho = Number(this.p.mat) || 8;
    const strands = Number(this.p.strands) || 1;
    const temp = Number(this.p.temp) || 20;
    const tf = 1 + temp * 0.002;
    const R = rho * (L / 100) * (1 / S) / strands * tf;
    const on = this.p.switch !== 'off';
    const I = on ? 6 / R : 0;
    this.R = R; this.I = I; this.on = on;
    this.lenScale = L / 100;
    this.matIdx = this._matIdx(rho);
    const len = 0.8 + (L / 100) * 2.2;             // 导体模型长度（基准：L=50 → 1.9）
    const r = 0.025 + Math.sqrt(S / 4) * 0.075;    // 导体模型半径（基准：S=1 → 0.0625）
    this.rad = r;
    if (this.ctx) this.ctx.emitReadout({ r: R, cur: I });
    setSwitch(this.switchG, on);
    setBulbGlow(this.bulbG, on ? clamp(I / 2, 0, 1) : 0);
    this.buildCircuit(len, r, rho, strands);
    // 电流表固定位（顶边缺口，表体接线柱正好落导线）
    const { meterX, yT } = this._geo();
    this.meterG.position.set(meterX, yT + 0.30, 0);
    setMeterNeedle(this.meterG, clamp(I / 3, 0, 1));
    this.ampVal.position.set(meterX + 0.90, yT + 0.36, 0.3);
    this._renderValLabels(on, I);
    setLabel(this.lbl, 'R = ρL/S = ' + R.toFixed(2) + ' Ω');
  },
  _renderValLabels(on, I) {
    const warn = I > 3 ? '⚠ ' : '';
    setLabel(this.ampVal, warn + '电流表 I = ' + (on ? I.toFixed(3) : '0.000') + ' A');
  },
  /* ---------- 电路图（每次参数变化全量重建导线/粒子/导体） ---------- */
  buildCircuit(len, r, rho, strands) {
    this.wires.forEach(w => { w.geometry.dispose(); this.scene.remove(w); }); this.wires = [];
    this.elec.forEach(e => { if (e.geometry) e.geometry.dispose(); this.scene.remove(e); }); this.elec = [];
    this.parts.forEach(p => this.scene.remove(p)); this.parts = [];
    this.junctions.forEach(j => this.scene.remove(j)); this.junctions = [];
    if (this.bar) { this.bar.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this.scene.remove(this.bar); this.bar = null; }
    const { xL, xR, yB, yT, battX, swX, conX, meterX } = this._geo();
    const bL = battX - 0.44, bR = battX + 0.44;
    const sL = swX - 0.22, sR = swX + 0.22;
    const gap = 0.198;
    const conL = conX - len / 2, conR = conX + len / 2;
    const bulbY = 1.9, yTop = bulbY + 0.72, yBot = bulbY - 0.18;   // 灯泡占位：导线接泡顶（玻璃泡最高≈2.54）之上与螺口底之下，不从玻璃泡穿过
    const segs = [];
    segs.push([[xL, yB], [bL, yB]]);
    segs.push([[bR, yB], [sL, yB]]);
    segs.push([[sR, yB], [xR, yB], [xR, yT], [conR, yT]]);
    segs.push([[conL, yT], [meterX + gap, yT]]);
    segs.push([[meterX - gap, yT], [xL, yT], [xL, yTop]]);
    segs.push([[xL, yBot], [xL, yB]]);
    segs.forEach(pts => {
      const w = fatLine(this._roundedPath(pts, 0.12), WIRE, 3);
      this.scene.add(w); this.wires.push(w);
    });
    // 接线柱（电池/开关/灯泡两端，MATS.brass() 同款）
    const post = (x, y, z) => {
      const p = cyl(0.03, 0.03, 0.10, MATS.brass()); p.position.set(x, y + 0.05, z);
      this.parts.push(p); this.scene.add(p);
    };
    post(bL, yB, 0); post(bR, yB, 0); post(sL, yB, 0); post(sR, yB, 0);
    post(xL, yTop, 0); post(xL, yBot, 0);
    // 待测导体组（顶边，随 len/S/strands/mat 变化）：组内固定基准尺寸（L=50→len0=1.9、S=1→r0=0.0625），
    // 实际参数由组 scale 表达（scale.x=len/1.9、scale.yz=r/0.0625），探针可读 bar.scale 断言随参数变化
    const len0 = 1.9, r0 = 0.0625;
    const g = new THREE.Group();
    const lineM = new THREE.MeshStandardMaterial({ color: this._matColor(rho), roughness: 0.35, metalness: 0.85 });
    const lines = [];
    for (let i = 0; i < strands; i++) {
      const dy = (i - (strands - 1) / 2) * 0.16;
      const rr = strands > 1 ? r0 * 0.75 : r0;      // 多根并排时每根略细（规格 §4：每根 r×0.75）
      const w = cyl(rr, rr, len0, lineM); w.rotation.z = Math.PI / 2; w.position.set(0, dy, 0);
      lines.push(w);
    }
    g.add(mergeByMaterial(lines));
    // 两端黄铜接线柱（竖直短柱，接导线端点）
    const caps = [];
    [-1, 1].forEach(s => {
      const c = cyl(r0 * 1.6, r0 * 1.6, 0.18, MATS.brass()); c.position.set(s * len0 / 2, 0, 0); caps.push(c);
    });
    g.add(mergeByMaterial(caps));
    g.position.set(conX, yT, 0);
    g.scale.set(len / len0, r / r0, r / r0);
    this.scene.add(g); this.bar = g;
    // 两端导线接入点（黄铜实心节点）
    [conL, conR].forEach(cx => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), MATS.brass());
      dot.position.set(cx, yT, 0.02); this.junctions.push(dot); this.scene.add(dot);
    });
    // 电子粒子沿外圈（直线段折线，不能用 CatmullRom——会把矩形拉成椭圆）
    this._loopPoly = [[xL, yB], [xR, yB], [xR, yT], [xL, yT]].map(a => new THREE.Vector3(a[0], a[1], 0));
    this._loopLen = 0;
    for (let i = 0; i < this._loopPoly.length; i++) this._loopLen += this._loopPoly[i].distanceTo(this._loopPoly[(i + 1) % this._loopPoly.length]);
    const n = 30;
    this.elec = [electrons(n)];
    this.elec.forEach(e => this.scene.add(e));
    this.phases = new Array(n).fill(0).map((_, i) => i / n);
  },
  _roundedPath(pts, r) {
    const P = pts.map(p => new THREE.Vector2(p[0], p[1]));
    const out = [P[0].clone()];
    const seg = 6;
    for (let i = 1; i < P.length - 1; i++) {
      const prev = P[i - 1], cur = P[i], next = P[i + 1];
      const d1 = prev.clone().sub(cur); const l1 = d1.length(); if (l1 < 1e-6) continue; d1.normalize();
      const d2 = next.clone().sub(cur); const l2 = d2.length(); if (l2 < 1e-6) continue; d2.normalize();
      const dd = Math.min(r, l1 * 0.45, l2 * 0.45);
      const a = cur.clone().add(d1.clone().multiplyScalar(dd));
      const b = cur.clone().add(d2.clone().multiplyScalar(dd));
      for (let k = 0; k <= seg; k++) {
        const t = k / seg;
        const q = a.clone().multiplyScalar((1 - t) * (1 - t))
          .add(cur.clone().multiplyScalar(2 * (1 - t) * t))
          .add(b.clone().multiplyScalar(t * t));
        out.push(q);
      }
    }
    out.push(P[P.length - 1].clone());
    return out.map(v => new THREE.Vector3(v.x, v.y, 0));
  },
  /* ---------- 拾取与点选（闸刀开关通断，D1 同款 7px 阈值） ---------- */
  _pickMeta(obj) {
    let o = obj;
    while (o) { const u = o.userData; if (u && u.pickTarget) return u; o = o.parent; }
    return null;
  },
  _ndc(e) {
    const r = this._vp.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  },
  _onMove(e) {
    if (!this._vp) return;
    this.raycaster.setFromCamera(this._ndc(e), this.ctx.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    let hover = null;
    for (const h of hits) { const m = this._pickMeta(h.object); if (m && m.pickTarget) { hover = m; break; } }
    this._vp.style.cursor = hover ? 'pointer' : '';
  },
  _onUp(e) {
    if (!this._down || !this._vp) return;
    const dx = e.clientX - this._down.x, dy = e.clientY - this._down.y;
    this._down = null;
    if (dx * dx + dy * dy > 49) return;
    this.raycaster.setFromCamera(this._ndc(e), this.ctx.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const h of hits) {
      const m = this._pickMeta(h.object);
      if (m && m.pickTarget && m.pickTarget.kind === 'switch') { this.toggleSwitch(); return; }
    }
  },
  /* 程序 API：点击闸刀通断 */
  toggleSwitch() {
    const next = this.p.switch === 'off' ? 'on' : 'off';
    this.p.switch = next;
    if (this.ctx && this.ctx.ui && this.ctx.ui.setParamValue) this.ctx.ui.setParamValue('switch', next);
    this.recompute();
    return next;
  },
  getState() {
    return { R: this.R, I: this.I, on: this.on, lenScale: this.lenScale, rad: this.rad, matIdx: this.matIdx };
  },
  /* ---------- 粒子环行（D1 同机制） ---------- */
  _loopAt(u) {
    const P = this._loopPoly; if (!P || !P.length || !this._loopLen) return new THREE.Vector3();
    let d = ((u % 1) + 1) % 1 * this._loopLen;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const L = a.distanceTo(b);
      if (d <= L) return a.clone().lerp(b, d / L);
      d -= L;
    }
    return P[0].clone();
  },
  step(dt) {
    if (!this.elec.length || !this._loopPoly) return;
    if (dt > 0) this.t = Math.min((this.t || 0) + dt, this.duration || 0);
    this.renderAt(this.t || 0);
  },
  seek(t) {
    if (!this.elec.length || !this._loopPoly) return;
    this.t = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration || 0);
    this.renderAt(this.t);
  },
  renderAt(t) {
    if (!this.elec.length || !this._loopPoly) return;
    const I = this.I || 0;
    const k = clamp(I / 1.5, 0.2, 3);
    const inst = this.elec[0];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.42, 0.42, 0.42);
    for (let i = 0; i < this.phases.length; i++) {
      const p = (this.phases[i] + (t / (this.duration || 4)) * k) % 1;
      const pos = this._loopAt(p); pos.z = -0.03;
      m.compose(pos, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.visible = this.on && I > 0.001;
  },
  reset() { this.t = 0; this.recompute(); if (this.renderAt) this.renderAt(0); },
  dispose() {
    this._timers.forEach(id => { try { clearInterval(id); } catch (e) {} try { clearTimeout(id); } catch (e) {} });
    this._timers = [];
    if (this._vp) {
      this._vp.removeEventListener('pointerdown', this._hDown);
      this._vp.removeEventListener('pointermove', this._hMove);
      this._vp.removeEventListener('pointerup', this._hUp);
      this._vp.style.cursor = '';
    }
    this._vp = null;
  },
};

/* ===================== D3 变阻器 ===================== */
const D3 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a3514);
    registerMaterials(ctx);
    // 滑动变阻器：陶瓷管 + 密集电阻丝绕线 + 滑片 + 接线柱
    this.coil = new THREE.Group(); this.coil.position.set(-0.6, 1.5, 0); ctx.scene.add(this.coil);
    const tube = cyl(0.16, 0.16, 3.0, MATS.ceramic()); tube.rotation.z = Math.PI / 2; this.coil.add(tube);
    const wind = [];
    for (let i = 0; i < 40; i++) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 16), MATS.copper()); w.rotation.y = Math.PI / 2; w.position.x = -1.5 + i * 0.077; wind.push(w); }
    this.coil.add(mergeByMaterial(wind));
    this.wiper = box(0.16, 0.5, 0.16, MATS.steel()); this.wiper.position.set(-0.6, 2.0, 0); ctx.scene.add(this.wiper);
    // 小灯泡（示电流）
    this.lampG = bulb({ r: 0.26 }); this.lampG.position.set(2.4, 1.5, 0); ctx.scene.add(this.lampG);
    this.lamp = this.lampG;
    this.leadA = fatLine([new THREE.Vector3(-2.4, 1.5, 0), new THREE.Vector3(-2.1, 1.5, 0)], WIRE, 3); ctx.scene.add(this.leadA);
    this.leadB = fatLine([new THREE.Vector3(1.0, 1.5, 0), new THREE.Vector3(2.1, 1.5, 0)], WIRE, 3); ctx.scene.add(this.leadB);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 2.8, 0); ctx.scene.add(this.lbl);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const rating = Number(this.p.rating) || 20;
    const wp = (this.p.wiper != null ? this.p.wiper : 100) / 100;
    let R;
    if (this.p.wiring === 'top') R = 0.5;          // 同上两柱：R≈0
    else if (this.p.wiring === 'bottom') R = rating; // 同下两柱：最大不变
    else R = rating * (1 - wp) + 0.5;
    const U = this.p.voltage || 4.5;
    const I = U / R;
    this.R = R; this.I = I;
    if (this.ctx) this.ctx.emitReadout({ cur: I });
    const wiperX = -0.6 - 1.4 + (this.p.wiring === 'bottom' ? 0 : wp * 2.8);
    this.wiper.position.x = this.p.wiring === 'top' ? -2.2 : this.p.wiring === 'bottom' ? 1.0 : wiperX;
    // 规格（0~20Ω / 0~50Ω）：线圈越长表示额定越大，换规格一眼可见（即使滑块在满位、R 都≈0）
    if (this.coil) this.coil.scale.x = rating / 20;
    const bright = clamp(I * 2.5, 0, 1);
    setBulbGlow(this.lampG, bright);
    this.lbl.position.set(0, 2.8, 0);
    setLabel(this.lbl, '规格 0~' + rating + 'Ω · R接入=' + R.toFixed(1) + 'Ω · I=' + I.toFixed(2) + 'A · ' + (this.p.wiring === 'top' ? '滑片失效' : this.p.wiring === 'bottom' ? '恒定最大' : '正常调光'));
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== D4 欧姆定律 + 伏安法 ===================== */
const D4 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a3514);
    registerMaterials(ctx);
    // 左边 I-U 图表（约占画面 45%，带网格与刻度）；右边伏安法真实器材（电流表 + 电压表 + 待测灯泡 + 电源导线）
    this.board = box(3.4, 3.0, 0.08, '#101828', { roughness: 0.8 }); this.board.position.set(-1.0, 1.8, -0.2); ctx.scene.add(this.board);
    this.meterA = ammeter({ w: 0.66, h: 0.52 }); this.meterA.position.set(1.5, 2.2, 0.4); ctx.scene.add(this.meterA);
    this.meterV = ammeter({ w: 0.66, h: 0.52 }); this.meterV.position.set(2.7, 2.2, 0.4); ctx.scene.add(this.meterV);
    this.dutG = bulb({ r: 0.22 }); this.dutG.position.set(2.1, 1.0, 0.5); ctx.scene.add(this.dutG);
    // 电源（电池组）+ 导线（伏安法必须成电路）
    this.batt = battery({ cells: 2, h: 0.4 }); this.batt.position.set(1.0, 0.0, 0.9); ctx.scene.add(this.batt);
    this.wireLoop = fatLine([new THREE.Vector3(1.0, 0.5, 0.9), new THREE.Vector3(1.0, 0.55, 0.4), new THREE.Vector3(1.5, 1.9, 0.4), new THREE.Vector3(2.7, 1.9, 0.4), new THREE.Vector3(3.3, 1.9, 0.4), new THREE.Vector3(3.3, 0.55, 0.5), new THREE.Vector3(2.1, 0.55, 0.5), new THREE.Vector3(1.0, 0.55, 0.9)], WIRE, 2.5);
    ctx.scene.add(this.wireLoop);
    // 坐标图网格 + 刻度（4 横 4 纵）
    for (let i = 1; i <= 4; i++) {
      const gy = 0.6 + 2.4 * i / 5;
      const gx = -1.8 + 3.6 * i / 5;
      ctx.scene.add(fatLine([new THREE.Vector3(-1.8, gy, -0.16), new THREE.Vector3(-1.4, gy, -0.16)], '#2c3a52', 1, { opacity: 0.9 }));
      ctx.scene.add(fatLine([new THREE.Vector3(gx, 0.6, -0.16), new THREE.Vector3(gx, 3.0, -0.16)], '#2c3a52', 1, { opacity: 0.9 }));
    }
    this.lblDY = mkLabel('I / A', '#9fb0c8'); this.lblDY.position.set(-1.95, 3.1, 0); ctx.scene.add(this.lblDY);
    this.lblDX = mkLabel('U / V', '#9fb0c8'); this.lblDX.position.set(-1.4, 0.35, 0); ctx.scene.add(this.lblDX);
    // 刻度数字（x 轴 5 个 / y 轴 5 个，数值随图像模式在 plot 里更新）
    this.xTicks = []; this.yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const xt = mkLabel('', '#8fa0bd'); xt.position.set(-1.8 + 3.4 * i / 4, 0.4, 0); ctx.scene.add(xt); this.xTicks.push(xt);
      const yt = mkLabel('', '#8fa0bd'); yt.position.set(-2.0, 0.6 + 2.3 * i / 4, 0); ctx.scene.add(yt); this.yTicks.push(yt);
    }
    this.axX = fatLine([new THREE.Vector3(-1.8, 0.6, 0), new THREE.Vector3(1.8, 0.6, 0)], '#7b8aa3', 2); ctx.scene.add(this.axX);
    this.axY = fatLine([new THREE.Vector3(-1.8, 0.6, 0), new THREE.Vector3(-1.8, 3.0, 0)], '#7b8aa3', 2); ctx.scene.add(this.axY);
    this.dots = new THREE.Group(); ctx.scene.add(this.dots);
    // 描点用实例化：41 个点合 1 个 draw call（原来每点一个 mesh = 41 calls）
    this.dotMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 12, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(C), emissive: new THREE.Color(C), emissiveIntensity: 0.8 }),
      41,
    );
    this.dotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dotMesh.castShadow = false; this.dotMesh.receiveShadow = false;
    ctx.scene.add(this.dotMesh);
    this.curMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 16, 12),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(COLORS.altPink), emissive: new THREE.Color(COLORS.altPink), emissiveIntensity: 1 }),
      1,
    );
    this.curMesh.castShadow = false; this.curMesh.receiveShadow = false;
    ctx.scene.add(this.curMesh);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.6, 0); ctx.scene.add(this.lbl);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const U = this.p.voltage || 0;
    let R = Number(this.p.rfix) || 10;
    if (this.p.dut === 'bulb') R = 5 + U * 3.5;           // 非线性（温度效应）
    const I = R > 0 ? U / R : 0;
    if (this.ctx) this.ctx.emitReadout({ cur: I });
    // 真实器材：电流表/电压表指针 + 待测灯泡亮度（I/U 变化看得见）
    setMeterNeedle(this.meterA, clamp(I / 0.8, 0, 1));
    setMeterNeedle(this.meterV, clamp(U / 6, 0, 1));
    setBulbGlow(this.dutG, clamp(I * 1.2, 0, 1));
    this.lbl.position.set(0, 3.6, 0);
    setLabel(this.lbl, 'I=U/R=' + I.toFixed(3) + 'A · Rx=U/I=' + R.toFixed(1) + 'Ω');
    this.plot(U, I, R);
  },
  plot(U, I, R) {
    const iu = this.p.graph !== 'ir';
    const xmax = iu ? 6 : 55, ymax = 0.8;
    const sx = 3.4, sy = 2.3;
    // 刻度数字：x 轴 0..xmax，y 轴 0..0.8
    if (this.xTicks) this.xTicks.forEach((t, i) => setLabel(t, (xmax * i / 4).toFixed(xmax >= 20 ? 0 : 1)));
    if (this.yTicks) this.yTicks.forEach((t, i) => setLabel(t, (ymax * i / 4).toFixed(1)));
    const N = 40;
    const m4 = new THREE.Matrix4();
    for (let j = 0; j <= N; j++) {
      const t = j / N;
      let xv, yv;
      if (iu) { xv = t * xmax; const Rr = this.p.dut === 'bulb' ? 5 + xv * 3.5 : (Number(this.p.rfix) || 10); yv = xv / Rr; }
      else { xv = 5 + t * 50; yv = (this.p.voltage || 0) / (this.p.dut === 'bulb' ? (5 + (this.p.voltage || 0) * 3.5) : xv); }
      const px = -1.8 + (xv / xmax) * sx;
      const py = 0.6 + (Math.min(yv, ymax) / ymax) * sy;
      this.dotMesh.setMatrixAt(j, m4.makeTranslation(px, py, 0));
    }
    this.dotMesh.instanceMatrix.needsUpdate = true;
    const cx = -1.8 + ((iu ? U : R) / xmax) * sx;
    const cy = 0.6 + (Math.min(I, ymax) / ymax) * sy;
    this.curMesh.setMatrixAt(0, m4.makeTranslation(clamp(cx, -1.8, 1.8), clamp(cy, 0.6, 2.9), 0));
    this.curMesh.instanceMatrix.needsUpdate = true;
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== D5 电功率·焦耳定律 ===================== */
const D5 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a3514);
    registerMaterials(ctx);
    // 两只烧瓶（锥形瓶 + 瓶塞 + 插入液体的温度计 + 瓶内电阻丝），能看见液柱
    const mkFlask = (x) => {
      const grp = new THREE.Group(); grp.position.set(x, 0, 0); ctx.scene.add(grp);
      const body = sphere(0.5, MATS.glass()); body.scale.set(1, 0.95, 1); body.position.y = 0.55; body.castShadow = false; grp.add(body);
      const neck = cyl(0.16, 0.2, 0.55, MATS.glass()); neck.position.y = 1.1; neck.castShadow = false; grp.add(neck);
      const stopper = cyl(0.17, 0.19, 0.12, MATS.rubber()); stopper.position.y = 1.42; grp.add(stopper);
      return grp;
    };
    this.flaskA = mkFlask(-1.4); this.flaskB = mkFlask(1.4);
    this.bottleA = this.flaskA; this.bottleB = this.flaskB;
    this.waterA = sphere(0.44, matClone('water')); this.waterA.scale.set(1, 0.7, 1); this.waterA.position.set(-1.4, 0.5, 0); this.waterA.castShadow = false; ctx.scene.add(this.waterA);
    this.waterB = sphere(0.44, matClone('water')); this.waterB.scale.set(1, 0.7, 1); this.waterB.position.set(1.4, 0.5, 0); this.waterB.castShadow = false; ctx.scene.add(this.waterB);
    // 瓶内电阻丝：铜色绕线，露出一段在液面上方（能看见它在发热）
    const mkHeater = (x) => {
      const parts = [];
      const wireM = matClone('copper');           // 私有材质：发热时改 emissive，不串到其他铜件
      const rod = cyl(0.022, 0.022, 1.15, wireM); rod.position.set(x, 0.72, 0); parts.push(rod);
      for (let i = 0; i < 5; i++) { const w = torus(0.055, 0.012, wireM); w.rotation.x = Math.PI / 2; w.position.set(x, 0.42 + i * 0.09, 0); parts.push(w); }
      return mergeByMaterial(parts);
    };
    this.resA = mkHeater(-1.4); ctx.scene.add(this.resA);
    this.resB = mkHeater(1.4); ctx.scene.add(this.resB);
    this.thermA = thermometer({ h: 1.0 }); this.thermA.position.set(-1.15, 0.5, 0); ctx.scene.add(this.thermA);
    this.thermB = thermometer({ h: 1.0 }); this.thermB.position.set(1.65, 0.5, 0); ctx.scene.add(this.thermB);
    this.lblA = mkLabel('', '#ffb020'); ctx.scene.add(this.lblA);
    this.lblB = mkLabel('', '#ffb020'); ctx.scene.add(this.lblB);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.0, 0); ctx.scene.add(this.lbl);
    this.tA = 20; this.tB = 20; this.tSim = 0; this.duration = 180;   // 通电时长（min）×60，默认 3min
  },
  onParam(k, v) { this.p[k] = v; if (k === 'voltage' || k === 'r' || k === 'ra' || k === 'rb' || k === 'link' || k === 'time') { this.tA = 20; this.tB = 20; } this.recompute(); },
  recompute() {
    const U = this.p.voltage || 3, R = this.p.r || 20;
    const P = U * U / R;
    if (this.ctx) this.ctx.emitReadout({ p: P });
    const ra = this.p.ra || 10, rb = this.p.rb || 20, ser = this.p.link === 'series';
    // 串联 I 同，Q=I²Rt；并联 U 同，Q=U²/R t
    let qa, qb;
    if (ser) { const I = U / (ra + rb); qa = I * I * ra; qb = I * I * rb; }
    else { qa = U * U / ra; qb = U * U / rb; }
    this.rateA = qa; this.rateB = qb;
    // 通电时间 t（min）真正参与：Q总 = 功率 × 时间，水柱按累计热量给一个「预演高度」；播放时按 t 缩放升温速度
    const tmin = this.p.time != null ? this.p.time : 3;
    this.timeScale = (tmin || 0) / 3;               // 相对默认 3min
    this.duration = (tmin || 0) * 60;               // 时间轴总长 = 通电时长（秒），与 F1 同构
    this.tSim = 0;
    const Qa = qa * tmin * 60 / 1000, Qb = qb * tmin * 60 / 1000;   // kJ
    const hA = 0.3 + clamp(qa * tmin * 1.33, 0, 1) * 1.1;
    const hB = 0.3 + clamp(qb * tmin * 1.33, 0, 1) * 1.1;
    if (this.thermA) setThermometer(this.thermA, clamp((this.tA) / 100, 0.05, 1));
    if (this.thermB) setThermometer(this.thermB, clamp((this.tB) / 100, 0.05, 1));
    this.lbl.position.set(0, 3.0, 0);
    setLabel(this.lbl, 'P=U²/R=' + P.toFixed(2) + 'W · t=' + tmin + 'min · Q总=' + (Qa + Qb).toFixed(1) + 'kJ · ' + (ser ? '串联 R 大升温快' : '并联 R 小升温快'));
  },
  step(dt) {
    if (dt <= 0) { this.render(0); return; }
    // 时间轴：通电时间是 t 的线性函数（升温速率恒定），整段解析可算
    this.tSim = Math.min((this.tSim || 0) + dt, this.duration || 0);
    this.render(0);
  },
  // 解析型：tA/tB 由通电时长闭式给出，seek 直接算，不重放
  seek(t) {
    this.tSim = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration || 0);
    this.render(0);
  },
  render() {
    const sc = this.timeScale != null ? this.timeScale : 1;
    const tt = this.tSim || 0;
    this.tA = Math.min(20 + this.rateA * tt * 0.01 * sc, 100);
    this.tB = Math.min(20 + this.rateB * tt * 0.01 * sc, 100);
    if (this.thermA) setThermometer(this.thermA, clamp(this.tA / 100, 0.05, 1));
    if (this.thermB) setThermometer(this.thermB, clamp(this.tB / 100, 0.05, 1));
    const glowA = clamp((this.tA - 20) / 60, 0, 1.2), glowB = clamp((this.tB - 20) / 60, 0, 1.2);
    this.resA.traverse(o => { if (o.material) { o.material.emissive = new THREE.Color('#ff5a1f'); o.material.emissiveIntensity = glowA; } });
    this.resB.traverse(o => { if (o.material) { o.material.emissive = new THREE.Color('#ff5a1f'); o.material.emissiveIntensity = glowB; } });
    this.lblA.position.set(-1.4, 2.4, 0); setLabel(this.lblA, 'R甲 ' + this.p.ra + 'Ω ' + this.tA.toFixed(0) + '℃');
    this.lblB.position.set(1.4, 2.4, 0); setLabel(this.lblB, 'R乙 ' + this.p.rb + 'Ω ' + this.tB.toFixed(0) + '℃');
  },
  reset() { this.tSim = 0; this.tA = 20; this.tB = 20; this.recompute(); },
  dispose() {},
};

/* ===================== D6 磁场、磁感线、电磁铁 ===================== */
const D6 = {
  p: {}, fieldLines: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a3514);
    this.magG = new THREE.Group(); ctx.scene.add(this.magG);
    // 条形磁铁（N 红 S 蓝 + 两端磁极标）
    this.magnetG = magnetBar({ len: 0.5, w: 0.42 });
    this.nPole = this.magnetG.children[0]; this.sPole = this.magnetG.children[1];
    this.magG.add(this.magnetG); this.magG.position.set(0, 1.6, 0);
    // 铁屑演示板：浅色竖板（正对镜头，磁铁贴在板前）+ 深色铁屑条
    this.board = box(5.6, 3.2, 0.05, matClone('plastic')); this.board.position.set(0, 1.6, -1.1);
    this.board.material.color.set(new THREE.Color('#E9EDF3'));
    decor(this.board); ctx.scene.add(this.board);
    this.filingMat = new THREE.MeshBasicMaterial({ map: filingsTexture(), transparent: false, depthWrite: true });
    this.filingPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.9), this.filingMat);
    this.filingPlane.position.set(0, 1.6, -1.05); this.filingPlane.visible = false; ctx.scene.add(this.filingPlane);
    // 螺线管
    this.coilG = new THREE.Group(); ctx.scene.add(this.coilG);
    // 螺线管：14 个线圈环同材质同节拍，合并成 1 个 draw call
    const rings = [];
    for (let i = 0; i < 14; i++) { const t = torus(0.32, 0.045, MATS.copper()); t.rotation.y = Math.PI / 2; t.position.x = -1.3 + i * 0.2; rings.push(t); }
    this.coilG.add(mergeByMaterial(rings));
    this.core = cyl(0.14, 0.14, 3.0, MATS.iron()); this.core.rotation.z = Math.PI / 2; this.coilG.add(this.core);
    // 电池组 + 开关：让「电流方向」有可见来源
    this.battG = battery({ cells: 2, h: 0.42 }); this.battG.position.set(0, 0.0, 3.2); this.coilG.add(this.battG);
    this.coilG.position.set(0, 1.6, 3.2); this.coilG.visible = false;
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.6, 0); ctx.scene.add(this.lbl);
    this.needleG = new THREE.Group(); ctx.scene.add(this.needleG);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const I = this.p.current || 0, N = this.p.turns || 60;
    const core = this.p.core === 'iron' ? 2.2 : 1;
    const strength = I * N / 20 * core;
    if (this.ctx) this.ctx.emitReadout({ strength: Math.round(strength) });
    this.strength = strength;
    const lay = this.p.layout || 'bar';
    this.coilG.visible = lay === 'solenoid';
    this.magG.visible = lay !== 'solenoid';
    this.lbl.position.set(0, 3.6, 0);
    setLabel(this.lbl, '磁性强弱 ∝ I·N = ' + I.toFixed(1) + '×' + N + (core > 1 ? '×铁芯' : '') + ' · 吸起 ' + Math.round(strength) + ' 个');
    this.drawField(lay);
    this.drawNeedles(lay);
  },
  drawField(lay) {
    this.fieldLines.forEach(f => { f.geometry.dispose(); this.scene.remove(f); }); this.fieldLines = [];
    const dir = this.p.dir === -1 ? -1 : 1;               // 电流方向：反向时磁场反向
    const color = dir === -1 ? COLORS.altPink : COLORS.currentFwd;
    const arrowSign = dir;                                 // 磁感线 N→S 方向翻转
    const barLike = (lay === 'bar' || lay === 'repel' || lay === 'attract');
    // 铁屑板只在条形磁铁布局下可见（它就是磁感线的实物载体）
    if (this.board) this.board.visible = barLike;
    if (this.filingPlane) this.filingPlane.visible = barLike;
    if (barLike) {
      // 磁感线主曲线（叠在铁屑纹路之上）
      for (let s = 1; s <= 4; s++) {
        const rx = 0.8 + s * 0.5, ry = 0.3 + s * 0.35;
        const pts = [];
        for (let a = 0; a <= 32; a++) {
          const t = a / 32 * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(t) * rx, 1.6 + Math.sin(t) * ry, 0.07));
        }
        const f = fatLine(pts, color, 1.2, { opacity: 0.4 }); this.scene.add(f); this.fieldLines.push(f);
      }
    } else if (lay === 'horseshoe' || lay === 'solenoid') {
      for (let s = 0; s < 4; s++) {
        const pts = [];
        for (let a = 0; a <= 24; a++) { const t = -Math.PI / 2 + a / 24 * Math.PI; pts.push(new THREE.Vector3(Math.cos(t) * (0.8 + s * 0.4), 1.6 + Math.sin(t) * (0.6 + s * 0.3), 0)); }
        const f = fatLine(pts, color, 1.4, { opacity: 0.7 }); this.scene.add(f); this.fieldLines.push(f);
      }
    }
  },
  drawNeedles(lay) {
    // 清空旧磁针（合并件，逐块 dispose）
    while (this.needleG.children.length) {
      const c = this.needleG.children.pop();
      c.traverse(o => o.geometry && o.geometry.dispose());
    }
    const n = this.p.needles || 6;
    const sgn = this.p.dir === -1 ? -1 : 1;                // 电流反向→小磁针同时反向
    const bases = [], reds = [], blues = [];
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(n, 1)) * Math.PI * 2;
      const r = 2.4;
      const bx = Math.cos(a) * r, bz = Math.sin(a) * r * 0.4;
      // 底座 + 支杆（小磁针的支点，不是裸 V）
      const base = cyl(0.09, 0.11, 0.05, MATS.plasticDark()); base.position.set(bx, 1.56, bz); bases.push(base);
      const post = cyl(0.018, 0.018, 0.16, MATS.steel()); post.position.set(bx, 1.66, bz); bases.push(post);
      // 磁针：红半 + 蓝半，沿径向摆放（绕 y 转 -a）
      const ux = Math.cos(a) * sgn, uz = Math.sin(a) * sgn, len = 0.12;
      const red = box(len, 0.02, 0.035, MATS.magnetN());
      red.position.set(bx + ux * len * 0.5, 1.78, bz + uz * len * 0.5); red.rotation.y = -a; reds.push(red);
      const blue = box(len, 0.02, 0.035, MATS.magnetS());
      blue.position.set(bx - ux * len * 0.5, 1.78, bz - uz * len * 0.5); blue.rotation.y = -a; blues.push(blue);
    }
    const grp = new THREE.Group();
    grp.add(mergeByMaterial(bases), mergeByMaterial(reds), mergeByMaterial(blues));
    grp.children.forEach(c => { c.castShadow = false; c.receiveShadow = false; });
    this.needleG.add(grp);
  },
  step() {},
  reset() { this.recompute(); },
  dispose() { this.fieldLines.forEach(f => f.geometry.dispose()); if (this.filings) { this.filings.geometry.dispose(); } },
};

/* ===================== D7 电动机与电磁感应 ===================== */
const D7 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a3514);
    registerMaterials(ctx);
    // 底座（实验台）
    this.base = box(2.4, 0.12, 3.2, MATS.woodDark()); this.base.position.set(0, 0.06, 0.15); ctx.scene.add(this.base);
    // 蹄形磁铁：左右两块铁极掌 + 下方铁轭连成马蹄形（正面看是分开的两极，不糊成一块暗板），
    // 只有内侧端面涂 N 红 / S 蓝
    const poles = [];
    const poleL = box(0.18, 1.5, 1.1, MATS.iron()); poleL.position.set(-1.0, 1.7, 0); poles.push(poleL);
    const poleR = box(0.18, 1.5, 1.1, MATS.iron()); poleR.position.set(1.0, 1.7, 0); poles.push(poleR);
    const yoke = box(2.18, 0.22, 1.1, MATS.iron()); yoke.position.set(0, 0.95, 0); poles.push(yoke);
    ctx.scene.add(mergeByMaterial(poles));
    const faceN = box(0.04, 1.5, 1.1, MATS.magnetN()); faceN.position.set(-0.9, 1.7, 0); ctx.scene.add(faceN);
    const faceS = box(0.04, 1.5, 1.1, MATS.magnetS()); faceS.position.set(0.9, 1.7, 0); ctx.scene.add(faceS);
    // 轴承立柱（固定件）：前后两根，托住转轴
    const posts = [];
    [-0.95, 1.05].forEach(z => {
      const post = box(0.13, 1.34, 0.15, MATS.steel()); post.position.set(0, 0.79, z); posts.push(post);
      const cap = box(0.19, 0.12, 0.22, MATS.steel()); cap.position.set(0, 1.52, z); posts.push(cap);
    });
    ctx.scene.add(mergeByMaterial(posts));

    // 转子（绕 z 轴旋转）：矩形铜线圈（多圈叠绕，从正面能看清一圈圈绕线）+ 转轴 + 换向器
    this.coilG = new THREE.Group(); this.coilG.position.set(0, 1.6, 0.15); ctx.scene.add(this.coilG);
    const a = 0.42, b = 0.56;                  // 半宽(x)、半高(y)
    const turns = 6, dr = 0.045, rWire = 0.026;
    const wind = [];
    // 嵌套矩形绕线：每一圈比内圈大一点，正面看就是一圈圈同心绕线
    for (let t = 0; t < turns; t++) {
      const aa = a + t * dr, bb = b + t * dr, zo = 0.06 - t * 0.03;
      [-1, 1].forEach(sx => {
        const bar = cyl(rWire, rWire, bb * 2, MATS.copper()); bar.position.set(sx * aa, 0, zo); wind.push(bar);
      });
      [-1, 1].forEach(sy => {
        const bar = cyl(rWire, rWire, aa * 2, MATS.copper()); bar.rotation.z = Math.PI / 2;
        bar.position.set(0, sy * bb, zo); wind.push(bar);
      });
    }
    this.coilG.add(mergeByMaterial(wind));
    // 转轴（沿 z）
    this.axle = cyl(0.045, 0.045, 2.6, MATS.steel()); this.axle.rotation.x = Math.PI / 2; this.axle.position.set(0, 0, 0.1); this.coilG.add(this.axle);
    // 换向器：绝缘芯 + 两片铜半环（中间留缝）
    this.commutator = new THREE.Group(); this.commutator.position.set(0, 0, 0.9); this.coilG.add(this.commutator);
    const core = cyl(0.15, 0.15, 0.32, MATS.dark()); core.rotation.x = Math.PI / 2; this.commutator.add(core);
    const seg = (start) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24, 1, false, start, Math.PI - 0.26), MATS.copper());
      m.rotation.x = Math.PI / 2; return m;
    };
    this.commutator.add(seg(0.13), seg(Math.PI + 0.13));
    // 电刷（固定件）：两块碳黑压在换向器上下两侧
    const brushG = new THREE.Group(); brushG.position.set(0, 0, 0.9); ctx.scene.add(brushG);
    const brushes = [];
    [-1, 1].forEach(sy => {
      const b = box(0.16, 0.13, 0.14, MATS.dark()); b.position.set(0, sy * 0.25, 0); brushes.push(b);
      const arm = box(0.06, 0.1, 0.05, MATS.brass()); arm.position.set(0, sy * 0.36, 0); brushes.push(arm);
    });
    brushG.add(mergeByMaterial(brushes));
    // 电刷引线（从电刷接到台面外的电源端子）
    this.leadA = fatLine([new THREE.Vector3(0, 1.85, 1.05), new THREE.Vector3(-0.7, 1.2, 1.1)], WIRE, 2.5); ctx.scene.add(this.leadA);
    this.leadB = fatLine([new THREE.Vector3(0, 1.35, 1.05), new THREE.Vector3(0.7, 1.2, 1.1)], WIRE, 2.5); ctx.scene.add(this.leadB);
    // 切割磁感线用的单根导线（其它模式隐藏）
    this.conductor = box(0.1, 1.2, 0.1, MATS.copper()); this.conductor.visible = false; ctx.scene.add(this.conductor);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.6, 0); ctx.scene.add(this.lbl);
    this.angle = 0;
    this.t = 0;
    this.duration = 9;          // build 期先给默认值（默认 200 r/min → 3 圈 9s），参数回灌后在 recompute 里再算
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const mode = this.p.mode || 'motor';
    const I = this.p.current || 0, B = this.p.field || 0.5, v = this.p.speed || 0;
    let n = 0;
    if (mode === 'motor') n = I * B * 400;
    else if (mode === 'generator') n = B * 1200;
    else n = B * v * 60;
    this.n = n;
    if (this.ctx) this.ctx.emitReadout({ rpm: n });
    this.coilG.visible = mode !== 'cut';
    this.conductor.visible = mode === 'cut';
    let txt;
    if (mode === 'motor') txt = '电动机：F=BIL 力矩 · ' + (this.p.commutator === 'off' ? '无换向器→来回摆' : '换向器→持续转') + ' · ' + n.toFixed(0) + ' r/min';
    else if (mode === 'generator') txt = '发电机：感应电流正弦 · ' + n.toFixed(0) + ' r/min';
    else txt = '切割磁感线：' + (this.p.moveDir === 'along' ? '沿磁感线→无电流' : this.p.moveDir === 'rev' ? '反向→指针反摆' : '→指针偏转') + ' · ' + n.toFixed(0);
    this.lbl.position.set(0, 3.6, 0); setLabel(this.lbl, txt);
    this.B = B; this.I = I; this.v = v;
    // 时间轴：转速 0 → 线圈不转、指针不摆（没有过程）；否则整段时间正好走 3 圈，
    // 转速越高所需时间越短（duration 变小 = 墙钟更快），改变电流/磁场能真实改变转动快慢。
    // 取 3 圈而非 2 圈：整数圈会让「拖到半程」与起点位姿完全重合，看起来像没动。
    if (mode === 'cut') this.duration = 6;
    else this.duration = n > 0 ? clamp(1800 / n, 4, 12) : 0;
  },
  step(dt) {
    if (dt > 0) this.t = Math.min((this.t || 0) + dt, this.duration || 0);
    this.renderAt(this.t || 0);
  },
  // 时间轴：转角/位移都是 t 的闭式函数，seek 直接算
  seek(t) {
    this.t = Math.min(Math.max(Number.isFinite(t) ? t : 0, 0), this.duration || 0);
    this.renderAt(this.t);
  },
  renderAt(t) {
    const mode = this.p.mode || 'motor';
    const d = Math.max(this.duration || 0, 1e-6);
    if (mode === 'cut') {
      // 导线一个往返：前半程去、后半程回
      const x = Math.sin((t / d) * Math.PI * 2);
      const mv = this.p.moveDir;
      if (mv === 'along') this.conductor.position.set(0, 1.6 + x * 0.5, 0.15);
      else if (mv === 'rev') this.conductor.position.set(-x * 2.0, 1.6, 0.15);
      else this.conductor.position.set(x * 2.0, 1.6, 0.15);
      return;
    }
    const turns = (t / d) * Math.PI * 6;          // 3 圈 = 6π
    if (mode === 'motor' && this.p.commutator === 'off') {
      this.angle = Math.sin(turns) * 0.6;          // 无换向器：在平衡位置来回摆，不持续转
      this.coilG.rotation.z = this.angle;
    } else {
      this.angle = turns; this.coilG.rotation.z = turns;
    }
  },
  reset() { this.t = 0; this.angle = 0; this.recompute(); if (this.renderAt) this.renderAt(0); },
  dispose() {},
};

/* ===================== 右侧统计面板读数 =====================
 * 返回 [{ label, value, unit }]，每场景 3~6 项；电学量随参数/播放实时变化，断路或零转速时给 0 而不是 NaN。 */
Object.assign(D1, {
  readouts() {
    const a = this.ampReading, u = this.volReading;
    return [
      rd('电源电压 U', this.p.voltage || 0, 'V'),
      rd('总电阻 R', this.Req, 'Ω', 1),
      rd('电流 I', this.I, 'A', 2),
      { label: '电流表 I_测', value: a == null || a === '—' ? '—' : Number(a).toFixed(2), unit: 'A' },
      { label: '电压表 U_测', value: u == null || u === '—' ? '—' : Number(u).toFixed(2), unit: 'V' },
      { label: '开关', value: this.p.switch === 'off' ? '断开' : '闭合', unit: '' },
    ];
  },
});
Object.assign(D2, {
  readouts() {
    return [
      rd('电阻 R', this.R, 'Ω', 2),
      rd('电流 I', this.on ? this.I : 0, 'A', 3),
      rd('长度 L', this.p.len || 0, 'cm', 0),
      rd('横截面积 S', this.p.area || 0, 'mm²', 1),
      rd('电阻率 ρ', Number(this.p.mat) || 0, 'Ω·mm²/m', 0),
      rd('温度', this.p.temp != null ? this.p.temp : 20, '℃', 0),
    ];
  },
});
Object.assign(D3, {
  readouts() {
    return [
      rd('接入电阻 R', this.R, 'Ω', 1),
      rd('电流 I', this.I, 'A', 2),
      rd('滑片位置', this.p.wiring === 'top' || this.p.wiring === 'bottom' ? 0 : (this.p.wiper != null ? this.p.wiper : 100), '%', 0),
      rd('规格', Number(this.p.rating) || 20, 'Ω', 0),
    ];
  },
});
Object.assign(D4, {
  readouts() {
    const U = this.p.voltage || 0;
    let R = Number(this.p.rfix) || 10;
    if (this.p.dut === 'bulb') R = 5 + U * 3.5;
    const I = R > 0 ? U / R : 0;
    return [
      rd('电压 U', U, 'V'),
      rd('电流 I', I, 'A', 3),
      rd('电阻 R', R, 'Ω', 1),
      rd('电功率 P', U * I, 'W', 2),
    ];
  },
});
Object.assign(D5, {
  readouts() {
    const U = this.p.voltage || 0, R = this.p.r || 20;
    return [
      rd('电功率 P', R > 0 ? U * U / R : 0, 'W', 2),
      rd('甲瓶温度', this.tA, '℃', 1),
      rd('乙瓶温度', this.tB, '℃', 1),
      rd('已通电', this.tSim, 's', 0),
      rd('通电总时长', this.duration, 's', 0),
    ];
  },
});
Object.assign(D6, {
  readouts() {
    return [
      rd('电流 I', this.p.current || 0, 'A'),
      rd('匝数 N', this.p.turns || 0, '匝', 0),
      rd('磁性强弱', this.strength, '', 0),
      { label: '磁芯', value: this.p.core === 'iron' ? '有铁芯' : '无铁芯', unit: '' },
      { label: '磁感线方向', value: this.p.dir === -1 ? '反向' : '正向', unit: '' },
    ];
  },
});
Object.assign(D7, {
  readouts() {
    return [
      rd('转速 n', this.n, 'r/min', 0),
      rd('磁感应强度 B', this.p.field || 0, 'T'),
      rd('电流 I', this.p.current || 0, 'A'),
      { label: '工作模式', value: ({ motor: '电动机', generator: '发电机', cut: '切割磁感线' }[this.p.mode || 'motor']), unit: '' },
      rd('已用时 t', this.t, 's', 2),
    ];
  },
});

export const ELECTRICITY = {
  'D1-series-parallel': D1,
  'D2-resistance-factor': D2,
  'D3-rheostat-lamp': D3,
  'D4-ohm-law': D4,
  'D5-power-joule': D5,
  'D6-magnet-solenoid': D6,
  'D7-motor-generator': D7,
};
