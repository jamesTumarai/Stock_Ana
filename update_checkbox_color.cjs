const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /\`w-4 h-4 rounded border flex items-center justify-center \$\{useSelfConsistency \? 'bg-blue-500 border-blue-500' : 'border-white\/30'\}\`/g,
  "`w-4 h-4 rounded border flex items-center justify-center ${useSelfConsistency ? 'bg-white border-white' : 'border-white/30'}`"
);

content = content.replace(
  /\`w-3\.5 h-3\.5 rounded-sm border flex items-center justify-center \$\{useSelfConsistency \? 'bg-blue-500 border-blue-500' : 'border-white\/30'\}\`/g,
  "`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${useSelfConsistency ? 'bg-white border-white' : 'border-white/30'}`"
);

content = content.replace(
  /\{useSelfConsistency && <svg className="w-3 h-3 text-white"/g,
  "{useSelfConsistency && <svg className=\"w-3 h-3 text-black\""
);

content = content.replace(
  /\{useSelfConsistency && <svg className="w-2\.5 h-2\.5 text-white"/g,
  "{useSelfConsistency && <svg className=\"w-2.5 h-2.5 text-black\""
);

fs.writeFileSync('src/App.tsx', content);
console.log('Checkbox color updated.');
