const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

code = code.replace(
  `    transition={{ duration: 0.4, delay }} \n    className={\`bg-white rounded p-6 border border-stone-200 flex flex-col \${className}\`}\n  >\n  <div className={\`bg-white rounded p-6 border border-stone-200 flex flex-col \${className}\`}>`,
  `    transition={{ duration: 0.4, delay }} \n    className={\`bg-white rounded p-6 border border-stone-200 flex flex-col \${className}\`}\n  >`
);

// wait, the old replacement didn't replace the closing tag properly because it couldn't find exactly the string I provided maybe.
// Let's just fix the whole AnalysisCard
