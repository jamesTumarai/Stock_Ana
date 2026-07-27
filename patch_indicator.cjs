const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const targetStr = `   let match = null;
   if (type === 'RSI') {
      match = text.match(/RSI.*?(\\d+(\\.\\d+)?)/i);
   } else if (type === 'MACD') {
      match = text.match(/MACD.*?(-?\\d+(\\.\\d+)?)/i);
   }
   if (!match) {
      match = text.match(/(-?\\d+(\\.\\d+)?)/);
   }`;

const replacementStr = `   let match = null;
   if (type === 'RSI') {
      // Remove common period notations to avoid matching them
      const cleanText = text.replace(/RSI\\s*(?:\\(\\s*14\\s*\\)|14\\s*วัน)/gi, 'RSI');
      match = cleanText.match(/RSI.*?(\\d+(\\.\\d+)?)/i);
      // Fallback if RSI is not mentioned directly before the value
      if (!match) {
          const numbers = Array.from(cleanText.matchAll(/(-?\\d+(\\.\\d+)?)/g));
          if (numbers.length > 0) match = numbers[0];
      }
   } else if (type === 'MACD') {
      // Remove common MACD period notations like (12, 26, 9) or (12,26)
      const cleanText = text.replace(/MACD\\s*\\(\\s*12\\s*,\\s*26\\s*(?:,\\s*9\\s*)?\\)/gi, 'MACD');
      match = cleanText.match(/MACD.*?(-?\\d+(\\.\\d+)?)/i);
      if (!match) {
          const numbers = Array.from(cleanText.matchAll(/(-?\\d+(\\.\\d+)?)/g)).filter(m => !['12', '26', '9'].includes(m[1]));
          if (numbers.length > 0) match = numbers[0];
      }
   }
   if (!match) {
      match = text.match(/(-?\\d+(\\.\\d+)?)/);
   }`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched IndicatorVisualizer successfully.");
} else {
    console.log("Not found.");
}
