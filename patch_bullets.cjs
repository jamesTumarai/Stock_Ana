const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  /\(สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown bullet points \/ numbered lists เรียงลงมาทีละบรรทัด\)/g,
  '(สำคัญ: ให้แยกเป็นข้อๆ ด้วย Markdown numbered lists เรียงลงมาทีละบรรทัด โดยเริ่มด้วย "1. ", "2. " เป็นต้น ห้ามใส่ขีด "-" ไว้หน้าตัวเลขเด็ดขาด (ห้ามใช้ "- 1."))'
);

content = content.replace(
  /CRITICAL: For any lists \(like strengths, risks, growth, signals\), you MUST use proper Markdown list syntax \(starting with "- " or "1\. "\) on NEW lines\. Do NOT write "1\) \.\.\. 2\) \.\.\." inline on a single line\./g,
  'CRITICAL: For any lists, you MUST use proper Markdown list syntax on NEW lines. Use EITHER bullets ("- ") OR numbers ("1. "), BUT NEVER BOTH together (DO NOT use "- 1. "). Do NOT write "1) ... 2) ..." inline on a single line.'
);

content = content.replace(
  /\(ใช้ Markdown bullet points\)/g,
  '(ใช้ Markdown numbered lists เช่น "1. ", "2. " และห้ามใช้ "- 1." เด็ดขาด)'
);

fs.writeFileSync('server.ts', content);
console.log('Patched bullet points formatting');
