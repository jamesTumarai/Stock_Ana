const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const thaiReplacement = `12) technical_risks: ความเสี่ยงเชิงเทคนิคที่ต้องรู้ (ต้องตอบให้ครบ 4 ประเด็นนี้: 1. ความเสี่ยงจากสัญญาณหลอก (false breakout/whipsaw), 2. gap risk (เช่น ข่าว/earnings ถัดไป), 3. ความเสี่ยงจาก volume/liquidity ต่ำ, 4. regime ปัจจุบัน (trending หรือ choppy/sideways) ห้ามตอบแค่ข้อเดียวแล้วข้ามข้ออื่น)`;

const englishReplacement = `12) technical_risks: Technical risks (MUST cover all 4 types: 1. False breakout/whipsaw risk, 2. Gap risk e.g., upcoming earnings/news, 3. Low volume/liquidity risk, 4. Current market regime trending vs choppy/sideways. Do not skip any of these 4.)`;

code = code.replace(/12\) technical_risks: ความเสี่ยง \(เช่น false breakout, gap risk, volume ต่ำ\)/g, thaiReplacement);
code = code.replace(/12\) technical_risks: Risks \(false breakout, gap risk, low volume\)\./g, englishReplacement);
code = code.replace(/12\) technical_risks: ความเสี่ยง\b/g, thaiReplacement);

// Just to be sure, let's also check if there's any other "12) technical_risks: ความเสี่ยง" in the file.

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts with expanded technical risks');
