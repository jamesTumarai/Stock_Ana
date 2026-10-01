import type { SelectedFinancialMetric } from './selectedFinancialMetric';
import { formatMetricChange } from './selectedFinancialMetric';
import { METRIC_AI_CONTEXT_VERSION } from './metricAiRequest';
import { financialSynthesisHasUnsupportedNumbers } from './financialSynthesisGuard';
import type { FinancialAiInsight } from '../utils/financialAiInsights';
import { getBusinessAwareLocalFallback, type MetricInterpretationContext } from './financialMetricContext';
import { canonicalMetricMeaning } from './financialMetricMeaning';
import { beginnerMeaningHasTeachingStructure } from './metricBeginnerEducation';
import { selectedMetricAssessment } from './metricAssessmentPolicy';
import {hasUnavailableCompanionTrend} from './analystEvidenceGuard';

export const ANALYST_FAILURE_CODES = ['INSUFFICIENT_VERIFIED_DATA','AI_CONTEXT_TOO_LARGE','AI_REQUEST_TOO_LARGE','AI_REQUEST_INVALID',
  'AI_AUTH_REQUIRED','AI_RATE_LIMITED','AI_SERVER_MISCONFIGURED','AI_API_KEY_MISSING','AI_MODEL_UNAVAILABLE','AI_PROVIDER_TIMEOUT',
  'AI_PROVIDER_ERROR','AI_PROVIDER_UNAVAILABLE','AI_SOURCE_UNAVAILABLE','AI_RESPONSE_EMPTY','AI_RESPONSE_INVALID_JSON','AI_RESPONSE_SCHEMA_INVALID',
  'AI_NUMERIC_VALIDATION_FAILED','AI_EVIDENCE_VALIDATION_FAILED','AI_STALE_REQUEST_DISCARDED','UNSUPPORTED_METRIC','NOT_APPLICABLE',
  'AI_TIMEOUT','AI_VALIDATION_FAILED'] as const;
export type AnalystFallbackReason = typeof ANALYST_FAILURE_CODES[number];
export interface VerifiedAnalystOutput {
  metricKey: string;
  what_is_it_th: string;
  what_is_it_en: string;
  synthesis: {th: string; en: string}; strengths: {th: string[]; en: string[]};
  watchouts: {th: string; en: string}; ruleOfThumb: {th: string; en: string}; referencedMetricKeys: string[];
  status: FinancialAiInsight['status']; statusLabels: {th: string; en: string};
}
export function acceptedAnalystNumbers(selected: SelectedFinancialMetric): number[] {
  return [...selected.values,...selected.changes,...Object.values(selected.relatedMetrics).flat()]
    .filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
}
/** Strict output contract: accounting replacement fields and mismatched selections are rejected. */
export function validateVerifiedAnalystSchema(value: unknown, selected: SelectedFinancialMetric): value is VerifiedAnalystOutput {
  if (!value || typeof value!=='object' || Array.isArray(value)) return false;
  const o=value as VerifiedAnalystOutput, fields=['metricKey','what_is_it_th','what_is_it_en','synthesis','strengths','watchouts','ruleOfThumb','referencedMetricKeys','status','statusLabels'];
  if(Object.keys(o).length!==fields.length || Object.keys(o).some(k=>!fields.includes(k)) || o.metricKey!==selected.metricKey) return false;
  if(!['excellent','good','neutral','warning'].includes(o.status)) return false;
  if (![o.what_is_it_th, o.what_is_it_en].every(text => typeof text === 'string' && text.trim().length > 0 && text.length < 6000)) return false;
  for(const key of ['synthesis','watchouts','ruleOfThumb','statusLabels'] as const) {
    const item=o[key]; if(!item||Object.keys(item).length!==2||!['th','en'].every(k=>typeof item[k as 'th'|'en']==='string'&&item[k as 'th'|'en'].trim().length>0&&item[k as 'th'|'en'].length<6000)) return false;
  }
  if(!o.strengths||Object.keys(o.strengths).length!==2||!['th','en'].every(k=>Array.isArray(o.strengths[k as 'th'|'en'])&&o.strengths[k as 'th'|'en'].length<=6&&o.strengths[k as 'th'|'en'].every(s=>typeof s==='string'&&s.length>0&&s.length<1800))) return false;
  const keys=new Set([selected.metricKey,...Object.keys(selected.relatedMetrics)]);
  if(!Array.isArray(o.referencedMetricKeys)||!o.referencedMetricKeys.includes(selected.metricKey)||o.referencedMetricKeys.some(k=>!keys.has(k))) return false;
  return true;
}
/** Repair only educational meaning. Every other field still passes the exact
 * schema/numeric guard; unsupported numbers in synthesis are never repaired. */
