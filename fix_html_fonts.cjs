const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

code = code.replace(
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">',
  '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&family=Kanit:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap" rel="stylesheet">'
);

fs.writeFileSync('index.html', code);
console.log("HTML fonts updated");
