/* 光学 B1~B5 */
import { THREE, COLORS, DEG, mat, box, cyl, sphere, torus, decor, mergeByMaterial, mkLabel, setLabel, fatLine, setFatLine, addGround, clamp, G, rd } from './common.js';
import { MATS, matClone, registerMaterials, lens as mkLens, setLensAperture, screen as mkScreen, candle, opticalRail, railRider, planeMirror, laser, glassTank, testTube } from './props.js';

const C = COLORS.optics;
const RAY = '#A78BFA';
const RAY2 = '#F0ABFC';

function clearRays(list) { list.forEach(r => { r.geometry && r.geometry.dispose(); r.parent && r.parent.remove(r); }); list.length = 0; }

/* ===================== B1 小孔成像 ===================== */
const B1 = {
  p: {}, rays: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x2a2340);
    // 物：真实蜡烛（蜡身 + 火焰），小孔成像的发光物
    this.candle = cyl(0.22, 0.24, 1.6, MATS.candleWax()); ctx.scene.add(this.candle);
    this.flame = sphere(0.2, matClone('flame')); ctx.scene.add(this.flame);
    this.barrier = box(0.08, 2.4, 2.4, '#2f2a45'); ctx.scene.add(this.barrier);
    // 小孔：用可见光圈表现「孔形」与「孔径」，孔径越大像越亮但越模糊（几何光学的近似示意）
    this.aperture = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.aperture.position.set(0.05, 1.2, 0); ctx.scene.add(this.aperture);
    this.screen = box(0.06, 2.6, 2.6, '#d8d2ef', { roughness: 0.9 }); ctx.scene.add(this.screen);
    this.img = box(0.04, 1, 0.4, '#ffcf6b', { emissive: '#ff9d00', emissiveIntensity: 0.4 }); ctx.scene.add(this.img);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.k = 0.055;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  buildAperture() {
    const shape = this.p.shape || 'circle';
    const d = (this.p.hole || 2) / 10;              // mm→cm
    const r = clamp(d * 0.12, 0.06, 0.34);          // 孔径→光圈半径（世界单位）
    this.aperture.geometry.dispose();
    if (shape === 'square') this.aperture.geometry = new THREE.PlaneGeometry(r * 1.8, r * 1.8);
    else if (shape === 'triangle') this.aperture.geometry = new THREE.CircleGeometry(r, 3);
    else this.aperture.geometry = new THREE.CircleGeometry(r, 32);
    // 孔越大进光越多→像越亮但越弥散（用不透明度近似亮度，像的清晰度用半径体现）
    this.aperture.material.opacity = clamp(0.55 + d * 0.12, 0.55, 0.95);
    this.blurFactor = clamp(d * 0.05, 0.01, 0.4);   // 孔径越大像越模糊/亮
  },
  recompute() {
    if (!this.aperture.geometry || this._shape !== (this.p.shape || 'circle') || this._hole !== this.p.hole) {
      this._shape = this.p.shape || 'circle'; this._hole = this.p.hole; this.buildAperture();
    }
    const u = this.p.objDist || 20, vD = this.p.screenDist || 20, d = (this.p.hole || 2) / 10; // mm→cm
    const objH = 1.6; // 世界单位
    const ih = objH * vD / u;
    this.ih = ih;
    if (this.ctx) this.ctx.emitReadout({ imgH: ih / 1.6 * 10 });   // 折算 cm 显示
    const xc = -u * this.k, xs = vD * this.k;
    this.candle.position.set(xc - 0.3, 0.8, 0);
    this.flame.position.set(xc - 0.3, 1.7, 0);
    this.barrier.position.set(0, 1.2, 0);
    this.screen.position.set(xs + 0.1, 1.2, 0);
    this.img.scale.set(1, ih, 1);
    this.img.position.set(xs + 0.02, 0.8 + (1.6 - ih) / 2 - 0.0, 0);
    this.img.position.y = 0.8 + 1.6 - ih / 2 - 0.8; // 倒立靠下
    this.img.position.y = 1.6 - ih / 2;             // 顶端对齐轴上
    // 光线：从物顶/底穿过小孔到屏
    clearRays(this.rays);
    const holeY = 1.2;
    const top = new THREE.Vector3(xc - 0.3, 1.7, 0);
    const bot = new THREE.Vector3(xc - 0.3, 0.0, 0);
    const hit = new THREE.Vector3(0, holeY, 0);
    const rayTopEnd = new THREE.Vector3(xs + 0.05, holeY - (1.7 - holeY) / Math.max(u, 1) * vD, 0);
    const rayBotEnd = new THREE.Vector3(xs + 0.05, holeY + (holeY - 0.0) / Math.max(u, 1) * vD, 0);
    this.rays.push(fatLine([top, hit, rayTopEnd], RAY, 2.2));
    this.rays.push(fatLine([bot, hit, rayBotEnd], RAY2, 2.2));
    // 孔越大→空气越亮但越弥散：像的不透明度随孔径亮度上调、尺寸略放大
    if (this.aperture) this.aperture.position.set(0.05, holeY, 0);
    const dmm = this.p.hole || 2;
    this.img.material.opacity = clamp(0.35 + dmm * 0.06, 0.35, 0.95);
    this.img.scale.set(1 + clamp(dmm * 0.03, 0, 0.6), ih, 1);
    this.rays.forEach(r => this.scene.add(r));
    this.lbl.position.set(0, 3.0, 0);
    const shapeCn = { circle: '圆', square: '方', triangle: '三角' }[this.p.shape || 'circle'];
    setLabel(this.lbl, '像高=物高×v/u=' + ih.toFixed(2) + ' · 孔 ' + shapeCn + ' d=' + dmm + 'mm' + (dmm > 5 ? '（像变亮变模糊）' : ''));
  },
  step() {},
  reset() { this.recompute(); },
  dispose() { clearRays(this.rays); },
};

