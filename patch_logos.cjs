const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
const oldAppLogo = `<div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 rounded-lg shadow-lg shadow-amber-500/20">
            <Crown className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">Lumina</span>
        </div>`;
const newAppLogo = `<div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">Lumina</span>
        </div>`;
appCode = appCode.replace(oldAppLogo, newAppLogo);
fs.writeFileSync('src/App.tsx', appCode);


// Patch LandingView.tsx
let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');
const oldLandingLogo = `<div className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 md:p-6 rounded-3xl shadow-2xl shadow-amber-500/20 inline-flex">
              <Crown className="w-16 h-16 md:w-24 md:h-24 text-white" strokeWidth={2} />
            </div>`;
const newLandingLogo = `<div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl md:rounded-[2rem] shadow-2xl shadow-indigo-500/20 overflow-hidden inline-flex">
              <img src="/icon.svg" alt="Lumina Logo" className="w-full h-full object-cover" />
            </div>`;
landingCode = landingCode.replace(oldLandingLogo, newLandingLogo);
fs.writeFileSync('src/LandingView.tsx', landingCode);

console.log("Patched both files.");
