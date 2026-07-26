const fs = require('fs');
let content = fs.readFileSync('src/ReportTemplate.tsx', 'utf8');

// For comprehensive
content = content.replace(/<div><strong className="text-stone-900">{isThai \? "น่าศึกษาต่อไหม:" : "Worth Studying Further\?"}<\/strong> {(data\.comprehensive_analysis\.final_verdict_summary\.worth_further_study \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "น่าศึกษาต่อไหม:" : "Worth Studying Further?"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

content = content.replace(/<div><strong className="text-stone-900">{isThai \? "พื้นฐานดีจริงไหม:" : "Strong Fundamentals\?"}<\/strong> {(data\.comprehensive_analysis\.final_verdict_summary\.strong_fundamentals \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "พื้นฐานดีจริงไหม:" : "Strong Fundamentals?"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

content = content.replace(/<div><strong className="text-stone-900">{isThai \? "สิ่งที่ต้องดูเพิ่ม:" : "What to Look For:"}<\/strong> {(data\.comprehensive_analysis\.final_verdict_summary\.what_to_look_for \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "สิ่งที่ต้องดูเพิ่ม:" : "What to Look For?"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

// For technical
content = content.replace(/<div><strong className="text-stone-900">{isThai \? "จังหวะน่าเข้าไหม:" : "Good Timing\?"}<\/strong> {(data\.technical_analysis\.final_verdict_summary\.is_good_timing \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "จังหวะน่าเข้าไหม:" : "Good Timing?"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

content = content.replace(/<div><strong className="text-stone-900">{isThai \? "ถ้ารอ ต้องรออะไร:" : "What to wait for:"}<\/strong> {(data\.technical_analysis\.final_verdict_summary\.what_to_wait_for \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "ถ้ารอ ต้องรออะไร:" : "What to wait for?"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

content = content.replace(/<div><strong className="text-stone-900">{isThai \? "แผนการเข้าสั้นๆ:" : "Trade Plan:"}<\/strong> {(data\.technical_analysis\.final_verdict_summary\.trade_plan \|\| '')}<\/div>/g, 
'<div><strong className="text-stone-900 block mb-1">{isThai ? "แผนการเข้าสั้นๆ:" : "Trade Plan:"}</strong> <div className="prose prose-sm prose-stone max-w-none"><Markdown>{$1}</Markdown></div></div>');

fs.writeFileSync('src/ReportTemplate.tsx', content);
console.log("Patched verdict");
