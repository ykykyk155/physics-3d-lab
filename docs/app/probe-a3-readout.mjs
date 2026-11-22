// A3「接触面积」读数行验收：平放/侧放各一张全页截图 + 面板近照 + readouts 断言
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18192;
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
await pg.evaluate(() => window.__LAB.switch("A3-friction")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
const outDir = path.join(ROOT, "shots", "a3-readout"); fs.mkdirSync(outDir, { recursive: true });
async function setArea(area, t) {
  await pg.evaluate(({ area, t }) => { const e = window.__LAB.current().exp._impl; e.onParam("normal", 2); e.onParam("area", area); e.recompute(); e.seek(t); }, { area, t });
  await sl(400);
}
async function snap(tag) {
  await pg.screenshot({ path: path.join(outDir, "a3-readout-" + tag + ".png") });
  const panel = await pg.$("#stats"); if (panel) await panel.screenshot({ path: path.join(outDir, "a3-readout-" + tag + "-panel.png") });
  return pg.evaluate(() => {
    const e = window.__LAB.current().exp;
    const rows = e.readouts().map(r => ({ label: r.label, value: r.value, unit: r.unit }));
    const areaRow = rows.find(r => r.label === '接触面积') || null;
    const dom = document.querySelector('#statsBody') ? document.querySelector('#statsBody').innerText : '';
    return { area: window.__LAB.current().exp._impl.p.area, count: rows.length, areaRow, f: rows.find(r => r.label === '摩擦力 f'), statsText: dom.replace(/\n/g, ' | ') };
  });
}
await setArea("big", 6); const flat = await snap("flat");
await setArea("small", 6); const side = await snap("side");
console.log("FLAT", JSON.stringify(flat));
console.log("SIDE", JSON.stringify(side));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close(); server.close();
