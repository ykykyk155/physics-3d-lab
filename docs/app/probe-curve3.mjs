import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18135;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("F1-melting-curve")); await sl(900);
const out=await pg.evaluate(()=>{
  const e=window.__LAB.current().exp; e.seek(560);
  let lines=[]; window.__LAB.current().scene.traverse(x=>{ if(x.isLine2) lines.push(x); });
  const info=lines.map(l=>{ const a=l.geometry.attributes.instanceStart; const arr=a?a.data.array:null;
    return { n:a?a.count:0, inst:l.geometry.instanceCount, first:arr?[+arr[0].toFixed(2),+arr[1].toFixed(2),+arr[2].toFixed(2)]:null, lw:l.material.linewidth, op:l.material.opacity }; });
  const curve = lines.find(l=>{ const a=l.geometry.attributes.instanceStart; return a && a.count>50; });
  if(curve){ curve.material.color.set('#00FF00'); curve.material.linewidth=8; curve.material.needsUpdate=true; }
  const r=window.__LAB.renderer(), c=window.__LAB.camera(); r.render(window.__LAB.current().scene,c);
  return { info, picked: !!curve };
});
console.log(JSON.stringify(out));
await pg.screenshot({path:path.join(ROOT,"shots","all","_f1green.png")});
await b.close(); server.close();
