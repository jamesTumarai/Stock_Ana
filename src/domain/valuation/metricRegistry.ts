import type { ReportData } from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext';
import { findKeyIndicatorInSource } from '../metricLineage';
import { calculateCanonicalRoic, calculateInvestedCapital } from './canonicalRoic';

export type MetricResolutionStatus =
  | 'CALCULATED'
  | 'REPORTED'
  | 'UNAVAILABLE'
  | 'BASIS_MISMATCH'
  | 'TURNAROUND'
  | 'DETERIORATION'
  | 'INSUFFICIENT_HISTORY'
  | 'NOT_APPLICABLE'
  | 'GUARDED'
  | 'NO_MATERIAL_INTEREST';

export interface ResolvedMetricItem<T = number> {
  value?: T;
  basis?: string;
  periodBasis?: 'TTM' | 'ANNUAL' | 'QUARTERLY';
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
  interestCoverage: ResolvedMetricItem;

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
  periodEnd?: string;
  definition?: string;
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

const extractFiscalSeries = (
  values: (number | null | undefined)[] | undefined,
  periods: string[] | undefined,
  sourceName: string
): FiscalPoint[] => {
  if (!values || !periods) return [];
  const points: FiscalPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    const periodStr = periods[i];
    if (!finite(val) || !periodStr) continue;
    if (/\bYTD\b|6M|9M|cumulative/i.test(periodStr)) continue;
    const identity = fiscalIdentity(periodStr);
    if (identity) {
      points.push({ value: val, ...identity, label: identity.label, source: sourceName, periodEnd: periodStr });
    }
  }
  return points;
};

const extractSecPeriodFacts = (
  statements: any[] | undefined,
  field: string
): FiscalPoint[] => {
  if (!Array.isArray(statements)) return [];
  const points: FiscalPoint[] = [];
  for (const s of statements) {
    const val = s[field];
    if (!finite(val)) continue;
    const periodStr = String(s.period || s.period_end || '');
    if (/\bYTD\b|6M|9M|cumulative/i.test(periodStr)) continue;
    if (s.derivation === 'reported_ytd' && s.fiscal_quarter && s.fiscal_quarter > 1) continue;
    const identity = fiscalIdentity(periodStr, s.fiscal_year, s.fiscal_quarter, s.form);
    if (identity) {
      points.push({
        value: val,
        ...identity,
        label: identity.label,
        source: `SEC ${s.form || 'filing'}${s.accession ? ` (${s.accession})` : ''}`,
        periodEnd: s.period_end || periodStr,
      });
    }
  }
  return points;
};

const extractCanonicalFacts = (
  canonicalValues: any[] | undefined,
  metricName: string
): FiscalPoint[] => {
  if (!Array.isArray(canonicalValues)) return [];
  const points: FiscalPoint[] = [];
  for (const item of canonicalValues) {
    if (item.verification !== 'verified' || !finite(item.value)) continue;
    const periodStr = String(item.period || item.periodEnd || '');
    if (/\bYTD\b|6M|9M|cumulative/i.test(periodStr)) continue;
    const identity = fiscalIdentity(periodStr);
    if (identity) {
      points.push({
        value: item.value,
        ...identity,
        label: identity.label,
        source: 'SEC verified canonical financials',
        periodEnd: item.periodEnd || periodStr,
      });
    }
  }
  return points;
};

type TrailingQuarterResult = {
  kind: 'TTM' | 'ANNUAL' | 'QUARTERLY' | 'INSUFFICIENT';
  points: FiscalPoint[];
  totalValue: number | null;
  periodLabel: string;
  source: string;
};

