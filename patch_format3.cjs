const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.split('.replace(/(?:\\s|^)(\\d+)\\)\\s/g, \'\\n\\n$1. \')').join('.replace(/(?:\\s|^)(\\d+)[\\)\\.]\\s/g, \'\\n\\n$1. \')');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched format3 successfully");
