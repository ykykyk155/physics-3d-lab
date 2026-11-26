// D1 审查辅助：检查串联 A/B/C 表槽处导线是否真的断开（导线不得从表体后方跨越槽口）
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18199;
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
const pg = await b.newPage(); await pg.setViewport({ width: 1600, height: 1300, deviceScaleFactor: 1 });
const errs = []; pg.on("pageerror", e => errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load" });
await pg.waitForFunction("window.__LAB && window.__LAB.ready", { timeout: 60000 });
const sl = ms => new Promise(r => setTimeout(r, ms));
await pg.evaluate(() => { window.__LAB.store.playback.playing = false; });
await pg.evaluate(() => window.__LAB.switch("D1-series-parallel")); await sl(1200);

const dump = () => pg.evaluate(() => {
  const e = window.__LAB.current().exp._impl;
  const segs = [];
  const dbg = [];
  for (const w of e.wires) {
    const g = w.geometry;
    const a = g.attributes.instanceStart, b2 = g.attributes.instanceEnd;
    if (!a || !b2) continue;
    if (dbg.length < 3) dbg.push({ keys: Object.keys(g.attributes), aCount: a.count, aLen: a.data.array.length, bCount: b2.count, bLen: b2.data.array.length, first: [...a.data.array].slice(0, 18) });
    const n = a.data.array.length / 3;
    for (let i = 0; i + 5 < a.data.array.length; i += 6) {
      segs.push([
        [Number(a.data.array[i]).toFixed(3), Number(a.data.array[i + 1]).toFixed(3)],
        [Number(a.data.array[i + 3]).toFixed(3), Number(a.data.array[i + 4]).toFixed(3)]
      ]);
    }
  }
  return { ampSlot: e.ampSlot, volSlot: e.volSlot, segs, dbg };
});

const checkSlot = async (slot) => {
  const r = await dump();
  const cx = { A: -1.45, B: 0.50, C: 2.25 }[slot];
  const L = cx - 0.55, R = cx + 0.55, y = 2.65;
  const cross = r.segs.filter(([p1, p2]) => {
    const [x1, y1] = p1.map(Number), [x2, y2] = p2.map(Number);
    const onY = Math.abs(y1 - y) < 0.02 && Math.abs(y2 - y) < 0.02;
    return onY && Math.min(x1, x2) < L + 0.01 && Math.max(x1, x2) > R - 0.01;
  });
  console.log(`slot ${slot} (ampSlot=${r.ampSlot}) crossingSegments=${cross.length}`, JSON.stringify(cross));
  if (r.dbg && r.dbg.length) console.log('dbg', JSON.stringify(r.dbg));
};
await checkSlot('A');
await pg.evaluate(() => window.__LAB.current().exp._impl.placeMeter('amp', 'B')); await sl(300);
await checkSlot('B');
await pg.evaluate(() => window.__LAB.current().exp._impl.placeMeter('amp', 'C')); await sl(300);
await checkSlot('C');

const all = await dump();
console.log('segments at y=2.65:');
for (const s of all.segs) {
  const [p1, p2] = s; const [x1, y1] = p1.map(Number), [x2, y2] = p2.map(Number);
  if (Math.abs(y1 - 2.65) < 0.02 && Math.abs(y2 - 2.65) < 0.02) console.log(`  ${x1.toFixed(2)} -> ${x2.toFixed(2)} (y=${y1.toFixed(2)})`);
}
console.log('pageerrors=', errs.length, errs.join(' | '));
await b.close(); server.close();
