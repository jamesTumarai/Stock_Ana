const fs = require('fs');
let code = fs.readFileSync('src/LandingView.tsx', 'utf8');

// replace Lumina with Coin King
code = code.replace(/Lumina\\n/g, 'COIN KING\\n');
code = code.replace(/Lumina/g, 'COIN KING');

// add Crown to imports
code = code.replace(/import { ArrowUpRight, Play, FileText, Activity, ShieldAlert } from 'lucide-react';/g, "import { ArrowUpRight, Play, FileText, Activity, ShieldAlert, Crown } from 'lucide-react';");

const blurText = `<BlurText 
            text={isThai ? "COIN KING\\nวิเคราะห์หุ้นด้วย AI" : "COIN KING\\nAI Stock Analysis"}
            className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white leading-[0.95] max-w-4xl justify-center tracking-[-1px] md:tracking-[-2px]"
          />`;

const newLogoAndText = `<motion.div 
            initial={{ filter: 'blur(10px)', opacity: 0, scale: 0.9 }}
            animate={{ filter: 'blur(0px)', opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, ease: "easeOut" }}
            className="mb-8"
          >
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-4 md:p-6 rounded-3xl shadow-2xl shadow-amber-500/20 inline-flex">
              <Crown className="w-16 h-16 md:w-24 md:h-24 text-white" strokeWidth={2} />
            </div>
          </motion.div>
          <BlurText 
            text={isThai ? "COIN KING\\nวิเคราะห์หุ้นด้วย AI" : "COIN KING\\nAI Stock Analysis"}
            className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white leading-[0.95] max-w-4xl justify-center tracking-[-1px] md:tracking-[-2px]"
          />`;

code = code.replace(blurText, newLogoAndText);

fs.writeFileSync('src/LandingView.tsx', code);
console.log("Patched LandingView");
