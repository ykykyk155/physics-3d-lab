import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18143;
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
  window.__LAB.store.playback.playing=false;
  e.onParam('f1',5);e.onParam('l1',3);e.onParam('f2',1);e.onParam('l2',1);
  const ang = () => +(2*Math.atan2(impl.beamG.quaternion.z, impl.beamG.quaternion.w)*180/Math.PI).toFixed(2);
  const sweep=[];
  for (const t of [0,0.5,1.0,1.4,1.8,2.2]){ e.seek(t); sweep.push({t, ang:ang()}); }
  // 计时：单次 seek(2.2) 耗时
  const t0=performance.now(); for(let i=0;i<20;i++) e.seek(2.2); const perSeek=(performance.now()-t0)/20;
  // 顺序播放 vs 拖动
  e.seek(0); let acc=0; const S=1/60; while(acc+S<=1.54+1e-9){e.step(S);acc+=S;} const seq=ang();
  e.seek(1.54); const drag=ang();
  return { sweep, perSeekMs:+perSeek.toFixed(2), seq, drag };
});
console.log(JSON.stringify(r));
await b.close(); server.close();
