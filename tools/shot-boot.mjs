// 抓启动遮罩：进入页面立刻截一张，ready 后再截一张，并确认遮罩已隐藏。
// 用法: node tools/shot-boot.mjs <url> <目录>
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const dir = process.argv[3] || '.';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1214, height: 698 });

const t0 = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
// 尽早截，争取抓到遮罩
await new Promise(r => setTimeout(r, 120));
const bootVisibleEarly = await page.evaluate(() => {
  const b = document.getElementById('boot');
  if (!b) return 'no #boot element';
  const cs = getComputedStyle(b);
  return `${cs.display} / opacity ${cs.opacity}`;
});
await page.screenshot({ path: `${dir}\\boot-early.png` });
const earlyMs = Date.now() - t0;

await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });
await new Promise(r => setTimeout(r, 600));
const bootAfter = await page.evaluate(() => {
  const b = document.getElementById('boot');
  if (!b) return 'no #boot element';
  const cs = getComputedStyle(b);
  return `${cs.display} / opacity ${cs.opacity}`;
});
await page.screenshot({ path: `${dir}\\boot-ready.png` });
const readyMs = Date.now() - t0;

console.log(`early (${earlyMs} ms)  #boot = ${bootVisibleEarly}`);
console.log(`ready (${readyMs} ms)  #boot = ${bootAfter}`);
console.log(bootAfter.startsWith('none') ? 'PASS 遮罩已隐藏' : 'FAIL 遮罩仍在');
await browser.close();