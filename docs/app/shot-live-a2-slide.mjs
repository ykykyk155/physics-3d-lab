// 线上复验截图：A2 滑梯外观（侧视 + 默认视角）
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'https://ykykyk155.github.io/physics-3d-lab/index.html';
const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader', '--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
await page.setCacheEnabled(false);
await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
const tick = ms => new Promise(r => setTimeout(r, ms));
for (let i = 0; i < 60; i++) { if (await page.evaluate(() => !!(window.__LAB && window.__LAB.ready))) break; await tick(500); }
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
for (let i = 0; i < 120; i++) { const hid = await page.evaluate(() => { const ov = document.getElementById('ammoLoad'); return !!ov && getComputedStyle(ov).display === 'none'; }); if (hid) break; await tick(500); }
await tick(800);
await page.evaluate(() => { window.__LAB.store.playback.playing = false; });
await page.evaluate(() => { const e = window.__LAB.current().exp; e.onParam('height', 0.35); e.onParam('surface', 0.3); e.seek(0); });
await tick(500);
const info = await page.evaluate(() => { const im = window.__LAB.current().exp._impl; const g = im._geo || im._geometry(); const c = window.__LAB.current().scene.getObjectByName('A2-cart'); return { Tx: g.Tx, XF0: g.XF0, z: c ? c.position.z : -0.6 }; });
await page.screenshot({ path: 'shots/live-a2-slide-default.png' });
await page.evaluate(a => { const c = window.__LAB.camera(), ct = window.__LAB.controls(); c.position.set((a.Tx + a.XF0) / 2, 0.45, a.z + 4.6); ct.target.set((a.Tx + a.XF0) / 2, 0.22, a.z); ct.update(); }, info);
await tick(700);
await page.screenshot({ path: 'shots/live-a2-slide-side.png' });
console.log('saved', info);
await browser.close();
