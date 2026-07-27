const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// Add import for AppLogo
appCode = appCode.replace(
  "import { LandingView } from './LandingView';",
  "import { LandingView } from './LandingView';\nimport { AppLogo } from './components/AppLogo';"
);

// Replace the header part
appCode = appCode.replace(
  '<span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">COIN KING</span>',
  '<AppLogo className="w-6 h-6 md:w-8 md:h-8 mr-2" />\n          <span className="font-display font-bold text-xl tracking-wider uppercase text-white drop-shadow-md">COIN KING</span>'
);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Patched App.tsx header with AppLogo.");
