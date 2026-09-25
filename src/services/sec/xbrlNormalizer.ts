import type { SecCompanyFact } from './secClient';

export type SecFiscalPeriod = 'Q1' | 'Q2' | 'Q3' | 'FY';
export type SecQuarterDerivation = 'reported_ytd' | 'reported_standalone' | 'derived_ytd_difference' | 'reported_instant' | 'derived_fy_less_q3_ytd';

export interface NormalizedSecQuarterFact {
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  value: number;
  start?: string;
  end: string;
  filed?: string;
  form?: string;
  accessionNumbers: string[];
  derivation: SecQuarterDerivation;
  sourceFacts: SecCompanyFact[];
  periodType: 'standalone_quarter' | 'instant';
  durationDays?: number;
}

const VALID_FORMS = new Set(['10-Q', '10-Q/A', '10-K', '10-K/A']);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isFiscalPeriod = (value: unknown): value is SecFiscalPeriod => value === 'Q1' || value === 'Q2' || value === 'Q3' || value === 'FY';
const stableDifference = (a: number, b: number) => Math.round((a - b) * 1e10) / 1e10;

const dateMs = (value?: string) => {
  if (!value) return Number.NaN;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const durationDays = (fact: SecCompanyFact) => {
  const start = dateMs(fact.start);
  const end = dateMs(fact.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return -1;
  return Math.round((end - start) / 86_400_000) + 1;
};

const filedRank = (fact: SecCompanyFact) => dateMs(fact.filed) || 0;
const endRank = (fact: SecCompanyFact) => dateMs(fact.end) || 0;

const validFact = (fact: SecCompanyFact) =>
  isFiniteNumber(fact.val)
  && typeof fact.end === 'string'
  && typeof fact.fy === 'number'
  && isFiscalPeriod(fact.fp)
  && (!fact.form || VALID_FORMS.has(fact.form));

const newest = (facts: SecCompanyFact[]) => [...facts].sort((a, b) => filedRank(b) - filedRank(a))[0];

/**
 * SEC companyfacts frequently repeats prior-year comparative facts inside the current filing while
 * tagging them with the filing's fy/fp. Prefer the latest period-end first, then resolve duplicates
 * or amendments by filed date. Without this guard a newly-filed comparative fact can be mistaken
 * for the current fiscal period and corrupt both values and provenance dates.
 */
const latestPeriodFacts = (facts: SecCompanyFact[]) => {
  if (facts.length === 0) return [];
  const maxEnd = Math.max(...facts.map(endRank));
  return facts.filter(fact => endRank(fact) === maxEnd);
};

/**
 * Select the cumulative/YTD duration fact for a fiscal period.
 * SEC companyfacts can contain both quarter-only and YTD contexts for Q2/Q3, plus prior-year
 * comparative contexts carried in the current filing. We first select the latest period-end,
 * then the longest duration for that period, then the latest-filed duplicate/restatement.
 */
const selectYtdFact = (facts: SecCompanyFact[], fiscalYear: number, fp: SecFiscalPeriod) => {
  const candidates = facts.filter(fact => validFact(fact) && fact.fy === fiscalYear && fact.fp === fp && typeof fact.start === 'string');
  if (candidates.length === 0) return undefined;
  const expected = fp === 'Q1' ? [60, 110] : fp === 'Q2' ? [150, 205] : fp === 'Q3' ? [235, 300] : [300, 400];
  const matchingDuration = candidates.filter(fact => durationDays(fact) >= expected[0] && durationDays(fact) <= expected[1]);
  if (matchingDuration.length === 0) return undefined;
  const currentPeriodCandidates = latestPeriodFacts(matchingDuration);
  const maxDuration = Math.max(...currentPeriodCandidates.map(durationDays));
  if (maxDuration < 1) return undefined;
  return newest(currentPeriodCandidates.filter(fact => durationDays(fact) === maxDuration));
};

const selectStandaloneFact = (facts: SecCompanyFact[], fiscalYear: number, fp: SecFiscalPeriod, ytd?: SecCompanyFact) => {
  const candidates = facts.filter(fact => validFact(fact) && fact.fy === fiscalYear && fact.fp === fp
    && typeof fact.start === 'string' && durationDays(fact) >= 60 && durationDays(fact) <= 110
    && (!ytd?.end || fact.end === ytd.end));
  return newest(latestPeriodFacts(candidates));
};

const accessionList = (facts: SecCompanyFact[]) => Array.from(new Set(
  facts.map(fact => fact.accn).filter((value): value is string => typeof value === 'string' && value.length > 0),
));

const makeDirectDuration = (fact: SecCompanyFact, quarter: 1 | 2 | 3 | 4): NormalizedSecQuarterFact => ({
  fiscalYear: fact.fy as number,
  fiscalQuarter: quarter,
  value: fact.val as number,
  start: fact.start,
  end: fact.end as string,
  filed: fact.filed,
  form: fact.form,
  accessionNumbers: accessionList([fact]),
  derivation: quarter === 1 ? 'reported_ytd' : 'reported_standalone',
  sourceFacts: [fact],
  periodType: 'standalone_quarter',
  durationDays: durationDays(fact),
});

const makeDifference = (
  current: SecCompanyFact,
  prior: SecCompanyFact,
  quarter: 2 | 3,
): NormalizedSecQuarterFact => ({
  fiscalYear: current.fy as number,
  fiscalQuarter: quarter,
  value: stableDifference(current.val as number, prior.val as number),
  start: new Date(dateMs(prior.end) + 86_400_000).toISOString().slice(0, 10),
  end: current.end as string,
  filed: current.filed,
  form: current.form,
  accessionNumbers: accessionList([current, prior]),
  derivation: 'derived_ytd_difference',
  sourceFacts: [current, prior],
  periodType: 'standalone_quarter',
  durationDays: Math.round((dateMs(current.end) - dateMs(prior.end)) / 86_400_000),
});

const makeQ4Difference = (annual: SecCompanyFact, q3Ytd: SecCompanyFact): NormalizedSecQuarterFact => ({
  fiscalYear: annual.fy as number,
  fiscalQuarter: 4,
  value: stableDifference(annual.val as number, q3Ytd.val as number),
  start: new Date(dateMs(q3Ytd.end) + 86_400_000).toISOString().slice(0, 10),
  end: annual.end as string,
  filed: annual.filed,
  form: annual.form,
  accessionNumbers: accessionList([annual, q3Ytd]),
  derivation: 'derived_fy_less_q3_ytd',
  sourceFacts: [annual, q3Ytd],
  periodType: 'standalone_quarter',
  durationDays: Math.round((dateMs(annual.end) - dateMs(q3Ytd.end)) / 86_400_000),
});

const compatibleCumulativeFacts = (current?: SecCompanyFact, prior?: SecCompanyFact) => {
  if (!current || !prior || current.fy !== prior.fy || current.start !== prior.start) return false;
  const days = Math.round((dateMs(current.end) - dateMs(prior.end)) / 86_400_000);
  return Number.isFinite(days) && days >= 60 && days <= 110;
};

/**
 * Convert cumulative SEC duration facts into standalone fiscal quarters.
 *
 * Q1 = Q1 YTD
 * Q2/Q3/Q4 = filing-reported standalone duration when available;
 * otherwise H1 YTD - Q1 YTD, 9M YTD - H1 YTD, FY - 9M YTD.
 *
 * Missing prerequisites stay missing. No interpolation or synthetic replacement is allowed.
 */
export function normalizeDurationFactsToStandaloneQuarters(facts: SecCompanyFact[]): NormalizedSecQuarterFact[] {
  const fiscalYears = Array.from(new Set(
    facts.filter(validFact).map(fact => fact.fy as number),
  )).sort((a, b) => a - b);
  const normalized: NormalizedSecQuarterFact[] = [];

  for (const fiscalYear of fiscalYears) {
    const q1 = selectYtdFact(facts, fiscalYear, 'Q1');
    const q2 = selectYtdFact(facts, fiscalYear, 'Q2');
    const q3 = selectYtdFact(facts, fiscalYear, 'Q3');
    const fy = selectYtdFact(facts, fiscalYear, 'FY');
    const q2Standalone = selectStandaloneFact(facts, fiscalYear, 'Q2', q2);
    const q3Standalone = selectStandaloneFact(facts, fiscalYear, 'Q3', q3);
    const q4Standalone = selectStandaloneFact(facts, fiscalYear, 'FY', fy);

    if (q1) normalized.push(makeDirectDuration(q1, 1));
    if (q2Standalone && (!q2 || filedRank(q2Standalone) >= filedRank(q2))) normalized.push(makeDirectDuration(q2Standalone, 2));
    else if (compatibleCumulativeFacts(q2, q1)) normalized.push(makeDifference(q2!, q1!, 2));
    if (q3Standalone && (!q3 || filedRank(q3Standalone) >= filedRank(q3))) normalized.push(makeDirectDuration(q3Standalone, 3));
    else if (compatibleCumulativeFacts(q3, q2)) normalized.push(makeDifference(q3!, q2!, 3));
    if (q4Standalone && (!fy || filedRank(q4Standalone) >= filedRank(fy))) normalized.push(makeDirectDuration(q4Standalone, 4));
    else if (compatibleCumulativeFacts(fy, q3)) normalized.push(makeQ4Difference(fy!, q3!));
  }

  return normalized.filter(item => Number.isFinite(item.value));
}

/**
 * Balance-sheet concepts are instant facts, so no YTD subtraction is required.
 * FY is treated as fiscal Q4 ending balance. The latest period-end wins over comparative facts;
 * latest-filed restatements then win for the same current-period end date.
 */
export function normalizeInstantFactsToFiscalQuarters(facts: SecCompanyFact[]): NormalizedSecQuarterFact[] {
  const groups = new Map<string, SecCompanyFact[]>();
  for (const fact of facts) {
    if (!validFact(fact)) continue;
    const fp = fact.fp as SecFiscalPeriod;
    const key = `${fact.fy}:${fp}`;
    const group = groups.get(key) ?? [];
    group.push(fact);
    groups.set(key, group);
  }

  const output: NormalizedSecQuarterFact[] = [];
  for (const group of groups.values()) {
    const fact = newest(latestPeriodFacts(group));
    if (!fact || !isFiniteNumber(fact.val) || !fact.end || !fact.fy || !isFiscalPeriod(fact.fp)) continue;
    const quarter = fact.fp === 'Q1' ? 1 : fact.fp === 'Q2' ? 2 : fact.fp === 'Q3' ? 3 : 4;
    output.push({
      fiscalYear: fact.fy,
      fiscalQuarter: quarter,
      value: fact.val,
      end: fact.end,
      filed: fact.filed,
      form: fact.form,
      accessionNumbers: accessionList([fact]),
      derivation: 'reported_instant',
      sourceFacts: [fact],
      periodType: 'instant',
    });
  }

  return output.sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter);
}
