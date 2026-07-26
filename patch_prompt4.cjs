const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// For business strengths
content = content.replace(
  '6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย',
  '6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

// For future growth
content = content.replace(
  '7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน',
  '7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

// For key risks
content = content.replace(
  '8) ความเสี่ยงที่ต้องรู้ (for key_risks): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution/SBC (ต้องยาว 3-5 ประโยค)',
  '8) ความเสี่ยงที่ต้องรู้ (for key_risks): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution/SBC (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

// For Thai technical analysis top level? No, this is for fundamental. Let's check English as well.
// English fundamental
content = content.replace(
  '6) business_strengths: Moat, advantages vs competitors.',
  '6) business_strengths: Moat, advantages vs competitors. (CRITICAL: Use Markdown bullet points / numbered lists, one per line).'
);

content = content.replace(
  '7) future_growth: Catalysts, growth drivers in 6-12 months.',
  '7) future_growth: Catalysts, growth drivers in 6-12 months. (CRITICAL: Use Markdown bullet points / numbered lists, one per line).'
);

content = content.replace(
  '8) key_risks: Competition, macro, regulation, valuation, SBC (3-5 sentences).',
  '8) key_risks: Competition, macro, regulation, valuation, SBC (CRITICAL: Use Markdown bullet points / numbered lists, one per line).'
);

// We should also patch the both analysis part
content = content.replace(
  '6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย',
  '6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

content = content.replace(
  '7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน',
  '7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

content = content.replace(
  '8) ความเสี่ยงที่ต้องรู้ (for key_risks): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution/SBC (ต้องยาว 3-5 ประโยค)',
  '8) ความเสี่ยงที่ต้องรู้ (for key_risks): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution/SBC (สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points / numbered lists เรียงลงมาทีละบรรทัด)'
);

fs.writeFileSync('server.ts', content);
console.log("Patched prompt4");
