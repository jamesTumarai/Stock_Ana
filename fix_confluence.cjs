const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const target = `<AnalysisCard title={isThai ? "ความสอดคล้องสัญญาณ" : "Confluence Meter"} className="bg-stone-50 overflow-y-auto max-h-64">
                 <div className="flex flex-col h-full space-y-2 text-sm text-stone-700 leading-relaxed">
                    {(data.technical_analysis.signal_summary?.confluence_score || '-').split(/(?=\\d+\\))/).map((part, i) => (
                      <span key={i} className={i === 0 && !part.match(/^\\d+\\)/) ? "font-bold text-stone-900 mb-1 block" : "block"}>{part}</span>
                    ))}
                 </div>
              </AnalysisCard>`;
                 
const replacement = `<AnalysisCard title={isThai ? "ความสอดคล้องสัญญาณ" : "Confluence Meter"} className="bg-stone-50 overflow-y-auto max-h-64">
                 <div className="flex flex-col h-full space-y-1.5 text-[13px] md:text-sm text-stone-700 leading-relaxed">
                    {(data.technical_analysis.signal_summary?.confluence_score || '-')
                      .replace(/, (?=\\d+\\))/g, '\\n')
                      .replace(/(?=สรุปทิศทางรวม)/g, '\\n\\n')
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
                        )
                    })}
                 </div>
              </AnalysisCard>`;

content = content.replace(target, replacement);
fs.writeFileSync('src/ReportTemplate.tsx', content);
