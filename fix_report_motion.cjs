const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// Add import
if (!code.includes('import { motion }')) {
  code = code.replace(
    "import React, { useState } from 'react';",
    "import React, { useState } from 'react';\nimport { motion } from 'motion/react';"
  );
}

// Change wrapper to motion.div
code = code.replace(
  `<div className={\`min-h-full bg-[#F6F4F0] text-stone-900 font-sans w-full flex flex-col print:overflow-visible print:h-auto print:bg-white print:block \${hideHeader ? 'mb-8 border-b-4 border-stone-300 pb-8' : 'h-full overflow-y-auto'}\`}>`,
  `<motion.div \n      initial={{ opacity: 0, y: 20 }}\n      animate={{ opacity: 1, y: 0 }}\n      transition={{ duration: 0.5, ease: 'easeOut' }}\n      className={\`min-h-full bg-[#F6F4F0] text-stone-900 font-sans w-full flex flex-col print:overflow-visible print:h-auto print:bg-white print:block \${hideHeader ? 'mb-8 border-b-4 border-stone-300 pb-8' : 'h-full overflow-y-auto'}\`}>`
);
code = code.replace(
  // The end tag needs to be motion.div as well.
  // There are multiple </div> tags. The easiest way is to find the last </div> in the file which is the closing tag of the root.
  // Wait, I can just replace the LAST '</div>' in the file with '</motion.div>'
  // But let's check if the last closing is just '</div>'
);
fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("Replaced wrapper with motion.div!");
