const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Update default state
code = code.replace(
  "useState<'fundamental' | 'technical' | 'combined'>('fundamental');",
  "useState<'fundamental' | 'technical' | 'combined'>('combined');"
);

// Update option tags
code = code.replaceAll('<option value="fundamental">', '<option value="fundamental" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="technical">', '<option value="technical" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="combined">', '<option value="combined" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="English">', '<option value="English" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="Thai">', '<option value="Thai" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="gemini-3.5-flash">', '<option value="gemini-3.5-flash" className="bg-stone-800 text-white">');
code = code.replaceAll('<option value="perseus">', '<option value="perseus" className="bg-stone-800 text-white">');

fs.writeFileSync('src/App.tsx', code);
console.log("Updated App.tsx options and default state.");
