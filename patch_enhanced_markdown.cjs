const fs = require('fs');
let content = fs.readFileSync('src/components/EnhancedMarkdown.tsx', 'utf8');

if (!content.includes('remark-gfm')) {
  content = content.replace("import Markdown from 'react-markdown';", "import Markdown from 'react-markdown';\nimport remarkGfm from 'remark-gfm';");
  
  content = content.replace("<Markdown components={components}>", "<Markdown remarkPlugins={[remarkGfm]} components={components}>");
  
  fs.writeFileSync('src/components/EnhancedMarkdown.tsx', content);
  console.log("EnhancedMarkdown updated with remark-gfm");
} else {
  console.log("Already has remark-gfm");
}
