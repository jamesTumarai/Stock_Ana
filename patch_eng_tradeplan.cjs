const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /You MUST format the R:R calculations as clearly separated Markdown bullet points for readability\)\./g,
  "You MUST format the R:R calculations as a Markdown table (Target | Formula | Result) using '\\n' for newlines to ensure it renders correctly)."
);

fs.writeFileSync('server.ts', content);
console.log("English trade plan updated.");
