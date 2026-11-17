import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18171;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("A7-lever")); await sl(900);
await pg.evaluate(()=>{ window.__LAB.store.playback.playing=false; });
const shot=async(name)=>{
  await sl(350);
  await pg.evaluate(()=>{const r=window.__LAB.renderer(),c=window.__LAB.camera(),s=window.__LAB.current().scene;if(s)r.render(s,c);});
  const vp=await pg.$('#viewport'); await vp.screenshot({path:path.join(ROOT,"shots","all",name+".png")});
  const i=await pg.evaluate(()=>{const r=window.__LAB.renderer();return{calls:r.info.render.calls,tris:r.info.render.triangles};});
  console.log(name,JSON.stringify(i));
};
// 场景1：CEO 的验收场景 —— F1 最大、L1 最小
const r1=await pg.evaluate(()=>{ const e=window.__LAB.current().exp;
  e.onParam("f1",5); e.onParam("l1",0.4); e.onParam("f2",1); e.onParam("l2",4);
  e.seek(2.2);
  return { dur:e.duration, net:e.net, angleDeg:+(e.angle*180/Math.PI).toFixed(1), label:document.querySelector ? null : null };
});
console.log("F1max/L1min:", JSON.stringify(r1));
await shot("A7-f1max");
// 场景2：平衡（1×4 vs 4×1）
const r2=await pg.evaluate(()=>{ const e=window.__LAB.current().exp;
  e.onParam("f1",1); e.onParam("l1",4); e.onParam("f2",4); e.onParam("l2",1); e.seek(2.2);
  return { dur:e.duration, net:e.net, angleDeg:+(e.angle*180/Math.PI).toFixed(1) };
});
console.log("balanced:", JSON.stringify(r2));
await shot("A7-balanced");
// 场景3：右侧力矩大（默认）
const r3=await pg.evaluate(()=>{ const e=window.__LAB.current().exp;
  e.onParam("f1",1); e.onParam("l1",1); e.onParam("f2",1); e.onParam("l2",1); e.seek(2.2);
  return { dur:e.duration, net:e.net, angleDeg:+(e.angle*180/Math.PI).toFixed(1) };
});
console.log("net=0", JSON.stringify(r3));
const r4=await pg.evaluate(()=>{ const e=window.__LAB.current().exp;
  e.onParam("f2",2); e.seek(2.2); return { dur:e.duration, net:e.net, angleDeg:+(e.angle*180/Math.PI).toFixed(1) };
});
console.log("right heavy:", JSON.stringify(r4));
await shot("A7-lever");
console.log("PAGEERRORS",errs.length,JSON.stringify(errs.slice(0,3)));
await b.close(); server.close();
