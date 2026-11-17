import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18133;
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
  const curve = lines.find(l=>{ const a=l.geometry.attributes.instanceStart; if(!a) return false; const arr=a.data.array; return Math.abs(arr[0]-0.45)<0.01 && Math.abs(arr[2])<0.01; });
  if(!curve) return {found:false, n:lines.length};
  const g=curve.geometry, a=g.attributes.instanceStart;
  const arr=a.data.array;
  return { found:true, instanceCount:g.instanceCount, attrCount:a.count, itemSize:a.itemSize, stride:a.data.stride,
    first:[arr[0],arr[1],arr[2]], last:[a.data.array[(a.count-1)*a.data.stride], a.data.array[(a.count-1)*a.data.stride+1]],
    visible:curve.visible, frustum:curve.frustumCulled, linewidth:curve.material.linewidth, opacity:curve.material.opacity, transparent:curve.material.transparent };
});
console.log(JSON.stringify(out));
await b.close(); server.close();