/* ===================== B2 光的反射 ===================== */
const B2 = {
  p: {}, rays: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x2a2340);
    // 平面镜（玻璃 + 镀银层 + 黑框）
    this.mirrorG = planeMirror({ w: 3.4, h: 0.9 });
    this.mirrorG.rotation.x = -Math.PI / 2; this.mirrorG.position.y = 0.05; ctx.scene.add(this.mirrorG);
    this.mirror = this.mirrorG;
    this.normal = fatLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 3, 0)], '#7b8aa3', 2, { dashed: true }); ctx.scene.add(this.normal);
    // 可折转白色光屏：左右两半，右半能向后折（三线共面的证据）
    this.screenL = box(2.0, 0.03, 1.6, MATS.white()); this.screenL.position.set(-1.0, 0.03, -0.8); ctx.scene.add(this.screenL);
    this.screenR = box(2.0, 0.03, 1.6, MATS.white());
    this.screenR.position.set(1.0, 0.03, -0.8); ctx.scene.add(this.screenR);
    this.half = this.screenR;
    // 激光笔（射向镜面）
    this.laserG = laser(); this.laserG.position.set(-2.6, 2.2, 0); this.laserG.rotation.z = -0.7; ctx.scene.add(this.laserG);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.lblI = mkLabel('i', '#c4b5fd'); ctx.scene.add(this.lblI);
    this.lblR = mkLabel('r', '#f0abfc'); ctx.scene.add(this.lblR);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const i = (this.p.incidence || 0) * DEG;
    if (this.ctx) this.ctx.emitReadout({ refl: this.p.incidence || 0 });
    clearRays(this.rays);
    const O = new THREE.Vector3(0, 0.05, 0);
    const inDir = new THREE.Vector3(Math.sin(i), -Math.cos(i), 0);   // 从左上射入
    const start = O.clone().addScaledVector(inDir, -3.2);
    const reflDir = new THREE.Vector3(Math.sin(i), Math.cos(i), 0);
    const end = O.clone().addScaledVector(reflDir, 3.2);
    this.rays.push(fatLine([start, O], RAY, 2.6));  // 入射
    const showRefl = true;
    if (showRefl) this.rays.push(fatLine([O, end], RAY2, 2.6));
    // 漫反射：多条
    if (this.p.kind === 'diffuse') {
      for (let j = -3; j <= 3; j++) {
        const a2 = i + j * 0.18;
        const rd = new THREE.Vector3(Math.sin(a2), Math.cos(a2), 0);
        this.rays.push(fatLine([O, O.clone().addScaledVector(rd, 2.2)], '#8b7bd8', 1.6, { opacity: 0.7 }));
      }
    }
    this.rays.forEach(r => this.scene.add(r));
    // 可折转光屏：右半绕接缝（x=0）向后折
    const fold = (this.p.plane || 0) * DEG;
    if (this.screenR) {
      this.screenR.position.set(1.0 * Math.cos(fold), 0.03, -0.8 - Math.sin(fold) * 1.0);
      this.screenR.rotation.x = fold;
    }
    this.lblI.position.copy(start).add(new THREE.Vector3(0.25, 0.15, 0)); setLabel(this.lblI, 'i=' + (this.p.incidence||0) + '°');
    this.lblR.position.copy(end).add(new THREE.Vector3(0.25, 0.15, 0)); setLabel(this.lblR, 'r=' + (this.p.incidence||0) + '°');
    this.lbl.position.set(0, 3.4, 0);
    setLabel(this.lbl, 'r = i = ' + (this.p.incidence||0) + '°' + (this.p.kind === 'diffuse' ? ' · 漫反射' : ''));
  },
  step() {},
  reset() { this.recompute(); },
  dispose() { clearRays(this.rays); },
};

