const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Update Props interface
content = content.replace(
  '  language?: string;\n  hideHeader?: boolean;\n}',
  '  language?: string;\n  hideHeader?: boolean;\n  historyReports?: any[];\n}'
);

// Update ReportTemplate parameters
content = content.replace(
  'const ReportTemplate: React.FC<Props> = ({ data, ticker, onClose, durationSecs, toolRuns, tokenCount, documentCount, language, hideHeader = false }) => {',
  'const ReportTemplate: React.FC<Props> = ({ data, ticker, onClose, durationSecs, toolRuns, tokenCount, documentCount, language, hideHeader = false, historyReports = [] }) => {'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched report props");
