const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /\} else if \(evt\.type === 'thinking'\) \{\n\s*pushEvt\('thinking', \`Analyzing\.\.\.\`, evt\.text\);\n\s*\} else if \(evt\.type === 'complete'\) \{/g,
  `} else if (evt.type === 'thinking') {
                  pushEvt('thinking', \`Analyzing...\`, evt.text);
              } else if (evt.type === 'error') {
                  setErr(evt.message);
              } else if (evt.type === 'complete') {`
);

fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx with error event handling');
