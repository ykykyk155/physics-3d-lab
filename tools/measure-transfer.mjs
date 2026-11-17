// 量真实传输量：加载线上页面，读 performance 资源条目，按“实际下载字节”排序。
// 用法: node tools/measure-transfer.mjs <url>
import puppeteer from 'puppeteer-core';

const url = process.argv[2] || 'https://ykykyk155.github.io/physics-3d-lab/';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1214, height: 698 });

const t0 = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });
const readyMs = Date.now() - t0;

const rows = await page.evaluate(() => {
  return performance.getEntriesByType('resource').map(e => ({
    name: e.name.replace(location.origin, ''),
    type: e.initiatorType,
    transfer: e.transferSize || 0,
    encoded: e.encodedBodySize || 0,
    decoded: e.decodedBodySize || 0,
    ms: Math.round(e.duration),
  })).sort((a, b) => b.transfer - a.transfer);
});

const total = rows.reduce((s, r) => s + r.transfer, 0);
console.log(`READY in ${readyMs} ms   requests=${rows.length}   total transfer=${(total / 1024).toFixed(0)} KB`);
console.log('');
console.log('transfer   decoded    ms   file');
for (const r of rows.slice(0, 20)) {
  console.log(
    `${(r.transfer / 1024).toFixed(1).padStart(8)} KB ${(r.decoded / 1024).toFixed(1).padStart(9)} KB ${String(r.ms).padStart(5)}   ${r.name}`
  );
}

// 查一下关键文件到底有没有 gzip
const enc = await page.evaluate(async () => {
  const probe = async (u) => {
    const r = await fetch(u, { method: 'GET' });
    const buf = await r.arrayBuffer();
    return { u, enc: r.headers.get('content-encoding') || 'none', bytes: buf.byteLength };
  };
  return [await probe('./vendor/three.core.js')];
});
console.log('');
for (const e of enc) console.log(`HEADER CHECK ${e.u}  content-encoding=${e.enc}  fetched=${(e.bytes / 1024).toFixed(0)} KB`);

await browser.close();