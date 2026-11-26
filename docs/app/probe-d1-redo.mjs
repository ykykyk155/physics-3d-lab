// D1(08) 重做验收：双表常显/换位/双接线/误接/开关/记录表格+描点图/结论/readouts/环境
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18198;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { const a = path.join(ROOT, "..", p); if (fs.existsSync(a)) f = a; else { res.writeHead(404); res.end(); return; } }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-gpu", "--no-sandbox"] });
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 1300, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
await pg.evaluate(() => window.__LAB.switch("D1-series-parallel")); await sl(1200);
const outDir = path.join(ROOT, "shots", "d1-redo"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? "OK" : "FAIL" + (extra ? "  [" + extra + "]" : "")}`);
const near = (a, b2, eps = 1e-6) => Math.abs(a - b2) < eps;

const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const ms = e.getMeterState();
  const dist = (a, b2) => (a && b2) ? Math.hypot(a.x - b2.x, a.y - b2.y, a.z - b2.z) : -1;
  const sec = document.querySelector('#dataRecordSection');
  const rows = document.querySelectorAll('#recTableBody tr');
  const chart = document.querySelector('#recChart');
  let chartPix = 0;
  if (chart && chart.width && chart.height) {
    try { const d = chart.getContext('2d').getImageData(0, 0, chart.width, chart.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) chartPix++;
    } catch (err) {}
  }
  return {
    mode: e.p.mode, U: Number(e.p.voltage), Req: e.Req, I: e.I,
    ampReading: e.ampReading, volReading: e.volReading,
    ampSlot: e.ampSlot, volSlot: e.volSlot, ampError: e.ampError, volError: e.volError,
    ampLeadDist: dist(ms.amp.leadEnds[0], ms.amp.leadEnds[1]),
    volLeadDist: dist(ms.vol.leadEnds[0], ms.vol.leadEnds[1]),
    lbl: e.lbl && e.lbl.userData && e.lbl.userData.div ? e.lbl.userData.div.textContent : null,
    lblIExists: !!e.lblI,
    concl: e.conclTextEl ? e.conclTextEl.textContent : null,
    conclVisible: e.concl ? e.concl.visible === true : null,
    toast: (document.querySelector("#toast") || {}).textContent?.trim?.() || null,
    readouts: (window.__LAB.current().exp.readouts() || []).map(r => [r.label, r.value, r.unit]),
    records: e.recordData ? e.recordData() : null,
    recordSectionDisplay: sec ? getComputedStyle(sec).display : 'missing',
    recRowCount: rows.length,
    recRowsText: [...rows].map(tr => [...tr.children].map(td => td.textContent.trim()).join('|')),
    recEmptyDisplay: (document.querySelector('#recEmpty') ? getComputedStyle(document.querySelector('#recEmpty')).display : 'missing'),
    chartExists: !!chart, chartW: chart ? chart.width : 0, chartH: chart ? chart.height : 0, chartPix,
    switchParam: window.__LAB.store.params.switch,
  };
});
const set = async (k, v) => { await pg.evaluate((k, v) => { window.__LAB.current().exp._impl.onParam(k, v); }, k, v); await sl(120); };
const setU = async v => { await pg.evaluate(v => { window.__LAB.current().exp._impl.onParam('voltage', v); }, v); await sl(150); };
const place = async (m, slot) => { const r = await pg.evaluate((m, slot) => window.__LAB.current().exp._impl.placeMeter(m, slot), m, slot); await sl(130); return r; };
const toggle = async () => { const r = await pg.evaluate(() => window.__LAB.current().exp._impl.toggleSwitch()); await sl(180); return r; };
const clearToast = () => pg.evaluate(() => { const t = document.querySelector('#toast'); if (t) { t.textContent = ''; t.classList.remove('show'); } });
const click = async sel => { await pg.evaluate(sel => { const n = document.querySelector(sel); if (n) n.click(); }, sel); await sl(200); };
const snip = async name => { if (!/mis/.test(name)) await clearToast(); await sl(50); return pg.screenshot({ path: path.join(outDir, name) }); };
// 读取电路导线线段（Line2 的 instanceStart 每段 6 个 float：x1,y1,z1,x2,y2,z2），统计某槽口是否被导线跨越
const gapCross = slots => pg.evaluate((slots) => {
  const e = window.__LAB.current().exp._impl;
  const segs = [];
  for (const w of e.wires) {
    const a = w.geometry && w.geometry.attributes && w.geometry.attributes.instanceStart;
    if (!a) continue;
    const d = a.data.array;
    for (let i = 0; i + 5 < d.length; i += 6) segs.push([d[i], d[i + 1], d[i + 3], d[i + 4]]);
  }
  const out = {};
  for (const s of slots) {
    const c = e._slotC(s); if (!c) continue;
    const L = c.cx - 0.55, R = c.cx + 0.55, y = c.y;
    out[s] = segs.filter(([x1, y1, x2, y2]) =>
      Math.abs(y1 - y) < 0.03 && Math.abs(y2 - y) < 0.03 &&
      Math.min(x1, x2) < R - 0.005 && Math.max(x1, x2) > L + 0.005
    ).length;
  }
  return out;
}, slots);

// ===== 1) 默认串联：双表常显 =====
let s = await st();
ok("默认串联 ampSlot=A", s.ampSlot === 'A', `ampSlot=${s.ampSlot}`);
ok("默认串联 volSlot=L1", s.volSlot === 'L1', `volSlot=${s.volSlot}`);
ok("默认串联 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading}`);
ok("默认串联 1.00V", near(s.volReading, 1.00), `vol=${s.volReading}`);
ok("默认无 — 读数", s.ampReading !== '—' && s.volReading !== '—', `${s.ampReading}/${s.volReading}`);
ok("顶栏 R总=30.0Ω", /R总=30\.0Ω/.test(s.lbl || ''), `lbl=${s.lbl}`);
ok("删除了重复 lblI", s.lblIExists === false, `lblIExists=${s.lblIExists}`);
ok("readouts 6 项且无 —", s.readouts.length === 6 && s.readouts.every(r => String(r[1]) !== '—'), JSON.stringify(s.readouts));
ok("默认 leadEnds 距离>0.3 (amp)", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);
ok("默认 leadEnds 距离>0.3 (vol)", s.volLeadDist > 0.3, `d=${s.volLeadDist}`);
ok("数据记录 section 显示", s.recordSectionDisplay !== 'none' && s.recordSectionDisplay !== 'missing', `display=${s.recordSectionDisplay}`);
ok("空表格显示占位提示", s.recRowCount === 0 && s.recEmptyDisplay !== 'none' && s.recEmptyDisplay !== 'missing', `rows=${s.recRowCount} emptyDisplay=${s.recEmptyDisplay}`);
let g = await gapCross(['A', 'B', 'C']);
ok("默认 A 槽断口真实断开", g.A === 0, JSON.stringify(g));
ok("默认 B 槽未占用（导线连续）", g.B > 0, JSON.stringify(g));
// 电压表摆位：表体落台面（低于灯泡、在电路平面前方），不许竖在灯泡上方
const volPos = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl || window.__LAB.current().exp;
  const v = e.volMeterG.position, b1 = e.bulb1G.position, b2 = e.bulb2G.position;
  return { vy: v.y, vz: v.z, b1y: b1.y, b2y: b2.y };
});
let vp = await volPos();
ok("串联默认电压表在灯泡上方支路里", vp.vy > vp.b1y && vp.vy > vp.b2y, JSON.stringify(vp));
ok("串联默认电压表与主电路同面", Math.abs(vp.vz) < 0.35, JSON.stringify(vp));
ok("串联默认支路缺口宽≈0.72", near(s.volLeadDist, 0.72, 0.05), `d=${s.volLeadDist}`);
const branchGap = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const v = e.volMeterG.position;
  const segs = [];
  for (const w of e.wires) { const a = w.geometry && w.geometry.attributes && w.geometry.attributes.instanceStart; if (!a) continue; const d = a.data.array; for (let i = 0; i + 5 < d.length; i += 6) segs.push([d[i], d[i + 1], d[i + 3], d[i + 4]]); }
  const L = v.x - 0.36, R = v.x + 0.36, y = v.y;
  const cross = segs.filter(([x1, y1, x2, y2]) => Math.abs(y1 - y) < 0.03 && Math.abs(y2 - y) < 0.03 && Math.min(x1, x2) < R - 0.005 && Math.max(x1, x2) > L + 0.005).length;
  return { cross, vx: v.x, vy: v.y };
});
let bg = await branchGap();
ok("串联默认支路断口真实断开", bg.cross === 0, JSON.stringify(bg));
await snip("d1r-default-series.png");

