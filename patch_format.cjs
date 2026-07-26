const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const regex = /(<Markdown>\{)(data\.comprehensive_analysis\.\w+ \|\| '')(\}<\/Markdown>)/g;
content = content.replace(regex, (match, p1, p2, p3) => {
  return `<Markdown>{(${p2}).replace(/(?<=.)(?:\\s+|^)(\\d+)[\\)\\.](?=\\s)/g, '\\n\\n$1. ')}</Markdown>`;
});

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched format");
