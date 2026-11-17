import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18195;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:700});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("A7-lever")); await sl(800);
// 从场景图里读枢轴组转角（不依赖内部字段）
const readAngle=()=>pg.evaluate(()=>{
  let g=null; window.__LAB.current().scene.traverse(o=>{ if(o.isGroup&&Math.abs(o.position.y-1.6)<0.01&&o.children.length>=3) g=o; });
  return g? +(g.rotation.z*180/Math.PI).toFixed(1) : null;
});
const setP=(o)=>pg.evaluate(pp=>{const e=window.__LAB.current().exp;Object.entries(pp).forEach(([k,v])=>e.onParam(k,v));return e.duration;},o);
const test=async(pp,label)=>{
  const d=await setP(pp);
  await pg.evaluate(()=>window.__LAB.current().exp.seek(2.2));
  const a=await readAngle();
  console.log(label, "duration="+d, "angle="+a+"°");
};
await test({f1:5,l1:1,f2:1,l2:10}, "CEO验收场景 F1=5,L1=1 vs F2=1,L2=10");
await test({f1:0.5,l1:1,f2:5,l2:10}, "反向：F1=0.5,L1=1 vs F2=5,L2=10");
await test({f1:2,l1:4,f2:4,l2:2}, "平衡 8 vs 8");
await test({f1:5,l1:10,f2:1,l2:1}, "极端 F1=5,L1=10 vs F2=1,L2=1");
// tilt 参数是否真的没了
const hasTilt=await pg.evaluate(()=>{const e=window.__LAB.current().exp; return 'tilt' in (e.p||{});});
console.log("tilt 参数仍存在?", hasTilt);
console.log("PAGEERRORS",errs.length,JSON.stringify(errs.slice(0,3)));
await b.close(); server.close();
