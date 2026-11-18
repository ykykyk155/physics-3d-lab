import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18149;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const out = await page.evaluate(async()=>{
  const A = await window.__LAB.loadAmmo();
  const coll=new A.btDefaultCollisionConfiguration();
  const world=new A.btDiscreteDynamicsWorld(new A.btCollisionDispatcher(coll),new A.btDbvtBroadphase(),new A.btSequentialImpulseConstraintSolver(),coll);
  world.setGravity(new A.btVector3(0,-9.8,0));
  try{ world.getSolverInfo().set_m_numIterations(24);}catch(e){}
  const STEP=1/60, G=9.8, hx=0.26,hy=0.06,hz=0.18,mass=0.4;
  // 加长水平板：中心在 x=4，向两端各4 → 顶面覆盖 0..8
  const flat=new A.btRigidBody(new A.btRigidBodyConstructionInfo(0,new A.btDefaultMotionState(new A.btTransform()),new A.btBoxShape(new A.btVector3(4,0.05,0.6)),new A.btVector3(0,0,0)));
  const fT=new A.btTransform();fT.setIdentity();fT.getOrigin().setValue(4,0,0);flat.setWorldTransform(fT);flat.getMotionState().setWorldTransform(fT);
  world.addRigidBody(flat);
  function run(mu){
    flat.setFriction(mu);
    // 小车初始放在 x=1（板子范围内），初速沿 +x
    const cart=new A.btRigidBody(new A.btRigidBodyConstructionInfo(mass,new A.btDefaultMotionState(new A.btTransform()),new A.btBoxShape(new A.btVector3(hx,hy,hz)),new A.btVector3(0,0,0)));
    cart.setFriction(mu); cart.setDamping(0.05,0.3);
    const cT=new A.btTransform();cT.setIdentity();cT.getOrigin().setValue(1,hy+0.01,0);cart.setWorldTransform(cT);cart.getMotionState().setWorldTransform(cT);
    const v0=Math.sqrt(2*G*0.63);
    cart.getLinearVelocity().setValue(v0,0,0);
    world.addRigidBody(cart);
    // 连续跑，检测停止（速度<0.01 连续30步）
    let lastX=1, stopState=0, stopTime=-1, steps=0;
    for(let i=0;i<900;i++){
      world.stepSimulation(STEP,1,STEP);
      const tf=new A.btTransform();cart.getMotionState().getWorldTransform(tf);
      const x=tf.getOrigin().x(); const vel=cart.getLinearVelocity(); const sp=Math.hypot(vel.x(),vel.z());
      if(sp<0.01){ stopState++; } else { stopState=0; }
      if(stopState>=30){ stopTime=i; lastX=x; break; }
      lastX=x; steps=i;
    }
    // 再跑 60 步确认静止
    const tf=new A.btTransform();cart.getMotionState().getWorldTransform(tf);
    const fx=tf.getOrigin().x(); const fvel=cart.getLinearVelocity();
    const dist = lastX - 1;
    return {mu, stopTime, dist:+dist.toFixed(3), absolute:+fx.toFixed(3), finalSpeed:+(Math.hypot(fvel.x(),fvel.z())).toFixed(5)};
  }
  return {v0:+Math.sqrt(2*G*0.63).toFixed(3), res:[run(0.6),run(0.3),run(0.12),run(0.02),run(0.6),run(0.3),run(0.12)]};
});
console.log(JSON.stringify(out,null,1));
await b.close(); server.close();
