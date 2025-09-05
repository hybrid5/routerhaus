const fs = require('fs');
const path = require('path');

function walk(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, list);
    } else if (entry.isFile() && full.endsWith('.css') && !full.endsWith('.min.css')) {
      list.push(full);
    }
  }
  return list;
}

function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove comments
    .replace(/\n+/g, '\n') // collapse blank lines
    .replace(/\s*([{};:])\s*/g, '$1') // trim around tokens
    .replace(/;}/g, '}') // remove trailing semicolons
    .trim();
}

const root = path.join(__dirname, '..');
const files = walk(root);
for (const file of files) {
  const css = fs.readFileSync(file, 'utf8');
  const min = minify(css);
  const out = file.replace(/\.css$/, '.min.css');
  fs.writeFileSync(out, min + '\n');
  console.log(`Minified ${file} -> ${out}`);
}
