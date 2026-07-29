const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = "- Technical Key Levels: Ensure Support/Resistance levels are at least 1.5x ATR away from current price.";
const newPrompt = "- Technical Key Levels: Ensure ALL Support/Resistance levels (S1, S2, S3, R1, R2, R3) are at least 1.5x ATR away from the current price AND spaced at least 1.5x ATR away from EACH OTHER (e.g., S1-S2 >= 1.5x ATR).";

if (content.includes(oldPrompt)) {
  content = content.replace(oldPrompt, newPrompt);
  fs.writeFileSync('server.ts', content);
  console.log("Validator ATR rule updated successfully!");
} else {
  console.log("Error: Could not find the old ATR rule.");
}
