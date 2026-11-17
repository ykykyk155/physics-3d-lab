/* 声学 C1~C3 */
import { THREE, COLORS, mat, box, cyl, sphere, decor, mergeByMaterial, mkLabel, setLabel, fatLine, setFatLine, addGround, clamp } from './common.js';
import { MATS, matClone, registerMaterials, bellJar, tuningFork } from './props.js';

const C = COLORS.acoustics;
const WAVE = '#34D399';

/* ===================== C1 声音的传播（真空罩） ===================== */
const C1 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x2a3140);            // 中性地面，不给器材染色
    registerMaterials(ctx);
    // 真空罩：玻璃钟罩 + 金属底座 + 抽气阀
    this.jarG = bellJar({ r: 1.9, h: 2.8 }); ctx.scene.add(this.jarG);
    this.jar = this.jarG;
    // 音叉（钢叉 + 木座），放在罩内
    this.fork = tuningFork({ scale: 1.1 }); this.fork.position.set(0, 0.12, 0); ctx.scene.add(this.fork);
    this.ball = sphere(0.16, MATS.white()); this.ball.position.set(0.75, 1.5, 0); ctx.scene.add(this.ball);
    // 球面波壳（声学绿只留给这个数据元素；限制在罩内，不铺满画面、不涂染其他器材）
    this.shells = [];
    for (let i = 0; i < 4; i++) {
      const s = sphere(1, WAVE, { transparent: true, opacity: 0.14, depthWrite: false });
      s.position.y = 1.5; ctx.scene.add(s); this.shells.push(s);
    }
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.t = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const p = this.p.pressure != null ? this.p.pressure : 101.3;
    const dist = this.p.dist || 1;
    // 响度：满压 80dB @ 0.2m，衰减 20log10(r)，气压线性影响
    const src = 80, ref = 0.2;
    let loud = src - 20 * Math.log10(Math.max(dist, ref) / ref);
    loud *= clamp(p / 101.3, 0, 1);
    this.loud = Math.max(0, loud);
    if (this.ctx) this.ctx.emitReadout({ loud: this.loud });
    // 声速：空气按 v≈331+0.6T 随温度变（温度参数真正生效）；水/钢等介质直接取枚举值
    let v;
    if (Number(this.p.medium) === 340 || this.p.medium == null) {
      v = Math.round(331 + 0.6 * (this.p.temp != null ? this.p.temp : 15));
    } else v = Number(this.p.medium) || 340;
    this.speed = v;
    this.lbl.position.set(0, 4.9, 0);
    setLabel(this.lbl, 'v=' + v + 'm/s · 响度 ' + this.loud.toFixed(0) + 'dB' + (p < 5 ? ' · 真空不传声' : ''));
  },
  step(dt) {
    this.t += dt;
    const v = this.speed || 340;
    const p = this.p.pressure != null ? this.p.pressure : 101.3;
    const amp = clamp(p / 101.3, 0, 1) * clamp(1 / (this.p.dist || 1), 0.15, 1);
    this.shells.forEach((s, i) => {
      const phase = (this.t * v * 0.5 + i * 2.5) % 10;
      const r = 0.2 + phase * 0.4;
      // 波壳限制在真空罩内（半径 ≤1.7），不铺满画面、不给罩体/音叉/地面染色
      const rr = Math.min(r, 1.7);
      s.scale.setScalar(Math.max(0.05, rr));
      s.material.opacity = 0.22 * amp * clamp(1 - rr / 2.0, 0, 1);
    });
    // 音叉振动（整体轻微抖动）+ 乒乓球被声波推开
    const vib = Math.sin(this.t * ((this.p.freq || 512) * 0.05));
    this.fork.rotation.z = vib * 0.02;
    this.ball.position.y = 1.5 + Math.abs(vib) * 0.05 * amp * 6;
  },
  reset() { this.t = 0; this.recompute(); },
  dispose() {},
};

