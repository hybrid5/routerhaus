const fs = require('fs');
const path = require('path');

function validateObj(o){
  const errs = [];
  if (!o || typeof o !== 'object') return ['not an object'];
  if (!o.brand || typeof o.brand !== 'string') errs.push('brand missing');
  if (!o.model || typeof o.model !== 'string') errs.push('model missing');
  if (Object.prototype.hasOwnProperty.call(o, 'priceUsd')) {
    const p = o.priceUsd;
    if (p !== null) {
      if (typeof p !== 'number' || Number.isNaN(p)) errs.push('priceUsd not number');
      else if (p < 0) errs.push('priceUsd negative');
    }
  }
  return errs;
}

const base = path.join(__dirname, '..');
const files = [
  path.join(base, 'docs', 'kits.json'),
  path.join(base, 'docs', 'routers_full_combined.json')
];
const report = {};
for (const file of files){
  const content = fs.readFileSync(file, 'utf-8');
  let arr;
  try { arr = JSON.parse(content); } catch (e) { report[file] = { error: 'invalid JSON' }; continue; }
  if (!Array.isArray(arr)) { report[file] = { error: 'not array' }; continue; }
  const errors = [];
  arr.forEach((item, idx) => {
    const e = validateObj(item);
    if (e.length) errors.push({ index: idx, errors: e });
  });
  report[file] = { total: arr.length, valid: errors.length === 0, errors };
}
const outPath = path.join(base, 'REPORTS', 'data-validation.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log('Wrote', outPath);
const allValid = Object.values(report).every(r => r.valid);
if (!allValid) process.exit(1);
