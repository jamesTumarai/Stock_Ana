const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(
  "@import url('https://fonts.googleapis.com/css2?family=Itim&family=Big+Shoulders+Display:wght@400..900&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Instrument+Serif:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500;600;700&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Itim&family=Big+Shoulders+Display:wght@400..900&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Instrument+Serif:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500;600;700&family=Kanit:wght@300;400;500;600;700&family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap');"
);

code = code.replace(
  '--font-sans: "Itim", "Instrument Sans", ui-sans-serif, system-ui, sans-serif;',
  '--font-sans: "Instrument Sans", "Noto Sans Thai", "Itim", ui-sans-serif, system-ui, sans-serif;'
);

code = code.replace(
  '--font-display: "Big Shoulders Display", ui-sans-serif, system-ui, sans-serif;',
  '--font-display: "Big Shoulders Display", "Kanit", ui-sans-serif, system-ui, sans-serif;'
);

code = code.replace(
  '--font-body: "Barlow", sans-serif;',
  '--font-body: "Barlow", "Noto Sans Thai", sans-serif;'
);

fs.writeFileSync('src/index.css', code);
console.log("Fonts updated");
