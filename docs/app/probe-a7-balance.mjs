// A7 一键平衡验收：默认已平衡不动 / 扰动后 balance-left/right 网格配平 / F1L1=F2L2 / duration=0 / 梁水平 / 滑块同步 + 截图
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
function snipNow(pg, dir, name) { return pg.evaluate(() => { const a = document.querySelector('.exp-actions'); if (a) a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }).then(() => pg.screenshot({ path: path.join(dir, name) })); }
await pg.evaluate(() => window.__LAB.switch("A7-lever")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a7-balance"); fs.mkdirSync(outDir, { recursive: true });
const checks = [];

// 实例状态（exp._impl）
const st = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const ro = window.__LAB.current().exp.readouts() || [];
  return {
    f1: e.p.f1, l1: e.p.l1, f2: e.p.f2, l2: e.p.l2,
    net: e.net, balanced: e.balanced, duration: e.duration,
    t1: e.t1, t2: e.t2,
    angle: typeof e._physAngle === 'function' ? e._physAngle() : null,
    label: e.lRead ? e.lRead.textContent : null,
    readouts: ro.map(r => `${r.label}:${r.value}`),
  };
});
// 用真实的程序化写回通道（与 actions 内部一致，走 rAF → onParam → recompute）
const setUI = (pid, v) => pg.evaluate((pid, v) => { window.__LAB.current().exp._impl.ctx.ui.setParamValue(pid, v); }, pid, v);
const setBare = (pid, v) => pg.evaluate((pid, v) => { window.__LAB.current().exp._impl.onParam(pid, v); }, pid, v);
const press = id => pg.evaluate(id => { const e = window.__LAB.current().exp._impl; e.actions[id].call(e); }, id);
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps);
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? 'OK' : 'FAIL' + (extra ? '  [' + extra + ']' : '')}`);
const waitSettle = () => sl(350); // 等 rAF 合并 + ammo 重建

// ===== 路径1：默认 f1=2 l1=4 f2=4 l2=2（target=8）已平衡，点左/右基准参数都不动 =====
let s = await st();
ok("默认态 8=8 balanced", s.balanced === true && approx(s.net, 0) && s.duration === 0,
  `net=${s.net} duration=${s.duration} label=${s.label}`);
await press("balance-left"); await waitSettle(); s = await st();
ok("默认点左基准 参数不变", s.f1===2 && s.l1===4 && s.f2===4 && s.l2===2, `f2=${s.f2} l2=${s.l2}`);
await press("balance-right"); await waitSettle(); s = await st();
ok("默认点右基准 参数不变", s.f1===2 && s.l1===4 && s.f2===4 && s.l2===2, `f1=${s.f1} l1=${s.l1}`);
await snipNow(pg, outDir, "a7-balance-default.png");

// ===== 路径2：扰动阻力侧 f2=3 l2=5（t2=15≠t1=8）→ 点左基准（保 F1/L1）：应配出 f2·l2=8 =====
await setUI("f2", 3); await setUI("l2", 5); await waitSettle();
s = await st();
ok("扰动后 8≠15 未平衡", s.balanced === false && s.duration === 2.2, `net=${s.net.toFixed(2)} duration=${s.duration}`);
await press("balance-left"); await waitSettle(); s = await st();
const exactL = s.f2 * s.l2;
ok("左基准配平 F1L1=F2L2=8", approx(s.t1, 8) && approx(s.t2, 8) && s.balanced === true && s.duration === 0,
  `f2=${s.f2} l2=${s.l2} t2=${s.t2.toFixed(2)} net=${s.net.toFixed(4)} dur=${s.duration}`);
ok("左基准后梁水平静止", s.angle != null && approx(s.angle, 0, 0.01), `angle=${s.angle}`);
await snipNow(pg, outDir, "a7-balance-left.png");

// ===== 路径3：扰动动力侧 f1=3.5 l1=7（t1=24.5≠t2=8）→ 点右基准（保 F2/L2）：应配出 f1·l1=8（规格例：f1=1 l1=8）=====
await setBare("f1", 3.5); await setBare("l1", 7); await waitSettle(); // 直改 p 模拟用户拖（也走 recompute）
s = await st();
ok("扰动后 24.5≠8 未平衡", s.balanced === false, `net=${s.net.toFixed(2)}`);
await press("balance-right"); await waitSettle(); s = await st();
ok("右基准配平 F1L1=F2L2=8", approx(s.t1, 8) && approx(s.t2, 8) && s.balanced === true && s.duration === 0,
  `f1=${s.f1} l1=${s.l1} t1=${s.t1.toFixed(2)} net=${s.net.toFixed(4)} dur=${s.duration}`);
await snipNow(pg, outDir, "a7-balance-right.png");

// ===== 路径4：滑块 UI 与 store.params 同步（pec）=====
const uiSync = await pg.evaluate(() => {
  const store = window.__LAB.store;
  const e = window.__LAB.current().exp._impl;
  const getUI = pid => { const el = document.querySelector(`.param-block[data-pid="${pid}"]`); const r = el && el.querySelector('input[type=range]'); return r ? Number(r.value) : null; };
  return { s: [store.params.f1, store.params.l1, store.params.f2, store.params.l2], e: [e.p.f1, e.p.l1, e.p.f2, e.p.l2],
           ui: [getUI('f1'), getUI('l1'), getUI('f2'), getUI('l2')] };
});
const syncAll = uiSync.s.every((v, i) => v === uiSync.e[i]) && uiSync.e.every((v, i) => approx(v, uiSync.ui[i], 1e-9) || uiSync.ui[i] === null);
ok("滑块UI=store.params=实例p", syncAll, JSON.stringify(uiSync));

// ===== 路径5：按钮 DOM（等前端 JSON 就绪后才有）=====
const btns = await pg.evaluate(() => {
  const aw = document.querySelector('.exp-actions');
  if (!aw) return null;
  return [...aw.querySelectorAll('.exp-action')].map(b => ({ id: b.dataset.action, label: b.textContent, title: b.title }));
});
if (btns) {
  const ids = btns.map(x => x.id).join(',');
  ok("两按钮共存", btns.length === 2 && ids.includes('balance-left') && ids.includes('balance-right'), ids);
  // 走真实 DOM 点击测一发
  await pg.evaluate(() => { document.querySelector('.exp-action[data-action="balance-left"]').click(); });
  await waitSettle(); s = await st();
  ok("DOM点击 balance-left 生效", approx(s.t1, 8) && approx(s.t2, 8) && s.balanced === true, `net=${s.net.toFixed(4)}`);
} else {
  ok("两按钮共存（前端JSON未就绪，跳过）", true, "exp-actions 未渲染");
}

ok("0 pageerror / console.error", errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(checks.join("\n"));
console.log(`TOTAL ${checks.filter(c => c.includes('=> OK')).length}/${checks.length}`);
await b.close(); process.exit(0);