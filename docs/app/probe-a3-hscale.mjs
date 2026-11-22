// A3 教材式水平测力计：三档截图 + t=0/6/12 水平连接检查 + 指针位置
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18189;
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

async function setN(N) { await pg.evaluate(N => { const e = window.__LAB.current().exp._impl; e.onParam("normal", N); e.recompute(); }, N); }
async function setPull(v) { await pg.evaluate(v => { const e = window.__LAB.current().exp._impl; e.onParam("pull", v); e.recompute(); }, v); }
async function seek(t) { await pg.evaluate(t => window.__LAB.current().exp._impl.seek(t), t); await sl(120); }
async function ptrAndGeom() {
  return pg.evaluate(() => {
    const e = window.__LAB.current().exp._impl, g = e.scaleG, b = e.block;
    const sx = b.scale ? b.scale.x : 1;
    const blockHookX = +(e.x + 0.44 * sx).toFixed(4);
    const SH = 1.0, hookLocal = 0.58 * SH;
    const scaleX = +g.position.x.toFixed(4);
    const scaleHookX = +(scaleX - hookLocal).toFixed(4);
    const ptr = g.userData && g.userData.pointer;
    return {
      t: +e._t.toFixed(2), x: +e.x.toFixed(3), f: +e.f.toFixed(2),
      blockHookX, scaleX, scaleHookX,
      gapBetweenHooks: +(scaleHookX - blockHookX).toFixed(4),
      sameY: [+(0.11).toFixed(3), +(0.11).toFixed(3)],
      rotZ: +g.rotation.z.toFixed(3),
      scaleY: +g.position.y.toFixed(3),
      ptrLocalY: ptr ? +ptr.position.y.toFixed(4) : null,
      scaleBodyRight: +(scaleX + 0.47 * SH).toFixed(3),
      tableHalf: 6.5,
    };
  });
}
const outDir = path.join(ROOT, "shots", "a3-hscale"); fs.mkdirSync(outDir, { recursive: true });
async function shot(name) { const vp = await pg.$("#viewport"); await vp.screenshot({ path: path.join(outDir, name + ".png") }); }

await setPull(0.1);
const ptrs = [];
for (const [N, tag] of [[0.5, "N0.5"], [2, "N2"], [5, "N5"]]) {
  await setN(N); await seek(6);
  const g = await ptrAndGeom(); g.N = N; ptrs.push(g);
  await shot("a3-hscale-" + tag + "-t6");
}
// 极端右端：pull=0.3, t=0/6/12 连接/在桌检查
await setN(2); await setPull(0.3);
const conn = [];
for (const t of [0, 6, 12]) { await seek(t); conn.push(await ptrAndGeom()); }
await seek(12); await shot("a3-hscale-p03-t12");
console.log("PTR_BY_N", JSON.stringify(ptrs));
console.log("CONN_P03", JSON.stringify(conn));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0, 6)));
await b.close(); server.close();
