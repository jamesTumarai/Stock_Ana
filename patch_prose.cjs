const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Replace prose-sm md:prose-base with prose-base
content = content.replace(/prose-sm md:prose-base/g, 'prose-base');

// For deep insights, let's make it prose-base too
content = content.replace(/prose-sm md:prose-base/g, 'prose-base');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched prose");
