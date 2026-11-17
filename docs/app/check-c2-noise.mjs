import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18113;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:700});
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.evaluate(()=>window.__LAB.switch('C2-sound-chars')); await sleep(900);
const waveSig = (t) => page.evaluate((tt) => {
  const exp = window.__LAB.current().exp;
  exp.seek(tt);
  const c = window.__LAB.current();
  let sig = '', ys = [];
  c.scene.traverse(o => {
    if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.instanceStart) return;
    const a = o.geometry.attributes.instanceStart.array;
    let acc = 0; for (let i = 0; i < a.length; i++) acc += a[i] * ((i % 97) + 1);
    sig += acc.toFixed(3);
    for (let i = 1; i < a.length; i += 3) ys.push(a[i]);
  });
  const mean = ys.reduce((x,y)=>x+y,0)/(ys.length||1);
  const varr = ys.reduce((s,y)=>s+(y-mean)*(y-mean),0)/(ys.length||1);
  return { sig, n: ys.length, mean:+mean.toFixed(3), sd:+Math.sqrt(varr).toFixed(3), min:+Math.min(...ys).toFixed(3), max:+Math.max(...ys).toFixed(3) };
}, t);
// 先切到噪声波
await page.evaluate(()=>window.__LAB.current().exp.onParam('wave','noise'));
await sleep(200);
const a1 = await waveSig(1.0), a2 = await waveSig(1.0), b1 = await waveSig(3.0);
console.log('噪声波 t=1.0 第一次:', JSON.stringify(a1));
console.log('噪声波 t=1.0 第二次:', JSON.stringify(a2));
console.log('噪声波 t=3.0      :', JSON.stringify(b1));
console.log('同一 t 两次一致:', a1.sig === a2.sig ? '是' : '否');
console.log('不同 t 有区别  :', a1.sig !== b1.sig ? '是' : '否');
// 回到正弦，确认默认波形也仍然移动
await page.evaluate(()=>window.__LAB.current().exp.onParam('wave','sine'));
await sleep(200);
const s1 = await waveSig(1.0), s3 = await waveSig(3.0);
console.log('正弦 t=1.0 vs t=3.0 有区别:', s1.sig !== s3.sig ? '是' : '否');
await b.close(); server.close();