/* ===================== B3 平面镜成像 ===================== */
const B3 = {
  p: {}, rays: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x2a2340);
    this.mirrorG = new THREE.Group(); ctx.scene.add(this.mirrorG);
    // 平面镜：玻璃 + 镀银层
    this.mirror = planeMirror({ w: 1.6, h: 2.6 });
    this.mirror.rotation.y = Math.PI / 2; this.mirror.position.y = 1.4;
    this.mirrorG.add(this.mirror);
    // 物：真实蜡烛（含火焰）
    this.candleG = candle({ h: 0.9 }); this.candleG.position.set(-0.4, 0.06, 0); ctx.scene.add(this.candleG);
    this.obj = this.candleG;
    // 虚像（半透明蜡烛）
    this.img = candle({ h: 0.9 }); this.img.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.35; o.material.depthWrite = false; } });
    ctx.scene.add(this.img);
    // 镜后替代蜡烛
    this.alt = candle({ h: 0.7 }); this.alt.visible = false; ctx.scene.add(this.alt);
    this.altLbl = mkLabel('', '#ff9d3d'); ctx.scene.add(this.altLbl);
    this.screen = box(0.05, 2, 2, '#8f9bb3'); this.screen.visible = false; ctx.scene.add(this.screen);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const u = (this.p.objDist || 8) / 100 * 6;  // cm→世界
    const tilt = (this.p.tilt != null ? this.p.tilt : 90) * DEG;
    if (this.ctx) this.ctx.emitReadout({ imgDist: this.p.objDist || 8 });
    this.mirrorG.rotation.y = (90 - (this.p.tilt != null ? this.p.tilt : 90)) * DEG;
    this.obj.position.set(-u, 0.06, 0);
    this.img.position.set(u, 0.06, 0);
    this.img.visible = true;
    this.screen.visible = this.p.screen === 'on';
    this.screen.position.set(u, 1.0, 0.0);
    // 镜后替代蜡烛：高度按「物高 5cm ↔ 当前蜡烛世界高度」线性换算（原式 /10*1.2 把 5cm 算成半高，
    // 默认参数下会显示「像比物大」，与「等大虚像」这一教学点冲突）
    const objH = (this.obj.userData && this.obj.userData.h) || 0.9;
    const altH = (this.p.altHeight || 5) / 5 * objH;
    this.alt.visible = true; this.alt.scale.set(1, altH / 0.7, 1);
    this.alt.position.set(u + 0.5, 0.06, 0);
    this.altLbl.position.set(u + 0.5, altH + 0.3, 0);
    const match = Math.abs(altH - objH) < 0.06;
    setLabel(this.altLbl, '替代蜡烛 ' + (this.p.altHeight || 5) + 'cm' + (match ? '（与像等高✓）' : ''));
    this.lbl.position.set(0, 3.2, 0);
    setLabel(this.lbl, '物距=像距=' + (this.p.objDist || 8) + 'cm · 等大虚像');
  },
  step() {},
  reset() { this.recompute(); },
  dispose() {},
};

