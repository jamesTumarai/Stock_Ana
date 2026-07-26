const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetSave = `      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker,
        language: selectedLanguage,`;
const replaceSave = `      await addDoc(collection(db, "reports"), {
        userId: user.uid,
        ticker: ticker.toUpperCase(),
        language: selectedLanguage,`;
content = content.replace(targetSave, replaceSave);

fs.writeFileSync('src/App.tsx', content);
