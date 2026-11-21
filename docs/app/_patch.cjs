const fs = require('fs');
let s = fs.readFileSync('_diag-segtable.mjs', 'utf8');
const old1 = `await page.evaluate(\`\(() => {
  const L = window.__LAB;
  L.store.params.theta = 30;
  L.pending.add('theta');
}\)\(\)\`);`;
const new1 = `await page.evaluate(\`\(() => {
  const inp = document.querySelector('.param-block[data-pid="theta"] input');
  inp.value = 30;
  inp.dispatchEvent(new Event('input', { bubbles: true }));
}\)\(\)\`);`;
const old2 = `await page.evaluate(\`\(() => {
  const L = window.__LAB;
  L.store.params.theta = 10; L.store.params.mu = 0.3;
  L.pending.add('theta'); L.pending.add('mu');
}\)\(\)\`);`;
const new2 = `await page.evaluate(\`\(() => {
  const set = (id, v) => {
    const inp = document.querySelector('.param-block[data-pid="' + id + '"] input');
    inp.value = v;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  };
  set('theta', 10); set('mu', 0.3);
}\)\(\)\`);`;
if (!s.includes(old1)) { console.log('OLD1 NOT FOUND'); process.exit(1); }
if (!s.includes(old2)) { console.log('OLD2 NOT FOUND'); process.exit(1); }
s = s.replace(old1, new1).replace(old2, new2);
fs.writeFileSync('_diag-segtable.mjs', s);
console.log('patched');
