const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  '15) final_verdict_summary: Final short summary.`;',
  '15) final_verdict_summary: Final short summary.\n          CRITICAL RULES:\n          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;'
);

content = content.replace(
  'CRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.`;',
  'CRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.\n          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;'
);

fs.writeFileSync('server.ts', content);
console.log("Patched English rules");
