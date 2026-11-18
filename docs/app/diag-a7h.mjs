import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18141;
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
const r = await page.evaluate(()=>{
  const e = window.__LAB.current().exp; const impl = e._impl;
  window.__LAB.store.playback.playing = false;
  e.onParam('f1',5); e.onParam('l1',3); e.onParam('f2',1); e.onParam('l2',1);
  const ang = () => +(2*Math.atan2(impl.beamG.quaternion.z, impl.beamG.quaternion.w)*180/Math.PI).toFixed(2);
  const out = {};
  e.seek(0); out.seek0_ang = ang(); out.seek0_read = (e.readouts().find(x=>/倾角/.test(x.label))||{}).value;
  e.seek(e.duration); out.seekDur_ang = ang(); out.seekDur_read = (e.readouts().find(x=>/倾角/.test(x.label))||{}).value; out.duration = e.duration;
  // 顺序播放
  e.seek(0); let acc=0; const STEP=1/60; while(acc+STEP<=1.54+1e-9){ e.step(STEP); acc+=STEP; } out.seq154_ang = ang();
  e.seek(1.54); out.drag154_ang = ang();
  return out;
});
console.log(JSON.stringify(r,null,1));
await b.close(); server.close();
