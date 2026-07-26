const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const targetMulti = `                onClick={() => {
                  if (window.confirm(\`Are you sure you want to delete \${selectedIds.length} report(s)?\`)) {
                    onDelete(selectedIds);
                    setSelectedIds([]);
                  }
                }}`;
const replaceMulti = `                onClick={() => {
                  onDelete(selectedIds);
                  setSelectedIds([]);
                }}`;
content = content.replace(targetMulti, replaceMulti);

const targetSingle = `                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this report?")) {
                            onDelete(report.id);
                            setSelectedIds(prev => prev.filter(i => i !== report.id));
                          }
                        }}`;
const replaceSingle = `                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(report.id);
                          setSelectedIds(prev => prev.filter(i => i !== report.id));
                        }}`;
content = content.replace(targetSingle, replaceSingle);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
