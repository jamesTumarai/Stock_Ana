const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetImport = `import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';`;
const replaceImport = `import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore';`;

if (content.includes(targetImport)) {
  content = content.replace(targetImport, replaceImport);
  fs.writeFileSync('src/App.tsx', content);
  console.log("Patched successfully");
} else {
  console.log("Could not find the target string.");
}
