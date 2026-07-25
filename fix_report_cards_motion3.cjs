const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const startIdx = code.indexOf('const AnalysisCard');
const endIdx = code.indexOf('export default function ReportTemplate');

const newCard = `const AnalysisCard = ({ title, subtext, children, className = "", titleClassName = "text-stone-900", delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} 
    whileInView={{ opacity: 1, y: 0 }} 
    viewport={{ once: true }} 
    transition={{ duration: 0.4, delay }} 
    className={\`bg-white rounded p-6 border border-stone-200 flex flex-col \${className}\`}
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className={\`text-lg font-semibold \${titleClassName}\`}>{title}</h3>
    </div>
    {subtext && (
      <div className="text-stone-700 text-[15px] mb-6">
        {subtext}
      </div>
    )}
    <div className="flex-1 w-full flex flex-col">
      {children}
    </div>
  </motion.div>
);

`;

code = code.substring(0, startIdx) + newCard + code.substring(endIdx);
fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("AnalysisCard fixed!");
