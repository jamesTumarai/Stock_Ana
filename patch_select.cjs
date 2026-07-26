const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetSelect = `  return (
    <div className="relative" ref={containerRef}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center justify-between gap-1 text-sm rounded px-2 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 \${className || ''}\`}
      >`;

const replaceSelect = `  return (
    <div className={\`relative \${className?.includes('flex-1') ? 'flex-1 min-w-0' : ''}\`} ref={containerRef}>
      <button 
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={\`flex items-center justify-between gap-1 text-sm rounded px-2 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-stone-500 disabled:opacity-50 bg-black/20 backdrop-blur-md border border-white/10 text-white transition-colors hover:bg-black/40 w-full \${className || ''}\`}
      >`;

content = content.replace(targetSelect, replaceSelect);
fs.writeFileSync('src/App.tsx', content);