/* ===================== C2 声音的特性 ===================== */
const C2 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x143027);
    // 三维示波器面板
    this.panel = box(6, 3, 0.1, '#0e1f1a', { roughness: 0.6 }); this.panel.position.set(0, 2.0, -0.3); ctx.scene.add(this.panel);
    this.frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.1, 3.1, 0.02)), new THREE.LineBasicMaterial({ color: 0x2c5a4a }));
    this.frame.position.set(0, 2.0, -0.25); ctx.scene.add(this.frame);
    this.wave = fatLine(new Array(121).fill(0).map((_, i) => new THREE.Vector3(-2.8 + i * (5.6 / 120), 2.0, 0)), WAVE, 2.6);
    ctx.scene.add(this.wave);
    // 钢尺（伸出桌面长度↔ruler）与空气柱（管长↔pipe）：两件器材真实存在、随参数伸缩
    this.rulerBar = box(1, 0.05, 0.16, '#b8c6dd', { metalness: 0.5, roughness: 0.3 }); ctx.scene.add(this.rulerBar);
    this.rulerLbl = mkLabel('钢尺', '#b8c6dd'); ctx.scene.add(this.rulerLbl);
    this.pipeCyl = cyl(0.14, 0.14, 1, '#7ec8ff', { transparent: true, opacity: 0.4, metalness: 0.2 }); this.pipeCyl.rotation.z = Math.PI / 2; ctx.scene.add(this.pipeCyl);
    this.pipeLbl = mkLabel('空气柱', '#7ec8ff'); ctx.scene.add(this.pipeLbl);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.8, 0); ctx.scene.add(this.lbl);
    this.lbl2 = mkLabel('', '#9ad2ff'); this.lbl2.position.set(0, 3.45, 0); ctx.scene.add(this.lbl2);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const f = this.p.freq || 440, amp = (this.p.amp || 0) / 100;
    const lambda = 340 / f;
    if (this.ctx) this.ctx.emitReadout({ lambda: lambda });
    this.f = f; this.amp = amp;
    // 钢尺伸出长度（cm）与空气柱长度（cm）：器材真实伸缩，且各自给出对应的基频 f=v/(4L)（尺）/ v/(2L)（管）
    const rulerCm = this.p.ruler != null ? this.p.ruler : 15;
    const pipeCm = this.p.pipe != null ? this.p.pipe : 20;
    if (this.rulerBar) {
      const w = clamp(rulerCm / 15, 0.3, 2.2);
      this.rulerBar.scale.set(w, 1, 1); this.rulerBar.position.set(-3.2, 0.55, 0.6);
      this.rulerLbl.position.set(-3.2 + w * 0.5, 0.85, 0.6);
      setLabel(this.rulerLbl, '钢尺 ' + rulerCm + 'cm · f≈' + (340 / (4 * rulerCm / 100)).toFixed(0) + 'Hz');
    }
    if (this.pipeCyl) {
      const w = clamp(pipeCm / 20, 0.25, 2.0);
      this.pipeCyl.scale.set(w, 1, 1); this.pipeCyl.position.set(3.2, 0.55, 0.6);
      this.pipeLbl.position.set(3.2, 0.95, 0.6);
      setLabel(this.pipeLbl, '空气柱 ' + pipeCm + 'cm · f≈' + (340 / (2 * pipeCm / 100)).toFixed(0) + 'Hz');
    }
    this.lbl2.position.set(0, 3.45, 0);
    setLabel(this.lbl2, 'λ = v/f = ' + lambda.toFixed(3) + ' m' + (f > 20000 ? ' · 超声' : f < 20 ? ' · 次声' : ''));
  },
  step(dt) {
    if (dt <= 0) return;
    this.t = (this.t || 0) + dt;
    const f = this.f || 440, amp = this.amp || 0.6, type = this.p.wave || 'sine';
    // 横轴按频率归一：默认 440Hz 显示约 3 个完整周期，f 越大波形越密
    const cycles = clamp(f / 440 * 3, 0.7, 12);
    const N = 121, pts = [];
    for (let i = 0; i < N; i++) {
      const x = -2.8 + i * (5.6 / (N - 1));
      const ph = (i / (N - 1)) * cycles * Math.PI * 2 + this.t * 2;
      let y;
      switch (type) {
        case 'square': y = Math.sign(Math.sin(ph)); break;
        case 'saw': y = 2 * (((ph / (2 * Math.PI)) % 1) - 0.5) * 2; break;
        case 'noise': y = (Math.random() * 2 - 1); break;
        default: y = Math.sin(ph);
      }
      pts.push(new THREE.Vector3(x, 2.0 + y * amp * 1.2, 0));
    }
    setFatLine(this.wave, pts);
    setLabel(this.lbl, 'f=' + f + 'Hz · 振幅 ' + Math.round(amp * 100) + '% · 约 ' + cycles.toFixed(1) + ' 个周期');
  },
  reset() { this.t = 0; },
  dispose() {},
};

