import {FINANCIAL_METRIC_REGISTRY,type SelectedFinancialMetric} from './selectedFinancialMetric';
import type {VerifiedAnalystOutput} from './financialAnalystContract';

/** Complement numeric validation: an unavailable companion cannot acquire a
 * qualitative trend merely because its name appears in teaching metadata.
 * Only synthesis/strengths are audited; educational and conditional future
 * checks do not constitute current company observations. No prose is repaired. */
export function hasUnavailableCompanionTrend(output:VerifiedAnalystOutput,selected:SelectedFinancialMetric):boolean {
  const unavailable=(selected.definition?.contextDependencies||[]).filter(key=>
    !selected.relatedMetrics[key]?.some(value=>typeof value==='number'&&Number.isFinite(value)));
  const prose=[output.synthesis.th,output.synthesis.en,...output.strengths.th,...output.strengths.en];
  const direction=/increas|decreas|declin|improv|weaken|\bweak\b|\bhigher\b|\blower\b|\bgrew\b|\bgrowth\b|\brose\b|\bfell\b|expand|compress|\bstable\b|\bflat\b|positive|negative|เพิ่ม|ลด|เติบ|สูง|ต่ำ|ดีขึ้น|อ่อน|ทรงตัว|เป็นบวก|ติดลบ/i;
  const limitation=/unavailable|not\s+(?:verified|supplied|disclosed|assessable)|cannot\s+assess|unknown|ไม่(?:มี|สามารถ|ทราบ|ยืนยัน)|ขาด|ข้อมูลไม่พอ|ยังไม่สามารถ/i;
  const conditional=/\b(?:if|could|would|watch|monitor)\b|assess whether|check whether|หาก|ถ้า|ควร(?:ตรวจ|ติดตาม)|ต้อง(?:ตรวจ|ติดตาม)/i;
  for(const key of unavailable) {
    const meaning=FINANCIAL_METRIC_REGISTRY[key]?.meaning;
    const names=[key,key.replace(/_/g,' '),meaning?.name,
      meaning?.education?.definition.th.split('คือ')[0]].filter((name):name is string=>!!name&&name.length>2);
    for(const name of new Set(names)) {
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const matcher=new RegExp(/[a-z]/i.test(name)?`(?<![a-z])${escaped}(?![a-z])`:escaped,'gi');
      for(const text of prose) for(const sentence of text.split(/[.!?\n]+/)) {
        for(const match of sentence.matchAll(matcher)) {
          const clause=sentence.slice(Math.max(0,match.index!-90),match.index!+name.length+90);
          if(direction.test(clause)&&!limitation.test(clause)&&!conditional.test(clause)) return true;
        }
      }
    }
  }
  return false;
}
