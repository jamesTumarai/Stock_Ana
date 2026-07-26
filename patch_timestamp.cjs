const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetImport = `import { collection, addDoc, query, where, getDocs, orderBy } from 'firebase/firestore';`;
const replaceImport = `import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';`;
content = content.replace(targetImport, replaceImport);

const targetSave = `      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker,
        language: selectedLanguage,
        createdAt: new Date(),
        data: reportData
      });`;
const replaceSave = `      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker,
        language: selectedLanguage,
        createdAt: serverTimestamp(),
        data: reportData
      });`;
content = content.replace(targetSave, replaceSave);

fs.writeFileSync('src/App.tsx', content);
