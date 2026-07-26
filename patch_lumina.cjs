const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Update imports
content = content.replace(
  "import { Search, Loader2, X, ChevronDown, History, LogOut } from 'lucide-react';",
  "import { Search, Loader2, X, ChevronDown, History, LogOut, Hexagon } from 'lucide-react';"
);

// 2. Update Header Logo
const headerLogoTarget = `<div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>
        </div>`;
const headerLogoReplace = `<div className="flex items-center gap-2 text-white">
          <Hexagon className="w-5 h-5 fill-white text-white" />
          <span className="font-display font-bold text-xl tracking-wider uppercase">Lumina</span>
        </div>`;
content = content.replace(headerLogoTarget, headerLogoReplace);

// 3. Fix Input Layout
const inputTarget = `<div className={\`pl-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-3\`}>
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
const inputReplace = `<div className={\`pl-3 py-1.5 md:py-2 flex items-center justify-between gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-2 md:pr-3\`}>
                 <div className="flex items-center gap-2 flex-1">
                   <Search className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                   <input 
                     type="text" 
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value)}
                     placeholder="US TICKER" 
                     disabled={running}
                     className={\`bg-transparent border-none outline-none w-24 md:w-28 font-mono uppercase text-sm md:text-base text-white placeholder-white/40\`}
                     onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
                   />
                 </div>
                 <div className="md:hidden flex items-center gap-1.5 shrink-0">`;
content = content.replace(inputTarget, inputReplace);

// Reduce padding in the CustomSelects for mobile
const selectsTarget = `                   <CustomSelect
                     direction="up"
                     value={analysisType}
                     onChange={(v) => setAnalysisType(v as any)}
                     disabled={running}
                     className="text-[11px] px-1.5 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'fundamental', label: 'Fund' },
                       { value: 'technical', label: 'Tech' },
                       { value: 'combined', label: 'Both' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedLanguage}
                     onChange={setSelectedLanguage}
                     disabled={running}
                     className="text-[11px] px-1.5 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'English', label: 'EN' },
                       { value: 'Thai', label: 'TH' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedModel}
                     onChange={setSelectedModel}
                     disabled={running}
                     className="text-[11px] px-1.5 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />`;
const selectsReplace = `                   <CustomSelect
                     direction="up"
                     value={analysisType}
                     onChange={(v) => setAnalysisType(v as any)}
                     disabled={running}
                     className="text-[10px] md:text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[55px]"
                     options={[
                       { value: 'fundamental', label: 'Fund' },
                       { value: 'technical', label: 'Tech' },
                       { value: 'combined', label: 'Both' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedLanguage}
                     onChange={setSelectedLanguage}
                     disabled={running}
                     className="text-[10px] md:text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[40px]"
                     options={[
                       { value: 'English', label: 'EN' },
                       { value: 'Thai', label: 'TH' },
                     ]}
                   />
                   <CustomSelect
                     direction="up"
                     value={selectedModel}
                     onChange={setSelectedModel}
                     disabled={running}
                     className="text-[10px] md:text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[45px]"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />`;
content = content.replace(selectsTarget, selectsReplace);

fs.writeFileSync('src/App.tsx', content);
