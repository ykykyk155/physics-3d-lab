// D2(09) 重做自测（临时）：数值断言 + 开关 + 粒子可见性 + 导体 scale + 截图三联
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
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 1300, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
await pg.evaluate(() => window.__LAB.switch("D2-resistance-factor")); await sl(1400);
const outDir = path.join(ROOT, "shots", "d2-redo"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? "OK" : "FAIL" + (extra ? "  [" + extra + "]" : "")}`);
const near = (a, b2, eps) => Math.abs(a - b2) < (eps || 1e-6);
const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const sh = window.__LAB.store;
  return {
    R: e.R, I: e.I, on: e.on, switchP: sh.params.switch,
    lenScale: e.lenScale, matIdx: e.matIdx,
    barScale: e.bar ? [e.bar.scale.x, e.bar.scale.y, e.bar.scale.z] : null,
    meterPos: e.meterG ? [e.meterG.position.x, e.meterG.position.y, e.meterG.position.z] : null,
    bulbPos: e.bulbG ? [e.bulbG.position.x, e.bulbG.position.y, e.bulbG.position.z] : null,
    switchPos: e.switchG ? [e.switchG.position.x, e.switchG.position.y] : null,
    battPos: e.battG ? [e.battG.position.x, e.battG.position.y] : null,
    elecVisible: e.elec && e.elec.length ? e.elec[0].visible : null,
    elecCount: e.elec && e.elec.length ? e.elec[0].count : null,
    wireCount: e.wires ? e.wires.length : null,
    loopPoly: e._loopPoly ? e._loopPoly.map(p => [p.x, p.y]) : null,
    lbl: e.lbl && e.lbl.userData && e.lbl.userData.div ? e.lbl.userData.div.textContent : null,
    ampVal: e.ampVal && e.ampVal.userData && e.ampVal.userData.div ? e.ampVal.userData.div.textContent : null,
    readouts: (window.__LAB.current().exp.readouts() || []).map(r => [r.label, r.value, r.unit]),
    shadow: (window.__LAB.current().exp._impl.ctx && window.__LAB.current().exp._impl.ctx.renderer) ? window.__LAB.current().exp._impl.ctx.renderer.shadowMap.enabled : null,
    ampLabelPos: e.ampVal ? [e.ampVal.position.x, e.ampVal.position.y, e.ampVal.position.z] : null,
  };
});
const set = async (k, v) => {
  await pg.evaluate((k, v) => {
    const blk = document.querySelector('.param-block[data-pid="' + k + '"]');
    if (!blk) throw new Error('no-block ' + k);
    const input = blk.querySelector('input[type=range]');
    if (input) { input.value = String(v); input.dispatchEvent(new Event('input', { bubbles: true })); return; }
    const b = blk.querySelector('.seg button[data-oid="' + String(v) + '"]'); if (b) { b.click(); return; }
    const li = blk.querySelector('.dropdown li[data-oid="' + String(v) + '"]'); if (li) { li.click(); return; }
    throw new Error('no-control ' + k);
  }, k, v);
  await sl(250);
};
const toggle = async () => { const r = await pg.evaluate(() => window.__LAB.current().exp._impl.toggleSwitch()); await sl(200); return r; };
const snap = async name => pg.screenshot({ path: path.join(outDir, name) });

// 1. 默认
let s = await st();
ok("默认 R≈4.16", near(s.R, 4.16, 0.02), "R=" + s.R);
ok("默认 I≈1.44", near(s.I, 1.44, 0.01), "I=" + s.I);
ok("默认闭合 on", s.on === true && s.switchP === "on");
ok("粒子 30 个可见", s.elecVisible === true && s.elecCount === 30);
ok("导线 6 段", s.wireCount === 6, "wires=" + s.wireCount);
ok("电池/开关/灯泡/表/导体齐备", s.battPos && s.switchPos && s.bulbPos && s.meterPos && s.barScale);
ok("顶栏标签 R=4.16", (s.lbl || "").includes("4.16"), s.lbl);
ok("电流表读数 I=1.442/1.443", /I\s*=\s*1\.44/.test(s.ampVal || ""), s.ampVal);
ok("读口 6 项且无 NaN", s.readouts.length === 6 && s.readouts.every(r => r[1] !== null && r[1] !== undefined && !Number.isNaN(Number(r[1]))), JSON.stringify(s.readouts));
const rhoItem = s.readouts.find(r => r[0].includes("电阻率"));
ok("ρ 单位 Ω·mm²/m", rhoItem && rhoItem[2] === "Ω·mm²/m", JSON.stringify(rhoItem));
await snap("d2r-default-series.png");

// 2. 开关断开/闭合
s = await st();
ok("闭环粒子沿矩形", s.loopPoly && s.loopPoly[0][0] === -2.6 && s.loopPoly[1][0] === 2.6 && s.loopPoly[2][1] === 2.9, JSON.stringify(s.loopPoly));
let r = await toggle();
s = await st();
ok("toggleSwitch→断开 I=0 粒子停", r === "off" && near(s.I, 0, 1e-9) && s.elecVisible === false, "I=" + s.I + " vis=" + s.elecVisible);
ok("开关参数联动 off", s.switchP === "off");
ok("断路读数 I=0.000", (s.ampVal || "").includes("0.000"), s.ampVal);
await snap("d2r-switched-off.png");
r = await toggle();
s = await st();
ok("再toggle→恢复", r === "on" && near(s.I, 1.44, 0.01) && s.elecVisible === true, "I=" + s.I);

// 3. 参数联动
await set("len", 100);
s = await st();
ok("len=100→R=8.32 I 减半", near(s.R, 8.32, 0.05) && near(s.I, 6 / s.R, 1e-6) && s.I < 1, "R=" + s.R + " I=" + s.I);
ok("bar.scale.x 随长度变大", s.barScale[0] > 1.4, JSON.stringify(s.barScale));
await set("len", 10);
s = await st();
ok("len=10→R≈0.832", near(s.R, 0.832, 0.02), "R=" + s.R);
ok("bar.scale.x 随长度变小", s.barScale[0] < 0.7, JSON.stringify(s.barScale));
await set("len", 50);
await set("area", 4);
s = await st();
ok("area=4→R≈1.04", near(s.R, 1.04, 0.02), "R=" + s.R);
ok("bar.scale.yz 随面积变大", s.barScale[1] > 1.4, JSON.stringify(s.barScale));
await set("area", 1);
await set("mat", 2);
s = await st();
ok("铜2→R≈1.04 I≈5.77", near(s.R, 1.04, 0.02) && near(s.I, 6 / s.R, 1e-6) && s.I > 5, "R=" + s.R + " I=" + s.I);
ok("matIdx=铜(2)", s.matIdx === 2, "idx=" + s.matIdx);
await set("mat", 4);
s = await st();
ok("铁4→R≈2.08", near(s.R, 2.08, 0.02), "R=" + s.R);
await set("mat", 8);
await set("strands", 4);
s = await st();
ok("strands=4→R÷4≈1.04", near(s.R, 1.04, 0.02), "R=" + s.R);
ok("多根导体 bar 存在", s.barScale != null);
await set("strands", 1);
await set("temp", 100);
s = await st();
ok("temp=100→按 §2 公式 R=4.8", near(s.R, 4.8, 0.02), "R=" + s.R);
await set("temp", 20);
s = await st();
ok("复原默认 R≈4.16", near(s.R, 4.16, 0.02), "R=" + s.R);

// 4. 环境
ok("shadowMap=false", s.shadow === false);
ok("0 pageerror / 0 console.error", errs.length === 0, errs.join(" | ").slice(0, 300));

// 5. 视觉三联：默认 / 换铜(L=100) / 断开
await set("mat", 2); await set("len", 100); await sl(250);
await snap("d2r-copper-l100.png");
await toggle(); await sl(200);
await snap("d2r-copper-off.png");
await toggle();

console.log(checks.join("\n"));
const fails = checks.filter(c => c.includes("FAIL"));
console.log("SUMMARY " + (fails.length ? "HAS FAIL " + fails.length : "ALL PASS") + " / " + checks.length);
await b.close(); server.close();
process.exit(fails.length ? 1 : 0);