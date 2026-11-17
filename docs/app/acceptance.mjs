// 整体验收脚本（外壳侧三件事）：抽屉、三轮切换内存/shader、控制台泄漏告警
// 用法：node docs/app/acceptance.mjs   （报告写 docs/app/acceptance-report.md）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18099;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.css':'text/css' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const alt = path.join(ROOT, '..', p);                   // 允许取 docs/ 下的 JSON（白名单：app 目录与其父目录）
    if (fs.existsSync(alt) && !fs.statSync(alt).isDirectory()) file = alt;
    else { res.writeHead(404); res.end('nf'); return; }
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: EDGE, headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu',
         '--enable-precise-memory-info', '--js-flags=--expose-gc', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const warnings = [];
page.on('console', m => { const t = m.text(); if (/webgl|context lost|leak|too many/i.test(t)) warnings.push(t.slice(0, 200)); });
page.on('pageerror', e => warnings.push('pageerror: ' + String(e).slice(0, 200)));

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.waitForFunction('!document.getElementById("fade").classList.contains("on")', { timeout: 5000 }).catch(() => {});
await sleep(200);                                        // 避开切场景遮罩 160ms 窗口，否则首击被吞（布线抽查竞态）

const snap = () => page.evaluate(() => {
  const r = window.__LAB.renderer();
  window.gc && window.gc(); window.gc && window.gc(); window.gc && window.gc();
  return {                                              // heap 取三次 gc 后的最小值：usedJSHeapSize 波动大，单点会虚报增幅
    programs: r.info.programs.length,
    geometries: r.info.memory.geometries,
    textures: r.info.memory.textures,
    calls: r.info.render.calls,
    tris: r.info.render.triangles,
    heap: performance.memory ? performance.memory.usedJSHeapSize : null,
    id: window.__LAB.store.experimentId,
  };
});
const snapHeap = async () => {                          // 三次采样取最小，压掉 GC/JIT 噪声
  const a = await snap(), b = await snap(), c = await snap();
  return { ...c, heap: Math.min(a.heap, b.heap, c.heap) };
};

// UI 布线抽查：真实点击模块 Tab + 场景卡片
const wire = {};
await page.click('#tabs .tab:nth-child(2)'); await sleep(700);
wire.tabSwitch = await page.evaluate(() => window.__LAB.store.module);
const expectId = await page.evaluate(() => window.__LAB.DATA().byModule.electricity[2].id);
await page.evaluate(() => document.querySelectorAll('#sceneGrid .scene-card')[2].click());
await sleep(800);
wire.cardSwitch = await page.evaluate(id => window.__LAB.store.experimentId === id, expectId);

// 三轮全量切换（另加一轮不计入的预热，让 JIT/GC 先热身，避免基线偏低虚报增幅）
const ids = await page.evaluate(() => {
  const M = ['mechanics','electricity','optics','acoustics','thermal'];
  return M.flatMap(m => window.__LAB.DATA().byModule[m].map(e => e.id));
});
for (const id of ids) { await page.evaluate(i => window.__LAB.switch(i), id); await sleep(520); }
const rounds = [];
for (let round = 1; round <= 3; round++) {
  const perExp = [];
  for (const id of ids) {
    await page.evaluate(i => window.__LAB.switch(i), id);
    await sleep(520);
    if (round === 3) perExp.push(await page.evaluate(() => window.__LAB.renderer().info.programs.length));
  }
  rounds.push({ round, end: await snapHeap(), maxProgramsRound3: round === 3 ? Math.max(...perExp) : null });
}

// 内存与 shader 判定
const r1 = rounds[0].end, r2 = rounds[1].end, r3 = rounds[2].end;
const heapGrow = (r1.heap && r3.heap) ? (r3.heap - r1.heap) / r1.heap : null;
const memOK = heapGrow != null ? heapGrow <= 0.10 : null;
const geoOK = Math.abs(r3.geometries - r1.geometries) <= Math.max(3, r1.geometries * 0.02);
const texOK = Math.abs(r3.textures - r1.textures) <= Math.max(3, r1.textures * 0.02);
const progOK = r3.programs <= r2.programs && r3.programs <= r1.programs + 2;
const leakWarn = warnings.filter(w => /context lost|leak|out of memory|webglcontext/i.test(w));
const perfHints = warnings.length - leakWarn.length;
const warnOK = leakWarn.length === 0;                    // 只有泄漏类告警判 FAIL，性能提示不计
const callRows = [];
for (const id of ids) {
  await page.evaluate(i => window.__LAB.switch(i), id); await sleep(800);   // ≥500ms 稳态：旧场景已 dispose
  const s = await page.evaluate(() => { const r = window.__LAB.renderer().info.render; return { c: r.calls, t: r.triangles }; });
  callRows.push({ id, c: s.c, t: s.t });
}
const maxCalls = Math.max(...callRows.map(r => r.c));
const maxTris = Math.max(...callRows.map(r => r.t));

