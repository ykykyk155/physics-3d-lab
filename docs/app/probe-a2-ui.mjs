// 走真实 UI（自定义下拉）验证 A2：每种表面选中后按钮文案、μ、终止距离、μ=0 是否坠落
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18153;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:800});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A2-newton-first'));
await page.waitForFunction(()=>{const e=window.__LAB.current().exp;return e&&e._impl&&e._impl._physReady;},{timeout:30000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const rows=[];
const labels=['毛巾','棉布','木板','冰面','理想光滑'];
for (let i=0;i<labels.length;i++) {
  const ok = await page.evaluate((idx)=>{
    // 找到标签为「表面材料」的块，点它里面的选项
    const blocks=[...document.querySelectorAll('#panel .param, #panel > div, #panel div')];
    const lis=[...document.querySelectorAll('#panel .dropdown li')];
    if(!lis.length) return {err:'no li'};
    // 表面材料是含 5 个选项的那个 dropdown
    const groups={};
    for(const li of lis){ const ul=li.parentElement; (groups[ul.dataset.gid] ||= []).push(li); }
    const fiveLis = Object.values(groups).find(a=>a.length===5) || lis.slice(0,5);
    const target = fiveLis[idx];
    if(!target) return {err:'no option '+idx, count: fiveLis.length};
    target.click();
    return {clicked: target.textContent};
  }, i);
  await sleep(600);
  try {
    await page.waitForFunction(()=>{const e=window.__LAB.current().exp && window.__LAB.current().exp._impl; return e && e._phys && e._phys.bodies && e._phys.bodies.length;},{timeout:15000});
  } catch(e) { console.log('  [warn] phys not ready for', labels[i]); }
  await sleep(400);
  const r = await page.evaluate(async ()=>{
    const e=window.__LAB.current().exp._impl;
    window.__LAB.store.playback.playing=false;
    const d=e.duration;
    if (Number.isFinite(d)) e.seek(d); else e.seek(8);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const cart=window.__LAB.current().scene.getObjectByName('A2-cart');
    const btn=[...document.querySelectorAll('#panel .dropdown > button span')].map(s=>s.textContent);
    return { dropdowns: btn, mu: e.p.surface, duration: d,
             x:+(cart?.position.x ?? NaN).toFixed(3), y:+(cart?.position.y ?? NaN).toFixed(3), z:+(cart?.position.z ?? NaN).toFixed(3),
             readouts: (e.readouts()||[]).map(x=>x.label+'='+x.value) };
  });
  rows.push({label:labels[i], clicked: ok.clicked, ...r});
  const vp=await page.$('#viewport'); await vp.screenshot({path:path.join(ROOT,'shots','a2-ui-'+labels[i]+'.png')});
}
console.log('真实 UI 选择结果:');
for(const r of rows) console.log(' ', JSON.stringify(r));
console.log('\nERRORS', errs.length, errs.slice(0,3));
await b.close(); server.close();
