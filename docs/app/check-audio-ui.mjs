import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18115;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
const errs=[]; page.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
console.log('== 默认参数下三个声学场景是否真有声 ==');
for (const id of ['C1-sound-medium','C2-sound-chars','C3-noise-control']) {
  await page.evaluate(i=>window.__LAB.switch(i), id); await sleep(900);
  const o = await page.evaluate(()=>window.__LAB.current().exp.audioAt(window.__LAB.store.simTime||0));
  console.log(' ', id.padEnd(18), JSON.stringify(o));
}
console.log('== 音频开关与统计面板的位置关系 ==');
await page.evaluate(()=>window.__LAB.switch('C1-sound-medium')); await sleep(700);
const geo = await page.evaluate(()=>{
  const vp=document.getElementById('viewport').getBoundingClientRect();
  const st=document.getElementById('stats');
  const sr=st?st.getBoundingClientRect():null;
  let btn=null;
  document.querySelectorAll('button,[role=button]').forEach(el=>{
    const b=el.getBoundingClientRect();
    if(b.width>16&&b.width<70&&b.height>16&&b.height<70&&b.top<120&&b.right>vp.right-260){ if(!btn||b.top<btn.top) btn={x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),label:(el.title||el.getAttribute('aria-label')||el.textContent||'').slice(0,12)}; }
  });
  const overlap = btn&&sr ? !(btn.x+btn.w<sr.x || btn.x>sr.x+sr.width || btn.y+btn.h<sr.y || btn.y>sr.y+sr.height) : null;
  return { viewport:{x:Math.round(vp.x),y:Math.round(vp.y),w:Math.round(vp.width)}, stats: sr?{x:Math.round(sr.x),y:Math.round(sr.y),w:Math.round(sr.width),h:Math.round(sr.height)}:null, audioBtn: btn, overlap };
});
console.log(' ', JSON.stringify(geo));
console.log('报错:', errs.length? errs.slice(0,3).join(' / ') : '0 条');
await b.close(); server.close();
