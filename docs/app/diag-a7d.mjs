import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18137;
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
const diag = await page.evaluate(()=>{
  const impl = window.__LAB.current().exp._impl;
  impl.p.f1=5; impl.p.l1=3; impl.p.f2=1; impl.p.l2=1; impl.recompute();
  const w = impl._phys;
  const ang = () => +(2*Math.atan2(impl.beamG.quaternion.z, impl.beamG.quaternion.w)*180/Math.PI).toFixed(3);
  const out = { bodies: w.bodies.length, cons: w.constraints.length, keys: w.bodies.map(bd=>bd.key), samples: [] };
  const sample = (l) => out.samples.push({ l, ang: ang(), w1x:+impl.w1root.position.x.toFixed(3), w1y:+impl.w1root.position.y.toFixed(3), w2x:+impl.w2root.position.x.toFixed(3), w2y:+impl.w2root.position.y.toFixed(3) });
  w.reset(); sample('reset');
  for (let i=1;i<=6;i++){ for(let k=0;k<22;k++) w.dynamicsWorld.stepSimulation(1/60,1,1/60); w.sync(); sample('s'+(i*22)); }
  return out;
});
console.log(JSON.stringify(diag));
await b.close(); server.close();
