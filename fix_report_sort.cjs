const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Add helper function at the top outside of component
if (!code.includes('const parsePrice')) {
  code = code.replace(
    'export default function ReportTemplate',
    `const parsePrice = (str: string) => {
  const match = str.match(/[\\d,]+(\\.\\d+)?/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
};

export default function ReportTemplate`
  );
}

// Replace Resistance array
code = code.replace(
  `{(data.technical_analysis.key_levels?.resistance || []).map((r, i) => (`,
  `{[...(data.technical_analysis.key_levels?.resistance || [])].sort((a, b) => parsePrice(a) - parsePrice(b)).map((r, i) => (`
);

// Replace Support array
code = code.replace(
  `{(data.technical_analysis.key_levels?.support || []).map((s, i) => (`,
  `{[...(data.technical_analysis.key_levels?.support || [])].sort((a, b) => parsePrice(b) - parsePrice(a)).map((s, i) => (`
);

fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("Fixed sorting logic for key levels.");
