const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const strToReplace = 'IMPORTANT: Use rich Markdown formatting (bullet points, bold text, italics) inside your text fields to make the content highly readable, well-structured, and easy to scan, without reducing the length or detail of the analysis.';
const newStr = 'IMPORTANT: Use rich Markdown formatting (bullet points, bold text, italics) inside your text fields to make the content highly readable, well-structured, and easy to scan. CRITICAL: For any lists (like strengths, risks, growth, signals), you MUST use proper Markdown list syntax (starting with "- " or "1. ") on NEW lines. Do NOT write "1) ... 2) ..." inline on a single line.';

content = content.replace(strToReplace, newStr);

fs.writeFileSync('server.ts', content);
console.log("Patched prompt5");
