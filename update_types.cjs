const fs = require('fs');

let types = fs.readFileSync('src/types.ts', 'utf8');
types = types.replaceAll('stock_price_4m', 'stock_price_history');
fs.writeFileSync('src/types.ts', types);

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replaceAll('stock_price_4m', 'stock_price_history');
fs.writeFileSync('src/App.tsx', app);

let report = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');
report = report.replaceAll('data.financial_charts.stock_price_4m', 'data.financial_charts.stock_price_history');
fs.writeFileSync('src/ReportTemplate.tsx', report);

console.log("Updated types and files.");
