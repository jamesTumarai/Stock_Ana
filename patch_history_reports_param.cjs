const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  "export default function ReportTemplate({ data, ticker, onClose, durationSecs = 0, toolRuns = 0, tokenCount = 0, documentCount = 0, language = 'English', hideHeader = false }: Props) {",
  "export default function ReportTemplate({ data, ticker, onClose, durationSecs = 0, toolRuns = 0, tokenCount = 0, documentCount = 0, language = 'English', hideHeader = false, historyReports = [] }: Props) {"
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched ReportTemplate parameters");
