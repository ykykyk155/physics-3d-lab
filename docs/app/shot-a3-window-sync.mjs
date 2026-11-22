// 生成时间条与读数一致的 A3 三档对比截图（t=6s，经真实 UI 时间轴 seek）
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18190;
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
const pg = await b.newPage(); await pg.setViewport({ width: 1420, height: 800, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => window.__LAB.switch("A3-friction")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a3-window"); fs.mkdirSync(outDir, { recursive: true });
async function shot(name) { const vp = await pg.$("#viewport"); await vp.screenshot({ path: path.join(outDir, name + ".png") }); }
for (const [pull, tag] of [[0.05, "p005"], [0.1, "p01"], [0.3, "p03"]]) {
  await pg.evaluate((pull) => {
    const block = document.querySelector('.param-block[data-pid="pull"]');
    const i = block.querySelector('input');
    i.value = pull; i.dispatchEvent(new Event('input', { bubbles: true }));
  }, pull);
  await sl(160);
  await pg.evaluate(() => {
    const tr = document.querySelector('#timeRange');
    tr.value = 6; tr.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sl(220);
  const info = await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; return { x: +e.block.position.x.toFixed(3), sim: +window.__LAB.store.simTime.toFixed(2), dur: +e.duration.toFixed(2), label: document.querySelector('#tbTime').textContent }; });
  console.log('shot', tag, JSON.stringify(info));
  await shot("sync-a3-window-" + tag + "-t6");
}
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close(); server.close();
