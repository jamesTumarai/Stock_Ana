const fs = require('fs');
let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

code = code.replace(
  'subtext={isThai ? "แผนภูมินี้แสดงราคาปิดย้อนหลังสี่เดือนในวันซื้อขายสุดท้าย" : "This chart shows the closing price for the past four months on the last trading date."}',
  'subtext={isThai ? "แผนภูมินี้แสดงราคาปิดย้อนหลังรายสัปดาห์ในวันซื้อขายสุดท้าย" : "This chart shows the weekly closing price for the past few weeks."}'
);

code = code.replace(
  'data={data.financial_charts.stock_price_4m ? [...data.financial_charts.stock_price_4m] : []}',
  'data={(data.financial_charts.stock_price_history || data.financial_charts.stock_price_4m) ? [...(data.financial_charts.stock_price_history || data.financial_charts.stock_price_4m)] : []}'
);

fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("Updated ReportTemplate.tsx");
