import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18152;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A2-newton-first'));
await page.waitForFunction(()=>{const e=window.__LAB.current().exp;return e&&e._impl&&e._impl._physReady;},{timeout:20000});
// 隔一段播放，拍两种表面
await page.evaluate(()=>{document.getElementById('stats').style.display='none';});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shoot=async(name,setup)=>{await page.evaluate(setup); await sleep(600); const vp=await page.$('#viewport'); await vp.screenshot({path:path.join(ROOT,'shots','all',name)});};
await shoot('A2-ammo-cloth.png', ()=>{const e=window.__LAB.current().exp; window.__LAB.store.playback.playing=false; e.onParam('surface',0.3); e.onParam('height',0.15); e.seek(e.duration);});
await shoot('A2-ammo-wood.png', ()=>{const e=window.__LAB.current().exp; window.__LAB.store.playback.playing=false; e.onParam('surface',0.12); e.onParam('height',0.15); e.seek(e.duration);});
console.log('shots done');
await b.close(); server.close();
