const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const regex = /{([^}]+) && data\.deep_insights && data\.deep_insights\.length > 0 && \(/;

const match = code.match(regex);
if (match) {
    console.log("Found: ", match[0]);
    code = code.replace(match[1], '(!data.technical_analysis || data.comprehensive_analysis)');
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched successfully.");
} else {
    console.log("Not found.");
}
