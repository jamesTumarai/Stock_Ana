import type { SelectedFinancialMetric } from './selectedFinancialMetric';
import type { MetricInterpretationContext } from './financialMetricContext';
export type MetricAssessmentPolicy = 'DIRECT_HIGHER_BETTER' | 'DIRECT_LOWER_BETTER' | 'CONTEXT_DEPENDENT' | 'RANGE_DEPENDENT' | 'DIRECTION_DEPENDENT' | 'NOT_APPLICABLE';
export function metricAssessmentPolicy(key: string): MetricAssessmentPolicy {
  if (['gross_margin','operating_margin','roic','roe','roa','net_margin'].includes(key)) return 'DIRECT_HIGHER_BETTER';
  if (['dso','dio','combined_ratio_pct','combined_ratio','efficiency_ratio'].includes(key)) return 'DIRECT_LOWER_BETTER';
  if (['current_ratio','quick_ratio','loan_deposit_ratio'].includes(key)) return 'RANGE_DEPENDENT';
  if (/^change_(receivables|inventory|payables|working_capital)$/.test(key)) return 'DIRECTION_DEPENDENT';
  return 'CONTEXT_DEPENDENT';
}
/** Direction color only where a direction has an explicit economic meaning.
 * A neutral color avoids turning asset, cost or cash movements into verdicts. */
