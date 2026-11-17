import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18161;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const IDS=["A1-incline-speed","A2-newton-first","A3-friction","A6-energy","A7-lever","F1-melting-curve","F2-boiling","F3-heat-engine"];
const rows=[];
for(const id of IDS){
  await pg.evaluate(i=>window.__LAB.switch(i), id); await sl(700);
  await pg.evaluate(()=>{ window.__LAB.store.playback.playing=false; });
  const r=await pg.evaluate(()=>{
    const e=window.__LAB.current().exp; const d=e.duration;
    const out={ dur: d===Infinity? "Infinity": +Number(d).toFixed(2) };
    const picks=[0, d*0.13, d*0.5, d*0.77, d];
    const snap=()=>{ let s=""; const sc=window.__LAB.current().scene;
      sc.traverse(o=>{ if(o.isMesh&&o.userData&&o.userData.cart) s+="C"+o.position.x.toFixed(3)+","+o.position.y.toFixed(3); });
      s+=JSON.stringify(window.__LAB.store.readouts||{}); return s; };
    const fwd=picks.map(t=>{e.seek(t);return snap();});
    const back=picks.slice().reverse().map(t=>{e.seek(t);return snap();}).reverse();
    out.det=JSON.stringify(fwd)===JSON.stringify(back);
    let bad=false; window.__LAB.current().scene.traverse(o=>{ if(o.position&&(!Number.isFinite(o.position.x)||!Number.isFinite(o.position.y)||!Number.isFinite(o.position.z))) bad=true; });
    out.nan=bad; out.sample=fwd[2].slice(0,60);
    return out;
  });
  rows.push({id,...r});
}
rows.forEach(r=>console.log(r.id, JSON.stringify(r)));
console.log("PAGEERRORS",errs.length,JSON.stringify(errs.slice(0,4)));
await b.close(); server.close();
