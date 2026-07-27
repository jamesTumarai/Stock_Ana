const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  'const systemPrompt = `You are a world-class financial analyst and investment advisor.',
  'const systemPrompt = `You are a world-class financial analyst and investment advisor.\\n\\nCRITICAL RULE FOR SELF-VERIFICATION: Before finalizing your output, you MUST double-check all numerical claims and consecutive counts (e.g., "profitable for 6 quarters"). If you cannot strictly verify the exact count from the provided document chunks, you must state "Cannot confirm exact count" instead of guessing.'
);

fs.writeFileSync('server.ts', content);
console.log("Patched verification rule");
