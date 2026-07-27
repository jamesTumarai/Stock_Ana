const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Thai technical only
code = code.replace(
  /3\) trade_plan: แผนการเทรด โซนเข้า \(ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ ไม่ใช่มั่ว\), stop loss, target 1, target 2, และ Risk\/Reward ratio/,
  "3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ ไม่ใช่มั่ว), stop loss, target 1, target 2, และ Risk/Reward ratio (คำนวณ risk/reward ratio จากจุดเข้า-stop-target โดยใช้ตัวเลขเดียวกันเป๊ะกับ Target 1/Target 2 ห้ามใช้ตัวเลขคนละตัวในการคำนวณ ให้ใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ด้วย)"
);

// English technical only
code = code.replace(
  /3\) trade_plan: entry_zone \(Numeric\. If lower than current price, it's a buy on dip\), stop_loss, target_1, target_2, risk_reward_ratio\./,
  "3) trade_plan: entry_zone (Numeric. If lower than current price, it's a buy on dip), stop_loss, target_1, target_2, risk_reward_ratio (Calculate Risk/Reward ratio using EXACTLY the same numbers specified in Target 1/Target 2. Do NOT use different numbers. Use the formula (Target - Entry) / (Entry - Stop-Loss) and show the numbers used in the calculation)."
);

// Thai combined
code = code.replace(
  /3\) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk\/Reward ratio \(คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง เช่น ถ้าโซนเข้าซื้ออยู่สูงกว่าราคาปัจจุบัน ต้องเรียกว่า Breakout\/Confirmation ไม่ใช่ Buy on Dip\)/,
  "3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (คำนวณ risk/reward ratio จากจุดเข้า-stop-target โดยใช้ตัวเลขเดียวกันเป๊ะกับ Target 1/Target 2 ห้ามใช้ตัวเลขคนละตัวในการคำนวณ ให้ใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ด้วย คำแนะนำสไตล์เทรดต้องสอดคล้องกับแผนเข้าจริง)"
);

// English combined
code = code.replace(
  /3\) trade_plan: entry_zone, stop_loss, target_1, target_2, risk_reward_ratio \(Trading style recommendation MUST match the actual entry plan\)/,
  "3) trade_plan: entry_zone, stop_loss, target_1, target_2, risk_reward_ratio (Calculate Risk/Reward ratio using EXACTLY the same numbers specified in Target 1/Target 2. Do NOT use different numbers. Use the formula (Target - Entry) / (Entry - Stop-Loss) and show the numbers used in the calculation. Trading style recommendation MUST match the actual entry plan)"
);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts successfully.");
