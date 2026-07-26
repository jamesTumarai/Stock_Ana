const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const targetClick = `                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this report?")) {
                            onDelete(report.id);
                          }
                        }}`;
const replaceClick = `                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(report.id);
                        }}`;
content = content.replace(targetClick, replaceClick);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
