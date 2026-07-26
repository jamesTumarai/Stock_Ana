const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const target = `<div className="flex flex-col h-full space-y-1.5 text-[13px] md:text-sm text-stone-700 leading-relaxed">
                    {(data.technical_analysis.signal_summary?.confluence_score || '-')
                      .replace(/, (\\?=\\d+\\))/g, '\\n')
                      .replace(/(\\?=สรุปทิศทางรวม)/g, '\\n\\n')
                      .split('\\n')
                      .filter(Boolean)
                      .map((part, i) => {
                        const isNumber = part.trim().match(/^\\d+\\)/);
                        const isSummary = part.trim().startsWith('สรุปทิศทางรวม');
                        return (
                          <span key={i} className={
                            isSummary ? "font-bold text-stone-900 mt-3 block border-t border-stone-200 pt-2" : 
                            (i === 0 && !isNumber) ? "font-bold text-stone-900 mb-1 block" : 
                            "block pl-2"
                          }>
                            {part.trim()}
                          </span>
                        );
                      })}
                 </div>`;

const newConfluence = `<div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{data.technical_analysis.signal_summary?.confluence_score || '-'}</Markdown></div>`;

// Safely do replace
let lines = content.split('\n');
let start = -1;
let end = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('confluence_score') && lines[i].includes('data.technical_analysis.signal_summary')) {
     start = i - 1; // div before
     break;
  }
}
if (start > -1) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].includes('</div>')) {
      if (lines[i+1] && lines[i+1].includes('</AnalysisCard>')) {
        end = i;
        break;
      }
    }
  }
}

if (start > -1 && end > -1) {
  let toReplace = lines.slice(start, end + 1).join('\n');
  content = content.replace(toReplace, newConfluence);
  fs.writeFileSync('src/ReportTemplate.tsx', content);
  console.log("Patched confluence_score successfully");
} else {
  console.log("Failed to find boundaries");
}
