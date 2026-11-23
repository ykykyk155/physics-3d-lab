// D1 08 重做自测：双表常显/换位/误接/开关点击/记录 API/结论卡/readouts 六项
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18199;
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
await pg.evaluate(() => window.__LAB.switch("D1-series-parallel")); await sl(1200);
const outDir = path.join(ROOT, "shots", "d1-redo"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? "OK" : "FAIL" + (extra ? "  [" + extra + "]" : "")}`);

const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const ms = e.getMeterState();
  const dist = (a, b) => (a && b) ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : -1;
  return {
    mode: e.p.mode, U: Number(e.p.voltage), Req: e.Req, I: e.I,
    ampReading: e.ampReading, volReading: e.volReading,
    ampSlot: e.ampSlot, volSlot: e.volSlot,
    ampError: e.ampError, volError: e.volError,
    ampLeadDist: dist(ms.amp.leadEnds[0], ms.amp.leadEnds[1]),
    volLeadDist: dist(ms.vol.leadEnds[0], ms.vol.leadEnds[1]),
    lbl: e.lbl && e.lbl.userData && e.lbl.userData.div ? e.lbl.userData.div.textContent : null,
    concl: e.conclTextEl ? e.conclTextEl.textContent : null,
    conclVisible: e.concl ? e.concl.visible === true : null,
    toast: (document.querySelector("#toast") || {}).textContent?.trim?.() || null,
    readouts: (window.__LAB.current().exp.readouts() || []).map(r => [r.label, r.value, r.unit]),
    records: e.recordData ? e.recordData() : null,
    shadow: (window.__LAB.current().exp._impl.scene && window.__LAB.current().exp._impl.scene.children) ? true : true,
  };
});
const set = async (k, v) => { await pg.evaluate((k, v) => { window.__LAB.current().exp._impl.onParam(k, v); }, k, v); await sl(120); };
const setU = async v => { await pg.evaluate(v => { const e = window.__LAB.current().exp._impl; e.onParam('voltage', v); }, v); await sl(150); };
const place = async (m, slot) => { const r = await pg.evaluate((m, slot) => window.__LAB.current().exp._impl.placeMeter(m, slot), m, slot); await sl(120); return r; };
const select = async m => { await pg.evaluate(m => window.__LAB.current().exp._impl.selectMeter(m), m); await sl(80); };
const toggle = async () => { const r = await pg.evaluate(() => window.__LAB.current().exp._impl.toggleSwitch()); await sl(180); return r; };
const clearToast = () => pg.evaluate(() => { const t = document.querySelector('#toast'); if (t) { t.textContent = ''; t.classList.remove('show'); } });
const snip = async name => { if (!/mis/.test(name)) await clearToast(); await sl(40); return pg.screenshot({ path: path.join(outDir, name) }); };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// 1) 默认串联：A + L1，0.10A / 1.00V，readouts 无 —
let s = await st();
ok("默认串联 ampSlot=A", s.ampSlot === 'A', `ampSlot=${s.ampSlot}`);
ok("默认串联 volSlot=L1", s.volSlot === 'L1', `volSlot=${s.volSlot}`);
ok("默认串联 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading}`);
ok("默认串联 1.00V", near(s.volReading, 1.00), `vol=${s.volReading}`);
ok("顶栏 R总=30.0Ω", /R总=30\.0Ω/.test(s.lbl || ''), `lbl=${s.lbl}`);
ok("readouts 6 项", s.readouts.length === 6, JSON.stringify(s.readouts));
ok("readouts 无 —", s.readouts.every(r => String(r[1]) !== '—'), JSON.stringify(s.readouts));
ok("默认 leadEnds 距离>0.3 (amp)", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);
ok("默认 leadEnds 距离>0.3 (vol)", s.volLeadDist > 0.3, `d=${s.volLeadDist}`);
await snip("d1r-default-series.png");

// 2) 电压 6V → 0.20A / 2.00V
await setU(6); s = await st();
ok("6V → 0.20A", near(s.ampReading, 0.20), `amp=${s.ampReading}`);
ok("6V → 2.00V", near(s.volReading, 2.00), `vol=${s.volReading}`);
await setU(3);

// 3) 开关
await toggle(); s = await st();
ok("断开 → 电流表 0", near(s.ampReading, 0), `amp=${s.ampReading}`);
ok("断开 → 电压表跨 L1 = 0", near(s.volReading, 0), `vol=${s.volReading}`);
await toggle(); s = await st();
ok("恢复闭合 → 0.10A/1.00V", near(s.ampReading, 0.10) && near(s.volReading, 1.00), `${s.ampReading}/${s.volReading}`);

