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

type FiscalKind = 'ANNUAL' | 'QUARTERLY';
type FiscalPoint = {
  value: number;
  year: number;
  quarter?: number;
  kind: FiscalKind;
  label: string;
  source: string;
};

const fiscalIdentity = (label?: string | null, fiscalYear?: number, fiscalQuarter?: number | null, form?: string | null) => {
  const text = String(label || '').trim();
  const yearMatch = text.match(/((?:19|20)\d{2})\b/);
  const quarterMatch = text.match(/\bQ([1-4])\b/i);
  const year = finite(fiscalYear) ? fiscalYear : yearMatch ? Number(yearMatch[1]) : undefined;
  if (!year) return undefined;
  const explicitAnnual = /\bFY\s*\d|annual|year\s*ended/i.test(text)
    || (/10-K/i.test(String(form || '')) && !quarterMatch && !finite(fiscalQuarter));
  const quarter = quarterMatch ? Number(quarterMatch[1]) : (finite(fiscalQuarter) ? fiscalQuarter : undefined);
  if (quarter && !explicitAnnual) return { year, quarter, kind: 'QUARTERLY' as const, label: `Q${quarter} ${year}` };
  if (explicitAnnual || !quarter) return { year, kind: 'ANNUAL' as const, label: `FY${year}` };
  return undefined;
};

const dedupeFiscalPoints = (points: FiscalPoint[]) => {
  const byPeriod = new Map<string, FiscalPoint>();
  for (const point of points) {
    const key = `${point.kind}:${point.year}:${point.quarter || 0}`;
    if (!byPeriod.has(key)) byPeriod.set(key, point);
  }
  return [...byPeriod.values()].sort((a, b) => a.year - b.year || (a.quarter || 0) - (b.quarter || 0));
};

const comparablePrior = (points: FiscalPoint[], current: FiscalPoint, yearsBack = 1) =>
  points.find(point => point.kind === current.kind
    && point.year === current.year - yearsBack
    && (current.kind === 'ANNUAL' || point.quarter === current.quarter));

