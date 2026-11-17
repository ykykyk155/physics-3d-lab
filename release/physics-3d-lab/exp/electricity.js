/* 电学 D1~D7 */
import { THREE, COLORS, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, mkArrow, setArrow, fatLine, setFatLine, addGround, clamp, G, rd } from './common.js';
import { MATS, matClone, registerMaterials, battery, bulb, setBulbGlow, ammeter, setMeterNeedle, resistor, magnetBar, knifeSwitch, setSwitch, beaker, calorimeter, thermometer, setThermometer } from './props.js';

const C = COLORS.electricity;
const WIRE = '#c23b3b';      // 导线皮：教学功能色红（黄只留给电流粒子，避免满屏亮黄）

function electrons(n, color) {
  const geo = new THREE.SphereGeometry(0.07, 8, 6);
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color || '#FACC15'), emissive: new THREE.Color(color || '#FACC15'), emissiveIntensity: 0.6 });
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

/* ===================== D1 串并联 ===================== */
const D1 = {
  p: {}, elec: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x3a3514);
    // 电池组（两节干电池 + 电池盒 + 正负极帽）
    this.battG = battery({ cells: 2, h: 0.5 }); this.battG.position.set(-3.2, 1.2, 0); ctx.scene.add(this.battG);
    this.batt = this.battG;
    // 两只小灯泡（玻璃泡 + 灯丝 + 螺口），灯泡坐在灯座上
    this.bulb1G = bulb({ r: 0.24 }); this.bulb1G.position.set(-0.6, 2.4, 0); ctx.scene.add(this.bulb1G);
    this.bulb2G = bulb({ r: 0.24 }); this.bulb2G.position.set(2.0, 2.4, 0); ctx.scene.add(this.bulb2G);
    this.res1 = this.bulb1G; this.res2 = this.bulb2G;
    // 闸刀开关（木座 + 铜触点 + 可转动刀片）
    this.switchG = knifeSwitch(); this.switchG.position.set(1.2, 1.0, 0.7); ctx.scene.add(this.switchG);
    // 电流表（方壳 + 圆白表盘 + 红指针 + 三接线柱）
    this.meterG = ammeter({ w: 0.66, h: 0.54 }); this.meterG.position.set(-2.35, 3.15, 0.6); ctx.scene.add(this.meterG);
    this.wires = [];
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 4.0, 0); ctx.scene.add(this.lbl);
    this.lblI = mkLabel('', '#ffe066'); ctx.scene.add(this.lblI);
    this.t = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const U = this.p.voltage || 3, r1 = this.p.r1 || 10, r2 = this.p.r2 || 20, par = this.p.mode === 'parallel';
    const on = this.p.switch !== 'off';
    let Req, I;
    if (par) { Req = (r1 * r2) / (r1 + r2); } else { Req = r1 + r2; }
    I = on ? U / Req : 0;
    this.Req = Req; this.I = I;
    if (this.ctx) this.ctx.emitReadout({ cur: I });
    // 灯泡亮度随电流：串联/并联、开关通断、电阻改变都看得见
    const bright = clamp(I * 3.0, 0, 1);
    setBulbGlow(this.bulb1G, bright);
    setBulbGlow(this.bulb2G, bright * 0.85);
    setSwitch(this.switchG, on);
    setMeterNeedle(this.meterG, clamp(I / 0.6, 0, 1));
    this.lbl.position.set(0, 4.0, 0);
    setLabel(this.lbl, (par ? '并联' : '串联') + ' R总=' + Req.toFixed(1) + 'Ω  I=' + I.toFixed(2) + 'A');
    this.lblI.position.set(3.2, 3.2, 0); setLabel(this.lblI, on ? '电流 ' + I.toFixed(2) + 'A' : '断路');
    this.buildCircuit();
  },
  buildCircuit() {
    this.wires.forEach(w => { w.geometry.dispose(); this.scene.remove(w); }); this.wires = [];
    this.elec.forEach(e => this.scene.remove(e)); this.elec = [];
    const par = this.p.mode === 'parallel';
    const y = 2.6, x0 = -3.2, x1 = 0.9, x2 = 2.0;
    let path;
    if (!par) path = [[-3.2, 1.7, 0], [-3.2, 3.2, 0], [x2 + 0.6, 3.2, 0], [x2 + 0.6, 1.2, 0], [-3.2, 1.2, 0]];
    else path = [[-3.2, 1.7, 0], [-3.2, 3.4, 0], [x2 + 0.6, 3.4, 0], [x2 + 0.6, 1.2, 0], [-3.2, 1.2, 0]];
    const pts = path.map(a => new THREE.Vector3(a[0], a[1], a[2]));
    const w = fatLine(pts, WIRE, 3); this.scene.add(w); this.wires.push(w);
    if (par) {
      const br = fatLine([new THREE.Vector3(x1, 3.4, 0), new THREE.Vector3(x1, 2.6, 0), new THREE.Vector3(x1, 1.2, 0)], WIRE, 3);
      this.scene.add(br); this.wires.push(br);
      this.bulb1G.position.set(x1, 2.5, 0); this.bulb2G.position.set(x2, 2.5, 0);
    } else {
      this.bulb1G.position.set(-0.6, 3.1, 0); this.bulb2G.position.set(x2 - 0.6, 3.1, 0);
    }
    // 电流粒子沿折线
    this.curve = new THREE.CatmullRomCurve3(pts, true);
    const n = 40;
    this.elec = [electrons(n)];
    this.elec.forEach(e => this.scene.add(e));
    this.phases = new Array(n).fill(0).map((_, i) => i / n);
  },
  step(dt) {
    if (!this.elec.length || !this.curve) return;
    this.t += dt;
    const I = this.I || 0;
    const spd = clamp(I * 0.12, 0, 0.6);
    const inst = this.elec[0];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < this.phases.length; i++) {
      const p = (this.phases[i] + this.t * spd) % 1;
      const pos = this.curve.getPointAt(p);
      m.compose(pos, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.visible = I > 0.001;
  },
  reset() { this.t = 0; this.recompute(); },
  dispose() {},
};

