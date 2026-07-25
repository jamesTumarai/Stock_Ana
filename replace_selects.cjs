const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldHeader = `<header className={\`flex items-center justify-between px-6 py-4 print:hidden absolute top-0 w-full z-50 bg-transparent\`}>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value as any)}
            disabled={running}
            className={\`text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white\`}
          >
            <option value="fundamental" className="bg-stone-800 text-white">Fundamental Analysis</option>
            <option value="technical" className="bg-stone-800 text-white">Technical Analysis</option>
            <option value="combined" className="bg-stone-800 text-white">Fundamental + Technical</option>
          </select>
          <select 
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            disabled={running}
            className={\`text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white\`}
          >
            <option value="English" className="bg-stone-800 text-white">English</option>
            <option value="Thai" className="bg-stone-800 text-white">ภาษาไทย</option>
          </select>
          <select 
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={running}
            className={\`text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white\`}
          >
            <option value="gemini-3.5-flash" className="bg-stone-800 text-white">Gemini 3.5 Flash</option>
            <option value="perseus" className="bg-stone-800 text-white">Gemini 3.6 Flash</option>
          </select>
        </div>
      </header>`;

const newHeader = `<header className={\`flex items-center justify-between px-6 py-4 print:hidden absolute top-0 w-full z-50 bg-transparent\`}>
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>
        </div>
        <div className="flex items-center gap-3">
          <CustomSelect
            value={analysisType}
            onChange={(v) => setAnalysisType(v as any)}
            disabled={running}
            options={[
              { value: 'fundamental', label: 'Fundamental Analysis' },
              { value: 'technical', label: 'Technical Analysis' },
              { value: 'combined', label: 'Fundamental + Technical' },
            ]}
          />
          <CustomSelect
            value={selectedLanguage}
            onChange={setSelectedLanguage}
            disabled={running}
            options={[
              { value: 'English', label: 'English' },
              { value: 'Thai', label: 'ภาษาไทย' },
            ]}
          />
          <CustomSelect
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={running}
            options={[
              { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
              { value: 'perseus', label: 'Gemini 3.6 Flash' },
            ]}
          />
        </div>
      </header>`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('src/App.tsx', code);
console.log("Replaced selects with CustomSelect.");
