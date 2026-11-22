// A4 四向朝向验收：四向切换 p/Δh 完全不变 + 四张朝向截图 + Δh cm 大号标签
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18193;
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
const outDir = path.join(ROOT, "shots", "a4-dir"); fs.mkdirSync(outDir, { recursive: true });
const dirs = [["down", 0, "下"], ["right", 90, "右"], ["up", 180, "上"], ["left", 270, "左"]];
const results = [];
for (const [tag, val, name] of dirs) {
  await pg.evaluate(v => { const e = window.__LAB.current().exp._impl; e.onParam('orient', v); e.recompute(); }, val);
  await sl(250);
  await pg.screenshot({ path: path.join(outDir, "a4-dir-" + tag + ".png") });
  const r = await pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const ro = e.probeHead ? e.probeHead.rotation : null;
    return {
      orient: e.p.orient,
      p: e.press, dhmm: e.dhmm, dirName: e._dirName,
      headRot: ro ? [ro.x.toFixed(3), ro.y.toFixed(3), ro.z.toFixed(3)] : null,
      lbl: e.lbl ? e.lbl.userData.div.textContent : null,
      lblCm: e.lblCm ? e.lblCm.userData.div.textContent : null,
      lblDh: e.lblDh ? e.lblDh.userData.div.textContent : null,
      readouts: window.__LAB.current().exp.readouts().map(r => [r.label, r.value, r.unit || '']),
      segActive: document.querySelectorAll('.param-block[data-pid="orient"] .seg button.active').length,
    };
  });
  results.push({ tag, name, ...r });
}
console.log("DIRS", JSON.stringify(results.map(x => ({ tag: x.tag, orient: x.orient, p: x.p, dhmm: x.dhmm, dirName: x.dirName, headRot: x.headRot, lbl: x.lbl, lblCm: x.lblCm, lblDh: x.lblDh, segActive: x.segActive, fReadout: x.readouts.find(r => r[0] === '液体压强 p'), dhReadout: x.readouts.find(r => r[0] === 'U 管液面差 Δh'), orientReadout: x.readouts.find(r => r[0] === '探头朝向') }))));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 5)));
await b.close(); server.close();