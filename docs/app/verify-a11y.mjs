// 无障碍与断点补齐验证：
//  ① 正常模式：重置走 300ms 补间（60ms 时未到位、400ms 到位）
//  ② reduce 模式：重置一步到位；#fade/#toast 的 opacity 过渡保留；#panel 过渡移除
//  ③ 断点：≥1600px 面板 360px；<768px 且高<600px 抽屉 45vh，否则 55vh
//  ④ 键盘焦点环：Tab 聚焦后 outline 2px
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname);
const PORT = 18123;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  let file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { const alt = path.join(ROOT, '..', p); if (fs.existsSync(alt)) file = alt; else { res.writeHead(404); res.end(); return; } }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(PORT, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu', '--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
  if (m.text().includes('[token drift]')) errors.push('DRIFT ' + m.text());   // 色彩同源自检告警视同失败
});
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pass = [], fail = [];
const T = (name, ok, detail) => (ok ? pass : fail).push(`${name} ${detail ?? ''}`);

await page.setViewport({ width: 1420, height: 900, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'load' });
await page.waitForFunction('window.__LAB && window.__LAB.ready', { timeout: 60000 });

// 取一个带数值参数的场景，把参数拨到 min 后点重置
const setup = () => page.evaluate(() => {
  const ids = Object.keys(window.__LAB.DATA().byId);
  const id = ids.find(i => (window.__LAB.DATA().byId[i].params || []).some(p => p.type !== 'enum'));
  const p = window.__LAB.DATA().byId[id].params.find(p => p.type !== 'enum');
  return { id, pid: p.id, min: p.min, def: p.default };
});
const setMin = s => page.evaluate(s => { window.__LAB.store.params[s.pid] = s.min; }, s);
const getVal = s => page.evaluate(s => window.__LAB.store.params[s.pid], s);

// ① 正常模式：补间中间态 ≠ 默认值，终态 = 默认值
{
  const s = await page.evaluate(async () => { await window.__LAB.switch('A1-incline-speed'); return 1; });
  const st = await setup();
  await setMin(st);
  await page.evaluate(() => window.__LAB.reset());
  await sleep(60);
  const mid = await getVal(st);
  await sleep(400);
  const end = await getVal(st);
  T('① 正常-补间中间态', Math.abs(mid - st.def) > 1e-9, `mid=${mid} def=${st.def}`);
  T('① 正常-补间终态', Math.abs(end - st.def) < 1e-9, `end=${end}`);
}

// ② reduce 模式
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
{
  const st = await setup();
  await setMin(st);
  await page.evaluate(() => window.__LAB.reset());
  await sleep(60);
  const now = await getVal(st);
  T('② reduce-重置一步到位', Math.abs(now - st.def) < 1e-9, `now=${now} def=${st.def}`);
  await page.setViewport({ width: 390, height: 844 });    // 抽屉过渡只在 <768px 存在，窄屏下才测得出降级
  await sleep(120);
  const css = await page.evaluate(() => {
    const g = el => getComputedStyle(document.querySelector(el));
    return {
      fade: g('#fade').transitionProperty,
      toast: g('#toast').transitionProperty,
      panel: g('#panel').transitionProperty,
      boot: g('#boot').transitionProperty,
    };
  });
  await page.setViewport({ width: 1420, height: 900 });
  T('② reduce-场景交叉淡入保留', css.fade.includes('opacity'), css.fade);
  T('② reduce-toast淡入保留', css.toast.includes('opacity'), css.toast);
  T('② reduce-启动遮罩淡出保留', css.boot.includes('opacity'), css.boot);
  T('② reduce-抽屉滑移动画移除', css.panel === 'none' || !css.panel.includes('transform'), css.panel);
}

