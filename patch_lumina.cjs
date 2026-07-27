const fs = require('fs');

// App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace(/COIN KING/g, 'Lumina');
fs.writeFileSync('src/App.tsx', appCode);

// LandingView.tsx
let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');
landingCode = landingCode.replace(/COIN KING/g, 'Lumina');
fs.writeFileSync('src/LandingView.tsx', landingCode);

console.log("Reverted COIN KING back to Lumina");
