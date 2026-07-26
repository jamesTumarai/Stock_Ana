const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const targetProps = `interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
}`;
const replaceProps = `import { Trash2 } from 'lucide-react';

interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
  onDelete?: (reportId: string) => void;
}`;
content = content.replace(targetProps, replaceProps);

const targetComp = `export function HistoryModal({ onClose, reports, onSelect }: HistoryModalProps) {`;
const replaceComp = `export function HistoryModal({ onClose, reports, onSelect, onDelete }: HistoryModalProps) {`;
content = content.replace(targetComp, replaceComp);

const targetRender = `                  <button 
                    onClick={() => onSelect(report)}
                    className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800"
                  >
                    View
                  </button>
                </div>`;
const replaceRender = `                  <div className="flex gap-2 items-center">
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this report?")) {
                            onDelete(report.id);
                          }
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={() => onSelect(report)}
                      className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800"
                    >
                      View
                    </button>
                  </div>
                </div>`;
content = content.replace(targetRender, replaceRender);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
