import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(import.meta.dirname); const PORT = 18145;
const server = http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://x').pathname); if(p==='/')p='/index.html'; let f=path.join(ROOT,p);
 if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){const a=path.join(ROOT,'..',p); if(fs.existsSync(a)&&!fs.statSync(a).isDirectory())f=a; else {res.writeHead(404);res.end();return;}}
 const M={'.html':'text/html','.js':'text/javascript','.json':'application/json'}; res.writeHead(200,{'Content-Type':M[path.extname(f)]||'application/octet-stream'}); fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
const b = await puppeteer.launch({executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-gpu','--no-sandbox']});
const page = await b.newPage();
await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});
await page.waitForFunction('window.__LAB && window.__LAB.ready',{timeout:60000});
const r = await page.evaluate(()=>window.__LAB.loadAmmo && typeof window.__LAB.loadAmmo==='function');
console.log('loadAmmo type:', r);
// 现在隔离实验：加载 ammo，建零摩擦斜面 + 水平摩擦面，测停止距离
const out = await page.evaluate(async()=>{
  const A = window.Ammo;
  // 建世界（复用 bridge 的思路，直接写）
  const coll=new A.btDefaultCollisionConfiguration();
  const disp=new A.btCollisionDispatcher(coll);
  const broad=new A.btDbvtBroadphase();
  const solv=new A.btSequentialImpulseConstraintSolver();
  const world=new A.btDiscreteDynamicsWorld(disp,broad,solv,coll);
  world.setGravity(new A.btVector3(0,-9.8,0));
  try{ world.getSolverInfo().set_m_numIterations(24); }catch(e){}
  const G=9.8, STEP=1/60;
  // 几何（贴近 A2）:H_ramp=clamp(0.42+h*2,0.5,1.05), RL=1.5, theta=atan(H/RL)
  const h=0.15; const H=Math.min(Math.max(0.42+h*2,0.5),1.05); const RL=1.5;
  const th=Math.atan(H/RL);
  // v0 = sqrt(2 g H)  —— 斜面上滑到底的理论速度（能量，斜面零摩擦）
  const v0=Math.sqrt(2*G*H);
  // 小车：box，半尺寸贴近 cart (len0.52,大0.36) => hx0.26,hy0.05,hz0.18
  const cartHX=0.26, cartHY=0.05, cartHZ=0.18, mass=0.4;
  function boxBody(px,py,pz,rotZ,hx,hy,hz,fric,m){
    const shape=new A.btBoxShape(new A.btVector3(hx,hy,hz));
    const tf=new A.btTransform(); tf.setIdentity(); tf.getOrigin().setValue(px,py,pz);
    if(rotZ){ const q=new A.btQuaternion(); q.setValue(0,0,Math.sin(rotZ/2),Math.cos(rotZ/2)); tf.getRotation().setValue(q.x(),q.y(),q.z(),q.w()); }
    const ms=new A.btDefaultMotionState(tf);
    const inertia=new A.btVector3(0,0,0); if(m>0) shape.calculateLocalInertia(m,inertia);
    const body=new A.btRigidBody(new A.btRigidBodyConstructionInfo(m,ms,shape,inertia));
    body.setFriction(fric); if(m>0) body.setDamping(0.05,0.3);
    world.addRigidBody(body); return body;
  }
  // 斜面：长 box 旋转 -th。放在小车下方。摩擦0。让小车沿斜面下滑。
  // 斜面从 x 起点到 (RL*cos, H)。直接建一个旋转 -th 的板子，顶面在斜面下方。
  // 简单：斜面平放于 y=0 处，但旋转 -th。长度 RL/cos(th)。宽度大。
  const slopeLen=RL/Math.cos(th);
  const slopeShape=new A.btBoxShape(new A.btVector3(slopeLen/2,0.08/2,0.6));
  const stf=new A.btTransform(); stf.setIdentity();
  // 斜面质心：从坡底(0,0)到坡顶(RL,H)，中点(RL/2,H/2)，绕点转 -th 但板子本身
  stf.getOrigin().setValue(0,0,0); // placeholder
  const sms=new A.btDefaultMotionState(stf);
  const sIner=new A.btVector3(0,0,0);
  const slope=new A.btRigidBody(new A.btRigidBodyConstructionInfo(0,sms,slopeShape,sIner));
  slope.setFriction(0);
  // 斜面变换：绕坡底转。板子从底延伸到顶。
  const slT=new A.btTransform(); slT.setIdentity();
  // 板子中心在坡底+slopeLen/2 沿方向
  slT.getOrigin().setValue((slopeLen/2)*Math.cos(th), (slopeLen/2)*Math.sin(th), 0);
  const sq=new A.btQuaternion(); sq.setValue(0,0,-Math.sin(th/2),Math.cos(th/2)); slT.getRotation().setValue(sq.x(),sq.y(),sq.z(),sq.w());
  slope.getMotionState().setWorldTransform(slT); slope.setWorldTransform(slT);
  world.addRigidBody(slope);
  // 水平面：从坡底向右延伸，摩擦=参数。仅上半厚。
  const flatShape=new A.btBoxShape(new A.btVector3(7/2,0.06/2,0.6));
  const ftf=new A.btTransform(); ftf.setIdentity(); ftf.getOrigin().setValue(0,0,0); // 坡底
  const fms=new A.btDefaultMotionState(ftf);
  const fIner=new A.btVector3(0,0,0);
  const flat=new A.btRigidBody(new A.btRigidBodyConstructionInfo(0,fms,flatShape,fIner));
  world.addRigidBody(flat);

  function run(mu){
    // 重置小车：放在坡顶上面
    const cart=boxBody(-RL*Math.cos(th)+0.05, (H+0.05), 0, 0, cartHX,cartHY,cartHZ, mu, mass);
    // global flat friction 每次换
    flat.setFriction(mu);
    // 小车从坡顶下落，沿斜面(摩擦0)滑到底，再上水平面(mu)减速
    // 跑足够长，看停止位置
    const steps=600; let lastX=null, stoppedAt=null, stopCount=0;
    for(let i=0;i<steps;i++){
      world.stepSimulation(STEP,1,STEP);
      const tf=new A.btTransform(); cart.getMotionState().getWorldTransform(tf);
      const x=tf.getOrigin().x(); 
      const vel=cart.getLinearVelocity(); const speed=Math.hypot(vel.x(),vel.z());
      if(speed<0.01 && stoppedAt==null){ stoppedAt=i; }
      lastX=x;
      const yy=tf.getOrigin().y();
      if(yy>100 || !Number.isFinite(x)) return {mu, x:'NaN', note:'diverged'};
    }
    return {mu, x:+lastX.toFixed(3), stoppedAt, v0:+v0.toFixed(3)};
  }
  const results=[run(0.6),run(0.3),run(0.12),run(0.02),run(0)];
  return results;
});
console.log(JSON.stringify(out,null,1));
await b.close(); server.close();
