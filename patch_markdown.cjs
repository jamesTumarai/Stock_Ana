const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

if (!content.includes("import Markdown")) {
    content = content.replace("import React, { useState } from 'react';", "import React, { useState } from 'react';\nimport Markdown from 'react-markdown';");
}

// Technical Analysis ones with whitespace-pre-wrap
content = content.replace(/<p className="text-stone-700 leading-relaxed text-\[15px\] whitespace-pre-wrap">{(data\.technical_analysis\.[a-zA-Z0-9_]+ \|\| '')}<\/p>/g, 
'<div className="prose prose-sm md:prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{$1}</Markdown></div>');

// Comprehensive Analysis ones without whitespace-pre-wrap
content = content.replace(/<p className="text-stone-700 leading-relaxed text-\[15px\]">{(data\.comprehensive_analysis\.[a-zA-Z0-9_]+ \|\| '')}<\/p>/g, 
'<div className="prose prose-sm md:prose-base prose-stone max-w-none text-stone-700 leading-relaxed"><Markdown>{$1}</Markdown></div>');

// Also update beginner_summary technical_overview
content = content.replace(/<div className="text-stone-700 leading-relaxed text-\[15px\] mb-6 border-b border-stone-200 pb-4 whitespace-pre-wrap">\s*{(data\.technical_analysis\.beginner_summary\.technical_overview \|\| '')}\s*<\/div>/g, 
'<div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4 prose prose-sm md:prose-base prose-stone max-w-none"><Markdown>{$1}</Markdown></div>');

// Also update beginner_summary business_type_simple
content = content.replace(/<div className="text-stone-700 leading-relaxed text-\[15px\] mb-6 border-b border-stone-200 pb-4">\s*{(data\.comprehensive_analysis\.beginner_summary\.business_type_simple \|\| '')}\s*<\/div>/g, 
'<div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4 prose prose-sm md:prose-base prose-stone max-w-none"><Markdown>{$1}</Markdown></div>');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched ReportTemplate.tsx");
