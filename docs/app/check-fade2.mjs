import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18120;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const t0=Date.now(); const rows=[];
for (let i=0;i<14;i++){
  const r = await page.evaluate(()=>{
    const el=document.elementFromPoint(1386,34);
    const f=document.getElementById('fade'); const bt=document.getElementById('boot');
    const st=e=>e?{d:getComputedStyle(e).display,o:+getComputedStyle(e).opacity,pe:getComputedStyle(e).pointerEvents}:null;
    return { top: el?(el.id||el.className||el.tagName):null, fade:st(f), boot:st(bt) };
  });
  rows.push({ms:Date.now()-t0, ...r});
  await sleep(40);
}
for (const r of rows) console.log(String(r.ms).padStart(4)+'ms', '顶层:', String(r.top).padEnd(10), 'fade:', JSON.stringify(r.fade), 'boot.pe:', r.boot?r.boot.pe:'-');
// 在被挡窗口结束前刚过去那一刻点一次，确认一次成功
await page.click('#audioBtn'); await sleep(150);
const s = await page.evaluate(()=>({cls:document.getElementById('audioBtn').className, ls:localStorage.getItem('lab-audio')}));
console.log('稳定后点击 →', JSON.stringify(s));
await b.close(); server.close();
