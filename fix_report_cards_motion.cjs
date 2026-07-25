const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

code = code.replace(
  `const AnalysisCard = ({ title, subtext, children, className = "", titleClassName = "text-stone-900" }: any) => (`,
  `const AnalysisCard = ({ title, subtext, children, className = "", titleClassName = "text-stone-900", delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} 
    whileInView={{ opacity: 1, y: 0 }} 
    viewport={{ once: true }} 
    transition={{ duration: 0.4, delay }} 
    className={\`bg-white rounded p-6 border border-stone-200 flex flex-col \${className}\`}
  >`
);
// Now replace the end div of AnalysisCard. 
code = code.replace(
  `    {children}\n  </div>\n)`,
  `    {children}\n  </motion.div>\n)`
);

fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("Updated AnalysisCard with motion");
