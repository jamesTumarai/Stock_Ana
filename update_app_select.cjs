const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  "import { Search, Loader2, X } from 'lucide-react';",
  "import { Search, Loader2, X, ChevronDown } from 'lucide-react';\nimport { motion, AnimatePresence } from 'motion/react';"
);

// 2. Add CustomSelect component above export default function App()
const customSelectCode = `
function CustomSelect({ value, onChange, options, disabled, className }: { value: string, onChange: (v: string) => void, options: {value: string, label: string}[], disabled: boolean, className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const selectedOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center gap-2 text-sm rounded px-3 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 \${className || ''}\`}
      >
        {selectedOption.label}
        <ChevronDown className={\`w-4 h-4 transition-transform duration-200 \${isOpen ? 'rotate-180' : ''}\`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full mt-2 right-0 min-w-full w-max bg-stone-800 border border-white/10 rounded overflow-hidden shadow-2xl z-50 origin-top-right"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={\`w-full text-left px-4 py-2 text-sm hover:bg-stone-700 transition-colors \${value === opt.value ? 'bg-stone-700 text-white font-medium' : 'text-stone-300'}\`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {`;

code = code.replace("export default function App() {", customSelectCode);

fs.writeFileSync('src/App.tsx', code);
console.log("CustomSelect added.");
