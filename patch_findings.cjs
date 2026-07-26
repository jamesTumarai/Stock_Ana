const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  '<span>{insight}</span>',
  '<span className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{insight}</Markdown></span>'
);

content = content.replace(
  '<span>{String(finding.keyInsights || finding.key_insights)}</span>',
  '<span className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{String(finding.keyInsights || finding.key_insights)}</Markdown></span>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched findings");
