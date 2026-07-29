const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// For line 338 / 512: fundamentals_check
content = content.replace(
    /5\) เช็คคุณภาพพื้นฐานแบบง่าย \(for fundamentals_check\): ประเมินรายได้\/กำไร\/กระแสเงินสด\/หนี้\/margin\/ROIC\/โอกาสโตต่อ และสรุปว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"/g,
    '5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a markdown bulleted list to assess these 8 areas in detail: 1.รายได้โตจริงไหม 2.กำไรโตตามไหม 3.กระแสเงินสด 4.หนี้สินน่ากังวลไหม 5.Margin 6.ROIC/ROE/ROA 7.โอกาสโตต่อ 8.สรุปฟันธงว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"'
);

// For line 341 / 515: key_risks
content = content.replace(
    /8\) ความเสี่ยงที่ต้องรู้ \(for key_risks\): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution\/SBC \(สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points \/ numbered lists เรียงลงมาทีละบรรทัด\)/g,
    '8) ความเสี่ยงที่ต้องรู้ (for key_risks): CRITICAL: You MUST cover at least 8 risk categories (including competition, customer concentration, regulatory, economic, margin, valuation, dilution/SBC, and hidden risks for beginners). EACH bullet MUST contain at least 3-5 sentences of detailed explanation. DO NOT write single-sentence bullets. (ใช้ Markdown bullet points)'
);

// For line 342 / 516: management
content = content.replace(
    /9\) ผู้บริหารและการเล่าเรื่องของบริษัท \(for management\): เก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม insider ownership\/buying capital allocation \(M&A, ซื้อหุ้นคืน\) การทำตาม guidance \(ต้องยาว 3-5 ประโยค\)/g,
    '9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management): เก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม insider ownership/buying capital allocation (M&A, ซื้อหุ้นคืน) การทำตาม guidance (ต้องยาว 3-5 ประโยค). CRITICAL: For insider ownership, you MUST provide the exact numerical percentage (%). DO NOT use vague adjectives without real numbers.'
);

fs.writeFileSync('server.ts', content);
console.log("Patched server.ts successfully.");