// <768px 抽屉 + 3D 可拖拽
await page.setViewport({ width: 390, height: 844 }); await sleep(400);
const drawer = {};
drawer.collapsed = await page.evaluate(() => getComputedStyle(document.getElementById('panel')).transform);
const handleVisible = await page.evaluate(() => getComputedStyle(document.querySelector('.drawer-handle')).display !== 'none');
await page.click('#drawerHandle'); await sleep(450);
drawer.opened = await page.evaluate(() => getComputedStyle(document.getElementById('panel')).transform);
const camBefore = await page.evaluate(() => { const p = window.__LAB.camera().position; return { x: p.x, y: p.y, z: p.z }; });
await page.mouse.move(195, 300); await page.mouse.down();
await page.mouse.move(320, 260, { steps: 8 }); await page.mouse.up();
await sleep(300);
const camAfter = await page.evaluate(() => { const p = window.__LAB.camera().position; return { x: p.x, y: p.y, z: p.z }; });
const dragDist = Math.hypot(camAfter.x - camBefore.x, camAfter.y - camBefore.y, camAfter.z - camBefore.z);
const dragOK = dragDist > 0.05;

const F = v => v == null ? 'n/a' : (typeof v === 'boolean' ? (v ? 'PASS' : 'FAIL') : v);
let md = `# 外壳侧整体验收报告\n\n时间：${new Date().toISOString()}\n环境：headless Chromium(Edge) + SwiftShader，1280×900 → 390×844\n\n## 结论总览\n\n| 验收项 | 标准 | 结果 |\n|---|---|---|\n`;
md += `| ① 移动端抽屉 | <768px 面板变底部抽屉，把手可见、可展开，3D 区可拖拽 | handle=${F(handleVisible)} 展开位移=${drawer.opened} 拖拽位移=${dragDist.toFixed(3)} → ${F(handleVisible && drawer.opened !== drawer.collapsed && dragOK)} |\n`;
md += `| ② 内存增幅(3轮×25场景) | ≤10% | ${(heapGrow * 100).toFixed(2)}% → ${F(memOK)} |\n`;
md += `| ② WebGL 泄漏告警 | 控制台无泄漏类告警（性能提示不计） | 泄漏类 ${leakWarn.length} 条、性能提示 ${perfHints} 条 → ${F(warnOK)} |\n`;
md += `| ③ shader 重编译 | programs.length 切换后不增长 | R1=${r1.programs} R2=${r2.programs} R3=${r3.programs}（轮内峰值 ${rounds[2].maxProgramsRound3}）→ ${F(progOK)} |\n`;
md += `| ③ 共享资源不重建 | geometries/textures 三轮后不增长(容差2%) | geo ${r1.geometries}→${r3.geometries} ${F(geoOK)}；tex ${r1.textures}→${r3.textures} ${F(texOK)} |\n`;
md += `| ④ 绘制预算（props 实物化后复核） | 稳态 calls ≤60、tris <200k | 最高 ${maxCalls} calls / ${maxTris.toLocaleString()} tris → ${F(maxCalls <= 60 && maxTris < 200000)} |\n`;
md += `## 明细\n\n- UI 布线抽查：Tab 点击切模块 → ${F(wire.tabSwitch === 'electricity')}（${wire.tabSwitch}）；卡片点击切场景 → ${F(wire.cardSwitch)}\n`;
md += `- 稳态 draw calls（切换后 ≥800ms 采样，旧场景已释放）：最高 ${maxCalls} calls / ${maxTris.toLocaleString()} tris\n\n| 实验 | calls | triangles |\n|---|---|---|\n`;
for (const r of callRows) md += `| ${r.id} | ${r.c} | ${r.t} |\n`;
md += `\n## 控制台告警\n\n泄漏类（判 FAIL）：${leakWarn.length ? '\n' + leakWarn.map(w => '- ' + w).join('\n') : '（无）'}\n\n性能提示（不计入判定）${perfHints} 条${perfHints ? '：\n' + warnings.filter(w => !/context lost|leak|out of memory|webglcontext/i.test(w)).map(w => '- ' + w).join('\n') : ''}\n`;
fs.writeFileSync(path.join(ROOT, 'acceptance-report.md'), md, 'utf8');
console.log('REPORT WRITTEN');
console.log(`heapGrow=${(heapGrow * 100).toFixed(2)}% programs ${r1.programs}->${r3.programs} geo ${r1.geometries}->${r3.geometries} tex ${r1.textures}->${r3.textures} maxCalls=${maxCalls} leakWarn=${leakWarn.length} drawer=${handleVisible}/${dragOK}`);
await browser.close(); server.close();
