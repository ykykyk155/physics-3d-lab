// 验证实验序号：页签顺序连续编号 1-25，卡片与顶部 chip 都显示
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18157;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:800});
const errs=[]; page.on('pageerror',e=>errs.push(String(e.message)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const tabs = await page.evaluate(()=>[...document.querySelectorAll('#tabs .tab .tlabel')].map(x=>x.textContent));
const all=[];
for(let i=0;i<tabs.length;i++){
  await page.evaluate(n=>document.querySelectorAll('#tabs .tab')[n].click(), i);
  await sleep(900);
  const cards = await page.evaluate(()=>[...document.querySelectorAll('#sceneGrid .scene-card')].map(c=>({
    seq:(c.querySelector('.seq')||{}).textContent||'',
    text:c.textContent.replace(/\s+/g,' ').trim()
  })));
  console.log(`[${tabs[i]}]`, cards.map(c=>c.seq+' '+c.text.split(' ')[0]).join(' | '));
  all.push(...cards);
}
const chip = await page.evaluate(()=>document.querySelector('#chipName').textContent);
console.log('chip =', chip);
const nums = all.map(c=>parseInt(c.seq,10));
const ok = nums.length===25 && nums.every((n,i)=>n===i+1);
console.log('COUNT', nums.length, 'SEQUENTIAL', ok);
console.log('ERRORS', errs.length, errs.slice(0,3));
await b.close(); server.close();
process.exit(ok && errs.length===0 ? 0 : 1);
