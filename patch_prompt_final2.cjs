const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
  '7) trend_indicators: MA, MACD, ADX\n',
  '7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)\n'
);

content = content.replace(
  '8) momentum_indicators: RSI, Stochastic\n',
  '8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)\n'
);

fs.writeFileSync('server.ts', content);
console.log("Patched final issues 2");