export function resolveAnalystMeaning(value: unknown, selected: SelectedFinancialMetric, context: MetricInterpretationContext): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const output = value as Record<string, unknown>;
  if (output.metricKey !== selected.metricKey) return value;
  const canonical = canonicalMetricMeaning(context);
  const normalize = (text: string) => text.toLowerCase().replace(/[_\s-]+/g, ' ').trim();
  // The provider can name the metric naturally in Thai without repeating its
  // English title. Derive this anchor from trusted semantics, not model text.
  const thaiConcept = selected.definition?.meaning?.th.split('คือ')[0].trim();
  const anchors = [selected.definition?.meaning?.name, context.metricName, context.metricNameTh,
    thaiConcept && thaiConcept.length < 100 && !/^(รายการ|ตัวชี้วัด|อัตราผลตอบแทนนี้)/.test(thaiConcept) ? thaiConcept : undefined]
    .filter((text): text is string => !!text && text.length > 2).map(normalize);
  const resolve = (text: unknown, language: 'th' | 'en') => {
    const substance = typeof text === 'string' ? anchors.reduce((rest, anchor) => rest.split(anchor).join(''), normalize(text)).replace(/[\s:,.!?()]/g, '') : '';
    const valid = typeof text === 'string' && text.trim().length >= (language === 'th' ? 120 : 100) && text.length < 6000
      && substance.length >= (language === 'th' ? 90 : 70)
      && !/^(ตัวชี้วัด\s|metric:\s|formula:\s|สูตร:\s)/i.test(text.trim())
      // A companion mention cannot qualify a different metric's definition.
      && anchors.some(anchor => {
        const definition = normalize(text.split(/วัดอะไร:|What it measures:/i)[0]).replace(/^(?:ความหมาย:|meaning:)\s*/, '');
        return definition.startsWith(anchor) || definition.startsWith(`the ${anchor}`);
      })
      && beginnerMeaningHasTeachingStructure(text, language, anchors)
      && !financialSynthesisHasUnsupportedNumbers(text, acceptedAnalystNumbers(selected));
    return valid ? text : canonical[language];
  };
  return { ...output, what_is_it_th: resolve(output.what_is_it_th, 'th'), what_is_it_en: resolve(output.what_is_it_en, 'en') };
}
export function verifiedAnalystValidationFailure(value: unknown, selected: SelectedFinancialMetric): AnalystFallbackReason | undefined {
  if (!validateVerifiedAnalystSchema(value, selected)) return 'AI_RESPONSE_SCHEMA_INVALID';
  // A fiscal-year label is allowed as a label, not as an arbitrary financial number.
  const stripPeriodLabels=(item:unknown):unknown=>typeof item==='string'?selected.periods.reduce((s,p)=>s.split(p).join(''),item)
    :Array.isArray(item)?item.map(stripPeriodLabels):item&&typeof item==='object'?Object.fromEntries(Object.entries(item).map(([k,v])=>[k,stripPeriodLabels(v)])):item;
  if(financialSynthesisHasUnsupportedNumbers(stripPeriodLabels(value),acceptedAnalystNumbers(selected))) return 'AI_NUMERIC_VALIDATION_FAILED';
  return hasUnavailableCompanionTrend(value,selected)?'AI_EVIDENCE_VALIDATION_FAILED':undefined;
}
export function validateVerifiedAnalystOutput(value: unknown, selected: SelectedFinancialMetric): value is VerifiedAnalystOutput {
  return !verifiedAnalystValidationFailure(value, selected);
}
export function analystCacheKey(ticker: string, selected: SelectedFinancialMetric, language: boolean, model = ''): string {
  return JSON.stringify([METRIC_AI_CONTEXT_VERSION,ticker.toUpperCase(),selected.identity,selected.metricKey,selected.periods,selected.values,selected.relatedMetrics,selected.changes,language,model]);
}
export function deterministicMetricInsight(selected: SelectedFinancialMetric, context: MetricInterpretationContext, reason?: AnalystFallbackReason): FinancialAiInsight {
  const base=getBusinessAwareLocalFallback(context,selected.currentValue,true);
  const def=selected.definition, n=selected.currentValue, period=selected.periods.at(-1)||'';
  const formatted=n===null?'—':`${n.toLocaleString('en-US',{maximumFractionDigits:3})} ${def?.unit==='per_share'?`${selected.currency} per share`:def?.valueType==='money'?`${selected.currency} M`:def?.unit||''}`;
  const change=selected.changes.at(-1), changeText=typeof change==='number'?` ${formatMetricChange(selected.metricKey,change)}.`:'';
  const limited=selected.dataQuality.historicalVerifiedPeriods.length<2;
  // Directional rules describe the selected economics, never a universal numerical threshold.
  const rules: Record<string,[string,string,string,string]> = {
    revenue:['Compare sales with accepted operating profit and operating cash flow.','พิจารณารายได้พร้อมกำไรดำเนินงานและกระแสเงินสดที่ตรวจสอบได้','Revenue measures activity, not profitability or collected cash.','รายได้ไม่ได้บอกกำไรหรือเงินสดที่เก็บได้'],
    gross_margin:['Assess gross profit retained per unit of revenue before operating expenses.','ดูส่วนรายได้ที่เหลือหลังต้นทุนขาย ก่อนค่าใช้จ่ายดำเนินงาน','Gross margin excludes operating costs; changes alone do not establish pricing power.','อัตรากำไรขั้นต้นไม่รวมค่าใช้จ่ายดำเนินงาน การเปลี่ยนแปลงเพียงอย่างเดียวไม่ยืนยันอำนาจกำหนดราคา'],
    operating_margin:['Assess operating profit per unit of revenue alongside the accepted expense series.','ดูกำไรดำเนินงานต่อรายได้ พร้อมข้อมูลค่าใช้จ่ายที่ตรวจสอบได้','Operating profitability excludes financing, tax and cash-conversion effects.','กำไรดำเนินงานยังไม่รวมผลจากการจัดหาเงิน ภาษี และการแปลงกำไรเป็นเงินสด'],
    total_assets:['Read assets alongside liabilities and equity from the same balance-sheet date.','อ่านสินทรัพย์พร้อมหนี้สินและส่วนของผู้ถือหุ้น ณ วันเดียวกัน','A larger asset base does not establish liquidity, earning quality or a fair value.','สินทรัพย์มากขึ้นไม่ได้ยืนยันสภาพคล่อง คุณภาพกำไร หรือมูลค่ายุติธรรม'],
    operating_cash_flow:['Compare operating cash generated with accepted net income and capital expenditure.','เปรียบเทียบเงินสดดำเนินงานกับกำไรสุทธิและรายจ่ายฝ่ายทุนที่ตรวจสอบได้','Working-capital timing can change cash flow; bank deposit and lending flows need sector interpretation.','จังหวะเงินทุนหมุนเวียนเปลี่ยนกระแสเงินสดได้ เงินฝากและสินเชื่อของธนาคารต้องตีความตามอุตสาหกรรม'],
    roic:['Use the shared canonical NOPAT / average invested-capital methodology consistently.','ใช้วิธี NOPAT / เงินลงทุนเฉลี่ยของ canonical ROIC อย่างสม่ำเสมอ','ROIC depends on accepted tax and invested-capital inputs; no unsourced cost-of-capital spread is inferred.','ROIC ขึ้นกับภาษีและฐานเงินลงทุนที่ตรวจสอบได้ ไม่อนุมานส่วนต่างต้นทุนเงินทุนโดยไม่มีแหล่งข้อมูล'],
    roe:['Compare TTM common earnings with average common equity, using compatible endpoints.','เปรียบเทียบกำไรผู้ถือหุ้นสามัญ TTM กับส่วนผู้ถือหุ้นสามัญเฉลี่ย ณ จุดเวลาที่เข้ากันได้','Leverage or a shrinking equity base can raise ROE without improving operating economics.','หนี้เพิ่มหรือฐานทุนลดอาจทำให้ ROE สูงขึ้นโดยธุรกิจไม่ได้ดีขึ้น'],
    roa:['Compare TTM earnings with the compatible average asset base.','เปรียบเทียบกำไร TTM กับสินทรัพย์เฉลี่ย ณ จุดเวลาที่เข้ากันได้','Asset composition differs by sector; cross-sector ROA comparisons can mislead.','องค์ประกอบสินทรัพย์ต่างกันตามอุตสาหกรรม การเทียบ ROA ข้ามอุตสาหกรรมอาจคลาดเคลื่อน'],
    quick_ratio:['Use cash, short-term investments and trade receivables over current liabilities.','ใช้เงินสด เงินลงทุนระยะสั้น และลูกหนี้การค้า หารหนี้สินหมุนเวียน','Receivable collectability matters; broader current assets are not substituted.','ต้องดูความสามารถเก็บลูกหนี้ ไม่แทนตัวเศษด้วยสินทรัพย์หมุนเวียนอื่น'],
    equity_ratio:['Use total equity including noncontrolling interests over total assets.','ใช้ส่วนของผู้ถือหุ้นรวมส่วนได้เสียที่ไม่มีอำนาจควบคุม หารสินทรัพย์รวม','This capital-structure share is distinct from common-equity returns and liquidity.','สัดส่วนโครงสร้างทุนนี้ต่างจากผลตอบแทนทุนสามัญและสภาพคล่อง'],
    free_cash_flow:['Use compatible operating cash flow less the absolute capital expenditure outflow.','ใช้กระแสเงินสดดำเนินงานหักรายจ่ายฝ่ายทุนที่เข้ากันได้','This cash-flow definition is not distributable cash and is unsuitable as a generic bank valuation input.','FCF นิยามนี้ไม่ใช่เงินสดที่แจกจ่ายได้ และไม่เหมาะเป็นฐานมูลค่าธนาคารทั่วไป'],
  };
  const rule=/^change_(receivables|inventory|payables)$/.test(def?.canonicalKey||selected.metricKey)
    ? ['Positive contributes operating cash; negative consumes cash. Neither sign alone establishes quality.',
      'ค่าบวกช่วยเพิ่มเงินสดดำเนินงาน ค่าลบใช้เงินสด เครื่องหมายอย่างเดียวไม่ตัดสินคุณภาพกิจการ',
      'Compare the cash effect with operating cash, sales and the corresponding account balance; timing does not establish its cause.',
      'ดูผลต่อเงินสดคู่กับเงินสดดำเนินงาน ยอดขาย และยอดบัญชีที่เกี่ยวข้อง จังหวะเงินสดยังไม่ยืนยันสาเหตุ']
    : rules[def?.canonicalKey||selected.metricKey];
  const useRule=rule&&context.applicability!=='NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION'&&!context.isFinancialSectorGuardActive;
  const evidence=selectedMetricAssessment(selected,context);
  return {...base,engine:'DETERMINISTIC',metricKey:selected.metricKey,fallbackReason:reason||selected.dataQuality.reasonCode,
    status:selected.dataQuality.currentVerified?'neutral':'warning',status_label_th:selected.dataQuality.currentVerified?'ข้อมูลเฉพาะตัวชี้วัดตรวจสอบได้':'ข้อมูลตัวชี้วัดไม่เพียงพอ',status_label_en:selected.dataQuality.currentVerified?'Accepted metric data':'Metric data limited',
    interpretation_en:`${context.metricName}: ${formatted} (${period}).${changeText} ${limited?'Only the accepted current observation is described; a trend cannot be established.':`Compare the accepted ${selected.metricKey} series using ${def?.changeSemantic||'explicit metric semantics'}.`} ${evidence.evidence.en} ${selected.dataQuality.reason||''}`,
    interpretation_th:`${context.metricNameTh}: ${formatted} (${period})${changeText} ${limited?'อธิบายเฉพาะค่าปัจจุบันที่ตรวจสอบได้ ยังสรุปแนวโน้มไม่ได้':`เปรียบเทียบข้อมูล ${context.metricNameTh} ตามหน่วยและงวดเดียวกัน`} ${evidence.evidence.th} ${selected.dataQuality.reason||''}`,
    pros_en:evidence.assessment==='favorable'?[evidence.evidence.en]:[],
    pros_th:evidence.assessment==='favorable'?[evidence.evidence.th]:[],
    benchmark_en:useRule?rule[0]:base.benchmark_en,benchmark_th:useRule?rule[1]:base.benchmark_th,
    watchouts_en:`${evidence.watch.en} ${useRule?rule[2]:base.watchouts_en} ${selected.dataQuality.status==='APPROXIMATE'?'The selected methodology is approximate.':''} ${limited?'Additional verified periods are required before discussing persistence.':''}`,
    watchouts_th:`${evidence.watch.th} ${useRule?rule[3]:base.watchouts_th} ${selected.dataQuality.status==='APPROXIMATE'?'วิธีคำนวณนี้เป็นค่าประมาณ':''} ${limited?'ต้องมีงวดที่ตรวจสอบได้เพิ่มเติมก่อนประเมินความต่อเนื่อง':''}`,
  };
}
export function renderVerifiedAnalystOutput(output: VerifiedAnalystOutput, base: FinancialAiInsight, model: string): FinancialAiInsight {
  return {...base,engine:'GEMINI',fallbackReason:undefined,model,metricKey:output.metricKey,
    what_is_it_th:output.what_is_it_th,what_is_it_en:output.what_is_it_en,
    status:output.status,status_label_th:output.statusLabels.th,status_label_en:output.statusLabels.en,
    interpretation_th:output.synthesis.th,interpretation_en:output.synthesis.en,pros_th:output.strengths.th,pros_en:output.strengths.en,
    watchouts_th:output.watchouts.th,watchouts_en:output.watchouts.en,benchmark_th:output.ruleOfThumb.th,benchmark_en:output.ruleOfThumb.en};
}
/** Request sequence supplements AbortController, including providers which finish after cancellation. */
export class MetricRequestSequence {
  private generation=0;
  next(): number { return ++this.generation; }
  accepts(token: number): boolean { return token===this.generation; }
  invalidate(): void { this.generation++; }
}
