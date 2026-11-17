import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18119;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
// 关键：ready 之后立刻点，完全不 wait
await page.click('#audioBtn');
await new Promise(r=>setTimeout(r,120));
const s = await page.evaluate(()=>({cls:document.getElementById('audioBtn').className, ls:localStorage.getItem('lab-audio')}));
console.log('ready 后立即点击 →', JSON.stringify(s), s.cls.includes('on')?'✅ 一次点中':'❌ 仍被吞');
// 再测一次「立刻切场景」：ready 后马上点左侧 tab
await page.reload({waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const before = await page.evaluate(()=>window.__LAB.current().scene ? 'ok' : 'no');
await page.click('.tab:nth-child(1)');
await new Promise(r=>setTimeout(r,150));
const after = await page.evaluate(()=>document.title||'');
console.log('ready 后立即点 tab → 当前场景已切换:', after);
await b.close(); server.close();
