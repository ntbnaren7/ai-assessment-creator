const fs = require('fs');
const path = require('path');

const cssPath = path.resolve(__dirname, 'frontend/src/styles/globals.css');
const outPath = path.resolve(__dirname, 'globals_clean.css');
const lines = fs.readFileSync(cssPath, 'utf8').split('\n');

let newLines = [];
for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  if (lineNum >= 682 && lineNum <= 1523) continue;
  if (lineNum >= 1698 && lineNum <= 1718) continue;
  if (lineNum >= 2032 && lineNum <= 2059) continue;
  newLines.push(lines[i]);
}

fs.writeFileSync(outPath, newLines.join('\n'));
console.log('Successfully wrote globals_clean.css');
