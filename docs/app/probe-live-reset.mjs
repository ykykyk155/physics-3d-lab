// 线上复验：时间重置 + 去实验记录（2026-11-21）
import puppeteer from 'puppeteer-core';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'https://ykykyk155.github.io/physics-3d-lab/index.html';

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
// 禁缓存 + 强制刷新，避免 CDN/磁盘缓存命中旧版
await page.setCacheEnabled(false);
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));

const out = [];
const has = s => page.evaluate(x => !!document.querySelector(x), s);
const tick = ms => new Promise(r => setTimeout(r, ms));
// 等 boot 真正完成
for (let i = 0; i < 20; i++) {
  const ok = await page.evaluate(() => !!(window.__LAB && window.__LAB.ready));
  if (ok) break;
  await tick(500);
}
const playingNow = () => page.evaluate(() => document.querySelector('#btnPlay').innerHTML.includes('<rect'));

// 1) 首页：seg 无、重置钮有
out.push(['seg DOM 无', !(await has('#segTableWrap')) && !(await has('#segRecord')), '']);
out.push(['重置按钮存在', await has('#btnTimeReset'), '']);

// 2) A1 播放中点重置
await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await tick(2500);
await page.click('#btnPlay');
await tick(900);
const b1 = await page.evaluate(() => ({ t: window.__LAB.store.simTime, p: document.querySelector('#btnPlay').innerHTML.includes('<rect') }));
await page.click('#btnTimeReset');
await tick(400);
const a1 = await page.evaluate(() => ({ t: window.__LAB.store.simTime, p: document.querySelector('#btnPlay').innerHTML.includes('<rect') }));
out.push(['线上 A1 重置回0+暂停', a1.t < 0.02 && !a1.p, `before=${b1.t.toFixed(2)}/${b1.p} after=${a1.t.toFixed(2)}/${a1.p}`]);

// 3) 25 场景切换 0 报错（扫一遍所有 id）
const ids = await page.evaluate(() => {
  const d = window.__LAB.DATA();
  return d.list ? d.list.map(x => x.id) : Object.keys(d.byId || {}).filter(k => k !== 'byModule' && k !== 'byId');
});
// DATA() 结构不确定，直接走页面卡片
const ids2 = await page.evaluate(() => [...document.querySelectorAll('.scene-card')].map(b => b.dataset.id || b.dataset.exp || '').filter(Boolean));
const useIds = ids2.length >= 25 ? ids2 : ids;
let switched = 0;
for (const id of useIds.slice(0, 25)) {
  try { await page.evaluate(x => window.__LAB.switch(x), id); await tick(700); switched++; } catch (e) { errors.push('switch ' + id + ': ' + e); }
}
out.push(['线上 25 场景切换', switched >= 25, `switched=${switched}`]);
out.push(['线上 0 报错', errors.length === 0, errors.slice(0, 5).join(' | ')]);

console.log(JSON.stringify(out, null, 1));
const fails = out.filter(r => !r[1]);
console.log(fails.length ? 'FAIL: ' + fails.map(f => f[0]).join('; ') : 'ALL PASS');
await browser.close();