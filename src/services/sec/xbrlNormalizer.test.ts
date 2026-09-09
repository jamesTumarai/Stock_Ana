import assert from 'node:assert/strict';
import type { SecCompanyFact } from './secClient';
import { normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from './xbrlNormalizer';

const durationFacts: SecCompanyFact[] = [
  { start: '2026-01-01', end: '2026-03-31', val: 100, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'q1' },
  // Q2 filing contains both standalone-quarter and H1/YTD contexts. The normalizer must choose H1/YTD.
  { start: '2026-04-01', end: '2026-06-30', val: 120, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2-quarter' },
  { start: '2026-01-01', end: '2026-06-30', val: 220, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'q2-ytd' },
  { start: '2026-07-01', end: '2026-09-30', val: 130, fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: 'q3-quarter' },
  { start: '2026-01-01', end: '2026-09-30', val: 350, fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: 'q3-ytd' },
  { start: '2026-01-01', end: '2026-12-31', val: 500, fy: 2026, fp: 'FY', form: '10-K', filed: '2027-02-15', accn: 'fy' },
];

const normalized = normalizeDurationFactsToStandaloneQuarters(durationFacts);
assert.deepEqual(normalized.map(item => [item.fiscalYear, item.fiscalQuarter, item.value]), [
  [2026, 1, 100],
  [2026, 2, 120],
  [2026, 3, 130],
  [2026, 4, 150],
]);
assert.equal(normalized[0].derivation, 'reported_ytd');
assert.equal(normalized[1].derivation, 'derived_ytd_difference');
assert.deepEqual(normalized[1].accessionNumbers.sort(), ['q1', 'q2-ytd']);
assert.equal(normalized[3].derivation, 'derived_fy_less_q3_ytd');
assert.deepEqual(normalized[3].accessionNumbers.sort(), ['fy', 'q3-ytd']);

{
  const restated = [
    ...durationFacts,
    { start: '2026-01-01', end: '2026-06-30', val: 225, fy: 2026, fp: 'Q2', form: '10-Q/A', filed: '2026-09-01', accn: 'q2-amended' },
  ];
  const values = normalizeDurationFactsToStandaloneQuarters(restated);
  assert.equal(values.find(item => item.fiscalQuarter === 2)?.value, 125, 'Latest-filed same-duration amendment should win');
  assert.equal(values.find(item => item.fiscalQuarter === 3)?.value, 125, 'Q3 must subtract the selected H1/YTD value');
  assert.ok(values.find(item => item.fiscalQuarter === 2)?.accessionNumbers.includes('q2-amended'));
}

{
  const missingQ2 = durationFacts.filter(fact => fact.fp !== 'Q2');
  const values = normalizeDurationFactsToStandaloneQuarters(missingQ2);
  assert.ok(values.some(item => item.fiscalQuarter === 1));
  assert.ok(!values.some(item => item.fiscalQuarter === 2), 'Missing H1 must not be interpolated');
  assert.ok(!values.some(item => item.fiscalQuarter === 3), 'Q3 standalone requires H1 prerequisite');
  assert.equal(values.find(item => item.fiscalQuarter === 4)?.value, 150, 'Q4 can still be derived from FY and disclosed 9M YTD');
}

{
  const instantFacts: SecCompanyFact[] = [
    { end: '2026-03-31', val: 50, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'i-q1' },
    { end: '2026-06-30', val: 55, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'i-q2-old' },
    { end: '2026-06-30', val: 56, fy: 2026, fp: 'Q2', form: '10-Q/A', filed: '2026-08-15', accn: 'i-q2-new' },
    { end: '2026-09-30', val: 60, fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: 'i-q3' },
    { end: '2026-12-31', val: 70, fy: 2026, fp: 'FY', form: '10-K', filed: '2027-02-15', accn: 'i-fy' },
  ];
  const values = normalizeInstantFactsToFiscalQuarters(instantFacts);
  assert.deepEqual(values.map(item => [item.fiscalQuarter, item.value]), [[1, 50], [2, 56], [3, 60], [4, 70]]);
  assert.equal(values[1].derivation, 'reported_instant');
  assert.deepEqual(values[1].accessionNumbers, ['i-q2-new']);
}

{
  // A current filing can include a prior-year comparative fact tagged with the current filing's fy/fp.
  // The newer filing date must never make the older period-end win over the current fiscal period.
  const comparativeDurationFacts: SecCompanyFact[] = [
    { start: '2026-01-01', end: '2026-03-31', val: 100, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'current-q1' },
    { start: '2026-01-01', end: '2026-06-30', val: 220, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'current-q2' },
    { start: '2026-01-01', end: '2026-09-30', val: 350, fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: 'current-q3' },
    { start: '2025-01-01', end: '2025-09-30', val: 300, fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: 'comparative-q3' },
  ];
  const values = normalizeDurationFactsToStandaloneQuarters(comparativeDurationFacts);
  const q3 = values.find(item => item.fiscalQuarter === 3);
  assert.equal(q3?.value, 130, 'Current-period Q3 YTD must win over prior-year comparative Q3 fact');
  assert.equal(q3?.end, '2026-09-30');
  assert.ok(q3?.accessionNumbers.includes('current-q3'));
  assert.ok(!q3?.accessionNumbers.includes('comparative-q3'));
}

{
  const comparativeInstantFacts: SecCompanyFact[] = [
    { end: '2026-06-30', val: 56, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'current-instant' },
    { end: '2025-06-30', val: 44, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'comparative-instant' },
  ];
  const values = normalizeInstantFactsToFiscalQuarters(comparativeInstantFacts);
  assert.equal(values.length, 1);
  assert.equal(values[0].value, 56);
  assert.equal(values[0].end, '2026-06-30');
  assert.deepEqual(values[0].accessionNumbers, ['current-instant']);
}

console.log('SEC XBRL quarter normalization checks passed');
