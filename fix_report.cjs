const fs = require('fs');
const content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');
const newContent = content.replace(
  'const isThai = language === \'Thai\';',
  'const isThai = language === \'Thai\';\n  const isTechnicalOnly = data.technical_analysis && !data.comprehensive_analysis;'
);
fs.writeFileSync('src/ReportTemplate.tsx', newContent);
console.log('Fixed ReportTemplate.tsx declaration');
