const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  'const systemPrompt = `You are a world-class financial analyst and investment advisor.',
  'const systemPrompt = `You are a world-class financial analyst and investment advisor.\n\nCRITICAL RULE FOR INLINE CITATIONS: Whenever you state a specific number, financial metric, or factual claim, you MUST append a citation referring to the source document index (e.g., [1], [2]) based on the order of items you will output in the "findings" array. For example: "Revenue grew by 20% [1]." Do this rigorously.'
);

fs.writeFileSync('server.ts', content);
console.log("Patched inline citations");
