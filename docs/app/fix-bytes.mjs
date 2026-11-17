import fs from "node:fs";
let buf=fs.readFileSync("thermal.gbk.bin");
function firstBad(b){
  let i=0;
  while(i<b.length){
    const c=b[i]; let n=0;
    if(c<0x80) n=0;
    else if(c>=0xC2&&c<=0xDF) n=1;
    else if(c>=0xE0&&c<=0xEF) n=2;
    else if(c>=0xF0&&c<=0xF4) n=3;
    else return i;
    if(i+n>=b.length) return i;
    for(let k=1;k<=n;k++){ if((b[i+k]&0xC0)!==0x80) return i; }
    i+=n+1;
  }
  return -1;
}
let fixed=0;
for(let iter=0;iter<800;iter++){
  const bad=firstBad(buf);
  if(bad<0) break;
  let target=-1;
  for(let d=0;d<=2;d++){ if(buf[bad+d]===0x3F){target=bad+d;break;} if(d>0&&buf[bad-d]===0x3F){target=bad-d;break;} }
  if(target<0){ console.log("STUCK at",bad,"byte",buf[bad].toString(16)); break; }
  buf[target]=0x0A; fixed++;
}
console.log("fixed",fixed,"stillBad",firstBad(buf));
fs.writeFileSync("thermal.utf8.bin",buf);
