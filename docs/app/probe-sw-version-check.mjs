// SW 版本比对验证：v1 已装 SW 并缓存旧页面 → 服务端切 v2 → 普通 reload
// 页面自己 fetch 线上 sw.js 的 VERSION，发现版本不同 → 注销旧 SW → ?v= 重载 → marker=v2。
// 这是一条不依赖浏览器 SW update 检查的链路（专治“刷新还看到旧版”）。
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(import.meta.dirname);
const PORT = 18202;
const TMP = path.join(os.tmpdir(), "phlab-sw-ver-" + Date.now());
const V1 = path.join(TMP, "v1"), V2 = path.join(TMP, "v2");
fs.cpSync(path.join(ROOT, "..", "..", "release", "physics-3d-lab"), V1, { recursive: true });
fs.cpSync(V1, V2, { recursive: true });

function markVersion(dir, buildVersion, swVersion) {
  const idx = path.join(dir, "index.html");
  let html = fs.readFileSync(idx, "utf8");
  html = html.replace(/<meta name="build-version" content="[^"]*">/, `<meta name="build-version" content="${buildVersion}">`);
  fs.writeFileSync(idx, html);
  const sw = path.join(dir, "sw.js");
  let swText = fs.readFileSync(sw, "utf8");
  swText = swText.replace(/const VERSION = '[^']*';/, `const VERSION = '${swVersion}';`);
  fs.writeFileSync(sw, swText);
}
markVersion(V1, "test-v1", "test-v1");
markVersion(V2, "test-v2", "test-v2");

let current = V1;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const requests = [];
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  const p = decodeURIComponent(u.pathname) === "/" ? "/index.html" : decodeURIComponent(u.pathname);
  if (u.pathname === "/sw.js") requests.push("SW:" + (u.search || ""));
  const f = path.join(current, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const browser = await puppeteer.launch({ executablePath: EDGE, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const logs = [];
page.on("console", (m) => logs.push("console:" + m.type() + ":" + m.text().slice(0, 120)));
const marker = () => page.evaluate(() => document.querySelector('meta[name="build-version"]')?.content || null);
const navigate = async () => {
  try { await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 }); }
  catch (e) { logs.push("goto-err:" + String(e).slice(0, 100)); }
};
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
page.on("framenavigated", (f) => { if (f === page.mainFrame()) logs.push("navigated:" + f.url()); });

await navigate();
for (let i = 0; i < 60; i++) {
  if (await marker() === "test-v1" && await page.evaluate(() => !!navigator.serviceWorker.controller)) break;
  await tick(200);
}
await tick(1200);
console.log("PHASE1 marker:", await marker());

// 服务端换成 v2；普通刷新（不手动 update）
current = V2;
await navigate();
let finalMarker = null;
for (let i = 0; i < 160; i++) {
  finalMarker = await marker().catch(() => null);
  if (finalMarker === "test-v2") break;
  await tick(250);
}
const debug = await page.evaluate(async () => {
  const meta = document.querySelector('meta[name="build-version"]')?.content || null;
  let text = "";
  try { text = await fetch('./sw.js?ts=' + Date.now(), { cache: 'no-store' }).then((r) => r.text()); } catch (e) { text = "ERR:" + String(e); }
  const m = /const VERSION = '([^']+)'/.exec(text || "");
  let reg = null, keys = [], regs = [];
  try { reg = await navigator.serviceWorker.getRegistration(); } catch (e) {}
  try { regs = (await navigator.serviceWorker.getRegistrations()).map((r) => ({ scope: r.scope, active: r.active && r.active.state, waiting: !!r.waiting, installing: !!r.installing })); } catch (e) {}
  try { keys = await caches.keys(); } catch (e) {}
  return { meta, len: text.length, remote: m ? m[1] : null, hasReg: !!reg, regs, keys, online: navigator.onLine, guard: sessionStorage.getItem('phlab-ver-check') };
});
console.log("DEBUG:", JSON.stringify(debug));
const url = page.url();
console.log("FINAL marker:", finalMarker, "URL:", url);
console.log("SW-REQUESTS:", JSON.stringify(requests));
console.log("LOGS:", JSON.stringify(logs.slice(-8)));
console.log("PAGEERRORS", errors.length, JSON.stringify(errors.slice(0, 5)));
const pass = finalMarker === "test-v2" && /[?&]v=test-v2\b/.test(url) && errors.length === 0;
console.log(pass ? "RESULT ALL PASS" : "RESULT FAIL");
await browser.close(); server.close(); fs.rmSync(TMP, { recursive: true, force: true });
if (!pass) process.exit(1);
