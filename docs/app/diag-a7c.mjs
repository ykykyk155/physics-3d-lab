import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18136;
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
  const w = impl._phys;            // recompute 之后再取新世界
  const meshAng = () => +(2*Math.atan2(impl.beamG.quaternion.z, impl.beamG.quaternion.w)*180/Math.PI).toFixed(2);
  const out = {
    bodies: w.bodies.length,
    cons: w.constraints.length,
    bodyInfo: w.bodies.map(bd => ({ key: bd.key, mass: bd.body.getInvMass()>0 ? +(1/bd.body.getInvMass()).toFixed(3):'static' })),
    samples: []
  };
  const sample = (label) => out.samples.push({ label, ang: meshAng(), w1: [+impl.w1root.position.x.toFixed(3),+impl.w1root.position.y.toFixed(3)], w2:[+impl.w2root.position.x.toFixed(3),+impl.w2root.position.y.toFixed(3)] });
  w.reset(); sample('reset');
  for (let i=1;i<=6;i++){ for(let k=0;k<22;k++) w.dynamicsWorld.stepSimulation(1/60,1,1/60); w.sync(); sample('step '+(i*22)); }
  // 梁自身重力矩为0（质心在支点），检查钩码是否挂在正确位置（应 x=-0.96 / +0.32）
  out.hookBind = { w1: [+impl.w1root.position.x.toFixed(3), +impl.w1root.position.y.toFixed(3)], w2:[+impl.w2root.position.x.toFixed(3),+impl.w2root.position.y.toFixed(3)] };
  out.x1 = -(impl.p.l1)*0.32; out.x2 = impl.p.l2*0.32;
  return out;
});
console.log(JSON.stringify(diag,null,1));
await b.close(); server.close();
