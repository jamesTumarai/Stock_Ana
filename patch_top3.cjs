const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  /<span>{s}<\/span>/g,
  '<span className="prose prose-sm md:prose-base prose-stone max-w-none"><Markdown>{s}</Markdown></span>'
);

content = content.replace(
  /<span>{r}<\/span>/g,
  '<span className="prose prose-sm md:prose-base prose-stone max-w-none"><Markdown>{r}</Markdown></span>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched top 3");
