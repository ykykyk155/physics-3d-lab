// D2(09) 重做验收：完整串联电路/三因素改电阻/开关通断/粒子流/readouts/3D 环境/真实点击
// 数值口径（规格 §2 校正）：R = ρ×(L/100)×(1/S)÷strands×(1+temp×0.002)，U=6V，I=6/R
//   temp 系数只乘一次（默认 20℃ 已含 1.04）：temp=100 → R=8×0.5×1.2=4.8（不是 4.992，那是双重计温）
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
await pg.evaluate(() => window.__LAB.switch("D2-resistance-factor")); await sl(1200);
const outDir = path.join(ROOT, "shots", "d2-redo"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? "OK" : "FAIL" + (extra ? "  [" + extra + "]" : "")}`);
const near = (a, b2, eps = 1e-6) => Math.abs(a - b2) < eps;
const bootState = await pg.evaluate(() => { const n = document.querySelector('#boot'); if (!n) return { missing: true }; const cs = getComputedStyle(n); return { display: cs.display, opacity: cs.opacity }; });
ok("启动遮罩已淡出（场景就绪后不遮挡）", bootState.missing || bootState.display === 'none' || Number(bootState.opacity) === 0, JSON.stringify(bootState));

const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  return {
    R: e.R, I: e.I, on: e.on, lenScale: e.lenScale, matIdx: e.matIdx, rad: e.rad,
    switchParam: window.__LAB.store.params.switch,
    filamentIntensity: e.bulbG && e.bulbG.userData && e.bulbG.userData.filament ? e.bulbG.userData.filament.material.emissiveIntensity : null,
    glassOpacity: e.bulbG && e.bulbG.userData && e.bulbG.userData.glass ? e.bulbG.userData.glass.material.opacity : null,
    elecVisible: e.elec && e.elec[0] ? e.elec[0].visible : null,
    needle: e.meterG && e.meterG.userData && e.meterG.userData.needle ? e.meterG.userData.needle.rotation.z : null,
    lbl: e.lbl && e.lbl.userData && e.lbl.userData.div ? e.lbl.userData.div.textContent : null,
    ampLabel: e.ampVal && e.ampVal.userData && e.ampVal.userData.div ? e.ampVal.userData.div.textContent : null,
    barScale: e.bar ? [e.bar.scale.x, e.bar.scale.y, e.bar.scale.z] : null,
    readouts: (window.__LAB.current().exp.readouts() || []).map(r => [r.label, r.value, r.unit]),
    wireSegCount: e.wires.reduce((n, w) => { const a = w.geometry && w.geometry.attributes && w.geometry.attributes.instanceStart; return n + (a ? a.data.array.length / 6 : 0); }, 0),
    hasBattery: !!e.battG, hasSwitch: !!e.switchG, hasMeter: !!e.meterG, hasBulb: !!e.bulbG, hasBar: !!e.bar,
  };
});
const set = async (k, v) => { await pg.evaluate((k, v) => { window.__LAB.current().exp._impl.onParam(k, v); }, k, v); await sl(130); };
const toggle = async () => { const r = await pg.evaluate(() => window.__LAB.current().exp._impl.toggleSwitch()); await sl(180); return r; };
const snip = async name => pg.screenshot({ path: path.join(outDir, name) });
// 电气接口断言：读 3D 导线实例段，判断电流表缺口 [meterX±0.198] 是否被导线跨越
const gapCross = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const { meterX, yT } = e._geo();
  const L = meterX - 0.198, R2 = meterX + 0.198;
  let crossing = 0; let minX = 1e9, maxX = -1e9;
  for (const w of e.wires) {
    const a = w.geometry && w.geometry.attributes && w.geometry.attributes.instanceStart; if (!a) continue;
    const d = a.data.array;
    for (let i = 0; i + 5 < d.length; i += 6) {
      const x1 = d[i], y1 = d[i + 1], x2 = d[i + 3], y2 = d[i + 4];
      minX = Math.min(minX, x1, x2); maxX = Math.max(maxX, x1, x2);
      if (Math.abs(y1 - yT) < 0.03 && Math.abs(y2 - yT) < 0.03 && Math.min(x1, x2) < R2 - 0.005 && Math.max(x1, x2) > L + 0.005) crossing++;
    }
  }
  return { crossing, width: maxX - minX };
});

// ===== 1) 默认：镍铬 / 50cm / 1.0 / 1根 / 20℃ =====
let s = await st();
const Rdef = 8 * 0.5 * 1.04;                       // 4.16
const Idef = 6 / Rdef;                              // ≈1.442
ok("默认 R≈4.16", near(s.R, Rdef, 0.02), `R=${s.R}`);
ok("默认 I≈1.44", near(s.I, Idef, 0.01), `I=${s.I}`);
ok("默认闭合 on=true", s.on === true, `on=${s.on}`);
ok("默认 store.switch=on", s.switchParam === 'on', `switchParam=${s.switchParam}`);
ok("默认顶栏 R = ρL/S = 4.16 Ω", /R = ρL\/S = 4\.16 Ω/.test(s.lbl || ''), `lbl=${s.lbl}`);
ok("默认电流表标签 I = 1.44 A", /I = 1\.44[0-9]* A/.test(s.ampLabel || ''), `amp=${s.ampLabel}`);
ok("readouts 6 项且无 NaN/空串", s.readouts.length === 6 && s.readouts.every(r => (typeof r[1] === 'number' && isFinite(r[1])) || String(r[1]).trim() !== ''), JSON.stringify(s.readouts));
ok("readouts 含 I=1.44A", s.readouts.some(r => r[0] === '电流 I' && near(Number(r[1]), Idef, 0.01)), JSON.stringify(s.readouts));
ok("readouts 含 R=4.16Ω", s.readouts.some(r => r[0] === '电阻 R' && near(Number(r[1]), Rdef, 0.02)), JSON.stringify(s.readouts));
ok("readouts 含 ρ=8", s.readouts.some(r => r[0] === '电阻率 ρ' && Number(r[1]) === 8), JSON.stringify(s.readouts));
ok("readouts 含 L=50 / S=1.0 / 温度20", s.readouts.some(r => r[0] === '长度 L' && Number(r[1]) === 50) && s.readouts.some(r => r[0] === '横截面积 S' && near(Number(r[1]), 1, 0.001)) && s.readouts.some(r => r[0] === '温度' && Number(r[1]) === 20), JSON.stringify(s.readouts));
ok("粒子可见（闭合）", s.elecVisible === true, `elec=${s.elecVisible}`);
ok("灯泡亮（filament 发光）", s.filamentIntensity !== null && s.filamentIntensity > 1.4, `fil=${s.filamentIntensity}`);
ok("3D 五元件齐（电池/闸刀/电流表/灯泡/导体）", s.hasBattery && s.hasSwitch && s.hasMeter && s.hasBulb && s.hasBar, JSON.stringify(s));
let gg = await gapCross();
ok("电流表缺口真实断开（无导线跨越）", gg.crossing === 0, JSON.stringify(gg));
ok("主矩形宽≈5.2（xR-xL）", near(gg.width, 5.2, 0.2), `w=${gg.width}`);
await snip("d2r-1-default.png");

// ===== 2) 开关 toggle（API）+ 参数面板同步 =====
await toggle(); s = await st();
ok("断开 → I=0", near(s.I, 0), `I=${s.I}`);
ok("断开 → readouts 电流 0（合理值非空串）", s.readouts.some(r => r[0] === '电流 I' && near(Number(r[1]), 0)), JSON.stringify(s.readouts));
ok("断开 → 粒子 invisible", s.elecVisible === false, `elec=${s.elecVisible}`);
ok("断开 → store.switch=off", s.switchParam === 'off', `switchParam=${s.switchParam}`);
ok("断开 → 电流表标签 I = 0.000 A", /I = 0\.000 A/.test(s.ampLabel || ''), `amp=${s.ampLabel}`);
ok("断开 → 灯泡灭（filament 1.4 底值）", s.filamentIntensity !== null && near(s.filamentIntensity, 1.4, 0.01), `fil=${s.filamentIntensity}`);
await snip("d2r-2-switch-off.png");
await toggle(); s = await st();
ok("恢复闭合 → I≈1.44", near(s.I, Idef, 0.01), `I=${s.I}`);
ok("恢复 → store.switch=on", s.switchParam === 'on', `switchParam=${s.switchParam}`);

// ===== 3) len 100 / 10 =====
await set('len', 100); s = await st();
const R100 = 8 * 1.0 * 1.04;                       // 8.32
ok("len=100 → R≈8.32", near(s.R, R100, 0.02), `R=${s.R}`);
ok("len=100 → I≈0.72", near(s.I, 6 / R100, 0.01), `I=${s.I}`);
ok("len=100 → 导体变长（bar.scale.x≈1.58）", near(s.barScale[0], (0.8 + 1.0 * 2.2) / 1.9, 0.02), `scaleX=${s.barScale[0]}`);
await set('len', 10); s = await st();
const R10 = 8 * 0.1 * 1.04;                        // 0.832
ok("len=10 → R≈0.832", near(s.R, R10, 0.01), `R=${s.R}`);
ok("len=10 → I≈7.21", near(s.I, 6 / R10, 0.03), `I=${s.I}`);
ok("len=10 → 超量程标签带 ⚠", /⚠/.test(s.ampLabel || ''), `amp=${s.ampLabel}`);
await set('len', 50);

// ===== 4) area 4 / 0.5 =====
await set('area', 4); s = await st();
const R4 = 8 * 0.5 * 0.25 * 1.04;                  // 1.04
ok("area=4 → R≈1.04", near(s.R, R4, 0.01), `R=${s.R}`);
ok("area=4 → I≈5.77", near(s.I, 6 / R4, 0.03), `I=${s.I}`);
ok("area=4 → 导体变粗（bar.scale.y≈1.6）", near(s.barScale[1], (0.025 + Math.sqrt(4 / 4) * 0.075) / 0.0625, 0.02), `scaleY=${s.barScale[1]}`);
await set('area', 1.0);

// ===== 5) 材料 铜2 / 铁4 =====
await set('mat', 2); s = await st();
const Rcu = 2 * 0.5 * 1.04;                        // 1.04
ok("铜 → R≈1.04", near(s.R, Rcu, 0.01), `R=${s.R}`);
ok("铜 → I≈5.77", near(s.I, 6 / Rcu, 0.03), `I=${s.I}`);
ok("铜 → matIdx=2", s.matIdx === 2, `matIdx=${s.matIdx}`);
await set('mat', 4); s = await st();
const Rfe = 4 * 0.5 * 1.04;                        // 2.08
ok("铁 → R≈2.08", near(s.R, Rfe, 0.01), `R=${s.R}`);
ok("铁 → I≈2.88", near(s.I, 6 / Rfe, 0.01), `I=${s.I}`);
ok("铁 → matIdx=3", s.matIdx === 3, `matIdx=${s.matIdx}`);
await set('mat', 8);

// ===== 6) 温度（口径：系数只乘一次） =====
await set('temp', 100); s = await st();
const R100t = 8 * 0.5 * 1.2;                       // 4.8（不是 4.992）
ok("temp=100 → R≈4.8", near(s.R, R100t, 0.02), `R=${s.R}`);
ok("temp=100 → I≈1.25", near(s.I, 6 / R100t, 0.01), `I=${s.I}`);
await set('temp', 20); s = await st();
ok("temp=20 恢复 → R≈4.16", near(s.R, Rdef, 0.02), `R=${s.R}`);

// ===== 7) strands 4 =====
await set('strands', 4); s = await st();
const Rs4 = Rdef / 4;                              // 1.04
ok("strands=4 → R≈1.04", near(s.R, Rs4, 0.01), `R=${s.R}`);
ok("strands=4 → I≈5.77", near(s.I, 6 / Rs4, 0.03), `I=${s.I}`);
await set('strands', 1); s = await st();
ok("strands=1 恢复 → R≈4.16", near(s.R, Rdef, 0.02), `R=${s.R}`);

// ===== 8) 真实 DOM 点击开关（投影坐标，非 API） =====
const scr = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const cam = e.ctx.camera; const rect = document.querySelector('#viewport').getBoundingClientRect();
  const toS = v => { const q = v.clone().project(cam); return { x: rect.left + (q.x * 0.5 + 0.5) * rect.width, y: rect.top + (-q.y * 0.5 + 0.5) * rect.height }; };
  return toS(e.switchG.position);
});
await pg.mouse.click(scr.x, scr.y); await sl(250);
s = await st();
ok("DOM 点闸刀 → 断开（I=0、store=off）", near(s.I, 0) && s.switchParam === 'off', `I=${s.I} sw=${s.switchParam}`);
await pg.mouse.click(scr.x, scr.y); await sl(250);
s = await st();
ok("DOM 再点闸刀 → 闭合恢复（I≈1.44）", near(s.I, Idef, 0.01) && s.switchParam === 'on', `I=${s.I} sw=${s.switchParam}`);

// ===== 9) 指针随电流（setMeterNeedle 生效） =====
const n0 = s.needle;
await set('mat', 2); s = await st();
ok("换铜（I↑）指针偏转变大", near(s.needle, (0.5 - Math.min(1, (6 / 1.04) / 3)) * 1.9, 0.02), `needle=${s.needle} (default=${n0})`);
await set('mat', 8);

// ===== 10) 环境 / 报错 =====
await set('len', 100); await set('area', 1.0); await set('mat', 2); await set('temp', 20); await set('strands', 1);
s = await st();
ok("铜 L=100 → R≈2.08、I≈2.88（三联图第三态）", near(s.R, 2.08, 0.02) && near(s.I, 2.88, 0.01), `R=${s.R} I=${s.I}`);
await snip("d2r-9-copper-l100.png");
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