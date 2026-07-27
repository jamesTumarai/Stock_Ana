const text = "RSI = 45.2";
const match = text.match(/RSI.*?(\d+(\.\d+)?)/i);
console.log(match ? match[1] : null);
