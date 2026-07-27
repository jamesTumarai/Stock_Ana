const fs = require('fs');

let code = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

const targetStr = `<div className="flex flex-col md:flex-row md:justify-between pt-2 gap-2 mt-2 border-t border-stone-100">
                     <span className="text-stone-500 text-sm font-medium whitespace-nowrap">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <div className="text-stone-700 text-sm md:text-right prose prose-sm prose-stone max-w-none prose-p:my-0"><Markdown findings={data.findings}>{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</Markdown></div>
                   </div>`;

const replacementStr = `<div className="flex flex-col pt-3 gap-2 mt-2 border-t border-stone-100">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <div className="text-stone-700 text-sm bg-stone-50 p-3 rounded-lg border border-stone-100 prose prose-sm prose-stone max-w-none prose-p:my-0 leading-relaxed"><Markdown findings={data.findings}>{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</Markdown></div>
                   </div>`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/ReportTemplate.tsx', code);
    console.log("Patched R/R UI successfully for the 3rd time.");
} else {
    console.log("Not found.");
}
