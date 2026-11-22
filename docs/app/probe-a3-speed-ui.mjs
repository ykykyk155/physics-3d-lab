import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18189;
const MIME={".html":"text/html",".js":"text/javascript",".json":"application/json"};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,"http://x").pathname);if(p==="/")p="/index.html";let f=path.join(ROOT,p);if(!fs.existsSync(f)){const a=path.join(ROOT,"..",p);if(fs.existsSync(a))f=a;else{res.writeHead(404);res.end();return;}}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,"127.0.0.1",r));
const b=await puppeteer.launch({executablePath:"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",headless:true,args:["--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-gpu","--no-sandbox"]});
const pg=await b.newPage(); await pg.setViewport({width:1420,height:800});
const errs=[]; pg.on("pageerror",e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:"load"});
await pg.waitForFunction("window.__LAB && window.__LAB.ready",{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));
await pg.evaluate(()=>window.__LAB.switch("A3-friction")); await sl(900);
async function setPull(v){await pg.evaluate(v=>{const block=document.querySelector('.param-block[data-pid="pull"]');const i=block.querySelector('input');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));},v);await sl(120);}
async function playMeasure(pull, ms){
  await pg.evaluate(()=>{const s=window.__LAB.store;s.playback.playing=false;s.simTime=0;});
  await setPull(pull);
  await pg.evaluate(()=>{window.__LAB.current().exp._impl.reset();window.__LAB.store.simTime=0;window.__LAB.store.playback.playing=true;});
  await sl(ms);
  const r=await pg.evaluate(()=>{const e=window.__LAB.current().exp._impl;const s=window.__LAB.store;const ro={};try{for(const it of e.readouts())ro[it.label]=it.value;}catch(_){}
    const tb=document.querySelector('#timeRange');const tv=document.querySelector('#timeText')||document.querySelector('.pb-time')||null;
    return {x:+e.x.toFixed(3),sim:+s.simTime.toFixed(2),dur:+e.duration.toFixed(2),readout:+String(ro['拖动位移 x']??'').replace(/[^\d.]/g,''),tb:tb?tb.value:null,timeLabel:document.body.innerText.match(/\d+\.\d+\s*\/\s*12\.0\s*s/)?.[0]||null,playing:s.playback.playing};});
  await pg.evaluate(()=>{window.__LAB.store.playback.playing=false;});
  return r;
}
console.log('pull=0.05 2s', JSON.stringify(await playMeasure(0.05,2000)));
console.log('pull=0.10 2s', JSON.stringify(await playMeasure(0.10,2000)));
console.log('pull=0.30 2s', JSON.stringify(await playMeasure(0.30,2000)));
// duration const across params
const durs=await pg.evaluate(()=>{const e=window.__LAB.current().exp._impl;const a=[];for(const p of [0.05,0.1,0.2,0.3]){e.onParam('pull',p);a.push(e.duration);}return a;});
console.log('durations',JSON.stringify(durs));
console.log('PAGEERRORS',errs.length,JSON.stringify(errs.slice(0,5)));
await b.close(); server.close();
