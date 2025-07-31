// checkTryBlocks.js

const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'server.js'); // عدله لو اسم الملف غير

const fileContent = fs.readFileSync(filePath, 'utf-8');
const lines = fileContent.split('\n');

let insideTry = false;
let tryLine = 0;
let bracesCount = 0;

lines.forEach((line, index) => {
  const trimmed = line.trim();

  if (!insideTry && trimmed.startsWith('try')) {
    insideTry = true;
    tryLine = index + 1;
    bracesCount = (trimmed.match(/{/g) || []).length - (trimmed.match(/}/g) || []).length;
  } else if (insideTry) {
    bracesCount += (trimmed.match(/{/g) || []).length;
    bracesCount -= (trimmed.match(/}/g) || []).length;

    if (bracesCount === 0) {
      const nextLine = lines[index + 1]?.trim();
      if (!nextLine || (!nextLine.startsWith('catch') && !nextLine.startsWith('finally'))) {
        console.warn(`❌ Found try block without catch/finally at line ${tryLine}`);
      }
      insideTry = false;
    }
  }
}); 