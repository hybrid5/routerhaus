const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'input.css');
const dest = path.join(__dirname, '..', 'docs', 'main.css');
fs.copyFileSync(src, dest);
console.log('Copied input.css to docs/main.css');
