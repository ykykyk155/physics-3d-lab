import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import puppeteer from "puppeteer-core";
const ROOT = path.resolve(import.meta.dirname); const PORT = 18186;
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

async function setParam(id,val){
  return pg.evaluate(({id,val})=>{
    const block=document.querySelector(`.param-block[data-pid="${id}"]`);
    const input=block && block.querySelector('input[type=range]');
    if(!input) return {ok:false,why:'no input'};
    input.value=val; input.dispatchEvent(new Event('input',{bubbles:true}));
    return {ok:true, v:input.value};
  },{id,val});
}
async function snap(label){
  const s=await pg.evaluate(()=>{
    const e=window.__LAB.current().exp;
    const readouts=document.querySelector('#paramsArea')?.innerText||'';
    const b=e.block;
    return {
      p:JSON.parse(JSON.stringify(e.p||{})), f:e.f, readoutText:readouts.replace(/\n+/g,' | ').slice(0,200),
      blockPos:b?[+b.position.x.toFixed(3),+b.position.y.toFixed(3),+b.position.z.toFixed(3)]:null,
      blockScale:b?[+b.scale.x.toFixed(3),+b.scale.y.toFixed(3),+b.scale.z.toFixed(3)]:null,
      children:(()=>{let n=0;const names=[];window.__LAB.current().scene.traverse(o=>{if(o.isMesh){n++; if(/weight|mass|砝码/i.test(o.name||'')) names.push(o.name);}});return {n,names};})(),
    };
  });
  console.log(label, JSON.stringify(s));
}
await snap('default');
await setParam('normal', 0.5); await sl(300); await snap('normal=0.5');
await setParam('normal', 5); await sl(300); await snap('normal=5');
await setParam('normal', 2); await setParam('mu', 0.8); await sl(300); await snap('mu=0.8');
await setParam('area','small').catch(()=>{}); 
console.log('PAGEERRORS',errs.length,JSON.stringify(errs.slice(0,5)));
await b.close(); server.close();
