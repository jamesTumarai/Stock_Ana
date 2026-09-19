import type { ReportData } from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext';
import { findKeyIndicatorInSource } from '../metricLineage';

export type MetricResolutionStatus =
  | 'CALCULATED'
  | 'REPORTED'
  | 'UNAVAILABLE'
  | 'BASIS_MISMATCH'
  | 'TURNAROUND'
  | 'DETERIORATION'
  | 'INSUFFICIENT_HISTORY'
  | 'NOT_APPLICABLE'
  | 'GUARDED';

export interface ResolvedMetricItem<T = number> {
  value?: T;
  basis?: string;
  period?: string;
  formula?: string;
  source?: string;
  status: MetricResolutionStatus;
  reason?: string;
  reasonTh?: string;
  isGuarded?: boolean;
}

export interface ResolvedFundamentalMetrics {
  ticker: string;
  archetype: BusinessArchetype;
  asOfDate?: string;

  revenueGrowthYoY: ResolvedMetricItem;
  epsGrowthYoY: ResolvedMetricItem;
  revenueCagr3Y: ResolvedMetricItem;
  fcfGrowthYoY: ResolvedMetricItem;

  grossMargin: ResolvedMetricItem;
  operatingMargin: ResolvedMetricItem;
  netMargin: ResolvedMetricItem;

  roe: ResolvedMetricItem;
  roa: ResolvedMetricItem;
  roic: ResolvedMetricItem;

  fcfYield: ResolvedMetricItem;
  earningsYield: ResolvedMetricItem;

  peTrailing: ResolvedMetricItem;
  peForward: ResolvedMetricItem;
  peg: ResolvedMetricItem;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

/**
 * Resolves all canonical fundamental metrics from verified facts and statements into a single,
 * unified domain registry. This ensures Five Pillars, Peer Benchmark target row, and DCF/scoring
 * share identical numbers and provenance without component-specific re-calculations.
 */
export function resolveFundamentalMetrics(
  report: Partial<ReportData>,
  ticker?: string
): ResolvedFundamentalMetrics {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);
  const fs = report.financial_statements;
  const periods = fs?.periods || [];
  const lastIndex = Math.max(0, periods.length - 1);
  const latestPeriod = periods[lastIndex] || 'Latest';

  const at = (arr?: (number | null)[]) => (finite(arr?.[lastIndex]) ? arr![lastIndex]! : undefined);

  // Helper to retrieve verified key indicators
  const getKi = (key: string): number | undefined => {
    const rootKi = report.key_indicators as any;
    if (rootKi?.[key] !== undefined && finite(rootKi[key])) return rootKi[key];
    for (const subKey of ['growth', 'profitability', 'valuation', 'financial_health', 'per_share']) {
      if (rootKi?.[subKey]?.[key] !== undefined && finite(rootKi[subKey][key])) {
        return rootKi[subKey][key];
      }
    }
    const found = findKeyIndicatorInSource(fs?.key_indicators, key) || findKeyIndicatorInSource(rootKi, key);
    if (found && found.values.length > 0) {
      const val = found.values[found.values.length - 1];
      if (finite(val)) return val;
    }
    return undefined;
  };

  const inc = fs?.income_statement;
  const bs = fs?.balance_sheet;
  const cf = fs?.cash_flow;

  const rev = at(inc?.revenue);
  const netInc = at(inc?.net_income);
  const opInc = at(inc?.operating_income);
  const grossProfit = at(inc?.gross_profit);

  const cash = at(bs?.cash_and_equivalents);
  const stInvestments = at(bs?.short_term_investments);
  const totalDebt = at(bs?.total_debt) ?? (
    at(bs?.short_term_debt) !== undefined || at(bs?.long_term_debt) !== undefined
      ? (at(bs?.short_term_debt) ?? 0) + (at(bs?.long_term_debt) ?? 0)
      : undefined
  );
  const totalEquity = at(bs?.total_equity);
  const totalAssets = at(bs?.total_assets);

  const totalCash = cash !== undefined
    ? cash + (stInvestments ?? 0)
    : undefined;

  // 1. P/E (Trailing & Forward)
  let peVal: number | undefined;
  let peBasis: 'TTM' | 'FY' | 'REPORTED' | 'FORWARD' = 'TTM';
  let peSource = 'Valuation Ratios';

