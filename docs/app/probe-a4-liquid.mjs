// A4 密度滑块 + 液色渐变 验收：滑块连续、颜色锚点/插值、读数联动、六档截图
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18195;
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
await pg.evaluate(() => window.__LAB.switch("A4-liquid-pressure")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a4-liquid"); fs.mkdirSync(outDir, { recursive: true });

// 0) 滑块结构断言
const sliderInfo = await pg.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="liquid"]');
  if (!blk) return null;
  const input = blk.querySelector('input[type="range"]');
  return {
    hasSlider: !!input,
    min: input ? input.min : null, max: input ? input.max : null, step: input ? input.step : null,
    val: input ? input.value : null,
    text: (blk.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    isEnum: !!blk.querySelector('.seg'),
  };
});

// 0b) 滑块 UI 绑定断言：拖到任意密度 → e.p.liquid 变化（onParam 走 rAF 合并，等一帧再读）
const uiDrag = await pg.evaluate(() => {
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  if (!input) return null;
  input.value = '1.05';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { uiVal: input.value };
});
await sl(250);
const uiRho = await pg.evaluate(() => window.__LAB.current().exp._impl.p.liquid);
if (uiDrag) uiDrag.engineRho = uiRho;

const EXP = hex => parseInt(hex.replace('#', ''), 16);
const comp = (c, hex, tol = 10) => {
  const h = EXP(hex); return Math.abs(c.r * 255 - (h >> 16)) <= tol && Math.abs(c.g * 255 - ((h >> 8) & 255)) <= tol && Math.abs(c.b * 255 - (h & 255)) <= tol;
};
const htmlToRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
// three r187 默认颜色管理：Color 内部为线性，set('#hex') 用 sRGB→线性，读回须 getHexString()
const readHex = () => window.__LAB.current().exp._impl.water.material.color.getHexString().toUpperCase().replace(/^/, '#');

const cases = [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.25];
const results = [];
// UI 层设置滑块（含拖动事件），截图时滑块位置与液体颜色一致
const setViaUI = async (rho) => {
  await pg.evaluate(v => {
    const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
    if (!input) return;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, rho);
  await sl(250);
};
for (const rho of cases) {
  await setViaUI(rho);
  if ([0.8, 0.9, 1.0, 1.1, 1.2, 1.3].includes(rho)) {
    const tag = rho === 0.8 ? 'a08' : rho === 0.9 ? 'a09' : rho === 1.0 ? 'a10' : rho === 1.1 ? 'a11' : rho === 1.2 ? 'a12' : 'a13';
    await pg.screenshot({ path: path.join(outDir, "a4-liquid-" + tag + ".png") });
  }
  const r = await pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const col = e.water.material.color;
    return {
      rho: e.p.liquid, press: e.press, dhmm: e.dhmm,
      col: '#' + col.getHexString().toUpperCase(),
      lblCm: e.lblCm ? e.lblCm.userData.div.textContent : null,
      lblDh: e.lblDh ? e.lblDh.userData.div.textContent : null,
      sliderVal: (() => { const i = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]'); return i ? i.value : null; })(),
    };
  });
  results.push({ rho, ...r });
}

// 锚点色断言：0.8/1.0/1.1/1.3 必须精确等锚点；0.9 应介于 0.8~1.0 之间（r 在 0.8 与 1.0 锚点色之间下降、b 上升）；1.2 介于 1.1~1.3
const anchors = { 0.8: '#E6D17E', 1.0: '#3B82F6', 1.1: '#2FA89A', 1.3: '#1E4FA6' };
const checks = [];
for (const a of [0.8, 1.0, 1.1, 1.3]) {
  const got = results.find(r => r.rho === a).col;
  checks.push(`ρ=${a} 色 ${got} vs 锚 ${anchors[a]} => ${got === anchors[a] ? 'OK' : 'FAIL'}`);
}
const mid09 = results.find(r => r.rho === 0.9).col, mid12 = results.find(r => r.rho === 1.2).col;
const [r08, g08, b08] = htmlToRgb('#E6D17E'), [r10, g10, b10] = htmlToRgb('#3B82F6');
const [r11, g11, b11] = htmlToRgb('#2FA89A'), [r13, g13, b13] = htmlToRgb('#1E4FA6');
const [r09, g09, b09] = htmlToRgb(mid09);
const [r12, g12, b12] = htmlToRgb(mid12);
// 中间密度断言（提饱和后 RGB 分量不一定介于端点）：1) 与两侧锚点都不同色（不是端点）；2) 饱和度足够（过渡带内非灰）
const satur = (r, g, b) => {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2;
  if (mx === mn) return 0;
  const d = mx - mn;
  return l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
};
const diff = (r1, g1, b1, r2, g2, b2) => Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
const mid09ok = diff(r09, g09, b09, r08, g08, b08) > 20 && diff(r09, g09, b09, r10, g10, b10) > 20 && satur(r09, g09, b09) > 0.3;
const mid12ok = diff(r12, g12, b12, r11, g11, b11) > 20 && diff(r12, g12, b12, r13, g13, b13) > 20 && satur(r12, g12, b12) > 0.3;
checks.push(`ρ=0.9 色 ${mid09} 过渡带内非灰(${diff(r09, g09, b09, r08, g08, b08)}/${diff(r09, g09, b09, r10, g10, b10)} 距两端, 饱和${satur(r09, g09, b09).toFixed(2)}) => ${mid09ok ? 'OK' : 'FAIL'}`);
checks.push(`ρ=1.2 色 ${mid12} 过渡带内非灰(${diff(r12, g12, b12, r11, g11, b11)}/${diff(r12, g12, b12, r13, g13, b13)} 距两端, 饱和${satur(r12, g12, b12).toFixed(2)}) => ${mid12ok ? 'OK' : 'FAIL'}`);

// ρ=1.25 联动：p=12262.5Pa(1.25*1000*9.8*0.10)、dhmm=125、cm=12.5
const r125 = results.find(r => r.rho === 1.25);
const pOk = Math.abs(r125.press - 1225) < 0.01, dhOk = Math.abs(r125.dhmm - 125) < 0.01, cmOk = r125.lblCm === 'Δh = 12.5 cm';
checks.push(`ρ=1.25 p=${r125.press}Pa(${pOk ? 'OK' : 'FAIL'}) dhmm=${r125.dhmm}(${dhOk ? 'OK' : 'FAIL'}) lblCm=${r125.lblCm}(${cmOk ? 'OK' : 'FAIL'})`);
checks.push(`滑块UI拖动 1.05 → e.p.liquid=${uiDrag ? uiDrag.engineRho : 'N/A'} (${uiDrag && Math.abs(uiDrag.engineRho - 1.05) < 1e-9 ? 'OK' : 'FAIL'})`);

console.log("SLIDER", JSON.stringify(sliderInfo));
console.log("UIDRAG", JSON.stringify(uiDrag));
console.log("CASES", JSON.stringify(results.map(x => ({ rho: x.rho, press: x.press, dhmm: x.dhmm, col: x.col, lblCm: x.lblCm, slidVal: x.sliderVal }))));
console.log("CHECKS", JSON.stringify(checks));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close(); server.close();