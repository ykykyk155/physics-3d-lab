import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18197;
const MIME={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".png":"image/png"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:900});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') errs.push('console:'+m.text()); });
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await pg.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async n=>{ await sleep(320); await pg.screenshot({path:path.join(ROOT,'shots',n)}); };

await pg.evaluate(()=>window.__LAB.switch('A1-incline-speed'));
await sleep(900);

// ---- 全档位几何扫描：θ 5~45°、length 0.5~1.5，检查起终点整车留在板内 + 轮底相切 + 坡体抬高正确 ----
const combos=[]; for(const th of [5,10,20,30,45]) for(const len of [0.5,0.75,1.0,1.25,1.5]) combos.push([th,len]);
const sweep=[];
for(const [th,len] of combos){
  const r=await pg.evaluate((th,len)=>{
    const LB=window.__LAB; LB.store.playback.playing=false; const e=LB.current().exp._impl;
    e.onParam('theta',th); e.onParam('length',len);
    const Lv=e.p.length||1, half=e._cartLen/2;
    e.seek(0); const sx=e.cartG.position.x, sy=e.cartG.position.y;
    e.seek(e.duration); const ex=e.cartG.position.x;
    const t=0.06,s=Math.sin(th*Math.PI/180),c=Math.cos(th*Math.PI/180),tn=Math.tan(th*Math.PI/180);
    const legX=Lv*c-0.10, legTop=tn*((legX-0.03)-t*s);
    return { th,len, cartLen:+e._cartLen.toFixed(4), travel:+e._travel.toFixed(4),
      mSF:+(Lv-(sx+half)).toFixed(4), mSR:+(sx-half).toFixed(4),
      mEF:+(Lv-(ex+half)).toFixed(4), mER:+(ex-half).toFixed(4),
      cartBottomY:+sy.toFixed(4), rampLift:+e.rampGroup.position.y.toFixed(4),
      expLift:+(t*c).toFixed(4), legTop:+legTop.toFixed(4), dur:+Number(e.duration).toFixed(4) };
  }, th, len);
  const minM=Math.min(r.mSF,r.mSR,r.mEF,r.mER);
  r.minM=+minM.toFixed(4);
  r.ok = minM>=0.049 && Math.abs(r.cartBottomY)<1e-6 && Math.abs(r.rampLift-r.expLift)<1e-6;
  sweep.push(r);
}

// ---- 默认档 θ20 L1：t=0 / 中段 / 终点 三图 ----
await pg.evaluate(()=>window.__LAB.reset()); await sleep(600);
await pg.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam('theta',20);e.onParam('length',1);});
await sleep(300);
const dur=await pg.evaluate(()=>window.__LAB.current().exp.duration);
await pg.evaluate(()=>window.__LAB.current().exp.seek(0)); await shot('a1-fix-t0.png');
await pg.evaluate(d=>window.__LAB.current().exp.seek(d*0.55),dur); await shot('a1-fix-mid.png');
await pg.evaluate(d=>window.__LAB.current().exp.seek(d),dur); await shot('a1-fix-end.png');
// 侧视 + 低端特写（看接缝/腿/承台）
await pg.evaluate(d=>window.__LAB.current().exp.seek(d*0.55),dur);
await pg.evaluate(()=>{const c=window.__LAB.camera(),t=window.__LAB.controls();c.position.set(1.0,0.55,3.2);t.target.set(0.55,0.16,0);t.update();}); await shot('a1-fix-side.png');
await pg.evaluate(()=>{const c=window.__LAB.camera(),t=window.__LAB.controls();c.position.set(-0.7,0.45,1.7);t.target.set(0.18,0.10,0);t.update();}); await shot('a1-fix-lowend.png');
// 极端档：θ45 L0.5
await pg.evaluate(()=>window.__LAB.reset()); await sleep(600);
await pg.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam('theta',45);e.onParam('length',0.5);});
await pg.evaluate(()=>{const c=window.__LAB.camera(),t=window.__LAB.controls();c.position.set(1.2,0.7,2.4);t.target.set(0.35,0.20,0);t.update();});
await sleep(300); await pg.evaluate(()=>window.__LAB.current().exp.seek(0)); await shot('a1-fix-ext45-l05-t0.png');
let d2=await pg.evaluate(()=>window.__LAB.current().exp.duration); await pg.evaluate(d=>window.__LAB.current().exp.seek(d),d2); await shot('a1-fix-ext45-l05-end.png');
// 极端档：θ5 L1.5
await pg.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam('theta',5);e.onParam('length',1.5);});
await pg.evaluate(()=>{const c=window.__LAB.camera(),t=window.__LAB.controls();c.position.set(1.8,0.7,3.4);t.target.set(0.8,0.25,0);t.update();});
await sleep(300); await pg.evaluate(()=>window.__LAB.current().exp.seek(0)); await shot('a1-fix-ext5-l15-t0.png');

const viol=sweep.filter(s=>!s.ok);
console.log(JSON.stringify({count:sweep.length, violations:viol.length, durDefault:dur, sweep, errs:errs.slice(0,6)},null,1));
await b.close(); server.close();
