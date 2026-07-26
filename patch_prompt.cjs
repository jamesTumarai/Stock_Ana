const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetPrompt = 'You MUST provide HIGHLY DETAILED, EXTREMELY IN-DEPTH analysis for every field. Do not write short or brief sentences. Elaborate thoroughly with quantitative backing and detailed explanations.';
const replacePrompt = 'You MUST provide HIGHLY DETAILED, EXTREMELY IN-DEPTH analysis for every field. Do not write short or brief sentences. Elaborate thoroughly with quantitative backing and detailed explanations. IMPORTANT: Use rich Markdown formatting (bullet points, bold text, italics) inside your text fields to make the content highly readable, well-structured, and easy to scan, without reducing the length or detail of the analysis.';

content = content.replace(targetPrompt, replacePrompt);
fs.writeFileSync('server.ts', content);
console.log("Patched prompt");
