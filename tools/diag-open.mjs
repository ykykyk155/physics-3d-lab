// 诊断：给定任意 URL（含 file://），看页面是否真的初始化，并截图。
// 用法: node tools/diag-open.mjs <url> [截图路径]
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const shot = process.argv[3] || null;
if (!url) { console.error('usage: node tools/diag-open.mjs <url> [screenshot.png]'); process.exit(2); }

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1214, height: 698, deviceScaleFactor: 1 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('requestfailed', r => errors.push(`REQFAIL ${r.url()} ${r.failure()?.errorText || ''}`));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
} catch (e) {
  console.log('GOTO FAIL', String(e).slice(0, 200));
}
// 给模块与 fetch 一点时间
await new Promise(r => setTimeout(r, 4000));

const state = await page.evaluate(() => {
  const q = s => document.querySelectorAll(s).length;
  return {
    hasLab: !!window.__LAB,
    ready: !!(window.__LAB && window.__LAB.ready),
    sceneItems: q('[data-exp-id], .exp-item, .scene-item'),
    canvas: q('canvas'),
    sliders: q('input[type=range]'),
    selects: q('select'),
    bodyText: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
  };
});

console.log('URL       ', url);
console.log('STATE     ', JSON.stringify(state));
console.log('ERRORS    ', errors.length);
for (const e of [...new Set(errors)].slice(0, 12)) console.log('   -', e.slice(0, 220));

if (shot) {
  await page.screenshot({ path: shot });
  console.log('SHOT      ', shot);
}
await browser.close();