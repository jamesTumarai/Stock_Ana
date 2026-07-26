const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// The bug was it matched 2026) instead of just the bullet point. We'll limit it to 1-2 digits
content = content.split('.replace(/(?:\\s|^)(\\d+)[\\)\\.]\\s/g').join('.replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched format4 successfully");
