const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Thai 1 (line ~228)
content = content.replace(
  /และห่างจากระดับถัดไปอย่างน้อย 1x ATR/g,
  "และห่างจากระดับถัดไปอย่างน้อย 1.5x ATR"
);

// English (line ~260)
content = content.replace(
  /AND at least 1x ATR away from the next level/g,
  "AND at least 1.5x ATR away from the next level"
);

fs.writeFileSync('server.ts', content);
console.log("Primary ATR rules updated successfully!");
