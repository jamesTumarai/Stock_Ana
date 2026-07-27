const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const oldLogoSectionRegex = /<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">[\s\S]*?<\/div>\s*<\/div>\s*<\/motion\.div>/;

const newLogoSection = `<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-blue-500/40 via-indigo-500/40 to-violet-500/40 blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent"></div>
                
                {/* Minimalist Glowing Orb */}
                <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-400 to-cyan-300 shadow-[0_0_40px_rgba(99,102,241,0.6)] flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-white/40 mix-blend-overlay"></div>
                  <div className="absolute top-1 right-2 w-4 h-4 bg-white/60 blur-[3px] rounded-full"></div>
                  <div className="absolute bottom-1 left-2 w-6 h-6 bg-blue-500/40 blur-[4px] rounded-full"></div>
                  
                  {/* Inner diamond/star */}
                  <div className="w-4 h-4 md:w-6 md:h-6 rotate-45 bg-white shadow-[0_0_15px_rgba(255,255,255,0.9)] rounded-[2px] z-10"></div>
                </div>
              </div>
            </div>
          </motion.div>`;

if (oldLogoSectionRegex.test(landingCode)) {
    landingCode = landingCode.replace(oldLogoSectionRegex, newLogoSection);
    fs.writeFileSync('src/LandingView.tsx', landingCode);
    console.log("Patched minimalist logo successfully.");
} else {
    console.log("Could not find the target string with regex.");
}
