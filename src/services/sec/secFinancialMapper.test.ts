import assert from 'node:assert/strict';
import type { SecCompanyFact, SecCompanyFactsResponse, SecSubmissionsResponse, SecTickerRecord } from './secClient';
import { mapSecBundleToCanonicalFinancials } from './secFinancialMapper';

const duration = (values: [number, number, number, number], prefix: string): SecCompanyFact[] => [
  { start: '2026-01-01', end: '2026-03-31', val: values[0], fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: `${prefix}-q1` },
  { start: '2026-01-01', end: '2026-06-30', val: values[0] + values[1], fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: `${prefix}-q2` },
  { start: '2026-01-01', end: '2026-09-30', val: values[0] + values[1] + values[2], fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: `${prefix}-q3` },
  { start: '2026-01-01', end: '2026-12-31', val: values.reduce((sum, value) => sum + value, 0), fy: 2026, fp: 'FY', form: '10-K', filed: '2027-02-15', accn: `${prefix}-fy` },
];

const instant = (values: [number, number, number, number], prefix: string): SecCompanyFact[] => [
  { end: '2026-03-31', val: values[0], fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01', accn: `${prefix}-q1` },
  { end: '2026-06-30', val: values[1], fy: 2026, fp: 'Q2', form: '10-Q', filed: '2026-08-01', accn: `${prefix}-q2` },
  { end: '2026-09-30', val: values[2], fy: 2026, fp: 'Q3', form: '10-Q', filed: '2026-11-01', accn: `${prefix}-q3` },
  { end: '2026-12-31', val: values[3], fy: 2026, fp: 'FY', form: '10-K', filed: '2027-02-15', accn: `${prefix}-fy` },
];

const usd = (facts: SecCompanyFact[]) => ({ label: 'test', units: { USD: facts } });
const perShare = (facts: SecCompanyFact[]) => ({ label: 'test', units: { 'USD/shares': facts } });

const companyFacts: SecCompanyFactsResponse = {
  cik: 123456,
  entityName: 'Test Corp',
  facts: {
    'us-gaap': {
      Revenues: usd(duration([100_000_000, 120_000_000, 130_000_000, 150_000_000], 'rev')),
      NetIncomeLoss: usd(duration([10_000_000, 12_000_000, 13_000_000, 15_000_000], 'ni')),
      EarningsPerShareDiluted: perShare(duration([0.10, 0.12, 0.13, 0.15], 'eps')),
      CashAndCashEquivalentsAtCarryingValue: usd(instant([50_000_000, 55_000_000, 60_000_000, 70_000_000], 'cash')),
      Assets: usd(instant([500_000_000, 520_000_000, 540_000_000, 580_000_000], 'assets')),
      Liabilities: usd(instant([250_000_000, 255_000_000, 260_000_000, 270_000_000], 'liab')),
      StockholdersEquity: usd(instant([250_000_000, 265_000_000, 280_000_000, 310_000_000], 'equity')),
      NetCashProvidedByUsedInOperatingActivities: usd(duration([20_000_000, 25_000_000, 30_000_000, 45_000_000], 'ocf')),
      PaymentsToAcquirePropertyPlantAndEquipment: usd(duration([5_000_000, 7_000_000, 9_000_000, 9_000_000], 'capex')),
    },
  },
};

const identity: SecTickerRecord = { cik: '0000123456', ticker: 'TEST', title: 'Test Corp' };
const accessionNumbers = [
  'rev-q1', 'rev-q2', 'rev-q3', 'rev-fy',
  'ni-q1', 'ni-q2', 'ni-q3', 'ni-fy',
  'eps-q1', 'eps-q2', 'eps-q3', 'eps-fy',
  'cash-q1', 'cash-q2', 'cash-q3', 'cash-fy',
  'assets-q1', 'assets-q2', 'assets-q3', 'assets-fy',
  'liab-q1', 'liab-q2', 'liab-q3', 'liab-fy',
  'equity-q1', 'equity-q2', 'equity-q3', 'equity-fy',
  'ocf-q1', 'ocf-q2', 'ocf-q3', 'ocf-fy',
  'capex-q1', 'capex-q2', 'capex-q3', 'capex-fy',
];
const submissions: SecSubmissionsResponse = {
  cik: identity.cik,
  filings: {
    recent: {
      accessionNumber: accessionNumbers,
      primaryDocument: accessionNumbers.map(accn => `${accn}.htm`),
      form: accessionNumbers.map(accn => accn.endsWith('-fy') ? '10-K' : '10-Q'),
      filingDate: accessionNumbers.map(accn => accn.endsWith('-fy') ? '2027-02-15' : '2026-11-01'),
    },
  },
};

const dataset = mapSecBundleToCanonicalFinancials({
  identity,
  submissions,
  companyFacts,
  retrievedAt: '2027-02-16T00:00:00.000Z',
});

assert.ok(dataset);
assert.deepEqual(dataset?.periods, ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026']);
assert.equal(dataset?.ticker, 'TEST');
assert.equal(dataset?.currency, 'USD');
assert.equal(dataset?.provenanceStatus, 'verified');
assert.match(dataset?.generatedBy || '', /sec-xbrl-v1/);

assert.deepEqual(dataset?.values['income_statement.revenue'].map(item => item.value), [100, 120, 130, 150]);
assert.deepEqual(dataset?.values['income_statement.net_income'].map(item => item.value), [10, 12, 13, 15]);
assert.deepEqual(dataset?.values['income_statement.eps_diluted'].map(item => item.value), [0.10, 0.12, 0.13, 0.15]);
assert.deepEqual(dataset?.values['balance_sheet.cash_and_equivalents'].map(item => item.value), [50, 55, 60, 70]);
assert.deepEqual(dataset?.values['cash_flow.operating_cash_flow'].map(item => item.value), [20, 25, 30, 45]);
assert.deepEqual(dataset?.values['cash_flow.capex'].map(item => item.value), [5, 7, 9, 9]);
assert.deepEqual(dataset?.values['cash_flow.free_cash_flow'].map(item => item.value), [15, 18, 21, 36]);

const q2Revenue = dataset?.values['income_statement.revenue'][1];
assert.equal(q2Revenue?.verification, 'verified');
assert.equal(q2Revenue?.type, 'derived');
assert.match(q2Revenue?.derivation || '', /cumulative SEC/i);
assert.equal(q2Revenue?.source?.provider, 'SEC EDGAR XBRL');
assert.equal(q2Revenue?.source?.accessionNumber, 'rev-q2');
assert.match(q2Revenue?.source?.documentUrl || '', /\/123456\/revq2\/rev-q2\.htm$/);
assert.equal(dataset?.sourceCoverage.sourceLinkedValues, 0);
assert.equal(dataset?.sourceCoverage.verifiedValues, dataset?.sourceCoverage.nonNullValues);

{
  const missingQ2Facts = structuredClone(companyFacts) as SecCompanyFactsResponse;
  const revenueFacts = missingQ2Facts.facts?.['us-gaap']?.Revenues?.units?.USD ?? [];
  missingQ2Facts.facts!['us-gaap'].Revenues.units!.USD = revenueFacts.filter(fact => fact.fp !== 'Q2');
  const partial = mapSecBundleToCanonicalFinancials({ identity, submissions, companyFacts: missingQ2Facts, retrievedAt: '2027-02-16T00:00:00.000Z' })!;
  assert.equal(partial.values['income_statement.revenue'][1].value, null, 'Missing SEC quarter must stay null');
  assert.equal(partial.values['income_statement.revenue'][1].verification, 'unverified');
  assert.ok(partial.provenanceWarnings.some(item => item.code === 'SEC_METRIC_COVERAGE_PARTIAL'));
}

assert.equal(mapSecBundleToCanonicalFinancials({
  identity,
  submissions,
  companyFacts: { cik: 123456, facts: { custom: {} } },
  retrievedAt: '2027-02-16T00:00:00.000Z',
}), null);

console.log('SEC verified canonical financial mapping checks passed');
