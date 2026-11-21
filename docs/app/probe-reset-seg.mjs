// 时间重置 + 去实验记录 验证探针 v2（2026-11-21）
// 1) seg 记录板块 DOM 不存在
// 2) A1 播放中点重置 → t=0、暂停
// 3) A2 理想光滑（Infinity 禁拖）点重置 → t=0、暂停
// 4) F3 置灰场景重置按钮存在、点击无异常
// 5) 全程 0 报错
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const PORT = 18199;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 1500));

const out = [];
const has = s => page.evaluate(x => !!document.querySelector(x), s);
const tick = ms => new Promise(r => setTimeout(r, ms));
// playing 判定：播放钮内是暂停双竖线 <rect>（playing=true）还是播放三角 <path>
const playingNow = () => page.evaluate(() => document.querySelector('#btnPlay').innerHTML.includes('<rect'));
const tNow = () => page.evaluate(() => parseFloat(document.querySelector('#timeRange').value));

// 1) seg 板块移除
out.push(['seg 板块 DOM 已移除', !(await has('#segTableWrap')) && !(await has('#segRecord')) && !(await has('#segClear')), '']);

// 2) A1 播放中重置
await page.evaluate(() => window.__LAB.switch('A1-incline-speed'));
await tick(1800);
await page.click('#btnPlay');
await tick(900);
const a1b = { t: await tNow(), playing: await playingNow() };
await page.click('#btnTimeReset');
await tick(400);
const a1a = { t: await tNow(), playing: await playingNow() };
out.push(['A1 重置回0+暂停', a1a.t < 0.02 && !a1a.playing, `before t=${a1b.t.toFixed(3)}/${a1b.playing} after t=${a1a.t.toFixed(3)}/${a1a.playing}`]);

// 3) A2 理想光滑（Infinity 禁拖）重置
await page.evaluate(() => window.__LAB.switch('A2-newton-first'));
await tick(2600); // ammo 惰性加载
await page.evaluate(() => {
  const blk = document.querySelector('.param-block[data-pid="surface"]');
  const btn = [...blk.querySelectorAll('.dropdown li')].find(el => el.dataset.oid === '0');
  if (btn) btn.click();
});
await tick(1600);
const a2info = await page.evaluate(() => {
  const exp = window.__LAB.current().exp;
  const r = document.querySelector('#timeRange');
  return { dur: isFinite(exp.duration) ? exp.duration : 'Infinity', disabled: r.disabled, btn: document.querySelector('#btnTimeReset').getBoundingClientRect().width > 0 };
});
out.push(['A2 理想光滑 dur=Infinity+禁拖', a2info.dur === 'Infinity' && a2info.disabled && a2info.btn, `dur=${a2info.dur} disabled=${a2info.disabled}`]);
await tick(900); // 播一会儿
const a2b = { t: await page.evaluate(() => window.__LAB.store.simTime), playing: await playingNow() };
// 确认重置钮可命中（不被遮挡）
const hit = await page.evaluate(() => {
  const btn = document.querySelector('#btnTimeReset');
  const r = btn.getBoundingClientRect();
  const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return top === btn || btn.contains(top);
});
out.push(['A2 重置钮可命中', hit, `hit=${hit}`]);
await page.click('#btnTimeReset');
await tick(500);
const a2a = { t: await page.evaluate(() => window.__LAB.store.simTime), playing: await playingNow(), label: await page.evaluate(() => document.querySelector('#tbTime').textContent) };
out.push(['A2 Infinity 重置回0+暂停', a2a.t < 0.02 && !a2a.playing, `before t=${a2b.t.toFixed(3)}/${a2b.playing} after t=${a2a.t.toFixed(3)}/${a2a.playing} label="${a2a.label}"`]);

// 4) F3 置灰场景重置按钮存在且点击无异常
await page.evaluate(() => window.__LAB.switch('F3-heat-engine'));
await tick(1800);
const f3 = await page.evaluate(() => {
  const exp = window.__LAB.current().exp;
  const btn = document.querySelector('#btnTimeReset');
  const r = btn ? btn.getBoundingClientRect() : null;
  return { dur: isFinite(exp.duration) ? exp.duration : 'Infinity', vis: !!(r && r.width > 0), tb: document.querySelector('#timebar').style.display !== 'none' };
});
out.push(['F3 置灰场景重置钮存在', f3.vis && f3.tb, `dur=${f3.dur}`]);
await page.click('#btnTimeReset');
await tick(300);
out.push(['F3 重置点击无异常', errors.length === 0, '']);

// 5) 0 报错
out.push(['页面 0 报错', errors.length === 0, errors.slice(0, 3).join(' | ')]);

console.log(JSON.stringify(out, null, 1));
const fails = out.filter(r => !r[1]);
console.log(fails.length ? 'FAIL: ' + fails.map(f => f[0]).join('; ') : 'ALL PASS');
await browser.close();
server.close();