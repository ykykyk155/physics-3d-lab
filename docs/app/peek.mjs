import fs from "node:fs";
const buf=fs.readFileSync("thermal.gbk.bin");
console.log("ctx bytes", [...buf.slice(392,412)].map(b=>b.toString(16)).join(" "));
console.log("ctx chars", buf.slice(392,412).toString("utf8"));
