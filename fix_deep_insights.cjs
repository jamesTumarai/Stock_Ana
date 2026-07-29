const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldDeepInsights = '"deep_insights": [\n    {\n      "category": "${analysisType === \'technical\' ? \'Technical Pattern\' : \'Risk Assessment\'}",\n      "title": "...",\n      "description": "...",\n      "impact_score": 8\n    }\n  ],';

const newDeepInsights = '${analysisType !== \'technical\' ? `"deep_insights": [\n    {\n      "category": "Risk Assessment",\n      "title": "...",\n      "description": "...",\n      "impact_score": 8\n    }\n  ],` : \'\'}';

content = content.replace(oldDeepInsights, newDeepInsights);

const oldCritical = 'For the Executive Summary, Key Takeaways, Deep Insights, and Comprehensive Analysis, you MUST leverage BOTH the findings extracted from the SEC filings AND insights from broader open web searches to create a comprehensive analysis. ';
const newCritical = 'For the Executive Summary, Key Takeaways, ${analysisType !== \'technical\' ? \'Deep Insights, \' : \'\'}and Comprehensive Analysis, you MUST leverage BOTH the findings extracted from the SEC filings AND insights from broader open web searches to create a comprehensive analysis. ';
content = content.replace(oldCritical, newCritical);

const oldPromptSchema = 'The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score". ';
const newPromptSchema = '${analysisType !== \'technical\' ? \'The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score". \' : \'\'}';
content = content.replace(oldPromptSchema, newPromptSchema);

fs.writeFileSync('server.ts', content);
console.log('Fixed deep insights conditionally in schema');
