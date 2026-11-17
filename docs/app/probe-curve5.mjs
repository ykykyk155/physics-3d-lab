import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18141;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("F1-melting-curve")); await sl(900);
await pg.evaluate(()=>{ window.__LAB.store.playback.playing=false; });
const out=await pg.evaluate(()=>{
  const scene=window.__LAB.current().scene, cam=window.__LAB.camera();
  let lines=[]; scene.traverse(x=>{ if(x.isLine2) lines.push(x); });
  const curve=lines.find(l=>{const a=l.geometry.attributes.instanceStart;return a&&a.count>50;});
  const a=curve.geometry.attributes.instanceStart, d=a.data.array, st=a.data.stride;
  const proj=[];
  const tmp = curve.position.clone();
  for(const i of [0, 40, 93, 140, 186]){
    tmp.set(d[i*st], d[i*st+1], d[i*st+2]);
    tmp.project(cam);
    proj.push({ i, sx:Math.round((tmp.x*0.5+0.5)*window.innerWidth), sy:Math.round((-tmp.y*0.5+0.5)*window.innerHeight) });
  }
  return { n:a.count, inst:curve.geometry.instanceCount, proj };
});
console.log(JSON.stringify(out));
await b.close(); server.close();
