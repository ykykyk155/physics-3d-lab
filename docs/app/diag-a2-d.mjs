import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18148;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); page.on('pageerror',e=>console.log('PE:',String(e).slice(0,120)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const out = await page.evaluate(async()=>{
  const A = await window.__LAB.loadAmmo();
  const coll=new A.btDefaultCollisionConfiguration();
  const disp=new A.btCollisionDispatcher(coll);
  const broad=new A.btDbvtBroadphase();
  const solv=new A.btSequentialImpulseConstraintSolver();
  const world=new A.btDiscreteDynamicsWorld(disp,broad,solv,coll);
  world.setGravity(new A.btVector3(0,-9.8,0));
  try{ world.getSolverInfo().set_m_numIterations(24);}catch(e){}
  const STEP=1/60, G=9.8;
  const cartHX=0.26,cartHY=0.06,cartHZ=0.18,mass=0.4;
  const mk = (shape,m,fr)=>{const ms=new A.btDefaultMotionState(new A.btTransform());const iv=new A.btVector3(0,0,0);if(m>0)shape.calculateLocalInertia(m,iv);const bd=new A.btRigidBody(new A.btRigidBodyConstructionInfo(m,ms,shape,iv));bd.setFriction(fr);if(m>0)bd.setDamping(0.05,0.3);world.addRigidBody(bd);return bd;};
  const flat=mk(new A.btBoxShape(new A.btVector3(4,0.05,0.6)),0,0.5);
  const fT=new A.btTransform(); fT.setIdentity(); fT.getOrigin().setValue(2,0,0); flat.setWorldTransform(fT); flat.getMotionState().setWorldTransform(fT);
  function run(mu){
    flat.setFriction(mu);
    const cart=mk(new A.btBoxShape(new A.btVector3(cartHX,cartHY,cartHZ)),mass,mu);
    const cT=new A.btTransform(); cT.setIdentity(); cT.getOrigin().setValue(0.5,cartHY+0.12,0); cart.setWorldTransform(cT); cart.getMotionState().setWorldTransform(cT);
    const v0=Math.sqrt(2*G*0.63);
    cart.getLinearVelocity().setValue(v0,0,0);
    let lastX=0, stoppedAt=null; let lastSpeed=1;
    for(let i=0;i<600;i++){
      world.stepSimulation(STEP,1,STEP);
      const tf=new A.btTransform();cart.getMotionState().getWorldTransform(tf);
      lastX=tf.getOrigin().x()+0.5;
      const vel=cart.getLinearVelocity();const sp=Math.hypot(vel.x(),vel.z());
      if(sp<0.005 && stoppedAt==null) stoppedAt=i;
      lastSpeed=sp;
      if(!Number.isFinite(lastX)) return {mu,x:'NaN'};
    }
    return {mu, x:+lastX.toFixed(3), stoppedAt, finalSpeed:+lastSpeed.toFixed(4)};
  }
  return {v0:+Math.sqrt(2*G*0.63).toFixed(3), res:[run(0.6),run(0.3),run(0.12),run(0.02)]};
});
console.log(JSON.stringify(out,null,1));
await b.close(); server.close();
