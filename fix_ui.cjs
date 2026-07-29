const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Replace the desktop label
content = content.replace(
  /{selectedLanguage === 'Thai' \? 'Self-Consistency \(10\/10 แม่นยำ\)' : 'Self-Consistency \(10\/10 Accuracy\)'}/g,
  "{selectedLanguage === 'Thai' ? '10/10 แม่นยำ' : '10/10 Accuracy'}"
);

// 2. We need to replace the entire bottom search bar to improve the mobile layout
const searchBarRegex = /<div className=\{`liquid-glass !overflow-visible border-white\/20 border rounded-xl shadow-2xl p-2 w-full flex flex-col md:flex-row md:items-center gap-2 relative z-30 transition-all focus-within:border-white\/40 focus-within:ring-1 focus-within:ring-white\/40`\}>[\s\S]*?<\/div>\s*<div className="text-center mt-4">/g;

const newSearchBar = `<div className={\`liquid-glass !overflow-visible border-white/20 border rounded-xl shadow-2xl p-2 w-full flex flex-col md:flex-row md:items-center gap-2 relative z-30 transition-all focus-within:border-white/40 focus-within:ring-1 focus-within:ring-white/40\`}>
              <div className={\`pl-3 py-1.5 md:py-2 flex items-center justify-between gap-2 text-white/60 border-white/20 border-b md:border-b-0 md:border-r pr-2 md:pr-3\`}>
                 <div className="flex items-center gap-2 flex-1">
                   <Search className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                   <input 
                     type="text"
                     value={ticker}
                     onChange={(e) => setTicker(e.target.value)}
                     placeholder="US TICKER" 
                     disabled={running}
                     className={\`bg-transparent border-none outline-none w-full md:w-28 font-mono uppercase text-base text-white placeholder-white/40\`}
                     onKeyDown={(e) => e.key === 'Enter' && runAnalysis()} onBlur={() => window.scrollTo(0, 0)}
                   />
                 </div>
              </div>
              
              <input 
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={running}
                placeholder="Optional custom instructions..."
                className={\`bg-transparent border-none outline-none flex-1 px-3 py-2 md:py-0 text-base text-white placeholder-white/50 border-b border-white/20 md:border-none\`}
                onKeyDown={(e) => e.key === 'Enter' && runAnalysis()} onBlur={() => window.scrollTo(0, 0)}
              />

              {/* Mobile Controls */}
              <div className="md:hidden flex items-center gap-1.5 shrink-0 justify-between py-1">
                   <CustomSelect
                     direction="up"
                     value={analysisType}
                     onChange={(v) => setAnalysisType(v as any)}
                     disabled={running}
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
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
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
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
                     className="text-[11px] px-2 py-1.5 bg-white/10 border-white/20 text-white flex-1"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />
                   <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1.5 rounded border border-white/20 cursor-pointer flex-1 justify-center" onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}>
                     <div className={\`w-3.5 h-3.5 rounded-sm border flex items-center justify-center \${useSelfConsistency ? 'bg-blue-500 border-blue-500' : 'border-white/30'}\`}>
                       {useSelfConsistency && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                     </div>
                     <span className="text-[11px] text-white/90 font-medium whitespace-nowrap">10/10</span>
                   </div>
              </div>

              <button 
                onClick={runAnalysis}
                disabled={!ticker.trim() || running}
                className={\`bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40 disabled:cursor-not-allowed px-6 py-3 md:py-2 rounded-lg font-medium transition-colors md:ml-2 tracking-wide text-sm flex items-center justify-center min-w-[100px] w-full md:w-auto mt-2 md:mt-0\`}
              >
                {running ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
              </button>
            </div>
            <div className="text-center mt-4">`;

if (content.match(searchBarRegex)) {
  content = content.replace(searchBarRegex, newSearchBar);
  fs.writeFileSync('src/App.tsx', content);
  console.log('App.tsx patched successfully.');
} else {
  console.log('Regex did not match!');
}
