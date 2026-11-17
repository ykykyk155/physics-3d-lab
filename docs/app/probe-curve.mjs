import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18131;
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
  const o={};
  // 找曲线对象：Line2
  let lines=[]; window.__LAB.current().scene.traverse(x=>{ if(x.isLine2) lines.push(x); });
  o.lineCount=lines.length;
  o.lines=lines.map(l=>{ const a=l.geometry.attributes; return { has:a.instanceStart?true:false, count:a.instanceStart?a.instanceStart.count:0, first:a.instanceStart?[a.instanceStart.data.array[0],a.instanceStart.data.array[1],a.instanceStart.data.array[2]]:null }; });
  return o;
});
console.log(JSON.stringify(out,null,1));
await b.close(); server.close();
