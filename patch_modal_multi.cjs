const fs = require('fs');
let content = fs.readFileSync('src/components/HistoryModal.tsx', 'utf8');

const targetProps = `interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
  onDelete?: (reportId: string) => void;
}`;
const replaceProps = `interface HistoryModalProps {
  onClose: () => void;
  reports: any[];
  onSelect: (report: any) => void;
  onDelete?: (reportIds: string | string[]) => void;
}`;
content = content.replace(targetProps, replaceProps);

const targetState = `export function HistoryModal({ onClose, reports, onSelect, onDelete }: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');`;
const replaceState = `export function HistoryModal({ onClose, reports, onSelect, onDelete }: HistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };`;
content = content.replace(targetState, replaceState);

const targetHeader = `        <div className="p-4 border-b border-stone-200 flex flex-col gap-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 font-display">Report History</h3>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              type="text" 
              placeholder="Search by ticker..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-100 border border-stone-200 rounded-lg pl-10 pr-4 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-500"
            />
          </div>
        </div>`;
const replaceHeader = `        <div className="p-4 border-b border-stone-200 flex flex-col gap-4 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-stone-900 font-display">Report History</h3>
            <button onClick={onClose} className="text-stone-500 hover:text-stone-800">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="Search by ticker..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-100 border border-stone-200 rounded-lg pl-10 pr-4 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-500"
              />
            </div>
            {selectedIds.length > 0 && onDelete && (
              <button 
                onClick={() => {
                  if (window.confirm(\`Are you sure you want to delete \${selectedIds.length} report(s)?\`)) {
                    onDelete(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>`;
content = content.replace(targetHeader, replaceHeader);

const targetItem = `                <div key={report.id} className="p-4 border border-stone-200 rounded-xl bg-white flex items-center justify-between hover:border-stone-300 transition-colors">
                  <div>
                    <div className="font-bold text-lg">{report.ticker?.toUpperCase()}</div>`;
const replaceItem = `                <div key={report.id} className="p-4 border border-stone-200 rounded-xl bg-white flex items-center justify-between hover:border-stone-300 transition-colors">
                  <div className="flex items-center gap-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(report.id)}
                      onChange={() => toggleSelection(report.id)}
                      className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                    />
                    <div>
                      <div className="font-bold text-lg">{report.ticker?.toUpperCase()}</div>`;
content = content.replace(targetItem, replaceItem);

const targetSingleDelete = `                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(report.id);
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}`;
const replaceSingleDelete = `                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Are you sure you want to delete this report?")) {
                            onDelete(report.id);
                            setSelectedIds(prev => prev.filter(i => i !== report.id));
                          }
                        }}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}`;
content = content.replace(targetSingleDelete, replaceSingleDelete);

fs.writeFileSync('src/components/HistoryModal.tsx', content);
