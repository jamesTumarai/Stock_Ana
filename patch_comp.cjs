const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const targetStr = `{data.comprehensive_analysis && (`;
const replacementStr = `{data.analysis_type !== 'technical' && data.comprehensive_analysis && (`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched comprehensive_analysis condition successfully.");
} else {
    console.log("Target string not found.");
}