  const peMatch = report.valuation_ratios?.find(r => /(?:trailing.*P\/E|P\/E.*trailing|\bP\/E\b|price.*to.*earnings|trailing.*pe)/i.test(r.name) && !/forward|PEG/i.test(r.name));
  if (finite(peMatch?.value) && peMatch.value > 0) {
    peVal = peMatch.value;
    peSource = `Valuation Ratios (${peMatch.name})`;
  } else if (finite(getKi('pe_trailing')) && getKi('pe_trailing')! > 0) {
    peVal = getKi('pe_trailing')!;
    peSource = 'Key Indicators (pe_trailing)';
  } else if (finite(getKi('pe_ratio')) && getKi('pe_ratio')! > 0) {
    peVal = getKi('pe_ratio')!;
    peSource = 'Key Indicators (pe_ratio)';
  } else if (finite((report as any)?.valuation_dashboard?.pe_ratio?.current_pe) && (report as any).valuation_dashboard.pe_ratio.current_pe > 0) {
    peVal = (report as any).valuation_dashboard.pe_ratio.current_pe;
    peSource = 'Valuation Dashboard (current_pe)';
  } else if (finite(report.five_pillars?.yields?.pe_multiple) && report.five_pillars!.yields.pe_multiple > 0) {
    peVal = report.five_pillars!.yields.pe_multiple;
    peSource = 'Five Pillars Yields';
  } else if (finite((report as any)?.market_snapshot?.pe) && (report as any).market_snapshot.pe > 0) {
    peVal = (report as any).market_snapshot.pe;
    peSource = 'Market Snapshot';
  }

  const peTrailing: ResolvedMetricItem = {
    value: peVal,
    basis: peBasis,
    period: latestPeriod,
    source: peSource,
    status: finite(peVal) ? 'REPORTED' : 'UNAVAILABLE',
    reason: finite(peVal) ? undefined : 'Current P/E unavailable',
    reasonTh: finite(peVal) ? undefined : 'ข้อมูล P/E ปัจจุบันไม่พร้อมใช้งาน',
  };

  const fwdMatch = report.valuation_ratios?.find(r => /forward.*P\/E|P\/E.*forward|forward.*pe/i.test(r.name));
  const fwdPeVal = finite(fwdMatch?.value) && fwdMatch.value > 0
    ? fwdMatch.value
    : finite(getKi('forward_pe')) && getKi('forward_pe')! > 0
      ? getKi('forward_pe')!
      : finite((report as any)?.valuation_dashboard?.pe_ratio?.forward_pe) && (report as any).valuation_dashboard.pe_ratio.forward_pe > 0
        ? (report as any).valuation_dashboard.pe_ratio.forward_pe
        : undefined;

  const peForward: ResolvedMetricItem = {
    value: fwdPeVal,
    basis: 'FORWARD',
    period: 'Next 12 Months',
    source: fwdMatch ? `Valuation Ratios (${fwdMatch.name})` : 'Key Indicators / Dashboard',
    status: finite(fwdPeVal) ? 'REPORTED' : 'UNAVAILABLE',
    reason: finite(fwdPeVal) ? undefined : 'Forward P/E unavailable',
    reasonTh: finite(fwdPeVal) ? undefined : 'ข้อมูล Forward P/E ไม่พร้อมใช้งาน',
  };

  // 2. Revenue Growth YoY
  const rawRevGrowth = at(inc?.yoy_revenue_growth_pct) ?? getKi('revenue_growth_yoy_pct');
  const revenueGrowthYoY: ResolvedMetricItem = {
    value: rawRevGrowth,
    basis: 'YoY',
    period: latestPeriod,
    source: inc?.yoy_revenue_growth_pct ? 'Income Statement' : 'Key Indicators',
    status: finite(rawRevGrowth) ? 'REPORTED' : 'UNAVAILABLE',
    reason: finite(rawRevGrowth) ? undefined : 'Revenue growth history unavailable',
    reasonTh: finite(rawRevGrowth) ? undefined : 'ข้อมูลการเติบโตของรายได้ไม่พร้อมใช้งาน',
  };

