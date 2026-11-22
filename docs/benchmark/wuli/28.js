(function () {
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const U = 6;

  // 三组灯泡规格
  const BULB_SETS = [
    { n1: 'L₁', n2: 'L₂', sub1: '₁', sub2: '₂', R1: 10, R2: 20 },
    { n1: 'L₃', n2: 'L₄', sub1: '₃', sub2: '₄', R1: 8, R2: 22 },
    { n1: 'L₅', n2: 'L₆', sub1: '₅', sub2: '₆', R1: 5,  R2: 25 }
  ];
  let bulbSetIdx = 0;

  function getSet() { return BULB_SETS[bulbSetIdx]; }

  function calcVoltages() {
    const s = getSet();
    const I = U / (s.R1 + s.R2);
    return {
      U1s: I * s.R1,
      U2s: I * s.R2,
      U1p: U,
      U2p: U
    };
  }

  const LAMP_R = 22;
  const VM_R = 22;
  const WIRE_EXT = 50;

  let currentMode = 'series';
  let selectedComponent = null;
  let measured = { series: {}, parallel: {} };
  let pulsePhase = 0;

  const SERIES = {
    left: 130, right: 670, top: 190, bottom: 480,
    L1: { x: 280, y: 190, r: LAMP_R },
    L2: { x: 520, y: 190, r: LAMP_R },
    BAT: { x: 400, y: 480, w: 90, h: 50 }
  };

  const PARALLEL = {
    left: 150, right: 650,
    top: 170, mid: 310, bottom: 460,
    L1: { x: 400, y: 170, r: LAMP_R },
    L2: { x: 400, y: 310, r: LAMP_R },
    BAT: { x: 400, y: 460, w: 90, h: 50 }
  };

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

  // ============================================================
  // 灯泡
  // ============================================================
  function drawLamp(cx, cy, r, label, isSelected) {
    ctx.save();

    if (isSelected) {
      const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 9 + pulse * 2, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 180, 80, 0.35)';
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = isSelected ? '#d97706' : '#2c3e50';
    ctx.lineWidth = isSelected ? 3.5 : 2.8;
    ctx.stroke();

    const xd = r * 0.55;
    ctx.beginPath();
    ctx.moveTo(cx - xd, cy - xd);
    ctx.lineTo(cx + xd, cy + xd);
    ctx.moveTo(cx + xd, cy - xd);
    ctx.lineTo(cx - xd, cy + xd);
    ctx.strokeStyle = isSelected ? '#d97706' : '#2c3e50';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = isSelected ? '#d97706' : '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, cx, cy - r - 6);

    ctx.restore();
  }

  // ============================================================
  // 电压表
  // ============================================================
  function drawVoltmeter(cx, cy, r) {
    ctx.save();

    const pulse = 0.5 + Math.sin(pulsePhase * 1.2) * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8 + pulse * 3, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(217, 119, 6, 0.28)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold ' + Math.round(r * 1.15) + 'px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#d97706';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('V', cx, cy + 2);

    ctx.restore();
  }

  // ============================================================
  // 电压表引线（П 形）
  // ============================================================
  function drawVoltmeterWires(elemLeftX, elemRightX, elemY, vmX, vmY, vmR) {
    const vmLeftX = vmX - vmR;
    const vmRightX = vmX + vmR;

    ctx.save();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(vmLeftX, vmY);
    ctx.lineTo(elemLeftX, vmY);
    ctx.lineTo(elemLeftX, elemY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(vmRightX, vmY);
    ctx.lineTo(elemRightX, vmY);
    ctx.lineTo(elemRightX, elemY);
    ctx.stroke();

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(elemLeftX, elemY, 4.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(elemRightX, elemY, 4.5, 0, 2 * Math.PI);
    ctx.fill();

    ctx.restore();
  }

  // ============================================================
  // 电源
  // ============================================================
  function drawBattery(cx, cy, w, h, label, isSelected) {
    ctx.save();

    if (isSelected) {
      const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
      ctx.fillStyle = 'rgba(255, 180, 80, ' + (0.2 + pulse * 0.15) + ')';
      ctx.fillRect(cx - w/2 - 12, cy - h/2 - 12, w + 24, h + 24);
    }

    ctx.fillStyle = '#eaf3fc';
    ctx.fillRect(cx - w/2 - 10, cy - h/2 - 8, w + 20, h + 16);

    ctx.beginPath();
    ctx.moveTo(cx - 14, cy - h/2);
    ctx.lineTo(cx - 14, cy + h/2);
    ctx.strokeStyle = isSelected ? '#d97706' : '#2c3e50';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - h/2 + 10);
    ctx.lineTo(cx + 10, cy + h/2 - 10);
    ctx.strokeStyle = isSelected ? '#d97706' : '#2c3e50';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - w/2 - 10, cy);
    ctx.lineTo(cx - 14, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + w/2 + 10, cy);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = isSelected ? '#d97706' : '#b13030';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', cx - 28, cy);
    ctx.fillStyle = isSelected ? '#d97706' : '#113955';
    ctx.fillText('−', cx + 24, cy);

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = isSelected ? '#d97706' : '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, cx, cy - h/2 - 14);

    ctx.restore();
  }

  // ============================================================
  // 串联电路
  // ============================================================
  function drawSeries() {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(SERIES.left, SERIES.top);
    ctx.lineTo(SERIES.right, SERIES.top);
    ctx.moveTo(SERIES.right, SERIES.top);
    ctx.lineTo(SERIES.right, SERIES.bottom);
    ctx.moveTo(SERIES.right, SERIES.bottom);
    ctx.lineTo(SERIES.left, SERIES.bottom);
    ctx.moveTo(SERIES.left, SERIES.bottom);
    ctx.lineTo(SERIES.left, SERIES.top);
    ctx.stroke();

    const s = getSet();
    drawLamp(SERIES.L1.x, SERIES.L1.y, SERIES.L1.r, s.n1,
             selectedComponent === 'L1');
    drawLamp(SERIES.L2.x, SERIES.L2.y, SERIES.L2.r, s.n2,
             selectedComponent === 'L2');
    drawBattery(SERIES.BAT.x, SERIES.BAT.y, SERIES.BAT.w, SERIES.BAT.h,
                '电源 6V', selectedComponent === 'BAT');

    if (selectedComponent === 'L1') {
      const vmX = SERIES.L1.x, vmY = 90;
      drawVoltmeterWires(SERIES.L1.x - WIRE_EXT, SERIES.L1.x + WIRE_EXT,
                         SERIES.L1.y, vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    } else if (selectedComponent === 'L2') {
      const vmX = SERIES.L2.x, vmY = 90;
      drawVoltmeterWires(SERIES.L2.x - WIRE_EXT, SERIES.L2.x + WIRE_EXT,
                         SERIES.L2.y, vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    } else if (selectedComponent === 'BAT') {
      const vmX = SERIES.BAT.x, vmY = 365;
      drawVoltmeterWires(SERIES.BAT.x - SERIES.BAT.w/2,
                         SERIES.BAT.x + SERIES.BAT.w/2,
                         SERIES.BAT.y,
                         vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    }
  }

  // ============================================================
  // 并联电路
  // ============================================================
  function drawParallel() {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(PARALLEL.left, PARALLEL.top);
    ctx.lineTo(PARALLEL.right, PARALLEL.top);
    ctx.moveTo(PARALLEL.left, PARALLEL.mid);
    ctx.lineTo(PARALLEL.right, PARALLEL.mid);
    ctx.moveTo(PARALLEL.left, PARALLEL.bottom);
    ctx.lineTo(PARALLEL.right, PARALLEL.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(PARALLEL.left, PARALLEL.top);
    ctx.lineTo(PARALLEL.left, PARALLEL.bottom);
    ctx.moveTo(PARALLEL.right, PARALLEL.top);
    ctx.lineTo(PARALLEL.right, PARALLEL.bottom);
    ctx.stroke();

    const s = getSet();
    drawLamp(PARALLEL.L1.x, PARALLEL.L1.y, PARALLEL.L1.r, s.n1,
             selectedComponent === 'L1');
    drawLamp(PARALLEL.L2.x, PARALLEL.L2.y, PARALLEL.L2.r, s.n2,
             selectedComponent === 'L2');
    drawBattery(PARALLEL.BAT.x, PARALLEL.BAT.y, PARALLEL.BAT.w, PARALLEL.BAT.h,
                '电源 6V', selectedComponent === 'BAT');

    if (selectedComponent === 'L1') {
      const vmX = 400, vmY = 80;
      drawVoltmeterWires(PARALLEL.L1.x - WIRE_EXT,
                         PARALLEL.L1.x + WIRE_EXT,
                         PARALLEL.L1.y, vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    } else if (selectedComponent === 'L2') {
      const vmX = 400, vmY = 225;
      drawVoltmeterWires(PARALLEL.L2.x - WIRE_EXT,
                         PARALLEL.L2.x + WIRE_EXT,
                         PARALLEL.L2.y, vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    } else if (selectedComponent === 'BAT') {
      const vmX = 400, vmY = 370;
      drawVoltmeterWires(PARALLEL.BAT.x - PARALLEL.BAT.w/2,
                         PARALLEL.BAT.x + PARALLEL.BAT.w/2,
                         PARALLEL.BAT.y,
                         vmX, vmY, VM_R);
      drawVoltmeter(vmX, vmY, VM_R);
    }
  }

  // ============================================================
  // 电压表读数面板
  // ============================================================
  function drawVoltmeterPanel() {
    const panelW = 200, panelH = 88;
    const panelX = W - panelW - 20;
    const panelY = 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = selectedComponent ? '#d97706' : '#c8dcec';
    ctx.lineWidth = 2;
    roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillStyle = '#5b7298';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('电压表读数', panelX + 14, panelY + 12);

    const s = getSet();
    let targetLabel = '点击元件测量';
    if (selectedComponent === 'L1') targetLabel = s.n1 + ' 两端电压';
    else if (selectedComponent === 'L2') targetLabel = s.n2 + ' 两端电压';
    else if (selectedComponent === 'BAT') targetLabel = '电源两端电压';

    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = '#7a8595';
    ctx.fillText(targetLabel, panelX + 14, panelY + 30);

    let voltage = null;
    if (selectedComponent) {
      voltage = measured[currentMode][selectedComponent];
    }

    if (voltage !== null && voltage !== undefined) {
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillStyle = '#b13030';
      ctx.fillText(voltage.toFixed(1), panelX + 14, panelY + 50);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#b13030';
      ctx.fillText('V', panelX + 14 + 66, panelY + 62);
    } else {
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.fillStyle = '#b0b8c0';
      ctx.fillText('— — —', panelX + 14, panelY + 50);
    }
  }

  // ============================================================
  // 主绘制
  // ============================================================
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
    ctx.fillText(
      currentMode === 'series' ? '🔗 串联电路' : '⫽ 并联电路',
      20, 18
    );

    const s = getSet();
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#5b7298';
    ctx.fillText(
      '当前灯泡：' + s.n1 + ' = ' + s.R1 + ' Ω ，' + s.n2 + ' = ' + s.R2 + ' Ω',
      20, 42
    );

    if (currentMode === 'series') {
      drawSeries();
    } else {
      drawParallel();
    }

    drawVoltmeterPanel();
  }

  // ============================================================
  // 动画循环
  // ============================================================
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    pulsePhase += dt * 4;
    draw();
    requestAnimationFrame(loop);
  }

  // ============================================================
  // 点击处理
  // ============================================================
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    if (currentMode === 'series') {
      if (Math.hypot(x - SERIES.L1.x, y - SERIES.L1.y) < SERIES.L1.r + 18) {
        selectComponent('L1'); return;
      }
      if (Math.hypot(x - SERIES.L2.x, y - SERIES.L2.y) < SERIES.L2.r + 18) {
        selectComponent('L2'); return;
      }
      if (Math.hypot(x - SERIES.BAT.x, y - SERIES.BAT.y) < 60) {
        selectComponent('BAT'); return;
      }
    } else {
      if (Math.hypot(x - PARALLEL.L1.x, y - PARALLEL.L1.y) < PARALLEL.L1.r + 18) {
        selectComponent('L1'); return;
      }
      if (Math.hypot(x - PARALLEL.L2.x, y - PARALLEL.L2.y) < PARALLEL.L2.r + 18) {
        selectComponent('L2'); return;
      }
      if (Math.hypot(x - PARALLEL.BAT.x, y - PARALLEL.BAT.y) < 60) {
        selectComponent('BAT'); return;
      }
    }
  }

  function selectComponent(comp) {
    selectedComponent = comp;
    const v = calcVoltages();

    let voltage;
    if (currentMode === 'series') {
      if (comp === 'L1') voltage = v.U1s;
      else if (comp === 'L2') voltage = v.U2s;
      else if (comp === 'BAT') voltage = U;
    } else {
      if (comp === 'L1') voltage = v.U1p;
      else if (comp === 'L2') voltage = v.U2p;
      else if (comp === 'BAT') voltage = U;
    }

    measured[currentMode][comp] = voltage;
    updateDataPanel();
    checkAllMeasured();
  }

  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    handleCanvasClick(e);
  }, { passive: false });

  // ============================================================
  // 数据面板
  // ============================================================
  function updateDataPanel() {
    const panel = document.getElementById('dataPanel');
    panel.innerHTML = '';
    const s = getSet();

    if (currentMode === 'series') {
      const items = [
        { key: 'L1', label: s.n1, desc: s.n1 + ' 两端电压' },
        { key: 'L2', label: s.n2, desc: s.n2 + ' 两端电压' },
        { key: 'BAT', label: 'U', desc: '电源电压' }
      ];
      items.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'data-card' + (selectedComponent === item.key ? ' active' : '');
        const reading = measured.series[item.key];
        card.innerHTML =
          '<div class="dot-name">' + item.label + '</div>' +
          '<div class="position">' + item.desc + '</div>' +
          '<div class="reading">' + (reading !== undefined ? reading.toFixed(1) + ' <span>V</span>' : '— — —') + '</div>';
        panel.appendChild(card);
      });
    } else {
      const items = [
        { key: 'L1', label: 'U' + s.sub1, desc: s.n1 + ' 两端电压' },
        { key: 'L2', label: 'U' + s.sub2, desc: s.n2 + ' 两端电压' },
        { key: 'BAT', label: 'U', desc: '电源电压' }
      ];
      items.forEach(function (item) {
        const card = document.createElement('div');
        card.className = 'data-card' + (selectedComponent === item.key ? ' active' : '');
        const reading = measured.parallel[item.key];
        card.innerHTML =
          '<div class="dot-name">' + item.label + '</div>' +
          '<div class="position">' + item.desc + '</div>' +
          '<div class="reading">' + (reading !== undefined ? reading.toFixed(1) + ' <span>V</span>' : '— — —') + '</div>';
        panel.appendChild(card);
      });
    }
  }

  function checkAllMeasured() {
    if (currentMode === 'series') {
      return ['L1', 'L2', 'BAT'].every(function (k) {
        return measured.series[k] !== undefined;
      });
    } else {
      return ['L1', 'L2', 'BAT'].every(function (k) {
        return measured.parallel[k] !== undefined;
      });
    }
  }

  function showResult() {
    const panel = document.getElementById('resultPanel');
    const line = document.getElementById('resultLine');
    const conclusion = document.getElementById('resultConclusion');
    const s = getSet();

    if (currentMode === 'series') {
      line.innerHTML =
        'U(' + s.n1 + ') = ' + measured.series.L1.toFixed(1) + ' V &nbsp; ' +
        'U(' + s.n2 + ') = ' + measured.series.L2.toFixed(1) + ' V &nbsp; ' +
        'U = ' + measured.series.BAT.toFixed(1) + ' V';
      conclusion.innerHTML =
        'U(' + s.n1 + ') + U(' + s.n2 + ') = ' +
        (measured.series.L1 + measured.series.L2).toFixed(1) +
        ' V = U → <b>串联电路中总电压等于各部分电压之和</b>';
    } else {
      line.innerHTML =
        'U(' + s.n1 + ') = ' + measured.parallel.L1.toFixed(1) + ' V &nbsp; ' +
        'U(' + s.n2 + ') = ' + measured.parallel.L2.toFixed(1) + ' V &nbsp; ' +
        'U = ' + measured.parallel.BAT.toFixed(1) + ' V';
      conclusion.innerHTML =
        '三者电压相等 → <b>并联电路中各支路两端电压相等，且等于电源电压</b>';
    }
    panel.style.display = 'block';
  }

  function hideResult() {
    document.getElementById('resultPanel').style.display = 'none';
  }

  // ============================================================
  // Tab 切换
  // ============================================================
  const tabSeries = document.getElementById('tabSeries');
  const tabParallel = document.getElementById('tabParallel');

  function switchMode(mode) {
    currentMode = mode;
    selectedComponent = null;
    hideResult();
    tabSeries.classList.toggle('active', mode === 'series');
    tabParallel.classList.toggle('active', mode === 'parallel');
    updateDataPanel();
    draw();
  }

  tabSeries.addEventListener('click', function () { switchMode('series'); });
  tabParallel.addEventListener('click', function () { switchMode('parallel'); });

  // ============================================================
  // 更换灯泡按钮
  // ============================================================
  document.getElementById('swapBtn').addEventListener('click', function () {
    bulbSetIdx = (bulbSetIdx + 1) % BULB_SETS.length;
    // 换灯泡时清空当前测量（元件已经变了）
    measured.series = {};
    measured.parallel = {};
    selectedComponent = null;
    hideResult();
    updateHintBar();
    updateDataPanel();
    draw();
  });

  // ============================================================
  // 复位
  // ============================================================
  document.getElementById('resetBtn').addEventListener('click', function () {
    measured.series = {};
    measured.parallel = {};
    selectedComponent = null;
    bulbSetIdx = 0;
    hideResult();
    updateHintBar();
    updateDataPanel();
    draw();
  });

  function updateHintBar() {
    const s = getSet();
    document.getElementById('hintBar').innerHTML =
      '💡 点击电路中的 <b>' + s.n1 + ' / ' + s.n2 + ' / 电源</b>，把电压表接在它两端测量电压。';
  }

  // ============================================================
  // 实验说明弹窗
  // ============================================================
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

  // ============================================================
  // 交互式新手教程
  // ============================================================
  (function initTour() {
    var STEPS = [
      {
        title: '欢迎使用电压特点探究仿真',
        content: '这是一个可交互的仿真实验。跟着这几步，快速了解如何操作吧！',
        target: null
      },
      {
        title: '切换到串联电路',
        content: '点击「🔗 串联电路」标签，先探究串联电路中电压的特点。',
        target: '#tabSeries',
        placement: 'bottom'
      },
      {
        title: '点击灯泡测量电压',
        content: '点击灯泡，电压表会通过 П 形实线并联在它两端，显示灯泡两端电压。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '依次测量两个灯泡和电源',
        content: '再点击另一个灯泡和电源，观察三者电压读数。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '观察串联结论',
        content: '两个灯泡的电压之和恰好等于电源电压——串联电路中总电压等于各部分电压之和。',
        target: '#resultPanel',
        placement: 'top'
      },
      {
        title: '尝试更换灯泡',
        content: '点击「🔁 更换灯泡」按钮，可以切换为 L₃L₄ 或 L₅L₆。观察换灯泡后 U₁ 和 U₂ 的分配比例如何变化。',
        target: '#swapBtn',
        placement: 'top'
      },
      {
        title: '切换到并联电路',
        content: '点击「⫽ 并联电路」标签，再探究并联电路中电压的特点。',
        target: '#tabParallel',
        placement: 'bottom'
      },
      {
        title: '依次测量三个元件',
        content: '依次点击两个灯泡和电源，观察三者电压读数。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '观察并联结论',
        content: '三者电压完全相等——并联电路中各支路两端电压相等，且等于电源电压。',
        target: '#resultPanel',
        placement: 'top'
      },
      {
        title: '开始探索吧！',
        content: '点击右上角「ℹ️ 实验说明」查看实验原理与公式，点击「❓ 使用帮助」可随时重新打开本教程。',
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

      if (index >= 1 && index <= 5) {
        switchMode('series');
      } else if (index >= 6 && index <= 8) {
        switchMode('parallel');
      }

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
      try { localStorage.setItem('tour_28_done', '1'); } catch (e) {}
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
    try { firstVisit = !localStorage.getItem('tour_28_done'); } catch (e) {}
    if (firstVisit) {
      setTimeout(startTour, 700);
    }
  })();
  updateHintBar();
  updateDataPanel();
  requestAnimationFrame(loop);
})();