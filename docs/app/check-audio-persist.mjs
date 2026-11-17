import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18117;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const URL_ = `http://127.0.0.1:${PORT}/index.html`;
await page.goto(URL_,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const state = () => page.evaluate(()=>{
  const el=document.getElementById('audioBtn');
  const ls={}; for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i); ls[k]=localStorage.getItem(k);}
  return { exists:!!el, cls:el?el.className:null, title:el?el.title:null, storage:ls };
});
console.log('初始:', JSON.stringify(await state()));
await page.click('#audioBtn'); await sleep(600);
console.log('点击后:', JSON.stringify(await state()));
await page.reload({waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await sleep(500);
console.log('刷新后:', JSON.stringify(await state()));
await page.click('#audioBtn'); await sleep(400);
console.log('再点关闭:', JSON.stringify(await state()));
await page.reload({waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await sleep(400);
console.log('刷新后(应保持关):', JSON.stringify(await state()));
await b.close(); server.close();
