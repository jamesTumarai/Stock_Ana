const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(
  "let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));",
  "let reports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));"
);
fs.writeFileSync('src/App.tsx', content);
