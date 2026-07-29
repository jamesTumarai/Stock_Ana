const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /const \{ ticker, instruction, origin, model, language, analysisType \} = req\.body;/g,
  "const { ticker, instruction, origin, model, language, analysisType, useSelfConsistency } = req.body;"
);

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts with useSelfConsistency extraction');
