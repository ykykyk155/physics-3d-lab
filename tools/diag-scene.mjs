// 打开指定场景，抓完整报错堆栈。
// 用法: node tools/diag-scene.mjs <url> <scene-id>
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
const id = process.argv[3] || 'A7-lever';
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox', '--js-flags=--max-old-space-size=4096'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1420, height: 760 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + '\n' + (e.stack || '')));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

await page.goto(url, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 90000 });

console.log('--- 切到', id, '---');
try {
  await page.evaluate(i => window.__LAB.switch(i), id);
} catch (e) {
  console.log('switch 抛错:', String(e).slice(0, 500));
}
await new Promise(r => setTimeout(r, 2500));

// 再拖一下时间条，模拟真实使用
const probe = await page.evaluate(() => {
  const out = {};
  try {
    const e = window.__LAB.current && window.__LAB.current();
    out.hasExp = !!e;
    out.duration = e && e.duration;
    out.readouts = e && typeof e.readouts === 'function' ? e.readouts() : null;
  } catch (err) {
    out.readoutsError = String(err && err.stack || err).slice(0, 600);
  }
  return out;
});

console.log('STATE', JSON.stringify(probe, null, 1).slice(0, 1500));
console.log('ERRORS', errs.length);
for (const e of [...new Set(errs)].slice(0, 6)) console.log('---\n' + String(e).slice(0, 1200));
await browser.close();