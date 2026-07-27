const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldHeader = `<div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">COIN KING</span>
        </div>`;

const newHeader = `<div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 rounded-lg shadow-lg shadow-amber-500/20">
            <Crown className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">COIN KING</span>
        </div>`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx with logo');
