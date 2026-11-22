// 线上 A4 特殊液体快捷按钮验证：四按钮存在、点按钮跳值+高亮+颜色、拖滑块清高亮、重置回默认、0 报错
import fs from "node:fs"; import puppeteer from "puppeteer-core";
const URL = "https://ykykyk155.github.io/physics-3d-lab/index.html?v=" + Date.now();
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--disable-gpu", "--enable-unsafe-swiftshader"] });
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 900 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(URL, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 90000 });
await pg.evaluate(() => window.__LAB.switch("A4-liquid-pressure"));
await new Promise(r => setTimeout(r, 1200));
const checks = [];
const SNAP = async () => await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const blk = document.querySelector('.param-block[data-pid="liquid"]');
  if (!blk) return { null: true };
  const btns = [...blk.querySelectorAll('.ppresets button')];
  const inp = blk.querySelector('input[type="range"]');
  const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
  return {
    hasSlider: !!inp, min: inp && inp.min, max: inp && inp.max,
    btns: btns.map(x => ({ label: x.textContent, v: x.dataset.pv, active: x.classList.contains('active') })),
    active: btns.filter(x => x.classList.contains('active')).map(x => x.dataset.pv),
    sliderVal: blk.querySelector('.param-val') ? blk.querySelector('.param-val').textContent : '',
    engine: e.p.liquid,
    col: '#' + e.water.material.color.getHexString(),
    press: ro["液体压强 p"], dhmm: ro["U 管液面差 Δh"]
  };
});
const s0 = await SNAP();
checks.push(["结构 滑块+四按钮共存 默认水亮", s0.hasSlider && s0.min === "0.8" && s0.max === "1.3" && s0.btns.length === 4 && s0.btns.map(x => x.v).join(",") === "0.8,1,1.1,1.3" && s0.active.length === 1 && s0.active[0] === "1"]);
// 点酒精
await pg.evaluate(() => [...document.querySelectorAll('.param-block[data-pid="liquid"] .ppresets button')].find(x => x.dataset.pv === '0.8').click());
await new Promise(r => setTimeout(r, 300));
const s1 = await SNAP();
checks.push(["点酒精 → 0.8 琥珀 高亮酒精", Math.abs(s1.engine - 0.8) < 1e-9 && s1.active.length === 1 && s1.active[0] === "0.8" && s1.col === "#e6d17e"]);
// 点盐水
await pg.evaluate(() => [...document.querySelectorAll('.param-block[data-pid="liquid"] .ppresets button')].find(x => x.dataset.pv === '1.1').click());
await new Promise(r => setTimeout(r, 300));
const s2 = await SNAP();
checks.push(["点盐水 → 1.1 蓝绿 高亮盐水", Math.abs(s2.engine - 1.1) < 1e-9 && s2.active.length === 1 && s2.active[0] === "1.1" && s2.col === "#2fa89a"]);
// 拖滑块 1.25
await pg.evaluate(() => {
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  if (!input) throw new Error("liquid slider not found");
  input.value = "1.25";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await new Promise(r => setTimeout(r, 300));
const s3 = await SNAP();
checks.push(["拖1.25 → 全不亮 中间色 读数联动", Math.abs(s3.engine - 1.25) < 1e-9 && s3.active.length === 0 && s3.col === "#2f8ccd" && s3.press === 1225 && s3.dhmm === 125]);
// 拖回 1.0
await pg.evaluate(() => {
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  input.value = "1";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
});
await new Promise(r => setTimeout(r, 300));
const s4 = await SNAP();
checks.push(["拖回1.0 → 水亮 水蓝", Math.abs(s4.engine - 1) < 1e-9 && s4.active.length === 1 && s4.active[0] === "1" && s4.col === "#3b82f6"]);
// 重置
await pg.evaluate(() => { const els = [...document.querySelectorAll('button')]; const r = els.find(x => x.textContent.trim() === '重置'); if (r) r.click(); });
await new Promise(r => setTimeout(r, 900));
const s5 = await SNAP();
checks.push(["重置 → 回1.0 水亮 水蓝", Math.abs(s5.engine - 1) < 1e-9 && s5.active.length === 1 && s5.active[0] === "1" && s5.col === "#3b82f6"]);
checks.push(["0 报错", errs.length === 0]);
console.log("S0", JSON.stringify({ active: s0.active, engine: s0.engine, col: s0.col }));
console.log("S1", JSON.stringify({ active: s1.active, engine: s1.engine, col: s1.col }));
console.log("S3", JSON.stringify({ active: s3.active, engine: s3.engine, col: s3.col, press: s3.press, dhmm: s3.dhmm }));
let pass = 0, fail = 0;
for (const [name, ok] of checks) { console.log((ok ? "PASS" : "FAIL") + " " + name); ok ? pass++ : fail++; }
console.log("RESULT", fail === 0 ? "ALL PASS" : "FAILED", pass + "/" + (pass + fail), "PAGEERRORS", errs.length);
await pg.screenshot({ path: "shots/live-a4-presets.png" });
await b.close();
process.exit(fail === 0 ? 0 : 1);