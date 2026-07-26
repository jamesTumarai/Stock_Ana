const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  '<div className="text-stone-700 leading-relaxed">{takeaway}</div>',
  '<div className="text-stone-700 leading-relaxed prose prose-base prose-stone max-w-none"><Markdown>{takeaway}</Markdown></div>'
);

content = content.replace(
  '<div className="text-stone-700 leading-relaxed">{String(data.verdict.key_takeaways)}</div>',
  '<div className="text-stone-700 leading-relaxed prose prose-base prose-stone max-w-none"><Markdown>{String(data.verdict.key_takeaways)}</Markdown></div>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched takeaways");
