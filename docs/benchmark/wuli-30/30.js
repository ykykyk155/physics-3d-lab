(function () {
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const chartCanvas = document.getElementById('chartCanvas');
  const chartCtx = chartCanvas.getContext('2d');
  const CW = chartCanvas.width, CH = chartCanvas.height;

  // 物理参数
  const U_TOTAL = 6;
  const R_FIXED = 10;

  // 状态
  let rPrime = 10;
  let switchClosed = false;
  let dataPoints = [];
  let pulsePhase = 0;

  // 电路几何
  const C = {
    left: 90, right: 720, top: 90, bottom: 380
  };
  const BATTERY = { x: 400, y: 90 };
  const SWITCH = { x: 560, y: 90, w: 64 };
  const AMMETER = { x: 90, y: 235, r: 30 };
  const RES_R = { x1: 240, x2: 340, y: 380 };      // R，宽 100
  const RES_RH = { x1: 400, x2: 540, y: 380 };     // R'，宽 140
  const RH_WIRE_X = 610;                            // 滑片引线终点 x
  const VOLTMETER = { x: 290, y: 458, r: 28 };

  /* ============================================================
     工具函数
     ============================================================ */
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function calcCurrent() {
    if (!switchClosed) return 0;
    return U_TOTAL / (R_FIXED + rPrime);
  }

  function calcVoltage() {
    return calcCurrent() * R_FIXED;
  }

  // 当前滑片位置（在 R' 上的 x 坐标）
  function getSlideX() {
    const ratio = rPrime / 20;
    return RES_RH.x1 + ratio * (RES_RH.x2 - RES_RH.x1);
  }
  function getSlideTopY() {
    return RES_RH.y - 14;
  }
  function getSlideWireY() {
    return getSlideTopY() - 35;
  }

  /* ============================================================
     绘制电池
     ============================================================ */
  function drawBattery() {
    const x = BATTERY.x, y = BATTERY.y;
    ctx.save();
    ctx.fillStyle = '#eaf3fc';
    ctx.fillRect(x - 40, y - 24, 80, 48);

    // 长板（正极）
    ctx.strokeStyle = '#b13030';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 20);
    ctx.lineTo(x - 14, y + 20);
    ctx.stroke();

    // 短板（负极）
    ctx.strokeStyle = '#113955';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 10);
    ctx.lineTo(x + 12, y + 10);
    ctx.stroke();

    // 接线
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 40, y);
    ctx.lineTo(x - 14, y);
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + 40, y);
    ctx.stroke();

    // 正负号
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#b13030';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', x - 30, y);
    ctx.fillStyle = '#113955';
    ctx.fillText('−', x + 28, y);

    // 电压标注
    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.fillStyle = '#113955';
    ctx.fillText('6 V', x, y - 32);
    ctx.restore();
  }

  /* ============================================================
     绘制开关
     ============================================================ */
  function drawSwitch() {
    const cx = SWITCH.x, cy = SWITCH.y;
    const halfW = SWITCH.w / 2;

    ctx.save();
    ctx.fillStyle = '#eaf3fc';
    ctx.fillRect(cx - halfW - 10, cy - 46, SWITCH.w + 20, 60);

    ctx.beginPath();
    ctx.arc(cx - halfW, cy, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + halfW, cy, 5.5, 0, 2 * Math.PI);
    ctx.fill();

    if (switchClosed) {
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy);
      ctx.lineTo(cx + halfW, cy);
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - halfW, cy);
      ctx.lineTo(cx + halfW - 4, cy - 26);
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', cx, cy - 42);

    ctx.font = 'bold 11px system-ui, sans-serif';
    if (switchClosed) {
      ctx.fillStyle = '#1a7a4e';
      ctx.fillText('已闭合', cx, cy + 26);
    } else {
      ctx.fillStyle = '#b8860b';
      ctx.fillText('点击闭合', cx, cy + 26);
    }

    ctx.restore();
  }

  /* ============================================================
     绘制电流表（去掉"电流表"三字）
     ============================================================ */
  function drawAmmeter() {
    const x = AMMETER.x, y = AMMETER.y, r = AMMETER.r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#eaf3fc';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r - 5, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(44,62,80,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 30px "Times New Roman", Georgia, serif';
    ctx.fillStyle = switchClosed ? '#b13030' : '#2c3e50';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', x, y + 2);

    ctx.restore();
  }

  /* ============================================================
     绘制定值电阻 R
     注意：不再绘制浅蓝色背景填充，避免遮挡底部导线，
     使导线能够与电阻两端自然衔接。
     ============================================================ */
  function drawResistorR() {
    const x1 = RES_R.x1, x2 = RES_R.x2, y = RES_R.y;
    const w = x2 - x1, h = 28;

    ctx.save();

    const grad = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    grad.addColorStop(0, '#d4a373');
    grad.addColorStop(0.5, '#b5835a');
    grad.addColorStop(1, '#8a5a3a');
    ctx.fillStyle = grad;
    roundRect(ctx, x1, y - h / 2, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1 + 8, y - h / 2 + 5);
    ctx.lineTo(x2 - 8, y - h / 2 + 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 标签 R
    ctx.font = 'bold italic 18px "Times New Roman", serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('R', (x1 + x2) / 2, y - h / 2 - 6);

    // 阻值
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#b13030';
    ctx.textBaseline = 'top';
    ctx.fillText('10 Ω', (x1 + x2) / 2, y + h / 2 + 6);

    ctx.restore();
  }

  /* ============================================================
     电压表引线（从 R 两端外侧的底部导线上引出）
     ============================================================ */
  function drawVoltmeterWires() {
    ctx.save();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 竖直段位置：位于 R 两端外侧的导线上
    const leftWireX  = RES_R.x1 - 25;
    const rightWireX = RES_R.x2 + 25;

    // 左引线
    ctx.beginPath();
    ctx.moveTo(leftWireX, RES_R.y);
    ctx.lineTo(leftWireX, VOLTMETER.y);
    ctx.lineTo(VOLTMETER.x - VOLTMETER.r, VOLTMETER.y);
    ctx.stroke();

    // 右引线
    ctx.beginPath();
    ctx.moveTo(rightWireX, RES_R.y);
    ctx.lineTo(rightWireX, VOLTMETER.y);
    ctx.lineTo(VOLTMETER.x + VOLTMETER.r, VOLTMETER.y);
    ctx.stroke();

    // 接点小圆
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    ctx.arc(leftWireX, RES_R.y, 3.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightWireX, RES_R.y, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  }

  /* ============================================================
     绘制滑动变阻器 R'（背景透明，滑片可拖动）
     ============================================================ */
  function drawRheostat() {
    const x1 = RES_RH.x1, x2 = RES_RH.x2, y = RES_RH.y;
    const w = x2 - x1, h = 28;

    ctx.save();

    // 电阻主体（棕色矩形）
    const grad = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    grad.addColorStop(0, '#d4a373');
    grad.addColorStop(0.5, '#b5835a');
    grad.addColorStop(1, '#8a5a3a');
    ctx.fillStyle = grad;
    roundRect(ctx, x1, y - h / 2, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = '#5a3a20';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 高光
    ctx.beginPath();
    ctx.moveTo(x1 + 8, y - h / 2 + 5);
    ctx.lineTo(x2 - 8, y - h / 2 + 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 滑片位置
    const slideX = getSlideX();
    const slideTopY = y - h / 2;
    const wireY = getSlideWireY();

    // 滑片竖杆
    ctx.beginPath();
    ctx.moveTo(slideX, wireY);
    ctx.lineTo(slideX, slideTopY - 10);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 箭头（拖动时高亮）
    ctx.beginPath();
    ctx.moveTo(slideX, slideTopY - 1);
    ctx.lineTo(slideX - 7, slideTopY - 13);
    ctx.lineTo(slideX + 7, slideTopY - 13);
    ctx.closePath();
    ctx.fillStyle = dragging ? '#f59e0b' : '#d97706';
    ctx.fill();
    ctx.strokeStyle = '#8a4a00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 滑片引线向右下
    ctx.beginPath();
    ctx.moveTo(slideX, wireY);
    ctx.lineTo(RH_WIRE_X, wireY);
    ctx.lineTo(RH_WIRE_X, y);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // 标签 R' = 20 Ω
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText("R' = 20 Ω", (x1 + x2) / 2, y + h / 2 + 10);

    ctx.restore();
  }

  /* ============================================================
     绘制电压表（去掉"电压表"文字）
     ============================================================ */
  function drawVoltmeter() {
    const x = VOLTMETER.x, y = VOLTMETER.y, r = VOLTMETER.r;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#eaf3fc';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r - 5, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(44,62,80,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 28px "Times New Roman", Georgia, serif';
    ctx.fillStyle = switchClosed ? '#1f6fb5' : '#2c3e50';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', x, y + 2);

    ctx.restore();
  }

  /* ============================================================
     绘制导线（不含电压表引线）
     ============================================================ */
  function drawWires() {
    ctx.save();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 顶部：左上角到电池左端
    ctx.beginPath();
    ctx.moveTo(C.left, C.top);
    ctx.lineTo(BATTERY.x - 40, C.top);
    ctx.stroke();

    // 顶部：电池右端到开关左端
    ctx.beginPath();
    ctx.moveTo(BATTERY.x + 40, C.top);
    ctx.lineTo(SWITCH.x - SWITCH.w / 2, C.top);
    ctx.stroke();

    // 顶部：开关右端到右上角
    ctx.beginPath();
    ctx.moveTo(SWITCH.x + SWITCH.w / 2, C.top);
    ctx.lineTo(C.right, C.top);
    ctx.stroke();

    // 右侧：右上角到右下角（完整）
    ctx.beginPath();
    ctx.moveTo(C.right, C.top);
    ctx.lineTo(C.right, C.bottom);
    ctx.stroke();

    // 底部：右下角到滑片引线落地处
    ctx.beginPath();
    ctx.moveTo(C.right, C.bottom);
    ctx.lineTo(RH_WIRE_X, C.bottom);
    ctx.stroke();

    // 底部：R 右端到 R' 左端
    ctx.beginPath();
    ctx.moveTo(RES_R.x2, C.bottom);
    ctx.lineTo(RES_RH.x1, C.bottom);
    ctx.stroke();

    // 底部：R 左端到左下角
    ctx.beginPath();
    ctx.moveTo(RES_R.x1, C.bottom);
    ctx.lineTo(C.left, C.bottom);
    ctx.stroke();

    // 左侧：左下角到电流表下方
    ctx.beginPath();
    ctx.moveTo(C.left, C.bottom);
    ctx.lineTo(C.left, AMMETER.y + AMMETER.r);
    ctx.stroke();

    // 左侧：电流表上方到左上角
    ctx.beginPath();
    ctx.moveTo(C.left, AMMETER.y - AMMETER.r);
    ctx.lineTo(C.left, C.top);
    ctx.stroke();

    ctx.restore();
  }

  /* ============================================================
     电流流动动画
     ============================================================ */
  function drawCurrentFlow() {
    const I = calcCurrent();
    if (I <= 0) return;

    const slideX = getSlideX();
    const wireY = getSlideWireY();

    const path = [
      { x: BATTERY.x - 40, y: C.top },
      { x: C.left, y: C.top },
      { x: C.left, y: AMMETER.y - AMMETER.r },
      { x: C.left, y: AMMETER.y + AMMETER.r },
      { x: C.left, y: C.bottom },
      { x: RES_R.x1, y: C.bottom },
      { x: RES_R.x2, y: C.bottom },
      { x: RES_RH.x1, y: C.bottom },
      { x: slideX, y: C.bottom },
      { x: slideX, y: wireY },
      { x: RH_WIRE_X, y: wireY },
      { x: RH_WIRE_X, y: C.bottom },
      { x: C.right, y: C.bottom },
      { x: C.right, y: C.top },
      { x: SWITCH.x + SWITCH.w / 2, y: C.top },
      { x: SWITCH.x - SWITCH.w / 2, y: C.top },
      { x: BATTERY.x + 40, y: C.top }
    ];

    let totalLen = 0;
    const segs = [];
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i + 1].x - path[i].x;
      const dy = path[i + 1].y - path[i].y;
      const len = Math.hypot(dx, dy);
      segs.push({ from: path[i], to: path[i + 1], len: len });
      totalLen += len;
    }

    const speed = 0.0006 + Math.min(I, 0.6) * 0.0008;
    const offset = (pulsePhase * speed * 6) % 1;

    const dotSpacing = 55;
    const numDots = Math.floor(totalLen / dotSpacing);
    const dotSize = 3 + Math.min(I, 0.6) * 4;

    ctx.save();
    ctx.fillStyle = '#ffd166';
    ctx.shadowColor = '#ffb020';
    ctx.shadowBlur = 8;

    for (let i = 0; i < numDots; i++) {
      const t = ((i / numDots) + offset) % 1;
      let dist = t * totalLen;
      for (let s = 0; s < segs.length; s++) {
        if (dist <= segs[s].len) {
          const lt = dist / segs[s].len;
          const px = segs[s].from.x + (segs[s].to.x - segs[s].from.x) * lt;
          const py = segs[s].from.y + (segs[s].to.y - segs[s].from.y) * lt;
          ctx.beginPath();
          ctx.arc(px, py, dotSize, 0, 2 * Math.PI);
          ctx.fill();
          break;
        }
        dist -= segs[s].len;
      }
    }

    ctx.restore();
  }

  /* ============================================================
     主绘制
     ============================================================ */
  function draw() {
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#eaf3fc');
    bg.addColorStop(1, '#dfeaf5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚡ 探究电流与电压的关系', 20, 18);

    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#5b7298';
    ctx.fillText('电源 6 V · 定值电阻 R = 10 Ω（保持不变）', 20, 42);

    if (switchClosed) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#1a7a4e';
      ctx.fillText('✓ 电路已闭合', 20, 64);
    } else {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#b8860b';
      ctx.fillText('⚠️ 电路断开，请点击开关 S 闭合', 20, 64);
    }

    drawWires();
    drawBattery();
    drawSwitch();
    drawAmmeter();
    drawResistorR();
    drawVoltmeterWires();
    drawRheostat();
    drawVoltmeter();
    drawCurrentFlow();

    // 右上角显示当前的 I 和 U
    const I = calcCurrent();
    const U = calcVoltage();
    ctx.save();
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    if (switchClosed) {
      ctx.fillText('I = ' + I.toFixed(3) + ' A', W - 20, 18);
      ctx.fillText('U = ' + U.toFixed(2) + ' V', W - 20, 40);
    } else {
      ctx.fillStyle = '#b0b8c0';
      ctx.fillText('I = — — —', W - 20, 18);
      ctx.fillText('U = — — —', W - 20, 40);
    }
    ctx.restore();
  }

  /* ============================================================
     I-U 图像绘制
     ============================================================ */
  function drawChart() {
    const c = chartCtx;
    c.clearRect(0, 0, CW, CH);

    c.fillStyle = '#fbfeff';
    c.fillRect(0, 0, CW, CH);

    const pad = { top: 24, right: 20, bottom: 40, left: 52 };
    const gW = CW - pad.left - pad.right;
    const gH = CH - pad.top - pad.bottom;

    const Umax = 7;
    const Imax = 0.7;

    c.strokeStyle = '#e8eff6';
    c.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const x = pad.left + (i / Umax) * gW;
      c.beginPath();
      c.moveTo(x, pad.top);
      c.lineTo(x, pad.top + gH);
      c.stroke();
    }
    for (let i = 1; i <= 7; i++) {
      const y = pad.top + gH - (i / 7) * gH;
      c.beginPath();
      c.moveTo(pad.left, y);
      c.lineTo(pad.left + gW, y);
      c.stroke();
    }

    c.strokeStyle = '#2c3e50';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pad.left, pad.top);
    c.lineTo(pad.left, pad.top + gH);
    c.lineTo(pad.left + gW, pad.top + gH);
    c.stroke();

    c.beginPath();
    c.moveTo(pad.left - 5, pad.top + 6);
    c.lineTo(pad.left, pad.top);
    c.lineTo(pad.left + 5, pad.top + 6);
    c.stroke();

    c.beginPath();
    c.moveTo(pad.left + gW - 6, pad.top + gH - 5);
    c.lineTo(pad.left + gW, pad.top + gH);
    c.lineTo(pad.left + gW - 6, pad.top + gH + 5);
    c.stroke();

    c.font = '11px "Courier New", monospace';
    c.fillStyle = '#4a6280';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    for (let i = 1; i <= 6; i++) {
      const x = pad.left + (i / Umax) * gW;
      c.beginPath();
      c.moveTo(x, pad.top + gH);
      c.lineTo(x, pad.top + gH + 4);
      c.strokeStyle = '#2c3e50';
      c.stroke();
      c.fillText(i, x, pad.top + gH + 7);
    }

    c.textAlign = 'right';
    c.textBaseline = 'middle';
    for (let i = 1; i <= 6; i++) {
      const v = i * 0.1;
      const y = pad.top + gH - (v / Imax) * gH;
      c.beginPath();
      c.moveTo(pad.left, y);
      c.lineTo(pad.left - 4, y);
      c.strokeStyle = '#2c3e50';
      c.stroke();
      c.fillText(v.toFixed(1), pad.left - 7, y);
    }

    // 轴标签（已修正 I / A 位置，避免超出画布）
    c.font = 'bold 12px system-ui, sans-serif';
    c.fillStyle = '#113955';
    c.textAlign = 'right';
    c.textBaseline = 'top';
    c.fillText('I / A', pad.left - 8, pad.top - 18);           // 修正：贴近纵轴，避免左侧被裁切
    c.fillText('U / V', pad.left + gW - 20, pad.top + gH + 18);

    c.textAlign = 'right';
    c.textBaseline = 'top';
    c.fillText('0', pad.left - 6, pad.top + gH + 4);

    for (let i = 0; i < dataPoints.length; i++) {
      const p = dataPoints[i];
      const x = pad.left + (p.U / Umax) * gW;
      const y = pad.top + gH - (p.I / Imax) * gH;
      c.beginPath();
      c.arc(x, y, 5, 0, 2 * Math.PI);
      c.fillStyle = '#d97706';
      c.fill();
      c.strokeStyle = '#8a4a00';
      c.lineWidth = 1.5;
      c.stroke();
      c.font = 'bold 10px system-ui, sans-serif';
      c.fillStyle = '#ffffff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(String(i + 1), x, y + 0.5);
    }

    if (dataPoints.length >= 2) {
      const sorted = dataPoints.slice().sort(function (a, b) { return a.U - b.U; });
      c.beginPath();
      for (let i = 0; i < sorted.length; i++) {
        const p = sorted[i];
        const x = pad.left + (p.U / Umax) * gW;
        const y = pad.top + gH - (p.I / Imax) * gH;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.strokeStyle = 'rgba(217,119,6,0.55)';
      c.lineWidth = 2;
      c.setLineDash([5, 4]);
      c.stroke();
      c.setLineDash([]);
    }

    c.beginPath();
    const x0 = pad.left;
    const y0 = pad.top + gH;
    const xEnd = pad.left + (6 / Umax) * gW;
    const yEnd = pad.top + gH - (0.6 / Imax) * gH;
    c.moveTo(x0, y0);
    c.lineTo(xEnd, yEnd);
    c.strokeStyle = 'rgba(31,111,181,0.35)';
    c.lineWidth = 2;
    c.setLineDash([4, 4]);
    c.stroke();
    c.setLineDash([]);
  }

  /* ============================================================
     动画循环
     ============================================================ */
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    pulsePhase += dt;
    draw();
    requestAnimationFrame(loop);
  }

  /* ============================================================
     交互：拖动画片 + 点击开关
     ============================================================ */
  let dragging = false;
  let dragOffsetX = 0;

  function getPointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  // 判断指针是否在滑片（竖杆 + 箭头）热区内
  function isNearSliderHandle(px, py) {
    const slideX = getSlideX();
    const wireY = getSlideWireY();
    const slideTopY = getSlideTopY();
    return Math.abs(px - slideX) < 20 && py > wireY - 18 && py < slideTopY + 12;
  }

  // 根据画布 x 坐标更新滑动变阻器阻值（0.5 Ω 步进）
  function updateRPrimeFromX(x) {
    const ratio = (x - RES_RH.x1) / (RES_RH.x2 - RES_RH.x1);
    let v = Math.max(0, Math.min(1, ratio)) * 20;
    v = Math.round(v * 2) / 2;
    rPrime = v;
    rPrimeSlider.value = v;
    rPrimeValue.textContent = v.toFixed(1) + ' Ω';
    updateUI();
  }

  canvas.addEventListener('pointerdown', function (e) {
    const p = getPointerPos(e);

    // 优先判断滑片拖动
    if (isNearSliderHandle(p.x, p.y)) {
      dragging = true;
      dragOffsetX = p.x - getSlideX();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // 开关点击
    if (Math.hypot(p.x - SWITCH.x, p.y - SWITCH.y) < 60) {
      switchClosed = !switchClosed;
      updateUI();
    }
  });

  canvas.addEventListener('pointermove', function (e) {
    const p = getPointerPos(e);

    if (dragging) {
      updateRPrimeFromX(p.x - dragOffsetX);
      e.preventDefault();
    } else {
      canvas.style.cursor = isNearSliderHandle(p.x, p.y) ? 'grab' : 'pointer';
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = 'pointer';
    if (e && e.pointerId != null) {
      try {
        if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function (e) {
    if (!dragging) canvas.style.cursor = 'pointer';
  });

  /* ============================================================
     UI 更新
     ============================================================ */
  const voltageValue = document.getElementById('voltageValue');
  const currentValue = document.getElementById('currentValue');
  const hintBar = document.getElementById('hintBar');
  const recordBtn = document.getElementById('recordBtn');

  function updateUI() {
    const I = calcCurrent();
    const U = calcVoltage();

    if (switchClosed) {
      voltageValue.innerHTML = U.toFixed(2) + '<small>V</small>';
      voltageValue.style.color = '#1f6fb5';
      currentValue.innerHTML = I.toFixed(3) + '<small>A</small>';
      currentValue.style.color = '#b13030';
      recordBtn.disabled = false;
      hintBar.innerHTML =
        '✓ 电路已闭合。当前 <b>U = ' + U.toFixed(2) +
        ' V</b>，<b>I = ' + I.toFixed(3) +
        ' A</b>。拖动滑片或滑块改变电压，点击「📝 记录数据」把数据记入表格。';
    } else {
      voltageValue.innerHTML = '— — —';
      voltageValue.style.color = '#b0b8c0';
      currentValue.innerHTML = '— — —';
      currentValue.style.color = '#b0b8c0';
      recordBtn.disabled = true;
      hintBar.innerHTML =
        '💡 点击电路中的<b>开关 S</b>闭合电路，然后拖动<b>滑片</b>或上方滑块改变滑动变阻器阻值，观察电流表和电压表读数。';
    }
  }

  /* ============================================================
     滑块
     ============================================================ */
  const rPrimeSlider = document.getElementById('rPrimeSlider');
  const rPrimeValue = document.getElementById('rPrimeValue');

  rPrimeSlider.addEventListener('input', function () {
    rPrime = parseFloat(this.value);
    rPrimeValue.textContent = rPrime.toFixed(1) + ' Ω';
    updateUI();
  });

  /* ============================================================
     记录数据
     ============================================================ */
  function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    if (dataPoints.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">暂无数据，请闭合开关后点击「记录数据」</td></tr>';
      return;
    }
    for (let i = 0; i < dataPoints.length; i++) {
      const p = dataPoints[i];
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + (i + 1) + '</td>' +
        '<td>' + p.U.toFixed(2) + '</td>' +
        '<td>' + p.I.toFixed(3) + '</td>';
      tbody.appendChild(tr);
    }
  }

  recordBtn.addEventListener('click', function () {
    if (!switchClosed) return;
    const I = calcCurrent();
    const U = calcVoltage();
    dataPoints.push({ U: U, I: I });
    renderTable();
    drawChart();
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    dataPoints = [];
    renderTable();
    drawChart();
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    rPrime = 10;
    rPrimeSlider.value = 10;
    rPrimeValue.textContent = '10.0 Ω';
    switchClosed = false;
    dataPoints = [];
    renderTable();
    drawChart();
    updateUI();
  });

  /* ============================================================
     实验说明弹窗
     ============================================================ */
  (function initInfoModal() {
    var modal = document.getElementById('infoModal');
    var btn = document.getElementById('infoBtn');
    var close = document.getElementById('infoClose');
    if (!modal || !btn || !close) return;

    function openModal() {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    btn.addEventListener('click', openModal);
    close.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.keyCode === 27) && modal.classList.contains('active')) {
        closeModal();
      }
    });
  })();

  /* ============================================================
     交互式新手教程
     ============================================================ */
  (function initTour() {
    var STEPS = [
      {
        title: '欢迎使用电流与电压关系仿真',
        content: '这是一个可交互的仿真实验。跟着这几步，快速了解如何操作吧！',
        target: null
      },
      {
        title: '认识电路',
        content: '这是包含电源、开关、电流表、定值电阻 R、滑动变阻器 R\' 和电压表的串联电路。电压表并联在 R 两端。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '闭合开关',
        content: '点击电路中的开关 S 使电路闭合。只有闭合后电路才有电流，电表才有示数。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '调节滑动变阻器',
        content: '直接拖动滑动变阻器上的滑片箭头，或拖动下方滑块，改变接入电路的阻值，R 两端的电压随之改变。',
        target: '.slider-panel',
        placement: 'bottom'
      },
      {
        title: '观察电表读数',
        content: '上方数据卡片实时显示 R 两端的电压 U 和通过它的电流 I。电压增大时，电流也按比例增大。',
        target: '.data-panel',
        placement: 'top'
      },
      {
        title: '记录多组数据',
        content: '点击「📝 记录数据」，把当前 (U, I) 记入表格并自动描点画图。至少记录 5 组数据。',
        target: '#recordBtn',
        placement: 'top'
      },
      {
        title: '观察 I-U 图像',
        content: '观察右下角的 I-U 图像，所有数据点是不是落在一条过原点的直线上——这说明电流与电压成正比。',
        target: '.chart-panel',
        placement: 'top'
      },
      {
        title: '开始探索吧！',
        content: '点击右上角「ℹ️ 实验说明」查看实验原理与结论，点击「❓ 使用帮助」可随时重新打开本教程。',
        target: null
      }
    ];

    var currentStep = 0;
    var overlay = document.getElementById('tourOverlay');
    var highlight = document.getElementById('tourHighlight');
    var tip = document.getElementById('tourTip');
    var stepEl = document.getElementById('tourStep');
    var titleEl = document.getElementById('tourTitle');
    var contentEl = document.getElementById('tourContent');
    var prevBtn = document.getElementById('tourPrev');
    var nextBtn = document.getElementById('tourNext');
    var skipBtn = document.getElementById('tourSkip');
    if (!overlay || !highlight || !tip) return;

    function showStep(index) {
      var step = STEPS[index];
      if (!step) return;

      stepEl.textContent = '步骤 ' + (index + 1) + ' / ' + STEPS.length;
      titleEl.textContent = step.title;
      contentEl.textContent = step.content;

      if (!step.target) {
        highlight.style.display = 'none';
        tip.classList.add('centered');
        tip.style.left = '';
        tip.style.top = '';
        tip.style.visibility = 'visible';
      } else {
        var target = document.querySelector(step.target);
        if (!target) {
          if (index < STEPS.length - 1) {
            currentStep = index + 1;
            showStep(currentStep);
          } else {
            endTour();
          }
          return;
        }

        try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}

        setTimeout(function () {
          var rect = target.getBoundingClientRect();
          var pad = 10;

          highlight.style.display = 'block';
          highlight.style.top = (rect.top - pad) + 'px';
          highlight.style.left = (rect.left - pad) + 'px';
          highlight.style.width = (rect.width + pad * 2) + 'px';
          highlight.style.height = (rect.height + pad * 2) + 'px';

          tip.classList.remove('centered');
          tip.style.visibility = 'hidden';
          tip.style.left = '-9999px';
          tip.style.top = '-9999px';

          requestAnimationFrame(function () {
            var tipW = tip.offsetWidth;
            var tipH = tip.offsetHeight;
            var placement = step.placement || 'bottom';
            var tLeft, tTop;

            if (placement === 'top') {
              tLeft = rect.left + rect.width / 2 - tipW / 2;
              tTop = rect.top - tipH - 18;
            } else if (placement === 'bottom') {
              tLeft = rect.left + rect.width / 2 - tipW / 2;
              tTop = rect.bottom + 18;
            } else if (placement === 'left') {
              tLeft = rect.left - tipW - 18;
              tTop = rect.top + rect.height / 2 - tipH / 2;
            } else {
              tLeft = rect.right + 18;
              tTop = rect.top + rect.height / 2 - tipH / 2;
            }

            var margin = 12;
            if (tLeft < margin) tLeft = margin;
            if (tLeft + tipW > window.innerWidth - margin) tLeft = window.innerWidth - tipW - margin;
            if (tTop < margin) tTop = margin;
            if (tTop + tipH > window.innerHeight - margin) tTop = window.innerHeight - tipH - margin;

            tip.style.left = tLeft + 'px';
            tip.style.top = tTop + 'px';
            tip.style.visibility = 'visible';
          });
        }, 320);
      }

      prevBtn.style.display = index === 0 ? 'none' : 'inline-block';
      nextBtn.textContent = index === STEPS.length - 1 ? '完成' : '下一步';
    }

    function startTour() {
      currentStep = 0;
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      showStep(0);
    }

    function endTour() {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      try { localStorage.setItem('tour_i_u_done', '1'); } catch (e) {}
    }

    function nextStep() {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        showStep(currentStep);
      } else {
        endTour();
      }
    }

    function prevStep() {
      if (currentStep > 0) {
        currentStep--;
        showStep(currentStep);
      }
    }

    nextBtn.addEventListener('click', nextStep);
    prevBtn.addEventListener('click', prevStep);
    skipBtn.addEventListener('click', endTour);

    var helpBtn = document.getElementById('helpBtn');
    if (helpBtn) helpBtn.addEventListener('click', startTour);

    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape' || e.keyCode === 27) endTour();
      else if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
    });

    window.addEventListener('resize', function () {
      if (overlay.classList.contains('active')) showStep(currentStep);
    });

    var firstVisit = true;
    try { firstVisit = !localStorage.getItem('tour_i_u_done'); } catch (e) {}
    if (firstVisit) {
      setTimeout(startTour, 700);
    }
  })();
  updateUI();
  renderTable();
  drawChart();
  requestAnimationFrame(loop);
})();