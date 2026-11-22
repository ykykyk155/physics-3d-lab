// A3 水平连接：pull=0.3 时 t=0/6/12 三帧截图（证明整组水平连接、随块平移）
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
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => window.__LAB.switch("A3-friction")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam("normal", 2); e.onParam("pull", 0.3); e.recompute(); });
const outDir = path.join(ROOT, "shots", "a3-hscale"); fs.mkdirSync(outDir, { recursive: true });
async function shot(name) { const vp = await pg.$("#viewport"); await vp.screenshot({ path: path.join(outDir, name + ".png") }); }
for (const t of [0, 6, 12]) { await pg.evaluate(t => window.__LAB.current().exp._impl.seek(t), t); await sl(150); await shot("a3-hline-p03-t" + t); }
await b.close(); server.close(); console.log("DONE");