export function metricDeltaTone(key: string, change: number): string {
  const policy = metricAssessmentPolicy(key);
  if (!['DIRECT_HIGHER_BETTER','DIRECT_LOWER_BETTER'].includes(policy) || change === 0) return 'text-stone-500';
  const favorable = policy === 'DIRECT_LOWER_BETTER' ? change < 0 : change > 0;
  return favorable ? 'text-emerald-600' : 'text-rose-600';
}
export function selectedMetricAssessment(selected: SelectedFinancialMetric, context: MetricInterpretationContext) {
  const key = selected.definition?.canonicalKey || selected.metricKey;
  const policy = !selected.definition || context.applicability === 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION' || selected.dataQuality.reasonCode === 'NOT_APPLICABLE'
    ? 'NOT_APPLICABLE' : selected.definition.assessmentPolicy;
  const latest = (series?: (number|null)[]) => series?.at(-1) ?? null;
  const trend = (series?: (number|null)[]) => {
    const last = series?.at(-1), prior = series?.at(-2), a = selected.periods.at(-2)?.match(/^Q([1-4]) (\d{4})$/), b = selected.periods.at(-1)?.match(/^Q([1-4]) (\d{4})$/);
    if (!a || !b || Number(b[2])*4+Number(b[1])-Number(a[2])*4-Number(a[1])!==1 || typeof last!=='number' || typeof prior!=='number') return null;
    return Math.sign(last-prior);
  };
  const related = (key: string) => selected.relatedMetrics[key];
  const current = selected.currentValue, direction = trend(selected.values);
  let assessment: 'favorable'|'unfavorable'|'mixed'|'unclear'|'not_applicable' = 'unclear';
  let evidenceTh = 'ค่าหรือการเปลี่ยนแปลงของตัวชี้วัดนี้อย่างเดียวไม่ยืนยันว่าธุรกิจดีขึ้น ต้องดูรายการที่เกี่ยวข้องตามขอบเขตและงวดเดียวกัน';
  let evidenceEn = 'The selected amount or direction alone does not establish improvement; compatible related evidence is required.';
  let watchTh = 'ตรวจว่ารายการที่เกี่ยวข้องสนับสนุนคุณภาพกำไร เงินสด หรือประสิทธิภาพทุนหรือไม่';
  let watchEn = 'Check whether related accepted metrics support earnings quality, cash generation or capital efficiency.';
  if (policy === 'NOT_APPLICABLE' || context.isFinancialSectorGuardActive) {
    assessment='not_applicable'; evidenceTh='ตัวชี้วัดนี้ไม่ใช่ฐานหลักสำหรับลักษณะธุรกิจนี้ ต้องใช้เกณฑ์เฉพาะอุตสาหกรรม'; evidenceEn='This is not a primary measure for this business type; sector-specific measures are required.';
  } else if (key==='operating_cash_flow') {
    const capex=latest(related('capex')), fcf=latest(related('free_cash_flow'));
    if (current!==null && capex!==null && fcf!==null) {
      if (current>0 && Math.abs(capex)>current && fcf<0) {
        assessment='mixed'; evidenceTh='กิจการสร้างเงินสดดำเนินงานได้ แต่รายจ่ายฝ่ายทุนมากกว่าเงินสดที่สร้าง ทำให้กระแสเงินสดอิสระติดลบ'; evidenceEn='Operations generated cash, but capital spending exceeded operating cash generation, leaving free cash flow negative.';
      } else if (current>0 && fcf>0) {
        assessment='favorable'; evidenceTh='เงินสดดำเนินงานรองรับรายจ่ายฝ่ายทุนและยังเหลือกระแสเงินสดอิสระเป็นบวก แต่ยังต้องตรวจความต่อเนื่อง'; evidenceEn='Operating cash covered capital spending and left positive free cash flow; persistence still needs verification.';
      }
    }
    watchTh='ติดตามว่าเงินสดดำเนินงานรองรับรายจ่ายฝ่ายทุนได้หรือไม่ และรายการลูกหนี้หรือสินค้าคงเหลือช่วยหรือใช้เงินสดเพียงชั่วคราวหรือไม่'; watchEn='Watch capital-spending coverage and whether receivable or inventory cash effects are temporary.';
  } else if (key==='operating_expenses') {
    const sales=related('revenue'), costs=selected.values, margin=trend(related('operating_margin'));
    const s=latest(sales), sp=sales?.at(-2), c=latest(costs), cp=costs.at(-2);
    if (direction!==null && typeof s==='number' && typeof sp==='number' && sp>0 && typeof c==='number' && typeof cp==='number' && cp>0 && (c-cp)/cp>(s-sp)/sp && margin===-1) {
      assessment='unfavorable'; evidenceTh='ในสองงวดที่เข้ากันได้ ค่าใช้จ่ายโตเร็วกว่ารายได้พร้อมอัตรากำไรดำเนินงานลดลง ค่าใช้จ่ายจึงดูดซับผลจากยอดขายมากขึ้น โดยยังไม่ยืนยันสาเหตุเฉพาะ'; evidenceEn='Across the two compatible supplied quarters, expenses grew faster than revenue while operating margin compressed; costs absorbed more of sales without establishing a specific cause.';
    } else if (direction===1 && margin===-1) {
      assessment='mixed'; evidenceTh='ค่าใช้จ่ายเพิ่มพร้อมอัตรากำไรดำเนินงานลดลงในสองงวดที่เข้ากันได้ แต่หลักฐานนี้ยังไม่ยืนยันว่าค่าใช้จ่ายโตเร็วกว่ารายได้หรือเป็นสาเหตุเดียวของการลดลง'; evidenceEn='Expenses increased while operating margin declined across compatible quarters; this does not establish that expenses outgrew revenue or solely caused the margin decline.';
    }
    watchTh='ติดตามการเติบโตของค่าใช้จ่ายเทียบรายได้และอัตรากำไร รวมถึงวิจัยพัฒนาและค่าใช้จ่ายขายบริหาร'; watchEn='Watch expenses relative to revenue and operating margin, including research and selling/administrative costs.';
  } else if (key==='total_assets') {
    const revenue=trend(related('revenue')), roic=trend(related('roic')), turnover=trend(related('asset_turnover'));
    if(direction===1 && revenue!==null && roic!==null && turnover!==null) {
      assessment=revenue>=0&&roic>=0&&turnover>=0?'favorable':roic<0||turnover<0?'mixed':'unclear';
      evidenceTh=assessment==='favorable'?'สินทรัพย์เพิ่มพร้อมยอดขายและประสิทธิภาพทุนที่ไม่ลดลงในสองงวดที่เข้ากันได้ จึงมีบริบทสนับสนุน แต่ยังไม่ยืนยันคุณภาพสินทรัพย์ทั้งหมด':'สินทรัพย์เพิ่มแต่ประสิทธิภาพทุนหรือการหมุนเวียนสินทรัพย์ลดลง จึงไม่สรุปว่าการขยายฐานสินทรัพย์ดีขึ้น';
      evidenceEn=assessment==='favorable'?'Assets increased alongside non-declining sales and capital efficiency across compatible quarters; this does not prove all asset quality.':'Assets expanded while capital efficiency or asset turnover declined; expansion alone is not favorable.';
    }
    watchTh='ติดตามรายได้ ROA ROIC อัตราหมุนเวียนสินทรัพย์ และเงินทุนหรือหนี้ที่ใช้รองรับสินทรัพย์'; watchEn='Watch revenue, ROA, ROIC, asset turnover and the equity/debt funding the asset base.';
  } else if (key==='revenue') {
    const opMargin=trend(related('operating_margin')), cash=trend(related('operating_cash_flow'));
    if(direction===1 && opMargin!==null && cash!==null) {
      assessment=opMargin<0||cash<0?'mixed':'favorable';
      evidenceTh=assessment==='mixed'?'รายได้เพิ่มในสองงวดที่เข้ากันได้ แต่กำไรต่อยอดขายหรือเงินสดดำเนินงานลดลง จึงยังไม่ยืนยันคุณภาพของการเติบโต':'รายได้เพิ่มพร้อมอัตรากำไรและเงินสดที่ไม่ลดลงในสองงวดที่เข้ากันได้ แต่ต้องติดตามความต่อเนื่อง';
      evidenceEn=assessment==='mixed'?'Sales increased across compatible supplied quarters while operating margin or operating cash declined; growth quality is mixed.':'Sales increased alongside non-declining operating margin and cash across compatible supplied quarters; persistence still matters.';
    }
    watchTh='ติดตามว่าต้นทุนและค่าใช้จ่ายโตเร็วกว่ายอดขายหรือไม่ พร้อมกำไรและกระแสเงินสดอิสระ'; watchEn='Watch cost and expense growth relative to sales, with margins and free cash flow.';
  } else if (key==='inventory') {
    watchTh='ติดตามสินค้าค้าง อายุสินค้า ยอดขาย และอัตราหมุนเวียน ยอดเพิ่มหรือลดและเงินสดที่ปล่อยออกไม่ยืนยันว่าการจัดการดีขึ้น'; watchEn='Watch aging, sales and turnover; a balance movement or cash release alone does not establish better inventory management.';
  } else if (key==='total_debt') {
    watchTh='ติดตามเงินสด กระแสเงินสดดำเนินงาน วันครบกำหนดหนี้ และต้นทุนดอกเบี้ย การมีหนี้เพิ่มหรือลดอย่างเดียวไม่ใช่คำตัดสิน'; watchEn='Watch cash, operating cash, maturities and interest costs; debt direction alone is not a verdict.';
  } else if (key==='capex') {
    watchTh='ติดตามเงินสดดำเนินงานและ FCF พร้อมหลักฐานว่ารายจ่ายใช้รักษากำลังผลิตหรือขยายธุรกิจ ไม่ถือว่าจ่ายมากหรือน้อยดีกว่าเสมอ'; watchEn='Watch operating cash and FCF with evidence distinguishing maintenance from expansion; neither spending direction is automatically better.';
  } else if (policy==='RANGE_DEPENDENT') {
    watchTh='ตรวจคุณภาพสินทรัพย์สภาพคล่อง เงินสดดำเนินงาน และจังหวะหนี้ครบกำหนด ไม่มีเกณฑ์ตัวเลขสากลที่ยืนยันว่าค่าสูงดีกว่า'; watchEn='Watch liquid-asset quality, operating cash and maturity timing; a higher ratio alone does not prove stronger liquidity.';
  } else if (policy==='DIRECTION_DEPENDENT') {
    evidenceTh='นี่คือผลต่อกระแสเงินสด: ค่าบวกช่วยเพิ่มเงินสด ค่าลบใช้เงินสด ไม่ใช่การเปลี่ยนยอดงบดุลและไม่ใช่คำตัดสินว่าดีหรือแย่'; evidenceEn='This is a cash-flow effect: positive contributes cash and negative consumes cash, not a balance-sheet movement or a quality verdict.';
  }
  return { policy, assessment, evidence:{th:evidenceTh,en:evidenceEn}, watch:{th:watchTh,en:watchEn}, comparisonBasis:'Compatible adjacent supplied quarters; qualitative relationships only, not YoY or causal attribution.' };
}
