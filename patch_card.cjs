const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  '<h3 className={`text-lg font-semibold ${titleClassName}`}>{title}</h3>',
  '<h3 className={`text-xl font-display uppercase tracking-wider font-bold ${titleClassName}`}>{title}</h3>'
);

content = content.replace(
  'className={`bg-white rounded-2xl p-3 sm:p-5 md:p-8 border border-stone-200 flex flex-col ${className}`}',
  'className={`bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-stone-200 flex flex-col ${className}`}'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched AnalysisCard");
