import type { SecCompanyFact } from './secClient';

export type SecFiscalPeriod = 'Q1' | 'Q2' | 'Q3' | 'FY';
export type SecQuarterDerivation = 'reported_ytd' | 'derived_ytd_difference' | 'reported_instant' | 'derived_fy_less_q3_ytd';

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
  const currentPeriodCandidates = latestPeriodFacts(candidates);
  const maxDuration = Math.max(...currentPeriodCandidates.map(durationDays));
  if (maxDuration < 1) return undefined;
  return newest(currentPeriodCandidates.filter(fact => durationDays(fact) === maxDuration));
};

const accessionList = (facts: SecCompanyFact[]) => Array.from(new Set(
  facts.map(fact => fact.accn).filter((value): value is string => typeof value === 'string' && value.length > 0),
));

const makeDirectDuration = (fact: SecCompanyFact, quarter: 1 | 2 | 3): NormalizedSecQuarterFact => ({
  fiscalYear: fact.fy as number,
  fiscalQuarter: quarter,
  value: fact.val as number,
  start: fact.start,
  end: fact.end as string,
  filed: fact.filed,
  form: fact.form,
  accessionNumbers: accessionList([fact]),
  derivation: 'reported_ytd',
  sourceFacts: [fact],
});

const makeDifference = (
  current: SecCompanyFact,
  prior: SecCompanyFact,
  quarter: 2 | 3,
): NormalizedSecQuarterFact => ({
  fiscalYear: current.fy as number,
  fiscalQuarter: quarter,
  value: stableDifference(current.val as number, prior.val as number),
  start: prior.end,
  end: current.end as string,
  filed: current.filed,
  form: current.form,
  accessionNumbers: accessionList([current, prior]),
  derivation: 'derived_ytd_difference',
  sourceFacts: [current, prior],
});

const makeQ4Difference = (annual: SecCompanyFact, q3Ytd: SecCompanyFact): NormalizedSecQuarterFact => ({
  fiscalYear: annual.fy as number,
  fiscalQuarter: 4,
  value: stableDifference(annual.val as number, q3Ytd.val as number),
  start: q3Ytd.end,
  end: annual.end as string,
  filed: annual.filed,
  form: annual.form,
  accessionNumbers: accessionList([annual, q3Ytd]),
  derivation: 'derived_fy_less_q3_ytd',
  sourceFacts: [annual, q3Ytd],
});

/**
 * Convert cumulative SEC duration facts into standalone fiscal quarters.
 *
 * Q1 = Q1 YTD
 * Q2 = H1 YTD - Q1 YTD
 * Q3 = 9M YTD - H1 YTD
 * Q4 = FY - 9M YTD
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

    if (q1) normalized.push(makeDirectDuration(q1, 1));
    if (q1 && q2) normalized.push(makeDifference(q2, q1, 2));
    if (q2 && q3) normalized.push(makeDifference(q3, q2, 3));
    if (q3 && fy) normalized.push(makeQ4Difference(fy, q3));
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
    });
  }

  return output.sort((a, b) => a.fiscalYear - b.fiscalYear || a.fiscalQuarter - b.fiscalQuarter);
}
