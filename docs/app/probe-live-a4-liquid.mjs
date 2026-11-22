// 线上 A4 密度滑块 + 液色渐变验证：滑块存在、锚点色精确命中、中间值过渡、读数联动、0 报错
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
const r = await pg.evaluate(() => {
  const SLIDER = () => {
    const e = window.__LAB.current().exp._impl; const p = e.p;
    const inp = [...document.querySelectorAll('input[type="range"]')].find(i => i.min === "0.8" && i.max === "1.3");
    if (!inp) return null;
    return { hasSlider: true, min: inp.min, max: inp.max, step: inp.step, val: inp.value, rho: p.liquid };
  };
  const COLOR = () => {
    const e = window.__LAB.current().exp._impl;
    return '#' + e.water.material.color.getHexString();
  };
  const READ = () => {
    const e = window.__LAB.current().exp._impl;
    const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    ro.lblCm = e.lblCm.userData.div.textContent;
    return ro;
  };
  return { SLIDER: SLIDER(), COLOR: COLOR(), READ: READ() };
});
const anchors = { 0.8: "e6d17e", 1: "3b82f6", 1.1: "2fa89a", 1.3: "1e4fa6" };
checks.push(["滑块存在 0.8~1.3 step0.01", r.SLIDER && r.SLIDER.hasSlider && r.SLIDER.min === "0.8" && r.SLIDER.max === "1.3" && r.SLIDER.step === "0.01"]);
async function set(rho) {
  await pg.evaluate(v => {
    const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
    if (!input) throw new Error("liquid slider not found");
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, rho);
  await new Promise(s => setTimeout(s, 250));
}
for (const [rho, hex] of Object.entries(anchors)) {
  await set(Number(rho));
  const c = await pg.evaluate(() => '#' + window.__LAB.current().exp._impl.water.material.color.getHexString());
  checks.push(["ρ=" + rho + " 锚点色 " + hex, c === "#" + hex]);
}
await set(1.25);
const m = await pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
  return { col: '#' + e.water.material.color.getHexString(), press: ro["液体压强 p"], dhmm: ro["U 管液面差 Δh"], lblCm: e.lblCm.userData.div.textContent, slid: ([...document.querySelectorAll('input[type="range"]')].find(i => i.min === "0.8" && i.max === "1.3") || {}).value };
});
checks.push(["ρ=1.25 读数联动 1225Pa/125mm/12.5cm", Math.abs(m.press - 1225) < 1 && m.dhmm === 125 && m.lblCm === "Δh = 12.5 cm"]);
checks.push(["滑块同步 1.25", m.slid === "1.25"]);
checks.push(["0 报错", errs.length === 0]);
console.log("INIT", JSON.stringify({ slider: r.SLIDER, color: r.COLOR, read: r.READ }));
console.log("M1.25", JSON.stringify(m));
let pass = 0, fail = 0;
for (const [n, ok] of checks) { console.log((ok ? "PASS" : "FAIL") + " " + n); ok ? pass++ : fail++; }
await pg.screenshot({ path: "shots/live-a4-liquid.png" });
await b.close();
console.log("RESULT", fail === 0 ? "ALL PASS" : "FAILED", pass + "/" + (pass + fail), "PAGEERRORS", errs.length);