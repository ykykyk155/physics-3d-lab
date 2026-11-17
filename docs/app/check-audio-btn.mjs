import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18116;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.evaluate(()=>window.__LAB.switch('C1-sound-medium')); await sleep(800);
const list = await page.evaluate(()=>{
  const vp=document.getElementById('viewport').getBoundingClientRect();
  const st=document.getElementById('stats'); const sr=st?st.getBoundingClientRect():null;
  const out=[];
  document.querySelectorAll('button,[role=button],div[class*=audio],div[class*=sound]').forEach(el=>{
    const b=el.getBoundingClientRect();
    if(b.width<8||b.height<8||b.width>120||b.height>120) return;
    if(b.top>160) return;
    out.push({cls:(el.className||'').toString().slice(0,28), title:el.title||el.getAttribute('aria-label')||'', txt:(el.textContent||'').trim().slice(0,6), x:Math.round(b.x), y:Math.round(b.y), w:Math.round(b.width), h:Math.round(b.height),
      inPanel: sr? !(b.right<sr.left||b.left>sr.right||b.bottom<sr.top||b.top>sr.bottom) : false});
  });
  return {vpRight: Math.round(vp.right), panelLeft: sr?Math.round(sr.left):null, items: out};
});
console.log('viewport 右边界', list.vpRight, '| 统计面板左边界', list.panelLeft);
for (const it of list.items) console.log(' ', JSON.stringify(it));
await b.close(); server.close();
