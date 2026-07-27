const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(
  /<span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">Lumina<\/span>/g,
  '<span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">COIN KING</span>'
);
fs.writeFileSync('src/App.tsx', appCode);

// Patch LandingView.tsx
let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const oldLogoSection = `<div className="w-20 h-20 md:w-28 md:h-28 rounded-3xl md:rounded-[2rem] shadow-2xl shadow-indigo-500/20 overflow-hidden inline-flex">
              <img src="/icon.svg" alt="Lumina Logo" className="w-full h-full object-cover" />
            </div>`;

const newLogoSection = `<div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-300 via-yellow-500 to-orange-600 blur-xl opacity-30"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl">
                <div className="absolute inset-1 rounded-full border border-white/10 bg-gradient-to-br from-amber-400/20 to-orange-500/20"></div>
                <Crown className="w-10 h-10 md:w-14 md:h-14 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" strokeWidth={1.5} />
              </div>
            </div>`;

landingCode = landingCode.replace(oldLogoSection, newLogoSection);
landingCode = landingCode.replace(/Lumina\\n/g, 'COIN KING\\n');

fs.writeFileSync('src/LandingView.tsx', landingCode);

console.log("Patched App.tsx and LandingView.tsx");
