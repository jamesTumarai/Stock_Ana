const text = "Revenue grew by 20% [1] and [2].";
const newText = text.replace(/\[(\d+)\]/g, '[$1](#citation-$1)');
console.log(newText);
