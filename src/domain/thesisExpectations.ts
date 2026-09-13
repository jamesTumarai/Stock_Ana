import { ReportData } from '../types';
import { ResearchMemorySnapshot, extractMemorySnapshot } from './investmentMemory';

export type ThesisStatus =
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'POTENTIALLY_CHALLENGED'
  | 'INVALIDATED_BY_USER'
  | 'ARCHIVED';

export type ThesisConfirmationStatus =
  | 'AI_DRAFT'
  | 'USER_CONFIRMED'
  | 'USER_EDITED'
  | 'SUPERSEDED';

export interface InvestmentThesisRecord {
  thesisId: string;
  ticker: string;
  version: number;
  summary: string;
  keyDrivers: string[];
  keyAssumptions: string[];
  keyRisks: string[];
  catalysts: string[];
  invalidationConditions: string[];
  status: ThesisStatus;
  confirmationStatus: ThesisConfirmationStatus;
  sourceReportId: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  notes?: string;
}

export type ExpectationMetric =
  | 'revenue'
  | 'revenue_growth_yoy_pct'
  | 'operating_margin_pct'
  | 'free_cash_flow'
  | 'net_income'
  | 'eps_diluted'
  | 'gross_margin_pct'
  | 'custom_event';

export type ExpectationCondition =
  | 'gte'
  | 'lte'
  | 'eq'
  | 'approx' // within +/- 5%
  | 'event_occurred';

export type ExpectationStatus =
  | 'PENDING'
  | 'MET'
  | 'MISSED'
  | 'EXCEEDED'
  | 'PARTIAL'
  | 'UNAVAILABLE';

export type ExpectationOrigin =
  | 'USER_EXPECTATION'
  | 'MANAGEMENT_GUIDANCE'
  | 'AI_DRAFT'
  | 'DETERMINISTIC_CONDITION';

