// 线上 A5 浮沉自洽验证：铝下潜三态、木漂浮/盐水/酒精、悬浮、配重越临界、readouts 五字段、0 报错
import fs from "node:fs"; import puppeteer from "puppeteer-core";
const URL = "https://ykykyk155.github.io/physics-3d-lab/index.html?v=" + Date.now();
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 900 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 90000 });
await pg.evaluate(() => window.__LAB.switch("A5-buoyancy"));
await new Promise(r => setTimeout(r, 1500));
const checks = [];
// 设置参数（走程序化 API 保证窗口事件触发）
async function setParam(id, v) {
  await pg.evaluate(([id, v]) => {
    const e = window.__LAB.current().exp._impl;
    e.p[id] = v; e.onParam(id, v);
  }, [id, v]);
  await new Promise(r => setTimeout(r, 200));
}
const SNAP = async () => await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const ro = {}; for (const it of e.readouts()) ro[it.label] = it.value;
  const blk = document.querySelector('.param-block[data-pid="submerge"]');
  return {
    ro,
    subFrac: e.subFrac,
    status: e._status,
    read: e.read,
    Fb: e.Fb, G: e.G,
    col: '#' + (e.water ? e.water.material.color.getHexString() : ''),
    subsInactive: blk ? blk.classList.contains('inactive') : null,
    stringVisible: e.string ? e.string.visible : null
  };
});
// 默认：塑料0.9+水 → 漂浮
const d = await SNAP();
checks.push(["默认塑料+水 漂浮 90% 示数0", d.subFrac > 0.89 && d.subFrac < 0.91 && d.status === "漂浮" && d.read === 0 && d.subsInactive === true && d.stringVisible === false]);
// 铝 + 水（side≈5.85cm：下潜3→51%、6→100%）
await setParam("rhoObj", 2.7);
await setParam("submerge", 3);
const al0 = await SNAP();
checks.push(["铝+水 下潜3 浸没~51%", al0.subFrac > 0.5 && al0.subFrac < 0.53 && al0.status === "下沉中" && al0.subsInactive === false && al0.stringVisible === true]);
await setParam("submerge", 6);
const al6 = await SNAP();
checks.push(["铝+水 下潜6 完全浸没 恒定", al6.subFrac === 1 && al6.status === "完全浸没 · 示数恒定"]);
await setParam("submerge", 30);
const al30 = await SNAP();
checks.push(["铝+水 下潜30 示数不变", Math.abs(al30.read - al6.read) < 0.001 && al30.status === "完全浸没 · 示数恒定"]);
// 木 + 水
await setParam("rhoObj", 0.6); await setParam("submerge", 5);
const wood = await SNAP();
checks.push(["木+水 漂浮60% 示数0", wood.subFrac > 0.59 && wood.subFrac < 0.61 && wood.status === "漂浮" && wood.read === 0 && wood.subsInactive === true]);
// 木 + 盐水 1.1 / 酒精 0.8
await setParam("rhoLiquid", 1.1);
const s1 = await SNAP();
checks.push(["木+盐水 55%", s1.subFrac > 0.54 && s1.subFrac < 0.56]);
await setParam("rhoLiquid", 0.8);
const al2 = await SNAP();
checks.push(["木+酒精 75%", al2.subFrac > 0.74 && al2.subFrac < 0.76]);
// 悬浮：实心 ρobj=1.0 + 水
await setParam("rhoObj", 1.0); await setParam("rhoLiquid", 1.0);
const susp = await SNAP();
checks.push(["ρ=1.0+水 悬浮 100% 示数0", susp.subFrac === 1 && susp.status === "悬浮" && susp.read === 0 && susp.subsInactive === false]);
// 塑料 + 配重50 → 下沉
await setParam("rhoObj", 0.9); await setParam("ballast", 50);
const bal = await SNAP();
checks.push(["塑料+ballast50 下沉 示数>0", bal.status === "下沉中" && bal.read > 0]);
// 液色
checks.push(["液色水 #3b82f6", d.col === "#3b82f6"]);
checks.push(["0 报错", errs.length === 0]);
console.log("D", JSON.stringify({ subFrac: d.subFrac, status: d.status, read: d.read, col: d.col }));
console.log("AL0", JSON.stringify({ subFrac: al0.subFrac, status: al0.status, read: al0.read }));
console.log("AL30", JSON.stringify({ read: al30.read, status: al30.status }));
console.log("BAL", JSON.stringify({ status: bal.status, read: bal.read }));
let pass = 0, fail = 0;
for (const [name, ok] of checks) { console.log((ok ? "PASS" : "FAIL") + " " + name); ok ? pass++ : fail++; }
console.log("RESULT", fail === 0 ? "ALL PASS" : "FAILED", pass + "/" + (pass + fail), "PAGEERRORS", errs.length);
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.p.rhoObj = 0.6; e.p.rhoLiquid = 1.0; e.p.ballast = 0; e.p.submerge = 5; e.onParam("rhoObj", 0.6); });
await new Promise(r => setTimeout(r, 600));
await pg.screenshot({ path: "shots/live-a5-float.png" });
await b.close();
process.exit(fail === 0 ? 0 : 1);