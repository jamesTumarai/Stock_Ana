import assert from 'node:assert/strict';
import type { SecCompanyFactsResponse, SecSubmissionsResponse, SecTickerRecord } from './secClient';
import { buildSecShareSnapshot } from './secShareSnapshot';

const identity: SecTickerRecord = { cik: '0000123456', ticker: 'TEST', title: 'Test Corp' };
const submissions: SecSubmissionsResponse = {
  cik: identity.cik,
  filings: {
    recent: {
      accessionNumber: ['cover-old', 'cover-new', 'diluted'],
      primaryDocument: ['old.htm', 'new.htm', 'diluted.htm'],
      form: ['10-Q', '10-Q', '10-Q'],
      filingDate: ['2026-05-01', '2026-08-01', '2026-08-01'],
    },
  },
};

const companyFacts: SecCompanyFactsResponse = {
  cik: 123456,
  facts: {
    dei: {
      EntityCommonStockSharesOutstanding: {
        units: {
          shares: [
            { end: '2026-04-20', val: 100_000_000, fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: 'cover-old' },
            { end: '2026-07-20', val: 98_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'cover-new' },
          ],
        },
      },
    },
    'us-gaap': {
      WeightedAverageNumberOfDilutedSharesOutstanding: {
        units: {
          shares: [
            { start: '2026-04-01', end: '2026-06-30', val: 99_000_000, fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: 'diluted' },
          ],
        },
      },
    },
  },
};

const snapshot = buildSecShareSnapshot(identity, submissions, companyFacts, '2026-08-02T00:00:00.000Z');
assert.equal(snapshot.verification, 'verified');
assert.equal(snapshot.currentCommonSharesOutstanding?.sharesM, 98);
assert.equal(snapshot.currentCommonSharesOutstanding?.end, '2026-07-20');
assert.equal(snapshot.currentCommonSharesOutstanding?.source.accessionNumber, 'cover-new');
assert.match(snapshot.currentCommonSharesOutstanding?.source.documentUrl || '', /\/123456\/covernew\/new\.htm$/);
assert.equal(snapshot.latestDilutedWeightedAverageShares?.sharesM, 99);
assert.equal(snapshot.latestDilutedWeightedAverageShares?.start, '2026-04-01');
assert.equal(snapshot.latestDilutedWeightedAverageShares?.end, '2026-06-30');
assert.equal(snapshot.fullyDilutedSharesM, null);
assert.notEqual(
  snapshot.currentCommonSharesOutstanding?.sharesM,
  snapshot.latestDilutedWeightedAverageShares?.sharesM,
  'Current shares and diluted weighted-average shares must never be conflated.',
);

{
  const noCurrent = structuredClone(companyFacts) as SecCompanyFactsResponse;
  delete noCurrent.facts?.dei;
  const partial = buildSecShareSnapshot(identity, submissions, noCurrent, '2026-08-02T00:00:00.000Z');
  assert.equal(partial.verification, 'partial');
  assert.equal(partial.currentCommonSharesOutstanding, null);
  assert.equal(partial.latestDilutedWeightedAverageShares?.sharesM, 99);
}

{
  const empty = buildSecShareSnapshot(identity, submissions, { cik: 123456, facts: {} }, '2026-08-02T00:00:00.000Z');
  assert.equal(empty.verification, 'unavailable');
  assert.equal(empty.currentCommonSharesOutstanding, null);
  assert.equal(empty.latestDilutedWeightedAverageShares, null);
  assert.equal(empty.fullyDilutedSharesM, null);
}

console.log('SEC share-count distinction checks passed');

{
  const old=structuredClone(companyFacts);
  const shares=old.facts!.dei!.EntityCommonStockSharesOutstanding!.units!.shares!;
  for(const fact of shares){fact.end='2011-04-29';fact.filed='2011-05-06';}
  old.facts!.dei!.EntityCommonStockSharesOutstanding!.units!.shares=[shares[0]];
  const snapshot=buildSecShareSnapshot(identity,submissions,old,'2026-08-02T00:00:00Z');
  assert.equal(snapshot.currentCommonSharesOutstanding,null);
  assert.equal(snapshot.historicalCommonSharesOutstanding?.at(-1)?.end,'2011-04-29');
}
{
  const recent={...submissions,filings:{recent:{form:['10-Q'],reportDate:['2026-12-31']}}};
  // The retrieval is later than this filing; July's old count is not December's.
  assert.equal(buildSecShareSnapshot(identity,recent,companyFacts,'2027-02-01T00:00:00Z').currentCommonSharesOutstanding,null);
}
