// A5 浮沉自洽验收：漂浮/下沉/完全浸没恒定/悬浮/配重越临界 + 下潜深度滑块置灰 + 截图
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18197;
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
await pg.evaluate(() => window.__LAB.switch("A5-buoyancy")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a5-float"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];

// 读引擎状态（exp._impl 才是实例）
const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const sub = document.querySelector('.param-block[data-pid="submerge"]');
  return {
    side: e.side, subFrac: e.subFrac, G: e.G, Fb: e.Fb, read: e.read,
    state: e._subState, status: e._status, diveFull: e._diveFull,
    rhoEff: e.rhoEff, p: { ...e.p },
    inactive: sub ? sub.classList.contains('inactive') : null,
    hint: sub ? (sub.querySelector('.param-hint') || {}).textContent : null,
    objY: e.obj ? e.obj.position.y : null,
    readoutStatus: (window.__LAB.current().exp.readouts() || [])[4],
    waterCol: '#' + (e.water ? e.water.material.color.getHexString().toUpperCase() : 'none'),
    catchCol: '#' + (e.catchWater ? e.catchWater.material.color.getHexString().toUpperCase() : 'none'),
  };
});
const set = async (k, v) => { await pg.evaluate((k, v) => { window.__LAB.current().exp._impl.onParam(k, v); }, k, v); await sl(120); };
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps);
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? 'OK' : 'FAIL' + (extra ? '  [' + extra + ']' : '')}`);

// ===== 路径1：铝2.7+水，下潜 0/3/6/30 → 浸没比例 0/0.51/1/1、示数单调减到恒、状态 下沉中/下沉中/完全浸没·示数恒定/恒定
await set("rhoObj", 2.7); await set("rhoLiquid", 1.0); await set("hollow", "solid"); await set("ballast", 0);
const side = (await st()).side; // side 单位 m（∛200cm³≈5.848cm→0.0585m）
const sideCm = side * 100;
const pts = [[0, 0, false], [3, 3 / sideCm, false], [6, 1, true], [30, 1, true]];
const rows = [];
for (const [dive, expFrac, full] of pts) {
  await set("submerge", dive);
  const s = await st();
  const f = Math.min(dive / sideCm, 1);
  const pass = approx(s.subFrac, expFrac, 1e-9) && approx(s.read, Math.max(0, s.G - s.Fb), 1e-9) && s.state === 'sink' && s.diveFull === full;
  rows.push({ dive, frac: (s.subFrac * 100).toFixed(1), read: s.read.toFixed(3), state: s.status, pass });
  ok(`铝+水 dive=${dive} → frac${s.subFrac.toFixed(3)}(${expFrac}) read=${s.read.toFixed(3)} ${s.status} full=${s.diveFull}`, pass);
}
// 示数单调下降直至恒定：dive0 read=G、dive30 read=G−ρL·g·V
const reads = [];
for (const [dive] of pts) { await set("submerge", dive); reads.push((await st()).read); }
const mono = reads[1] < reads[0] - 1e-9 && approx(reads[2], reads[3], 1e-9) && reads[2] < reads[1] - 1e-9;
ok("示数单调下降→完全浸没后恒定", mono, reads.map(r => r.toFixed(3)).join(" → "));
await set("submerge", 3); await snipNow(pg, outDir, "a5-sink-half.png");
await set("submerge", 30); await snipNow(pg, outDir, "a5-sink-full.png");
// 恢复默认下潜 5 供后续路径（不依赖）
await set("submerge", 5);

// ===== 路径2：木0.6+水 → 漂浮 浸没60% 示数0、submerge 块置灰 + 提示
await set("rhoObj", 0.6); await set("rhoLiquid", 1.0); await set("hollow", "solid"); await set("ballast", 0);
let s = await st();
ok("木+水 漂浮", approx(s.subFrac, 0.6, 1e-9) && approx(s.read, 0, 1e-9) && s.state === 'float' && s.status === '漂浮', `frac=${s.subFrac.toFixed(3)} read=${s.read} state=${s.state} status=${s.status}`);
ok("木+水 submerge 置灰+提示", s.inactive === true && /自动漂浮/.test(s.hint || ''), `inactive=${s.inactive} hint=${s.hint}`);
ok("木+水 悬浮后位置正确(块底在液面上方)", s.objY > 1.0 && s.objY <= 2.0, `objY=${s.objY}`);
await snipNow(pg, outDir, "a5-float-wood.png");
// 悬浮中滑块拖不动（指针事件被禁）→ 视觉上设定无效；读滑块值仍为 5（未动）
// ===== 路径3：木0.6+盐水1.1 → 55%；+酒精0.8 → 75%
await set("rhoLiquid", 1.1); s = await st();
ok("木+盐水 55%", approx(s.subFrac, 0.6 / 1.1, 1e-9) && s.state === 'float' && s.status === '漂浮', `frac=${s.subFrac.toFixed(4)}`);
await snipNow(pg, outDir, "a5-float-wood-salt.png");
await set("rhoLiquid", 0.8); s = await st();
ok("木+酒精 75%", approx(s.subFrac, 0.6 / 0.8, 1e-9) && s.state === 'float', `frac=${s.subFrac.toFixed(4)}`);
await set("rhoLiquid", 1.0);

// ===== 路径4：实心 ρobj=1.0 + 水 → 悬浮 浸没100% 示数0
await set("rhoObj", 1.0); await set("rhoLiquid", 1.0); await set("hollow", "solid"); await set("ballast", 0);
s = await st();
ok("实心1.0+水 悬浮", approx(s.subFrac, 1, 1e-9) && approx(s.read, 0, 1e-9) && s.state === 'susp' && s.status === '悬浮', `frac=${s.subFrac} read=${s.read}`);
ok("悬浮状态滑块可用(不置灰)", s.inactive === false, `inactive=${s.inactive}`);
await snipNow(pg, outDir, "a5-suspend.png");

// ===== 路径5：塑料0.9+水 漂浮 → ballast 50% 越临界 → 下沉、示数>0、滑块生效
await set("rhoObj", 0.9); await set("rhoLiquid", 1.0); await set("hollow", "solid"); await set("ballast", 0);
s = await st();
ok("塑料+水 漂浮且滑块置灰", s.state === 'float' && s.inactive === true, `state=${s.state} inactive=${s.inactive}`);
await set("ballast", 50); s = await st();
// ρ_eff = 0.9 × 1.4 = 1.26 > 1.0 → 下沉
const rhoEffExp = 0.9 * (1 + 50 / 100 * 0.8);
ok("塑料+ballast50 下沉", approx(s.rhoEff, rhoEffExp, 1e-9) && s.state === 'sink' && s.read > 0 && s.inactive === false, `rhoEff=${s.rhoEff} state=${s.state} read=${s.read} inactive=${s.inactive}`);
await snipNow(pg, outDir, "a5-ballast-sink.png");

// ===== 液色渐变：与 A4 liquidColor 同锚点（水=#3B82F6、酒精=#E6D17E、盐水=#2FA89A）
await set("rhoObj", 0.6); await set("rhoLiquid", 1.0); await set("ballast", 0);
s = await st();
ok("液色 水 #3B82F6", s.waterCol === '#3B82F6' && s.catchCol === '#3B82F6', `water=${s.waterCol} catch=${s.catchCol}`);
await set("rhoLiquid", 0.8); s = await st();
ok("液色 酒精 #E6D17E", s.waterCol === '#E6D17E', `water=${s.waterCol}`);
await set("rhoLiquid", 1.0);

// ===== readouts 五字段
await set("rhoObj", 2.7); await set("hollow", "solid"); await set("ballast", 0); await set("submerge", 30);
s = await st();
const ro = s.readoutStatus;
ok("readouts 第5项浮沉状态", ro && ro.label === '浮沉状态' && ro.value === '完全浸没 · 示数恒定', JSON.stringify(ro));

// ===== 滑块结构：submerge 仍是 range、label 下潜深度、default 5
const ui = await pg.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="submerge"]');
  const input = blk ? blk.querySelector('input[type="range"]') : null;
  const headText = blk ? blk.querySelector('.param-head').textContent : null;
  return { has: !!input, min: input && input.min, max: input && input.max, def: input && input.value, head: headText };
});
ok("submerge 滑块 + 默认5 + 标签下潜深度", ui.has && ui.min === '0' && ui.max === '30' && ui.def === '5' && /下潜深度/.test(ui.head || ''), JSON.stringify(ui));

// presets 按钮结构（rhoObj 四角 + rhoLiquid 四角）
const pr = await pg.evaluate(() => {
  const g1 = document.querySelector('.param-block[data-pid="rhoObj"] .ppresets');
  const g2 = document.querySelector('.param-block[data-pid="rhoLiquid"] .ppresets');
  const f = g => g ? [...g.querySelectorAll('button')].map(x => x.textContent + '=' + x.dataset.pv) : null;
  return { obj: f(g1), liq: f(g2) };
});
ok("presets 两排按钮", Array.isArray(pr.obj) && pr.obj.length === 4 && Array.isArray(pr.liq) && pr.liq.length === 4, JSON.stringify(pr));

checks.push(`PAGEERRORS ${errs.length} ${errs.length === 0 ? '[]' : errs.join(' | ')}`);
console.log("CHECKS\n" + checks.join("\n"));
console.log("DONE " + (checks.every(c => c.includes('OK') || c.includes('PAGEERRORS 0')) ? "ALL PASS" : "SOME FAIL"));
await b.close(); process.exit(0);

function snipNow(pg, outDir, name) { return pg.screenshot({ path: path.join(outDir, name) }); }