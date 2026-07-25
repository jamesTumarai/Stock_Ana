const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '<div className={`mt-auto px-6 pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent pointer-events-none`}>',
  '<div className={`mt-auto px-4 md:px-6 pb-6 md:pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent pointer-events-none`}>'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Input padding updated");
