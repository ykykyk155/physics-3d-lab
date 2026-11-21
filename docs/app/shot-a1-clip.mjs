import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); await page.setViewport({width:1420,height:800});
await page.goto('http://127.0.0.1:8765/app/index.html',{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
await page.evaluate(()=>window.__LAB.switch('A1-incline-speed'));
await new Promise(r=>setTimeout(r,1500));
await page.screenshot({path:'docs/app/shots/a1-clip-t0.png'});
// 播放到中段
await page.evaluate(()=>{const e=window.__LAB.current().exp; if(e&&e.seek) e.seek(0.5);});
await new Promise(r=>setTimeout(r,500));
await page.screenshot({path:'docs/app/shots/a1-clip-t05.png'});
console.log('ok');
await b.close();