  // 3. EPS Growth YoY
  let epsGrowthVal = at((inc as any)?.yoy_eps_growth_pct) ?? getKi('yoy_eps_growth_pct') ?? getKi('eps_growth') ?? getKi('eps_growth_yoy_pct');
  let epsGrowthBasis: string = 'TTM';
  if (epsGrowthVal === undefined && (getKi('eps_growth_forward_pct') !== undefined || getKi('forward_eps_growth') !== undefined)) {
    epsGrowthVal = getKi('eps_growth_forward_pct') ?? getKi('forward_eps_growth');
    epsGrowthBasis = 'FORWARD';
  }
  let epsGrowthStatus: MetricResolutionStatus = finite(epsGrowthVal) ? 'REPORTED' : 'UNAVAILABLE';
  let epsGrowthReason: string | undefined;
  let epsGrowthReasonTh: string | undefined;

  if (epsGrowthVal === undefined && inc?.eps_diluted && inc.eps_diluted.length >= 2) {
    const epsArr = inc.eps_diluted;
    const curEps = epsArr[epsArr.length - 1];
    const priorIndex = epsArr.length >= 5 ? epsArr.length - 5 : (epsArr.length === 4 ? 0 : epsArr.length - 2);
    const priorEps = epsArr[priorIndex];

    if (finite(curEps) && finite(priorEps)) {
      if (priorEps > 0 && curEps > 0) {
        epsGrowthVal = rounded(((curEps / priorEps) - 1) * 100);
        epsGrowthBasis = 'TTM';
        epsGrowthStatus = 'CALCULATED';
      } else if (priorEps < 0 && curEps > 0) {
        epsGrowthStatus = 'TURNAROUND';
        epsGrowthReason = 'Turnaround: Loss to Profit';
        epsGrowthReasonTh = 'EPS เปลี่ยนจากขาดทุนเป็นกำไร จึงไม่ใช้เปอร์เซ็นต์เติบโตนี้คำนวณ PEG';
      } else if (priorEps < 0 && curEps < 0) {
        epsGrowthStatus = 'UNAVAILABLE';
        epsGrowthReason = 'Both periods negative (EPS Growth not meaningful)';
        epsGrowthReasonTh = 'ผลกำไรสุทธิติดลบทั้งสองช่วงเวลา จึงไม่สามารถคำนวณอัตราเติบโตที่มีนัยสำคัญได้';
      } else if (priorEps === 0) {
        epsGrowthStatus = 'UNAVAILABLE';
        epsGrowthReason = 'Prior period EPS is zero';
        epsGrowthReasonTh = 'กำไรต่อหุ้นในงวดก่อนหน้ามีค่าเป็นศูนย์';
      }
    }
  }

  const epsGrowthYoY: ResolvedMetricItem = {
    value: finite(epsGrowthVal) ? epsGrowthVal : null,
    basis: epsGrowthBasis,
    period: latestPeriod,
    source: inc?.eps_diluted ? 'SEC Diluted EPS YoY' : 'Key Indicators',
    status: epsGrowthStatus,
    reason: epsGrowthReason,
    reasonTh: epsGrowthReasonTh,
  };

  // 4. PEG Ratio (relates P/E to EPS Growth with basis compatibility)
  let pegVal: number | undefined;
  let pegStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let pegReason = 'PEG unavailable';
  let pegReasonTh = 'ข้อมูลการเติบโตของกำไรต่อหุ้น (EPS Growth) ไม่พร้อมใช้งาน จึงไม่สามารถคำนวณ PEG Ratio ได้';
  const isPreProfit = archetype === 'early_stage' || (netInc !== undefined && netInc <= 0);

