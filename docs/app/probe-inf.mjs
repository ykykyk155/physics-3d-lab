import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18145;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("A2-newton-first")); await sl(700);
const out = await pg.evaluate(()=>{
  const e=window.__LAB.current().exp;
  e.onParam("surface", 0);              // 理想光滑
  const d=e.duration;
  const res={ dur:String(d), isInf:d===Infinity };
  const bad=[];
  for(const t of [0, 5, 1e6, NaN, -5]){ try{ e.seek(t); }catch(err){ bad.push(String(err)); } }
  // NaN 检查：小车位置是否有限
  let cart=null; window.__LAB.current().scene.traverse(o=>{ if(o.userData&&o.userData.cart) cart=o; });
  res.cart = cart? {x:cart.position.x, y:cart.position.y, ok:Number.isFinite(cart.position.x)&&Number.isFinite(cart.position.y)} : null;
  res.seekErrors=bad;
  // 时间条状态
  const bar=document.querySelector("#timebar"), inp=document.querySelector("#timeRange");
  res.timebar = { disabled: inp? inp.disabled:null, label: (document.querySelector("#tbTime")||{}).textContent };
  return res;
});
console.log(JSON.stringify(out));
console.log("PAGEERRORS", errs.length, JSON.stringify(errs.slice(0,3)));
await b.close(); server.close();
