const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /8\) momentum_indicators: RSI, Stochastic \(สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด\. ต้องวิเคราะห์ชัดเจนว่าเกิด Bullish\/Bearish Divergence หรือไม่ หากไม่มีก็ต้องระบุให้ชัดเจนว่า "ไม่พบ Divergence"\)/g,
  '8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง. CRITICAL: คุณต้องระบุชัดเจน 2 เรื่อง: 1. มี Bullish/Bearish Divergence หรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Divergence") 2. มี Candlestick pattern กลับตัวหรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Candlestick pattern ที่ชัดเจน"))'
);

content = content.replace(
  /8\) momentum_indicators: RSI, Stochastic \(CRITICAL: RSI and Stochastic MUST be exact single current values, NOT ranges\. You MUST also clearly state whether there is any Bullish\/Bearish Divergence\. If there is none, explicitly state "No divergence observed"\)/g,
  '8) momentum_indicators: RSI, Stochastic (CRITICAL: RSI and Stochastic MUST be single current values. You MUST explicitly state two things: 1. Is there Bullish/Bearish Divergence? (If no, print "No Divergence observed"). 2. Is there a reversal Candlestick pattern? (If no, print "No clear Candlestick pattern observed")).'
);

fs.writeFileSync('server.ts', content);
console.log('Patched technical consistency in server.ts');