export interface TrackedExpectation {
  expectationId: string;
  ticker: string;
  metricOrEvent: ExpectationMetric | string;
  metricLabel: string;
  targetValue: number | string;
  condition: ExpectationCondition;
  targetPeriod: string; // e.g. 'Q3 2026', 'FY26', '2026-10-30'
  status: ExpectationStatus;
  origin: ExpectationOrigin;
  sourceReportId: string | null;
  actualValue: number | string | null;
  actualPeriodFound?: string | null;
  evaluationDate: string | null;
  evaluationNotes?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export type LifecycleState =
  | 'NEW'
  | 'ACTIVE'
  | 'INCREASING'
  | 'DECREASING'
  | 'RESOLVED'
  | 'MATERIALIZED'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface TrackedItemTransition {
  itemText: string;
  category: 'risk' | 'catalyst';
  previousState: LifecycleState;
  currentState: LifecycleState;
  evidence?: string;
  isCertain: boolean;
}

/**
 * Extracts a draft thesis from an analysis report.
 * Strictly labeled as AI_DRAFT unless previously confirmed.
 */
export function extractDraftThesisFromReport(
  reportInput: any,
  userId?: string
): InvestmentThesisRecord | null {
  const snapshot = extractMemorySnapshot(reportInput);
  if (!snapshot) return null;

  const data: ReportData = reportInput?.data || (reportInput?.ticker ? reportInput : null);
  const now = new Date().toISOString();

  const keyAssumptions: string[] = [];
  if (snapshot.valuation.assumptions.waccPct !== null) {
    keyAssumptions.push(`Discount rate (WACC): ${snapshot.valuation.assumptions.waccPct}%`);
  }
  if (snapshot.valuation.assumptions.terminalGrowthPct !== null) {
    keyAssumptions.push(`Terminal growth rate: ${snapshot.valuation.assumptions.terminalGrowthPct}%`);
  }
  if (snapshot.valuation.assumptions.revenueCagrPct !== null) {
    keyAssumptions.push(`Revenue CAGR: ${snapshot.valuation.assumptions.revenueCagrPct}%`);
  }
  if (snapshot.valuation.assumptions.fcfMarginPct !== null) {
    keyAssumptions.push(`Target FCF margin: ${snapshot.valuation.assumptions.fcfMarginPct}%`);
  }

  const invalidationConditions: string[] = [];
  // Propose sensible invalidation conditions based on identified risks
  if (snapshot.financials.operatingMarginPct !== null) {
    invalidationConditions.push(`Operating margin drops below ${(snapshot.financials.operatingMarginPct * 0.8).toFixed(1)}%`);
  }
  if (snapshot.thesis.keyRisks.length > 0) {
    invalidationConditions.push(`Materialization of primary risk: ${snapshot.thesis.keyRisks[0]}`);
  }

  return {
    thesisId: `thesis_${snapshot.ticker}_${Date.now()}`,
    ticker: snapshot.ticker,
    version: 1,
    summary: snapshot.thesis.summary || `Investment thesis for ${snapshot.ticker}`,
    keyDrivers: snapshot.thesis.keyDrivers,
    keyAssumptions,
    keyRisks: snapshot.thesis.keyRisks,
    catalysts: snapshot.thesis.catalysts,
    invalidationConditions,
    status: 'ACTIVE',
    confirmationStatus: 'AI_DRAFT',
    sourceReportId: snapshot.reportId,
    createdAt: now,
    updatedAt: now,
    userId: userId || undefined
  };
}

/**
 * Confirms or edits a user thesis, transitioning state to USER_CONFIRMED or USER_EDITED.
 */
export function confirmUserThesis(
  baseThesis: InvestmentThesisRecord,
  edits?: Partial<InvestmentThesisRecord>,
  userId?: string
): InvestmentThesisRecord {
  const now = new Date().toISOString();
  const hasEdits = Boolean(
    edits?.summary ||
    edits?.keyDrivers ||
    edits?.keyAssumptions ||
    edits?.keyRisks ||
    edits?.catalysts ||
    edits?.invalidationConditions ||
    edits?.status
  );

  return {
    ...baseThesis,
    ...(edits || {}),
    version: baseThesis.version + 1,
    confirmationStatus: hasEdits ? 'USER_EDITED' : 'USER_CONFIRMED',
    updatedAt: now,
    userId: userId || baseThesis.userId
  };
}

/**
 * Deterministically evaluates tracked expectations against a research memory snapshot.
 * Never fabricates values; returns PENDING when data has not arrived yet.
 */
export function evaluateExpectations(
  expectations: TrackedExpectation[],
  memorySnapshot: ResearchMemorySnapshot
): TrackedExpectation[] {
  const now = new Date().toISOString();
  const financials = memorySnapshot.financials;
  const currentPeriod = financials.latestPeriod?.toUpperCase().trim() || '';

  return expectations.map(exp => {
    // If already finalized (MET, MISSED, EXCEEDED), preserve historical outcome unless forced
    if (exp.status === 'MET' || exp.status === 'MISSED' || exp.status === 'EXCEEDED') {
      return exp;
    }

    const expPeriod = exp.targetPeriod.toUpperCase().trim();
    // Check if the current report period matches or covers the target period
    const isPeriodRelevant = currentPeriod && (
      currentPeriod === expPeriod ||
      currentPeriod.includes(expPeriod) ||
      expPeriod.includes(currentPeriod)
    );

    if (!isPeriodRelevant) {
      // Period has not arrived or is not disclosed yet
      return {
        ...exp,
        status: 'PENDING'
      };
    }

    // Extract actual numeric metric
    let actualValue: number | null = null;
    const metric = exp.metricOrEvent.toLowerCase();

    if (metric === 'revenue') {
      actualValue = financials.revenue;
    } else if (metric === 'revenue_growth_yoy_pct') {
      actualValue = financials.revenueYoYPct;
    } else if (metric === 'operating_margin_pct') {
      actualValue = financials.operatingMarginPct;
    } else if (metric === 'free_cash_flow') {
      actualValue = financials.freeCashFlow;
    } else if (metric === 'net_income') {
      actualValue = financials.netIncome;
    }

    if (actualValue === null || typeof actualValue !== 'number') {
      return {
        ...exp,
        status: 'UNAVAILABLE',
        actualPeriodFound: currentPeriod,
        evaluationDate: now,
        evaluationNotes: `Target period reached (${currentPeriod}) but metric ${exp.metricOrEvent} was unavailable.`
      };
    }

    const targetNum = Number(exp.targetValue);
    if (isNaN(targetNum)) {
      return {
        ...exp,
        status: 'UNAVAILABLE',
        actualPeriodFound: currentPeriod,
        evaluationDate: now,
        evaluationNotes: 'Non-numeric target value cannot be evaluated against financial metric.'
      };
    }

    let status: ExpectationStatus = 'PENDING';
    if (exp.condition === 'gte') {
      if (actualValue >= targetNum * 1.05) {
        status = 'EXCEEDED';
      } else if (actualValue >= targetNum) {
        status = 'MET';
      } else {
        status = 'MISSED';
      }
    } else if (exp.condition === 'lte') {
      status = actualValue <= targetNum ? 'MET' : 'MISSED';
    } else if (exp.condition === 'approx') {
      const tolerance = Math.abs(targetNum * 0.05);
      status = Math.abs(actualValue - targetNum) <= tolerance ? 'MET' : 'MISSED';
    } else if (exp.condition === 'eq') {
      status = actualValue === targetNum ? 'MET' : 'MISSED';
    }

    return {
      ...exp,
      status,
      actualValue,
      actualPeriodFound: currentPeriod,
      evaluationDate: now,
      updatedAt: now,
      evaluationNotes: `Evaluated against ${currentPeriod} data: actual ${actualValue} vs target ${targetNum} (${exp.condition})`
    };
  });
}

/**
 * Deterministically compares risks and catalysts between previous and current research.
 */
export function matchRiskCatalystTransitions(
  previousRisks: string[],
  currentRisks: string[],
  previousCatalysts: string[],
  currentCatalysts: string[]
): TrackedItemTransition[] {
  const transitions: TrackedItemTransition[] = [];

  const clean = (s: string) => s.trim().toLowerCase();

  // Helper for matching
  const matchCategory = (
    prevItems: string[],
    currItems: string[],
    category: 'risk' | 'catalyst'
  ) => {
    const prevMap = new Map<string, string>();
    for (const item of prevItems) {
      prevMap.set(clean(item), item);
    }

    const currMap = new Map<string, string>();
    for (const item of currItems) {
      currMap.set(clean(item), item);
    }

    // Identify continuing and new items
    for (const [cleanText, rawText] of currMap.entries()) {
      if (prevMap.has(cleanText)) {
        transitions.push({
          itemText: rawText,
          category,
          previousState: 'ACTIVE',
          currentState: 'ACTIVE',
          isCertain: true
        });
      } else {
        // Look for partial similarity
        let isPotentialMatch = false;
        for (const [prevClean, prevRaw] of prevMap.entries()) {
          if (cleanText.includes(prevClean) || prevClean.includes(cleanText)) {
            transitions.push({
              itemText: `${rawText} (evolving from: ${prevRaw})`,
              category,
              previousState: 'ACTIVE',
              currentState: 'INCREASING',
              isCertain: false
            });
            isPotentialMatch = true;
            break;
          }
        }
        if (!isPotentialMatch) {
          transitions.push({
            itemText: rawText,
            category,
            previousState: 'UNKNOWN',
            currentState: 'NEW',
            isCertain: true
          });
        }
      }
    }

    // Identify resolved / departed items
    for (const [prevClean, prevRaw] of prevMap.entries()) {
      if (!currMap.has(prevClean)) {
        let isPotentialMatch = false;
        for (const [currClean] of currMap.entries()) {
          if (prevClean.includes(currClean) || currClean.includes(prevClean)) {
            isPotentialMatch = true;
            break;
          }
        }
        if (!isPotentialMatch) {
          transitions.push({
            itemText: prevRaw,
            category,
            previousState: 'ACTIVE',
            currentState: 'RESOLVED',
            isCertain: true
          });
        }
      }
    }
  };

  matchCategory(previousRisks, currentRisks, 'risk');
  matchCategory(previousCatalysts, currentCatalysts, 'catalyst');

  return transitions;
}
