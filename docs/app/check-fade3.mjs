import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18121;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
// 立即点一次，不做任何等待
await page.click('#audioBtn');
const first = await page.evaluate(()=>({cls:document.getElementById('audioBtn').className, ls:localStorage.getItem('lab-audio')}));
console.log('ready 后 0 等待点击 →', JSON.stringify(first), first.cls.includes('on')?'✅':'❌');
// 之后连续采样 800ms，看还有没有残留遮挡
const t0=Date.now(); const blocked=[];
for (let i=0;i<20;i++){
  const r = await page.evaluate(()=>{
    const el=document.elementFromPoint(1386,34);
    const st=e=>e?getComputedStyle(e).pointerEvents:'missing';
    return { top: el?(el.id||''):'', boot:st(document.getElementById('boot')), fade:st(document.getElementById('fade')) };
  });
  if (r.top !== 'audioBtn') blocked.push({ms:Date.now()-t0, ...r});
  await sleep(40);
}
console.log('ready 后 800ms 内仍被挡的采样数:', blocked.length);
if (blocked.length) console.log('  首末:', JSON.stringify(blocked[0]), JSON.stringify(blocked[blocked.length-1]));
await b.close(); server.close();
