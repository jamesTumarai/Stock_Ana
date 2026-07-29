const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const regex = /{data\.analysis_type !== 'technical' && data\.deep_insights && data\.deep_insights\.length > 0 && \(/;

const isTechnicalOnly = `const isTechnicalOnly = data.technical_analysis && !data.comprehensive_analysis;`;

if (!content.includes('isTechnicalOnly')) {
    content = content.replace('const hasTechnical = !!data.technical_analysis;', 'const hasTechnical = !!data.technical_analysis;\n  const isTechnicalOnly = data.technical_analysis && !data.comprehensive_analysis;');
}

content = content.replace(regex, '{!isTechnicalOnly && data.deep_insights && data.deep_insights.length > 0 && (');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log('Fixed ReportTemplate.tsx');
