const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const oldPrompt = "- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct: (Target - Entry) / (Entry - Stop-Loss) or (Entry - Target) / (Stop-Loss - Entry) for shorts. Check the math exactly.";

const newPrompt = "- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct. CRITICAL: You MUST format the R:R ratios cleanly as a 3-column Markdown table or distinct bullet points (Target | Formula | Result) so it is easy to read. Do NOT cram the R:R calculation into a single long string.";

const oldFundCheck = "- Fundamental Fundamentals Check: Must have exactly 8 bullet points.";
const newFundCheck = "- Formatting Checks: Make sure 'business_overview', 'target_customers', 'revenue_model', and 'financial_overview' are formatted as Markdown bullet points (-), NOT large paragraphs. Make sure the R:R calculation in 'trade_plan' is nicely formatted (table or bullets).\n- Fundamental Fundamentals Check: Must have exactly 8 bullet points.";

if (content.includes(oldPrompt)) {
  content = content.replace(oldPrompt, newPrompt);
}

if (content.includes(oldFundCheck)) {
  content = content.replace(oldFundCheck, newFundCheck);
}

fs.writeFileSync('server.ts', content);
console.log("Validator prompt formatting updated.");
