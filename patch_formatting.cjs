const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Thai - Fundamental (Combined and Fundamental-only)
content = content.replace(
  /1\) บริษัทนี้ทำธุรกิจอะไร \(for business_overview\): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ/g,
  `1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)`
);

content = content.replace(
  /2\) ลูกค้าของบริษัทคือใคร \(for target_customers\): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ/g,
  `2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)`
);

content = content.replace(
  /3\) โมเดลรายได้และคุณภาพรายได้ \(for revenue_model\): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี/g,
  `3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)`
);

content = content.replace(
  /4\) ภาพรวมงบการเงินล่าสุด \(for financial_overview\): รายได้\/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม \(หากเป็นธนาคาร\/สถาบันการเงิน ให้พูดถึงสภาพคล่องและเงินกองทุนแทน แต่ห้ามข้ามเด็ดขาด\) P\/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution\/SBC \(ยาว 3-5 ประโยค\)/g,
  `4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้พูดถึงสภาพคล่องและเงินกองทุนแทน แต่ห้ามข้ามเด็ดขาด) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)`
);

content = content.replace(
  /4\) ภาพรวมงบการเงินล่าสุด \(for financial_overview\): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประโยค รายได้\/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม \(หากเป็นธนาคาร\/สถาบันการเงิน ให้ใช้ ROE, NIM, อัตราส่วนเงินฝากต่อสินเชื่อแทน\) P\/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution\/SBC/g,
  `4) ภาพรวมงบการเงินล่าสุด (for financial_overview): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประเด็น รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้ใช้ ROE, NIM, อัตราส่วนเงินฝากต่อสินเชื่อแทน) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)`
);

// Thai - Technical - Trade Plan
content = content.replace(
  /3\) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk\/Reward ratio \(CRITICAL: ต้องคำนวณ risk\/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร \(Target - Entry\) \/ \(Entry - Stop-Loss\) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า\)/g,
  `3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown bullet points แยกบรรทัดกันชัดเจน เพื่อให้อ่านง่าย)`
);

content = content.replace(
  /3\) trade_plan: แผนการเทรด โซนเข้า \(ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ\), stop loss, target 1, target 2, และ Risk\/Reward ratio \(CRITICAL: ต้องคำนวณ risk\/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร \(Target - Entry\) \/ \(Entry - Stop-Loss\) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า\)/g,
  `3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ), stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown bullet points แยกบรรทัดกันชัดเจน เพื่อให้อ่านง่าย)`
);

// English - Technical - Trade Plan
content = content.replace(
  /3\) trade_plan: entry_zone \(Numeric\), stop_loss, target_1, target_2, risk_reward_ratio \(CRITICAL: You MUST calculate and display the Risk\/Reward ratio for BOTH Target 1 and Target 2 separately\. Use the formula \(Target - Entry\) \/ \(Entry - Stop-Loss\) and show the exact numbers used for both calculations\)\./g,
  `3) trade_plan: entry_zone (Numeric), stop_loss, target_1, target_2, risk_reward_ratio (CRITICAL: You MUST calculate and display the Risk/Reward ratio for BOTH Target 1 and Target 2 separately. Use the formula (Target - Entry) / (Entry - Stop-Loss) and show the exact numbers used for both calculations. You MUST format the R:R calculations as clearly separated Markdown bullet points for readability).`
);

// English - Fundamental
content = content.replace(
  /CRITICAL REQUIREMENTS:/g,
  `CRITICAL REQUIREMENTS:\n          - Format "business_overview", "target_customers", "revenue_model", and "financial_overview" fields as Markdown bullet points "-" for readability. Do NOT write single long paragraphs.`
);


fs.writeFileSync('server.ts', content);
console.log("Formatting instructions updated successfully!");
