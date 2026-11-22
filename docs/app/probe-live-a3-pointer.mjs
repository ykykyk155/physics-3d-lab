// 线上 A3：核对测力计指针是否随砝码变化，以及是否为水平放置
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SITE = 'https://ykykyk155.github.io/physics-3d-lab/index.html?v=' + Date.now();
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.setCacheEnabled(false);
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.goto(SITE, { waitUntil: 'load', timeout: 90000 });
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(window.__LAB && window.__LAB.ready))) break; await sleep(500); }
await page.evaluate(() => window.__LAB.switch('A3-friction'));
for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => !!window.__LAB.current()?.exp?._impl); if (ok) break; await sleep(250); }
await page.evaluate(() => { window.__LAB.store.playback.playing = false; window.__LAB.current().exp._impl.reset(); });
const rows = [];
for (const n of [0.5, 2, 5]) {
  await page.evaluate(n => window.__LAB.current().exp._impl.onParam('normal', n), n);
  await page.evaluate(() => window.__LAB.current().exp._impl.seek(6));
  await sleep(150);
  rows.push(await page.evaluate(n => {
    const I = window.__LAB.current().exp._impl;
    return { n, f: I.f, ptrY: I.scaleG.userData.pointer.position.y, rotZ: I.scaleG.rotation.z, scaleY: I.scaleG.position.y, scaleX: I.scaleG.position.x, blockX: I.block.position.x };
  }, n));
}
console.log('POINTERS', JSON.stringify(rows));
console.log('ERRORS', errs.length, JSON.stringify(errs.slice(0, 5)));
await browser.close();
