const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const targetStr = `{(!data.technical_analysis || data.comprehensive_analysis) && data.deep_insights && data.deep_insights.length > 0 && (`;
const replacementStr = `{data.analysis_type !== 'technical' && data.deep_insights && data.deep_insights.length > 0 && (`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched Deep Insights condition successfully.");
} else {
    console.log("Target string not found.");
}
