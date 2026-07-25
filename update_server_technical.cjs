const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update 1: signal_summary
code = code.replace(
  '1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ)',
  '1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ โดยต้องระบุรายละเอียดของสัญญาณบวก ลบ ให้ชัดเจนว่ามีอะไรบ้าง ห้ามใส่แค่ตัวเลข)'
);

// Update 2: key_levels
code = code.replace(
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ)',
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ และตัวเลขเหล่านี้ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure และ chart_patterns อย่างเคร่งครัด ห้ามใช้สูตรคำนวณแยก)'
);

// Update 3: trade_plan
code = code.replace(
  '3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio',
  '3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง เช่น ถ้าโซนเข้าซื้ออยู่สูงกว่าราคาปัจจุบัน ต้องเรียกว่า Breakout/Confirmation ไม่ใช่ Buy on Dip)'
);

fs.writeFileSync('server.ts', code);
console.log("Updated technical instructions in server.ts");
