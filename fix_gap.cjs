const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

code = code.replace(
  'gap-4 md:p-6 bg-[#F6F4F0]"',
  'gap-4 md:gap-6 bg-[#F6F4F0]"'
);

code = code.replace(
  'gap-4 md:p-6"',
  'gap-4 md:gap-6"'
);

fs.writeFileSync('src/ReportTemplate.tsx', code);
