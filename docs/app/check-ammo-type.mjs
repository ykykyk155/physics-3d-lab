import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18132;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage();
page.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,200)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const r = await page.evaluate(()=>{
  let out = { hasLabLoad: typeof window.__LAB.loadAmmo === 'function', ammoType: typeof window.Ammo };
  try {
    const res = window.__LAB.loadAmmo();
    out.retType = typeof res;
    out.isPromise = res && typeof res.then === 'function';
  } catch(e){ out.callErr = String(e).slice(0,120); }
  return out;
});
console.log('同步检查:', JSON.stringify(r));
// 真正 await 一次
const r2 = await page.evaluate(async()=>{
  try {
    const lib = await window.__LAB.loadAmmo();
    return { ok:true, libType: typeof lib, hasBtVector3: !!(lib && lib.btVector3), hasBtDiscrete: !!(lib && lib.btDiscreteDynamicsWorld),
             windowAmmoType: typeof window.Ammo, windowAmmoHasBt: !!(window.Ammo && window.Ammo.btVector3) };
  } catch(e){ return { ok:false, err:String(e).slice(0,200) }; }
});
console.log('await loadAmmo:', JSON.stringify(r2));
console.log('ammoRequests:', await page.evaluate(()=>window.__LAB.ammoRequests && window.__LAB.ammoRequests()));
await b.close(); server.close();
