const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const targetStr = `<div className="flex justify-between pt-1">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <span className="text-stone-900 font-bold">{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</span>
                   </div>`;

const replacementStr = `<div className="flex flex-col md:flex-row md:justify-between pt-1 gap-1">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <span className="text-stone-900 font-bold md:text-right">{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</span>
                   </div>`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched R/R UI successfully.");
} else {
    console.log("Not found.");
}
