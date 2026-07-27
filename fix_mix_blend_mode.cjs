const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

landingCode = landingCode.replace('mixBlendMode="screen"', 'style={{ mixBlendMode: "screen" }}');

fs.writeFileSync('src/LandingView.tsx', landingCode);
console.log("Fixed mixBlendMode prop.");
