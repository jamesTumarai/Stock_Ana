const fs = require('fs');

// 1. App.tsx
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  '<div className="flex items-center gap-2 text-white">\n          <Hexagon className="w-5 h-5 fill-white text-white" />\n          <span className="font-display font-bold text-xl tracking-wider uppercase">Lumina</span>\n        </div>',
  '<div className="flex items-center gap-2">\n          <span className="font-display font-bold text-xl tracking-wider uppercase text-white">COIN KING</span>\n        </div>'
);
fs.writeFileSync('src/App.tsx', app);

// 2. index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace('<title>Coin King</title>', '<title>Lumina</title>');
fs.writeFileSync('index.html', html);

// 3. public/manifest.json
let manifest = fs.readFileSync('public/manifest.json', 'utf8');
manifest = manifest.replace(/"name": "Coin King"/g, '"name": "Lumina"');
manifest = manifest.replace(/"short_name": "Coin King"/g, '"short_name": "Lumina"');
fs.writeFileSync('public/manifest.json', manifest);

