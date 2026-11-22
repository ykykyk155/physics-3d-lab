// A4 液体密度滑块参数区特写截图
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
const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
await pg.evaluate(() => window.__LAB.switch("A4-liquid-pressure"));
await new Promise(r => setTimeout(r, 900));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a4-liquid"); fs.mkdirSync(outDir, { recursive: true });
const handle = await pg.$('.param-block[data-pid="liquid"]');
if (handle) {
  await handle.screenshot({ path: path.join(outDir, "a4-liquid-param-slider.png") });
  console.log("SLIDERBLOCK SAVED");
} else {
  console.log("SLIDERBLOCK NOT FOUND");
}
const info = await pg.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="liquid"]');
  const input = blk && blk.querySelector('input[type="range"]');
  return {
    text: blk ? (blk.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100) : null,
    min: input ? input.min : null, max: input ? input.max : null, step: input ? input.step : null, val: input ? input.value : null,
  };
});
console.log("INFO", JSON.stringify(info));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close(); server.close();