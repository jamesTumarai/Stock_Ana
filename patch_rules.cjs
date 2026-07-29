const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// The goal is to replace the "Please follow this specific Fundamental Analysis guideline..." section in BOTH the fundamental block and the combined block.
// Since the prompt text is basically identical, we can use a regex to replace it.

const regex = /Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":([\s\S]*?)(?=10\) สรุปให้มือใหม่ตัดสินใจ \(for beginner_summary\):)/g;

const replacement = `Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประโยค รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้ใช้ ROE, NIM, อัตราส่วนเงินฝากต่อสินเชื่อแทน) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC
          5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a markdown bulleted list to assess these 8 areas in detail: 1.รายได้โตจริงไหม 2.กำไรโตตามไหม 3.กระแสเงินสด 4.หนี้สินน่ากังวลไหม 5.Margin 6.ROIC/ROE/ROA 7.โอกาสโตต่อ 8.สรุปฟันธงว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"
          6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร ของจริงหรือแค่ story ช่วยยกตัวอย่างคู่แข่งหลัก 1-2 ราย และบอกว่าบริษัทนี้เหนือกว่าหรือด้อยกว่าคู่แข่งตรงไหน
          7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน
          8) ความเสี่ยงที่ต้องรู้ (for key_risks): CRITICAL: คุณต้องตอบให้ครบทั้ง 8 หมวดต่อไปนี้ ห้ามข้ามเด็ดขาด แต่ละหมวดต้องเขียนอย่างน้อย 2-3 ประโยคพร้อมตัวเลขรองรับ: 1.การแข่งขัน 2.ลูกค้ากระจุกตัว 3.กฎระเบียบ 4.เศรษฐกิจ 5.margin ลด 6.valuation แพงเกินไป 7.ความเสี่ยงที่มือใหม่มักมองข้าม 8.การลดสัดส่วนผู้ถือหุ้น (dilution)/SBC
          9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประโยค ตอบให้ครบ: ผู้บริหารเก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม, สัดส่วน insider ownership ต้องระบุเป็น % ตัวเลขจริง (ถ้าไม่พบให้เขียน "ไม่พบข้อมูลสัดส่วนการถือหุ้นผู้บริหารในเอกสารที่มี"), insider buying/selling, การจัดสรรเงินทุน (capital allocation) เช่น M&A/ซื้อหุ้นคืน, ตรวจสอบคำพูดผู้บริหารแบบตั้งคำถาม (critical) ว่าเคยพลาดเป้าจาก guidance ไหม
          `;

content = content.replace(regex, replacement);

const regexConditions = /เงื่อนไขสำคัญ:([\s\S]*?)(?=`;)/g;
const replacementConditions = `เงื่อนไขสำคัญ:
          - อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง", "เติบโตดี" โดยไม่มีตัวเลขหรือข้อเท็จจริงเฉพาะเจาะจงรองรับ ทุกประโยคต้องมีตัวเลขจริงกำกับ เช่น "รายได้เติบโต 24% YoY"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ โดยเฉพาะ dilution/SBC, insider ownership, capital allocation, การเทียบกับคู่แข่ง
          - หัวข้อ 4 (งบการเงิน), 8 (ความเสี่ยง), 9 (ผู้บริหาร) ต้องมีความยาวอย่างน้อย 3-5 ประโยคที่มีเนื้อหาเฉพาะเจาะจงต่อ bullet ห้ามสรุปทั้งหัวข้อด้วยประโยคเดียว
          - ระวังอคติจากฝั่งผู้บริหาร (management bias) 
          - ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี) กำกับตัวเลขสำคัญ
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;

content = content.replace(regexConditions, replacementConditions);

fs.writeFileSync('server.ts', content);
console.log('Patched fundamental rules');
