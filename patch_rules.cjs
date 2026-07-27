const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  '15) final_verdict_summary: สรุปสุดท้าย`;',
  '15) final_verdict_summary: สรุปสุดท้าย\n          เงื่อนไขสำคัญ:\n          - การวิเคราะห์ Technical ต้องอยู่บนพื้นฐานของราคา ปริมาณการซื้อขาย และอินดิเคเตอร์ทางเทคนิคเท่านั้น ห้ามอ้างอิงหรือดึงเนื้อหาจากเอกสารพื้นฐาน เช่น 10-K, 10-Q, annual report, business model, moat, หรือความเสี่ยงเชิงเครดิต มาปนในรายงานนี้เด็ดขาด`;'
);

content = content.replace(
  '- ระวังอคติจากฝั่งผู้บริหาร (management bias)',
  '- ระวังอคติจากฝั่งผู้บริหาร (management bias)\n          - ส่วน Technical Analysis ต้องอยู่บนพื้นฐานของราคา ปริมาณการซื้อขาย และอินดิเคเตอร์เท่านั้น ห้ามดึงเนื้อหา Fundamental (เช่น 10-K, moat, credit risk) มาปนในส่วน Technical เด็ดขาด'
);

fs.writeFileSync('server.ts', content);
console.log("Patched rules");
