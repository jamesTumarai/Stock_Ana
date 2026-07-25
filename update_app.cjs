const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
appCode = appCode.replace("useState<'fundamental' | 'technical'>('fundamental');", "useState<'fundamental' | 'technical' | 'combined'>('fundamental');");

const selectAnchor = `<option value="fundamental">Fundamental Analysis</option>
            <option value="technical">Technical Analysis</option>`;
appCode = appCode.replace(selectAnchor, `<option value="fundamental">Fundamental Analysis</option>
            <option value="technical">Technical Analysis</option>
            <option value="combined">Fundamental + Technical</option>`);

fs.writeFileSync('src/App.tsx', appCode);
console.log("Updated App.tsx");
