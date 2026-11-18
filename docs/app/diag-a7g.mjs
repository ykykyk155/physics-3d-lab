import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18140;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); page.on('pageerror',e=>console.log('PE:',String(e).slice(0,150)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A7-lever'));
await page.waitForFunction(()=>{const e=window.__LAB.current().exp;return e&&e._impl&&e._impl._physReady;},{timeout:20000});
// 完全照 probe：多次独立 evaluate 调 seek/readouts
await page.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam('f1',5);e.onParam('l1',3);e.onParam('f2',1);e.onParam('l2',1);});
await new Promise(r=>setTimeout(r,300));
const dur = await page.evaluate(()=>window.__LAB.current().exp.duration);
const A = () => page.evaluate(()=>{const impl=window.__LAB.current().exp._impl;return +(2*Math.atan2(impl.beamG.quaternion.z,impl.beamG.quaternion.w)*180/Math.PI).toFixed(2);});
const logs=[];
await page.evaluate(tt=>window.__LAB.current().exp.seek(tt), dur*0.7); logs.push(['seek(.7dur)', await A()]);
await page.evaluate(tt=>window.__LAB.current().exp.seek(tt), dur*0.7); logs.push(['seek(.7dur) again', await A()]);
await page.evaluate(()=>window.__LAB.current().exp.seek(0)); logs.push(['seek(0)', await A()]);
const r0 = await page.evaluate(()=>window.__LAB.current().exp.readouts()); logs.push(['after readouts() at 0', await A()]);
await page.evaluate(d=>window.__LAB.current().exp.seek(d), dur); logs.push(['seek(dur)', await A()]);
const r1 = await page.evaluate(()=>window.__LAB.current().exp.readouts()); logs.push(['after readouts() at dur', await A()]);
console.log('dur=',dur);
console.log(JSON.stringify(logs));
console.log('r1 梁倾角读数=', JSON.stringify(r1.find(x=>/倾角/.test(x.label))));
await b.close(); server.close();
