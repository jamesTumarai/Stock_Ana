const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

code = code.replace(
    `<div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "จุดเข้า (Entry)" : "Entry"}</span>
                     <span className="text-stone-900 font-bold">{data.technical_analysis.trade_plan?.entry_zone || '-'}</span>
                   </div>`,
    `<div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "จุดเข้า (Entry)" : "Entry"}</span>
                     <span className="text-stone-900 font-bold md:text-right">{data.technical_analysis.trade_plan?.entry_zone || '-'}</span>
                   </div>`
);

code = code.replace(
    `<div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "จุดตัดขาดทุน (Stop-Loss)" : "Stop-Loss"}</span>
                     <span className="text-red-600 font-bold">{data.technical_analysis.trade_plan?.stop_loss || '-'}</span>
                   </div>`,
    `<div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "จุดตัดขาดทุน (Stop-Loss)" : "Stop-Loss"}</span>
                     <span className="text-red-600 font-bold md:text-right">{data.technical_analysis.trade_plan?.stop_loss || '-'}</span>
                   </div>`
);

code = code.replace(
    `<div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "เป้าหมาย 1 (Target 1)" : "Target 1"}</span>
                     <span className="text-[#0b5a4b] font-bold">{data.technical_analysis.trade_plan?.target_1 || '-'}</span>
                   </div>`,
    `<div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "เป้าหมาย 1 (Target 1)" : "Target 1"}</span>
                     <span className="text-[#0b5a4b] font-bold md:text-right">{data.technical_analysis.trade_plan?.target_1 || '-'}</span>
                   </div>`
);

code = code.replace(
    `<div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "เป้าหมาย 2 (Target 2)" : "Target 2"}</span>
                     <span className="text-[#0b5a4b] font-bold">{data.technical_analysis.trade_plan?.target_2 || '-'}</span>
                   </div>`,
    `<div className="flex flex-col md:flex-row md:justify-between border-b border-stone-100 pb-2 gap-1 md:gap-4">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap shrink-0">{isThai ? "เป้าหมาย 2 (Target 2)" : "Target 2"}</span>
                     <span className="text-[#0b5a4b] font-bold md:text-right">{data.technical_analysis.trade_plan?.target_2 || '-'}</span>
                   </div>`
);

fs.writeFileSync('src/ReportTemplate.tsx', code);
console.log("Patched trade plan layout successfully.");
