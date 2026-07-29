const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// 1. Fix Chinese restriction
content = content.replace(
  /STRICTLY FORBIDDEN to use Japanese \(e\.g\., Katakana like ゾーン\), Chinese, or any other languages\./g,
  "STRICTLY FORBIDDEN to use Japanese, Chinese (e.g., 鏈, 網, 幣), or any other languages. YOU MUST REMOVE ALL CHINESE CHARACTERS."
);

// 2. Fix fundamentals_check instruction to use NUMBERED list instead of bulleted list
content = content.replace(
  /You MUST use a markdown bulleted list to assess these 8 areas in detail:/g,
  "You MUST use a Markdown NUMBERED list (1., 2., 3.) to assess these 8 areas in detail, using '\\n\\n' to separate each point. DO NOT use bullets ('- ') before the numbers:"
);

// 3. Fix the duplicated instructions on 6) and 7)
content = content.replace(
  /\(สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown numbered lists เรียงลงมาทีละบรรทัด โดยเริ่มด้วย "1\. ", "2\. " เป็นต้น ห้ามใส่ขีด "-" ไว้หน้าตัวเลขเด็ดขาด \(ห้ามใช้ "- 1\."\)\) \(สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown numbered lists เรียงลงมาทีละบรรทัด โดยเริ่มด้วย "1\. ", "2\. " เป็นต้น ห้ามใส่ขีด "-" ไว้หน้าตัวเลขเด็ดขาด \(ห้ามใช้ "- 1\."\)\)/g,
  "(CRITICAL: You MUST use a Markdown numbered list using '\\n\\n' to separate points, e.g. '1. ', '2. '. DO NOT use bullets '-' before the numbers.)"
);

// 4. Update trade_plan R:R formatting (for Thai technical)
content = content.replace(
  /คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown bullet points แยกบรรทัดกันชัดเจน เพื่อให้อ่านง่าย/g,
  "คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown table (ตาราง) ที่มี 3 คอลัมน์ (Target | Formula | Result) โดยต้องใช้ \\n ขึ้นบรรทัดใหม่ให้ถูกต้องตามหลัก Markdown"
);

// 5. Update validator formatting rule
content = content.replace(
  /Make sure the R:R calculation in 'trade_plan' is nicely formatted \(table or bullets\)\./g,
  "Make sure the R:R calculation in 'trade_plan' is nicely formatted as a Markdown table (Target | Formula | Result) using proper \\n newlines."
);

fs.writeFileSync('server.ts', content);
console.log("Formatting instructions patched.");
