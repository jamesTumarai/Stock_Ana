import { ReportData } from '../types';
import {
  unwrapHistoryRecord,
  extractReportPrice,
  extractReportFairValue,
  extractReportConviction
} from '../utils/researchTimeline';
import { detectValuationModel } from '../utils/valuation/modelSelector';
import {
  adaptFinancialStatementsToSecPeriodStatements,
  findComparablePriorSecStatement,
  parsePeriodDescriptor
} from '../utils/secFilingDiffEngine';

export type MemorySourceType =
  | 'VERIFIED_FACT'
  | 'DETERMINISTIC_DERIVATION'
  | 'USER_INPUT'
  | 'AI_DRAFT'
  | 'SYSTEM_METADATA'
  | 'MARKET_SNAPSHOT';

export interface ResearchMemoryValuation {
  baseFairValue: number | null;
  modelType: string | null;
  marginOfSafetyPct: number | null;
  isAvailable: boolean;
  assumptions: {
    waccPct: number | null;
    terminalGrowthPct: number | null;
    revenueCagrPct: number | null;
    fcfMarginPct: number | null;
  };
  provenance: MemorySourceType;
}

export interface HistoricalPeriodFinancials {
  period: string;
  revenue: number | null;
  operatingMarginPct: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
}

export interface ResearchMemoryFinancials {
  latestPeriod: string | null;
  revenue: number | null;
  revenueYoYPct: number | null;
  operatingMarginPct: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  netCash: number | null;
  /** @deprecated Explicitly represents current shares outstanding in millions. Use currentSharesOutstandingM or dilutedWeightedAverageSharesM */
  sharesOutstanding: number | null;
  currentSharesOutstandingM: number | null;
  dilutedWeightedAverageSharesM: number | null;
  freeCashFlowPeriodBasis?: 'QUARTER' | 'ANNUAL' | 'LTM' | 'UNKNOWN';
  periodHistory?: HistoricalPeriodFinancials[];
  provenance: 'sec_verified' | 'calculated' | 'unverified' | 'unavailable';
}

export interface ResearchMemoryThesis {
  summary: string | null;
  keyDrivers: string[];
  keyRisks: string[];
  catalysts: string[];
  confirmationStatus: 'ai_draft' | 'user_confirmed' | 'user_edited' | 'unrecorded';
  provenance: MemorySourceType;
}

export interface ResearchMemoryEvidence {
  secAccession: string | null;
  secFilingDate: string | null;
  hasVerifiedSecStatements: boolean;
  citationsCount: number;
  provenance: MemorySourceType;
}

export interface ResearchMemorySnapshot {
  snapshotId: string;
  reportId: string;
  ticker: string;
  asOfDate: string; // ISO or YYYY-MM-DD
  createdTimestamp: number;
  marketPrice: number | null;
  priceProvenance: MemorySourceType;
  valuation: ResearchMemoryValuation;
  conviction: {
    score: number | null;
    provenance: MemorySourceType;
  };
  financials: ResearchMemoryFinancials;
  thesis: ResearchMemoryThesis;
  evidence: ResearchMemoryEvidence;
  engineVersion: {
    schemaVersion: number;
    generatedByVersion: string;
  };
  isLegacy: boolean;
}

export interface MemoryComparisonDelta {
  previousReportId: string;
  currentReportId: string;
  previousDate: string;
  currentDate: string;
  daysBetween: number;
  priceDelta: { previous: number; current: number; deltaPct: number } | null;
  fairValueDelta: { previous: number; current: number; deltaPct: number } | null;
  convictionScoreDelta: { previous: number; current: number; deltaPoints: number } | null;
  revenueYoYDelta: { previous: number; current: number; deltaPctPoints: number } | null;
  operatingMarginDelta: { previous: number; current: number; deltaPctPoints: number } | null;
  netIncomeDelta: { previous: number; current: number; deltaPct: number } | null;
  freeCashFlowDelta: { previous: number; current: number; deltaPct: number } | null;
  valuationAssumptionsDelta: {
    waccDeltaPoints: number | null;
    terminalGrowthDeltaPoints: number | null;
    revenueCagrDeltaPoints: number | null;
  };
  thesisChanged: boolean;
  newRisksCount: number;
  resolvedRisksCount: number;
  newCatalystsCount: number;
}

