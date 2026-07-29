const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /const mergeResponse = await createInteractionWithRetry\(res, \{ prompt: validatePrompt, inlineSources: \[\], model: actualModel \}\);/,
  "const mergeResponse = await createInteractionWithRetry(res, { prompt: validatePrompt, inlineSources: [], model: 'gemini-3.1-pro' });"
);

fs.writeFileSync('server.ts', content);
console.log("Validator model patched.");
