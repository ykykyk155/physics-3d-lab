import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18143;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const rows=[];
for (const id of ["A2-newton-first","F1-melting-curve"]) {
  await pg.evaluate(i=>window.__LAB.switch(i), id); await sl(700);
  const r = await pg.evaluate(()=>{
    const e=window.__LAB.current().exp;
    const out={ duration:String(e.duration), isInf: e.duration===Infinity, hasSeek: typeof e.seek==="function" };
    // ∞ 时长下 seek 任意值必须安全（不出 NaN）
    const bad=[];
    if (e.seek) {
      for (const t of [0, 12.5, 1e6, NaN, -5, 3.4]) {
        try { e.seek(t); } catch(err){ bad.push(String(err)); }
      }
      e.seek(0);
    }
    out.seekErrors=bad;
    return out;
  });
  rows.push({id,...r});
}
console.log(JSON.stringify(rows));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0,3)));
await b.close(); server.close();
