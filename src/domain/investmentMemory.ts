import { ReportData } from '../types';
import {
  unwrapHistoryRecord,
  extractReportPrice,
  extractReportFairValue,
  extractReportConviction
} from '../utils/researchTimeline';
import { detectValuationModel } from '../utils/valuation/modelSelector';

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

export interface ResearchMemoryFinancials {
  latestPeriod: string | null;
  revenue: number | null;
  revenueYoYPct: number | null;
  operatingMarginPct: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  netCash: number | null;
  sharesOutstanding: number | null;
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
    || `rep_${Date.now()}`;

  const createdTimestamp = unwrapped?.createdTimestamp
    || (data.generated_at ? Date.parse(String(data.generated_at)) : 0)
    || Date.now();

  const asOfDate = unwrapped?.createdAt
    ? (unwrapped.createdAt.includes('T') ? unwrapped.createdAt.split('T')[0] : unwrapped.createdAt)
    : (data.as_of_date || (data.generated_at ? String(data.generated_at).split('T')[0] : new Date(createdTimestamp).toISOString().split('T')[0]));

  // Market Price
  const marketPrice = extractReportPrice(data);

  // Valuation extraction
  const fv = extractReportFairValue(data);
  const detected = detectValuationModel(data, ticker);
  const dcfModel = data.intrinsic_value?.dcf_model;
  const assumptionsObj = (data.intrinsic_value as any)?.assumptions;
  const dcfAssumptions = dcfModel?.assumptions;

  const wacc = typeof assumptionsObj?.discount_rate === 'number'
    ? assumptionsObj.discount_rate
    : (typeof dcfAssumptions?.wacc_pct === 'number' ? dcfAssumptions.wacc_pct : null);

  const terminalGrowth = typeof assumptionsObj?.terminal_growth_rate === 'number'
    ? assumptionsObj.terminal_growth_rate
    : (typeof dcfAssumptions?.terminal_growth_pct === 'number' ? dcfAssumptions.terminal_growth_pct : null);

  const revCagr = typeof assumptionsObj?.revenue_growth_rate === 'number'
    ? assumptionsObj.revenue_growth_rate
    : (typeof dcfModel?.scenarios?.base?.revenue_cagr_pct === 'number'
        ? dcfModel.scenarios.base.revenue_cagr_pct
        : null);

  const fcfMargin = typeof assumptionsObj?.target_fcf_margin === 'number'
    ? assumptionsObj.target_fcf_margin
    : (typeof dcfModel?.scenarios?.base?.terminal_margin_pct === 'number'
        ? dcfModel.scenarios.base.terminal_margin_pct
        : null);

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

  // Financial Statements
  const stmts = data.financial_statements;
  const periods = stmts?.periods || [];
  const latestIdx = periods.length > 0 ? periods.length - 1 : -1;

  const latestPeriod = latestIdx >= 0 ? periods[latestIdx] : null;
  const revenue = latestIdx >= 0 && typeof stmts?.income_statement?.revenue?.[latestIdx] === 'number'
    ? stmts.income_statement.revenue[latestIdx]
    : null;

  const revenueYoYPct = latestIdx >= 0 && typeof stmts?.income_statement?.yoy_revenue_growth_pct?.[latestIdx] === 'number'
    ? stmts.income_statement.yoy_revenue_growth_pct[latestIdx]
    : null;

  const opInc = latestIdx >= 0 && typeof stmts?.income_statement?.operating_income?.[latestIdx] === 'number'
    ? stmts.income_statement.operating_income[latestIdx]
    : null;

  const operatingMarginPct = (typeof revenue === 'number' && typeof opInc === 'number' && revenue > 0)
    ? Number(((opInc / revenue) * 100).toFixed(2))
    : (latestIdx >= 0 && typeof stmts?.income_statement?.operating_margin_pct?.[latestIdx] === 'number'
        ? stmts.income_statement.operating_margin_pct[latestIdx]
        : null);

  const netIncome = latestIdx >= 0 && typeof stmts?.income_statement?.net_income?.[latestIdx] === 'number'
    ? stmts.income_statement.net_income[latestIdx]
    : null;

  const freeCashFlow = latestIdx >= 0 && typeof stmts?.cash_flow?.free_cash_flow?.[latestIdx] === 'number'
    ? stmts.cash_flow.free_cash_flow[latestIdx]
    : null;

  const bs = stmts?.balance_sheet;
  const totalDebt = latestIdx >= 0 && typeof bs?.total_debt?.[latestIdx] === 'number'
    ? bs.total_debt[latestIdx]
    : null;

  const cash = latestIdx >= 0 && typeof bs?.cash_and_equivalents?.[latestIdx] === 'number'
    ? bs.cash_and_equivalents[latestIdx]
    : null;

  const sti = latestIdx >= 0 && typeof bs?.short_term_investments?.[latestIdx] === 'number'
    ? bs.short_term_investments[latestIdx]
    : 0;

  const netCash = (typeof cash === 'number' && typeof totalDebt === 'number')
    ? (cash + sti) - totalDebt
    : null;

  const sharesOutstanding = typeof data.company_profile?.shares_outstanding === 'number'
    ? data.company_profile.shares_outstanding
    : (typeof (data.intrinsic_value as any)?.dcf_model?.shares_outstanding_m === 'number'
        ? (data.intrinsic_value as any).dcf_model.shares_outstanding_m
        : null);

  const secEnvelope = data.sec_verification;
  const isSecVerified = Boolean(
    secEnvelope?.dcf_financial_inputs?.generated_by === 'sec-verified-financial-inputs-v1' ||
    (secEnvelope as any)?.financialDataSource === 'sec_verified' ||
    (data.report_provenance as any)?.financialDataSource === 'sec_verified' ||
    secEnvelope?.status === 'verified_eligible'
  );

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
    provenance: isSecVerified ? 'sec_verified' : (periods.length > 0 ? 'calculated' : 'unavailable')
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
  const secStatement = secEnvelope?.sec_period_statements?.[secEnvelope.sec_period_statements.length - 1];
  const secAccession = secStatement?.accession || (secEnvelope as any)?.submissions?.recentFilings?.[0]?.accessionNumber || null;
  const secFilingDate = secEnvelope?.latest_statements_source?.filing_date || secStatement?.filed_date || (secEnvelope as any)?.submissions?.recentFilings?.[0]?.filingDate || null;
  const findings = data.findings || [];

  const evidence: ResearchMemoryEvidence = {
    secAccession,
    secFilingDate,
    hasVerifiedSecStatements: Boolean(secEnvelope?.sec_period_statements && secEnvelope.sec_period_statements.length > 0),
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
 * Builds chronological memory timeline sorted newest first.
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
 */
export function getPreviousMemorySnapshot(
  ticker: string,
  allReports: any[] = [],
  activeReport?: any
): ResearchMemorySnapshot | null {
  const timeline = buildMemoryTimeline(ticker, allReports, activeReport);
  if (timeline.length < 2) return null;

  if (!activeReport) {
    return timeline[1] || null;
  }

  const activeSnap = extractMemorySnapshot(activeReport);
  const activeTime = activeSnap ? activeSnap.createdTimestamp : Date.now();

  for (const item of timeline) {
    if (activeSnap && item.reportId === activeSnap.reportId) continue;
    if (item.createdTimestamp < activeTime) {
      return item;
    }
  }

  return timeline[1] || null;
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

  // FCF Delta
  const curFcf = current.financials.freeCashFlow;
  const prevFcf = previous.financials.freeCashFlow;
  const freeCashFlowDelta = (typeof curFcf === 'number' && typeof prevFcf === 'number' && prevFcf !== 0)
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
