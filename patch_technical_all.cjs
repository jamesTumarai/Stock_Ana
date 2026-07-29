const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Thai - Trade plan
content = content.replace(
  /3\) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk\/Reward ratio \(คำนวณ risk\/reward ratio จากจุดเข้า-stop-target โดยใช้ตัวเลขเดียวกันเป๊ะกับ Target 1\/Target 2 ห้ามใช้ตัวเลขคนละตัวในการคำนวณ ให้ใช้สูตร \(Target - Entry\) \/ \(Entry - Stop-Loss\) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ด้วย คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง\)/g,
  '3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า)'
);
content = content.replace(
  /3\) trade_plan: แผนการเทรด โซนเข้า \(ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ ไม่ใช่มั่ว\), stop loss, target 1, target 2, และ Risk\/Reward ratio \(คำนวณ risk\/reward ratio จากจุดเข้า-stop-target โดยใช้ตัวเลขเดียวกันเป๊ะกับ Target 1\/Target 2 ห้ามใช้ตัวเลขคนละตัวในการคำนวณ ให้ใช้สูตร \(Target - Entry\) \/ \(Entry - Stop-Loss\) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ด้วย\)/g,
  '3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ), stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า)'
);

// English - Trade plan
content = content.replace(
  /3\) trade_plan: entry_zone \(Numeric. If lower than current price, it's a buy on dip\), stop_loss, target_1, target_2, risk_reward_ratio \(Calculate Risk\/Reward ratio using EXACTLY the same numbers specified in Target 1\/Target 2\. Do NOT use different numbers\. Use the formula \(Target - Entry\) \/ \(Entry - Stop-Loss\) and show the numbers used in the calculation\)\./g,
  '3) trade_plan: entry_zone (Numeric), stop_loss, target_1, target_2, risk_reward_ratio (CRITICAL: You MUST calculate and display the Risk/Reward ratio for BOTH Target 1 and Target 2 separately. Use the formula (Target - Entry) / (Entry - Stop-Loss) and show the exact numbers used for both calculations).'
);


// Thai - Key levels
content = content.replace(
  /2\) key_levels: แนวรับ \(support\) 3 ระดับ, แนวต้าน \(resistance\) 3 ระดับ เป็นตัวเลข \(สำคัญมาก: แต่ละระดับ S\/R ต้องห่างจากราคาปัจจุบันอย่างน้อย 1 เท่าของค่า ATR \(1x ATR\) และห่างจากระดับถัดไปอย่างน้อย 1x ATR เช่นกัน ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้เด็ดขาด หากพบว่าใกล้เกินไปให้ข้ามไปหาระดับถัดไปที่ห่างพอแทน ต้องตรงกับที่วิเคราะห์ไว้ใน price_structure อย่างเคร่งครัด\)/g,
  '2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน)'
);

// English - Key levels
content = content.replace(
  /2\) key_levels: Support \(3 levels\), Resistance \(3 levels\) as numeric values \(CRITICAL: Each S\/R level MUST be at least 1x ATR away from the current price, and at least 1x ATR away from the next level\. Do NOT provide levels closer than this\. If a level is too close, skip to the next significant level that meets the criteria\)/g,
  '2) key_levels: Support (3 levels), Resistance (3 levels) as numeric values (CRITICAL RULE: Each S/R level MUST be at least 1.5x ATR away from the current price to avoid noise, and at least 1x ATR away from each other. Do NOT provide levels closer than this. If a level is too close, skip to the next major level that meets this strict criteria).'
);

fs.writeFileSync('server.ts', content);
console.log('Patched R:R and ATR criteria');
