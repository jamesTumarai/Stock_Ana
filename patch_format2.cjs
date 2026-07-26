const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.split('.replace(/(?<=.)(?:\\s+|^)(\\d+)[\\)\\.](?=\\s)/g, \'\\n\\n$1. \')').join('.replace(/(?:\\s|^)(\\d+)\\)\\s/g, \'\\n\\n$1. \')');

content = content.replace(
  '<Markdown>{data.technical_analysis.signal_summary?.confluence_score || \'-\'}</Markdown>',
  '<Markdown>{(data.technical_analysis.signal_summary?.confluence_score || \'-\').replace(/(?:\\s|^)(\\d+)\\)\\s/g, \'\\n\\n$1. \')}</Markdown>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched format2 successfully");
