const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Find the technical schema and remove deep_insights from it
// But we have to be careful not to break the other schemas
