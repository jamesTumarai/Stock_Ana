const fs = require('fs');
const content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');
const lines = content.split('\n');

const deepInsightsStart = lines.findIndex(l => l.includes('{/* Deep Insights */}'));
const deepInsightsEnd = lines.findIndex(l => l.includes('{/* Detailed Findings */}')) - 1;

if (deepInsightsStart !== -1 && deepInsightsEnd !== -1) {
    const deepInsightsBlock = lines.slice(deepInsightsStart, deepInsightsEnd);
    lines.splice(deepInsightsStart, deepInsightsEnd - deepInsightsStart);
    
    const technicalStart = lines.findIndex(l => l.includes('{/* Technical Analysis */}'));
    if (technicalStart !== -1) {
        lines.splice(technicalStart, 0, ...deepInsightsBlock, '');
        fs.writeFileSync('src/ReportTemplate.tsx', lines.join('\n'));
        console.log("Moved Deep Insights successfully.");
    } else {
        console.log("Could not find Technical Analysis block.");
    }
} else {
    console.log("Could not find Deep Insights block boundaries.");
}
