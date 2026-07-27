const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const target1 = "CRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.";
const replacement1 = "CRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats. STRICTLY FORBIDDEN to use Japanese (e.g., Katakana like ゾーン), Chinese, or any other languages. Translate terms like 'zone' to Thai (โซน).";

code = code.split(target1).join(replacement1);

const target2 = "CRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology.";
const replacement2 = "CRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology. STRICTLY FORBIDDEN to use Japanese (e.g., Katakana like ゾーン), Chinese, or any other languages. Translate terms like 'zone' to Thai (โซน).";

code = code.split(target2).join(replacement2);

fs.writeFileSync('server.ts', code);
console.log("Patched server.ts language rules successfully.");
