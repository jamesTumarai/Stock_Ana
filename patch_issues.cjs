const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// 1. Technical Indicators MUST NOT BE RANGES
content = content.replace(
  'You MUST provide HIGHLY DETAILED, EXTREMELY IN-DEPTH analysis for every field.',
  'CRITICAL: ALL technical indicator values (RSI, MACD, ADX, ATR, etc.) MUST be exact single current values. DO NOT report them as ranges (e.g., 35-42 is FORBIDDEN). When stating quantitative facts (like consecutive profitable quarters), double-check for absolute accuracy to avoid inconsistencies.\n          You MUST provide HIGHLY DETAILED, EXTREMELY IN-DEPTH analysis for every field.'
);

// 2. Key Levels ATR Distance (Thai - Technical Prompt)
content = content.replace(
  '2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ ห้ามให้ระดับใกล้กันเกินไป ต้องห่างกันอย่างมีนัยสำคัญเทียบกับ ATR และต้องตรงกับที่วิเคราะห์ไว้ ห้ามใช้สูตรคำนวณแยก)',
  '2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ. สำคัญมาก: S1 และ R1 ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของ ATR (1x ATR) ห้ามตั้งใกล้กว่านี้เด็ดขาด. ต้องตรงกับที่วิเคราะห์ไว้ ห้ามใช้สูตรคำนวณแยก)'
);

// English - Technical Prompt
content = content.replace(
  '2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. S1 and R1 must be closest to current price. Must not be too close to each other, use ATR for significance).',
  '2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. S1 and R1 must be closest to current price. CRITICAL: S1 and R1 MUST be AT LEAST 1x ATR away from current_price. NEVER set support/resistance closer than 1x ATR).'
);

// Both - Technical Prompt
content = content.replace(
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ และตัวเลขเหล่านี้ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure และ chart_patterns อย่างเคร่งครัด ห้ามใช้สูตรคำนวณแยก)',
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ. สำคัญมาก: S1 และ R1 ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของ ATR (1x ATR) ห้ามตั้งใกล้กว่านี้เด็ดขาด. และตัวเลขเหล่านี้ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure และ chart_patterns อย่างเคร่งครัด)'
);

// Remove specific ATR range instruction since we added the global one
content = content.replace(
  '9) volatility_indicators: Bollinger Bands, ATR (ระบุ ATR เป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง)',
  '9) volatility_indicators: Bollinger Bands, ATR'
);
content = content.replace(
  '9) volatility_indicators: Bollinger Bands, ATR (Single value, not a range).',
  '9) volatility_indicators: Bollinger Bands, ATR'
);

fs.writeFileSync('server.ts', content);
console.log("Patched issues");
