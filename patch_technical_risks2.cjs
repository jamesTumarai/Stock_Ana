const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const thaiReplacement = `12) technical_risks: ความเสี่ยงเชิงเทคนิคที่ต้องรู้ (ต้องตอบให้ครบ 4 ประเด็นนี้: 1. ความเสี่ยงจากสัญญาณหลอก (false breakout/whipsaw), 2. gap risk (เช่น ข่าว/earnings ถัดไป), 3. ความเสี่ยงจาก volume/liquidity ต่ำ, 4. regime ปัจจุบัน (trending หรือ choppy/sideways) ห้ามตอบแค่ข้อเดียวแล้วข้ามข้ออื่น)`;

code = code.replace(/12\) technical_risks: ความเสี่ยง(?!เชิง)/g, thaiReplacement);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts again');
