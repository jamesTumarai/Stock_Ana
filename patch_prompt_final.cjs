const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// 1. Update English technical prompt for key levels
content = content.replace(
  '2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. S1 and R1 must be closest to current price. CRITICAL: S1 and R1 MUST be AT LEAST 1x ATR away from current_price. NEVER set support/resistance closer than 1x ATR).',
  '2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. CRITICAL: Each S/R level MUST be at least 1x ATR away from the current price AND at least 1x ATR away from the next level. NEVER set them closer than this threshold. Skip to the next level if too close).'
);

// Update Thai technical prompt for key levels
content = content.replace(
  '2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ. สำคัญมาก: S1 และ R1 ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของ ATR (1x ATR) ห้ามตั้งใกล้กว่านี้เด็ดขาด. ต้องตรงกับที่วิเคราะห์ไว้ ห้ามใช้สูตรคำนวณแยก)',
  '2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (สำคัญมาก: แต่ละระดับ S/R ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของค่า ATR (1x ATR) และห่างจากระดับถัดไปอย่างน้อย 1x ATR เช่นกัน ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้เด็ดขาด หากพบว่าใกล้เกินไปให้ข้ามไปหาระดับถัดไปที่ห่างพอแทน ห้ามใช้สูตรคำนวณแยก)'
);
content = content.replace(
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (ต้องเรียงลำดับให้ S1 และ R1 อยู่ใกล้ราคาปัจจุบันที่สุดเสมอ. สำคัญมาก: S1 และ R1 ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของ ATR (1x ATR) ห้ามตั้งใกล้กว่านี้เด็ดขาด. และตัวเลขเหล่านี้ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure และ chart_patterns อย่างเคร่งครัด)',
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (สำคัญมาก: แต่ละระดับ S/R ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของค่า ATR (1x ATR) และห่างจากระดับถัดไปอย่างน้อย 1x ATR เช่นกัน ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้เด็ดขาด หากพบว่าใกล้เกินไปให้ข้ามไปหาระดับถัดไปที่ห่างพอแทน ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure อย่างเคร่งครัด)'
);

// 2. Add strict single-value rules to Trend & Momentum indicators (English)
content = content.replace(
  '7) trend_indicators: MA, MACD, ADX.',
  '7) trend_indicators: MA, MACD, ADX (CRITICAL: Indicators like MACD and ADX MUST be exact single current values, NOT ranges).'
);
content = content.replace(
  '8) momentum_indicators: RSI, Stochastic.',
  '8) momentum_indicators: RSI, Stochastic (CRITICAL: RSI and Stochastic MUST be exact single current values, NOT ranges).'
);

// Add strict single-value rules to Trend & Momentum indicators (Thai 1)
content = content.replace(
  '7) trend_indicators: MA, MACD, ADX\n',
  '7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)\n'
);
content = content.replace(
  '8) momentum_indicators: RSI, Stochastic\n',
  '8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)\n'
);

// 3. Update the global accuracy warning to specifically address the consecutive counting
content = content.replace(
  'When stating quantitative facts (like consecutive profitable quarters), double-check for absolute accuracy to avoid inconsistencies.',
  'When stating quantitative facts like "consecutive profitable quarters", YOU MUST BE ABSOLUTELY PRECISE. Count backward exactly from the latest available data. Do NOT guess or round numbers. If the exact consecutive count cannot be confirmed, state "Cannot confirm exact consecutive count" instead of providing an inaccurate number.'
);

fs.writeFileSync('server.ts', content);
console.log("Patched final issues");
