// A3 砝码槽码：读数/数量/不压扁/跟随木块/拉绳让顶 + 三档截图
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18187;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html";
  let f = path.join(ROOT, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { const a = path.join(ROOT, "..", p); if (fs.existsSync(a)) f = a; else { res.writeHead(404); res.end(); return; } }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, "127.0.0.1", r));
const b = await puppeteer.launch({ executablePath: "C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe", headless: true, args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--disable-gpu", "--no-sandbox"] });
const pg = await b.newPage(); await pg.setViewport({ width: 1420, height: 800, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => window.__LAB.switch("A3-friction")); await sl(900);
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });   // 暂停，帧确定

async function setParam(id, val) {
  return pg.evaluate(({ id, val }) => {
    const block = document.querySelector(`.param-block[data-pid="${id}"]`);
    const input = block && block.querySelector("input[type=range]");
    if (!input) return { ok: false, why: "no input" };
    input.value = val; input.dispatchEvent(new Event("input", { bubbles: true }));
    return { ok: true, v: input.value };
  }, { id, val });
}
async function snap(label) {
  const s = await pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl;
    const g = e.weightsG;
    let wm = 0; if (g) g.traverse(o => { if (o.isMesh) wm++; });
    const ro = {}; try { for (const it of e.readouts()) ro[it.label] = it.value; } catch (_) { }
    return {
      p: JSON.parse(JSON.stringify(e.p || {})), f: e.f, duration: e.duration,
      _weightsN: e._weightsN, _weightsH: +(e._weightsH || 0).toFixed(3),
      wpos: g ? [+g.position.x.toFixed(3), +g.position.y.toFixed(3), +g.position.z.toFixed(3)] : null,
      wscale: g ? [+g.scale.x.toFixed(3), +g.scale.y.toFixed(3), +g.scale.z.toFixed(3)] : null,
      bpos: e.block ? [+e.block.position.x.toFixed(3), +e.block.position.y.toFixed(3)] : null,
      bscale: e.block ? [+e.block.scale.x.toFixed(3), +e.block.scale.z.toFixed(3)] : null,
      weightMeshes: wm, readouts: ro,
    };
  });
  console.log(label, JSON.stringify(s)); return s;
}
const outDir = path.join(ROOT, "shots", "a3-weights"); fs.mkdirSync(outDir, { recursive: true });
async function shot(name) { const vp = await pg.$("#viewport"); await vp.screenshot({ path: path.join(outDir, name + ".png") }); }

for (const [N, tag] of [[0.5, "N0.5"], [2, "N2"], [5, "N5"]]) {
  await setParam("normal", N); await sl(250);
  await pg.evaluate(() => window.__LAB.current().exp._impl.seek(0)); await sl(120);
  await snap("N=" + N + " t=0");
  await shot("a3-" + tag + "-t0");
}
await setParam("normal", 2); await setParam("mu", 0.8); await sl(200);
await pg.evaluate(() => window.__LAB.current().exp._impl.seek(0)); await sl(120);
await snap("N=2 mu=0.8");
await setParam("mu", 0.4); await sl(150);
const mid = await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.seek(e.duration * 0.5); return { dur: e.duration, x: +e.block.position.x.toFixed(3), gx: +e.weightsG.position.x.toFixed(3) }; });
await sl(120); await snap("N=2 mid-move"); console.log("mid-follow", JSON.stringify(mid));
await shot("a3-N2-mid");
// 面积 small：木块 x/z 压扁到 0.55/0.7，但砝码组必须 1/1/1 不被压扁
const small = await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam("area", "small"); e.recompute(); e.seek(0); const g = e.weightsG; return { bscale: [+e.block.scale.x.toFixed(3), +e.block.scale.z.toFixed(3)], wscale: [+g.scale.x.toFixed(3), +g.scale.y.toFixed(3), +g.scale.z.toFixed(3)], wpos: [+g.position.x.toFixed(3), +g.position.y.toFixed(3)] }; });
await sl(150); await snap("area=small N=2"); console.log("area-small", JSON.stringify(small));
await shot("a3-area-small");
const det = await pg.evaluate(() => { const e = window.__LAB.current().exp._impl; e.onParam("area", "big"); e.recompute(); const a = []; for (let i = 0; i < 3; i++) { e.seek(e.duration * 0.37); a.push([+e.block.position.x.toFixed(4), +e.weightsG.position.x.toFixed(4)]); } return a; });
console.log("determinism", JSON.stringify(det));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 6)));
await b.close(); server.close();
