// A4 密度滑块 + 特殊液体快捷按钮共存 验收：点按钮跳值、拖滑块清高亮、重置回默认高亮、截图
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18196;
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
const checks = [];

// 结构：滑块 + 四按钮共存
const struct = await pg.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="liquid"]');
  if (!blk) return null;
  const input = blk.querySelector('input[type="range"]');
  const btns = [...blk.querySelectorAll('.ppresets button')];
  return {
    hasSlider: !!input, min: input ? input.min : null, max: input ? input.max : null, step: input ? input.step : null,
    btns: btns.map(x => ({ label: x.textContent, v: x.dataset.pv, active: x.classList.contains('active') })),
  };
});
checks.push(`结构 滑块(min=${struct && struct.min}/max=${struct && struct.max}/step=${struct && struct.step}) + 按钮 ${struct ? struct.btns.map(x => x.label + '(' + x.v + ')[' + (x.active ? '亮' : '暗') + ']').join(' ') : 'NULL'} => ${struct && struct.hasSlider && struct.min === '0.8' && struct.max === '1.3' && struct.step === '0.01' && struct.btns.length === 4 && struct.btns.filter(x => x.active).length === 1 && struct.btns.filter(x => x.active)[0].v === '1' ? 'OK' : 'FAIL'}`);

const snip = async (name) => { await pg.screenshot({ path: path.join(outDir, name) }); };
const sliderState = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  const btns = [...document.querySelectorAll('.param-block[data-pid="liquid"] .ppresets button')];
  return {
    sliderVal: input ? input.value : null,
    engine: e.p.liquid,
    active: btns.filter(x => x.classList.contains('active')).map(x => x.dataset.pv),
    col: '#' + e.water.material.color.getHexString().toUpperCase(),
  };
});

// 1) 点「酒精」按钮 → 滑块 0.8、引擎 0.8、「酒精」高亮
await pg.evaluate(() => {
  [...document.querySelectorAll('.param-block[data-pid="liquid"] .ppresets button')].find(x => x.dataset.pv === '0.8').click();
});
await sl(250);
let s = await sliderState();
const acc = els => Math.abs(+s.sliderVal - 0.8) < 1e-9 && Math.abs(s.engine - 0.8) < 1e-9 && s.active.length === 1 && s.active[0] === '0.8';
checks.push(`点酒精 → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] 色${s.col} => ${acc() ? 'OK' : 'FAIL'}`);
const accOne = els => Math.abs(+s.sliderVal - 1.0) < 1e-9 && Math.abs(s.engine - 1.0) < 1e-9 && s.active.length === 1 && s.active[0] === '1';
await snip("a4-presets-alcohol-btn.png");

// 2) 点「盐水」→ 1.1 高亮
await pg.evaluate(() => {
  [...document.querySelectorAll('.param-block[data-pid="liquid"] .ppresets button')].find(x => x.dataset.pv === '1.1').click();
});
await sl(250);
s = await sliderState();
checks.push(`点盐水 → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] 色${s.col} => ${Math.abs(+s.sliderVal - 1.1) < 1e-9 && Math.abs(s.engine - 1.1) < 1e-9 && s.active.length === 1 && s.active[0] === '1.1' ? 'OK' : 'FAIL'}`);

// 3) 拖滑块到 1.25（非锚点）→ 全不亮
await pg.evaluate(() => {
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  input.value = '1.25';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await sl(250);
s = await sliderState();
checks.push(`拖1.25 → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] 色${s.col} => ${Math.abs(+s.sliderVal - 1.25) < 1e-9 && Math.abs(s.engine - 1.25) < 1e-9 && s.active.length === 0 ? 'OK' : 'FAIL'}`);
await snip("a4-presets-slider-125.png");

// 4) 拖回 1.0 → 「水」高亮（数值相等才亮）
await pg.evaluate(() => {
  const input = document.querySelector('.param-block[data-pid="liquid"] input[type="range"]');
  input.value = '1.0';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await sl(250);
s = await sliderState();
checks.push(`拖回1.0 → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] => ${accOne() ? 'OK' : 'FAIL'}`);
await snip("a4-presets-slider-10.png");

// 5) 重置 → 回 1.0，引擎 1.0，「水」高亮（走 resetAll 补间路径）
await pg.evaluate(() => { window.__LAB.reset(); });
await sl(900);
s = await sliderState();
checks.push(`重置 → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] 色${s.col} => ${accOne() ? 'OK' : 'FAIL'}`);
await snip("a4-presets-reset.png");

// 6) 程序化 setParam (ctx.ui.setParamValue) 也要同步按钮态
await pg.evaluate(() => { window.__LAB.current().exp._impl.ctx.ui.setParamValue('liquid', 0.8); });
await sl(250);
s = await sliderState();
checks.push(`ui.setParamValue(0.8) → 滑块${s.sliderVal} 引擎${s.engine} 高亮[${s.active}] => ${Math.abs(+s.sliderVal - 0.8) < 1e-9 && Math.abs(s.engine - 0.8) < 1e-9 && s.active.length === 1 && s.active[0] === '0.8' ? 'OK' : 'FAIL'}`);

// 7) 默认快照：初始进入 A4 时「水」高亮（重新切换场景验证渲染层初始态）
await pg.evaluate(() => { window.__LAB.reset(); });
await sl(300);
await pg.evaluate(() => window.__LAB.switch("A1-incline-speed")); await sl(500);
// 8) 其他实验无 presets → 渲染不变（A1 的 theta 参数块不应有 .ppresets）
const other = await pg.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="theta"]');
  return blk ? !!blk.querySelector('.ppresets') : 'NOBLOCK';
});
checks.push(`A1(theta) 无 presets 渲染不变 => ${other === false ? 'OK' : 'FAIL(' + other + ')'}`);
await pg.evaluate(() => window.__LAB.switch("A4-liquid-pressure")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
s = await sliderState();
checks.push(`重进A4默认 → 引擎${s.engine} 高亮[${s.active}] => ${accOne() ? 'OK' : 'FAIL'}`);
await snip("a4-presets-default-enter.png");

checks.push(`PAGEERRORS ${errs.length} ${errs.length === 0 ? '[]' : errs.join(' | ')}`);
console.log("CHECKS\n" + checks.join("\n"));
console.log("DONE " + (checks.every(c => c.includes('OK') || c.includes('PAGEERRORS 0')) ? "ALL PASS" : "SOME FAIL"));
await b.close(); process.exit(0);