  if (isFinancial) {
    pegStatus = 'GUARDED';
    pegReason = 'PEG not applicable to financial institutions';
    pegReasonTh = 'PEG ไม่เหมาะกับสถาบันการเงินเนื่องจากโครงสร้างกำไรและเงินทุนอิง Net Interest Spread';
  } else if (archetype === 'reit') {
    pegStatus = 'NOT_APPLICABLE';
    pegReason = 'PEG not applicable to REITs';
    pegReasonTh = 'PEG ไม่เหมาะกับกองทรัสต์อสังหาริมทรัพย์ (REIT) เนื่องจากกำไรสุทธิทางบัญชีถูกบิดเบือนจากค่าเสื่อมราคา';
  } else if (isPreProfit) {
    pegStatus = 'NOT_APPLICABLE';
    pegReason = 'PEG not applicable to pre-profit companies';
    pegReasonTh = 'PEG ไม่เหมาะกับบริษัทที่ยังไม่มีกำไรสุทธิสม่ำเสมอ';
  } else if (epsGrowthStatus === 'TURNAROUND') {
    pegStatus = 'TURNAROUND';
    pegReason = 'TURNAROUND_NOT_MEANINGFUL';
    pegReasonTh = 'EPS เปลี่ยนจากขาดทุนเป็นกำไร จึงไม่ใช้เปอร์เซ็นต์เติบโตนี้คำนวณ PEG';
  } else if (finite(peVal) && peVal > 0) {
    // Basis Compatibility check
    // Trailing P/E must be paired with TTM/historical EPS growth; Forward P/E with Forward EPS growth
    const isBasisCompatible = (peBasis === 'TTM' && (epsGrowthBasis === 'TTM' || epsGrowthBasis === 'YoY'))
      || ((peBasis as string) === 'FORWARD' && epsGrowthBasis === 'FORWARD');

    if (!isBasisCompatible && epsGrowthVal !== undefined) {
      pegStatus = 'BASIS_MISMATCH';
      pegReason = 'BASIS_MISMATCH';
      pegReasonTh = 'ยังไม่สามารถคำนวณ PEG ได้ เนื่องจาก P/E และ EPS Growth ใช้คนละฐานช่วงเวลา';
    } else if (finite(epsGrowthVal) && epsGrowthVal > 0) {
      pegVal = rounded(peVal / epsGrowthVal);
      pegStatus = 'CALCULATED';
      pegReason = `PEG ${pegVal}x`;
      pegReasonTh = pegVal < 1.0
        ? `PEG ${pegVal}x สะท้อนราคาที่เติบโตสมเหตุสมผลเมื่อเทียบกับการเติบโตของกำไร EPS (+${epsGrowthVal}%)`
        : pegVal <= 2.0
          ? `PEG ${pegVal}x อยู่ในเกณฑ์มาตรฐานของกลุ่มอุตสาหกรรม`
          : `PEG ${pegVal}x สะท้อนความคาดหวังการเติบโตในราคาสูง (Premium Valuation)`;
    } else if (finite(epsGrowthVal) && epsGrowthVal <= 0) {
      pegStatus = 'UNAVAILABLE';
      pegReason = 'Negative or zero EPS growth';
      pegReasonTh = 'PEG ไม่สามารถคำนวณได้เนื่องจากอัตราเติบโตของกำไร (EPS Growth) ติดลบหรือเท่ากับศูนย์';
    } else {
      pegStatus = 'UNAVAILABLE';
      pegReason = 'INSUFFICIENT_EPS_HISTORY';
      pegReasonTh = 'ข้อมูล EPS เปรียบเทียบยังไม่เพียงพอ';
    }
  }

  const peg: ResolvedMetricItem = {
    value: finite(pegVal) ? pegVal : null,
    basis: peBasis,
    period: latestPeriod,
    formula: 'P/E Ratio / EPS Growth Rate (%)',
    source: 'Resolved P/E & Resolved EPS Growth',
    status: pegStatus,
    reason: pegReason,
    reasonTh: pegReasonTh,
  };

  // 5. ROIC (Deterministic NOPAT / Average Invested Capital)
  let roicVal = getKi('roic') ?? getKi('roic_pct');
  let roicBasis = 'Reported';
  let roicFormula: string | undefined;
  let roicStatus: MetricResolutionStatus = finite(roicVal) ? 'REPORTED' : 'UNAVAILABLE';
  let roicReason: string | undefined;
  let roicReasonTh: string | undefined;

