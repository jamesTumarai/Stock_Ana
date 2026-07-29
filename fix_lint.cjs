const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  /parseFloat\(data\.technical_analysis\.key_levels\?\.current_price \|\| "0"\)/g,
  'parseFloat(String(data.technical_analysis.key_levels?.current_price || "0"))'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log('Fixed lint error');
