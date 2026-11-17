import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core'; import crypto from 'node:crypto';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18112;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clip={x:320,y:0,width:1100,height:700};
for (const id of ['C2-sound-chars','D1-series-parallel','A4-liquid-pressure','A5-buoyancy','D6-magnet-solenoid','B2-reflection']) {
  await page.evaluate(i=>window.__LAB.switch(i), id); await sleep(1000);
  const a = await page.screenshot({clip});
  await sleep(700);
  const c = await page.screenshot({clip});
  const same = crypto.createHash('md5').update(a).digest('hex') === crypto.createHash('md5').update(c).digest('hex');
  console.log((same?'相同  ':'有变化').padEnd(5), id);
}
await b.close(); server.close();
