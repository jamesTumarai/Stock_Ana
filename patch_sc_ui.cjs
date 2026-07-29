const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /options=\{\[\n\s*\{ value: 'English', label: 'English' \},\n\s*\{ value: 'Thai', label: 'ภาษาไทย' \},\n\s*\]\}\n\s*\/>/g,
  `options={[
                { value: 'English', label: 'English' },
                { value: 'Thai', label: 'ภาษาไทย' },
              ]}
            />
            <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm cursor-pointer hover:bg-white/10 transition-colors" onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}>
              <div className={\`w-4 h-4 rounded border flex items-center justify-center \${useSelfConsistency ? 'bg-blue-500 border-blue-500' : 'border-white/30'}\`}>
                {useSelfConsistency && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-[11px] md:text-xs text-white/90 font-medium whitespace-nowrap select-none">
                {selectedLanguage === 'Thai' ? 'Self-Consistency (10/10 แม่นยำ)' : 'Self-Consistency (10/10 Accuracy)'}
              </span>
            </div>`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx with useSelfConsistency UI');
