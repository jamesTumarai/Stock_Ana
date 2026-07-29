const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /options=\{\[\n\s*\{ value: 'gemini-3\.5-flash', label: '3\.5' \},\n\s*\{ value: 'perseus', label: '3\.6' \},\n\s*\]\}\n\s*\/>\n\s*<\/div>\n\s*<\/div>\n\s*<input/g,
  `options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />
                   <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded border border-white/20 cursor-pointer" onClick={() => !running && setUseSelfConsistency(!useSelfConsistency)}>
                     <div className={\`w-3 h-3 rounded-sm border flex items-center justify-center \${useSelfConsistency ? 'bg-blue-500 border-blue-500' : 'border-white/30'}\`}>
                       {useSelfConsistency && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                     </div>
                     <span className="text-[10px] text-white/90">SC</span>
                   </div>
                 </div>
              </div>
              <input`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx with mobile useSelfConsistency UI');
