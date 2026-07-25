const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace schema examples
code = code.replaceAll('"stock_price_4m"', '"stock_price_history"');
code = code.replaceAll('stock_price_4m', 'stock_price_history');
code = code.replaceAll('past 4 months of stock prices. For each month, give the closing price on the last trading day of the month.', 'past 12 weeks of stock prices. For each week, give the closing price on the last trading day of the week.');
code = code.replaceAll('exactly 4 data points', 'exactly 12 data points');
code = code.replaceAll('oldest month to the newest month', 'oldest week to the newest week');

fs.writeFileSync('server.ts', code);
console.log("Updated to weekly data.");