/**
 * Extracts a normalized, versioned ResearchMemorySnapshot from a raw or unwrapped report record.
 * Never fabricates values; missing fields remain null/unrecorded.
 */
export function extractMemorySnapshot(
  reportInput: any,
  explicitReportId?: string
): ResearchMemorySnapshot | null {
  if (!reportInput) return null;

  const unwrapped = unwrapHistoryRecord(reportInput);
  const data: ReportData = unwrapped?.data || (reportInput.data ? reportInput.data : reportInput);

  const rawTicker = unwrapped?.ticker
    || data.ticker
    || data.company_profile?.overview?.symbol
    || (data as any).symbol
    || '';
  const ticker = String(rawTicker).toUpperCase().trim();
  if (!ticker) return null;

  const reportId = explicitReportId
    || unwrapped?.reportId
    || (reportInput as any).id
    || (reportInput as any).report_id
    || (data as any).id
    || (ticker ? `rep_${ticker.toLowerCase()}_unknown` : 'rep_unknown');

  const rawTimestamp = unwrapped?.createdTimestamp
    || (data.generated_at ? Date.parse(String(data.generated_at)) : 0)
    || (data.as_of_date ? Date.parse(String(data.as_of_date)) : 0);

  const createdTimestamp = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : 0;

  const asOfDate = unwrapped?.createdAt
    ? (unwrapped.createdAt.includes('T') ? unwrapped.createdAt.split('T')[0] : unwrapped.createdAt)
    : (data.as_of_date || (data.generated_at ? String(data.generated_at).split('T')[0] : (createdTimestamp > 0 ? new Date(createdTimestamp).toISOString().split('T')[0] : 'Unknown')));

  // Market Price
  const marketPrice = extractReportPrice(data);

  // Valuation extraction
  const fv = extractReportFairValue(data);
  const detected = detectValuationModel(data, ticker);
  const dcfModel = data.intrinsic_value?.dcf_model;
  const assumptionsObj = (data.intrinsic_value as any)?.assumptions;
  const dcfAssumptions = dcfModel?.assumptions;

  // Active DCF guard: only extract DCF assumptions if DCF model is actively selected and valid
  const isDcfActive = (detected?.model_type === 'dcf_standard' || detected?.model_type === 'dcf_multistage')
    && dcfModel?.inputs?.isValid !== false;

  const wacc = isDcfActive
    ? (typeof assumptionsObj?.discount_rate === 'number'
        ? assumptionsObj.discount_rate
        : (typeof dcfAssumptions?.wacc_pct === 'number' ? dcfAssumptions.wacc_pct : null))
    : null;

  const terminalGrowth = isDcfActive
    ? (typeof assumptionsObj?.terminal_growth_rate === 'number'
        ? assumptionsObj.terminal_growth_rate
        : (typeof dcfAssumptions?.terminal_growth_pct === 'number' ? dcfAssumptions.terminal_growth_pct : null))
    : null;

  const revCagr = isDcfActive
    ? (typeof assumptionsObj?.revenue_growth_rate === 'number'
        ? assumptionsObj.revenue_growth_rate
        : (typeof dcfModel?.scenarios?.base?.revenue_cagr_pct === 'number'
            ? dcfModel.scenarios.base.revenue_cagr_pct
            : null))
    : null;

  const fcfMargin = isDcfActive
    ? (typeof assumptionsObj?.target_fcf_margin === 'number'
        ? assumptionsObj.target_fcf_margin
        : (typeof dcfModel?.scenarios?.base?.terminal_margin_pct === 'number'
            ? dcfModel.scenarios.base.terminal_margin_pct
            : null))
    : null;

  const mosPct = (typeof marketPrice === 'number' && typeof fv === 'number' && marketPrice > 0)
    ? Number((((fv - marketPrice) / marketPrice) * 100).toFixed(1))
    : null;

  const valuation: ResearchMemoryValuation = {
    baseFairValue: fv,
    modelType: detected?.model_type || null,
    marginOfSafetyPct: mosPct,
    isAvailable: typeof fv === 'number' && fv > 0,
    assumptions: {
      waccPct: wacc,
      terminalGrowthPct: terminalGrowth,
      revenueCagrPct: revCagr,
      fcfMarginPct: fcfMargin
    },
    provenance: 'DETERMINISTIC_DERIVATION'
  };

  // SEC Authority Order (PR #101 invariant)
  // 1. If trusted report.sec_verification.sec_period_statements or verified canonical dataset exists: prefer those facts.
  // 2. Raw report / AI financial_statements may be retained only with truthful non-SEC provenance ('calculated' / 'unavailable').
  //    They MUST NEVER receive 'sec_verified'.
  // 3. Missing trusted SEC values remain missing (null). Do not substitute report values under an SEC label.
  const secStatements = adaptFinancialStatementsToSecPeriodStatements(data);
  const secEnvelope = data.sec_verification;
  const verifiedDcfInputs = (secEnvelope?.dcf_financial_inputs?.generated_by === 'sec-verified-financial-inputs-v1')
    ? secEnvelope.dcf_financial_inputs
    : null;

  let latestPeriod: string | null = null;
  let revenue: number | null = null;
  let revenueYoYPct: number | null = null;
  let operatingMarginPct: number | null = null;
  let netIncome: number | null = null;
  let freeCashFlow: number | null = null;
  let freeCashFlowPeriodBasis: 'QUARTER' | 'ANNUAL' | 'LTM' | 'UNKNOWN' = 'UNKNOWN';
  let totalDebt: number | null = null;
  let netCash: number | null = null;
  let sharesOutstanding: number | null = null;
  let currentSharesOutstandingM: number | null = null;
  let dilutedWeightedAverageSharesM: number | null = null;
  let periodHistory: HistoricalPeriodFinancials[] | undefined = undefined;
  let financialsProvenance: ResearchMemoryFinancials['provenance'] = 'unavailable';

  if (secStatements.length > 0) {
    // Branch 1: SEC-Verified Statements
    financialsProvenance = 'sec_verified';
    // Sort statements chronologically so latestSec is always the newest regardless of input array ordering
    const sortedSec = [...secStatements].sort((a, b) => {
      const descA = parsePeriodDescriptor(a);
      const descB = parsePeriodDescriptor(b);
      const keyA = descA?.sortKey ?? 0;
      const keyB = descB?.sortKey ?? 0;
      return keyA - keyB;
    });
    const latestSec = sortedSec[sortedSec.length - 1];
    latestPeriod = latestSec.period || null;

    revenue = typeof latestSec.revenue === 'number' ? latestSec.revenue : null;

    // Hardened Comparable-Period Resolver: Strictly Annual vs Annual (FY26 vs FY25) or Quarter vs Quarter (Q4 26 vs Q4 25)
    // Never compares QoQ (e.g. Q4 vs Q3) or non-consecutive years
    const comparablePrior = findComparablePriorSecStatement(secStatements, latestSec);
    if (comparablePrior && typeof latestSec.revenue === 'number' && typeof comparablePrior.revenue === 'number' && comparablePrior.revenue > 0) {
      revenueYoYPct = Number((((latestSec.revenue - comparablePrior.revenue) / comparablePrior.revenue) * 100).toFixed(2));
    } else {
      revenueYoYPct = null;
    }

    const opInc = typeof latestSec.operating_income === 'number' ? latestSec.operating_income : null;
    if (typeof revenue === 'number' && typeof opInc === 'number' && revenue > 0) {
      operatingMarginPct = Number(((opInc / revenue) * 100).toFixed(2));
    }

    netIncome = typeof latestSec.net_income === 'number' ? latestSec.net_income : null;

    // FCF calculation strictly from verified statements or verified DCF envelope
    const ocf = typeof latestSec.operating_cash_flow === 'number' ? latestSec.operating_cash_flow : null;
    const capex = typeof latestSec.capital_expenditure === 'number' ? latestSec.capital_expenditure : null;
    if (typeof ocf === 'number' && typeof capex === 'number') {
      freeCashFlow = ocf - Math.abs(capex);
      const desc = parsePeriodDescriptor(latestSec);
      if (desc?.isAnnual) freeCashFlowPeriodBasis = 'ANNUAL';
      else if (desc?.isQuarterly) freeCashFlowPeriodBasis = 'QUARTER';
      else freeCashFlowPeriodBasis = 'UNKNOWN';
    } else if (typeof verifiedDcfInputs?.trailing_four_free_cash_flow_m === 'number') {
      freeCashFlow = verifiedDcfInputs.trailing_four_free_cash_flow_m;
      freeCashFlowPeriodBasis = 'LTM';
    }

    totalDebt = typeof latestSec.total_debt === 'number'
      ? latestSec.total_debt
      : (typeof verifiedDcfInputs?.total_debt_m === 'number' ? verifiedDcfInputs.total_debt_m : null);

    // Net cash strictly with SEC provenance
    if (typeof verifiedDcfInputs?.net_cash_m === 'number') {
      netCash = verifiedDcfInputs.net_cash_m;
    }

    // Share-count semantics preservation:
    // Diluted weighted-average shares strictly from SEC income statement period
    dilutedWeightedAverageSharesM = typeof latestSec.diluted_shares === 'number'
      ? latestSec.diluted_shares
      : null;
    // Current shares outstanding strictly from verified DCF snapshot
    currentSharesOutstandingM = typeof verifiedDcfInputs?.current_shares_outstanding_m === 'number'
      ? verifiedDcfInputs.current_shares_outstanding_m
      : null;
    // sharesOutstanding explicitly maps to current shares
    sharesOutstanding = currentSharesOutstandingM;

    // Preserved historical SEC statement periods for durable cross-period expectation resolution
    periodHistory = sortedSec.map(s => {
      const sRev = typeof s.revenue === 'number' ? s.revenue : null;
      const sOpInc = typeof s.operating_income === 'number' ? s.operating_income : null;
      const sMargin = (typeof sRev === 'number' && typeof sOpInc === 'number' && sRev > 0)
        ? Number(((sOpInc / sRev) * 100).toFixed(2))
        : null;
      const sNetInc = typeof s.net_income === 'number' ? s.net_income : null;
      const sOcf = typeof s.operating_cash_flow === 'number' ? s.operating_cash_flow : null;
      const sCapex = typeof s.capital_expenditure === 'number' ? s.capital_expenditure : null;
      const sFcf = (typeof sOcf === 'number' && typeof sCapex === 'number')
        ? sOcf - Math.abs(sCapex)
        : null;
      return {
        period: s.period,
        revenue: sRev,
        operatingMarginPct: sMargin,
        netIncome: sNetInc,
        freeCashFlow: sFcf
      };
    });
  } else {
    // Branch 2: Report Financial Statements (AI / Non-SEC)
    // NEVER label as sec_verified
    // Raw report copied statements are unverified, NEVER 'calculated'
    const stmts = data.financial_statements;
    const periods = stmts?.periods || [];
    const latestIdx = periods.length > 0 ? periods.length - 1 : -1;

    financialsProvenance = periods.length > 0 ? 'unverified' : 'unavailable';
    latestPeriod = latestIdx >= 0 ? periods[latestIdx] : null;

    revenue = latestIdx >= 0 && typeof stmts?.income_statement?.revenue?.[latestIdx] === 'number'
      ? stmts.income_statement.revenue[latestIdx]
      : null;

    revenueYoYPct = latestIdx >= 0 && typeof stmts?.income_statement?.yoy_revenue_growth_pct?.[latestIdx] === 'number'
      ? stmts.income_statement.yoy_revenue_growth_pct[latestIdx]
      : null;

    const opInc = latestIdx >= 0 && typeof stmts?.income_statement?.operating_income?.[latestIdx] === 'number'
      ? stmts.income_statement.operating_income[latestIdx]
      : null;

    operatingMarginPct = (typeof revenue === 'number' && typeof opInc === 'number' && revenue > 0)
      ? Number(((opInc / revenue) * 100).toFixed(2))
      : (latestIdx >= 0 && typeof stmts?.income_statement?.operating_margin_pct?.[latestIdx] === 'number'
          ? stmts.income_statement.operating_margin_pct[latestIdx]
          : null);

    netIncome = latestIdx >= 0 && typeof stmts?.income_statement?.net_income?.[latestIdx] === 'number'
      ? stmts.income_statement.net_income[latestIdx]
      : null;

    freeCashFlow = latestIdx >= 0 && typeof stmts?.cash_flow?.free_cash_flow?.[latestIdx] === 'number'
      ? stmts.cash_flow.free_cash_flow[latestIdx]
      : null;

    if (freeCashFlow !== null && latestPeriod) {
      if (/^Q[1-4]/i.test(latestPeriod) || /[-/\s]+Q[1-4]$/i.test(latestPeriod)) {
        freeCashFlowPeriodBasis = 'QUARTER';
      } else if (/^(?:FY\s*)?\d{2,4}$/i.test(latestPeriod)) {
        freeCashFlowPeriodBasis = 'ANNUAL';
      } else {
        freeCashFlowPeriodBasis = 'UNKNOWN';
      }
    }

    const bs = stmts?.balance_sheet;
    totalDebt = latestIdx >= 0 && typeof bs?.total_debt?.[latestIdx] === 'number'
      ? bs.total_debt[latestIdx]
      : null;

    const cash = latestIdx >= 0 && typeof bs?.cash_and_equivalents?.[latestIdx] === 'number'
      ? bs.cash_and_equivalents[latestIdx]
      : null;

    // Blocker B: short_term_investments missing must NOT fall back to 0
    const hasExplicitSti = latestIdx >= 0 && typeof bs?.short_term_investments?.[latestIdx] === 'number';
    const sti = hasExplicitSti ? bs!.short_term_investments![latestIdx] : null;

    if (typeof cash === 'number' && typeof totalDebt === 'number' && hasExplicitSti && typeof sti === 'number') {
      netCash = (cash + sti) - totalDebt;
    } else {
      netCash = null;
    }

    currentSharesOutstandingM = typeof data.company_profile?.shares_outstanding === 'number'
      ? data.company_profile.shares_outstanding
      : (typeof (data.intrinsic_value as any)?.dcf_model?.shares_outstanding_m === 'number'
          ? (data.intrinsic_value as any).dcf_model.shares_outstanding_m
          : null);
    dilutedWeightedAverageSharesM = null;
    sharesOutstanding = currentSharesOutstandingM;

    periodHistory = periods.map((p, idx) => {
      const pRev = typeof stmts?.income_statement?.revenue?.[idx] === 'number' ? stmts.income_statement.revenue[idx] : null;
      const pOpInc = typeof stmts?.income_statement?.operating_income?.[idx] === 'number' ? stmts.income_statement.operating_income[idx] : null;
      const pMargin = (typeof pRev === 'number' && typeof pOpInc === 'number' && pRev > 0)
        ? Number(((pOpInc / pRev) * 100).toFixed(2))
        : (typeof stmts?.income_statement?.operating_margin_pct?.[idx] === 'number' ? stmts.income_statement.operating_margin_pct[idx] : null);
      const pNetInc = typeof stmts?.income_statement?.net_income?.[idx] === 'number' ? stmts.income_statement.net_income[idx] : null;
      const pFcf = typeof stmts?.cash_flow?.free_cash_flow?.[idx] === 'number' ? stmts.cash_flow.free_cash_flow[idx] : null;
      return {
        period: p,
        revenue: pRev,
        operatingMarginPct: pMargin,
        netIncome: pNetInc,
        freeCashFlow: pFcf
      };
    });
  }

  const financials: ResearchMemoryFinancials = {
    latestPeriod,
    revenue,
    revenueYoYPct,
    operatingMarginPct,
    netIncome,
    freeCashFlow,
    totalDebt,
    netCash,
    sharesOutstanding,
    currentSharesOutstandingM,
    dilutedWeightedAverageSharesM,
    freeCashFlowPeriodBasis,
    periodHistory,
    provenance: financialsProvenance
  };

  // Thesis Extraction
  const verdictSummary = data.verdict?.summary || null;
  const keyDrivers: string[] = [];
  if (data.verdict?.key_takeaways && Array.isArray(data.verdict.key_takeaways)) {
    keyDrivers.push(...data.verdict.key_takeaways.slice(0, 5));
  } else if (data.comprehensive_analysis?.beginner_summary?.top_3_strengths) {
    keyDrivers.push(...data.comprehensive_analysis.beginner_summary.top_3_strengths);
  }

  const keyRisks: string[] = [];
  if (data.comprehensive_analysis?.beginner_summary?.top_3_risks && Array.isArray(data.comprehensive_analysis.beginner_summary.top_3_risks)) {
    keyRisks.push(...data.comprehensive_analysis.beginner_summary.top_3_risks);
  }

  const catalysts: string[] = [];
  if (data.catalysts_and_events?.items && Array.isArray(data.catalysts_and_events.items)) {
    for (const item of data.catalysts_and_events.items.slice(0, 5)) {
      if (item.title) catalysts.push(item.title);
    }
  }

  // Thesis confirmation state: if explicitly recorded in report or user-confirmed
  const confirmationStatus = (data as any).thesis_confirmation_status || 'ai_draft';

  const thesis: ResearchMemoryThesis = {
    summary: verdictSummary,
    keyDrivers,
    keyRisks,
    catalysts,
    confirmationStatus,
    provenance: confirmationStatus === 'user_confirmed' ? 'USER_INPUT' : 'AI_DRAFT'
  };

  // Evidence
  const latestSecStatement = secStatements.length > 0 ? secStatements[secStatements.length - 1] : secEnvelope?.sec_period_statements?.[secEnvelope.sec_period_statements.length - 1];
  const secAccession = latestSecStatement?.accession
    || (secEnvelope as any)?.submissions?.recentFilings?.[0]?.accessionNumber
    || (data as any)?.evidence?.secAccession
    || null;
  const secFilingDate = secEnvelope?.latest_statements_source?.filing_date
    || latestSecStatement?.filed_date
    || (secEnvelope as any)?.submissions?.recentFilings?.[0]?.filingDate
    || (data as any)?.evidence?.secFilingDate
    || null;
  const findings = data.findings || [];

  const evidence: ResearchMemoryEvidence = {
    secAccession,
    secFilingDate,
    hasVerifiedSecStatements: secStatements.length > 0,
    citationsCount: findings.length,
    provenance: 'VERIFIED_FACT'
  };

  const isLegacy = Boolean(
    unwrapped?.isLegacy ||
    !data.schema_version ||
    data.schema_version < 2
  );

  return {
    snapshotId: `mem_${ticker}_${reportId}`,
    reportId,
    ticker,
    asOfDate,
    createdTimestamp,
    marketPrice,
    priceProvenance: 'MARKET_SNAPSHOT',
    valuation,
    conviction: {
      score: extractReportConviction(data),
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    financials,
    thesis,
    evidence,
    engineVersion: {
      schemaVersion: data.schema_version || 1,
      generatedByVersion: data.generated_by_version || '1.0.0'
    },
    isLegacy
  };
}

/**
 * Builds a chronologically sorted array of ResearchMemorySnapshots for a given ticker.
 * Deduplicates by reportId and orders descending by createdTimestamp.
 */
export function buildMemoryTimeline(
  ticker: string,
  allReports: any[] = [],
  activeReport?: any
): ResearchMemorySnapshot[] {
  const cleanTicker = ticker.toUpperCase().trim();
  const list: ResearchMemorySnapshot[] = [];

  const seenReportIds = new Set<string>();

  if (activeReport) {
    const snap = extractMemorySnapshot(activeReport);
    if (snap && snap.ticker === cleanTicker) {
      list.push(snap);
      seenReportIds.add(snap.reportId);
    }
  }

  for (const r of allReports) {
    const snap = extractMemorySnapshot(r);
    if (snap && snap.ticker === cleanTicker && !seenReportIds.has(snap.reportId)) {
      list.push(snap);
      seenReportIds.add(snap.reportId);
    }
  }

  list.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  return list;
}

/**
 * Finds the immediate prior memory snapshot strictly prior to activeReport.
 * Never fabricates temporal order when historical timestamp is unknown (0).
 */
export function getPreviousMemorySnapshot(
  ticker: string,
  allReports: any[] = [],
  activeReport?: any
): ResearchMemorySnapshot | null {
  const timeline = buildMemoryTimeline(ticker, allReports, activeReport);
  if (timeline.length < 2) return null;

  if (!activeReport) {
    const candidate = timeline[1];
    return (candidate && candidate.createdTimestamp > 0) ? candidate : null;
  }

  const activeSnap = extractMemorySnapshot(activeReport);
  if (!activeSnap || activeSnap.createdTimestamp === 0) {
    return null;
  }

  for (const item of timeline) {
    if (item.reportId === activeSnap.reportId) continue;
    if (item.createdTimestamp > 0 && item.createdTimestamp < activeSnap.createdTimestamp) {
      return item;
    }
  }

  return null;
}

/**
 * Deterministically compares two memory snapshots.
 */
export function compareMemorySnapshots(
  current: ResearchMemorySnapshot,
  previous: ResearchMemorySnapshot
): MemoryComparisonDelta {
  const daysBetween = Math.max(
    0,
    Math.round(Math.abs(current.createdTimestamp - previous.createdTimestamp) / (1000 * 60 * 60 * 24))
  );

  // Price Delta
  const curPrice = current.marketPrice;
  const prevPrice = previous.marketPrice;
  const priceDelta = (curPrice && prevPrice && prevPrice > 0)
    ? {
        previous: prevPrice,
        current: curPrice,
        deltaPct: Number((((curPrice - prevPrice) / prevPrice) * 100).toFixed(2))
      }
    : null;

  // Fair Value Delta
  const curFv = current.valuation.baseFairValue;
  const prevFv = previous.valuation.baseFairValue;
  const fairValueDelta = (curFv && prevFv && prevFv > 0)
    ? {
        previous: prevFv,
        current: curFv,
        deltaPct: Number((((curFv - prevFv) / prevFv) * 100).toFixed(2))
      }
    : null;

  // Conviction Score Delta
  const curScore = current.conviction.score;
  const prevScore = previous.conviction.score;
  const convictionScoreDelta = (typeof curScore === 'number' && typeof prevScore === 'number')
    ? {
        previous: prevScore,
        current: curScore,
        deltaPoints: curScore - prevScore
      }
    : null;

  // Revenue YoY Delta
  const curRevYoY = current.financials.revenueYoYPct;
  const prevRevYoY = previous.financials.revenueYoYPct;
  const revenueYoYDelta = (typeof curRevYoY === 'number' && typeof prevRevYoY === 'number')
    ? {
        previous: prevRevYoY,
        current: curRevYoY,
        deltaPctPoints: Number((curRevYoY - prevRevYoY).toFixed(2))
      }
    : null;

  // Operating Margin Delta
  const curOpm = current.financials.operatingMarginPct;
  const prevOpm = previous.financials.operatingMarginPct;
  const operatingMarginDelta = (typeof curOpm === 'number' && typeof prevOpm === 'number')
    ? {
        previous: prevOpm,
        current: curOpm,
        deltaPctPoints: Number((curOpm - prevOpm).toFixed(2))
      }
    : null;

  // Net Income Delta
  const curNetInc = current.financials.netIncome;
  const prevNetInc = previous.financials.netIncome;
  const netIncomeDelta = (typeof curNetInc === 'number' && typeof prevNetInc === 'number' && prevNetInc !== 0)
    ? {
        previous: prevNetInc,
        current: curNetInc,
        deltaPct: Number((((curNetInc - prevNetInc) / Math.abs(prevNetInc)) * 100).toFixed(2))
      }
    : null;

  // FCF Delta - strictly comparable period bases only (e.g. QUARTER vs QUARTER, ANNUAL vs ANNUAL, LTM vs LTM)
  const curFcf = current.financials.freeCashFlow;
  const prevFcf = previous.financials.freeCashFlow;
  const curBasis = current.financials.freeCashFlowPeriodBasis || 'UNKNOWN';
  const prevBasis = previous.financials.freeCashFlowPeriodBasis || 'UNKNOWN';
  const isComparableFcf = curBasis !== 'UNKNOWN' && curBasis === prevBasis;

  const freeCashFlowDelta = (isComparableFcf && typeof curFcf === 'number' && typeof prevFcf === 'number' && prevFcf !== 0)
    ? {
        previous: prevFcf,
        current: curFcf,
        deltaPct: Number((((curFcf - prevFcf) / Math.abs(prevFcf)) * 100).toFixed(2))
      }
    : null;

  // Valuation Assumptions Delta
  const waccDelta = (typeof current.valuation.assumptions.waccPct === 'number' && typeof previous.valuation.assumptions.waccPct === 'number')
    ? Number((current.valuation.assumptions.waccPct - previous.valuation.assumptions.waccPct).toFixed(2))
    : null;

  const tgDelta = (typeof current.valuation.assumptions.terminalGrowthPct === 'number' && typeof previous.valuation.assumptions.terminalGrowthPct === 'number')
    ? Number((current.valuation.assumptions.terminalGrowthPct - previous.valuation.assumptions.terminalGrowthPct).toFixed(2))
    : null;

  const cagrDelta = (typeof current.valuation.assumptions.revenueCagrPct === 'number' && typeof previous.valuation.assumptions.revenueCagrPct === 'number')
    ? Number((current.valuation.assumptions.revenueCagrPct - previous.valuation.assumptions.revenueCagrPct).toFixed(2))
    : null;

  // Risk changes
  const prevRiskSet = new Set(previous.thesis.keyRisks.map(r => r.trim().toLowerCase()));
  const curRiskSet = new Set(current.thesis.keyRisks.map(r => r.trim().toLowerCase()));

  let newRisksCount = 0;
  for (const r of curRiskSet) {
    if (!prevRiskSet.has(r)) newRisksCount++;
  }

  let resolvedRisksCount = 0;
  for (const r of prevRiskSet) {
    if (!curRiskSet.has(r)) resolvedRisksCount++;
  }

  // Catalyst changes
  const prevCatSet = new Set(previous.thesis.catalysts.map(c => c.trim().toLowerCase()));
  const curCatSet = new Set(current.thesis.catalysts.map(c => c.trim().toLowerCase()));

  let newCatalystsCount = 0;
  for (const c of curCatSet) {
    if (!prevCatSet.has(c)) newCatalystsCount++;
  }

  const thesisChanged = Boolean(
    (current.thesis.summary !== previous.thesis.summary) ||
    newRisksCount > 0 ||
    resolvedRisksCount > 0 ||
    newCatalystsCount > 0
  );

  return {
    previousReportId: previous.reportId,
    currentReportId: current.reportId,
    previousDate: previous.asOfDate,
    currentDate: current.asOfDate,
    daysBetween,
    priceDelta,
    fairValueDelta,
    convictionScoreDelta,
    revenueYoYDelta,
    operatingMarginDelta,
    netIncomeDelta,
    freeCashFlowDelta,
    valuationAssumptionsDelta: {
      waccDeltaPoints: waccDelta,
      terminalGrowthDeltaPoints: tgDelta,
      revenueCagrDeltaPoints: cagrDelta
    },
    thesisChanged,
    newRisksCount,
    resolvedRisksCount,
    newCatalystsCount
  };
}
