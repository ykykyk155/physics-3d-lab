import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18146;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage(); page.on('pageerror',e=>console.log('PE:',String(e).slice(0,120)));
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const out = await page.evaluate(async()=>{
  const lib = await window.__LAB.loadAmmo();
  const A = lib;
  const coll=new A.btDefaultCollisionConfiguration();
  const disp=new A.btCollisionDispatcher(coll);
  const broad=new A.btDbvtBroadphase();
  const solv=new A.btSequentialImpulseConstraintSolver();
  const world=new A.btDiscreteDynamicsWorld(disp,broad,solv,coll);
  world.setGravity(new A.btVector3(0,-9.8,0));
  try{ world.getSolverInfo().set_m_numIterations(24); }catch(e){}
  const G=9.8, STEP=1/60;
  const h=0.15; const H=Math.min(Math.max(0.42+h*2,0.5),1.05); const RL=1.5; const th=Math.atan(H/RL);
  const slopeLen=RL/Math.cos(th);
  const cartHX=0.26, cartHY=0.05, cartHZ=0.18, mass=0.4;
  function mkBody(shape,m,fric){
    const ms=new A.btDefaultMotionState(new A.btTransform());
    const iner=new A.btVector3(0,0,0); if(m>0) shape.calculateLocalInertia(m,iner);
    const body=new A.btRigidBody(new A.btRigidBodyConstructionInfo(m,ms,shape,iner));
    body.setFriction(fric); if(m>0) body.setDamping(0.05,0.3); world.addRigidBody(body); return body;
  }
  // 斜面（静态，绕坡底旋转-th）；从(x=0,y=0)向左上延伸
  const slopeShape=new A.btBoxShape(new A.btVector3(slopeLen/2,0.04,0.6));
  const slope=mkBody(slopeShape,0,0);
  const slT=new A.btTransform(); slT.setIdentity();
  slT.getOrigin().setValue(-(slopeLen/2)*Math.cos(th),(slopeLen/2)*Math.sin(th),0);
  const sq=new A.btQuaternion(); sq.setValue(0,0,Math.sin(th/2),Math.cos(th/2)); slT.getRotation().setValue(sq.x(),sq.y(),sq.z(),sq.w());
  slope.setWorldTransform(slT); slope.getMotionState().setWorldTransform(slT);
  // 水平面（静态，从坡底 x=0 向右）
  const flatShape=new A.btBoxShape(new A.btVector3(4,0.03,0.6));
  const flat=mkBody(flatShape,0,0.5);
  const fT=new A.btTransform(); fT.setIdentity(); fT.getOrigin().setValue(2,0,0); flat.setWorldTransform(fT); flat.getMotionState().setWorldTransform(fT);
  function run(mu){
    // 小车初始：在坡顶上方，x 偏左一点
    flat.setFriction(mu);
    const cx=-(slopeLen*Math.cos(th))+0.05;
    const cartShape=new A.btBoxShape(new A.btVector3(cartHX,cartHY,cartHZ));
    const cart=mkBody(cartShape,mass,mu);
    const cT=new A.btTransform(); cT.setIdentity(); cT.getOrigin().setValue(cx,H+0.3,0); cart.setWorldTransform(cT); cart.getMotionState().setWorldTransform(cT);
    let lastX=0, stoppedAt=null, minY=Infinity;
    for(let i=0;i<900;i++){
      world.stepSimulation(STEP,1,STEP);
      const tf=new A.btTransform(); cart.getMotionState().getWorldTransform(tf);
      const x=tf.getOrigin().x(), yy=tf.getOrigin().y();
      const vel=cart.getLinearVelocity(); const speed=Math.hypot(vel.x(),vel.z());
      if(yy<minY)minY=yy;
      if(speed<0.01 && stoppedAt==null) stoppedAt=i;
      if(!Number.isFinite(x)) return {mu, x:'NaN'};
      lastX=x;
    }
    return {mu, x:+lastX.toFixed(3), stoppedAt, minY:+minY.toFixed(2)};
  }
  const res=[run(0.6),run(0.3),run(0.12),run(0.02),run(0)];
  return res;
});
console.log(JSON.stringify(out,null,1));
await b.close(); server.close();