// 4) 电流表换位 B/C
await place('amp', 'B'); s = await st();
ok("amp 换到 B → 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("B leadEnds>0.3", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);
await place('amp', 'C'); s = await st();
ok("amp 换到 C → 0.10A", near(s.ampReading, 0.10), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("C leadEnds>0.3", s.ampLeadDist > 0.3, `d=${s.ampLeadDist}`);

// 5) 电压表换位 L2/batt
await place('vol', 'L2'); s = await st();
ok("vol 换到 L2 → 2.00V", near(s.volReading, 2.00), `vol=${s.volReading} slot=${s.volSlot}`);
await place('vol', 'batt'); s = await st();
ok("vol 换到 batt → 3.00V", near(s.volReading, 3.00), `vol=${s.volReading} slot=${s.volSlot}`);

// 6) 误接
await place('vol', 'A'); s = await st();
ok("误接 vol→A toast 含「电压表应与被测元件并联」", /电压表应与被测元件并联/.test(s.toast || ''), `toast=${s.toast}`);
ok("误接 vol→A 读数 —", s.volReading === '—' || s.volReading === '-', `vol=${s.volReading}`);
await snip("d1r-mis-vol.png");
await place('amp', 'L1'); s = await st();
ok("误接 amp→L1 toast 含「电流表应串联接入被测电路」", /电流表应串联接入被测电路/.test(s.toast || ''), `toast=${s.toast}`);
ok("误接 amp→L1 读数 —", s.ampReading === '—' || s.ampReading === '-', `amp=${s.ampReading}`);
await snip("d1r-mis-amp.png");

// 7) 并联默认 + a/b/c
await set('mode', 'parallel'); s = await st();
ok("并联默认 0.45A", near(s.ampReading, 0.45), `amp=${s.ampReading} slot=${s.ampSlot}`);
ok("并联默认 3.00V", near(s.volReading, 3.00), `vol=${s.volReading} slot=${s.volSlot}`);
ok("并联顶栏 R总=6.7Ω", /R总=6\.7Ω/.test(s.lbl || ''), `lbl=${s.lbl}`);
await snip("d1r-default-parallel.png");
for (const [slot, want] of [['a', 0.45], ['b', 0.30], ['c', 0.15]]) {
  await place('amp', slot); s = await st();
  ok(`并联 amp ${slot} → ${want}A`, near(s.ampReading, want, 1e-6), `amp=${s.ampReading} slot=${s.ampSlot}`);
}
// 结论 I=I1+I2
ok("并联三连结论含 I = I1 + I2", /I = I1 \+ I2/.test(s.concl || ''), `concl=${s.concl}`);
await snip("d1r-parallel-amp3.png");

// 8) 记录（电压 1.5/3/4.5/6 各记一次）
await set('mode', 'series');
await pg.evaluate(() => window.__LAB.current().exp._impl.clearRecords());
for (const u of [1.5, 3, 4.5, 6]) {
  await setU(u);
  const r = await pg.evaluate(() => window.__LAB.current().exp._impl.recordSample());
  ok(`记录 U=${u} ok`, r && r.ok === true, JSON.stringify(r));
}
s = await st();
ok("records 4 条", Array.isArray(s.records) && s.records.length === 4, `len=${s.records && s.records.length}`);
const cleared = await pg.evaluate(() => { window.__LAB.current().exp._impl.clearRecords(); return window.__LAB.current().exp._impl.recordData().length; });
ok("清空后 0 条", cleared === 0, `len=${cleared}`);
await setU(3);

// 9) 结论：串联 A/B/C
await place('amp', 'A'); await place('amp', 'B'); await place('amp', 'C'); s = await st();
ok("串联结论含 I_A = I_B = I_C", /I_A = I_B = I_C/.test(s.concl || ''), `concl=${s.concl}`);
ok("结论卡可见", s.conclVisible === true, `visible=${s.conclVisible}`);
await snip("d1r-series-amp3-concl.png");

// 10) 环境
const shadow = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  return { shadowMap: e.ctx && e.ctx.renderer ? e.ctx.renderer.shadowMap.enabled : null };
});
ok("shadowMap false", shadow.shadowMap === false, JSON.stringify(shadow));
ok("0 pageerror", errs.length === 0, errs.join(' | '));

console.log(checks.join('\n'));
console.log('SUMMARY', checks.filter(x => x.includes('FAIL')).length === 0 ? 'ALL PASS' : 'HAS FAIL', checks.length);
await b.close(); server.close();
