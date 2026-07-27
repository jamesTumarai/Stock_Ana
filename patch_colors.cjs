const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Replace standard green with colorblind-friendly green
content = content.replace(/bg-green-50/g, 'bg-[#0b5a4b]/10');
content = content.replace(/text-green-700/g, 'text-[#0b5a4b]');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched colors");
