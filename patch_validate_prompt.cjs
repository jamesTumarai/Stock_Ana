const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = `CRITICAL CHECKS:
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct: (Target - Entry) / (Entry - Stop-Loss) or (Entry - Target) / (Stop-Loss - Entry) for shorts. Check the math exactly.
- Technical Key Levels: Ensure Support/Resistance levels are at least 1.5x ATR away from current price.
- Fundamental Fundamentals Check: Must have exactly 8 bullet points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Insider Ownership: Must be a numeric percentage.`;

const newPrompt = `CRITICAL CHECKS:
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct: (Target - Entry) / (Entry - Stop-Loss) or (Entry - Target) / (Stop-Loss - Entry) for shorts. Check the math exactly.
- Technical Key Levels: Ensure Support/Resistance levels are at least 1.5x ATR away from current price.
- Technical Completeness: You MUST verify that BOTH 'Divergence' (under momentum indicators) and 'Candlestick Pattern' (under chart patterns or momentum indicators) are explicitly analyzed and present in the final output. Even if they do not exist, they MUST be explicitly stated as "No Divergence observed" and "No clear Candlestick pattern observed". If they are missing, you MUST deduce them from the data and include them.
- Fundamental Fundamentals Check: Must have exactly 8 bullet points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Insider Ownership: Must be a numeric percentage.`;

if (content.includes(oldPrompt)) {
  content = content.replace(oldPrompt, newPrompt);
  fs.writeFileSync('server.ts', content);
  console.log("Validator prompt updated successfully!");
} else {
  console.log("Error: Could not find the old prompt block.");
}
