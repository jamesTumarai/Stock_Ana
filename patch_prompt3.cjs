const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  'ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, RSI = บวก" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่ถ้าหลุด/break จะทำให้มุมมองเปลี่ยนไป)',
  'ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, RSI = บวก" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points (ขึ้นบรรทัดใหม่แต่ละข้อ) เพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่ถ้าหลุด/break จะทำให้มุมมองเปลี่ยนไป)'
);

content = content.replace(
  'List signals one by one whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, RSI = Positive", do not just sum them up. Then summarize the direction and invalidation level (price level that invalidates this setup)).',
  'List signals one by one using Markdown bullet points (one per line) whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, RSI = Positive", do not just sum them up. Then summarize the direction and invalidation level (price level that invalidates this setup)).'
);

fs.writeFileSync('server.ts', content);
console.log("Patched prompt3");
