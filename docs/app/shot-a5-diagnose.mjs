// A5 现状截图：默认 / 深浸没 / 空心 / 潜艇注水 / 盐水，供 CEO 诊断找优化点
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18194;
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
const outDir = path.join(ROOT, "shots", "a5-diagnose"); fs.mkdirSync(outDir, { recursive: true });
async function setP(obj) { await pg.evaluate(o => { const e = window.__LAB.current().exp._impl; for (const k in o) e.onParam(k, o[k]); e.recompute(); }, obj); await sl(300); }
async function snap(name) { await pg.screenshot({ path: path.join(outDir, name + ".png") }); }
async function read() {
  return pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const ro = {}; for (const it of window.__LAB.current().exp.readouts()) ro[it.label] = it.value;
    return { ...ro, lbl: e.lRead ? e.lRead.userData.div.textContent : null };
  });
}
async function combo(label, obj, name) {
  await setP(obj);
  const r = await read(); console.log(name, JSON.stringify(r)); await snap(name);
}
await combo("默认", { submerge: 8 }, "a5-default");
await combo("浸没20cm", { submerge: 20 }, "a5-sub20");
await combo("完全浸没30", { submerge: 30 }, "a5-sub30");
await combo("空心", { hollow: "hollow", submerge: 8 }, "a5-hollow");
await combo("潜艇注水80%", { hollow: "solid", ballast: 80, submerge: 8 }, "a5-ballast80");
await combo("盐水", { rhoLiquid: 1.3, submerge: 8 }, "a5-salt");
await combo("低密度漂浮", { rhoObj: 0.5, submerge: 8 }, "a5-float");
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 3)));
await b.close(); server.close();