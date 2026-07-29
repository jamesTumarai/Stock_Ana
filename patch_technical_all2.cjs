const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /2\) key_levels: current_price \(ราคาปัจจุบันเป็นตัวเลข\), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข \(สำคัญมาก: แต่ละระดับ S\/R ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของค่า ATR \(1x ATR\) และห่างจากระดับถัดไปอย่างน้อย 1x ATR เช่นกัน ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้เด็ดขาด หากพบว่าใกล้เกินไปให้ข้ามไปหาระดับถัดไปที่ห่างพอแทน ห้ามใช้สูตรคำนวณแยก\)/g,
  '2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน ห้ามใช้สูตรคำนวณแยก)'
);

content = content.replace(
  /2\) key_levels: current_price \(numeric\), support 3 levels, resistance 3 levels \(Numeric\. CRITICAL: Each S\/R level MUST be at least 1x ATR away from the current price AND at least 1x ATR away from the next level\. NEVER set them closer than this threshold\. Skip to the next level if too close\)\./g,
  '2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. CRITICAL RULE: Each S/R level MUST be at least 1.5x ATR away from the current price to avoid noise AND at least 1x ATR away from the next level. NEVER set them closer than this threshold. Skip to the next major level if too close).'
);

fs.writeFileSync('server.ts', content);
console.log('Patched all key_levels');
