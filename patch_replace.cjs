const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// The string to replace is exactly:
// .replace(/(?:\s|^)(\d{1,2})[\)\.]\s/g, '\n\n$1. ')

code = code.split(`.replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g, '\\n\\n$1. ')`).join('');

fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log('Removed all instances of the replace regex');