/* ===================== B4 折射与全反射 ===================== */
const B4 = {
  p: {}, rays: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    addGround(ctx.scene, 0x2a2340);
    // 玻璃水槽：水面在 y=0，下方是水（分层：淡青玻璃壁 + 分层蓝水体）
    this.iface = box(8, 0.02, 8, matClone('waterBlue')); this.iface.position.y = 0.01; this.iface.castShadow = false; ctx.scene.add(this.iface);
    this.lower = box(8, 3, 8, matClone('waterBlue')); this.lower.position.y = -1.5; this.lower.castShadow = false; ctx.scene.add(this.lower);
    // 水体透明度：材质默认 0.55，顶面+前面两层叠加后水下物体只剩 ~20%，
    // 密→疏（水射向空气）时光源沉在水里，会淡到看不见。这里单独调清到 0.30。
    this.iface.material.opacity = 0.30; this.lower.material.opacity = 0.30;
    // 槽壁（四片淡青玻璃，透明度 0.28）
    const walls = [];
    const wm = matClone('glassTube'); wm.opacity = 0.28;
    [-1, 1].forEach(s => {
      const w = box(8, 3, 0.04, wm); w.position.set(0, -1.5, s * 4); walls.push(w);
      const e = box(0.04, 3, 8, wm); e.position.set(s * 4, -1.5, 0); walls.push(e);
    });
    ctx.scene.add(mergeByMaterial(walls));
    this.normal = fatLine([new THREE.Vector3(0, -3.2, 0), new THREE.Vector3(0, 3.2, 0)], '#7b8aa3', 2, { dashed: true }); ctx.scene.add(this.normal);
    // 激光笔（光源）；密→疏时光笔沉在水里，深色小件在蓝水里几乎看不见，
    // 另给出光口加一个自发光点，标清「光是从这里出来的」。
    this.laserG = laser(); this.laserG.scale.setScalar(1.5); ctx.scene.add(this.laserG);
    this.laserTip = sphere(0.1, mat('#ff5a5a', { emissive: '#ff3b3b', emissiveIntensity: 1.8 })); ctx.scene.add(this.laserTip);
    this.lblLaser = mkLabel('激光笔', '#ff8a8a'); ctx.scene.add(this.lblLaser);
    // 三种生活情景的道具（scene 参数切换显隐）：筷子、鱼、光纤
    this.chop = new THREE.Group();
    const stick = cyl(0.05, 0.05, 3.4, '#d9a066', { roughness: 0.6 }); stick.rotation.z = Math.PI / 2.6; this.chop.add(stick);
    this.chop.position.set(-1.2, 1.2, 0); this.chop.visible = false; ctx.scene.add(this.chop);
    this.fish = new THREE.Group();
    const fb = sphere(0.28, '#f0a58a', { roughness: 0.5 }); fb.scale.set(1.6, 0.8, 0.7);
    const ft = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 3), mat('#f0a58a')); ft.rotation.z = Math.PI / 2; ft.position.x = -0.5;
    this.fish.add(fb, ft); this.fish.position.set(-1.6, -1.2, 0); this.fish.visible = false; ctx.scene.add(this.fish);
    this.fiber = new THREE.Group();
    const tube = cyl(0.12, 0.12, 5.5, '#7ec8ff', { transparent: true, opacity: 0.4, metalness: 0.3 }); tube.rotation.z = Math.PI / 2; this.fiber.add(tube);
    this.fiber.position.set(0, 1.0, 0); this.fiber.visible = false; ctx.scene.add(this.fiber);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.lblI = mkLabel('', '#c4b5fd'); ctx.scene.add(this.lblI);
    this.lblR = mkLabel('', '#f0abfc'); ctx.scene.add(this.lblR);
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  pairN() {
    const pr = this.p.pair || 'air-water';
    if (pr === 'air-water') return { n1: 1.0, n2: 1.33, denseFirst: false };
    if (pr === 'air-glass') return { n1: 1.0, n2: 1.5, denseFirst: false };
    if (pr === 'water-air') return { n1: 1.33, n2: 1.0, denseFirst: true };
    return { n1: 1.5, n2: 1.0, denseFirst: true };
  },
  recompute() {
    const { n1, n2, denseFirst } = this.pairN();
    const i = (this.p.incidence || 0) * DEG;
    const sinR = n1 * Math.sin(i) / n2;
    const crit = Math.asin(clamp(n2 / n1, -1, 1)) / DEG;
    let rDeg, tir = false;
    if (sinR > 1) { tir = true; rDeg = null; } else { rDeg = Math.asin(sinR) / DEG; }
    this.crit = crit; this.tir = tir;
    if (this.ctx) this.ctx.emitReadout({ refr: tir ? '全反射' : rDeg });
    clearRays(this.rays);
    const O = new THREE.Vector3(0, 0, 0);
    // 光行进方向的竖直分量：疏→密（空气→水）向下 = -1；密→疏（水→空气）向上 = +1。
    // 密→疏才存在临界角，此时光必须从界面下方射上来，否则画面会变成「光从空气射入水」却标着 48.8° 临界角。
    const up = denseFirst ? 1 : -1;
    const inDir = new THREE.Vector3(Math.sin(i), up * Math.cos(i), 0);
    const start = O.clone().addScaledVector(inDir, -2.4);   // 入射段不宜过长：密→疏时激光笔会沉到水底看不见
    this.rays.push(fatLine([start, O], RAY, 2.8));
    if (this.laserG) {
      this.laserG.position.copy(start).addScaledVector(inDir, -0.02);
      this.laserG.rotation.z = Math.atan2(inDir.y, inDir.x);
    }
    if (this.laserTip) this.laserTip.position.copy(start);
    if (!tir) {
      const r = rDeg * DEG;
      // 折射光继续朝同侧前进：疏→密折向法线，密→疏远离法线
      const rdir = new THREE.Vector3(Math.sin(r), up * Math.cos(r), 0);
      this.rays.push(fatLine([O, O.clone().addScaledVector(rdir, 3.2)], RAY, 2.8));
    } else {
      // 全反射：折回入射一侧
      const rdir = new THREE.Vector3(Math.sin(i), -up * Math.cos(i), 0);
      this.rays.push(fatLine([O, O.clone().addScaledVector(rdir, 3.2)], '#f0abfc', 2.8));
    }
    this.rays.forEach(r => this.scene.add(r));
    // 情景切换：激光(默认) / 筷子 / 叉鱼 / 光纤——切到对应情景显示道具、并调整说明
    const scene = this.p.scene || 'laser';
    if (this.chop) this.chop.visible = scene === 'chopstick';
    if (this.fish) { this.fish.visible = scene === 'fish'; if (scene === 'fish') { this.fish.position.set(-1.6, -1.2, 0); } }
    if (this.fiber) this.fiber.visible = scene === 'fiber';
    this.lblI.position.copy(start).lerp(O, 0.55).add(new THREE.Vector3(0.32, 0.05, 0));   // 标在入射段中段，别压在光源上
    setLabel(this.lblI, 'i=' + (this.p.incidence || 0) + '°');
    if (this.lblLaser) this.lblLaser.position.copy(start).add(new THREE.Vector3(-0.15, -0.42, 0));
    this.lblR.position.set(1.4, up > 0 ? 1.6 : -1.6, 0);   // 出射线在哪一侧，标注就跟到哪一侧
    setLabel(this.lblR, tir ? '全反射 (临界角 ' + crit.toFixed(1) + '°)' : 'r=' + rDeg.toFixed(1) + '°');
    this.lbl.position.set(0, 3.4, 0);
    const sceneCn = { laser: '激光穿界面', chopstick: '筷子在水中折断', fish: '叉鱼瞄低（视深）', fiber: '光纤全反射' }[scene] || '';
    setLabel(this.lbl, 'n₁sin i = n₂sin r · n₁=' + n1 + ' n₂=' + n2 + ' · ' + sceneCn);
  },
  step() {},
  reset() { this.recompute(); },
  dispose() { clearRays(this.rays); },
};

