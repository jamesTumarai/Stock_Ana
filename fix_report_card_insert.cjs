const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const target = `<AnalysisCard title={isThai ? "แนวรับ-แนวต้าน (Key Levels)" : "Key Levels"}>
                 <div className="grid grid-cols-2 gap-4">`;
                 
const replacement = `<AnalysisCard title={isThai ? "แนวรับ-แนวต้าน (Key Levels)" : "Key Levels"}>
                 <KeyLevelsVisualizer currentPrice={data.technical_analysis.key_levels?.current_price} support={data.technical_analysis.key_levels?.support || []} resistance={data.technical_analysis.key_levels?.resistance || []} isThai={isThai} />
                 <div className="grid grid-cols-2 gap-4 mt-8">`;

content = content.replace(target, replacement);
fs.writeFileSync('src/ReportTemplate.tsx', content);
