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
  quartersUsed?: string[];
  inputsUsed?: Record<string, number>;
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
  fcfMargin: ResolvedMetricItem;

  roe: ResolvedMetricItem;
  roa: ResolvedMetricItem;
  roic: ResolvedMetricItem;
  wacc: ResolvedMetricItem;
  roicWaccSpread: ResolvedMetricItem;
  interestCoverage: ResolvedMetricItem;

  fcfYield: ResolvedMetricItem;
  earningsYield: ResolvedMetricItem;
  dividendYield: ResolvedMetricItem;
  netBuybackYield: ResolvedMetricItem;
  shareholderYield: ResolvedMetricItem;
  fcfConversion: ResolvedMetricItem;

  netCashOrDebt: ResolvedMetricItem;
  netCashToMarketCap: ResolvedMetricItem;
  netDebtToEbitda: ResolvedMetricItem;
  currentRatio: ResolvedMetricItem;
  quickRatio: ResolvedMetricItem;
  cashRunwayMonths: ResolvedMetricItem;
  cashBurnRate: ResolvedMetricItem;

  nim: ResolvedMetricItem;
  efficiencyRatio: ResolvedMetricItem;
  combinedRatio: ResolvedMetricItem;
  pffo: ResolvedMetricItem;
  occupancyRate: ResolvedMetricItem;

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
  periodType?: 'standalone_quarter' | 'annual' | 'instant';
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
    && (current.kind === 'ANNUAL' || point.quarter === current.quarter)
    && (!current.definition || !point.definition || current.definition === point.definition));

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
    if (/ytd|annual|cumulative|6m|9m/i.test(String(s.period_type || ''))) continue;
    const identity = fiscalIdentity(periodStr, s.fiscal_year, s.fiscal_quarter, s.form);
    if (identity) {
      points.push({
        value: val,
        ...identity,
        label: identity.label,
        source: `SEC ${s.form || 'filing'}${s.accession ? ` (${s.accession})` : ''}`,
        periodEnd: s.period_end || periodStr,
        periodType: identity.kind === 'QUARTERLY' ? 'standalone_quarter' : 'annual',
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
        periodType: identity.kind === 'QUARTERLY' ? 'standalone_quarter' : 'annual',
        definition: String(item.derivation || '').match(/us-gaap:([A-Za-z0-9]+)/)?.[1],
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
  const quarterlyPoints = points.filter(p => p.kind === 'QUARTERLY' && finite(p.quarter) && p.periodType !== 'annual').sort((a, b) => a.year - b.year || (a.quarter || 0) - (b.quarter || 0));

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

      const distinctEnds = consecutive.filter(p => p.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(p.periodEnd));
      if (consecutive.length === 4 && new Set(distinctEnds.map(p => p.periodEnd)).size === distinctEnds.length) {
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
  const canonicalAt = (key: string, period: string): number | undefined => {
    const item = verifiedCanonical?.values?.[key]?.find((candidate: any) => candidate.period === period);
    return item?.verification === 'verified' && finite(item.value) ? item.value : undefined;
  };

  const rev = canonicalAt('income_statement.revenue', latestPeriod) ?? at(inc?.revenue);
  const netInc = canonicalAt('income_statement.net_income', latestPeriod) ?? at(inc?.net_income);
  const opInc = canonicalAt('income_statement.operating_income', latestPeriod) ?? at(inc?.operating_income);
  const grossProfit = canonicalAt('income_statement.gross_profit', latestPeriod) ?? at(inc?.gross_profit);

  const cash = canonicalAt('balance_sheet.cash_and_equivalents', latestPeriod) ?? at(bs?.cash_and_equivalents);
  const stInvestments = canonicalAt('balance_sheet.short_term_investments', latestPeriod) ?? at(bs?.short_term_investments);
  const totalDebt = canonicalAt('balance_sheet.total_debt', latestPeriod) ?? at(bs?.total_debt) ?? (
    at(bs?.short_term_debt) !== undefined && at(bs?.long_term_debt) !== undefined
      ? (at(bs?.short_term_debt) as number) + (at(bs?.long_term_debt) as number)
      : undefined
  );
  const totalEquity = canonicalAt('balance_sheet.total_equity', latestPeriod) ?? at(bs?.total_equity);
  const totalAssets = canonicalAt('balance_sheet.total_assets', latestPeriod) ?? at(bs?.total_assets);

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
  const latestFiscal = fiscalIdentity(latestPeriod);
  let rawRevGrowth = at(inc?.yoy_revenue_growth_pct) ?? getKi('revenue_growth_yoy_pct');
  let revGrowthStatus: MetricResolutionStatus = finite(rawRevGrowth) ? 'REPORTED' : 'UNAVAILABLE';
  let revGrowthSource = inc?.yoy_revenue_growth_pct ? 'Income Statement' : 'Key Indicators';
  let revGrowthBasis = latestFiscal?.kind === 'QUARTERLY' ? 'Quarter YoY' : latestFiscal?.kind === 'ANNUAL' ? 'FY YoY' : 'YoY';
  let revGrowthPeriod = latestPeriod;

  const secRevPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'revenue');
  const canonicalRevPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.revenue'], 'revenue');
  if (!finite(rawRevGrowth) || secRevPoints.length > 0 || canonicalRevPoints.length > 0) {
    const legacyRevPoints = extractFiscalSeries(inc?.revenue, periods, 'Financial Statements (revenue)');
    const allRevPoints = dedupeFiscalPoints([
      ...canonicalRevPoints, ...secRevPoints,
      ...(canonicalRevPoints.length || secRevPoints.length ? [] : legacyRevPoints),
    ]);
    const currentRevPoint = allRevPoints[allRevPoints.length - 1];
    const priorRevPoint = currentRevPoint ? comparablePrior(allRevPoints, currentRevPoint) : undefined;
    if (currentRevPoint && priorRevPoint && priorRevPoint.value > 0 && currentRevPoint.value > 0) {
      rawRevGrowth = rounded(((currentRevPoint.value / priorRevPoint.value) - 1) * 100);
      revGrowthStatus = 'CALCULATED';
      revGrowthSource = currentRevPoint.source;
      revGrowthBasis = currentRevPoint.kind === 'QUARTERLY' ? 'Quarter YoY' : 'FY YoY';
      revGrowthPeriod = `${priorRevPoint.label} → ${currentRevPoint.label}`;
    } else if (canonicalRevPoints.length || secRevPoints.length) {
      rawRevGrowth = undefined;
      revGrowthStatus = 'INSUFFICIENT_HISTORY';
      revGrowthSource = currentRevPoint?.source || 'SEC verified financials';
    }
  }

  const revenueGrowthYoY: ResolvedMetricItem = {
    value: rawRevGrowth,
    basis: revGrowthBasis,
    periodBasis: latestFiscal?.kind === 'QUARTERLY' ? 'QUARTERLY' : latestFiscal?.kind === 'ANNUAL' ? 'ANNUAL' : undefined,
    period: revGrowthPeriod,
    source: revGrowthSource,
    status: revGrowthStatus,
    reason: finite(rawRevGrowth) ? undefined : 'Revenue growth history unavailable',
    reasonTh: finite(rawRevGrowth) ? undefined : 'ข้อมูลการเติบโตของรายได้ไม่พร้อมใช้งาน',
  };

  // 3. EPS Growth YoY
  let epsGrowthVal = at((inc as any)?.yoy_eps_growth_pct) ?? getKi('yoy_eps_growth_pct') ?? getKi('eps_growth_yoy_pct') ?? getKi('eps_growth');
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

  const verifiedEpsPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.eps_diluted'], 'eps_diluted');
  const legacyEpsPoints = extractFiscalSeries(inc?.eps_diluted, periods, 'Financial Statements (Diluted EPS)');
  const epsPoints = dedupeFiscalPoints(verifiedEpsPoints.length ? verifiedEpsPoints : legacyEpsPoints);
  if (verifiedEpsPoints.length > 0) {
    epsGrowthVal = undefined;
    epsGrowthStatus = 'INSUFFICIENT_HISTORY';
    epsGrowthReason = 'No comparable prior-year verified diluted EPS period';
    epsGrowthReasonTh = 'ไม่มี EPS แบบ diluted ที่ตรวจสอบแล้วของงวดเดียวกันในปีก่อน';
  }
  if ((verifiedEpsPoints.length >= 2 || epsGrowthVal === undefined) && epsPoints.length >= 2) {
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
    source: epsGrowthStatus === 'CALCULATED' ? epsPoints[epsPoints.length - 1]?.source : at((inc as any)?.yoy_eps_growth_pct) !== undefined || inc?.eps_diluted ? 'Financial Statements (Diluted EPS)' : 'Key Indicators',
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
  const allOpPoints = dedupeFiscalPoints([...canonicalOpPoints, ...secOpPoints,
    ...(canonicalOpPoints.length || secOpPoints.length ? [] : legacyOpPoints)]);
  const trailingOp = resolveTrailingFourQuarters(allOpPoints, latestFiscal);

  const secEbtPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'income_before_tax');
  const canonicalEbtPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.income_before_tax'], 'income_before_tax');
  const legacyEbtPoints = extractFiscalSeries(inc?.income_before_tax, periods, 'Financial Statements (EBT)');
  const allEbtPoints = dedupeFiscalPoints([...canonicalEbtPoints, ...secEbtPoints,
    ...(canonicalEbtPoints.length || secEbtPoints.length ? [] : legacyEbtPoints)]);

  const secTaxPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'income_tax_expense');
  const canonicalTaxPoints = extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.income_tax_expense'], 'income_tax_expense');
  const legacyTaxPoints = extractFiscalSeries(inc?.income_tax_expense || (inc as any)?.tax_provision, periods, 'Financial Statements (tax expense)');
  const allTaxPoints = dedupeFiscalPoints([...canonicalTaxPoints, ...secTaxPoints,
    ...(canonicalTaxPoints.length || secTaxPoints.length ? [] : legacyTaxPoints)]);

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

  const secBalanceStatements = (report as any).sec_verification?.is_sec_verified === true
    ? ((report as any).sec_verification?.sec_period_statements || []) as any[] : [];
  const secBalanceAt = (year?: number, quarter?: number, kind?: FiscalKind) =>
    secBalanceStatements.find(statement => {
      const identity = fiscalIdentity(statement.period, statement.fiscal_year, statement.fiscal_quarter, statement.form);
      return identity?.year === year && identity.kind === kind && identity.quarter === quarter;
    });
  const endingSecBalance = secBalanceAt(latestFiscal?.year, latestFiscal?.quarter, latestFiscal?.kind);
  const endingEquity = finite(endingSecBalance?.total_equity) ? endingSecBalance.total_equity as number : totalEquity;
  const endingDebt = finite(endingSecBalance?.total_debt) ? endingSecBalance.total_debt as number : totalDebt;
  const endingCash = finite(endingSecBalance?.cash) ? endingSecBalance.cash as number
    : finite(endingSecBalance?.cash_and_equivalents) ? endingSecBalance.cash_and_equivalents as number : cash;
  const endingShortInvestments = finite(endingSecBalance?.short_term_investments) ? endingSecBalance.short_term_investments as number : stInvestments;
  const endingIC = finite(endingEquity) && finite(endingDebt) && finite(endingCash)
    ? endingEquity + endingDebt - endingCash - (endingShortInvestments ?? 0) : null;

  const eqArr = bs?.total_equity || [];
  const debtArr = bs?.total_debt || [];
  const cashArr = bs?.cash_and_equivalents || [];
  const stArr = bs?.short_term_investments || [];
  const assetsArr = bs?.total_assets || [];

  let beginIC: number | undefined;
  let beginEq: number | undefined;
  let beginAssets: number | undefined;
  const beginningFiscalYear = latestFiscal ? latestFiscal.year - 1 : undefined;
  const beginIdx = beginningFiscalYear === undefined ? -1 : periods.findIndex(period => {
    const identity = fiscalIdentity(period);
    return identity?.year === beginningFiscalYear
      && identity.kind === latestFiscal?.kind
      && identity.quarter === latestFiscal?.quarter;
  });
  if (beginIdx >= 0 && eqArr.length > beginIdx) {
    beginEq = eqArr[beginIdx];
    const beginDebt = debtArr[beginIdx] ?? (
      bs?.short_term_debt?.[beginIdx] !== undefined && bs?.long_term_debt?.[beginIdx] !== undefined
        ? (bs.short_term_debt[beginIdx] as number) + (bs.long_term_debt[beginIdx] as number)
        : undefined
    );
    const beginCash = (cashArr[beginIdx] ?? 0) + (stArr[beginIdx] ?? 0);
    beginAssets = assetsArr[beginIdx];
    if (finite(beginEq) && finite(beginDebt)) {
      beginIC = beginEq + beginDebt - beginCash;
    }
  }
  const beginningSecBalance = secBalanceAt(beginningFiscalYear, latestFiscal?.quarter, latestFiscal?.kind);
  if (beginningSecBalance) {
    if (finite(beginningSecBalance.total_equity)) beginEq = beginningSecBalance.total_equity;
    if (finite(beginningSecBalance.total_assets)) beginAssets = beginningSecBalance.total_assets;
    const secBeginCash = finite(beginningSecBalance.cash) ? beginningSecBalance.cash
      : beginningSecBalance.cash_and_equivalents;
    if (finite(beginEq) && finite(beginningSecBalance.total_debt) && finite(secBeginCash)) {
      beginIC = beginEq + beginningSecBalance.total_debt - secBeginCash
        - (finite(beginningSecBalance.short_term_investments) ? beginningSecBalance.short_term_investments : 0);
    }
  }
  if (beginningFiscalYear !== undefined && latestFiscal) {
    const beginPeriod = latestFiscal.kind === 'QUARTERLY'
      ? `Q${latestFiscal.quarter} ${beginningFiscalYear}` : `FY${beginningFiscalYear}`;
    const canonicalBeginEq = canonicalAt('balance_sheet.total_equity', beginPeriod);
    const canonicalBeginDebt = canonicalAt('balance_sheet.total_debt', beginPeriod);
    const canonicalBeginCash = canonicalAt('balance_sheet.cash_and_equivalents', beginPeriod);
    const canonicalBeginSti = canonicalAt('balance_sheet.short_term_investments', beginPeriod);
    if (finite(canonicalBeginEq)) beginEq = canonicalBeginEq;
    beginAssets = canonicalAt('balance_sheet.total_assets', beginPeriod) ?? beginAssets;
    if (finite(canonicalBeginEq) && finite(canonicalBeginDebt) && finite(canonicalBeginCash)) {
      beginIC = canonicalBeginEq + canonicalBeginDebt - canonicalBeginCash - (canonicalBeginSti ?? 0);
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
  } else if (secOpPoints.length >= 4 && trailingOp.kind === 'TTM' && trailingOp.totalValue !== null && endingIC !== null && endingIC > 0 && finite(beginIC) && beginIC > 0) {
    // 1. Independently verified SEC 4 quarters
    const roicResult = calculateCanonicalRoic({
      operatingIncome: trailingOp.totalValue,
      incomeBeforeTax: ttmEbt,
      incomeTaxExpense: ttmTaxExp,
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
  } else if (trailingOp.kind === 'TTM' && (secOpPoints.length > 0 || canonicalOpPoints.length > 0) && (!finite(beginIC) || beginIC <= 0)) {
    roicStatus = 'UNAVAILABLE';
    roicReason = 'MISSING_COMPARABLE_BEGINNING_INVESTED_CAPITAL';
    roicReasonTh = 'ไม่พบเงินลงทุนสุทธิของงวดเดียวกันในปีก่อน จึงคำนวณ ROIC แบบเฉลี่ยไม่ได้';
  } else if (secOpPoints.length === 0 && canonicalOpPoints.length === 0 && (finite(getKi('roic')) || finite(getKi('roic_pct')))) {
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
  } else if (trailingOp.totalValue !== null && endingIC > 0 && (trailingOp.kind !== 'TTM' || (finite(beginIC) && beginIC > 0))) {
    const roicResult = calculateCanonicalRoic({
      operatingIncome: trailingOp.totalValue,
      incomeBeforeTax: ttmEbt,
      incomeTaxExpense: ttmTaxExp,
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
    quartersUsed: roicStatus === 'CALCULATED' && trailingOp.kind === 'TTM' ? trailingOp.points.map(point => point.label) : undefined,
    inputsUsed: roicStatus === 'CALCULATED' && trailingOp.kind === 'TTM' && finite(beginIC) && finite(endingIC)
      ? { operatingIncome: trailingOp.totalValue!, beginningInvestedCapital: beginIC, endingInvestedCapital: endingIC } : undefined,
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
  const allNiPoints = dedupeFiscalPoints([...canonicalNiPoints, ...secNiPoints,
    ...(canonicalNiPoints.length || secNiPoints.length ? [] : legacyNiPoints)]);
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

  if (secNiPoints.length >= 4 && trailingNi.kind === 'TTM' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0 && finite(beginEq) && beginEq > 0) {
    const avgEquity = beginEq && beginEq > 0 ? (beginEq + totalEquity) / 2 : totalEquity;
    roeVal = rounded((trailingNi.totalValue / avgEquity) * 100);
    roeBasis = beginEq && beginEq > 0 ? 'TTM Net Income / Average Total Equity' : 'TTM Net Income / Ending Total Equity';
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0 && finite(beginAssets) && beginAssets > 0) {
      const avgAssets = beginAssets && beginAssets > 0 ? (beginAssets + totalAssets) / 2 : totalAssets;
      roaVal = rounded((trailingNi.totalValue / avgAssets) * 100);
      roaBasis = beginAssets && beginAssets > 0 ? 'TTM Net Income / Average Total Assets' : 'TTM Net Income / Ending Total Assets';
      roaPeriod = trailingNi.periodLabel;
      roaStatus = 'CALCULATED';
    }
  } else if (secNiPoints.length === 0 && canonicalNiPoints.length === 0 && (finite(getKi('roe')) || finite(getKi('roe_pct')))) {
    roeVal = getKi('roe') ?? getKi('roe_pct');
    roeBasis = 'Reported';
    roeStatus = 'REPORTED';
    if (finite(getKi('roa')) || finite(getKi('roa_pct'))) {
      roaVal = getKi('roa') ?? getKi('roa_pct');
      roaBasis = 'Reported';
      roaStatus = 'REPORTED';
    }
  } else if (trailingNi.kind === 'TTM' && trailingNi.totalValue !== null && totalEquity !== undefined && totalEquity > 0 && finite(beginEq) && beginEq > 0) {
    const avgEquity = beginEq && beginEq > 0 ? (beginEq + totalEquity) / 2 : totalEquity;
    roeVal = rounded((trailingNi.totalValue / avgEquity) * 100);
    roeBasis = beginEq && beginEq > 0 ? 'TTM Net Income / Average Total Equity' : 'TTM Net Income / Ending Total Equity';
    roePeriod = trailingNi.periodLabel;
    roeStatus = 'CALCULATED';

    if (totalAssets !== undefined && totalAssets > 0 && finite(beginAssets) && beginAssets > 0) {
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
    quartersUsed: roeStatus === 'CALCULATED' && trailingNi.kind === 'TTM' ? trailingNi.points.map(point => point.label) : undefined,
    inputsUsed: roeStatus === 'CALCULATED' && trailingNi.kind === 'TTM' && finite(beginEq) && finite(totalEquity)
      ? { netIncome: trailingNi.totalValue!, beginningEquity: beginEq, endingEquity: totalEquity } : undefined,
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
    quartersUsed: roaStatus === 'CALCULATED' && trailingNi.kind === 'TTM' ? trailingNi.points.map(point => point.label) : undefined,
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

  const verifiedOp = canonicalAt('income_statement.operating_income', latestPeriod);
  const verifiedRev = canonicalAt('income_statement.revenue', latestPeriod);
  const opMarginVal = finite(verifiedOp) && finite(verifiedRev) && verifiedRev > 0
    ? rounded((verifiedOp / verifiedRev) * 100)
    : at(inc?.operating_margin_pct) ?? (rev !== undefined && opInc !== undefined && rev > 0 ? rounded((opInc / rev) * 100) : undefined);
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
  const secOcfPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'operating_cash_flow');
  const secCapexPoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'capital_expenditure');
  const secFcfPoints = dedupeFiscalPoints(secOcfPoints.flatMap(ocf => {
    const capex = secCapexPoints.find(point => point.kind === ocf.kind && point.year === ocf.year
      && point.quarter === ocf.quarter && (!point.periodEnd || !ocf.periodEnd || point.periodEnd === ocf.periodEnd));
    return capex ? [{ ...ocf, value: ocf.value - Math.abs(capex.value), source: 'SEC verified period statements (OCF - CapEx)' }] : [];
  }));
  const canonicalFcfPoints = dedupeFiscalPoints((verifiedCanonical?.values?.['cash_flow.free_cash_flow'] || []).flatMap((item: any) => {
    const identity = fiscalIdentity(item.period || item.periodEnd);
    return item.verification === 'verified' && finite(item.value) && identity
      ? [{ value: item.value, ...identity, periodEnd: item.periodEnd, source: 'SEC verified canonical financials' }]
      : [];
  }));
  const fcfPoints = dedupeFiscalPoints([
    ...canonicalFcfPoints,
    ...secFcfPoints,
    ...(canonicalFcfPoints.length || secFcfPoints.length ? [] : legacyFcfPoints),
  ]);
  const trailingFcf = resolveTrailingFourQuarters(fcfPoints, latestFiscal);
  const canonicalTtmFcf = trailingFcf.kind === 'TTM' ? trailingFcf.totalValue : null;
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
  } else if (fcfPoints.length === 0 && (finite(at((cf as any)?.yoy_fcf_growth_pct)) || finite(getKi('fcf_growth')))) {
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
  const annualRevenuePoints = dedupeFiscalPoints([
    ...secAnnualRevenuePoints,
    ...verifiedRevenueFacts,
    ...canonicalRevenuePoints,
    ...legacyRevenuePoints,
  ]);
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
  if (finite(reportedCagr) && annualRevenuePoints.length === 0) {
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

  // Resolve Market Capitalization in millions for consistent ratio derivations
  const rawMcap = (report as any)?.market_snapshot?.market_cap
    ?? (report as any)?.company_profile?.market_cap
    ?? getKi('market_cap');
  let mcapMillions: number | undefined;
  if (finite(rawMcap) && rawMcap > 0) {
    mcapMillions = rawMcap > 1e6 ? rawMcap / 1e6 : rawMcap;
  } else if (typeof rawMcap === 'string') {
    const text = rawMcap.trim().toUpperCase();
    const num = parseFloat(text.replace(/[^0-9.-]/g, ''));
    if (finite(num)) {
      if (text.includes('T')) mcapMillions = num * 1_000_000;
      else if (text.includes('B')) mcapMillions = num * 1_000;
      else if (text.includes('M')) mcapMillions = num;
      else mcapMillions = num > 1e6 ? num / 1e6 : num;
    }
  }

  // 10. Yields (FCF Yield & Earnings Yield)
  let fcfYieldVal: number | undefined;
  let fcfYieldBasis = 'FCF / Market Cap';
  let fcfYieldPeriod = latestPeriod;
  let fcfYieldSource = 'Market Snapshot / Valuation Ratios';
  let fcfYieldStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let fcfYieldFormula = 'TTM Free Cash Flow / Market Capitalization × 100';

  if (!isFinancial) {
    if (mcapMillions && mcapMillions > 0 && finite(canonicalTtmFcf)) {
      fcfYieldVal = rounded((canonicalTtmFcf / mcapMillions) * 100);
      fcfYieldBasis = trailingFcf.kind === 'TTM' ? 'TTM FCF / Market Cap' : `${trailingFcf.periodLabel} FCF / Market Cap`;
      fcfYieldPeriod = trailingFcf.periodLabel;
      fcfYieldSource = trailingFcf.source || 'SEC Free Cash Flow';
      fcfYieldStatus = 'CALCULATED';
      fcfYieldFormula = trailingFcf.kind === 'TTM' ? 'TTM Free Cash Flow / Market Capitalization × 100' : 'Free Cash Flow / Market Capitalization × 100';
    }
  }

  const fcfYield: ResolvedMetricItem = {
    value: fcfYieldVal,
    basis: fcfYieldBasis,
    period: fcfYieldPeriod,
    formula: fcfYieldFormula,
    source: fcfYieldSource,
    status: isFinancial ? 'GUARDED' : finite(fcfYieldVal) ? fcfYieldStatus : 'UNAVAILABLE',
    quartersUsed: trailingFcf.kind === 'TTM' && fcfYieldStatus === 'CALCULATED' ? trailingFcf.points.map(point => point.label) : undefined,
    inputsUsed: trailingFcf.kind === 'TTM' && fcfYieldStatus === 'CALCULATED' && finite(canonicalTtmFcf) && finite(mcapMillions)
      ? { freeCashFlow: canonicalTtmFcf, marketCapitalization: mcapMillions } : undefined,
    reason: isFinancial ? 'Guarded for financial institutions' : finite(fcfYieldVal) && fcfYieldVal < 0 ? 'Negative Free Cash Flow (Cash Burn)' : undefined,
    reasonTh: isFinancial ? 'FCF Yield ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)' : finite(fcfYieldVal) && fcfYieldVal < 0 ? 'กระแสเงินสดอิสระติดลบ (Cash Burn)' : undefined,
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

  // 11. FCF Margin (Quarterly FCF / Quarterly Revenue * 100)
  let fcfMarginVal: number | undefined;
  let fcfMarginBasis = currentFcf?.label ? `${currentFcf.label} FCF / Revenue` : 'Quarter FCF / Revenue';
  let fcfMarginPeriod = currentFcf?.label || latestPeriod;
  let fcfMarginSource = currentFcf?.source || 'Cash Flow Statement';
  let fcfMarginFormula = 'Quarterly Free Cash Flow / Quarterly Revenue × 100';

  const verifiedRevForMargin = dedupeFiscalPoints([
    ...extractCanonicalFacts(verifiedCanonical?.values?.['income_statement.revenue'], 'revenue'),
    ...extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'revenue'),
  ]);
  const matchingRevenue = currentFcf && verifiedRevForMargin.length
    ? verifiedRevForMargin.find(point => point.kind === currentFcf.kind && point.year === currentFcf.year
      && point.quarter === currentFcf.quarter
      && (!point.periodEnd || !currentFcf.periodEnd || point.periodEnd === currentFcf.periodEnd))
    : undefined;
  const matchingLegacyIndex = currentFcf ? periods.findIndex(period => fiscalIdentity(period)?.label === currentFcf.label) : -1;
  const marginRevenue = matchingRevenue?.value ?? (matchingLegacyIndex >= 0 && verifiedRevForMargin.length === 0 ? inc?.revenue?.[matchingLegacyIndex] : undefined);
  if (!isFinancial) {
    if (currentFcf?.kind === 'QUARTERLY' && finite(marginRevenue) && marginRevenue > 0) {
      fcfMarginVal = rounded((currentFcf.value / marginRevenue) * 100);
      fcfMarginBasis = `${currentFcf.label} FCF / Revenue`;
      fcfMarginPeriod = currentFcf.label;
      fcfMarginSource = currentFcf.source;
    } else if (fcfPoints.length === 0 && finite(getKi('fcf_margin_pct'))) {
      fcfMarginVal = getKi('fcf_margin_pct');
      fcfMarginBasis = 'Reported';
      fcfMarginSource = 'Key Indicators';
    }
  }
  const fcfMargin: ResolvedMetricItem = {
    value: fcfMarginVal,
    basis: fcfMarginBasis,
    period: fcfMarginPeriod,
    formula: fcfMarginFormula,
    source: fcfMarginSource,
    status: isFinancial ? 'GUARDED' : finite(fcfMarginVal) ? 'CALCULATED' : 'UNAVAILABLE',
    reason: isFinancial ? 'FCF Margin guarded for financial institutions' : undefined,
    reasonTh: isFinancial ? 'FCF Margin ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)' : undefined,
    isGuarded: isFinancial,
  };

  // 12. WACC & ROIC - WACC Spread
  const dcf = (report.intrinsic_value as any)?.dcf ?? (report.intrinsic_value as any)?.dcf_model;
  const modelAssumptions = (report.intrinsic_value as any)?.model_assumptions;
  const dcfAssumptions = (report as any)?.dcf_assumptions;
  const dashboardWacc = (report as any)?.valuation_dashboard?.wacc;
  const rootWacc = (report as any)?.wacc_pct ?? getKi('wacc') ?? getKi('wacc_pct');
  const costOfCapitalWacc = (report.intrinsic_value as any)?.cost_of_capital?.wacc ?? (report.intrinsic_value as any)?.cost_of_capital?.wacc_pct;
  const candidateWacc = costOfCapitalWacc ?? dcf?.wacc_pct ?? dcf?.wacc ?? modelAssumptions?.wacc ?? dcfAssumptions?.wacc ?? dashboardWacc ?? rootWacc;
  let waccVal: number | undefined;
  let waccSource = 'DCF Assumptions';
  if (finite(candidateWacc) && candidateWacc > 0 && candidateWacc < 50) {
    waccVal = candidateWacc <= 1 && candidateWacc > 0 ? rounded(candidateWacc * 100) : rounded(candidateWacc);
    if (costOfCapitalWacc) waccSource = 'Intrinsic Value Cost of Capital';
    else if (dcf?.wacc_pct || dcf?.wacc) waccSource = 'Intrinsic Value DCF Model';
    else if (modelAssumptions?.wacc) waccSource = 'Valuation Model Assumptions';
    else if (dashboardWacc) waccSource = 'Valuation Dashboard';
    else waccSource = 'Key Indicators';
  }

  const wacc: ResolvedMetricItem = {
    value: waccVal,
    basis: 'Weighted Average Cost of Capital',
    formula: 'Cost of Equity × Equity% + Cost of Debt × Debt% × (1 - Tax Rate)',
    source: waccSource,
    status: isFinancial ? 'GUARDED' : finite(waccVal) ? 'CALCULATED' : 'UNAVAILABLE',
    reason: isFinancial ? 'WACC not applicable to financial institutions' : finite(waccVal) ? undefined : 'WACC inputs unavailable',
    reasonTh: isFinancial ? 'WACC ไม่ใช้กับสถาบันการเงิน' : finite(waccVal) ? undefined : 'ไม่พบข้อมูลต้นทุนทางการเงิน (WACC)',
    isGuarded: isFinancial,
  };

  let roicWaccSpreadVal: number | undefined;
  let roicWaccStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let roicWaccReason: string | undefined;
  let roicWaccReasonTh: string | undefined;
  if (isFinancial) {
    roicWaccStatus = 'GUARDED';
    roicWaccReason = 'ROIC-WACC Spread guarded for financial institutions';
    roicWaccReasonTh = 'ROIC - WACC ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)';
  } else if (finite(roic.value) && finite(waccVal)) {
    roicWaccSpreadVal = rounded(roic.value - waccVal);
    roicWaccStatus = 'CALCULATED';
    roicWaccReason = roicWaccSpreadVal > 0
      ? `ROIC exceeds cost of capital by ${roicWaccSpreadVal} percentage points`
      : roicWaccSpreadVal < 0
        ? `ROIC is ${Math.abs(roicWaccSpreadVal)} percentage points below estimated cost of capital`
        : `ROIC matches estimated cost of capital`;
    roicWaccReasonTh = roicWaccSpreadVal > 0
      ? `ผลตอบแทนจากเงินลงทุน (ROIC) สูงกว่าต้นทุนทางการเงิน (WACC) อยู่ ${roicWaccSpreadVal} จุดเปอร์เซ็นต์`
      : roicWaccSpreadVal < 0
        ? `ผลตอบแทนจากเงินลงทุน (ROIC) ต่ำกว่าต้นทุนทางการเงิน (WACC) อยู่ ${Math.abs(roicWaccSpreadVal)} จุดเปอร์เซ็นต์`
        : `ผลตอบแทนจากเงินลงทุน (ROIC) ใกล้เคียงกับต้นทุนทางการเงิน (WACC)`;
  } else {
    roicWaccStatus = 'UNAVAILABLE';
    roicWaccReason = !finite(waccVal) ? 'WACC cannot be independently supported' : 'ROIC inputs unavailable';
    roicWaccReasonTh = !finite(waccVal) ? 'ไม่พบข้อมูลต้นทุนเงินทุน (WACC) ที่ตรวจสอบได้ จึงไม่แสดงส่วนต่าง ROIC - WACC' : 'ข้อมูล ROIC ไม่พร้อมใช้งาน';
  }

  const roicWaccSpread: ResolvedMetricItem = {
    value: roicWaccSpreadVal,
    basis: roicWaccSpreadVal !== undefined ? `${roic.basis || 'ROIC'} - WACC (${waccVal}%)` : undefined,
    formula: 'ROIC - WACC',
    source: `${roic.source || 'ROIC'} - ${wacc.source || 'WACC'}`,
    status: roicWaccStatus,
    reason: roicWaccReason,
    reasonTh: roicWaccReasonTh,
    isGuarded: isFinancial,
  };



  // 13. Dividend Yield & Net Buyback Yield & Shareholder Yield
  const rawDivYield = (report as any)?.market_snapshot?.dividend_yield
    ?? report.valuation_ratios?.find(r => /dividend.*yield/i.test(r.name))?.value
    ?? getKi('dividend_yield')
    ?? getKi('dividend_yield_pct')
    ?? report.five_pillars?.yields?.dividend_yield_pct;
  let divYieldVal: number | undefined;
  if (finite(rawDivYield) && rawDivYield >= 0) {
    divYieldVal = rawDivYield <= 0.3 && rawDivYield > 0 ? rounded(rawDivYield * 100) : rounded(rawDivYield);
  }
  const dividendYield: ResolvedMetricItem = {
    value: divYieldVal,
    basis: 'Annual Dividend / Current Share Price',
    formula: 'Annual Dividend / Share Price × 100',
    source: 'Market Snapshot / Key Indicators',
    status: finite(divYieldVal) ? 'REPORTED' : 'UNAVAILABLE',
    reason: finite(divYieldVal) ? undefined : 'Dividend yield not reported or unavailable',
    reasonTh: finite(divYieldVal) ? undefined : 'ไม่มีข้อมูลอัตราผลตอบแทนเงินปันผล',
  };

  // Extract SEC repurchases and issuances
  const secRepurchasePoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'repurchase_of_common_stock');
  const canonicalRepurchasePoints = extractCanonicalFacts(verifiedCanonical?.values?.['cash_flow.repurchase_of_common_stock'], 'repurchase_of_common_stock');
  const legacyRepurchasePoints = extractFiscalSeries((cf as any)?.repurchase_of_common_stock, periods, 'Financial Statements (repurchases)');
  const allRepurchasePoints = dedupeFiscalPoints([...secRepurchasePoints, ...canonicalRepurchasePoints, ...legacyRepurchasePoints]);

  const secIssuancePoints = extractSecPeriodFacts((report as any).sec_verification?.sec_period_statements, 'issuance_of_common_stock');
  const canonicalIssuancePoints = extractCanonicalFacts(verifiedCanonical?.values?.['cash_flow.issuance_of_common_stock'], 'issuance_of_common_stock');
  const legacyIssuancePoints = extractFiscalSeries((cf as any)?.issuance_of_common_stock, periods, 'Financial Statements (issuance)');
  const allIssuancePoints = dedupeFiscalPoints([...secIssuancePoints, ...canonicalIssuancePoints, ...legacyIssuancePoints]);

  const trailingRepurchases = resolveTrailingFourQuarters(allRepurchasePoints, latestFiscal);
  const trailingIssuance = resolveTrailingFourQuarters(allIssuancePoints, latestFiscal);

  const repurchases = trailingRepurchases.totalValue
    ?? at((cf as any)?.repurchase_of_common_stock)
    ?? at((cf as any)?.share_repurchases)
    ?? at((cf as any)?.payments_for_repurchase_of_equity);
  const issuance = trailingIssuance.totalValue
    ?? at((cf as any)?.issuance_of_common_stock)
    ?? at((cf as any)?.sale_of_stock)
    ?? at((cf as any)?.proceeds_from_stock_issuance);
  const kiBuyback = getKi('net_buyback_yield') ?? getKi('net_buyback_yield_pct') ?? getKi('buyback_yield_pct');

  let netBuybackVal: number | undefined;
  let buybackSource = 'Cash Flow Statement';
  if (finite(kiBuyback)) {
    netBuybackVal = kiBuyback;
    buybackSource = 'Key Indicators';
  } else if (mcapMillions && mcapMillions > 0 && (repurchases !== undefined || issuance !== undefined || (report as any)?.is_zero_buybacks_established)) {
    const netRepurchases = (Math.abs(repurchases ?? 0)) - (Math.abs(issuance ?? 0));
    netBuybackVal = rounded((netRepurchases / mcapMillions) * 100);
    buybackSource = trailingRepurchases.kind === 'TTM'
      ? 'SEC Cash Flow Statement TTM (Repurchases - Issuance) / Market Cap'
      : 'SEC Cash Flow Statement (Repurchases - Issuance) / Market Cap';
  }

  const netBuybackYield: ResolvedMetricItem = {
    value: netBuybackVal,
    basis: '(Share Repurchases - Equity Issuance) / Market Cap',
    formula: '(Net Repurchases - Equity Issuance) / Market Capitalization × 100',
    source: buybackSource,
    status: finite(netBuybackVal) ? 'CALCULATED' : 'UNAVAILABLE',
    reason: finite(netBuybackVal)
      ? (netBuybackVal < 0 ? `Net Shareholder Dilution of ${Math.abs(netBuybackVal)}%` : `Net Buyback Yield of ${netBuybackVal}%`)
      : 'Insufficient verified repurchase or issuance data',
    reasonTh: finite(netBuybackVal)
      ? (netBuybackVal < 0 ? `การเจือจางหุ้นสุทธิ (Net Dilution) ${Math.abs(netBuybackVal)}%` : `อัตราการซื้อหุ้นคืนสุทธิ ${netBuybackVal}%`)
      : 'ข้อมูลการซื้อหุ้นคืนหรือการออกหุ้นเพิ่มทุนไม่เพียงพอ',
  };

  let shareholderYieldVal: number | undefined;
  let shareholderYieldStatus: MetricResolutionStatus = 'UNAVAILABLE';
  if (divYieldVal !== undefined && netBuybackVal !== undefined) {
    shareholderYieldVal = rounded(divYieldVal + netBuybackVal);
    shareholderYieldStatus = 'CALCULATED';
  } else if (divYieldVal !== undefined && netBuybackVal === undefined && (report as any)?.is_zero_buybacks_established) {
    shareholderYieldVal = divYieldVal;
    shareholderYieldStatus = 'CALCULATED';
  }

  const shareholderYield: ResolvedMetricItem = {
    value: shareholderYieldVal,
    basis: shareholderYieldVal !== undefined ? `Dividend Yield (${divYieldVal}%) + Net Buyback Yield (${netBuybackVal}%)` : undefined,
    formula: 'Cash Shareholder Yield = (TTM Dividends + TTM Share Repurchases - TTM Equity Issuance) / Market Cap × 100',
    source: 'SEC Cash Flow Statement + Market Dividend Yield',
    status: shareholderYieldStatus,
    reason: shareholderYieldVal !== undefined
      ? `Shareholder Yield ${shareholderYieldVal}% (Dividend: ${divYieldVal}%, Net Buyback/Dilution: ${netBuybackVal}%)`
      : 'Insufficient verified dividend or buyback inputs',
    reasonTh: shareholderYieldVal !== undefined
      ? `ผลตอบแทนรวมสู่ผู้ถือหุ้น ${shareholderYieldVal}% (ปันผล: ${divYieldVal}%, ซื้อหุ้นคืน/เจือจาง: ${netBuybackVal}%)`
      : 'ข้อมูลเงินปันผลหรือการซื้อหุ้นคืน/เจือจางไม่เพียงพอ',
  };

  // 14. FCF Conversion (TTM FCF / TTM Net Income * 100)
  let fcfConversionVal: number | undefined;
  let fcfConversionStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let fcfConversionReason: string | undefined;
  let fcfConversionReasonTh: string | undefined;
  let fcfConversionBasis = 'TTM FCF / TTM Net Income';

  const ttmNi = trailingNi.kind === 'TTM' ? trailingNi.totalValue : null;
  // Use the exact SAME canonical TTM FCF as FCF Yield
  const ttmFcf = canonicalTtmFcf;
  const matchingTtmWindow = trailingNi.kind === 'TTM' && trailingFcf.kind === 'TTM'
    && trailingNi.points.map(point => point.label).join('|') === trailingFcf.points.map(point => point.label).join('|');

  if (isFinancial || archetype === 'reit') {
    fcfConversionStatus = 'GUARDED';
    fcfConversionReason = isFinancial ? 'FCF Conversion guarded for financial institutions' : 'FCF Conversion not applicable to REITs (prefer AFFO)';
    fcfConversionReasonTh = isFinancial ? 'FCF Conversion ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)' : 'FCF Conversion ไม่ใช้กับ REIT (เน้น FFO/AFFO)';
  } else if (!matchingTtmWindow && finite(netInc) && netInc <= 0) {
    fcfConversionReason = 'Net Income non-positive (N/M)';
    fcfConversionReasonTh = 'กำไรสุทธิมีค่าติดลบหรือไม่เป็นบวก จึงไม่คำนวณอัตราการแปลงเป็นเงินสด (N/M)';
  } else if (matchingTtmWindow && finite(ttmFcf) && finite(ttmNi)) {
    if (ttmNi <= 0) {
      fcfConversionStatus = 'UNAVAILABLE';
      fcfConversionReason = 'Net Income non-positive (N/M)';
      fcfConversionReasonTh = 'กำไรสุทธิมีค่าติดลบหรือไม่เป็นบวก จึงไม่คำนวณอัตราการแปลงเป็นเงินสด (N/M)';
      fcfConversionBasis = 'TTM FCF / TTM Net Income (Net Loss)';
    } else if (ttmNi < 1) {
      fcfConversionStatus = 'UNAVAILABLE';
      fcfConversionReason = 'Net Income near zero (N/M)';
      fcfConversionReasonTh = 'กำไรสุทธิต่ำใกล้ศูนย์ จึงไม่คำนวณอัตราส่วนแปลงเงินสดเพื่อหลีกเลี่ยงความคลาดเคลื่อน (N/M)';
      fcfConversionBasis = 'TTM FCF / TTM Net Income (Near Zero)';
    } else {
      fcfConversionVal = rounded((ttmFcf / ttmNi) * 100);
      fcfConversionStatus = 'CALCULATED';
      fcfConversionReason = `${fcfConversionVal}% cash conversion rate`;
      fcfConversionReasonTh = `อัตราการแปลงกำไรเป็นกระแสเงินสด ${fcfConversionVal}%`;
    }
  } else {
    fcfConversionStatus = 'UNAVAILABLE';
    fcfConversionReason = 'Insufficient verified FCF or Net Income inputs';
    fcfConversionReasonTh = 'ข้อมูลกระแสเงินสดอิสระหรือกำไรสุทธิไม่เพียงพอ';
  }

  // Cross-metric sign invariant guard:
  // If TTM NI > 0 and FCF Conversion < 0, then TTM FCF < 0, so FCF Yield cannot be positive
  if (finite(ttmNi) && ttmNi > 0 && finite(fcfConversionVal) && fcfConversionVal < 0 && finite(fcfYield.value) && fcfYield.value > 0) {
    if (finite(ttmFcf) && mcapMillions && mcapMillions > 0) {
      fcfYield.value = rounded((ttmFcf / mcapMillions) * 100);
      fcfYield.basis = 'TTM FCF / Market Cap (Canonical Sign Invariant)';
      fcfYield.status = 'CALCULATED';
    }
  }

  const fcfConversion: ResolvedMetricItem = {
    value: fcfConversionVal,
    basis: fcfConversionBasis,
    formula: 'TTM Free Cash Flow / TTM Net Income × 100',
    source: 'SEC Cash Flow Statement / Income Statement',
    status: fcfConversionStatus,
    quartersUsed: fcfConversionStatus === 'CALCULATED' ? trailingFcf.points.map(point => point.label) : undefined,
    inputsUsed: fcfConversionStatus === 'CALCULATED' ? { freeCashFlow: ttmFcf!, netIncome: ttmNi! } : undefined,
    reason: fcfConversionReason,
    reasonTh: fcfConversionReasonTh,
    isGuarded: isFinancial || archetype === 'reit',
  };

  // 15. Balance Sheet: Net Cash/Debt, Net Cash/Market Cap, Net Debt/EBITDA, Liquidity
  const netCashAmount = totalCash !== undefined && totalDebt !== undefined ? rounded((totalCash - totalDebt) / 1000) : undefined;
  const isNetCash = netCashAmount !== undefined && netCashAmount >= 0;

  const netCashOrDebt: ResolvedMetricItem = {
    value: netCashAmount !== undefined ? Math.abs(netCashAmount) : undefined,
    basis: isNetCash ? 'Net Cash (Total Cash - Total Debt)' : 'Net Debt (Total Debt - Total Cash)',
    status: netCashAmount !== undefined ? 'CALCULATED' : 'UNAVAILABLE',
    reason: isNetCash ? `Net Cash +$${Math.abs(netCashAmount!)}B` : `Net Debt -$${Math.abs(netCashAmount!)}B`,
    reasonTh: isNetCash ? `สถานะเงินสดสุทธิ +$${Math.abs(netCashAmount!)}B` : `ภาระหนี้สินสุทธิ -$${Math.abs(netCashAmount!)}B`,
  };

  let netCashToMcapVal: number | undefined;
  if (isNetCash && netCashAmount !== undefined && netCashAmount > 0 && mcapMillions && mcapMillions > 0) {
    netCashToMcapVal = rounded(((netCashAmount * 1000) / mcapMillions) * 100);
  }
  const netCashToMarketCap: ResolvedMetricItem = {
    value: netCashToMcapVal,
    basis: 'Net Cash / Market Capitalization',
    formula: 'Net Cash / Market Cap × 100',
    status: isNetCash && finite(netCashToMcapVal) ? 'CALCULATED' : 'NOT_APPLICABLE',
    reason: isNetCash && finite(netCashToMcapVal) ? `${netCashToMcapVal}% of market cap in net cash` : 'Not in net cash position',
    reasonTh: isNetCash && finite(netCashToMcapVal) ? `เงินสดสุทธิคิดเป็น ${netCashToMcapVal}% ของมูลค่าหลักทรัพย์ตามราคาตลาด` : 'บริษัทไม่มีสถานะเงินสดสุทธิ',
  };

  const depAmort = at((cf as any)?.depreciation_amortization) ?? at(cf?.depreciation);
  const ebitdaVal = at((inc as any)?.ebitda) ?? getKi('ebitda') ?? (opInc !== undefined && depAmort !== undefined ? opInc + Math.abs(depAmort) : undefined);
  let netDebtToEbitdaVal: number | undefined;
  let netDebtToEbitdaStatus: MetricResolutionStatus = 'UNAVAILABLE';
  let netDebtToEbitdaReason: string | undefined;
  let netDebtToEbitdaReasonTh: string | undefined;

  if (isFinancial) {
    netDebtToEbitdaStatus = 'GUARDED';
    netDebtToEbitdaReason = 'Guarded for financial institutions';
    netDebtToEbitdaReasonTh = 'Net Debt / EBITDA ไม่ใช้กับสถาบันการเงิน (Financial Sector Guard)';
  } else if (isNetCash) {
    netDebtToEbitdaStatus = 'NOT_APPLICABLE';
    netDebtToEbitdaReason = 'Company in Net Cash position; Net Debt / EBITDA not applicable';
    netDebtToEbitdaReasonTh = 'บริษัทมีสถานะเงินสดสุทธิ (Net Cash) จึงไม่ใช้อัตราส่วน Net Debt / EBITDA';
  } else if (totalDebt !== undefined && totalCash !== undefined && totalDebt > totalCash) {
    const netDebtRaw = totalDebt - totalCash;
    if (ebitdaVal !== undefined && ebitdaVal <= 0) {
      netDebtToEbitdaStatus = 'UNAVAILABLE';
      netDebtToEbitdaReason = 'EBITDA non-positive (N/M)';
      netDebtToEbitdaReasonTh = 'EBITDA มีค่าติดลบหรือไม่เป็นบวก จึงไม่แสดงอัตราส่วน Net Debt / EBITDA (N/M)';
    } else if (ebitdaVal !== undefined && ebitdaVal > 0) {
      netDebtToEbitdaVal = rounded(netDebtRaw / ebitdaVal);
      netDebtToEbitdaStatus = 'CALCULATED';
      netDebtToEbitdaReason = `${netDebtToEbitdaVal}x Net Debt / EBITDA`;
      netDebtToEbitdaReasonTh = `หนี้สินสุทธิต่อ EBITDA เท่ากับ ${netDebtToEbitdaVal}x`;
    } else {
      netDebtToEbitdaStatus = 'UNAVAILABLE';
      netDebtToEbitdaReason = 'EBITDA inputs unavailable';
      netDebtToEbitdaReasonTh = 'ไม่พบข้อมูล EBITDA';
    }
  } else {
    netDebtToEbitdaStatus = 'UNAVAILABLE';
    netDebtToEbitdaReason = 'Balance sheet debt inputs unavailable';
    netDebtToEbitdaReasonTh = 'ข้อมูลหนี้สินในงบดุลไม่เพียงพอ';
  }

  const netDebtToEbitda: ResolvedMetricItem = {
    value: netDebtToEbitdaVal,
    basis: '(Total Debt - Cash) / TTM EBITDA',
    formula: 'Net Debt / TTM EBITDA',
    status: netDebtToEbitdaStatus,
    reason: netDebtToEbitdaReason,
    reasonTh: netDebtToEbitdaReasonTh,
    isGuarded: isFinancial,
  };

  const currAssets = at(bs?.total_current_assets);
  const currLiab = at(bs?.total_current_liabilities);
  const repCurrentRatio = getKi('current_ratio');
  let currentRatioVal: number | undefined;
  if (finite(repCurrentRatio)) {
    currentRatioVal = repCurrentRatio;
  } else if (currAssets !== undefined && currLiab !== undefined && currLiab > 0) {
    currentRatioVal = rounded(currAssets / currLiab);
  }
  const currentRatio: ResolvedMetricItem = {
    value: currentRatioVal,
    basis: 'Total Current Assets / Total Current Liabilities',
    formula: 'Current Assets / Current Liabilities',
    status: isFinancial ? 'GUARDED' : finite(currentRatioVal) ? 'CALCULATED' : 'UNAVAILABLE',
    isGuarded: isFinancial,
  };

  const repQuickRatio = getKi('quick_ratio');
  let quickRatioVal: number | undefined;
  if (finite(repQuickRatio)) {
    quickRatioVal = repQuickRatio;
  } else if (cash !== undefined && currLiab !== undefined && currLiab > 0) {
    const recVal = at((bs as any)?.net_receivables) ?? at(bs?.receivables) ?? at(bs?.accounts_receivable) ?? 0;
    const quickAssets = (cash + (stInvestments ?? 0) + recVal);
    quickRatioVal = rounded(quickAssets / currLiab);
  }
  const quickRatio: ResolvedMetricItem = {
    value: quickRatioVal,
    basis: 'Quick Assets / Total Current Liabilities',
    formula: '(Cash + ST Investments + Receivables) / Current Liabilities',
    status: isFinancial ? 'GUARDED' : finite(quickRatioVal) ? 'CALCULATED' : 'UNAVAILABLE',
    isGuarded: isFinancial,
  };

  const repRunway = getKi('cash_runway_months') ?? getKi('cash_runway');
  const cashRunwayMonths: ResolvedMetricItem = {
    value: finite(repRunway) ? repRunway : undefined,
    basis: 'Cash Runway in Months',
    status: finite(repRunway) ? 'REPORTED' : 'UNAVAILABLE',
  };

  const repBurn = getKi('cash_burn_annual') ?? getKi('annual_cash_burn');
  const cashBurnRate: ResolvedMetricItem = {
    value: finite(repBurn) ? repBurn : undefined,
    basis: 'Annual Cash Burn Rate ($B)',
    status: finite(repBurn) ? 'REPORTED' : 'UNAVAILABLE',
  };

  // 16. Sector-Specific Fundamentals
  const nimVal = getKi('nim') ?? getKi('net_interest_margin_pct');
  const nim: ResolvedMetricItem = {
    value: nimVal,
    basis: 'Net Interest Margin',
    status: isFinancial && finite(nimVal) ? 'REPORTED' : isFinancial ? 'UNAVAILABLE' : 'NOT_APPLICABLE',
  };

  const effVal = getKi('efficiency_ratio') ?? getKi('efficiency_ratio_pct');
  const efficiencyRatio: ResolvedMetricItem = {
    value: effVal,
    basis: 'Non-Interest Expense / Revenue',
    status: isFinancial && finite(effVal) ? 'REPORTED' : isFinancial ? 'UNAVAILABLE' : 'NOT_APPLICABLE',
  };

  const combVal = (report.key_indicators as any)?.profitability?.combined_ratio_pct ?? getKi('combined_ratio');
  const combinedRatio: ResolvedMetricItem = {
    value: combVal,
    basis: 'Incurred Losses + Expenses / Earned Premiums',
    status: archetype === 'insurer' && finite(combVal) ? 'REPORTED' : archetype === 'insurer' ? 'UNAVAILABLE' : 'NOT_APPLICABLE',
  };

  const pffoVal = report.valuation_ratios?.find(r => /P\/FFO/i.test(r.name))?.value ?? getKi('p_ffo_multiple');
  const pffo: ResolvedMetricItem = {
    value: pffoVal,
    basis: 'Price / Funds From Operations',
    status: archetype === 'reit' && finite(pffoVal) ? 'REPORTED' : archetype === 'reit' ? 'UNAVAILABLE' : 'NOT_APPLICABLE',
  };

  const occVal = (report.key_indicators as any)?.operational?.occupancy_rate_pct ?? getKi('occupancy_rate') ?? getKi('occupancy_rate_pct');
  const occupancyRate: ResolvedMetricItem = {
    value: occVal,
    basis: 'Portfolio Occupancy Rate',
    status: archetype === 'reit' && finite(occVal) ? 'REPORTED' : archetype === 'reit' ? 'UNAVAILABLE' : 'NOT_APPLICABLE',
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
    fcfMargin,
    roe,
    roa,
    roic,
    wacc,
    roicWaccSpread,
    interestCoverage,
    fcfYield,
    earningsYield,
    dividendYield,
    netBuybackYield,
    shareholderYield,
    fcfConversion,
    netCashOrDebt,
    netCashToMarketCap,
    netDebtToEbitda,
    currentRatio,
    quickRatio,
    cashRunwayMonths,
    cashBurnRate,
    nim,
    efficiencyRatio,
    combinedRatio,
    pffo,
    occupancyRate,
    peTrailing,
    peForward,
    peg,
  };
}