// ===== 2) 电压 6V =====
await setU(6); s = await st();
ok("6V → 0.20A", near(s.ampReading, 0.20), `amp=${s.ampReading}`);
ok("6V → 2.00V", near(s.volReading, 2.00), `vol=${s.volReading}`);
await setU(3);

// ===== 2b) R1/R2 参数变化（读数必须跟随） =====
await set('r1', 20); await set('r2', 10); s = await st();
ok("R1=20/R2=10 → 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading}`);
ok("R1=20/R2=10 → U1=2.00V", near(s.volReading, 2.00), `vol=${s.volReading}`);
await set('r1', 5); await set('r2', 25); s = await st();
ok("R1=5/R2=25 → U1=0.50V", near(s.volReading, 0.50), `vol=${s.volReading}`);
await set('r1', 10); await set('r2', 20);

// ===== 3) 开关点击（API 同源）+ 参数同步 =====
await toggle(); s = await st();
ok("断开 → 电流表 0", near(s.ampReading, 0), `amp=${s.ampReading}`);
ok("断开 → 电压表跨 L1=0", near(s.volReading, 0), `vol=${s.volReading}`);
ok("断开 → store switch=off", s.switchParam === 'off', `switchParam=${s.switchParam}`);
await snip("d1r-switch-off.png");
await toggle(); s = await st();
ok("恢复闭合 → 0.10A/1.00V", near(s.ampReading, 0.10) && near(s.volReading, 1.00), `${s.ampReading}/${s.volReading}`);
ok("恢复 → store switch=on", s.switchParam === 'on', `switchParam=${s.switchParam}`);

// ===== 4) 电流表换位 B/C =====
await place('amp', 'B'); s = await st();
ok("amp 换到 B → 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("B leadEnds>0.3", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);
g = await gapCross(['A', 'B', 'C']);
ok("换到 B → B 槽断口真实断开", g.B === 0, JSON.stringify(g));
ok("换到 B → A 槽导线恢复连续", g.A > 0, JSON.stringify(g));
await place('amp', 'C'); s = await st();
ok("amp 换到 C → 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("C leadEnds>0.3", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);
g = await gapCross(['A', 'B', 'C']);
ok("换到 C → C 槽断口真实断开", g.C === 0, JSON.stringify(g));
ok("换到 C → B 槽导线恢复连续", g.B > 0, JSON.stringify(g));

// ===== 5) 电压表换位 L2 / batt =====
await place('vol', 'L2'); s = await st();
ok("vol 换到 L2 → 2.00V", near(s.volReading, 2.00), `vol=${s.volReading} slot=${s.volSlot}`);
await place('vol', 'batt'); s = await st();
ok("vol 换到 batt → 3.00V", near(s.volReading, 3.00), `vol=${s.volReading} slot=${s.volSlot}`);
vp = await volPos();
ok("batt 槽电压表在电池上方支路里", vp.vy > 1.6 && Math.abs(vp.vz) < 0.35, JSON.stringify(vp));
bg = await branchGap();
ok("batt 槽支路断口真实断开", bg.cross === 0, JSON.stringify(bg));

// ===== 6) 误接（两表互换位置也按误接处理） =====
await place('vol', 'A'); s = await st();
ok("误接 vol→A toast 含「电压表应与被测元件并联」", /电压表应与被测元件并联/.test(s.toast || ''), `toast=${s.toast}`);
ok("误接 vol→A 读数 —", s.volReading === '—' || s.volReading === '-', `vol=${s.volReading}`);
await snip("d1r-mis-vol.png");
await place('amp', 'L1'); s = await st();
ok("误接 amp→L1 toast 含「电流表应串联接入被测电路」", /电流表应串联接入被测电路/.test(s.toast || ''), `toast=${s.toast}`);
ok("误接 amp→L1 读数 —", s.ampReading === '—' || s.ampReading === '-', `amp=${s.ampReading}`);
await snip("d1r-mis-amp.png");
// 误接时记录必须被拒（规格 §6.1）
const recBefore = s.records ? s.records.length : 0;
await clearToast(); await click('#recBtn'); s = await st();
ok("误接时记录被拒 toast", /请先闭合开关并正确接入两只表/.test(s.toast || ''), `toast=${s.toast}`);
ok("误接时记录不增加", (s.records ? s.records.length : 0) === recBefore, `before=${recBefore} now=${s.records && s.records.length}`);
// 恢复正确接线
await place('vol', 'L1'); await place('amp', 'A'); s = await st();
ok("恢复正确接线 0.10A/1.00V", near(s.ampReading, 0.10) && near(s.volReading, 1.00) && !s.ampError && !s.volError, `${s.ampReading}/${s.volReading} err=${s.ampError}/${s.volError}`);

// ===== 6b) 真实 DOM 点选：点表选中 → 点槽换位；点开关 =====
const scr = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const cam = e.ctx.camera; const rect = document.querySelector('#viewport').getBoundingClientRect();
  const toS = v => { const q = v.clone().project(cam); return { x: rect.left + (q.x * 0.5 + 0.5) * rect.width, y: rect.top + (-q.y * 0.5 + 0.5) * rect.height }; };
  const ptB = e.points.find(p => p.userData.pid === 'B');
  return { amp: toS(e.meterG.position), vol: toS(e.volMeterG.position), B: ptB ? toS(ptB.position) : null, sw: toS(e.switchG.position) };
});
await pg.mouse.click(scr.vol.x, scr.vol.y); await sl(200);
let act = await pg.evaluate(() => window.__LAB.current().exp._impl.activeMeter);
ok("DOM 点电压表 → activeMeter=vol", act === 'vol', `active=${act}`);
if (scr.B) { await pg.mouse.click(scr.B.x, scr.B.y); await sl(250); }
s = await st();
ok("DOM 点空槽 B → 电压表换到 B（误接）", s.volSlot === 'B' && s.volError === true, `volSlot=${s.volSlot} err=${s.volError}`);
const scr2 = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const cam = e.ctx.camera; const rect = document.querySelector('#viewport').getBoundingClientRect();
  const toS = v => { const q = v.clone().project(cam); return { x: rect.left + (q.x * 0.5 + 0.5) * rect.width, y: rect.top + (-q.y * 0.5 + 0.5) * rect.height }; };
  return { amp: toS(e.meterG.position), L2: toS(e.bulb2G.position) };
});
await pg.mouse.click(scr2.amp.x, scr2.amp.y); await sl(150);
await pg.mouse.click(scr2.L2.x, scr2.L2.y); await sl(250);
s = await st();
ok("DOM 点电流表 → 点 L2 → 电流表进电压槽（误接）", s.ampSlot === 'L2' && s.ampError === true, `ampSlot=${s.ampSlot} err=${s.ampError}`);
await place('amp', 'A'); await place('vol', 'L1'); await sl(100);
await pg.mouse.click(scr.sw.x, scr.sw.y); await sl(250);
s = await st();
ok("DOM 点开关 → 断开", s.switchParam === 'off' && near(s.ampReading, 0), `switch=${s.switchParam} amp=${s.ampReading}`);
await pg.mouse.click(scr.sw.x, scr.sw.y); await sl(250);
s = await st();
ok("DOM 再点开关 → 闭合恢复", s.switchParam === 'on' && near(s.ampReading, 0.10), `switch=${s.switchParam} amp=${s.ampReading}`);

