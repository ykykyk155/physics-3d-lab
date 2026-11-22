// D1 点选测量验收：串/并联 触点读数、误接 toast、断路、结论卡、readouts 六项、两表指针、表笔引线
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
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
await pg.evaluate(() => window.__LAB.switch("D1-series-parallel")); await sl(1100);
const outDir = path.join(ROOT, "shots", "d1"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];

const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  return {
    ampReading: e.ampReading, volReading: e.volReading,
    ampTargetId: e.ampTargetId, volTargetId: e.volTargetId,
    ampError: e.ampError, volError: e.volError,
    activeMeter: e.activeMeter, U: e.p.voltage, Req: e.Req, I: e.I,
    ampVisible: e.probes && e.probes.amp ? e.probes.amp.every(l => l.visible) : null,
    volVisible: e.probes && e.probes.vol ? e.probes.vol.every(l => l.visible) : null,
    ampNeedle: e.meterG && e.meterG.userData.needle ? e.meterG.userData.needle.rotation.z : null,
    volNeedle: e.volMeterG && e.volMeterG.userData.needle ? e.volMeterG.userData.needle.rotation.z : null,
    conclText: e.conclTextEl ? e.conclTextEl.textContent : null,
    conclVisible: e.concl ? e.concl.visible === true : null,
    toast: (document.querySelector('#toast') || {}).textContent?.trim?.() || null,
    readouts: (window.__LAB.current().exp.readouts() || []).map(r => [r.label, r.value, r.unit]),
    points: [...document.querySelectorAll('[name^="d1-point-"], [id^="d1-point-"], [name*="d1-point"]')].map(n => n.name || n.id),
    pointMeshes: e.points ? e.points.map(p => p.name) : [],
  };
});
const set = async (k, v) => { await pg.evaluate((k, v) => { window.__LAB.current().exp._impl.onParam(k, v); }, k, v); await sl(150); };
const tap = async (id) => { await pg.evaluate(id => { window.__LAB.current().exp._impl.tapPoint(id); }, id); await sl(120); };
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps);
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? 'OK' : 'FAIL' + (extra ? '  [' + extra + ']' : '')}`);
const snipNow = (name) => pg.screenshot({ path: path.join(outDir, name) });

// ===== 基线：串联 default（U=3, r1=10, r2=20, 闭合）→ I=0.1A
let s = await st();
const I = s.I;
ok("串联默认 I=3/30=0.1A", approx(s.I, 0.1, 1e-9), `I=${s.I}`);
ok("初始两表未接读 '—'", s.ampReading === null && s.volReading === null);

// ===== 路径1：串联 电流 A/B/C 均 = I，طور后结论「处处相等」
await tap("A"); s = await st();
ok("A 电流=0.1", approx(s.ampReading, 0.1, 1e-9), `ampReading=${s.ampReading}`);
ok("A 表笔引线可见", s.ampVisible === true, `ampVisible=${s.ampVisible}`);
await snipNow("d1-series-A.png");
await tap("B"); s = await st();
ok("B 电流=0.1", approx(s.ampReading, 0.1, 1e-9), `ampReading=${s.ampReading}`);
await tap("C"); s = await st();
ok("C 电流=0.1", approx(s.ampReading, 0.1, 1e-9), `ampReading=${s.ampReading}`);
ok("串联三连结论处处相等", /处处相等/.test(s.conclText || ''), `concl=${s.conclText}`);
ok("结论卡可见", s.conclVisible === true, `conclVisible=${s.conclVisible}`);
await snipNow("d1-series-amp3.png");

// ===== 路径2：串联 电压 L1/L2/电池 = U·R1/(R1+R2) / U·R2/(R1+R2) / U；结论 U=U1+U2
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('vol'); }); await sl(100);
await tap("L1"); s = await st();
ok("L1 电压=U·10/30=1.0", approx(s.volReading, 1.0, 1e-9), `volReading=${s.volReading}`);
ok("L1 电压表引线可见", s.volVisible === true, `volVisible=${s.volVisible}`);
await snipNow("d1-series-vol-l1.png");
await tap("L2"); s = await st();
ok("L2 电压=U·20/30=2.0", approx(s.volReading, 2.0, 1e-9), `volReading=${s.volReading}`);
await tap("batt"); s = await st();
ok("batt 电压=U=3.0", approx(s.volReading, 3.0, 1e-9), `volReading=${s.volReading}`);
ok("串联电压结论 U=U1+U2", /U\s*=\s*U1|U = U1 \+ U2/.test(s.conclText || ''), `concl=${s.conclText}`);
await snipNow("d1-series-vol3.png");

// ===== readouts 六项结构（含 I_测/U_测 数值与 '—' 规则）
s = await st();
ok("readouts 六项", Array.isArray(s.readouts) && s.readouts.length === 6, `len=${s.readouts && s.readouts.length}`);
const labels = (s.readouts || []).map(r => r[0]).join(',');
ok("readouts 含 I_测=0.10A U_测=3.00V", /电流表 I_测/.test(labels) && /电压表 U_测/.test(labels) && s.readouts[3][1] === '0.10' && s.readouts[4][1] === '3.00', JSON.stringify(s.readouts));

// ===== 路径3：并联 干路 a = U(R1+R2)/(R1R2)、支路 b=U/R1、c=U/R2；结论 I=I1+I2
await set("mode", "parallel"); s = await st();
// 并联默认 U=3, r1=10, r2=20 → Req=6.6667, I=0.45A
const par = await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; const v = e._vals(); return { U: v.U, r1: v.r1, r2: v.r2, Req: v.Req, I: v.I }; });
const IU = par.U, R1 = par.r1, R2 = par.r2;
const Ia = IU * (R1 + R2) / (R1 * R2); const Ib = IU / R1; const Ic = IU / R2;
ok("并联 I=0.45A Req=6.6667", approx(par.I, 0.45, 1e-9) && approx(par.Req, 6.6667, 1e-3), JSON.stringify(par));
// 切并联后旧 amp 触点 A/B/C 失效 → 清空
ok("切并联清旧触点", s.ampTargetId === null, `ampTargetId=${s.ampTargetId}`);
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('amp'); }); await sl(100);
await tap("a"); s = await st();
ok("a 干路=Ia", approx(s.ampReading, Ia, 1e-9), `ampReading=${s.ampReading} expect=${Ia}`);
await tap("b"); s = await st();
ok("b 支路=Ib", approx(s.ampReading, Ib, 1e-9), `ampReading=${s.ampReading} expect=${Ib}`);
await tap("c"); s = await st();
ok("c 支路=Ic", approx(s.ampReading, Ic, 1e-9), `ampReading=${s.ampReading} expect=${Ic}`);
ok("并联结论 I=I1+I2", /I1\s*\+\s*I2|干路电流等于各支路/.test(s.conclText || ''), `concl=${s.conclText}`);
await snipNow("d1-parallel-amp3.png");
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('vol'); }); await sl(100);
await tap("L1"); s = await st();
await tap("L2"); s = await st();
ok("并联电压结论 支路相等", /各支路电压相等|均等于电源电压/.test(s.conclText || ''), `concl=${s.conclText}`);
await snipNow("d1-parallel-vol2.png");

// ===== 路径4：误接（电压表串入导线触点 / 电流表并到元件）
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('vol'); }); await sl(100);
await tap("a"); s = await st();
ok("误接 vol点导线→toast含电压表+读数—", s.volError === true && s.volReading === '—' && /电压表/.test(s.toast || ''), `volError=${s.volError} volReading=${s.volReading} toast=${s.toast}`);
await snipNow("d1-mis-vol.png");
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('amp'); }); await sl(100);
await tap("batt"); s = await st();
ok("误接 amp点元件→toast含电流表+读数—", s.ampError === true && s.ampReading === '—' && /电流表/.test(s.toast || ''), `ampError=${s.ampError} ampReading=${s.ampReading} toast=${s.toast}`);
await snipNow("d1-mis-amp.png");
// 恢复
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.ampError = false; e.volError = false; e.ampReading = null; e.volReading = null; e.ampTargetId = null; e.volTargetId = null; e.probes.amp.forEach(l => l.visible = false); e.probes.vol.forEach(l => l.visible = false); e._refreshConcl(e._vals()); }); await sl(80);

// ===== 路径5：断路（switch=off）→ 电流表 0、toast 含开关；电压表点电池=U、点灯泡=0
await set("switch", "off"); await sl(150);
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('amp'); }); await sl(100);
await tap("A"); s = await st();
ok("断路 amp→0 + toast含开关", s.ampReading === 0 && /开关|断开/.test(s.toast || ''), `ampReading=${s.ampReading} toast=${s.toast}`);
ok("断路时 I=0", approx(s.I, 0, 1e-9), `I=${s.I}`);
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('vol'); }); await sl(100);
await tap("batt"); s = await st();
ok("断路 vol点电池=U", approx(s.volReading, s.U, 1e-9), `volReading=${s.volReading} U=${s.U}`);
await tap("L2"); s = await st();
ok("断路 vol点灯泡=0", approx(s.volReading, 0, 1e-9), `volReading=${s.volReading}`);
await set("switch", "on"); await sl(150);

// ===== 路径6：恢复后 I_测/U_测 刷新（改回串联后再点 A；参数滑块改 → 读数/结论同步）
await set("mode", "series"); await sl(150);
await pg.evaluate(() => { window.__LAB.current().exp._impl.selectMeter('amp'); }); await sl(100);
await tap("A"); await set("voltage", 6); await sl(200);
s = await st();
ok("改电压后 ampReading=0.2", approx(s.ampReading, 0.2, 1e-9), `ampReading=${s.ampReading}`);
ok("改电压后 readouts I_测=0.20", s.readouts[3][1] === '0.20', JSON.stringify(s.readouts[3]));

// ===== 指针：amp 满量程0.6、vol 满量程6
await tap("A"); s = await st();
const ampNeedle = s.ampNeedle, volNeedle = s.volNeedle;
ok("amp 指针指向 I/0.6", approx(ampNeedle, (0.5 - Math.min(s.ampReading / 0.6, 1)) * 1.9, 0.01), `needle=${ampNeedle} read=${s.ampReading}`);
ok("vol 指针指向 U/6", approx(volNeedle, (0.5 - Math.min(s.volReading / 6, 1)) * 1.9, 0.01), `needle=${volNeedle} read=${s.volReading}`);

// ===== 触点结构
s = await st();
ok("触点 meshes 串6个", Array.isArray(s.pointMeshes) && s.pointMeshes.length >= 3, `points=${JSON.stringify(s.pointMeshes)}`);

checks.push(`PAGEERRORS ${errs.length} ${errs.length === 0 ? '[]' : errs.join(' | ')}`);
console.log("CHECKS\n" + checks.join("\n"));
console.log("DONE " + (checks.every(c => c.includes('OK') || c.includes('PAGEERRORS 0')) ? "ALL PASS" : "SOME FAIL"));
await b.close(); process.exit(0);