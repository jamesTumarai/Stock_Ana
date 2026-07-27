const fs = require('fs');

let landingCode = fs.readFileSync('src/LandingView.tsx', 'utf8');

const regex = /<motion\.div\s*initial={{ filter: 'blur\(10px\)', opacity: 0, scale: 0.9 }}[\s\S]*?<\/div>\s*<\/div>\s*<\/motion\.div>/;

if (regex.test(landingCode)) {
    landingCode = landingCode.replace(regex, '');
    fs.writeFileSync('src/LandingView.tsx', landingCode);
    console.log("Removed logo successfully.");
} else {
    console.log("Could not find the target string with regex.");
}