const resolveTrailingFourQuarters = (
  points: FiscalPoint[],
  latestFiscal?: { year: number; quarter?: number; kind: FiscalKind }
): TrailingQuarterResult => {
  const annualPoints = points.filter(p => p.kind === 'ANNUAL').sort((a, b) => a.year - b.year);
  const quarterlyPoints = points.filter(p => p.kind === 'QUARTERLY' && finite(p.quarter)).sort((a, b) => a.year - b.year || (a.quarter || 0) - (b.quarter || 0));

  if (latestFiscal?.kind === 'ANNUAL') {
    const matchingAnnual = annualPoints.find(p => p.year === latestFiscal.year) || annualPoints[annualPoints.length - 1];
    if (matchingAnnual) {
      return {
        kind: 'ANNUAL',
        points: [matchingAnnual],
        totalValue: matchingAnnual.value,
        periodLabel: matchingAnnual.label,
        source: matchingAnnual.source,
      };
    }
  }

  if (quarterlyPoints.length > 0) {
    const endQuarterPoint = (latestFiscal?.kind === 'QUARTERLY' && latestFiscal.quarter)
      ? quarterlyPoints.find(p => p.year === latestFiscal.year && p.quarter === latestFiscal.quarter) || quarterlyPoints[quarterlyPoints.length - 1]
      : quarterlyPoints[quarterlyPoints.length - 1];

    if (endQuarterPoint && endQuarterPoint.quarter) {
      const targetYear = endQuarterPoint.year;
      const targetQ = endQuarterPoint.quarter;
      const consecutive: FiscalPoint[] = [];

      for (let offset = 3; offset >= 0; offset--) {
        let qYear = targetYear;
        let qNum = targetQ - offset;
        while (qNum <= 0) {
          qYear -= 1;
          qNum += 4;
        }
        const found = quarterlyPoints.find(p => p.year === qYear && p.quarter === qNum);
        if (found) {
          consecutive.push(found);
        }
      }

      if (consecutive.length === 4) {
        const sum = consecutive.reduce((acc, p) => acc + p.value, 0);
        return {
          kind: 'TTM',
          points: consecutive,
          totalValue: Math.round(sum * 100) / 100,
          periodLabel: `${consecutive[0].label} → ${consecutive[3].label}`,
          source: consecutive[3].source,
        };
      }

      // If only 1 quarter exists in points, allow single-period quarter (Option B)
      if (quarterlyPoints.length === 1) {
        return {
          kind: 'QUARTERLY',
          points: [endQuarterPoint],
          totalValue: endQuarterPoint.value,
          periodLabel: endQuarterPoint.label,
          source: endQuarterPoint.source,
        };
      }

      // 2 or 3 quarters exist: cannot form TTM
      return {
        kind: 'INSUFFICIENT',
        points: consecutive,
        totalValue: null,
        periodLabel: `${endQuarterPoint.label} (fewer than 4 quarters)`,
        source: endQuarterPoint.source,
      };
    }
  }

  if (annualPoints.length > 0) {
    const lastAnnual = annualPoints[annualPoints.length - 1];
    return {
      kind: 'ANNUAL',
      points: [lastAnnual],
      totalValue: lastAnnual.value,
      periodLabel: lastAnnual.label,
      source: lastAnnual.source,
    };
  }

  return {
    kind: 'INSUFFICIENT',
    points: [],
    totalValue: null,
    periodLabel: 'No history',
    source: 'Financial Statements',
  };
};

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
  const verifiedCanonical = (report as any).canonical_financials?.provenanceStatus === 'verified'
    && /sec-xbrl/i.test((report as any).canonical_financials?.generatedBy || '')
    ? (report as any).canonical_financials
    : undefined;

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

  // 5. ROIC (Canonical NOPAT / Average Invested Capital)
  const secOpPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'operating_income');
  const canonicalOpPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.operating_income'], 'operating_income');
  const legacyOpPoints = extractFiscalSeries(inc?.operating_income, periods, 'Financial Statements (operating income)');
  const allOpPoints = dedupeFiscalPoints(secOpPoints.length > 0 ? secOpPoints : canonicalOpPoints.length > 0 ? canonicalOpPoints : legacyOpPoints);
  const trailingOp = resolveTrailingFourQuarters(allOpPoints, latestFiscal);

  const secEbtPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'income_before_tax');
  const canonicalEbtPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.income_before_tax'], 'income_before_tax');
  const legacyEbtPoints = extractFiscalSeries(inc?.income_before_tax, periods, 'Financial Statements (EBT)');
  const allEbtPoints = dedupeFiscalPoints(secEbtPoints.length > 0 ? secEbtPoints : canonicalEbtPoints.length > 0 ? canonicalEbtPoints : legacyEbtPoints);

  const secTaxPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'income_tax_expense');
  const canonicalTaxPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.income_tax_expense'], 'income_tax_expense');
  const legacyTaxPoints = extractFiscalSeries(inc?.income_tax_expense || (inc as any)?.tax_provision, periods, 'Financial Statements (tax expense)');
  const allTaxPoints = dedupeFiscalPoints(secTaxPoints.length > 0 ? secTaxPoints : canonicalTaxPoints.length > 0 ? canonicalTaxPoints : legacyTaxPoints);

  let ttmEbt: number | undefined;
  let ttmTaxExp: number | undefined;
  if (trailingOp.kind === 'TTM') {
    const matchingEbt = allEbtPoints.filter(p => trailingOp.points.some(q => q.year === p.year && q.quarter === p.quarter));
    if (matchingEbt.length === 4) ttmEbt = matchingEbt.reduce((sum, p) => sum + p.value, 0);
    const matchingTax = allTaxPoints.filter(p => trailingOp.points.some(q => q.year === p.year && q.quarter === p.quarter));
    if (matchingTax.length === 4) ttmTaxExp = matchingTax.reduce((sum, p) => sum + p.value, 0);
  } else if (trailingOp.kind === 'ANNUAL' && trailingOp.points[0]) {
    ttmEbt = allEbtPoints.find(p => p.kind === 'ANNUAL' && p.year === trailingOp.points[0].year)?.value ?? at(inc?.income_before_tax);
    ttmTaxExp = allTaxPoints.find(p => p.kind === 'ANNUAL' && p.year === trailingOp.points[0].year)?.value ?? at(inc?.income_tax_expense) ?? at((inc as any)?.tax_provision);
  } else if (trailingOp.kind === 'QUARTERLY' && trailingOp.points[0]) {
    ttmEbt = allEbtPoints.find(p => p.year === trailingOp.points[0].year && p.quarter === trailingOp.points[0].quarter)?.value ?? at(inc?.income_before_tax);
    ttmTaxExp = allTaxPoints.find(p => p.year === trailingOp.points[0].year && p.quarter === trailingOp.points[0].quarter)?.value ?? at(inc?.income_tax_expense) ?? at((inc as any)?.tax_provision);
  }

  const endingIC = totalEquity !== undefined && totalDebt !== undefined && totalCash !== undefined
    ? totalEquity + totalDebt - totalCash
    : null;

  const eqArr = bs?.total_equity || [];
  const debtArr = bs?.total_debt || [];
  const cashArr = bs?.cash_and_equivalents || [];
  const stArr = bs?.short_term_investments || [];
  const assetsArr = bs?.total_assets || [];

  let beginIC: number | undefined;
  let beginEq: number | undefined;
  let beginAssets: number | undefined;
  if (eqArr.length >= 2) {
    const beginIdx = Math.max(0, lastIndex - 4);
    beginEq = eqArr[beginIdx];
    const beginDebt = debtArr[beginIdx] ?? (bs?.short_term_debt?.[beginIdx] ?? 0) + (bs?.long_term_debt?.[beginIdx] ?? 0);
    const beginCash = (cashArr[beginIdx] ?? 0) + (stArr[beginIdx] ?? 0);
    beginAssets = assetsArr[beginIdx];
    if (finite(beginEq) && finite(beginDebt)) {
      beginIC = beginEq + beginDebt - beginCash;
    }
  }

  let roicVal: number | null | undefined;
  let roicBasis = 'Reported';
  let roicFormula: string | undefined;
  let roicStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let roicReason: string | undefined;
  let roicReasonTh: string | undefined;
  let roicPeriod: string | undefined = latestPeriod;

  if (isFinancial) {
    roicVal = undefined;
    roicStatus = 'GUARDED';
    roicReason = 'ROIC guarded for financial institutions';
    roicReasonTh = 'ROIC ไม่ใช้กับสถาบันการเงินเนื่องจากเงินฝากเป็นสินค้าคงคลังดำเนินงาน (เน้น ROE/ROA)';
  } else if (secOpPoints.length >= 4 && trailingOp.kind === 'TTM' && trailingOp.totalValue !== null && endingIC !== null && endingIC > 0) {
    // 1. Independently verified SEC 4 quarters
    const roicResult = calculateCanonicalRoic({
      operatingIncome: trailingOp.totalValue,
      incomeBeforeTax: finite(ttmEbt) ? ttmEbt : at(inc?.income_before_tax),
      incomeTaxExpense: finite(ttmTaxExp) ? ttmTaxExp : at(inc?.income_tax_expense) ?? at((inc as any)?.tax_provision),
      beginningInvestedCapital: finite(beginIC) && beginIC > 0 ? beginIC : undefined,
      endingInvestedCapital: endingIC,
      periodBasis: 'TTM',
      periodLabel: trailingOp.periodLabel,
      source: trailingOp.source,
    });
    roicVal = roicResult.value;
    roicStatus = roicResult.status === 'CALCULATED' ? 'CALCULATED' : 'UNAVAILABLE';
    roicBasis = roicResult.basis;
    roicPeriod = roicResult.period;
    roicFormula = roicResult.formula;
    roicReason = roicResult.reason;
    roicReasonTh = roicResult.reasonTh;
  } else if (finite(getKi('roic')) || finite(getKi('roic_pct'))) {
    // 2. Canonical Key Indicators
    roicVal = getKi('roic') ?? getKi('roic_pct');
    roicStatus = 'REPORTED';
    roicBasis = 'Reported';
  } else if (allOpPoints.length === 0 || endingIC === null || endingIC === undefined) {
    roicVal = undefined;
    roicStatus = 'UNAVAILABLE';
    roicReason = 'Insufficient verified invested-capital inputs';
    roicReasonTh = 'ข้อมูลสำหรับคำนวณเงินลงทุนสุทธิ (Invested Capital) ไม่เพียงพอ';
  } else if (trailingOp.kind === 'INSUFFICIENT') {
    roicVal = undefined;
    roicStatus = 'UNAVAILABLE';
    roicReason = 'INSUFFICIENT_TTM_HISTORY';
    roicReasonTh = 'ประวัติผลการดำเนินงานรายไตรมาสที่ตรวจสอบแล้วไม่ครบ 4 ไตรมาสเพื่อคำนวณ TTM ROIC';
    roicBasis = 'TTM NOPAT / Average Invested Capital';
  } else if (endingIC <= 0) {
    roicVal = undefined;
    roicStatus = 'UNAVAILABLE';
    roicReason = 'Invested capital is non-positive';
    roicReasonTh = 'เงินลงทุนดำเนินงานสุทธิ (Invested Capital) มีค่าติดลบหรือไม่เป็นบวก';
    roicBasis = 'Invested Capital non-positive';
  } else if (trailingOp.totalValue !== null && endingIC > 0) {
    const roicResult = calculateCanonicalRoic({
      operatingIncome: trailingOp.totalValue,
      incomeBeforeTax: finite(ttmEbt) ? ttmEbt : at(inc?.income_before_tax),
      incomeTaxExpense: finite(ttmTaxExp) ? ttmTaxExp : at(inc?.income_tax_expense) ?? at((inc as any)?.tax_provision),
      beginningInvestedCapital: finite(beginIC) && beginIC > 0 ? beginIC : undefined,
      endingInvestedCapital: endingIC,
      periodBasis: trailingOp.kind === 'TTM' ? 'TTM' : trailingOp.kind === 'ANNUAL' ? 'ANNUAL' : 'QUARTERLY',
      periodLabel: trailingOp.periodLabel,
      source: trailingOp.source,
    });
    roicVal = roicResult.value;
    roicStatus = roicResult.status === 'CALCULATED' ? 'CALCULATED' : 'UNAVAILABLE';
    roicBasis = roicResult.basis;
    roicPeriod = roicResult.period;
    roicFormula = roicResult.formula;
    roicReason = roicResult.reason;
    roicReasonTh = roicResult.reasonTh;
  } else {
    roicVal = undefined;
    roicStatus = 'UNAVAILABLE';
    roicReason = 'Insufficient verified invested-capital inputs';
    roicReasonTh = 'ข้อมูลสำหรับคำนวณเงินลงทุนสุทธิ (Invested Capital) ไม่เพียงพอ';
  }

  const roicPeriodBasis: 'TTM' | 'ANNUAL' | 'QUARTERLY' | undefined =
    trailingOp.kind === 'TTM' ? 'TTM' : trailingOp.kind === 'ANNUAL' ? 'ANNUAL' : trailingOp.kind === 'QUARTERLY' ? 'QUARTERLY' : undefined;

  const roic: ResolvedMetricItem = {
    value: roicVal ?? undefined,
    basis: roicBasis,
    periodBasis: roicPeriodBasis,
    period: roicPeriod || latestPeriod,
    formula: roicFormula,
    source: roicStatus === 'CALCULATED' ? (trailingOp.source || 'SEC Operating Income & Balance Sheet') : 'Key Indicators',
    status: roicStatus,
    reason: roicReason,
    reasonTh: roicReasonTh,
    isGuarded: isFinancial,
  };

  // 5b. Interest Coverage — one canonical definition and period-matched inputs.
  // Operating income is used as EBIT consistently across target and completion paths.
  const reportedInterestCoverage = getKi('interest_coverage');
  const secCoverageInputs = ((report as any).sec_verification?.sec_period_statements || [])
    .filter((statement: any) => finite(statement.operating_income) && finite(statement.interest_expense))
    .map((statement: any) => ({
      operatingIncome: statement.operating_income as number,
      interestExpense: statement.interest_expense as number,
      period: String(statement.period || statement.period_end || 'SEC period'),
      source: `SEC ${statement.form || 'filing'}${statement.accession ? ` (${statement.accession})` : ''}`,
    }))
    .pop();
  const canonicalOperating = verifiedCanonical?.values?.['income_statement.operating_income'];
  const canonicalInterest = verifiedCanonical?.values?.['income_statement.interest_expense'];
  let canonicalCoverageInputs: { operatingIncome: number; interestExpense: number; period: string; source: string } | undefined;
  if (canonicalOperating && canonicalInterest) {
    for (let i = verifiedCanonical.periods.length - 1; i >= 0; i -= 1) {
      const op = canonicalOperating[i];
      const interest = canonicalInterest[i];
      if (op?.verification === 'verified' && interest?.verification === 'verified' && finite(op.value) && finite(interest.value) && op.period === interest.period) {
        canonicalCoverageInputs = {
          operatingIncome: op.value,
          interestExpense: interest.value,
          period: op.period,
          source: 'SEC verified canonical financials',
        };
        break;
      }
    }
  }
  const legacyInterest = at(inc?.interest_expense);
  const coverageInputs = secCoverageInputs || canonicalCoverageInputs || (
    opInc !== undefined && legacyInterest !== undefined
      ? { operatingIncome: opInc, interestExpense: legacyInterest, period: latestPeriod, source: 'Financial Statements (period matched)' }
      : undefined
  );

  let interestCoverage: ResolvedMetricItem;
  if (isFinancial) {
    interestCoverage = resolvedReason('GUARDED', 'NOT_APPLICABLE_TO_FINANCIAL_INTERMEDIARY', 'ไม่ใช้กับธุรกิจประเภทนี้ เนื่องจากดอกเบี้ยเป็นต้นทุนดำเนินงานหลักของสถาบันการเงิน', {
      basis: 'Financial Sector Guard', isGuarded: true,
    });
  } else if (finite(reportedInterestCoverage)) {
    interestCoverage = {
      value: reportedInterestCoverage,
      basis: 'Reported period-matched EBIT / Interest Expense',
      period: latestPeriod,
      source: 'Key Indicators',
      status: 'REPORTED',
    };
  } else if (coverageInputs) {
    const denominator = Math.abs(coverageInputs.interestExpense);
    const immaterialThreshold = Math.max(Math.abs(coverageInputs.operatingIncome) * 0.0001, 0.01);
    if (denominator <= immaterialThreshold) {
      interestCoverage = resolvedReason('NO_MATERIAL_INTEREST', 'NO_MATERIAL_INTEREST_EXPENSE', 'ไม่มีภาระดอกเบี้ยที่มีนัยสำคัญในช่วงเวลาที่ตรวจสอบ', {
        basis: 'Period-matched Operating Income / Interest Expense', period: coverageInputs.period,
        formula: 'Operating Income / |Interest Expense|', source: coverageInputs.source,
      });
    } else {
      interestCoverage = {
        value: rounded(coverageInputs.operatingIncome / denominator),
        basis: 'Period-matched Operating Income / Interest Expense',
        period: coverageInputs.period,
        formula: 'Operating Income / |Interest Expense|',
        source: coverageInputs.source,
        status: 'CALCULATED',
      };
    }
  } else {
    const hasOperatingIncome = opInc !== undefined
      || ((report as any).sec_verification?.sec_period_statements || []).some((statement: any) => finite(statement.operating_income));
    const hasInterestExpense = legacyInterest !== undefined
      || ((report as any).sec_verification?.sec_period_statements || []).some((statement: any) => finite(statement.interest_expense));
    const reason = !hasOperatingIncome && !hasInterestExpense
      ? 'MISSING_PERIOD_MATCHED_OPERATING_INCOME_AND_INTEREST_EXPENSE'
      : !hasOperatingIncome
        ? 'MISSING_PERIOD_MATCHED_OPERATING_INCOME'
        : !hasInterestExpense
          ? 'MISSING_PERIOD_MATCHED_INTEREST_EXPENSE'
          : 'PERIOD_MISMATCH_OPERATING_INCOME_AND_INTEREST_EXPENSE';
    const reasonTh = !hasOperatingIncome && !hasInterestExpense
      ? 'ไม่พบกำไรจากการดำเนินงานและดอกเบี้ยจ่ายของช่วงเวลาที่เทียบกันได้'
      : !hasOperatingIncome
        ? 'ไม่พบกำไรจากการดำเนินงานของช่วงเวลาที่เทียบกันได้'
        : !hasInterestExpense
          ? 'ไม่พบดอกเบี้ยจ่ายของช่วงเวลาที่เทียบกันได้'
          : 'กำไรจากการดำเนินงานและดอกเบี้ยจ่ายอยู่คนละช่วงเวลา จึงไม่คำนวณอัตราคุ้มครองดอกเบี้ย';
    interestCoverage = resolvedReason('UNAVAILABLE', reason, reasonTh, {
      basis: 'Period-matched Operating Income / Interest Expense',
      formula: 'Operating Income / |Interest Expense|',
    });
  }

  // 6. ROE & ROA (Canonical TTM / Annual Net Income / Average Capital)
  const secNiPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'net_income');
  const canonicalNiPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.net_income'], 'net_income');
  const legacyNiPoints = extractFiscalSeries(inc?.net_income, periods, 'Financial Statements (net income)');
  const allNiPoints = dedupeFiscalPoints(secNiPoints.length > 0 ? secNiPoints : canonicalNiPoints.length > 0 ? canonicalNiPoints : legacyNiPoints);
  const trailingNi = resolveTrailingFourQuarters(allNiPoints, latestFiscal);

  let roeVal: number | undefined;
  let roeBasis = 'TTM Net Income / Average Total Equity';
  let roePeriod = latestPeriod;
  let roeStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let roeReason: string | undefined;
  let roeReasonTh: string | undefined;

  let roaVal: number | undefined;
  let roaBasis = 'TTM Net Income / Average Total Assets';
  let roaPeriod = latestPeriod;
  let roaStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let roaReason: string | undefined;
  let roaReasonTh: string | undefined;

  if (secNiPoints.length >= 4 && trailingNi.kind === 'TTM' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0) {
    const avgEquity = beginEq && beginEq > 0 ? (beginEq + totalEquity) / 2 : totalEquity;
    roeVal = rounded((trailingNi.totalValue / avgEquity) * 100);
    roeBasis = beginEq && beginEq > 0 ? 'TTM Net Income / Average Total Equity' : 'TTM Net Income / Ending Total Equity';
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0) {
      const avgAssets = beginAssets && beginAssets > 0 ? (beginAssets + totalAssets) / 2 : totalAssets;
      roaVal = rounded((trailingNi.totalValue / avgAssets) * 100);
      roaBasis = beginAssets && beginAssets > 0 ? 'TTM Net Income / Average Total Assets' : 'TTM Net Income / Ending Total Assets';
      roaPeriod = trailingNi.periodLabel;
      roaStatus = 'CALCULATED';
    }
  } else if (finite(getKi('roe')) || finite(getKi('roe_pct'))) {
    roeVal = getKi('roe') ?? getKi('roe_pct');
    roeBasis = 'Reported';
    roeStatus = 'REPORTED';
    if (finite(getKi('roa')) || finite(getKi('roa_pct'))) {
      roaVal = getKi('roa') ?? getKi('roa_pct');
      roaBasis = 'Reported';
      roaStatus = 'REPORTED';
    }
  } else if (trailingNi.kind === 'TTM' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0) {
    const avgEquity = beginEq && beginEq > 0 ? (beginEq + totalEquity) / 2 : totalEquity;
    roeVal = rounded((trailingNi.totalValue / avgEquity) * 100);
    roeBasis = beginEq && beginEq > 0 ? 'TTM Net Income / Average Total Equity' : 'TTM Net Income / Ending Total Equity';
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0) {
      const avgAssets = beginAssets && beginAssets > 0 ? (beginAssets + totalAssets) / 2 : totalAssets;
      roaVal = rounded((trailingNi.totalValue / avgAssets) * 100);
      roaBasis = beginAssets && beginAssets > 0 ? 'TTM Net Income / Average Total Assets' : 'TTM Net Income / Ending Total Assets';
      roaPeriod = trailingNi.periodLabel;
      roaStatus = 'CALCULATED';
    }
  } else if (trailingNi.kind === 'ANNUAL' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0) {
    const avgEquity = beginEq && beginEq > 0 ? (beginEq + totalEquity) / 2 : totalEquity;
    roeVal = rounded((trailingNi.totalValue / avgEquity) * 100);
    roeBasis = beginEq && beginEq > 0 ? 'Annual Net Income / Average Total Equity' : 'Annual Net Income / Ending Total Equity';
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0) {
      const avgAssets = beginAssets && beginAssets > 0 ? (beginAssets + totalAssets) / 2 : totalAssets;
      roaVal = rounded((trailingNi.totalValue / avgAssets) * 100);
      roaBasis = beginAssets && beginAssets > 0 ? 'Annual Net Income / Average Total Assets' : 'Annual Net Income / Ending Total Assets';
      roaPeriod = trailingNi.periodLabel;
      roaStatus = 'CALCULATED';
    }
  } else if (trailingNi.kind === 'QUARTERLY' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0) {
    roeVal = rounded((trailingNi.totalValue / totalEquity) * 100);
    roeBasis = `${trailingNi.periodLabel} Net Income / Ending Total Equity`;
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0) {
      roaVal = rounded((trailingNi.totalValue / totalAssets) * 100);
      roaBasis = `${trailingNi.periodLabel} Net Income / Ending Total Assets`;
      roaPeriod = trailingNi.periodLabel;
      roaStatus = 'CALCULATED';
    }
  } else if (trailingNi.kind === 'INSUFFICIENT') {
    roeStatus = 'UNAVAILABLE';
    roeReason = 'INSUFFICIENT_TTM_HISTORY';
    roeReasonTh = 'ประวัติกำไรสุทธิรายไตรมาสที่ตรวจสอบแล้วไม่ครบ 4 ไตรมาสเพื่อคำนวณ TTM ROE';
    roaStatus = 'UNAVAILABLE';
    roaReason = 'INSUFFICIENT_TTM_HISTORY';
    roaReasonTh = 'ประวัติกำไรสุทธิรายไตรมาสที่ตรวจสอบแล้วไม่ครบ 4 ไตรมาสเพื่อคำนวณ TTM ROA';
  }

  const niPeriodBasis: 'TTM' | 'ANNUAL' | 'QUARTERLY' | undefined =
    trailingNi.kind === 'TTM' ? 'TTM' : trailingNi.kind === 'ANNUAL' ? 'ANNUAL' : trailingNi.kind === 'QUARTERLY' ? 'QUARTERLY' : undefined;

  const roe: ResolvedMetricItem = {
    value: roeVal,
    basis: roeBasis,
    periodBasis: niPeriodBasis,
    period: roePeriod,
    formula: 'Net Income / Total Equity × 100',
    source: roeStatus === 'CALCULATED' ? (trailingNi.source || 'SEC Income Statement & Balance Sheet') : 'Key Indicators',
    status: roeStatus,
    reason: roeReason,
    reasonTh: roeReasonTh,
  };

  const roa: ResolvedMetricItem = {
    value: roaVal,
    basis: roaBasis,
    periodBasis: niPeriodBasis,
    period: roaPeriod,
    formula: 'Net Income / Total Assets × 100',
    source: roaStatus === 'CALCULATED' ? (trailingNi.source || 'SEC Income Statement & Balance Sheet') : 'Key Indicators',
    status: roaStatus,
    reason: roaReason,
    reasonTh: roaReasonTh,
  };

  // 7. Margins — Truthful period metadata matching input statement
  const marginPeriodLabel = latestFiscal?.label || latestPeriod || 'Quarterly';
  const grossMarginVal = isFinancial ? undefined : (at(inc?.gross_margin_pct) ?? (rev !== undefined && grossProfit !== undefined && rev > 0 ? rounded((grossProfit / rev) * 100) : undefined));
  const grossMargin: ResolvedMetricItem = {
    value: grossMarginVal,
    basis: marginPeriodLabel,
    period: latestPeriod,
    status: isFinancial ? 'GUARDED' : finite(grossMarginVal) ? 'REPORTED' : 'UNAVAILABLE',
    isGuarded: isFinancial,
  };

  const opMarginVal = at(inc?.operating_margin_pct) ?? (rev !== undefined && opInc !== undefined && rev > 0 ? rounded((opInc / rev) * 100) : undefined);
  const operatingMargin: ResolvedMetricItem = {
    value: opMarginVal,
    basis: marginPeriodLabel,
    period: latestPeriod,
    status: finite(opMarginVal) ? 'REPORTED' : 'UNAVAILABLE',
  };

  const netMarginVal = at(inc?.net_margin_pct) ?? (rev !== undefined && netInc !== undefined && rev > 0 ? rounded((netInc / rev) * 100) : undefined);
  const netMargin: ResolvedMetricItem = {
    value: netMarginVal,
    basis: marginPeriodLabel,
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
      ? [{ value: fact.value, ...identity, periodEnd: fact.periodEnd, definition: fact.definition || fact.metricKey, source: `Verified fact (${fact.sourceDocument || fact.sourceType || 'source'})` }]
      : [];
  });
  const secAnnualRevenuePoints = ((report as any).sec_verification?.historical_annual_facts || []).flatMap((fact: any) => {
    const identity = fiscalIdentity(fact.period, fact.fiscal_year, undefined, fact.source_document);
    return fact.metric === 'revenue' && fact.verification === 'verified' && finite(fact.value) && identity?.kind === 'ANNUAL'
      ? [{ value: fact.value, ...identity, periodEnd: fact.period_end, definition: fact.definition, source: `SEC annual history (${fact.source_document || '10-K'})` }]
      : [];
  });
  const legacyRevenuePoints = (inc?.revenue || []).flatMap((value, index) => {
    const identity = fiscalIdentity(periods[index]);
    return finite(value) && identity?.kind === 'ANNUAL'
      ? [{ value, ...identity, definition: 'report.financial_statements.revenue', source: 'Financial Statements (annual revenue)' }]
      : [];
  });
  const canonicalRevenuePoints = (verifiedCanonical?.values?.['income_statement.revenue'] || []).flatMap((item: any) => {
    const identity = fiscalIdentity(item.period || item.periodEnd);
    return item.verification === 'verified' && finite(item.value) && identity?.kind === 'ANNUAL'
      ? [{ value: item.value, ...identity, periodEnd: item.periodEnd, definition: item.metric || 'revenue', source: 'SEC verified canonical financials' }]
      : [];
  });
  const annualRevenuePoints = dedupeFiscalPoints(
    verifiedRevenueFacts.length > 0
      ? verifiedRevenueFacts
      : secAnnualRevenuePoints.length > 0
        ? secAnnualRevenuePoints
        : canonicalRevenuePoints.length > 0
          ? canonicalRevenuePoints
          : legacyRevenuePoints,
  );
  const endingRevenue = annualRevenuePoints[annualRevenuePoints.length - 1];
  const elapsedYears = (start?: FiscalPoint, end?: FiscalPoint) => {
    if (!start || !end) return undefined;
    const startDate = start.periodEnd ? Date.parse(start.periodEnd) : NaN;
    const endDate = end.periodEnd ? Date.parse(end.periodEnd) : NaN;
    if (Number.isFinite(startDate) && Number.isFinite(endDate) && endDate > startDate) {
      const exact = (endDate - startDate) / (365.2425 * 86_400_000);
      const fiscalYearDistance = end.year - start.year;
      // Same fiscal year-end across a leap year remains exactly N fiscal years.
      return Math.abs(exact - fiscalYearDistance) <= 0.03 ? fiscalYearDistance : exact;
    }
    return end.year - start.year;
  };
  const startingRevenue = endingRevenue
    ? annualRevenuePoints
        .filter(point => point !== endingRevenue && (!endingRevenue.definition || !point.definition || point.definition === endingRevenue.definition))
        .map(point => ({ point, years: elapsedYears(point, endingRevenue) }))
        .filter((candidate): candidate is { point: FiscalPoint; years: number } => typeof candidate.years === 'number' && candidate.years >= 2.75 && candidate.years <= 3.25)
        .sort((a, b) => Math.abs(a.years - 3) - Math.abs(b.years - 3))[0]
    : undefined;
  const reportedCagr = getKi('revenue_cagr_3yr_pct');
  let revenueCagr3Y: ResolvedMetricItem;
  if (finite(reportedCagr)) {
    revenueCagr3Y = { value: reportedCagr, basis: '3Y Annual CAGR (reported)', source: 'Key Indicators', status: 'REPORTED' };
  } else if (!endingRevenue || !startingRevenue) {
    const hasDefinitionMismatch = Boolean(endingRevenue && annualRevenuePoints.some(point => {
      const years = elapsedYears(point, endingRevenue);
      return years !== undefined && years >= 2.75 && years <= 3.25 && point.definition && endingRevenue.definition && point.definition !== endingRevenue.definition;
    }));
    revenueCagr3Y = resolvedReason(hasDefinitionMismatch ? 'BASIS_MISMATCH' : 'INSUFFICIENT_HISTORY', hasDefinitionMismatch ? 'REVENUE_DEFINITION_MISMATCH' : 'INSUFFICIENT_3Y_ANNUAL_REVENUE_HISTORY', hasDefinitionMismatch ? 'นิยามรายได้ต้นงวดและปลายงวดไม่ตรงกัน จึงไม่คำนวณ CAGR' : 'ประวัติรายได้รายปียังไม่ครอบคลุม 3 ปีบริบูรณ์', {
      basis: '3Y Annual CAGR',
      period: annualRevenuePoints.length > 0 ? `${annualRevenuePoints[0].label} → ${endingRevenue?.label}` : undefined,
      source: endingRevenue?.source,
    });
  } else if (startingRevenue.point.value <= 0 || endingRevenue.value <= 0) {
    revenueCagr3Y = resolvedReason('UNAVAILABLE', 'NON_POSITIVE_REVENUE_ENDPOINT', 'รายได้ต้นงวดหรือปลายงวดไม่เป็นบวก จึงคำนวณ CAGR ไม่ได้', {
      basis: '3Y Annual CAGR', period: `${startingRevenue.point.label} → ${endingRevenue.label}`, source: endingRevenue.source,
    });
  } else {
    revenueCagr3Y = {
      value: rounded(((endingRevenue.value / startingRevenue.point.value) ** (1 / startingRevenue.years) - 1) * 100),
      basis: `Annual CAGR (${rounded(startingRevenue.years)} elapsed fiscal years)`,
      period: `${startingRevenue.point.label} → ${endingRevenue.label}`,
      formula: `(Ending annual revenue / Starting annual revenue)^(1/${rounded(startingRevenue.years)}) - 1`,
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
    interestCoverage,
    fcfYield,
    earningsYield,
    peTrailing,
    peForward,
    peg,
  };
}
