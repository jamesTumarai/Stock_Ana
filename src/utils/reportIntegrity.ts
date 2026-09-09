import type { ReportData } from '../types';
import { buildRigorousDCFModel } from './valuation/dcfMathEngine';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

/** Match fiscal labels, not adjacent array positions; incomplete history stays unavailable. */
export function periodChanges(values: (number | null | undefined)[], periods: string[], mode: string, reported?: (number | null)[]): (number | null)[] {
  return values.map((value, i) => {
    if (mode === 'hide' || !finite(value)) return null;
    const label = periods[i] || '';
    const year = label.match(/\b(20\d{2})\b/);
    const quarter = label.match(/Q([1-4])/i);
    let previous = -1;
    if (year && quarter) {
      const y = Number(year[1]); const q = Number(quarter[1]);
      const py = mode === 'yoy' ? y - 1 : q === 1 ? y - 1 : y;
      const pq = mode === 'yoy' ? q : q === 1 ? 4 : q - 1;
      previous = periods.findIndex(p => p.match(/\b(20\d{2})\b/)?.[1] === String(py) && p.match(/Q([1-4])/i)?.[1] === String(pq));
    }
    const baseline = values[previous];
    if (finite(baseline) && baseline !== 0) return rounded((value - baseline) / Math.abs(baseline) * 100);
    return mode === 'yoy' && finite(reported?.[i]) ? reported![i]! : null;
  });
}

/** No ticker-specific overrides, fabricated history, forced balancing or synthetic forecasts. */
export function normalizeReport(input?: ReportData, ticker?: string, live?: Record<string, any>): ReportData {
  if (!input) return {} as ReportData;
  const result: ReportData = structuredClone(input);
  const fs = result.financial_statements;
  const lastIndex = (fs?.periods?.length || 0) - 1;
  const at = (a?: (number | null)[]) => finite(a?.[lastIndex]) ? a![lastIndex]! : undefined;
  const bs = fs?.balance_sheet;
  const cash = at(bs?.cash_and_equivalents);
  const investments = at(bs?.short_term_investments);
  const debt = at(bs?.total_debt);
  const totalCash = cash !== undefined && investments !== undefined ? cash + investments : undefined;
  const net = totalCash !== undefined && debt !== undefined ? rounded((totalCash - debt) / 1000) : undefined;
  const equity = at(bs?.total_equity);
  const ratio = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && b > 0 ? rounded(a / b * 100) : undefined;
  const inc = fs?.income_statement;
  const revenue = at(inc?.revenue);
  result.five_pillars ||= {growth:{},profitability:{},balance_sheet:{},yields:{},peer_matrix:[]};
  result.five_pillars.growth = { revenue_growth_yoy_pct: at(inc?.yoy_revenue_growth_pct) };
  result.five_pillars.profitability = {
    gross_margin_pct: ratio(at(inc?.gross_profit), revenue),
    operating_margin_pct: ratio(at(inc?.operating_income), revenue),
    net_margin_pct: ratio(at(inc?.net_income), revenue),
  };
  const pe = result.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward|PEG/i.test(r.name))?.value;
  const pfcf = result.valuation_ratios?.find(r => /P\/FCF/i.test(r.name))?.value;
  result.five_pillars.yields = {
    pe_multiple: finite(pe) ? pe : undefined,
    earnings_yield_pct: finite(pe) && pe > 0 ? rounded(100 / pe) : undefined,
    pfcf_multiple: finite(pfcf) ? pfcf : undefined,
    fcf_yield_pct: finite(pfcf) && pfcf > 0 ? rounded(100 / pfcf) : undefined,
  };
  if (result.five_pillars) {
    // Remove synthetic benchmark fields produced by older versions. A source-aware benchmark feed is required.
    result.five_pillars.peer_matrix = [];
    result.five_pillars.balance_sheet = {
      total_cash_and_investments_b: totalCash === undefined ? undefined : rounded(totalCash / 1000),
      total_debt_b: debt === undefined ? undefined : rounded(debt / 1000),
      net_cash_or_debt_b: net === undefined ? undefined : Math.abs(net),
      is_net_cash: net === undefined ? undefined : net >= 0,
      debt_to_equity: debt !== undefined && equity !== undefined && equity > 0 ? rounded(debt / equity) : undefined,
      solvency_score_label: 'เงินสดสุทธิใช้เงินสด + เงินลงทุนระยะสั้น − หนี้มีดอกเบี้ย ในงวดเดียวกัน (ไม่รวมเงินลงทุนระยะยาว)'
    };
    result.five_pillars.analyst_takeaway = 'ข้อมูลจากรายงานที่บันทึกไว้ ไม่ใช่การรับรองจาก SEC; ควรตรวจงวดบัญชีและเอกสารต้นทางก่อนใช้ประเมินมูลค่า';
  }
  // Accounting consistency alone is not evidence that a filing was retrieved or reconciled.
  if (fs) fs.validation_summary = undefined;
  // Keep dated research intact. Explicit refresh updates only the displayed quote, never historical narratives.
  const quote = live?.[(ticker || result.ticker || '').toUpperCase()];
  if (quote && result.company_profile && finite(quote.price)) result.company_profile.stock_price = quote.price;

  // Recalculate DCF from the disclosed four-quarter dataset. Historical AI price targets
  // are never retained when the report cannot supply every required input.
  if (result.intrinsic_value) {
    const { dcfModel, inputs } = buildRigorousDCFModel(result, ticker || result.ticker);
    const intrinsic = result.intrinsic_value;
    intrinsic.dcf_model = dcfModel;
    if (inputs.isValid) {
      const base = dcfModel.scenarios.base.fair_value_per_share;
      const bear = dcfModel.scenarios.bear.fair_value_per_share;
      const bull = dcfModel.scenarios.bull.fair_value_per_share;
      intrinsic.summary = {
        ...intrinsic.summary,
        fair_value_range_low: bear,
        fair_value_range_high: bull,
        base_case_fair_value: base,
        margin_of_safety_pct: inputs.currentPrice > 0 ? rounded((base - inputs.currentPrice) / inputs.currentPrice * 100) : 0,
      };
      intrinsic.validation_alerts = (intrinsic.validation_alerts || []).filter(alert => alert.code !== 'VALUATION_INPUTS_INCOMPLETE');
    } else {
      intrinsic.summary = {
        ...intrinsic.summary,
        fair_value_range_low: 0,
        fair_value_range_high: 0,
        base_case_fair_value: 0,
        margin_of_safety_pct: 0,
        verdict_text: 'Valuation unavailable until required filing inputs are supplied.',
      };
      intrinsic.relative_valuation = undefined;
      intrinsic.validation_alerts = [
        ...(intrinsic.validation_alerts || []).filter(alert => alert.code !== 'VALUATION_INPUTS_INCOMPLETE'),
        {
          type: 'error',
          code: 'VALUATION_INPUTS_INCOMPLETE',
          message_th: 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูล DCF จากงบยังไม่ครบหรือไม่อยู่ในงวดเดียวกัน',
          message_en: 'Valuation is unavailable because the required DCF inputs are missing or are not from the same reporting period.',
          detail: inputs.missingFields?.join('; '),
        },
      ];
    }
  }
  return result;
}
