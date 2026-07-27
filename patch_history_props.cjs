const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  'documentCount={report.findings?.length || 0}',
  'documentCount={report.findings?.length || 0}\n               historyReports={historyReports}'
);

fs.writeFileSync('src/App.tsx', content);
console.log("Patched history props");
