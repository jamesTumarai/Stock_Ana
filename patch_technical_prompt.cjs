const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Momentum Indicators (topic 8)
content = content.replace(
  /8\) momentum_indicators: RSI, Stochastic \(สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด\)/g,
  '8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด. ต้องวิเคราะห์ชัดเจนว่าเกิด Bullish/Bearish Divergence หรือไม่ หากไม่มีก็ต้องระบุให้ชัดเจนว่า "ไม่พบ Divergence")'
);

// Chart patterns (topic 10)
content = content.replace(
  /10\) chart_patterns: รูปแบบราคา/g,
  '10) chart_patterns: รูปแบบราคา (สำคัญ: ต้องวิเคราะห์ทั้ง Chart Pattern และ Candlestick Pattern เสมอ หากไม่พบรูปแบบที่ชัดเจนให้ระบุว่า "ไม่พบรูปแบบที่ชัดเจน" ห้ามข้ามหรือละเว้นเด็ดขาด)'
);

// Technical conditions
content = content.replace(
  /15\) final_verdict_summary: สรุปสุดท้าย\n          เงื่อนไขสำคัญ:/g,
  '15) final_verdict_summary: สรุปสุดท้าย\n          เงื่อนไขสำคัญ:\n          - CRITICAL: สำหรับการวิเคราะห์ทางเทคนิค ต้องตอบให้ครบทุกหัวข้อ (1-15) และหัวข้อย่อย ห้ามข้ามหรือละเว้นเด็ดขาด หากไม่พบสัญญาณใด (เช่น ไม่มี Divergence, ไม่มี Candlestick pattern) ให้ระบุให้ชัดเจนว่า "ไม่พบสัญญาณในขณะนี้" แทนการเว้นว่าง'
);

fs.writeFileSync('server.ts', content);
console.log('Patched technical prompt rules');
