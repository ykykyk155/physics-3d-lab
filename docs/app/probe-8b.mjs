import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18153;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const IDS=["A1-incline-speed","A2-newton-first","A3-friction","A6-energy","A7-lever","F1-melting-curve","F2-boiling","F3-heat-engine"];
for(const id of IDS){
  const msgs=[];
  const h=m=>{ if(m.type()==="error") msgs.push(m.text()); };
  pg.on("console",h);
  await pg.evaluate(i=>window.__LAB.switch(i), id); await sl(800);
  pg.off("console",h);
  const r=await pg.evaluate(()=>{
    const cur=window.__LAB.current(); const e=cur&&cur.exp;
    if(!e) return { dur:null, note:"exp null" };
    const d=e.duration;
    return { dur: d===Infinity? "Infinity" : (typeof d==="number"? +d.toFixed(2): d), hasSeek: typeof e.seek==="function" };
  });
  console.log(id, JSON.stringify(r), msgs.length? "ERRS="+JSON.stringify(msgs.slice(0,2)) : "");
}
await b.close(); server.close();