/* ===================== D2 电阻大小因素 ===================== */
const D2 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x3a3514);
    registerMaterials(ctx);
    // 电阻定律演示板：竖立木背板，上面并排 4 根参考电阻丝（长短粗细可辨）+ 下方待测电阻丝
    this.boardBase = box(5.2, 0.1, 1.2, MATS.woodDark()); this.boardBase.position.set(0, 0.05, 0); ctx.scene.add(this.boardBase);
    this.backBoard = box(4.6, 2.2, 0.08, MATS.woodLight()); this.backBoard.position.set(0, 1.2, -0.35); ctx.scene.add(this.backBoard);
    // 四根参考电阻丝：镍铬长 / 镍铬短 / 镍铬粗 / 锰铜，长度与粗细肉眼可辨
    const samples = [];
    const wireCol = matClone('iron');
    const refs = [
      { z: 0.1, y: 1.85, len: 2.6, r: 0.035, mat: matClone('ironDark') },
      { z: 0.1, y: 1.5, len: 1.5, r: 0.035, mat: matClone('ironDark') },
      { z: 0.1, y: 1.15, len: 2.0, r: 0.07, mat: matClone('ironDark') },
      { z: 0.1, y: 0.8, len: 2.0, r: 0.05, mat: matClone('manganin') },
    ];
    refs.forEach(rf => { const w = cyl(rf.r, rf.r, rf.len, rf.mat); w.rotation.z = Math.PI / 2; w.position.set(-0.2, rf.y, -0.28); samples.push(w); });
    ctx.scene.add(mergeByMaterial(samples));
    // 待测电阻丝（下方，长度/粗细随参数变）
    this.bar = cyl(0.06, 0.06, 4, matClone('copper')); this.bar.rotation.z = Math.PI / 2; this.bar.position.set(0, 0.55, 0.25); ctx.scene.add(this.bar);
    this.termL = cyl(0.09, 0.09, 0.22, MATS.brass()); this.termL.position.set(-2.1, 0.35, 0.25); ctx.scene.add(this.termL);
    this.termR = cyl(0.09, 0.09, 0.22, MATS.brass()); this.termR.position.set(2.1, 0.35, 0.25); ctx.scene.add(this.termR);
    this.leadL = fatLine([new THREE.Vector3(-2.6, 0.55, 0), new THREE.Vector3(-2.1, 0.35, 0.25)], WIRE, 3); ctx.scene.add(this.leadL);
    this.leadR = fatLine([new THREE.Vector3(2.1, 0.35, 0.25), new THREE.Vector3(2.6, 0.55, 0)], WIRE, 3); ctx.scene.add(this.leadR);
    // 小灯泡（显示电流大小），移到画面内
    this.bulbG = bulb({ r: 0.24 }); this.bulbG.position.set(2.6, 0.55, 0.3); ctx.scene.add(this.bulbG);
    this.bulb = this.bulbG;
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 2.9, 0); ctx.scene.add(this.lbl);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const L = (this.p.len || 50) / 100;      // m
    const S = this.p.area || 1;              // mm²
    const rho = Number(this.p.mat) || 1.1;
    const strands = this.p.strands || 1;
    const tf = 1 + (this.p.temp || 20) * 0.002;
    const R = rho * L / S / strands * tf;
    this.R = R;
    if (this.ctx) this.ctx.emitReadout({ r: R });
    const lenScale = (this.p.len || 50) / 100 * 4 / 2 + 0.2;
    this.bar.scale.set(clamp(lenScale, 0.4, 2.2), clamp(Math.sqrt(S / 4) * 0.8 + 0.4, 0.4, 1.8), clamp(Math.sqrt(S / 4) * 0.8 + 0.4, 0.4, 1.8));
    this.bar.material.color.set(new THREE.Color(rho > 0.5 ? '#b0763a' : '#d9a066'));
    const bright = clamp(1 / R * 3, 0, 1);
    setBulbGlow(this.bulbG, bright);
    this.lbl.position.set(0, 2.6, 0);
    setLabel(this.lbl, 'R = ρL/S = ' + R.toFixed(2) + ' Ω');
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
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
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#f0abfc'), emissive: new THREE.Color('#f0abfc'), emissiveIntensity: 1 }),
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
    const color = dir === -1 ? '#F0ABFC' : '#A78BFA';
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
    return [
      rd('电源电压 U', this.p.voltage || 0, 'V'),
      rd('总电阻 R', this.Req, 'Ω', 1),
      rd('电流 I', this.I, 'A', 2),
      { label: '连接方式', value: this.p.mode === 'parallel' ? '并联' : '串联', unit: '' },
      { label: '开关', value: this.p.switch === 'off' ? '断开' : '闭合', unit: '' },
    ];
  },
});
Object.assign(D2, {
  readouts() {
    return [
      rd('电阻 R', this.R, 'Ω', 2),
      rd('长度 L', this.p.len || 0, 'cm', 0),
      rd('横截面积 S', this.p.area || 0, 'mm²'),
      rd('电阻率 ρ', Number(this.p.mat) || 0, '×10⁻⁶Ω·m'),
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
