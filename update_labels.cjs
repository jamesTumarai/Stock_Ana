const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /{selectedLanguage === 'Thai' \? '10\/10 แม่นยำ' : '10\/10 Accuracy'}/g,
  "{selectedLanguage === 'Thai' ? 'คิดเชิงลึก' : 'Deep Think'}"
);

content = content.replace(
  /{selectedLanguage === 'Thai' \? '10\/10 แม่นยำ' : '10\/10 Acc'}/g,
  "{selectedLanguage === 'Thai' ? 'คิดเชิงลึก' : 'Deep Think'}"
);

fs.writeFileSync('src/App.tsx', content);
console.log('Labels updated.');
