const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const deepInsightsRegex = /\s*\{\/\* Deep Insights \*\/\}\s*\{!isTechnicalOnly && data\.deep_insights && data\.deep_insights\.length > 0 && \([\s\S]*?<\/div>\s*\)\}\s*/;

const match = content.match(deepInsightsRegex);

if (match) {
  const deepInsightsBlock = match[0];
  content = content.replace(deepInsightsRegex, '\n');
  
  // Find where to insert it: before {/* Detailed Findings */}
  const targetRegex = /\s*\{\/\* Detailed Findings \*\/\}/;
  content = content.replace(targetRegex, `\n\n${deepInsightsBlock}\n\n        {/* Detailed Findings */}`);
  
  fs.writeFileSync('src/ReportTemplate.tsx', content);
  console.log("Moved Deep Insights below Technical Analysis.");
} else {
  console.log("Could not find Deep Insights block.");
}