/* ===================== B5 凸透镜成像 ===================== */
const B5 = {
  p: {}, rays: [],
  build(ctx) {
    this.scene = ctx.scene; this.ctx = ctx;
    registerMaterials(ctx);
    addGround(ctx.scene, 0x2a2340);
    // 光具座：钢导轨 + 刻度，蜡烛/透镜/光屏都坐在滑块上（真实光具座）
    this.rail = opticalRail({ len: 8.2 }); this.rail.position.set(0, 0, 0); ctx.scene.add(this.rail);
    // 凸透镜：双凸玻璃镜片 + 黄铜镜框 + 支架（光心对齐主轴 y=1.2）
    this.lensG = mkLens({ r: 0.42, thickness: 0.14, centerY: 1.11 });
    this.lens = this.lensG;
    this.lens.position.set(0, 0.09, 0); ctx.scene.add(this.lensG);
    // 光屏：白屏 + 木框 + 支架（放在像的位置）
    this.screenG = mkScreen({ w: 0.95, h: 1.4 });
    this.screen = this.screenG;
    this.screen.position.set(0, 0.09, 0); ctx.scene.add(this.screenG);
    this.axis = fatLine([new THREE.Vector3(-6, 1.62, 0), new THREE.Vector3(6, 1.62, 0)], '#5b6b85', 1.5, { dashed: true }); ctx.scene.add(this.axis);
    this.obj = box(0.16, 1, 0.16, '#ffd479', { emissive: '#ffb020', emissiveIntensity: 0.4 }); ctx.scene.add(this.obj);
    // 光源形状：F 形 / 蜡烛 / 箭头——三种都是真实器材，切换时整件替换
    this.srcShape = new THREE.Group(); ctx.scene.add(this.srcShape);
    // F 形发光板（光具座标配件）：一块带 F 形缝的发光面
    this.srcF = new THREE.Group();
    const fPlate = box(0.46, 0.62, 0.03, '#3a3348', { roughness: 0.7 });
    fPlate.position.y = 0.31;
    const fRiser = box(0.04, 0.30, 0.04, MATS.steel()); fRiser.position.y = -0.12;
    this.srcF.add(fPlate, fRiser);
    const fParts = [];
    const stemF = box(0.06, 0.42, 0.012, mat('#ffd479', { emissive: '#ffb020', emissiveIntensity: 1.2 }));
    stemF.position.set(-0.06, 0.31, 0.022); fParts.push(stemF);
    const fTop = box(0.22, 0.06, 0.012, mat('#ffd479', { emissive: '#ffb020', emissiveIntensity: 1.2 }));
    fTop.position.set(0.04, 0.48, 0.022); fParts.push(fTop);
    const fMid = box(0.15, 0.05, 0.012, mat('#ffd479', { emissive: '#ffb020', emissiveIntensity: 1.2 }));
    fMid.position.set(0.01, 0.34, 0.022); fParts.push(fMid);
    this.srcF.add(mergeByMaterial(fParts));
    // 蜡烛（真实蜡烛 + 火焰）
    this.srcCandle = new THREE.Group();
    this.candle = candle({ h: 0.62 });
    this.srcCandle.add(this.candle);
    // 箭头形发光板
    this.srcArrow = new THREE.Group();
    const aPlate = box(0.46, 0.62, 0.03, '#3a3348', { roughness: 0.7 }); aPlate.position.y = 0.31;
    const aRiser = box(0.04, 0.30, 0.04, MATS.steel()); aRiser.position.y = -0.12;
    this.srcArrow.add(aPlate, aRiser);
    const aParts = [];
    const aStem = box(0.055, 0.38, 0.012, mat('#ffd479', { emissive: '#ffb020', emissiveIntensity: 1.2 }));
    aStem.position.set(0, 0.26, 0.022); aParts.push(aStem);
    const aHead = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 3), mat('#ffd479', { emissive: '#ffb020', emissiveIntensity: 1.2 }));
    aHead.position.set(0, 0.51, 0.022); aHead.rotation.y = Math.PI; aParts.push(aHead);
    this.srcArrow.add(mergeByMaterial(aParts));
    this.srcShape.add(this.srcF, this.srcCandle, this.srcArrow);
    // 遮半透镜：一块遮板，盖住透镜上半（cover=half 时显示）
    this.coverPlate = box(0.05, 0.62, 1.4, '#22283a', { roughness: 0.8 }); this.coverPlate.visible = false; ctx.scene.add(this.coverPlate);
    this.img = box(0.14, 1, 0.14, '#ffcf6b', { transparent: true, opacity: 0.7, emissive: '#ff9d00', emissiveIntensity: 0.3 }); ctx.scene.add(this.img);
    this.marks = new THREE.Group(); ctx.scene.add(this.marks);
    this.lbl = mkLabel('', C); ctx.scene.add(this.lbl);
    this.k = 0.07;
  },
  onParam(k, v) { this.p[k] = v; this.recompute(); },
  recompute() {
    const f = this.p.focal || 10, u = this.p.objDist || 30;
    const ap = (this.p.aperture || 6) / 6;
    setLensAperture(this.lensG, ap);
    const inv = 1 / f - 1 / u;
    let vD, real = true;
    if (Math.abs(inv) < 1e-6) { vD = Infinity; real = false; }
    else { vD = 1 / inv; if (vD < 0) real = false; }
    this.vD = vD; this.real = real;
    if (this.ctx) this.ctx.emitReadout({ imgDist: isFinite(vD) ? vD : '平行光不成像' });
    const k = this.k, xo = -u * k, xi = isFinite(vD) ? vD * k : 6;
    // 光屏立在像的位置（实像落在光屏上，虚像时光屏退到一旁）
    if (this.screenG) this.screenG.position.set(real && isFinite(vD) ? xi : 6, 0.09, 0);
    const objH = 1.0, imgH = isFinite(vD) ? objH * Math.abs(vD) / u : 0;
    // 光源形状切换：F 形/蜡烛/箭头，让 source 参数真实改变可见物
    const src = this.p.source || 'F';
    if (this.srcShape) {
      this.srcF.visible = src === 'F'; this.srcCandle.visible = src === 'candle'; this.srcArrow.visible = src === 'arrow';
      this.srcShape.position.set(xo, 1.2, 0);
      this.obj.visible = false;               // 用形状代替原来的方块
    }
    // 遮半透镜：盖住透镜上半 → 像变暗但完整（进光量减半）
    const half = this.p.cover === 'half';
    if (this.coverPlate) { this.coverPlate.visible = half; this.coverPlate.position.set(0, 1.2 + ap * 0.31 + 0.1, 0); }
    const dim = half ? 0.42 : 1.0;
    if (isFinite(vD) && real) {
      this.img.visible = true; this.img.scale.set(1, imgH, 1);
      this.img.position.set(xi, 1.2 - imgH / 2, 0);
      this.img.material.opacity = 0.75 * dim;
    } else if (isFinite(vD) && !real) {
      this.img.visible = true; this.img.scale.set(1, imgH, 1);
      this.img.position.set(xi, 1.2 + imgH / 2, 0);
      this.img.material.opacity = 0.28 * dim;
    } else { this.img.visible = false; }
    // 焦点标记
    this.marks.clear();
    [-2 * f, -f, f, 2 * f].forEach(m => {
      const l = box(0.04, 0.3, 0.04, m === f || m === -f ? '#f0abfc' : '#7b8aa3');
      l.position.set(m * k, 1.2, 0); this.marks.add(l);
    });
    clearRays(this.rays);
    const topY = 1.2 + objH;
    const top = new THREE.Vector3(xo, topY, 0);
    const O = new THREE.Vector3(0, 1.2, 0);
    // 平行主轴光线 → 过焦点
    if (isFinite(vD)) {
      const imgTop = new THREE.Vector3(xi, this.img.position.y + (real ? imgH / 2 : -imgH / 2) * 0 + (real ? -imgH / 2 : imgH / 2), 0);
      const iy = this.img.position.y;
      this.rays.push(fatLine([new THREE.Vector3(xo, topY, 0), new THREE.Vector3(0, topY, 0), new THREE.Vector3(xi, iy, 0)], RAY, 2.2));
      this.rays.push(fatLine([new THREE.Vector3(xo, topY, 0), new THREE.Vector3(0, 1.2, 0)], RAY2, 2.2));
      this.rays.push(fatLine([new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(xi, iy, 0)], RAY2, 2.2));
      this.rays.push(fatLine([new THREE.Vector3(xo, topY, 0), new THREE.Vector3(0, topY, 0), new THREE.Vector3(xi, iy, 0)], RAY, 0));
    } else {
      this.rays.push(fatLine([new THREE.Vector3(xo, topY, 0), new THREE.Vector3(0, topY, 0), new THREE.Vector3(6, topY, 0)], RAY, 2.2));
    }
    this.rays = this.rays.filter(r => r.material && r.material.linewidth > 0);
    this.rays.forEach(r => this.scene.add(r));
    this.lbl.position.set(0, 3.0, 0);
    setLabel(this.lbl, isFinite(vD) ? '1/v+1/u=1/f → v=' + vD.toFixed(1) + 'cm ' + (real ? '实像' : '虚像') : 'u=f 平行光不成像');
  },
  step() {},
  reset() { this.recompute(); },
  dispose() { clearRays(this.rays); },
};

