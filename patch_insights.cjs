const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// insight.description
content = content.replace(/<div className="text-stone-700 leading-relaxed text-\[15px\] flex-1">{insight\.description}<\/div>/g, 
'<div className="prose prose-sm md:prose-base prose-stone max-w-none text-stone-700 leading-relaxed flex-1"><Markdown>{insight.description}</Markdown></div>');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched insights");