  if (isFinancial) {
    roicVal = undefined;
    roicStatus = 'GUARDED';
    roicReason = 'ROIC guarded for financial institutions';
    roicReasonTh = 'ROIC ไม่ใช้กับสถาบันการเงินเนื่องจากเงินฝากเป็นสินค้าคงคลังดำเนินงาน (เน้น ROE/ROA)';
  } else if (roicVal === undefined) {
    if (opInc !== undefined && totalEquity !== undefined && totalDebt !== undefined && totalCash !== undefined) {
      const taxExp = at(inc?.income_tax_expense);
      const ebt = at(inc?.income_before_tax);
      const effTaxRate = (taxExp !== undefined && ebt !== undefined && ebt > 0 && taxExp >= 0 && taxExp <= ebt)
        ? taxExp / ebt
        : 0.21;
      const nopat = opInc * (1 - effTaxRate);
      const endingIC = totalEquity + totalDebt - totalCash;

      const eqArr = bs?.total_equity || [];
      const debtArr = bs?.total_debt || [];
      const cashArr = bs?.cash_and_equivalents || [];
      const stArr = bs?.short_term_investments || [];
      let avgIC = endingIC;

      if (eqArr.length >= 2) {
        const beginEq = eqArr[0];
        const beginDebt = debtArr[0] ?? 0;
        const beginCash = (cashArr[0] ?? 0) + (stArr[0] ?? 0);
        if (finite(beginEq) && finite(beginDebt)) {
          const beginIC = beginEq + beginDebt - beginCash;
          if (beginIC > 0) {
            avgIC = (beginIC + endingIC) / 2;
            roicBasis = 'NOPAT / Average Invested Capital (Beginning & Ending Period)';
          }
        }
      }
      if (!roicBasis || roicBasis === 'Reported') {
        roicBasis = 'NOPAT / Ending Invested Capital';
      }

      if (avgIC > 0) {
        roicVal = rounded((nopat / avgIC) * 100);
        roicFormula = 'Operating Income × (1 - Tax Rate) / Invested Capital (Equity + Debt - Cash)';
        roicStatus = 'CALCULATED';
      } else {
        roicStatus = 'UNAVAILABLE';
        roicReason = 'Invested capital is non-positive';
        roicReasonTh = 'เงินลงทุนดำเนินงานสุทธิ (Invested Capital) มีค่าติดลบหรือไม่เป็นบวก';
      }
    } else {
      roicStatus = 'UNAVAILABLE';
      roicReason = 'Insufficient verified invested-capital inputs';
      roicReasonTh = 'ข้อมูลสำหรับคำนวณเงินลงทุนสุทธิ (Invested Capital) ไม่เพียงพอ';
    }
  }

  const roic: ResolvedMetricItem = {
    value: roicVal,
    basis: roicBasis,
    period: latestPeriod,
    formula: roicFormula,
    source: roicStatus === 'CALCULATED' ? 'SEC Operating Income & Balance Sheet' : 'Key Indicators',
    status: roicStatus,
    reason: roicReason,
    reasonTh: roicReasonTh,
    isGuarded: isFinancial,
  };

