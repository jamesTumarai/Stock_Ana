const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `<div className={\`pl-3 py-2 flex items-center justify-between gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-3\`}>
                 <div className="flex items-center gap-2 flex-1">
                   <Search className="w-5 h-5 shrink-0" />
                   <input 
                     type="text" 
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value)}
                     placeholder="US TICKER" 
                     disabled={running}
                     className={\`bg-transparent border-none outline-none w-28 font-mono uppercase text-white placeholder-white/40\`}
                     onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                   />
                 </div>
                 <div className="md:hidden shrink-0 flex items-center gap-1.5">`;

const replace = `<div className={\`pl-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-3\`}>
                 <div className="flex items-center gap-2 w-full md:w-auto">
                   <Search className="w-5 h-5 shrink-0" />
                   <input 
                     type="text" 
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value)}
                     placeholder="US TICKER" 
                     disabled={running}
                     className={\`bg-transparent border-none outline-none w-full md:w-28 font-mono uppercase text-white placeholder-white/40\`}
                     onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                   />
                 </div>
                 <div className="md:hidden flex items-center gap-2 w-full">`;

content = content.replace(target, replace);
fs.writeFileSync('src/App.tsx', content);
