const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const newInstruction = `\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมดจากหัวข้อข้างต้น ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, MACD = ลบ, RSI = กลาง" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน เพื่อให้ตรวจสอบย้อนกลับได้ จากนั้นสรุปทิศทางรวม และระบุ Invalidation level)
          2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ ห้ามให้ระดับใกล้กันเกินไป ต้องห่างกันอย่างมีนัยสำคัญเทียบกับ ATR และต้องตรงกับที่วิเคราะห์ไว้ ห้ามใช้สูตรคำนวณแยก)
          3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ ไม่ใช่มั่ว), stop loss, target 1, target 2, และ Risk/Reward ratio
          4) overall_trend: อธิบายภาพรวม
          5) price_structure: โครงสร้างราคา
          6) volume_analysis: วิเคราะห์ Volume
          7) trend_indicators: MA, MACD, ADX
          8) momentum_indicators: RSI, Stochastic
          9) volatility_indicators: Bollinger Bands, ATR (ระบุ ATR เป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง)
          10) chart_patterns: รูปแบบราคา
          11) relative_strength: เทียบกับตลาด
          12) technical_risks: ความเสี่ยง (เช่น false breakout, gap risk, volume ต่ำ)
          13) beginner_summary: สรุปให้มือใหม่ตัดสินใจแบบตรงไปตรงมา:
           - technical_overview: ภาพรวมเทคนิคอลตอนนี้เป็นแบบไหนในภาษาคนทั่วไป
           - top_3_points: จุดที่น่าสนใจ 3 ข้อ
           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ
           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน (เช่น day/swing/position trade ต้องสอดคล้องกับแผนเข้าจริง ถ้าโซนเข้าซื้ออยู่สูงกว่าปัจจุบัน ห้ามเรียกว่า Buy on Dip เด็ดขาด)
          14) scoring: คะแนน 1-10 พร้อมเหตุผล
          15) final_verdict_summary: สรุปสุดท้าย`;

content = content.replace(/CRITICAL: You MUST write ALL string values in the JSON output in Thai language.*?15\) final_verdict_summary: สรุปสุดท้าย/s, newInstruction);

// Also add current_price to the schema
content = content.replace(/"key_levels": \{[\s\S]*?"support"/, `"key_levels": {\n       "current_price": 150.5,\n       "support"`);

fs.writeFileSync('server.ts', content);
