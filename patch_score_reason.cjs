const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// For comprehensive analysis
content = content.replace(
  '<div className="text-xs text-stone-700">{scoreData.reason || \'\'}</div>',
  '<div className="text-xs text-stone-700 prose prose-sm prose-stone max-w-none"><Markdown>{scoreData.reason || \'\'}</Markdown></div>'
);

// For technical analysis
content = content.replace(
  '<div className="text-sm text-stone-700 leading-snug">{item.reason}</div>',
  '<div className="text-sm text-stone-700 leading-snug prose prose-sm prose-stone max-w-none"><Markdown>{item.reason}</Markdown></div>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched score reasons");
