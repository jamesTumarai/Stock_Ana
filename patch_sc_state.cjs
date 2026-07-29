const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const \[selectedLanguage, setSelectedLanguage\] = useState<string>\('Thai'\);/g,
  "const [selectedLanguage, setSelectedLanguage] = useState<string>('Thai');\n  const [useSelfConsistency, setUseSelfConsistency] = useState<boolean>(true);"
);

content = content.replace(
  /language: selectedLanguage,\n          analysisType: aType\n        }\),/g,
  "language: selectedLanguage,\n          analysisType: aType,\n          useSelfConsistency: useSelfConsistency\n        }),"
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx with useSelfConsistency state');
