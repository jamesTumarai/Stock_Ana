const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replaceAll(
  '3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง เช่น ถ้าโซนเข้าซื้ออยู่สูงกว่าราคาปัจจุบัน ต้องเรียกว่า Breakout/Confirmation ไม่ใช่ Buy on Dip) (คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง เช่น ถ้าโซนเข้าซื้ออยู่สูงกว่าราคาปัจจุบัน ต้องเรียกว่า Breakout/Confirmation ไม่ใช่ Buy on Dip)',
  '3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio'
);

fs.writeFileSync('server.ts', code);
console.log("Fixed trade_plan duplicate");
