const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Fix Header
code = code.replace(
  '<header className={`flex items-center justify-between px-6 py-4 print:hidden absolute top-0 w-full z-50 bg-transparent`}>\n        <div className="flex items-center gap-2">\n          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>\n        </div>\n        <div className="flex items-center gap-3">',
  '<header className={`flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-4 gap-4 print:hidden absolute top-0 w-full z-50 bg-transparent`}>\n        <div className="flex items-center gap-2">\n          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>\n        </div>\n        <div className="flex flex-wrap items-center gap-2 md:gap-3">'
);

// Fix input area
code = code.replace(
  '<div className={`liquid-glass border-white/20 border rounded-xl shadow-2xl p-2 w-full flex items-center gap-2 relative z-30 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/40`}>\n              <div className={`pl-3 py-2 flex items-center gap-2 text-white/60 border-white/20 border-r pr-3`}>',
  '<div className={`liquid-glass border-white/20 border rounded-xl shadow-2xl p-2 w-full flex flex-col md:flex-row md:items-center gap-2 relative z-30 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/40`}>\n              <div className={`pl-3 py-2 flex items-center gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-3`}>'
);

code = code.replace(
  'className={`bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition-colors ml-2 tracking-wide text-sm flex items-center justify-center min-w-[100px]`}',
  'className={`bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-6 py-3 md:py-2 rounded-lg font-medium transition-colors md:ml-2 tracking-wide text-sm flex items-center justify-center min-w-[100px] w-full md:w-auto mt-2 md:mt-0`}'
);

fs.writeFileSync('src/App.tsx', code);
console.log("App.tsx mobile updated");
