const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const visualizerComponent = `
const KeyLevelsVisualizer = ({ currentPrice, support, resistance, isThai }: { currentPrice?: number, support: string[], resistance: string[], isThai: boolean }) => {
  const supports = support.map(parsePrice).filter(v => v > 0).sort((a, b) => a - b);
  const resistances = resistance.map(parsePrice).filter(v => v > 0).sort((a, b) => a - b);
  
  const allValues = [...supports, ...resistances];
  if (currentPrice) allValues.push(currentPrice);
  
  if (allValues.length < 2) return null;
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const padding = range * 0.1;
  
  const renderMin = min - padding;
  const renderMax = max + padding;
  const renderRange = renderMax - renderMin;
  
  const getPos = (val: number) => \`\${((val - renderMin) / renderRange) * 100}%\`;

  return (
    <div className="w-full mt-6 mb-2">
      <div className="relative h-2 bg-stone-200 rounded-full w-full">
        {supports.map((s, i) => (
          <div key={\`s-\${i}\`} className="absolute w-3 h-3 bg-green-500 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 border-2 border-white shadow-sm" style={{ left: getPos(s) }}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-green-700">S{supports.length - i}</div>
          </div>
        ))}
        {resistances.map((r, i) => (
          <div key={\`r-\${i}\`} className="absolute w-3 h-3 bg-red-500 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 border-2 border-white shadow-sm" style={{ left: getPos(r) }}>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-red-700">R{i + 1}</div>
          </div>
        ))}
        {currentPrice && (
          <div className="absolute w-4 h-4 bg-blue-600 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 border-2 border-white shadow-md" style={{ left: getPos(currentPrice) }}>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
              {isThai ? 'ราคาปัจจุบัน ' : 'Current '}{currentPrice}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-600 rotate-45"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
`;

content = content.replace(/const parsePrice = [\s\S]*?\n\};\n/m, match => match + visualizerComponent);

fs.writeFileSync('src/ReportTemplate.tsx', content);
