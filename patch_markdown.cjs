const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Replace import
content = content.replace(
  "import Markdown from 'react-markdown';",
  "import { EnhancedMarkdown as Markdown } from './components/EnhancedMarkdown';"
);

// Replace <Markdown> with <Markdown findings={data.findings}>
content = content.replace(/<Markdown>/g, '<Markdown findings={data.findings}>');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched Markdown");
