(function () {
  const canvas = document.getElementById('simCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // 电路参数
  const U = 6;
  const R1 = 10;
  const R2 = 20;

  // 电流计算
  const I_series = U / (R1 + R2);
  const I_parallel_total = U / (R1 * R2 / (R1 + R2));
  const I_parallel_L1 = U / R1;
  const I_parallel_L2 = U / R2;

  // 状态
  let currentMode = 'series';
  let selectedPoint = 'A';
  let measured = {
    series: {},
    parallel: {}
  };

  // 开关状态（每个电路独立）
  let switchState = {
    series: false,     // false = 断开, true = 闭合
    parallel: false
  };

  // 开关位置（供点击热区和绘制使用）
  const SWITCH_POS = {
    series: { x: 260, y: 380, label: 'S' },
    parallel: { x: 300, y: 380, label: 'S' }
  };

  // 提示条闪烁状态
  let hintTimeout = null;

  // ============================================================
  // 测量点坐标
  // ============================================================
  const SERIES_POINTS = {
    'A': { x: 390, y: 380, label: 'A' },
    'B': { x: 180, y: 255, label: 'B' },
    'C': { x: 390, y: 130, label: 'C' },
    'D': { x: 600, y: 255, label: 'D' }
  };

  const PARALLEL_POINTS = {
    'a': { x: 200, y: 310, label: 'a' },
    'b': { x: 510, y: 130, label: 'b' },
    'c': { x: 510, y: 255, label: 'c' },
    'd': { x: 600, y: 310, label: 'd' }
  };

  // ============================================================
  // 串联电路绘制
  // ============================================================
  function drawSeriesCircuit() {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 矩形回路
    ctx.beginPath();
    ctx.moveTo(180, 130);
    ctx.lineTo(600, 130);
    ctx.moveTo(600, 130);
    ctx.lineTo(600, 380);
    ctx.moveTo(600, 380);
    ctx.lineTo(180, 380);
    ctx.moveTo(180, 380);
    ctx.lineTo(180, 130);
    ctx.stroke();

    // 灯泡
    drawLamp(280, 130, 'L₁', '10Ω');
    drawLamp(500, 130, 'L₂', '20Ω');

    // 开关（传入闭合状态）
    drawSwitch(SWITCH_POS.series.x, SWITCH_POS.series.y, 'S', switchState.series);

    // 电源
    drawBattery(510, 380, '6V');

    // 测量点
    Object.keys(SERIES_POINTS).forEach(function (key) {
      var p = SERIES_POINTS[key];
      var isSelected = (key === selectedPoint);
      var isMeasured = measured.series[key] !== undefined;
      var locked = !switchState.series;
      drawPoint(p.x, p.y, key, isSelected, isMeasured, locked);
    });
  }

  // ============================================================
  // 并联电路绘制
  // ============================================================
  function drawParallelCircuit() {
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 三条水平线
    ctx.beginPath();
    ctx.moveTo(200, 130);
    ctx.lineTo(600, 130);
    ctx.moveTo(200, 255);
    ctx.lineTo(600, 255);
    ctx.moveTo(200, 380);
    ctx.lineTo(600, 380);
    ctx.stroke();

    // 两条垂直线
    ctx.beginPath();
    ctx.moveTo(200, 130);
    ctx.lineTo(200, 380);
    ctx.moveTo(600, 130);
    ctx.lineTo(600, 380);
    ctx.stroke();

    // 灯泡
    drawLamp(400, 130, 'L₁', '10Ω');
    drawLamp(400, 255, 'L₂', '20Ω');

    // 开关
    drawSwitch(SWITCH_POS.parallel.x, SWITCH_POS.parallel.y, 'S', switchState.parallel);

    // 电源
    drawBattery(460, 380, '6V');

    // 测量点
    Object.keys(PARALLEL_POINTS).forEach(function (key) {
      var p = PARALLEL_POINTS[key];
      var isSelected = (key === selectedPoint);
      var isMeasured = measured.parallel[key] !== undefined;
      var locked = !switchState.parallel;
      drawPoint(p.x, p.y, key, isSelected, isMeasured, locked);
    });
  }

  // ============================================================
  // 绘制灯泡
  // ============================================================
  function drawLamp(cx, cy, name, spec) {
    const r = 22;
    ctx.save();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    const d = r * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx + d, cy - d);
    ctx.lineTo(cx - d, cy + d);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx, cy + r + 18);

    ctx.font = '11px "Courier New", monospace';
    ctx.fillStyle = '#5b7298';
    ctx.fillText(spec, cx, cy - r - 12);

    ctx.restore();
  }

  // ============================================================
  // 绘制开关（根据 closed 状态绘制）
  // ============================================================
  function drawSwitch(x, y, label, closed) {
    const size = 24;
    ctx.save();

    // 白色背景（覆盖导线）
    ctx.beginPath();
    ctx.rect(x - size - 10, y - 30, size * 2 + 20, 40);
    ctx.fillStyle = '#eaf3fc';
    ctx.fill();

    // 两个接线柱
    ctx.beginPath();
    ctx.arc(x - size, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2c3e50';
    ctx.fill();

    if (closed) {
      // 闭合：水平横杆连接两个接线柱
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 闭合时绿色光晕提示
      ctx.beginPath();
      ctx.arc(x, y, 38, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(58, 158, 110, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      // 断开：斜向上
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size - 4, y - 18);
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 断开时黄色闪烁光环提示用户点击
      const pulse = 0.5 + Math.sin(performance.now() / 400) * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 38, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(255, 180, 40, ' + (0.4 + pulse * 0.5) + ')';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 小提示标签"点击闭合"
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#b8860b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('点击闭合', x, y - 42);
    }

    // 开关标签
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 62);

    ctx.restore();
  }

  // ============================================================
  // 绘制电源
  // ============================================================
  function drawBattery(x, y, label) {
    ctx.save();

    ctx.beginPath();
    ctx.rect(x - 30, y - 20, 60, 40);
    ctx.fillStyle = '#eaf3fc';
    ctx.fill();

    // 长线（正极）
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 16);
    ctx.lineTo(x - 6, y + 16);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 短线（负极）
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 接线
    ctx.beginPath();
    ctx.moveTo(x - 30, y);
    ctx.lineTo(x - 6, y);
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 30, y);
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 2, y - 32);

    ctx.restore();
  }

  // ============================================================
  // 绘制测量点
  // ============================================================
  function drawPoint(x, y, label, isSelected, isMeasured, locked) {
    ctx.save();

    // 电路未闭合时，测量点变灰
    if (locked) {
      ctx.globalAlpha = 0.45;
    }

    // 选中光晕
    if (isSelected && !locked) {
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 200, 80, 0.4)';
      ctx.fill();
    }

    // 主圆
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, 2 * Math.PI);
    if (locked) {
      ctx.fillStyle = '#9aa7b3';
      ctx.strokeStyle = '#5b6a78';
    } else if (isSelected) {
      ctx.fillStyle = '#ff9d3a';
      ctx.strokeStyle = '#b1573a';
    } else if (isMeasured) {
      ctx.fillStyle = '#3a9e6e';
      ctx.strokeStyle = '#1a5a3a';
    } else {
      ctx.fillStyle = '#1f6fb5';
      ctx.strokeStyle = '#0b4d8a';
    }
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 标签
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + 1);

    // 已测量勾选标记
    if (isMeasured && !isSelected && !locked) {
      ctx.beginPath();
      ctx.arc(x + 15, y - 15, 8, 0, 2 * Math.PI);
      ctx.fillStyle = '#3a9e6e';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = 'white';
      ctx.fillText('✓', x + 15, y - 14);
    }

    ctx.restore();
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

    // 标题
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#113955';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      currentMode === 'series' ? '🔗 串联电路（图 11.4-9）' : '⫽ 并联电路（图 11.4-10）',
      20, 18
    );

    // 开关状态提示
    const isClosed = switchState[currentMode];
    ctx.font = 'bold 13px system-ui, sans-serif';
    if (isClosed) {
      ctx.fillStyle = '#1a7a4e';
      ctx.fillText('✓ 电路已闭合，可以测量', 20, 42);
    } else {
      ctx.fillStyle = '#b8860b';
      ctx.fillText('⚠️ 电路断开，请先点击开关 S 闭合电路', 20, 42);
    }

    // 画电路
    if (currentMode === 'series') {
      drawSeriesCircuit();
    } else {
      drawParallelCircuit();
    }

    // 右上角读数面板
    const reading = getReading();
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#c8dcec';
    ctx.lineWidth = 2;
    roundRect(ctx, W - 240, 20, 220, 88, 14);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#5b7298';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('电流表读数', W - 224, 34);

    ctx.font = 'bold 26px "Courier New", monospace';
    if (reading !== null && switchState[currentMode]) {
      ctx.fillStyle = '#b13030';
      ctx.fillText(reading.toFixed(2) + ' A', W - 224, 56);
    } else if (!switchState[currentMode]) {
      ctx.fillStyle = '#9aa7b3';
      ctx.fillText('开关断开', W - 224, 56);
    } else {
      ctx.fillStyle = '#b13030';
      ctx.fillText('— — —', W - 224, 56);
    }
    ctx.restore();
  }

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

  function getReading() {
    if (!switchState[currentMode]) return null;
    if (currentMode === 'series') {
      return I_series;
    } else {
      if (selectedPoint === 'a' || selectedPoint === 'd') return I_parallel_total;
      if (selectedPoint === 'b') return I_parallel_L1;
      if (selectedPoint === 'c') return I_parallel_L2;
    }
    return null;
  }

  // ============================================================
  // 数据面板
  // ============================================================
  function updateDataPanel() {
    const panel = document.getElementById('dataPanel');
    panel.innerHTML = '';
    const isClosed = switchState[currentMode];

    if (currentMode === 'series') {
      const points = ['A', 'B', 'C', 'D'];
      const descs = ['底部（电流表）', '左侧', '顶部（两灯间）', '右侧'];
      points.forEach(function (key, i) {
        const card = document.createElement('div');
        card.className = 'data-card' + (!isClosed ? ' locked' : '');
        const reading = measured.series[key];
        card.innerHTML =
          '<div class="dot-name">' + key + '</div>' +
          '<div class="position">' + descs[i] + '</div>' +
          '<div class="reading">' + (reading !== undefined ? reading.toFixed(2) + ' <span>A</span>' : '— — —') + '</div>';
        panel.appendChild(card);
      });
    } else {
      const points = ['a', 'b', 'c', 'd'];
      const descs = ['干路左侧', 'L₁ 支路', 'L₂ 支路', '干路右侧'];
      points.forEach(function (key, i) {
        const card = document.createElement('div');
        card.className = 'data-card' + (!isClosed ? ' locked' : '');
        const reading = measured.parallel[key];
        card.innerHTML =
          '<div class="dot-name">' + key + '</div>' +
          '<div class="position">' + descs[i] + '</div>' +
          '<div class="reading">' + (reading !== undefined ? reading.toFixed(2) + ' <span>A</span>' : '— — —') + '</div>';
        panel.appendChild(card);
      });
    }
  }

  function checkAllMeasured() {
    if (currentMode === 'series') {
      return ['A', 'B', 'C', 'D'].every(function (k) {
        return measured.series[k] !== undefined;
      });
    } else {
      return ['a', 'b', 'c', 'd'].every(function (k) {
        return measured.parallel[k] !== undefined;
      });
    }
  }

  function showResult() {
    const panel = document.getElementById('resultPanel');
    const line = document.getElementById('resultLine');
    const conclusion = document.getElementById('resultConclusion');

    if (currentMode === 'series') {
      line.innerHTML =
        'I<sub>A</sub> = ' + measured.series.A.toFixed(2) + ' A &nbsp; ' +
        'I<sub>B</sub> = ' + measured.series.B.toFixed(2) + ' A &nbsp; ' +
        'I<sub>C</sub> = ' + measured.series.C.toFixed(2) + ' A &nbsp; ' +
        'I<sub>D</sub> = ' + measured.series.D.toFixed(2) + ' A';
      conclusion.innerHTML =
        '四个位置的电流完全相同 → <b>串联电路中电流处处相等</b>';
    } else {
      line.innerHTML =
        'I<sub>a</sub> = ' + measured.parallel.a.toFixed(2) + ' A &nbsp; ' +
        'I<sub>b</sub> = ' + measured.parallel.b.toFixed(2) + ' A &nbsp; ' +
        'I<sub>c</sub> = ' + measured.parallel.c.toFixed(2) + ' A &nbsp; ' +
        'I<sub>d</sub> = ' + measured.parallel.d.toFixed(2) + ' A';
      conclusion.innerHTML =
        'I<sub>b</sub> + I<sub>c</sub> = ' +
        (measured.parallel.b + measured.parallel.c).toFixed(2) +
        ' A = I<sub>a</sub> = I<sub>d</sub> → <b>并联电路中干路电流等于各支路电流之和</b>';
    }
    panel.style.display = 'block';
  }

  function hideResult() {
    document.getElementById('resultPanel').style.display = 'none';
  }

  // ============================================================
  // 事件：点击画布
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

    // 1. 先检测开关点击
    const sw = SWITCH_POS[currentMode];
    const swDist = Math.hypot(x - sw.x, y - sw.y);
    if (swDist < 45) {
      // 切换开关状态
      switchState[currentMode] = !switchState[currentMode];

      // 开关断开时清空测量数据和结论
      if (!switchState[currentMode]) {
        measured[currentMode] = {};
        hideResult();
      }

      updateDataPanel();
      draw();
      return;
    }

    // 2. 开关未闭合，点击测量点无效
    if (!switchState[currentMode]) {
      flashHint();
      return;
    }

    // 3. 检测测量点
    const points = currentMode === 'series' ? SERIES_POINTS : PARALLEL_POINTS;
    const hitRadius = 24;

    for (const key in points) {
      const p = points[key];
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < hitRadius) {
        selectPoint(key);
        return;
      }
    }
  }

  // 闪烁提示条
  function flashHint() {
    const hintBar = document.getElementById('hintBar');
    hintBar.classList.add('warning');
    if (hintTimeout) clearTimeout(hintTimeout);
    hintTimeout = setTimeout(function () {
      hintBar.classList.remove('warning');
    }, 1500);
  }

  function selectPoint(key) {
    selectedPoint = key;
    const reading = getReading();

    if (currentMode === 'series') {
      measured.series[key] = reading;
    } else {
      measured.parallel[key] = reading;
    }

    updateDataPanel();
    draw();

    if (checkAllMeasured()) {
      showResult();
    }
  }

  // ============================================================
  // Tab 切换
  // ============================================================
  const tabSeries = document.getElementById('tabSeries');
  const tabParallel = document.getElementById('tabParallel');

  function switchMode(mode) {
    currentMode = mode;
    selectedPoint = (mode === 'series') ? 'A' : 'a';
    hideResult();
    tabSeries.classList.toggle('active', mode === 'series');
    tabParallel.classList.toggle('active', mode === 'parallel');

    updateHintBar();
    updateDataPanel();
    draw();
  }

  function updateHintBar() {
    const hintBar = document.getElementById('hintBar');
    const isClosed = switchState[currentMode];
    const pointsStr = currentMode === 'series' ? 'A / B / C / D' : 'a / b / c / d';

    if (!isClosed) {
      hintBar.innerHTML = '💡 点击电路中的<b>开关 S</b>使其闭合，然后再点击 <b>' + pointsStr + '</b> 位置测量电流。';
    } else {
      hintBar.innerHTML = '✓ 电路已闭合，点击电路图中的 <b>' + pointsStr + '</b> 位置，把电流表接入该处测量。';
    }
  }

  tabSeries.addEventListener('click', function () { switchMode('series'); });
  tabParallel.addEventListener('click', function () { switchMode('parallel'); });

  // ============================================================
  // 复位
  // ============================================================
  document.getElementById('resetBtn').addEventListener('click', function () {
    measured.series = {};
    measured.parallel = {};
    switchState.series = false;
    switchState.parallel = false;
    selectedPoint = (currentMode === 'series') ? 'A' : 'a';
    hideResult();
    updateHintBar();
    updateDataPanel();
    draw();
  });

  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('touchstart', function (e) {
    e.preventDefault();
    handleCanvasClick(e);
  }, { passive: false });

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
        title: '欢迎使用电流特点探究仿真',
        content: '这是一个可交互的仿真实验。跟着这几步，快速了解如何操作吧！',
        target: null
      },
      {
        title: '切换到串联电路',
        content: '点击「🔗 串联电路」标签，先探究串联电路中电流的特点。',
        target: '#tabSeries',
        placement: 'bottom'
      },
      {
        title: '闭合开关 S',
        content: '点击电路中的开关 S，使其闭合。只有开关闭合后，电流才能流通，才能进行测量。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '依次测量 A、B、C、D 四点',
        content: '闭合开关后，依次点击电路中 A、B、C、D 四个位置，把电流表接入测量。每测一个点，数据卡片会显示电流读数。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '观察串联结论',
        content: '四个位置的电流完全相同——这说明串联电路中电流处处相等。',
        target: '#resultPanel',
        placement: 'top'
      },
      {
        title: '切换到并联电路',
        content: '点击「⫽ 并联电路」标签，再探究并联电路中电流的特点。',
        target: '#tabParallel',
        placement: 'bottom'
      },
      {
        title: '闭合开关 S 并测量',
        content: '同样先点击开关闭合电路，再依次点击 a、b、c、d 四个位置测量。观察干路电流和两条支路电流的关系。',
        target: '.canvas-wrapper',
        placement: 'bottom'
      },
      {
        title: '观察并联结论',
        content: '两条支路电流之和等于干路电流——这就是并联电路的电流特点。',
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

      if (index === 1 || index === 2 || index === 3 || index === 4) {
        switchMode('series');
      } else if (index === 5 || index === 6 || index === 7) {
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
      try { localStorage.setItem('tour_25_done', '1'); } catch (e) {}
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
    try { firstVisit = !localStorage.getItem('tour_25_done'); } catch (e) {}
    if (firstVisit) {
      setTimeout(startTour, 700);
    }
  })();
  function animationLoop() {
    draw();
    requestAnimationFrame(animationLoop);
  }
  updateHintBar();
  updateDataPanel();
  animationLoop();
})();