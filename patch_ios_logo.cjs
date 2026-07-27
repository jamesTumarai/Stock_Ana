const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const regex = /<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">[\s\S]*?<\/div>\s*<\/div>\s*<\/motion\.div>/;

const replacement = `<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">
              {/* Outer Glow */}
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 blur-2xl opacity-40 group-hover:opacity-70 group-hover:blur-3xl transition-all duration-700"></div>
              
              {/* Icon Container */}
              <div className="relative flex items-center justify-center w-full h-full rounded-[2.5rem] bg-[#0a0a0f] border border-white/10 shadow-2xl overflow-hidden">
                {/* Inner ambient light */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-purple-500/30 via-transparent to-cyan-500/20"></div>
                
                {/* Glass reflection */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-[2.5rem]"></div>
                
                <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-16 md:h-16 z-10 overflow-visible">
                  <defs>
                    <linearGradient id="grad-l" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="40%" stopColor="#a5b4fc" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Sleek L shape */}
                  <g filter="url(#neon-glow)">
                    <path d="M 25,15 L 45,15 L 45,65 L 80,65 L 80,85 L 25,85 Z" fill="url(#grad-l)" />
                  </g>
                  
                  {/* Core highlight for extra sharpness */}
                  <path d="M 27,17 L 43,17 L 43,67 L 78,67 L 78,83 L 27,83 Z" fill="#ffffff" opacity="0.9" />
                  
                  {/* Floating spark */}
                  <circle cx="70" cy="35" r="5" fill="#ffffff" filter="url(#neon-glow)" className="animate-pulse" />
                  <circle cx="70" cy="35" r="2" fill="#ffffff" />
                </svg>
              </div>
            </div>
          </motion.div>`;

if (regex.test(landingCode)) {
    landingCode = landingCode.replace(regex, replacement);
    fs.writeFileSync('src/LandingView.tsx', landingCode);
    console.log("Patched iOS style logo successfully.");
} else {
    console.log("Could not find the target string with regex.");
}