/* ===================== C3 噪声控制与回声测距 ===================== */
const C3 = {
  p: {},
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x143027);
    registerMaterials(ctx);
    // 声源：扬声器（箱体 + 喇叭纸盆）+ 支架
    this.source = new THREE.Group();
    const spkBase = cyl(0.45, 0.5, 0.12, MATS.iron()); spkBase.position.y = 0.06; this.source.add(spkBase);
    const spkPole = cyl(0.06, 0.06, 0.7, MATS.steel()); spkPole.position.y = 0.45; this.source.add(spkPole);
    const spkBox = box(0.9, 1.1, 0.7, MATS.woodDark()); spkBox.position.y = 1.35; this.source.add(spkBox);
    const cone = cyl(0.12, 0.42, 0.2, MATS.plasticDark()); cone.rotation.z = -Math.PI / 2; cone.position.set(0.55, 1.4, 0); this.source.add(cone);
    this.source.position.set(-4, 0, 0); ctx.scene.add(this.source);
    // 人耳处标记：耳廓形状（外耳轮 + 耳甲腔 + 耳垂）
    this.ear = new THREE.Group();
    const helixOuter = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 10, 28, Math.PI * 1.5), MATS.steel()); helixOuter.rotation.z = Math.PI * 0.25; helixOuter.position.set(3.2, 1.5, 0); this.ear.add(helixOuter);
    const cav = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 20), MATS.plasticDark()); cav.position.set(3.15, 1.42, 0.05); this.ear.add(cav);
    const lobe = sphere(0.09, MATS.plastic()); lobe.position.set(3.18, 1.12, 0); this.ear.add(lobe);
    this.ear.position.set(0, 0, 0); ctx.scene.add(this.ear);
    // 反射墙：墙板（带竖向分缝）
    this.wall = box(0.4, 3, 4, MATS.woodDark()); this.wall.position.set(4, 1.5, 0); ctx.scene.add(this.wall);
    const seams = [];
    for (let i = -3; i <= 3; i++) { const s = box(0.42, 3, 0.03, MATS.iron()); s.position.set(4, 1.5, i * 0.55); seams.push(s); }
    ctx.scene.add(mergeByMaterial(seams));
    this.barrier = box(0.12, 3, 3, matClone('barrierGrey')); this.barrier.material.transparent = true; this.barrier.material.opacity = 0.9; this.barrier.position.set(-1.5, 1.5, 0); ctx.scene.add(this.barrier);
    this.pulse = decor(sphere(0.18, WAVE, { emissive: WAVE, emissiveIntensity: 0.8 })); ctx.scene.add(this.pulse);
    this.pulse2 = decor(sphere(0.18, '#f0abfc', { emissive: '#f0abfc', emissiveIntensity: 0.6, transparent: true, opacity: 0.8 })); ctx.scene.add(this.pulse2);
    this.lbl = mkLabel('', C); this.lbl.position.set(0, 3.6, 0); ctx.scene.add(this.lbl);
    this.ruler = new THREE.Group(); ctx.scene.add(this.ruler);
    for (let i = 0; i <= 10; i++) { const t = decor(box(0.02, 0.02, i % 5 === 0 ? 0.4 : 0.24, '#3d6b5b')); t.position.set(-4 + i * 0.8, 0.03, 1.4); this.ruler.add(t); }
    // 控制环节高亮环：声源 / 传播路径 / 人耳处（数据元素用声学绿 #34D399，不用黄）
    this.hl = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 32), new THREE.MeshBasicMaterial({ color: 0x34D399 }));
    this.hl.rotation.x = Math.PI / 2; this.hl.visible = false; ctx.scene.add(this.hl);
    this.t = 0;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const s = this.p.range || 50, v = 340;
    const dt = 2 * s / v;
    this.echoT = dt;
    if (this.ctx) this.ctx.emitReadout({ echo: dt });
    const att = (this.p.material != null ? Number(this.p.material) : 8) * 0.4;
    this.loud = Math.max(0, (this.p.level || 60) - att);
    this.barrier.material.opacity = clamp(0.55 + (this.p.material || 8) / 60, 0.55, 0.85);
    // 控制环节：高亮环落到 声源(-4,1.2) / 传播路径(barrier -1.5) / 人耳处(墙前 3.4)
    const stage = this.p.stage || 'path';
    const stageCn = { source: '声源处（消声/减振）', path: '传播路径（隔声/吸声）', ear: '人耳处（护耳器）' }[stage];
    if (this.hl) {
      this.hl.visible = true;
      if (stage === 'source') this.hl.position.set(-4, 1.2, 0);
      else if (stage === 'ear') this.hl.position.set(3.4, 1.4, 0);
      else this.hl.position.set(-1.5, 1.5, 0);
    }
    this.lbl.position.set(0, 3.6, 0);
    setLabel(this.lbl, 's=vΔt/2 → Δt=' + dt.toFixed(3) + 's · 接收 ' + this.loud.toFixed(0) + 'dB' + (this.loud > 90 ? ' ⚠噪声' : '') + ' · 控制环节：' + stageCn);
  },
  step(dt) {
    if (dt <= 0) return;
    this.t += dt;
    const s = this.p.range || 50, v = 340;
    const T = 2 * s / v;
    const period = Math.max(T * 1.3, 0.1);
    const ph = (this.t % period) / period;
    const x0 = -4, xw = 4;
    if (ph < 0.5) {
      const u = ph / 0.5;
      this.pulse.position.set(x0 + (xw - x0) * u, 1.2, 0); this.pulse.visible = true;
      this.pulse2.visible = false;
    } else {
      const u = (ph - 0.5) / 0.5;
      this.pulse.visible = false;
      this.pulse2.position.set(xw - (xw - x0) * u, 1.2, 0); this.pulse2.visible = true;
    }
  },
  reset() { this.t = 0; this.recompute(); },
  dispose() {},
};

export const ACOUSTICS = {
  'C1-sound-medium': C1,
  'C2-sound-chars': C2,
  'C3-noise-control': C3,
};
