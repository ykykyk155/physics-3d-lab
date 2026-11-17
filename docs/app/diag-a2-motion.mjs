// A2 运动轨迹采样（通过实验 onParam 切材料，采样小车位置与倾角）
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = process.cwd(), PORT = 18179;
const server = http.createServer((req,res)=>{ let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p); if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const alt=path.join(ROOT,'..',p); if(fs.existsSync(alt))f=alt; else {res.writeHead(404);res.end();return;}} const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res); });
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700,deviceScaleFactor:1});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A2-newton-first'));
await new Promise(r=>setTimeout(r,1200));

async function run(surface,label){
  const rows = await page.evaluate(async (sv)=>{
    const cur = window.__LAB.current();
    cur.exp.onParam('surface', sv);
    cur.exp.reset && cur.exp.reset();
    let cart=null; cur.scene.traverse(o=>{ if(o.userData && o.userData.cart) cart=o; });
    const out=[];
    for(let i=0;i<40;i++){
      await new Promise(r=>setTimeout(r,50));
      out.push({t:+(i*0.05).toFixed(2), x:cart?+cart.position.x.toFixed(2):null, y:cart?+cart.position.y.toFixed(2):null, rot:cart?+cart.rotation.z.toFixed(2):null});
    }
    return out;
  }, surface);
  console.log('=== '+label+' ===');
  let last=null; const uniq=[];
  for(const r of rows){ const k=r.x+','+r.y+','+r.rot; if(k!==last){uniq.push(r); last=k;} }
  console.log(uniq.map(s=>`${s.t}s x=${s.x} y=${s.y} rot=${s.rot}`).join('\n'));
}
await run(0.6,'毛巾');
await run(0.02,'冰面');
await b.close(); server.close();