// ③ 断点
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
{
  await page.setViewport({ width: 1680, height: 900 });
  await sleep(120);
  const wide = await page.evaluate(() => getComputedStyle(document.querySelector('#app')).gridTemplateColumns);
  T('③ ≥1600px 面板 360px', wide.startsWith('360px'), wide);
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(120);
  const midw = await page.evaluate(() => getComputedStyle(document.querySelector('#app')).gridTemplateColumns);
  T('③ 1024–1599px 面板 320px', midw.startsWith('320px'), midw);
  await page.setViewport({ width: 390, height: 500 });
  await sleep(120);
  const short = await page.evaluate(() => document.querySelector('#panel').getBoundingClientRect().height);
  T('③ 矮视口抽屉 45vh', Math.abs(short - 500 * 0.45) < 2, `${short}px / 期望 ${500 * 0.45}px`);
  await page.setViewport({ width: 390, height: 844 });
  await sleep(120);
  const tall = await page.evaluate(() => document.querySelector('#panel').getBoundingClientRect().height);
  T('③ 标准手机抽屉 55vh', Math.abs(tall - 844 * 0.55) < 2, `${tall}px / 期望 ${844 * 0.55}px`);
}

// ④ 键盘焦点环
{
  await page.setViewport({ width: 1280, height: 900 });
  await sleep(120);
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const a = document.activeElement; if (!a) return null;
    const c = getComputedStyle(a);
    return { tag: a.tagName + '.' + a.className, w: c.outlineWidth, s: c.outlineStyle, color: c.outlineColor };
  });
  T('④ Tab 焦点环 2px solid', !!ring && ring.w === '2px' && ring.s === 'solid', JSON.stringify(ring));
}

// 切场景回归：reduce 模式下切换仍正常（#fade 时序依赖 transition 存在）
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
{
  const ok = await page.evaluate(async () => { await window.__LAB.switch('F3-heat-engine'); return window.__LAB.current().exp != null; });
  T('⑤ reduce 下切场景正常', ok);
}

// ⑥ 色彩同源：五科 --tab-c = COLORS 识别色；场景背景/雾 = COLORS.bg；无 token drift 告警
{
  const expect = { mechanics: '#f59e0b', electricity: '#facc15', optics: '#a78bfa', acoustics: '#34d399', thermal: '#fb7185' };
  const firsts = { mechanics: 'A1-incline-speed', electricity: 'D1-series-parallel', optics: 'B1-pinhole', acoustics: 'C1-sound-medium', thermal: 'F1-melting-curve' };
  for (const mid of Object.keys(expect)) {
    const got = await page.evaluate(async id => {
      await window.__LAB.switch(id);
      return {
        tab: getComputedStyle(document.documentElement).getPropertyValue('--tab-c').trim().toLowerCase(),
        bg: window.__LAB.current().scene.background.getHexString(),
        fog: window.__LAB.current().scene.fog.color.getHexString(),
      };
    }, firsts[mid]);
    T(`⑥ ${mid} 识别色同源`, got.tab === expect[mid], got.tab);
    T(`⑥ ${mid} 背景/雾同源`, got.bg === '0b1120' && got.fog === '0b1120', `${got.bg}/${got.fog}`);
  }
}

// ⑦ 移动端 Tab：文字可见（不再只剩计数数字）、触控目标 ≥40px
{
  await page.setViewport({ width: 390, height: 844 });
  await sleep(120);
  const tab = await page.evaluate(() => {
    const t = document.querySelector('.tab');
    const l = t.querySelector('.tlabel');
    return { label: getComputedStyle(l).display, h: t.getBoundingClientRect().height, text: l.textContent };
  });
  T('⑦ 抽屉态 Tab 文字可见', tab.label !== 'none' && tab.text.length > 0, JSON.stringify(tab));
  T('⑦ 抽屉态 Tab ≥40px', tab.h >= 40, `${tab.h}px`);
}

console.log('PASS'); pass.forEach(p => console.log('  ✓', p));
if (fail.length) { console.log('FAIL'); fail.forEach(f => console.log('  ✗', f)); }
console.log('ERRORS', errors.length, JSON.stringify(errors.slice(0, 5)));
await browser.close(); server.close();
process.exit(fail.length || errors.length ? 1 : 0);
