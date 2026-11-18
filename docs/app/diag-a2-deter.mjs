import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18151;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); page.on('pageerror',e=>console.log('PE:',String(e).slice(0,150)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A2-newton-first'));
await page.waitForFunction(()=>{const e=window.__LAB.current().exp;return e&&e._impl&&e._impl._physReady;},{timeout:20000});
const r = await page.evaluate(()=>{
  const e = window.__LAB.current().exp;
  window.__LAB.store.playback.playing=false;
  e.onParam('surface',0.3); e.onParam('height',0.15);
  const t = e.duration*0.7;
  const probe=()=>{ const s=window.__LAB.current().scene; const c=s.getObjectByName('A2-cart'); return c? +c.position.x.toFixed(6):NaN; };
  // 同一次 evaluate 连续 seek
  e.seek(t); const p1=probe();
  e.seek(t); const p2=probe();
  e.seek(t); const p3=probe();
  // 跨不同 call 是否不同（模拟真实时间间隔）
  return { p1, p2, p3, d12:Math.abs(p1-p2), d23:Math.abs(p2-p3), dur:e.duration, t };
});
console.log(JSON.stringify(r,null,1));
await b.close(); server.close();
