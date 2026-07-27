const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

// Replace imports
landingCode = landingCode.replace(
  "import { ArrowUpRight, Play, FileText, Activity, ShieldAlert, Crown } from 'lucide-react';",
  "import { ArrowUpRight, Play, FileText, Activity, ShieldAlert, Sparkles } from 'lucide-react';"
);

// Replace Center Text
landingCode = landingCode.replace(/COIN KING\\n/g, 'Lumina\\n');

// Replace Logo
const oldLogoSection = `<div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-300 via-yellow-500 to-orange-600 blur-xl opacity-30"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl">
                <div className="absolute inset-1 rounded-full border border-white/10 bg-gradient-to-br from-amber-400/20 to-orange-500/20"></div>
                <Crown className="w-10 h-10 md:w-14 md:h-14 text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.6)]" strokeWidth={1.5} />
              </div>
            </div>`;

const newLogoSection = `<div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28 group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-purple-500/20"></div>
                <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4)_0%,transparent_60%)]"></div>
                <Sparkles className="w-10 h-10 md:w-14 md:h-14 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] z-10" strokeWidth={1.2} />
              </div>
            </div>`;

landingCode = landingCode.replace(oldLogoSection, newLogoSection);

fs.writeFileSync('src/LandingView.tsx', landingCode);

console.log("Patched LandingView.tsx for Lumina center design");
