const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const target = `                    </div>
                  </div>
                  <div className="flex gap-2 items-center">`;
const replace = `                    </div>
                  </div>
                  </div>
                  <div className="flex gap-2 items-center">`;

content = content.replace(target, replace);
fs.writeFileSync('src/components/HistoryModal.tsx', content);
