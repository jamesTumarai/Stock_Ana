import fs from 'fs';
import path from 'path';

export interface InlineAgentFile {
  type: string;
  content: string;
  target: string;
}

export function loadAgentFiles(dir: string, basePath: string): InlineAgentFile[] {
  let files: InlineAgentFile[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const targetPath = path.posix.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(loadAgentFiles(fullPath, targetPath));
    } else {
      files.push({
        type: 'inline',
        content: fs.readFileSync(fullPath, 'utf-8'),
        target: targetPath,
      });
    }
  }
  return files;
}
