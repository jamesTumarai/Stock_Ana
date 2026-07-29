const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// For English, let's inject the same strict requirements
const regexEn = /CRITICAL: You MUST write ALL string values in the JSON output in English\. Please follow the structure covering Fundamental aspects completely\./g;

const replacementEn = `CRITICAL: You MUST write ALL string values in the JSON output in English.
          CRITICAL REQUIREMENTS:
          - Topic 4, 8, 9 must contain at least 3-5 sentences per bullet. DO NOT write single-sentence summaries.
          - For Topic 5 (fundamentals_check): This field MUST NEVER BE EMPTY. You MUST use a markdown bulleted list to assess these 8 areas: 1.Revenue growth 2.Profit growth 3.Cash flow 4.Debt 5.Margin 6.ROIC/ROE/ROA 7.Growth runway 8.Final verdict (Strong, Caution, or Weak).
          - For Topic 8 (key_risks): You MUST cover at least 8 risk categories (Competition, Customer concentration, Regulatory, Economic, Margin, Valuation, Hidden risks, Dilution/SBC). EACH must have 2-3 sentences and numerical backing.
          - For Topic 9 (management): You MUST provide the exact numerical percentage (%) for insider ownership. If not found, explicitly state "Insider ownership data not found in documents." You must analyze capital allocation and evaluate management statements critically.
          - Never use vague adjectives without numbers. Back every claim with exact numbers and quarters (e.g. "Revenue grew 24% YoY in Q1 2026").`;

content = content.replace(regexEn, replacementEn);

fs.writeFileSync('server.ts', content);
console.log('Patched English fundamental rules');
