const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  '        {/* Input area fixed at bottom */}\n        <div className={`mt-auto px-6 pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent`}>\n          <div className="max-w-4xl mx-auto w-full">',
  '        {/* Input area fixed at bottom */}\n        <div className={`mt-auto px-6 pb-8 pt-4 w-full fixed bottom-0 print:hidden z-50 bg-transparent pointer-events-none`}>\n          <div className="max-w-4xl mx-auto w-full pointer-events-auto">'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed pointer events");
