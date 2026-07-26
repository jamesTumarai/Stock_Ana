const fs = require('fs');

// Patch LandingView.tsx
let landing = fs.readFileSync('src/LandingView.tsx', 'utf8');
landing = landing.replace(
  'text={isThai ? "Coin King\\nแพลตฟอร์มวิเคราะห์หุ้น\\nด้วย AI" : "Coin King\\nAI-Powered Stock\\nAnalysis Platform"}',
  'text={isThai ? "Lumina\\nวิเคราะห์หุ้นด้วย AI" : "Lumina\\nAI Stock Analysis"}'
);
// Also reduce the font size slightly so it fits better and doesn't look as messy
landing = landing.replace(
  'className="text-5xl md:text-6xl lg:text-[5.5rem] font-heading italic text-white leading-[0.9] max-w-4xl justify-center tracking-[-2px] md:tracking-[-4px]"',
  'className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white leading-[0.95] max-w-4xl justify-center tracking-[-1px] md:tracking-[-2px]"'
);
fs.writeFileSync('src/LandingView.tsx', landing);

// Patch App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  '<span className="font-display font-bold text-xl tracking-wider uppercase text-white">Coin King</span>',
  '<span className="font-display font-bold text-xl tracking-wider uppercase text-white">Lumina</span>'
);
app = app.replace(
  '<title>Coin King - AI Stock Analysis</title>',
  '<title>Lumina - AI Stock Analysis</title>'
); // Might not exist but safe
fs.writeFileSync('src/App.tsx', app);

