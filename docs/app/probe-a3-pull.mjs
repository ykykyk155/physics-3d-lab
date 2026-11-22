import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18187;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:800});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("A3-friction")); await sl(800);
const out=await pg.evaluate(()=>{
  const w=window.__LAB.current().exp; const e=w._impl;
  const rows=[];
  for(const pull of [0.05,0.1,0.15,0.2,0.3]){
    e.onParam('pull',pull);
    e.drawAt(0); const x0=e.x;
    e.drawAt(1); const x1=e.x;
    e.drawAt(2); const x2=e.x;
    rows.push({pull,duration:+e.duration.toFixed(3),x0:+x0.toFixed(3),x1:+x1.toFixed(3),x2:+x2.toFixed(3),speed:(x1-x0)});
  }
  // UI slider values too
  const ui={};
  document.querySelectorAll('.param-block').forEach(b=>{const id=b.dataset.pid;const i=b.querySelector('input[type=range]');if(i)ui[id]=i.value;});
  return {rows,ui};
});
console.log(JSON.stringify(out,null,1));
console.log('PAGEERRORS',errs.length,JSON.stringify(errs.slice(0,5)));
await b.close(); server.close();
