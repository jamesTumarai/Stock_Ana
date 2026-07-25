const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'className={`bg-transparent border-none outline-none w-24 font-mono uppercase text-white placeholder-white/40`}',
  'className={`bg-transparent border-none outline-none w-full md:w-24 font-mono uppercase text-white placeholder-white/40`}'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Input width updated");
