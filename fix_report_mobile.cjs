const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="w-full border-b border-stone-200 px-[40px] py-4 flex items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white shadow-sm"',
  'className="w-full border-b border-stone-200 px-4 md:px-[40px] py-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white shadow-sm gap-4 sm:gap-0"'
);

fs.writeFileSync('src/App.tsx', code);

let report = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

report = report.replace(
  'className="max-w-[1200px] mx-auto px-[40px] pb-[100px] print:p-0 print:max-w-none"',
  'className="max-w-[1200px] mx-auto px-4 md:px-[40px] pb-[100px] print:p-0 print:max-w-none"'
);

fs.writeFileSync('src/ReportTemplate.tsx', report);

console.log("Report templates mobile updated");
