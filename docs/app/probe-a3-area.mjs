// A3 平放/侧放（真 90° 绕长边翻）几何 + 截图 + t0/6/12 连接检查
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18191;
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
const outDir = path.join(ROOT, "shots", "a3-area"); fs.mkdirSync(outDir, { recursive: true });
async function shot(name) { const vp = await pg.$("#viewport"); await vp.screenshot({ path: path.join(outDir, name + ".png") }); }
async function setArea(a) { await pg.evaluate(a => { const e = window.__LAB.current().exp._impl; e.onParam("area", a); e.recompute(); }, a); }

async function geom(N, area, t) {
  await pg.evaluate(({ N, area, t }) => { const e = window.__LAB.current().exp._impl; e.onParam("normal", N); e.onParam("area", area); e.recompute(); e.seek(t); }, { N, area, t });
  await sl(120);
  return pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    function bbox(obj) {
      obj.updateMatrixWorld(true);
      let n = { x: Infinity, y: Infinity, z: Infinity }, x = { x: -Infinity, y: -Infinity, z: -Infinity }, any = false;
      obj.traverse(o => { if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone(); bb.applyMatrix4(o.matrixWorld); any = true; n.x = Math.min(n.x, bb.min.x); n.y = Math.min(n.y, bb.min.y); n.z = Math.min(n.z, bb.min.z); x.x = Math.max(x.x, bb.max.x); x.y = Math.max(x.y, bb.max.y); x.z = Math.max(x.z, bb.max.z); } });
      return any ? { min: n, max: x, size: { x: +(x.x - n.x).toFixed(3), y: +(x.y - n.y).toFixed(3), z: +(x.z - n.z).toFixed(3) } } : null;
    }
    const bb = bbox(e.block), wb = bbox(e.weightsG), sb = bbox(e.scaleG);
    return {
      N: e.p.normal, area: e.p.area, t: +e._t.toFixed(1), x: +e.x.toFixed(3),
      blockMinY: +bb.min.y.toFixed(4), blockTopY: +bb.max.y.toFixed(4), blockSize: bb.size,
      weightsN: e._weightsN, weightsMinY: +wb.min.y.toFixed(4), weightsSize: wb.size,
      weightsOnTop: +(wb.min.y - bb.max.y).toFixed(4),
      scaleMinX: +sb.min.x.toFixed(3), blockMaxX: +bb.max.x.toFixed(3),
      scaleGapFromBlock: +(sb.min.x - bb.max.x).toFixed(3),
      hookY: e._hookY, hookZ: e._hookZ,
      scalePos: [+e.scaleG.position.x.toFixed(3), +e.scaleG.position.y.toFixed(3), +e.scaleG.position.z.toFixed(3)],
      blockHookX: +(e.x + 0.44).toFixed(3), scaleHookX: +(e.scaleG.position.x - 0.58).toFixed(3),
    };
  });
}

const flat = await geom(2, "big", 6); await shot("a3-area-flat-N2");
const side = await geom(2, "small", 6); await shot("a3-area-side-N2");
// 顶视（侧放 N=2）
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; const cam = e.ctx.camera, ctr = e.ctx.controls; const cx = e.x; cam.position.set(cx, 6.5, 0.55); ctr.target.set(cx, 0.15, 0); cam.lookAt(ctr.target); if (ctr.update) ctr.update(); });
await sl(250); await shot("a3-area-side-N2-top");
// 恢复正常机位（原始 A3 机位）——直接重切场景即复位
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; const cam = e.ctx.camera, ctr = e.ctx.controls; cam.position.set(1.6, 2.7, 5.3); ctr.target.set(1.6, 0.9, 0); cam.lookAt(ctr.target); if (ctr.update) ctr.update(); });
await sl(150);
const side5 = await geom(5, "small", 6); await shot("a3-area-side-N5");
// t=0/6/12 侧放连接检查（pull=0.3）
await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam("normal", 2); e.onParam("area", "small"); e.onParam("pull", 0.1); e.recompute(); });
const conn = [];
for (const t of [0, 6, 12]) { conn.push(await geom(2, "small", t)); await shot("a3-area-side-p01-t" + t); }
console.log("FLAT", JSON.stringify(flat));
console.log("SIDE", JSON.stringify(side));
console.log("SIDE5", JSON.stringify(side5));
console.log("CONN", JSON.stringify(conn));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 6)));
await b.close(); server.close();
