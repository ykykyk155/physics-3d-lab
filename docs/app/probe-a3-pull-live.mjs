import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18188;
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
async function setPull(v){await pg.evaluate(v=>{const block=document.querySelector('.param-block[data-pid="pull"]');const i=block.querySelector('input');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));},v);await sl(150);}
async function run(pull, speed, ms){
  await pg.evaluate(()=>{const s=window.__LAB.store;s.playback.playing=false;s.simTime=0;});
  await setPull(pull);
  await pg.evaluate(()=>{const e=window.__LAB.current().exp._impl;e.reset();const s=window.__LAB.store;s.playback.speed=1;s.playback.playing=true;});
  await pg.evaluate(sp=>{window.__LAB.store.playback.speed=sp;},speed);
  const t0=Date.now(); await sl(ms);
  const r=await pg.evaluate(()=>{const e=window.__LAB.current().exp._impl;const s=window.__LAB.store;return {x:+e.x.toFixed(4),sim:+s.simTime.toFixed(3),dur:+e.duration.toFixed(2),playing:s.playback.playing};});
  const real=(Date.now()-t0)/1000;
  await pg.evaluate(()=>{window.__LAB.store.playback.playing=false;});
  return {pull,speed,real:+real.toFixed(2),...r};
}
console.log('pull=0.05 1x', JSON.stringify(await run(0.05,1,2000)));
console.log('pull=0.30 1x', JSON.stringify(await run(0.30,1,2000)));
console.log('pull=0.10 2x', JSON.stringify(await run(0.10,2,2000)));
console.log('PAGEERRORS',errs.length,JSON.stringify(errs.slice(0,5)));
await b.close(); server.close();
