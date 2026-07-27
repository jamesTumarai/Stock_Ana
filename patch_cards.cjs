const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

content = content.replace(
  '<div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{(data.technical_analysis.trend_indicators || \'\').replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g, \'\\n\\n$1. \')}</Markdown></div>',
  '<IndicatorVisualizer type="MACD" text={data.technical_analysis.trend_indicators || \'\'} isThai={isThai} />\n                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{(data.technical_analysis.trend_indicators || \'\').replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g, \'\\n\\n$1. \')}</Markdown></div>'
);

content = content.replace(
  '<div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{(data.technical_analysis.momentum_indicators || \'\').replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g, \'\\n\\n$1. \')}</Markdown></div>',
  '<IndicatorVisualizer type="RSI" text={data.technical_analysis.momentum_indicators || \'\'} isThai={isThai} />\n                 <div className="prose prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{(data.technical_analysis.momentum_indicators || \'\').replace(/(?:\\s|^)(\\d{1,2})[\\)\\.]\\s/g, \'\\n\\n$1. \')}</Markdown></div>'
);

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched cards");