  // 6. ROE & ROA (Independent denominators)
  const roeVal = getKi('roe') ?? getKi('roe_pct') ?? (netInc !== undefined && totalEquity !== undefined && totalEquity > 0 ? rounded((netInc / totalEquity) * 100) : undefined);
  const roe: ResolvedMetricItem = {
    value: roeVal,
    basis: 'TTM',
    period: latestPeriod,
    formula: 'Net Income / Total Equity × 100',
    source: getKi('roe') ? 'Key Indicators' : 'SEC Income Statement & Balance Sheet',
    status: finite(roeVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  const roaVal = getKi('roa') ?? getKi('roa_pct') ?? (netInc !== undefined && totalAssets !== undefined && totalAssets > 0 ? rounded((netInc / totalAssets) * 100) : undefined);
  const roa: ResolvedMetricItem = {
    value: roaVal,
    basis: 'TTM',
    period: latestPeriod,
    formula: 'Net Income / Total Assets × 100',
    source: getKi('roa') ? 'Key Indicators' : 'SEC Income Statement & Balance Sheet',
    status: finite(roaVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  // 7. Margins
  const grossMarginVal = isFinancial ? undefined : (at(inc?.gross_margin_pct) ?? (rev !== undefined && grossProfit !== undefined && rev > 0 ? rounded((grossProfit / rev) * 100) : undefined));
  const grossMargin: ResolvedMetricItem = {
    value: grossMarginVal,
    basis: 'TTM',
    period: latestPeriod,
    status: isFinancial ? 'GUARDED' : finite(grossMarginVal) ? 'REPORTED' : 'UNAVAILABLE',
    isGuarded: isFinancial,
  };

  const opMarginVal = at(inc?.operating_margin_pct) ?? (rev !== undefined && opInc !== undefined && rev > 0 ? rounded((opInc / rev) * 100) : undefined);
  const operatingMargin: ResolvedMetricItem = {
    value: opMarginVal,
    basis: 'TTM',
    period: latestPeriod,
    status: finite(opMarginVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  const netMarginVal = at(inc?.net_margin_pct) ?? (rev !== undefined && netInc !== undefined && rev > 0 ? rounded((netInc / rev) * 100) : undefined);
  const netMargin: ResolvedMetricItem = {
    value: netMarginVal,
    basis: 'TTM',
    period: latestPeriod,
    status: finite(netMarginVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  // 8. FCF Growth YoY (Operating companies only)
  let fcfGrowthVal = isFinancial ? undefined : (at((cf as any)?.yoy_fcf_growth_pct) ?? getKi('fcf_growth'));
  let fcfGrowthStatus: MetricResolutionStatus = isFinancial ? 'GUARDED' : finite(fcfGrowthVal) ? 'REPORTED' : 'UNAVAILABLE';
  let fcfGrowthReason: string | undefined;
  let fcfGrowthReasonTh: string | undefined;

  if (isFinancial) {
    fcfGrowthReason = 'Guarded for financial institutions';
    fcfGrowthReasonTh = 'FCF Growth ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)';
  } else if (fcfGrowthVal === undefined && cf) {
    const fcfArr = cf.free_cash_flow || (
      cf.operating_cash_flow && cf.capex
        ? cf.operating_cash_flow.map((ocf, idx) => (ocf !== null && cf.capex?.[idx] !== null ? ocf! - Math.abs(cf.capex![idx]!) : null))
        : []
    );
    if (fcfArr.length >= 2) {
      const curFCF = fcfArr[fcfArr.length - 1];
      const priorIndex = fcfArr.length >= 5 ? fcfArr.length - 5 : (fcfArr.length === 4 ? 0 : fcfArr.length - 2);
      const priorFCF = fcfArr[priorIndex];

      if (finite(curFCF) && finite(priorFCF)) {
        if (priorFCF > 0 && curFCF > 0) {
          fcfGrowthVal = rounded(((curFCF / priorFCF) - 1) * 100);
          fcfGrowthStatus = 'CALCULATED';
        } else if (priorFCF < 0 && curFCF > 0) {
          fcfGrowthStatus = 'TURNAROUND';
          fcfGrowthReason = 'TURNAROUND';
          fcfGrowthReasonTh = 'กระแสเงินสดอิสระ (FCF) พลิกฟื้นจากติดลบกลับมาเป็นบวก';
        } else if (priorFCF > 0 && curFCF < 0) {
          fcfGrowthStatus = 'DETERIORATION';
          fcfGrowthReason = 'DETERIORATION_FROM_POSITIVE_TO_NEGATIVE';
          fcfGrowthReasonTh = 'กระแสเงินสดอิสระ (FCF) ปรับตัวลดลงจากบวกเป็นติดลบ';
        } else if (priorFCF < 0 && curFCF < 0) {
          fcfGrowthStatus = 'UNAVAILABLE';
          fcfGrowthReason = 'Both periods negative FCF';
          fcfGrowthReasonTh = 'กระแสเงินสดอิสระติดลบทั้งสองช่วงเวลา';
        } else if (priorFCF === 0) {
          fcfGrowthStatus = 'UNAVAILABLE';
          fcfGrowthReason = 'Prior period FCF is zero';
          fcfGrowthReasonTh = 'กระแสเงินสดอิสระในงวดก่อนหน้ามีค่าเป็นศูนย์';
        }
      }
    }
  }

  const fcfGrowthYoY: ResolvedMetricItem = {
    value: finite(fcfGrowthVal) ? fcfGrowthVal : null,
    basis: 'YoY',
    period: latestPeriod,
    source: cf?.free_cash_flow ? 'Cash Flow Statement' : 'Key Indicators',
    status: fcfGrowthStatus,
    reason: fcfGrowthReason,
    reasonTh: fcfGrowthReasonTh,
    isGuarded: isFinancial,
  };

  // 9. 3Y Revenue CAGR (Annual history covering >= 3 years)
  let revCagrVal = getKi('revenue_cagr_3yr_pct');
  let revCagrStatus: MetricResolutionStatus = finite(revCagrVal) ? 'REPORTED' : 'UNAVAILABLE';
  let revCagrReason: string | undefined;
  let revCagrReasonTh: string | undefined;

  if (revCagrVal === undefined && inc?.revenue && inc.revenue.length >= 3) {
    const revArr = inc.revenue.filter(finite);
    const periodArr = periods.slice(0, revArr.length);
    // Check if periods represent annual data (e.g. 2021, 2022, 2023 or FY21, FY22, FY23)
    const isAnnual = periodArr.length >= 3 && periodArr.every(p => /^(?:FY|20)\d{2}/i.test(p) && !/Q[1-4]/i.test(p));

    if (isAnnual && revArr.length >= 3) {
      const startRev = revArr[0];
      const endRev = revArr[revArr.length - 1];
      const years = revArr.length - 1;

      if (startRev > 0 && endRev > 0 && years >= 2) {
        revCagrVal = rounded(((endRev / startRev) ** (1 / years) - 1) * 100);
        revCagrStatus = 'CALCULATED';
      }
    } else {
      revCagrStatus = 'INSUFFICIENT_HISTORY';
      revCagrReason = 'INSUFFICIENT_HISTORY';
      revCagrReasonTh = 'ประวัติรายได้รายปียังไม่ครอบคลุม 3 ปีบริบูรณ์';
    }
  } else if (revCagrVal === undefined) {
    revCagrStatus = 'INSUFFICIENT_HISTORY';
    revCagrReason = 'INSUFFICIENT_HISTORY';
    revCagrReasonTh = 'ประวัติรายได้รายปียังไม่ครอบคลุม 3 ปีบริบูรณ์';
  }

  const revenueCagr3Y: ResolvedMetricItem = {
    value: finite(revCagrVal) ? revCagrVal : null,
    basis: '3Y Annual CAGR',
    period: periods.length >= 3 ? `${periods[0]} - ${periods[periods.length - 1]}` : undefined,
    source: revCagrStatus === 'CALCULATED' ? 'SEC Annual Revenue History' : 'Key Indicators',
    status: revCagrStatus,
    reason: revCagrReason,
    reasonTh: revCagrReasonTh,
  };

  // 10. Yields (FCF Yield & Earnings Yield)
  const pfcfRatio = report.valuation_ratios?.find(r => /P\/FCF/i.test(r.name))?.value;
  let fcfYieldVal: number | undefined;
  if (!isFinancial) {
    if (finite(pfcfRatio) && pfcfRatio > 0) {
      fcfYieldVal = rounded(100 / pfcfRatio);
    } else if (finite(report.five_pillars?.yields?.fcf_yield_pct)) {
      fcfYieldVal = report.five_pillars!.yields.fcf_yield_pct;
    } else if (finite(getKi('fcf_yield_pct'))) {
      fcfYieldVal = getKi('fcf_yield_pct');
    }
  }

  const fcfYield: ResolvedMetricItem = {
    value: fcfYieldVal,
    basis: 'FCF / Market Cap',
    status: isFinancial ? 'GUARDED' : finite(fcfYieldVal) ? 'REPORTED' : 'UNAVAILABLE',
    reason: isFinancial ? 'Guarded for financial institutions' : undefined,
    reasonTh: isFinancial ? 'FCF Yield ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)' : undefined,
    isGuarded: isFinancial,
  };

  let earningsYieldVal: number | undefined;
  let earningsYieldBasis: 'TTM' | 'FORWARD' | undefined;
  if (finite(peVal) && peVal > 0) {
    earningsYieldVal = rounded(100 / peVal);
    earningsYieldBasis = 'TTM';
  } else if (finite(fwdPeVal) && fwdPeVal > 0) {
    earningsYieldVal = rounded(100 / fwdPeVal);
    earningsYieldBasis = 'FORWARD';
  }

  const earningsYield: ResolvedMetricItem = {
    value: earningsYieldVal,
    basis: earningsYieldBasis,
    period: latestPeriod,
    formula: earningsYieldBasis ? `1 / ${earningsYieldBasis} P/E × 100` : undefined,
    status: finite(earningsYieldVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  return {
    ticker: sym,
    archetype,
    asOfDate: (report as any)?.asOfDate || report.as_of_date,
    revenueGrowthYoY,
    epsGrowthYoY,
    revenueCagr3Y,
    fcfGrowthYoY,
    grossMargin,
    operatingMargin,
    netMargin,
    roe,
    roa,
    roic,
    fcfYield,
    earningsYield,
    peTrailing,
    peForward,
    peg,
  };
}
