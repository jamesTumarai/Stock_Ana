const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /Do not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches\./g,
  `Do not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches.
CRITICAL: SELF-CONSISTENCY CHECK. Before generating the final JSON block, you MUST write a short validation text explaining your calculations for the Technical Trade Plan. You MUST explicitly show the ATR value, the distance of each Support/Resistance level from the current price in terms of ATR, and the math for Risk/Reward Ratio 1 and 2. Only after you have written this validation text, output the final JSON.`
);

fs.writeFileSync('server.ts', content);
console.log('Patched self-consistency in server.ts');
