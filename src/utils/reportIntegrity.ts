import type { ReportData } from '../types';
import { buildMarketSnapshot, type MarketSnapshot } from '../domain/marketSnapshot';
import { buildCanonicalFinancialDataset, type CanonicalFinancialDataset } from '../domain/financialValue';
import { buildDataGapInventory } from '../domain/dataCompleteness/gapInventory';
import { buildRigorousDCFModel } from './valuation/dcfMathEngine';
import { calculateDeterministicConvictionScore } from './valuation/convictionScorer';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

type ReportWithCanonicalData = ReportData & {
  market_snapshot?: MarketSnapshot;
  canonical_financials?: CanonicalFinancialDataset;
};

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
  const result = structuredClone(input) as ReportWithCanonicalData;
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

  // Build a non-destructive provenance view over the statement arrays. This does not
  // rewrite financial values and does not promote linked sources to independently verified data.
  const canonicalFinancials = buildCanonicalFinancialDataset(result);
  if (canonicalFinancials) result.canonical_financials = canonicalFinancials;
  else delete result.canonical_financials;

  const gapInventory = buildDataGapInventory(result);
  result.data_completeness = gapInventory.summary;

  // Keep dated research intact. Explicit quote refresh updates only current market fields.
  // All current-price consumers use the same canonical snapshot so DCF cannot remain on a stale AI-supplied price.
  const symbol = (ticker || result.ticker || '').toUpperCase();
  const quote = live?.[symbol];
  const marketSnapshot = buildMarketSnapshot(symbol, quote);
  if (marketSnapshot) {
    result.market_snapshot = marketSnapshot;

    if (result.company_profile) {
      result.company_profile.stock_price = marketSnapshot.price;
      if (finite(marketSnapshot.change)) result.company_profile.price_change = marketSnapshot.change;
      if (finite(marketSnapshot.changePercent)) result.company_profile.price_change_pct = marketSnapshot.changePercent;
      if (typeof quote?.marketCap === 'string' && quote.marketCap.trim()) result.company_profile.market_cap = quote.marketCap;
      if (finite(marketSnapshot.fiftyTwoWeekHigh)) result.company_profile.fifty_two_week_high = marketSnapshot.fiftyTwoWeekHigh;
      if (finite(marketSnapshot.fiftyTwoWeekLow)) result.company_profile.fifty_two_week_low = marketSnapshot.fiftyTwoWeekLow;
    }

    if (result.intrinsic_value) result.intrinsic_value.current_price = marketSnapshot.price;
    if (result.technical_analysis?.key_levels) result.technical_analysis.key_levels.current_price = marketSnapshot.price;
    if (result.forecast_dashboard?.price_target) {
      result.forecast_dashboard.price_target.current_price = marketSnapshot.price;
      const mean = result.forecast_dashboard.price_target.mean;
      result.forecast_dashboard.price_target.implied_upside_pct = finite(mean)
        ? rounded((mean - marketSnapshot.price) / marketSnapshot.price * 100)
        : undefined;
    }
  }

  // Preserve deterministic validation_summary when it was produced by the production validator.
  // Its filing_source remains unset unless real source metadata exists.

  // Recalculate DCF from the disclosed four-quarter dataset. Historical AI price targets
  // are never retained when the report cannot supply every required input.
  if (result.intrinsic_value) {
    const intrinsic = result.intrinsic_value;
    const validationBlocksValuation = result.validation?.issues?.some(issue =>
      issue.severity === 'critical'
      && ['financial_statements', 'valuation', 'cross_section', 'market_data'].includes(issue.section)
    ) ?? false;

    const { dcfModel, inputs } = buildRigorousDCFModel(result, ticker || result.ticker);
    intrinsic.dcf_model = dcfModel;
    const base = dcfModel.scenarios.base.fair_value_per_share;
    const bear = dcfModel.scenarios.bear.fair_value_per_share;
    const bull = dcfModel.scenarios.bull.fair_value_per_share;

    if (!validationBlocksValuation
      && inputs.isValid
      && finite(base)
      && finite(bear)
      && finite(bull)
      && finite(inputs.currentPrice)
      && inputs.currentPrice > 0) {
      intrinsic.summary = {
        ...intrinsic.summary,
        fair_value_range_low: bear,
        fair_value_range_high: bull,
        base_case_fair_value: base,
        margin_of_safety_pct: rounded((base - inputs.currentPrice) / inputs.currentPrice * 100),
        verdict_text: 'Canonical DCF recalculated from the financial inputs disclosed in this report. Review the scenario assumptions and margin of safety shown above.',
      };
      intrinsic.validation_alerts = (intrinsic.validation_alerts || []).filter(alert =>
        alert.code !== 'VALUATION_INPUTS_INCOMPLETE' && alert.code !== 'REPORT_VALIDATION_BLOCK'
      );
    } else {
      intrinsic.summary = {
        ...intrinsic.summary,
        fair_value_range_low: null,
        fair_value_range_high: null,
        base_case_fair_value: null,
        margin_of_safety_pct: null,
        verdict_text: validationBlocksValuation
          ? 'Valuation unavailable because critical data-validation checks failed.'
          : 'Valuation unavailable until required filing inputs are supplied.',
      };
      intrinsic.relative_valuation = undefined;
      intrinsic.relative_only_model = undefined;
      intrinsic.validation_alerts = [
        ...(intrinsic.validation_alerts || []).filter(alert =>
          alert.code !== 'VALUATION_INPUTS_INCOMPLETE' && alert.code !== 'REPORT_VALIDATION_BLOCK'
        ),
        {
          type: 'error',
          code: validationBlocksValuation ? 'REPORT_VALIDATION_BLOCK' : 'VALUATION_INPUTS_INCOMPLETE',
          message_th: validationBlocksValuation
            ? 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูลไม่ผ่านการตรวจสอบความสอดคล้องที่สำคัญ'
            : 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูล DCF จากงบยังไม่ครบหรือไม่อยู่ในงวดเดียวกัน',
          message_en: validationBlocksValuation
            ? 'Valuation is unavailable because critical report-validation checks failed.'
            : 'Valuation is unavailable because the required DCF inputs are missing or are not from the same reporting period.',
          detail: validationBlocksValuation
            ? result.validation?.issues?.filter(issue => issue.severity === 'critical').map(issue => issue.code).join('; ')
            : inputs.missingFields?.join('; '),
        },
      ];
    }
  }

  // The report model may suggest qualitative factor scores on a 1-10 scale, but
  // the public conviction score is a separate 0-100 calculation. Never present
  // an arbitrary model-produced number as the deterministic conviction score.
  if (result.analysis_type !== 'technical' && result.verdict) {
    const conviction = calculateDeterministicConvictionScore(result, ticker || result.ticker);
    result.verdict.conviction_score = conviction?.conviction_score ?? null;
    if (conviction) result.verdict.conviction_breakdown = conviction.conviction_breakdown;
    else delete result.verdict.conviction_breakdown;
  }
  return result;
}
