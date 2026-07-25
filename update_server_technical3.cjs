const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update 1: signal_summary confluence
code = code.replaceAll(
  '1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ โดยต้องระบุรายละเอียดของสัญญาณบวก ลบ ให้ชัดเจนว่ามีอะไรบ้าง ห้ามใส่แค่ตัวเลข)',
  '1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมดจากหัวข้อข้างต้น ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, RSI = บวก" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่ถ้าหลุด/break จะทำให้มุมมองเปลี่ยนไป)'
);

// Update 13: beginner_summary
code = code.replaceAll(
  '13) beginner_summary: บทสรุปสำหรับมือใหม่',
  '13) beginner_summary: สรุปให้มือใหม่ตัดสินใจแบบตรงไปตรงมา:\n           - technical_overview: ภาพรวมเทคนิคอลตอนนี้เป็นแบบไหนในภาษาคนทั่วไป\n           - top_3_points: จุดที่น่าสนใจ 3 ข้อ\n           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ\n           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน (เช่น day/swing/position trade ต้องสอดคล้องกับแผนเข้าจริง ถ้าโซนเข้าซื้ออยู่สูงกว่าปัจจุบัน ห้ามเรียกว่า Buy on Dip เด็ดขาด)'
);

fs.writeFileSync('server.ts', code);
console.log("Updated technical instructions in server.ts");
