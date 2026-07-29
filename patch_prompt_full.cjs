const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldGuideline = /Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":([\s\S]*?)10\) สรุปให้มือใหม่ตัดสินใจ \(for beginner_summary\):([\s\S]*?)12\) Final Verdict([\s\S]*?)do the analysis yourself based on the retrieved documents and searches.`;/g;

// Actually, let's just replace everything from "Please follow this specific Fundamental Analysis guideline" up to "do the analysis yourself based on the retrieved documents and searches.`;"