const resolvedReason = (
  status: MetricResolutionStatus,
  reason: string,
  reasonTh: string,
  extra: Partial<ResolvedMetricItem> = {},
): ResolvedMetricItem => ({ value: null, status, reason, reasonTh, ...extra });

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
  let peBasis: 'TTM' | 'FY' | 'REPORTED' | 'FORWARD' = 'REPORTED';
  let peSource = 'Valuation Ratios';

  const peMatch = report.valuation_ratios?.find(r => /(?:trailing.*P\/E|P\/E.*trailing|\bP\/E\b|price.*to.*earnings|trailing.*pe)/i.test(r.name) && !/forward|PEG/i.test(r.name));
  if (finite(peMatch?.value) && peMatch.value > 0) {
    peVal = peMatch.value;
    peSource = `Valuation Ratios (${peMatch.name})`;
    peBasis = /trailing/i.test(peMatch.name) ? 'TTM' : 'REPORTED';
  } else if (finite(getKi('pe_trailing')) && getKi('pe_trailing')! > 0) {
    peVal = getKi('pe_trailing')!;
    peSource = 'Key Indicators (pe_trailing)';
    peBasis = 'TTM';
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
  let epsGrowthVal = at((inc as any)?.yoy_eps_growth_pct) ?? getKi('yoy_eps_growth_pct') ?? getKi('eps_growth_yoy_pct') ?? getKi('eps_growth');
  const latestFiscal = fiscalIdentity(latestPeriod);
  let epsGrowthBasis: string = at((inc as any)?.yoy_eps_growth_pct) !== undefined
    ? latestFiscal?.kind === 'QUARTERLY' ? 'QUARTER_YOY' : latestFiscal?.kind === 'ANNUAL' ? 'FY_YOY' : 'AMBIGUOUS'
    : getKi('yoy_eps_growth_pct') !== undefined || getKi('eps_growth_yoy_pct') !== undefined
      ? 'HISTORICAL_YOY'
      : getKi('eps_growth') !== undefined ? 'AMBIGUOUS' : 'AMBIGUOUS';
  if (epsGrowthVal === undefined && (getKi('eps_growth_forward_pct') !== undefined || getKi('forward_eps_growth') !== undefined)) {
    epsGrowthVal = getKi('eps_growth_forward_pct') ?? getKi('forward_eps_growth');
    epsGrowthBasis = 'FORWARD';
  }
  let epsGrowthStatus: MetricResolutionStatus = finite(epsGrowthVal) ? 'REPORTED' : 'UNAVAILABLE';
  let epsGrowthReason: string | undefined;
  let epsGrowthReasonTh: string | undefined;

  if (epsGrowthVal === undefined && inc?.eps_diluted && inc.eps_diluted.length >= 2) {
    const epsPoints = dedupeFiscalPoints(inc.eps_diluted.flatMap((value, index) => {
      const identity = fiscalIdentity(periods[index]);
      return finite(value) && identity ? [{ value, ...identity, source: 'Financial Statements (Diluted EPS)' }] : [];
    }));
    const current = epsPoints[epsPoints.length - 1];
    const prior = current ? comparablePrior(epsPoints, current) : undefined;

    if (current && prior) {
      const curEps = current.value;
      const priorEps = prior.value;
      if (priorEps > 0 && curEps > 0) {
        epsGrowthVal = rounded(((curEps / priorEps) - 1) * 100);
        epsGrowthBasis = current.kind === 'QUARTERLY' ? 'QUARTER_YOY' : 'FY_YOY';
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
    } else {
      epsGrowthStatus = 'INSUFFICIENT_HISTORY';
      epsGrowthReason = 'No comparable prior-year EPS period';
      epsGrowthReasonTh = 'ไม่มีข้อมูล EPS ของงวดเดียวกันในปีก่อนสำหรับเปรียบเทียบ';
    }
  }

  const epsGrowthYoY: ResolvedMetricItem = {
    value: finite(epsGrowthVal) ? epsGrowthVal : null,
    basis: epsGrowthBasis,
    period: latestPeriod,
    source: at((inc as any)?.yoy_eps_growth_pct) !== undefined || inc?.eps_diluted ? 'Financial Statements (Diluted EPS)' : 'Key Indicators',
    status: epsGrowthStatus,
    reason: epsGrowthReason,
    reasonTh: epsGrowthReasonTh,
  };

  // 4. PEG Ratio (relates P/E to EPS Growth with basis compatibility)
  let pegVal: number | undefined;
  let pegStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let pegReason = 'MISSING_PE';
  let pegReasonTh = 'ข้อมูล P/E ที่มีฐานช่วงเวลาชัดเจนไม่พร้อมใช้งาน จึงไม่สามารถคำนวณ PEG Ratio ได้';
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
  } else if (!finite(peVal) || peVal <= 0) {
    pegStatus = 'UNAVAILABLE';
    pegReason = 'MISSING_PE';
    pegReasonTh = 'ข้อมูล P/E ไม่พร้อมใช้งาน จึงไม่สามารถคำนวณ PEG Ratio ได้';
  } else if (!finite(epsGrowthVal)) {
    pegStatus = epsGrowthStatus === 'INSUFFICIENT_HISTORY' ? 'INSUFFICIENT_HISTORY' : 'UNAVAILABLE';
    pegReason = epsGrowthReason || 'MISSING_EPS_GROWTH';
    pegReasonTh = epsGrowthReasonTh || 'ข้อมูล EPS Growth ไม่พร้อมใช้งาน จึงไม่สามารถคำนวณ PEG Ratio ได้';
  } else {
    // A trailing P/E may pair only with trailing or historical multi-period growth.
    // A standalone quarter YoY, forward estimate, reported/ambiguous P/E, or ambiguous growth fails closed.
    const isBasisCompatible = peBasis === 'TTM'
      && ['TTM', 'FY_YOY', 'HISTORICAL_YOY'].includes(epsGrowthBasis);

    if (!isBasisCompatible) {
      pegStatus = 'BASIS_MISMATCH';
      pegReason = 'BASIS_MISMATCH';
      pegReasonTh = `ยังไม่สามารถคำนวณ PEG ได้ เพราะ P/E (${peBasis}) และ EPS Growth (${epsGrowthBasis}) ใช้คนละฐานช่วงเวลาและไม่สอดคล้องกัน`;
    } else if (epsGrowthVal > 0) {
      pegVal = rounded(peVal / epsGrowthVal);
      pegStatus = 'CALCULATED';
      pegReason = `PEG ${pegVal}x`;
      pegReasonTh = pegVal < 1.0
        ? `PEG ${pegVal}x สะท้อนราคาที่เติบโตสมเหตุสมผลเมื่อเทียบกับการเติบโตของกำไร EPS (+${epsGrowthVal}%)`
        : pegVal <= 2.0
          ? `PEG ${pegVal}x อยู่ในเกณฑ์มาตรฐานของกลุ่มอุตสาหกรรม`
          : `PEG ${pegVal}x สะท้อนความคาดหวังการเติบโตในราคาสูง (Premium Valuation)`;
    } else if (epsGrowthVal <= 0) {
      pegStatus = 'UNAVAILABLE';
      pegReason = 'Negative or zero EPS growth';
      pegReasonTh = 'PEG ไม่สามารถคำนวณได้เนื่องจากอัตราเติบโตของกำไร (EPS Growth) ติดลบหรือเท่ากับศูนย์';
    }
  }

  const peg: ResolvedMetricItem = {
    value: finite(pegVal) ? pegVal : null,
    basis: `${peBasis} P/E / ${epsGrowthBasis} EPS Growth`,
    period: latestPeriod,
    formula: 'P/E Ratio / EPS Growth Rate (%)',
    source: `${peTrailing.source || 'Resolved P/E'} + ${epsGrowthYoY.source || 'Resolved EPS Growth'}`,
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

  // 8. FCF Growth YoY — compare the same fiscal period, never adjacent array positions.
  const legacyFcfPoints = dedupeFiscalPoints((cf?.free_cash_flow || cf?.operating_cash_flow || []).flatMap((raw, index) => {
    const identity = fiscalIdentity(periods[index]);
    const value = cf?.free_cash_flow
      ? raw
      : finite(raw) && finite(cf?.capex?.[index]) ? raw - Math.abs(cf!.capex![index]!) : undefined;
    return finite(value) && identity ? [{ value, ...identity, source: 'Financial Statements (FCF)' }] : [];
  }));
  const secFcfPoints = dedupeFiscalPoints(((report as any).sec_verification?.sec_period_statements || []).flatMap((statement: any) => {
    const identity = fiscalIdentity(statement.period, statement.fiscal_year, statement.fiscal_quarter, statement.form);
    const value = finite(statement.operating_cash_flow) && finite(statement.capital_expenditure)
      ? statement.operating_cash_flow - Math.abs(statement.capital_expenditure)
      : undefined;
    return finite(value) && identity ? [{ value, ...identity, source: 'SEC verified period statements' }] : [];
  }));
  const verifiedCanonical = (report as any).canonical_financials?.provenanceStatus === 'verified'
    && /sec-xbrl/i.test((report as any).canonical_financials?.generatedBy || '')
    ? (report as any).canonical_financials
    : undefined;
  const canonicalFcfPoints = dedupeFiscalPoints((verifiedCanonical?.values?.['cash_flow.free_cash_flow'] || []).flatMap((item: any) => {
    const identity = fiscalIdentity(item.period || item.periodEnd);
    return item.verification === 'verified' && finite(item.value) && identity
      ? [{ value: item.value, ...identity, source: 'SEC verified canonical financials' }]
      : [];
  }));
  const fcfPoints = secFcfPoints.length > 0 ? secFcfPoints : canonicalFcfPoints.length > 0 ? canonicalFcfPoints : legacyFcfPoints;
  const currentFcf = fcfPoints[fcfPoints.length - 1];
  const priorFcf = currentFcf ? comparablePrior(fcfPoints, currentFcf) : undefined;
  let fcfGrowthYoY: ResolvedMetricItem;
  if (isFinancial || archetype === 'reit') {
    fcfGrowthYoY = resolvedReason(
      isFinancial ? 'GUARDED' : 'NOT_APPLICABLE',
      isFinancial ? 'GUARDED_FOR_FINANCIAL_INSTITUTION' : 'NOT_APPLICABLE_TO_REIT',
      isFinancial ? 'FCF Growth ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)' : 'FCF Growth ไม่ใช่ตัวชี้วัดหลักของ REIT; ควรใช้ FFO/AFFO แทน',
      { basis: 'Business-model guard', isGuarded: true },
    );
  } else if (finite(at((cf as any)?.yoy_fcf_growth_pct)) || finite(getKi('fcf_growth'))) {
    const reported = at((cf as any)?.yoy_fcf_growth_pct) ?? getKi('fcf_growth');
    fcfGrowthYoY = {
      value: reported,
      basis: latestFiscal?.kind === 'QUARTERLY' ? 'Quarter YoY (reported)' : latestFiscal?.kind === 'ANNUAL' ? 'FY YoY (reported)' : 'Reported YoY',
      period: latestPeriod,
      source: at((cf as any)?.yoy_fcf_growth_pct) !== undefined ? 'Cash Flow Statement' : 'Key Indicators',
      status: 'REPORTED',
    };
  } else if (!currentFcf || !priorFcf) {
    fcfGrowthYoY = resolvedReason(
      'INSUFFICIENT_HISTORY',
      'NO_COMPARABLE_PRIOR_YEAR_FCF_PERIOD',
      currentFcf ? `ไม่มี FCF ของงวดเดียวกันในปีก่อนเพื่อเทียบกับ ${currentFcf.label}` : 'ไม่มีประวัติ FCF ที่ตรวจสอบได้สำหรับคำนวณการเติบโต',
      { basis: currentFcf?.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY', period: currentFcf?.label, source: currentFcf?.source },
    );
  } else if (priorFcf.value < 0 && currentFcf.value > 0) {
    fcfGrowthYoY = resolvedReason('TURNAROUND', 'TURNAROUND_FROM_NEGATIVE_TO_POSITIVE', 'กระแสเงินสดอิสระ (FCF) พลิกฟื้นจากติดลบกลับมาเป็นบวก', {
      basis: currentFcf.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY', period: `${priorFcf.label} → ${currentFcf.label}`, source: currentFcf.source,
    });
  } else if (priorFcf.value > 0 && currentFcf.value < 0) {
    fcfGrowthYoY = resolvedReason('DETERIORATION', 'DETERIORATION_FROM_POSITIVE_TO_NEGATIVE', 'กระแสเงินสดอิสระ (FCF) ลดลงจากบวกเป็นติดลบ', {
      basis: currentFcf.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY', period: `${priorFcf.label} → ${currentFcf.label}`, source: currentFcf.source,
    });
  } else if (priorFcf.value <= 0 || currentFcf.value <= 0) {
    fcfGrowthYoY = resolvedReason('UNAVAILABLE', priorFcf.value === 0 ? 'PRIOR_PERIOD_FCF_ZERO' : 'BOTH_PERIODS_NEGATIVE_FCF', priorFcf.value === 0 ? 'FCF งวดก่อนมีค่าเป็นศูนย์ จึงคำนวณอัตราเติบโตไม่ได้' : 'FCF ติดลบทั้งสองงวด จึงไม่แสดงเปอร์เซ็นต์ที่อาจทำให้เข้าใจผิด', {
      basis: currentFcf.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY', period: `${priorFcf.label} → ${currentFcf.label}`, source: currentFcf.source,
    });
  } else {
    fcfGrowthYoY = {
      value: rounded(((currentFcf.value / priorFcf.value) - 1) * 100),
      basis: currentFcf.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY',
      period: `${priorFcf.label} → ${currentFcf.label}`,
      formula: '(Current FCF / Comparable prior-year FCF - 1) × 100',
      source: currentFcf.source,
      status: 'CALCULATED',
    };
  }

  // 9. 3Y Revenue CAGR — use actual fiscal-year distance and independently verified completion facts when present.
  const verifiedRevenueFacts = ((report as any).data_completeness?.verifiedFacts || []).flatMap((fact: any) => {
    const isRevenue = /(^|[._])revenue$/i.test(String(fact.metricKey || ''));
    const isVerified = ['VERIFIED', 'VERIFIED_AVAILABLE', 'VERIFIED_DERIVED'].includes(String(fact.verificationStatus || ''));
    const identity = fiscalIdentity(fact.fiscalPeriod || fact.periodEnd);
    return isRevenue && isVerified && finite(fact.value) && identity?.kind === 'ANNUAL'
      ? [{ value: fact.value, ...identity, source: `Verified fact (${fact.sourceDocument || fact.sourceType || 'source'})` }]
      : [];
  });
  const legacyRevenuePoints = (inc?.revenue || []).flatMap((value, index) => {
    const identity = fiscalIdentity(periods[index]);
    return finite(value) && identity?.kind === 'ANNUAL'
      ? [{ value, ...identity, source: 'Financial Statements (annual revenue)' }]
      : [];
  });
  const canonicalRevenuePoints = (verifiedCanonical?.values?.['income_statement.revenue'] || []).flatMap((item: any) => {
    const identity = fiscalIdentity(item.period || item.periodEnd);
    return item.verification === 'verified' && finite(item.value) && identity?.kind === 'ANNUAL'
      ? [{ value: item.value, ...identity, source: 'SEC verified canonical financials' }]
      : [];
  });
  const annualRevenuePoints = dedupeFiscalPoints(
    verifiedRevenueFacts.length > 0 ? verifiedRevenueFacts : canonicalRevenuePoints.length > 0 ? canonicalRevenuePoints : legacyRevenuePoints,
  );
  const endingRevenue = annualRevenuePoints[annualRevenuePoints.length - 1];
  const startingRevenue = endingRevenue ? comparablePrior(annualRevenuePoints, endingRevenue, 3) : undefined;
  const reportedCagr = getKi('revenue_cagr_3yr_pct');
  let revenueCagr3Y: ResolvedMetricItem;
  if (finite(reportedCagr)) {
    revenueCagr3Y = { value: reportedCagr, basis: '3Y Annual CAGR (reported)', source: 'Key Indicators', status: 'REPORTED' };
  } else if (!endingRevenue || !startingRevenue) {
    revenueCagr3Y = resolvedReason('INSUFFICIENT_HISTORY', 'INSUFFICIENT_3Y_ANNUAL_REVENUE_HISTORY', 'ประวัติรายได้รายปียังไม่ครอบคลุม 3 ปีบริบูรณ์', {
      basis: '3Y Annual CAGR',
      period: annualRevenuePoints.length > 0 ? `${annualRevenuePoints[0].label} → ${endingRevenue?.label}` : undefined,
      source: endingRevenue?.source,
    });
  } else if (startingRevenue.value <= 0 || endingRevenue.value <= 0) {
    revenueCagr3Y = resolvedReason('UNAVAILABLE', 'NON_POSITIVE_REVENUE_ENDPOINT', 'รายได้ต้นงวดหรือปลายงวดไม่เป็นบวก จึงคำนวณ CAGR ไม่ได้', {
      basis: '3Y Annual CAGR', period: `${startingRevenue.label} → ${endingRevenue.label}`, source: endingRevenue.source,
    });
  } else {
    revenueCagr3Y = {
      value: rounded(((endingRevenue.value / startingRevenue.value) ** (1 / 3) - 1) * 100),
      basis: '3Y Annual CAGR',
      period: `${startingRevenue.label} → ${endingRevenue.label}`,
      formula: '(Ending annual revenue / Starting annual revenue)^(1/3) - 1',
      source: endingRevenue.source,
      status: 'CALCULATED',
    };
  }

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
