const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');
const lastDivIndex = code.lastIndexOf('</div>');
if (lastDivIndex !== -1) {
  code = code.substring(0, lastDivIndex) + '</motion.div>' + code.substring(lastDivIndex + 6);
  fs.writeFileSync('src/ReportTemplate.tsx', code);
  console.log("Fixed ending tag!");
}
