import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT=process.cwd(),PORT=18180;
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname);if(p==='/')p='/index.html';let f=path.join(ROOT,p);if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'};res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page=await b.newPage();await page.setViewport({width:1420,height:700,deviceScaleFactor:1});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A2-newton-first'));
await new Promise(r=>setTimeout(r,1200));
const info=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('#panel button, .panel button, aside button, button')];
  const list=els.map(e=>({t:e.textContent.trim().slice(0,30), cls:e.className, pid:e.dataset?e.dataset.pid:null})).filter(x=>x.t.length<20);
  return list.slice(0,40);
});
console.log(JSON.stringify(info,null,2));
await b.close();server.close();
