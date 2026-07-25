const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Replace key_levels
code = code.replaceAll(
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข',
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ)'
);

// Replace ATR
code = code.replaceAll(
  '9) volatility_indicators: Bollinger Bands, ATR',
  '9) volatility_indicators: Bollinger Bands, ATR (ระวังอย่าให้ค่า ATR และ MACD สลับกันหรือซ้ำกัน)'
);

// Replace Fundamental 1
code = code.replaceAll(
  '4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม P/E หรือ Valuation ปัจจุบัน เทียบกับคู่แข่งหรืออุตสาหกรรมด้วย เช็ค dilution/SBC (ต้องยาว 3-5 ประโยคเฉพาะเจาะจง)',
  '4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้พูดถึงสภาพคล่องและเงินกองทุนแทน แต่ห้ามข้ามเด็ดขาด) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (ยาว 3-5 ประโยค)'
);

// Replace Fundamental 2 (with typo)
code = code.replaceAll(
  '4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หหนี้เยอะไหม P/E หรือ Valuation ปัจจุบัน เทียบกับคู่แข่งหรืออุตสาหกรรมด้วย เช็ค dilution/SBC (ต้องยาว 3-5 ประโยคเฉพาะเจาะจง)',
  '4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้พูดถึงสภาพคล่องและเงินกองทุนแทน แต่ห้ามข้ามเด็ดขาด) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (ยาว 3-5 ประโยค)'
);

// Replace conditions
code = code.replaceAll(
  '- แต่ละหัวข้อต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ ถ้าหาไม่ได้ให้ระบุว่า "ไม่พบข้อมูลนี้ในเอกสารที่มี"',
  '- แต่ละหัวข้อต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ ถ้าหาไม่ได้ให้ระบุว่า "ไม่พบข้อมูลนี้ในเอกสารที่มี" (โดยเฉพาะส่วนที่ถามถึง Cash Flow และ Debt ห้ามข้ามเด็ดขาด)'
);

fs.writeFileSync('server.ts', code);
console.log("Replaced!");
