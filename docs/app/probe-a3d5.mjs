import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18181;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const chk=async(id, label)=>{
  await pg.evaluate(i=>window.__LAB.switch(i), id); await sl(700);
  await pg.evaluate(()=>{window.__LAB.store.playback.playing=false;});
  const r=await pg.evaluate(()=>{
    const e=window.__LAB.current().exp; const d=e.duration;
    const out={dur:d===Infinity?"Infinity":+Number(d).toFixed(2)};
    if(d>0){ const picks=[0,d*0.2,d*0.9,d];
      const snap=()=>{let s="";window.__LAB.current().scene.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.cart)s+="C"+o.position.x.toFixed(3);});return s+JSON.stringify(window.__LAB.store.readouts||{});};
      const f=picks.map(t=>{e.seek(t);return snap();});
      const rv=picks.slice().reverse().map(t=>{e.seek(t);return snap();}).reverse();
      out.det=JSON.stringify(f)===JSON.stringify(rv);
    }
    return out;
  });
  console.log(label, JSON.stringify(r));
};
// A3 两端：pull=0.3 应 4s，pull=0.05 应 12s
await pg.evaluate(()=>window.__LAB.switch("A3-friction")); await sl(700);
for(const pull of [0.3,0.1,0.05]){
  const d=await pg.evaluate(p=>{const e=window.__LAB.current().exp;e.onParam("pull",p);return e.duration;}, pull);
  console.log("A3 pull="+pull+" -> duration", d);
}
// A7 branch: 平衡 0 / 不平衡 2.2
await pg.evaluate(()=>window.__LAB.switch("A7-lever")); await sl(700);
const a7a=await pg.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam("f1",2);e.onParam("l1",4);e.onParam("f2",4);e.onParam("l2",2);return e.duration;});
const a7b=await pg.evaluate(()=>{const e=window.__LAB.current().exp;e.onParam("f2",1);return e.duration;});
console.log("A7 balanced->",a7a," unbalanced->",a7b);
await chk("D5-power-joule","D5");
const d5=await pg.evaluate(()=>{const e=window.__LAB.current().exp;const a=e.duration;e.onParam("time",5);const b=e.duration;return [a,b];});
console.log("D5 time=3 ->",d5[0]," time=5 ->",d5[1]);
console.log("PAGEERRORS",errs.length,JSON.stringify(errs.slice(0,4)));
await b.close(); server.close();
