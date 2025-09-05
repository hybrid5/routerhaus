const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function checkFile(file){
  try {
    execSync(`node --check "${file}"`, { stdio: 'ignore' });
    return null;
  } catch (e) {
    return e.message;
  }
}

const base = path.join(__dirname, '..');
const dirs = [path.join(base, 'docs', 'assets', 'js'), path.join(base, 'docs')];
let errors = [];
for (const dir of dirs){
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)){
    if (f.endsWith('.js')){
      const filePath = path.join(dir, f);
      const err = checkFile(filePath);
      if (err) errors.push({ file: path.relative(base, filePath), error: err });
    }
  }
}
if (errors.length){
  console.error('Lint errors:');
  errors.forEach(e => console.error(e.file + '\n' + e.error));
  process.exit(1);
} else {
  console.log('All JS files passed syntax check');
}
