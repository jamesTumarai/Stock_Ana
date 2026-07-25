const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className="absolute top-full mt-1.5 right-0 min-w-full whitespace-nowrap bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 origin-top-right p-1 flex flex-col"',
  'className="absolute top-full mt-1.5 left-0 min-w-[160px] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 origin-top-left p-1 flex flex-col"'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Fixed CustomSelect dropdown width");
