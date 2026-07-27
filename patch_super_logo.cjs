const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const oldLogoSection = `<div className="relative flex items-center justify-center w-20 h-20 md:w-28 md:h-28 group">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-500 to-purple-500 blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-700"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-full bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-400/20 to-purple-500/20"></div>
                <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4)_0%,transparent_60%)]"></div>
                <Sparkles className="w-10 h-10 md:w-14 md:h-14 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] z-10" strokeWidth={1.2} />
              </div>
            </div>`;

const newLogoSection = `<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-40 group-hover:opacity-70 group-hover:blur-2xl transition-all duration-700"></div>
              <div className="relative flex items-center justify-center w-full h-full rounded-[2rem] bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-50"></div>
                
                {/* Rotating metallic light effect */}
                <div className="absolute w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,rgba(255,255,255,0.4)_360deg)] animate-[spin_4s_linear_infinite]"></div>

                <svg viewBox="0 0 100 100" className="w-14 h-14 md:w-20 md:h-20 z-10 drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] overflow-visible">
                  <defs>
                    <linearGradient id="lumina-grad-main" x1="20%" y1="0%" x2="80%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="40%" stopColor="#e0e7ff" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                    <linearGradient id="lumina-grad-accent" x1="0%" y1="20%" x2="100%" y2="80%">
                      <stop offset="0%" stopColor="#c084fc" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                  </defs>
                  
                  {/* Outer glowing rings */}
                  <circle cx="50" cy="50" r="42" fill="none" stroke="url(#lumina-grad-accent)" strokeWidth="1.5" strokeDasharray="4 6" className="origin-center animate-[spin_12s_linear_infinite]" />
                  <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="10 5" className="origin-center animate-[spin_18s_linear_infinite_reverse]" />
                  
                  {/* Central Star */}
                  <path d="M50 5 L55 45 L95 50 L55 55 L50 95 L45 55 L5 50 L45 45 Z" fill="url(#lumina-grad-main)" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <path d="M50 20 L53 47 L80 50 L53 53 L50 80 L47 53 L20 50 L47 47 Z" fill="#ffffff" />
                  <circle cx="50" cy="50" r="7" fill="#ffffff" className="animate-pulse drop-shadow-[0_0_12px_rgba(255,255,255,1)]" />
                </svg>
              </div>
            </div>`;

if (landingCode.includes('w-20 h-20 md:w-28 md:h-28 group')) {
    landingCode = landingCode.replace(oldLogoSection, newLogoSection);
    fs.writeFileSync('src/LandingView.tsx', landingCode);
    console.log("Patched successfully");
} else {
    console.log("Could not find the target string.");
}
