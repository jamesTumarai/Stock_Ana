const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /<span className="text-\[11px\] text-white\/90 font-medium whitespace-nowrap">10\/10<\/span>/g,
  '<span className="text-[10px] md:text-[11px] text-white/90 font-medium whitespace-nowrap">{selectedLanguage === \'Thai\' ? \'10/10 แม่นยำ\' : \'10/10 Acc\'}</span>'
);

fs.writeFileSync('src/App.tsx', content);
console.log('Mobile text updated.');