/* ===================== 右侧统计面板读数 =====================
 * 返回 [{ label, value, unit }]，每场景 3~6 项；光学多为静态量，随参数变化、播放中保持不变。 */
Object.assign(B1, {
  readouts() {
    return [
      rd('物距 u', this.p.objDist || 0, 'cm', 0),
      rd('像距 v', this.p.screenDist || 0, 'cm', 0),
      rd('像高', (this.ih || 0) / 1.6 * 10, 'cm'),
      rd('孔径 d', this.p.hole || 0, 'mm', 0),
      { label: '孔形', value: ({ circle: '圆形', square: '方形', triangle: '三角形' }[this.p.shape || 'circle']), unit: '' },
    ];
  },
});
Object.assign(B2, {
  readouts() {
    return [
      rd('入射角 i', this.p.incidence || 0, '°', 0),
      rd('反射角 r', this.p.incidence || 0, '°', 0),
      rd('光屏折转', this.p.plane || 0, '°', 0),
      { label: '反射类型', value: this.p.kind === 'diffuse' ? '漫反射' : '镜面反射', unit: '' },
    ];
  },
});
Object.assign(B3, {
  readouts() {
    const objH = (this.obj && this.obj.userData && this.obj.userData.h) || 0.9;
    const altH = (this.p.altHeight || 5) / 5 * objH;
    return [
      rd('物距', this.p.objDist || 0, 'cm', 0),
      rd('像距', this.p.objDist || 0, 'cm', 0),
      rd('替代蜡烛高', this.p.altHeight || 0, 'cm', 0),
      { label: '与像等高', value: Math.abs(altH - objH) < 0.06 ? '是' : '否', unit: '' },
      { label: '像的性质', value: '正立等大虚像', unit: '' },
    ];
  },
});
Object.assign(B4, {
  readouts() {
    const { n1, n2 } = this.pairN ? this.pairN() : { n1: 1, n2: 1.33 };
    const i = this.p.incidence || 0;
    let rVal = '—';
    if (!this.tir) {
      const s = n1 * Math.sin(i * DEG) / n2;
      rVal = Math.asin(clamp(s, -1, 1)) / DEG;
    }
    return [
      rd('入射角 i', i, '°', 0),
      { label: '折射角 r', value: this.tir ? '全反射' : rd('', rVal, '', 1).value, unit: this.tir ? '' : '°' },
      rd('临界角 C', n1 > n2 ? this.crit : '—', n1 > n2 ? '°' : '', 1),
      rd('入射侧 n₁', n1, '', 2),
      rd('折射侧 n₂', n2, '', 2),
    ];
  },
});
Object.assign(B5, {
  readouts() {
    const f = this.p.focal || 0, u = this.p.objDist || 0;
    const vD = this.vD;
    const mag = (isFinite(vD) && u) ? Math.abs(vD) / u : 0;
    return [
      rd('焦距 f', f, 'cm', 0),
      rd('物距 u', u, 'cm', 0),
      { label: '像距 v', value: isFinite(vD) ? rd('', vD, '', 1).value : '平行光不成像', unit: isFinite(vD) ? 'cm' : '' },
      rd('放大率 m', mag, '×', 2),
      { label: '像的性质', value: !isFinite(vD) ? '不成像' : (this.real ? '倒立实像' : '正立虚像'), unit: '' },
    ];
  },
});

export const OPTICS = {
  'B1-pinhole': B1,
  'B2-reflection': B2,
  'B3-plane-mirror': B3,
  'B4-refraction': B4,
  'B5-convex-lens': B5,
};
