import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18144;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A7-lever'));
await page.waitForFunction(()=>{const e=window.__LAB.current().exp;return e&&e._impl&&e._impl._physReady;},{timeout:20000});
await page.evaluate(()=>{document.getElementById('stats').style.display='none';});
await new Promise(r=>setTimeout(r,300));
const shoot = async (name, setup) => { await page.evaluate(setup); await new Promise(r=>setTimeout(r,500)); const vp=await page.$('#viewport'); await vp.screenshot({path:path.join(ROOT,'shots','all',name)}); };
// 平衡
await shoot('A7-ammo-balanced.png', ()=>{const e=window.__LAB.current().exp; window.__LAB.store.playback.playing=false; e.onParam('f1',2);e.onParam('l1',4);e.onParam('f2',4);e.onParam('l2',2); e.seek(0);});
// 不平衡：左重，转到25°
await shoot('A7-ammo-tilt.png', ()=>{const e=window.__LAB.current().exp; window.__LAB.store.playback.playing=false; e.onParam('f1',5);e.onParam('l1',3);e.onParam('f2',1);e.onParam('l2',1); e.seek(2.2);});
// 反向：右重
await shoot('A7-ammo-tilt-r.png', ()=>{const e=window.__LAB.current().exp; window.__LAB.store.playback.playing=false; e.onParam('f1',1);e.onParam('l1',1);e.onParam('f2',5);e.onParam('l2',3); e.seek(2.2);});
console.log('shots done');
await b.close(); server.close();