// ===== 7) 并联默认 + a/b/c 三槽 =====
await set('mode', 'parallel'); s = await st();
ok("并联默认 0.45A", near(s.ampReading, 0.45), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("并联默认 3.00V", near(s.volReading, 3.00), `vol=${s.volReading} slot=${s.volSlot}`);
ok("并联顶栏 R总=6.7Ω", /R总=6\.7Ω/.test(s.lbl || ''), `lbl=${s.lbl}`);
await snip("d1r-default-parallel.png");
g = await gapCross(['a', 'b', 'c']);
ok("并联默认 a 槽断口真实断开", g.a === 0, JSON.stringify(g));
vp = await volPos();
ok("并联默认电压表在灯泡上方支路里", vp.vy > Math.max(vp.b1y, vp.b2y) && vp.vz < 0.35, JSON.stringify(vp));
bg = await branchGap();
ok("并联默认支路断口真实断开", bg.cross === 0, JSON.stringify(bg));
for (const [slot, want] of [['a', 0.45], ['b', 0.30], ['c', 0.15]]) {
  await place('amp', slot); s = await st();
  ok(`并联 amp ${slot} → ${want}A`, near(s.ampReading, want, 1e-6), `amp=${s.ampReading} slot=${s.ampSlot}`);
}
g = await gapCross(['a', 'b', 'c']);
ok("并联 amp 换到 c → c 槽断口真实断开且 a 恢复连续", g.c === 0 && g.a > 0, JSON.stringify(g));
ok("并联结论含 I = I1 + I2", /I = I1 \+ I2/.test(s.concl || ''), `concl=${s.concl}`);
await snip("d1r-parallel-amp3.png");
await place('vol', 'L2'); s = await st();
ok("并联电压结论 各支路电压相等", /各支路电压相等|均等于电源电压/.test(s.concl || ''), `concl=${s.concl}`);

// ===== 8) 记录表格 + 描点图（DOM 真实点击） =====
await set('mode', 'series'); s = await st();
await pg.evaluate(() => window.__LAB.current().exp._impl.clearRecords()); await sl(150);
await pg.evaluate(() => { const sec = document.querySelector('#dataRecordSection'); if (sec) sec.scrollIntoView({ block: 'center' }); });
await setU(1.5); await click('#recBtn');
await setU(3); await click('#recBtn');
await setU(4.5); await click('#recBtn');
await setU(6); await click('#recBtn');
s = await st();
ok("记录 4 条 (exp)", Array.isArray(s.records) && s.records.length === 4, `len=${s.records && s.records.length}`);
ok("表格 4 行", s.recRowCount === 4, `rows=${s.recRowCount} text=${JSON.stringify(s.recRowsText)}`);
ok("表格行含 U/I 数值", /^1\|0\.50\|0\.050$/.test(s.recRowsText[0] || ''), `row0=${s.recRowsText[0]}`);
ok("描点图有像素", s.chartExists && s.chartW > 0 && s.chartPix > 500, `w=${s.chartW} h=${s.chartH} pix=${s.chartPix}`);
await snip("d1r-record-chart.png");
await click('#recClearBtn'); s = await st();
ok("清空 → 0 条", Array.isArray(s.records) && s.records.length === 0, `len=${s.records && s.records.length}`);
ok("清空 → 表格回到占位提示", s.recRowCount === 0 && s.recEmptyDisplay !== 'none', `rows=${s.recRowCount} emptyDisplay=${s.recEmptyDisplay}`);
// 模式切换清空记录（规格 §6.2）
await setU(3); await click('#recBtn'); s = await st();
ok("模式切换前记录 1 条", Array.isArray(s.records) && s.records.length === 1, `len=${s.records && s.records.length}`);
await set('mode', 'parallel'); s = await st();
ok("模式切换清空记录", Array.isArray(s.records) && s.records.length === 0 && s.recRowCount === 0, `len=${s.records && s.records.length} rows=${s.recRowCount}`);
await set('mode', 'series');
// 底部「重置」清空记录（规格 §6.2）
await setU(3); await click('#recBtn'); await sl(100);
await pg.evaluate(() => window.__LAB.reset()); await sl(900); s = await st();
ok("重置清空记录", Array.isArray(s.records) && s.records.length === 0, `len=${s.records && s.records.length}`);
// 断路时记录被拒
await toggle(); await clearToast(); await click('#recBtn'); s = await st();
ok("断路记录 → toast 含「请先闭合开关并正确接入两只表」", /请先闭合开关并正确接入两只表/.test(s.toast || ''), `toast=${s.toast}`);
ok("断路记录 → 0 条", Array.isArray(s.records) && s.records.length === 0, `len=${s.records && s.records.length}`);
await toggle(); await setU(3);

// ===== 9) 结论：串联 A/B/C + L1/L2/batt =====
await place('amp', 'A'); await place('amp', 'B'); await place('amp', 'C'); s = await st();
ok("串联结论含 I_A = I_B = I_C", /I_A = I_B = I_C/.test(s.concl || ''), `concl=${s.concl}`);
ok("结论卡可见", s.conclVisible === true, `visible=${s.conclVisible}`);
await place('vol', 'L1'); await place('vol', 'L2'); await place('vol', 'batt'); s = await st();
ok("串联结论含 U = U1 + U2", /U = U1 \+ U2/.test(s.concl || ''), `concl=${s.concl}`);
await snip("d1r-series-concl.png");

// ===== 10) 环境 =====
const env = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const vp = document.querySelector('#viewport canvas');
  return { shadowMap: e.ctx && e.ctx.renderer ? e.ctx.renderer.shadowMap.enabled : null, vpCanvas: !!vp, vpW: vp ? vp.width : 0 };
});
ok("shadowMap false", env.shadowMap === false, JSON.stringify(env));
ok("视口 WebGL canvas 存在", env.vpCanvas && env.vpW > 0, JSON.stringify(env));
ok("0 pageerror / console.error", errs.length === 0, errs.join(' | '));
console.log(checks.join('\n'));
console.log('SUMMARY', checks.filter(x => x.includes('FAIL')).length === 0 ? 'ALL PASS' : 'HAS FAIL', checks.length);
await b.close(); server.close();
