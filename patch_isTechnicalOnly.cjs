const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  /const isTechnicalOnly = data\.technical_analysis && !data\.comprehensive_analysis;/g,
  "const isTechnicalOnly = data.analysis_type === 'technical' || (data.technical_analysis && !data.comprehensive_analysis);"
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log('Patched isTechnicalOnly in ReportTemplate.tsx');
