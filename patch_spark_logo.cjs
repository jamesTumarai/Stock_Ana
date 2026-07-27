const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const regex = /<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">[\s\S]*?<\/div>\s*<\/div>\s*<\/motion\.div>/;

const replacement = `<div className="relative flex items-center justify-center w-24 h-24 md:w-32 md:h-32 group">
              {/* Outer Glow */}
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-tr from-cyan-400/50 via-blue-500/50 to-purple-600/50 blur-2xl opacity-50 group-hover:opacity-80 group-hover:blur-3xl transition-all duration-700"></div>
              
              {/* Icon Container */}
              <div className="relative flex items-center justify-center w-full h-full rounded-[2.5rem] bg-[#0a0a0f] border border-white/10 shadow-2xl overflow-hidden">
                {/* Inner ambient light */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-purple-500/30 via-transparent to-cyan-500/20"></div>
                
                {/* Glass reflection top highlight */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/15 to-transparent rounded-t-[2.5rem] pointer-events-none"></div>
                
                {/* Diagonal glass glare */}
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-white/10 via-transparent to-transparent rotate-45 pointer-events-none transform -translate-x-12 -translate-y-12"></div>

                <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-16 md:h-16 z-10 overflow-visible">
                  <defs>
                    <linearGradient id="spark-1" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#e879f9" />
                    </linearGradient>
                    <linearGradient id="spark-2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                    <filter id="spark-glow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <g filter="url(#spark-glow)">
                    {/* Main large spark */}
                    <path d="M 50,5 C 50,30 70,50 95,50 C 70,50 50,70 50,95 C 50,70 30,50 5,50 C 30,50 50,30 50,5 Z" fill="url(#spark-1)" opacity="0.9" />
                    
                    {/* Secondary angled spark for density */}
                    <path d="M 50,15 C 50,35 65,50 85,50 C 65,50 50,65 50,85 C 50,65 35,50 15,50 C 35,50 50,35 50,15 Z" fill="url(#spark-2)" opacity="0.8" transform="rotate(45, 50, 50)" mixBlendMode="screen" />
                  </g>

                  {/* Crisp White Core Layers */}
                  <path d="M 50,10 C 50,32 68,50 90,50 C 68,50 50,68 50,90 C 50,68 32,50 10,50 C 32,50 50,32 50,10 Z" fill="#ffffff" opacity="0.5" />
                  <path d="M 50,20 C 50,38 62,50 80,50 C 62,50 50,62 50,80 C 50,62 38,50 20,50 C 38,50 50,38 50,20 Z" fill="#ffffff" opacity="0.9" />
                  
                  {/* Central bright spot */}
                  <circle cx="50" cy="50" r="5" fill="#ffffff" className="animate-pulse" />
                  <circle cx="50" cy="50" r="2" fill="#ffffff" />
                </svg>
              </div>
            </div>
          </motion.div>`;

if (regex.test(landingCode)) {
    landingCode = landingCode.replace(regex, replacement);
    fs.writeFileSync('src/LandingView.tsx', landingCode);
    console.log("Patched Spark AI logo successfully.");
} else {
    console.log("Could not find the target string with regex.");
}
