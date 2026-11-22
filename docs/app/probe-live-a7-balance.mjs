// 线上 A7 一键平衡双按钮验证：默认不动 / 左基准配平 / 右基准配平 / 滑块同步 / 按钮 DOM / 0 报错
import fs from "node:fs"; import puppeteer from "puppeteer-core";
const URL = "https://ykykyk155.github.io/physics-3d-lab/index.html?v=" + Date.now();
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader", "--no-proxy-server"] });
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 1300 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 90000 });
await pg.evaluate(() => window.__LAB.switch("A7-lever"));
await new Promise(r => setTimeout(r, 1500));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const checks = [];
const sl = ms => new Promise(r => setTimeout(r, ms));
const waitSettle = () => sl(400);
async function setUI(pid, v) {
  await pg.evaluate((pid, v) => { window.__LAB.current().exp._impl.ctx.ui.setParamValue(pid, v); }, pid, v);
  await waitSettle();
}
const press = id => pg.evaluate(id => { const e = window.__LAB.current().exp._impl; e.actions[id].call(e); }, id);
const pressDOM = sel => pg.evaluate(sel => { document.querySelector(sel).click(); }, sel);
async function st() {
  return await pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const getUI = pid => { const el = document.querySelector(`.param-block[data-pid="${pid}"]`); const r = el && el.querySelector('input[type=range]'); return r ? Number(r.value) : null; };
    return {
      f1: e.p.f1, l1: e.p.l1, f2: e.p.f2, l2: e.p.l2,
      net: e.net, balanced: e.balanced, duration: e.duration, t1: e.t1, t2: e.t2,
      angle: typeof e._physAngle === 'function' ? e._physAngle() : null,
      ui: [getUI('f1'), getUI('l1'), getUI('f2'), getUI('l2')],
      store: [window.__LAB.store.params.f1, window.__LAB.store.params.l1, window.__LAB.store.params.f2, window.__LAB.store.params.l2],
      btns: (() => { const aw = document.querySelector('.exp-actions'); if (!aw) return null; return [...aw.querySelectorAll('.exp-action')].map(b => b.dataset.action); })(),
    };
  });
}
const approx = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-9 : eps);
const ok = (name, pass, extra) => checks.push(`${name} => ${pass ? 'OK' : 'FAIL' + (extra ? '  [' + extra + ']' : '')}`);

// ===== 路径1：默认 f1=2 l1=4 f2=4 l2=2（8=8）已平衡，点两钮参数不动 =====
let s = await st();
ok("默认态 8=8 balanced duration=0", s.balanced === true && approx(s.net, 0) && s.duration === 0, `net=${s.net} dur=${s.duration}`);
await press("balance-left"); await waitSettle(); s = await st();
ok("默认点左基准 参数不变", s.f1===2 && s.l1===4 && s.f2===4 && s.l2===2, `f2=${s.f2} l2=${s.l2}`);
await press("balance-right"); await waitSettle(); s = await st();
ok("默认点右基准 参数不变", s.f1===2 && s.l1===4 && s.f2===4 && s.l2===2, `f1=${s.f1} l1=${s.l1}`);

// ===== 路径2：扰动阻力侧 f2=3 l2=5 → 点左基准：应配 f2·l2=8（精确 2×4）=====
await setUI("f2", 3); await setUI("l2", 5); await waitSettle();
s = await st();
ok("扰动后 8≠15 未平衡", s.balanced === false && s.duration === 2.2, `net=${s.net.toFixed(2)} dur=${s.duration}`);
await press("balance-left"); await waitSettle(); s = await st();
ok("左基准配平 F1L1=F2L2=8", approx(s.t1, 8) && approx(s.t2, 8) && s.balanced === true && s.duration === 0, `f2=${s.f2} l2=${s.l2} t2=${s.t2.toFixed(2)} net=${s.net.toFixed(4)}`);
ok("左基准后梁水平静止", s.angle != null && approx(s.angle, 0, 0.01), `angle=${s.angle}`);

// ===== 路径3：扰动动力侧 f1=3.5 l1=7 → 点右基准：应配 f1·l1=8（规格例 1×8）=====
await setUI("f1", 3.5); await setUI("l1", 7); await waitSettle();
s = await st();
ok("扰动后 24.5≠8 未平衡", s.balanced === false, `net=${s.net.toFixed(2)}`);
await press("balance-right"); await waitSettle(); s = await st();
ok("右基准配平 F1L1=F2L2=8", approx(s.t1, 8) && approx(s.t2, 8) && s.balanced === true && s.duration === 0, `f1=${s.f1} l1=${s.l1} t1=${s.t1.toFixed(2)} net=${s.net.toFixed(4)}`);

// ===== 路径4：滑块 UI = store.params = 实例 p 三端一致 =====
const syncAll = s.store.every((v, i) => approx(v, [s.f1, s.l1, s.f2, s.l2][i], 1e-9)) && s.ui.every((v, i) => approx(v, [s.f1, s.l1, s.f2, s.l2][i], 1e-9) || v === null);
ok("滑块UI=store.params=实例p", syncAll, JSON.stringify({ s: s.store, e: [s.f1, s.l1, s.f2, s.l2], ui: s.ui }));

// ===== 路径5：按钮 DOM 两枚共存 + 真实 DOM 点击 =====
ok("两按钮共存", Array.isArray(s.btns) && s.btns.length === 2 && s.btns.includes('balance-left') && s.btns.includes('balance-right'), JSON.stringify(s.btns));
if (s.btns) {
  await setUI("f2", 3); await setUI("l2", 5); await waitSettle();
  await pressDOM('.exp-action[data-action="balance-left"]'); await waitSettle(); s = await st();
  ok("DOM点击 balance-left 生效", s.balanced === true && approx(s.t1, 8) && approx(s.t2, 8), `net=${s.net.toFixed(4)}`);
}

ok("0 pageerror / console.error", errs.length === 0, errs.slice(0, 3).join(' | '));
console.log(checks.join("\n"));
console.log(`TOTAL ${checks.filter(c => c.includes('=> OK')).length}/${checks.length}`);
await b.close(); process.exit(0);