import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18191;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
const IDS=["A1-incline-speed","A2-newton-first","A3-friction","A6-energy","A7-lever","D5-power-joule","F1-melting-curve","F2-boiling","F3-heat-engine"];
const out=[];
for(const id of IDS){
  await pg.evaluate(i=>window.__LAB.switch(i), id); await sl(650);
  const r=await pg.evaluate(()=>{ const e=window.__LAB.current().exp; const d=e.duration;
    return { dur: d===Infinity?"Infinity":+Number(d).toFixed(3) }; });
  out.push(id+" -> "+JSON.stringify(r));
}
console.log(out.join("\n"));
// A1 静止分支
await pg.evaluate(()=>window.__LAB.switch("A1-incline-speed")); await sl(650);
const a1=await pg.evaluate(()=>{ const e=window.__LAB.current().exp; e.onParam("theta",5); e.onParam("mu",0.3); return e.duration; });
const a1b=await pg.evaluate(()=>{ const e=window.__LAB.current().exp; e.onParam("theta",30); return e.duration; });
console.log("A1 静止分支(θ=5°,μ=0.30) ->",a1," 能动(θ=30°) ->",a1b);
// F2 系数
await pg.evaluate(()=>window.__LAB.switch("F2-boiling")); await sl(650);
for(const f of [1,3,5]){ const d=await pg.evaluate(fl=>{const e=window.__LAB.current().exp;e.onParam("flame",fl);return e.duration;},f); console.log("F2 flame="+f+" -> "+d.toFixed(2)); }
console.log("PAGEERRORS",errs.length,JSON.stringify(errs.slice(0,3)));
await b.close(); server.close();
