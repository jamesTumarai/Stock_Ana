import { ReportData } from '../types';
import { ResearchMemorySnapshot, extractMemorySnapshot } from './investmentMemory';
import { unwrapHistoryRecord } from '../utils/researchTimeline';

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
 * Strictly conservative:
 * - Only exact normalized identity allows certain continuation (isCertain: true).
 * - Partial / ambiguous / semantic rewordings produce uncertain transitions (isCertain: false) with UNKNOWN/evolving status.
 * - Unmatched items from unstructured text are never certain (isCertain: false).
 */
export function matchRiskCatalystTransitions(
  previousRisks: string[],
  currentRisks: string[],
  previousCatalysts: string[],
  currentCatalysts: string[]
): TrackedItemTransition[] {
  const transitions: TrackedItemTransition[] = [];

  const clean = (s: string) => s.trim().toLowerCase();

  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'all', 'any',
    'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will',
    'just', 'should', 'now', 'risk', 'risks', 'catalyst', 'catalysts'
  ]);

  const stemWord = (w: string) => {
    if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
    if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('er') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
    return w;
  };

  const getSignificantStems = (text: string): Set<string> => {
    const rawWords = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    return new Set(rawWords.map(stemWord));
  };

  const areSemanticallyAmbiguous = (text1: string, text2: string): boolean => {
    const c1 = clean(text1);
    const c2 = clean(text2);
    if (c1.includes(c2) || c2.includes(c1)) return true;

    const stems1 = getSignificantStems(text1);
    const stems2 = getSignificantStems(text2);
    if (stems1.size === 0 || stems2.size === 0) return false;

    let shared = 0;
    for (const s1 of stems1) {
      for (const s2 of stems2) {
        if (s1 === s2 || (s1.length >= 4 && s2.length >= 4 && (s1.startsWith(s2) || s2.startsWith(s1)))) {
          shared++;
          break;
        }
      }
    }
    return shared > 0;
  };

  const matchCategory = (
    prevItems: string[],
    currItems: string[],
    category: 'risk' | 'catalyst'
  ) => {
    const matchedPrevIndices = new Set<number>();
    const matchedCurrIndices = new Set<number>();

    // Pass 1: Exact matches (certain)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      const currText = currItems[cIdx];
      const cleanCurr = clean(currText);

      for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
        if (matchedPrevIndices.has(pIdx)) continue;
        const prevText = prevItems[pIdx];
        if (clean(prevText) === cleanCurr) {
          matchedPrevIndices.add(pIdx);
          matchedCurrIndices.add(cIdx);
          transitions.push({
            itemText: currText,
            category,
            previousState: 'ACTIVE',
            currentState: 'ACTIVE',
            isCertain: true
          });
          break;
        }
      }
    }

    // Pass 2: Ambiguous / Semantic / Token overlap matches (uncertain)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      if (matchedCurrIndices.has(cIdx)) continue;
      const currText = currItems[cIdx];

      for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
        if (matchedPrevIndices.has(pIdx)) continue;
        const prevText = prevItems[pIdx];

        if (areSemanticallyAmbiguous(currText, prevText)) {
          matchedPrevIndices.add(pIdx);
          matchedCurrIndices.add(cIdx);
          transitions.push({
            itemText: `${currText} (evolving from: ${prevText})`,
            category,
            previousState: 'ACTIVE',
            currentState: 'UNKNOWN',
            isCertain: false,
            evidence: 'Ambiguous rephrasing or semantic evolution across reports; review needed'
          });
          break;
        }
      }
    }

    // Pass 3: Unmatched current items (NEW, but uncertain for free-text)
    for (let cIdx = 0; cIdx < currItems.length; cIdx++) {
      if (matchedCurrIndices.has(cIdx)) continue;
      transitions.push({
        itemText: currItems[cIdx],
        category,
        previousState: 'UNKNOWN',
        currentState: 'NEW',
        isCertain: false,
        evidence: 'Newly introduced in report prose; identity unconfirmed'
      });
    }

    // Pass 4: Unmatched previous items (RESOLVED, but uncertain for free-text)
    for (let pIdx = 0; pIdx < prevItems.length; pIdx++) {
      if (matchedPrevIndices.has(pIdx)) continue;
      transitions.push({
        itemText: prevItems[pIdx],
        category,
        previousState: 'ACTIVE',
        currentState: 'RESOLVED',
        isCertain: false,
        evidence: 'Not mentioned in latest report; resolution unconfirmed'
      });
    }
  };

  matchCategory(previousRisks, currentRisks, 'risk');
  matchCategory(previousCatalysts, currentCatalysts, 'catalyst');

  return transitions;
}

/**
 * Resolves which user-confirmed thesis version was active for a specific research report state.
 * Strictly adheres to historical truth:
 * 1. Direct sourceReportId linkage takes top priority.
 * 2. If not directly linked, matches by valid temporal association (latest confirmed thesis on or before report timestamp).
 * 3. Never retroactively claims a modern thesis existed at an old report date. Legacy/unrecorded reports return null.
 */
export function resolveActiveThesisForReport(
  reportInput: any,
  revisions: InvestmentThesisRecord[] = [],
  currentThesis?: InvestmentThesisRecord | null
): InvestmentThesisRecord | null {
  if (!reportInput) return null;

  const unwrapped = unwrapHistoryRecord(reportInput);
  const data = unwrapped?.data || (reportInput.data ? reportInput.data : reportInput);
  const reportId = unwrapped?.reportId || (reportInput as any).id || (data as any).id;

  // 1. Direct linkage via sourceReportId
  if (reportId) {
    if (Array.isArray(revisions) && revisions.length > 0) {
      const directMatch = revisions.find(r => r.sourceReportId === reportId);
      if (directMatch) return directMatch;
    }

    if (currentThesis && currentThesis.sourceReportId === reportId) {
      return currentThesis;
    }
  }

  // 2. Temporal association if timestamp is valid
  const rawTimestamp = unwrapped?.createdTimestamp
    || (data?.generated_at ? Date.parse(String(data.generated_at)) : 0)
    || (data?.as_of_date ? Date.parse(String(data.as_of_date)) : 0);
  const repTime = Number.isFinite(rawTimestamp) && rawTimestamp > 0 ? rawTimestamp : 0;

  if (repTime > 0 && Array.isArray(revisions) && revisions.length > 0) {
    // Only consider user-confirmed or user-edited revisions
    const eligible = revisions
      .filter(r => {
        if (r.confirmationStatus !== 'USER_CONFIRMED' && r.confirmationStatus !== 'USER_EDITED') {
          return false;
        }
        const revTime = Date.parse(r.updatedAt || r.createdAt);
        return Number.isFinite(revTime) && revTime <= repTime;
      })
      .sort((a, b) => b.version - a.version);

    if (eligible.length > 0) {
      return eligible[0];
    }
  }

  // 3. If no confirmed revision existed at that report time, return null (NOT RECORDED)
  return null;
}
