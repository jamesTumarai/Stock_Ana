const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// English rules
content = content.replace(
  /8\) momentum_indicators: RSI, Stochastic \(CRITICAL: RSI and Stochastic MUST be exact single current values, NOT ranges\)\./g,
  '8) momentum_indicators: RSI, Stochastic (CRITICAL: RSI and Stochastic MUST be exact single current values, NOT ranges. You MUST also clearly state whether there is any Bullish/Bearish Divergence. If there is none, explicitly state "No divergence observed").'
);

content = content.replace(
  /10\) chart_patterns: Chart patterns\./g,
  '10) chart_patterns: Chart patterns (CRITICAL: You must analyze BOTH Chart Patterns and Candlestick Patterns. If no clear pattern is found, explicitly state "No clear pattern observed". DO NOT skip this topic).'
);

content = content.replace(
  /15\) final_verdict_summary: Final verdict\.\n          CRITICAL REQUIREMENTS:/g,
  '15) final_verdict_summary: Final verdict.\n          CRITICAL REQUIREMENTS:\n          - For Technical Analysis, you MUST cover all 15 topics and subtopics. Do not skip or omit any. If a specific signal (like divergence or candlestick pattern) is not found, explicitly state that it is not found instead of leaving it blank.'
);

fs.writeFileSync('server.ts', content);
console.log('Patched technical prompt rules in English');
