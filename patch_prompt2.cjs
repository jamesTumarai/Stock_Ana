const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  'ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, MACD = ลบ, RSI = กลาง" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน เพื่อให้ตรวจสอบย้อนกลับได้ จากนั้นสรุปทิศทางรวม และระบุ Invalidation level)',
  'ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, MACD = ลบ, RSI = กลาง" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points (ขึ้นบรรทัดใหม่แต่ละข้อ) เพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level)'
);

content = content.replace(
  'List signals one by one whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, MACD = Negative, RSI = Neutral", do not just sum them up. Then summarize the direction and invalidation level).',
  'List signals one by one using Markdown bullet points (one per line) whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, MACD = Negative, RSI = Neutral", do not just sum them up. Then summarize the direction and invalidation level).'
);

fs.writeFileSync('server.ts', content);
console.log("Patched prompt2");
