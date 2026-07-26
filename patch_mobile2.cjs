const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target2 = `                   <CustomSelect
                     direction="up"
                     value={analysisType}
                     onChange={(v) => setAnalysisType(v as any)}
                     disabled={running}
                     className="text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[75px]"
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
                     className="text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[50px]"
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
                     className="text-[11px] px-1.5 py-1 bg-white/10 border-white/20 text-white w-[60px]"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5' },
                       { value: 'perseus', label: '3.6' },
                     ]}
                   />`;

const replace2 = `                   <CustomSelect
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

content = content.replace(target2, replace2);
fs.writeFileSync('src/App.tsx', content);
