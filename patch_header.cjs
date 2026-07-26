const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add LogOut, History to imports
content = content.replace("import { Search, Loader2, X, ChevronDown } from 'lucide-react';", "import { Search, Loader2, X, ChevronDown, History, LogOut } from 'lucide-react';");

// 2. Modify CustomSelect to support truncate
const customSelectTarget = `      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center gap-2 text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 \${className || ''}\`}
      >
        {selectedOption.label}
        <ChevronDown className={\`w-4 h-4 transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>`;
const customSelectReplace = `      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center justify-between gap-1 text-sm rounded px-2 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 \${className || ''}\`}
      >
        <span className="truncate min-w-0">{selectedOption.label}</span>
        <ChevronDown className={\`w-3 h-3 shrink-0 transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>`;
content = content.replace(customSelectTarget, customSelectReplace);

// 3. Modify Header
const headerTarget = `        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white px-2 py-1.5"
              >
                History
              </button>
              <button 
                onClick={handleLogout}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white px-2 py-1.5"
              >
                Logout
              </button>
              <img src={user.photoURL || ''} alt="avatar" className="w-7 h-7 rounded-full border border-white/20" />
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="text-xs md:text-sm font-medium text-white/80 hover:text-white px-3 py-1.5 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          )}
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
          <div className="hidden md:block">
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
        </div>`;

const headerReplace = `        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <div className="flex items-center gap-1 md:gap-4">
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white p-2 md:px-2 md:py-1.5 flex items-center gap-1"
                title="History"
              >
                <History className="w-5 h-5 md:hidden" />
                <span className="hidden md:inline">History</span>
              </button>
              <button 
                onClick={handleLogout}
                className="text-xs md:text-sm font-medium text-white/80 hover:text-white p-2 md:px-2 md:py-1.5 flex items-center gap-1"
                title="Logout"
              >
                <LogOut className="w-5 h-5 md:hidden" />
                <span className="hidden md:inline">Logout</span>
              </button>
              <img src={user.photoURL || ''} alt="avatar" className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/20 ml-1" />
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="text-xs md:text-sm font-medium text-white/80 hover:text-white px-3 py-1.5 border border-white/20 rounded-full hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          )}
          <div className="hidden md:flex items-center gap-2 md:gap-3">
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
        </div>`;
content = content.replace(headerTarget, headerReplace);

// 4. Modify mobile selects
const mobileSelectsTarget = `                 <div className="md:hidden shrink-0">
                   <CustomSelect
                     direction="up"
                     value={selectedModel}
                     onChange={setSelectedModel}
                     disabled={running}
                     className="text-xs px-2 py-1 bg-white/10 border-white/20 text-white"
                     options={[
                       { value: 'gemini-3.5-flash', label: '3.5 Flash' },
                       { value: 'perseus', label: '3.6 Flash' },
                     ]}
                   />
                 </div>`;
const mobileSelectsReplace = `                 <div className="md:hidden shrink-0 flex items-center gap-1.5">
                   <CustomSelect
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
                   />
                 </div>`;
content = content.replace(mobileSelectsTarget, mobileSelectsReplace);

fs.writeFileSync('src/App.tsx', content);
