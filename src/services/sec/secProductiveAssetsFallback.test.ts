import assert from 'node:assert/strict';
import type { SecCompanyFact } from './secClient';
import { mapSecBundleToCanonicalFinancials, type SecCompanyBundleLike } from './secFinancialMapper';

const ytd = (fp: 'Q1' | 'Q2' | 'Q3' | 'FY', val: number, accn: string): SecCompanyFact => ({
  start: '2026-01-01',
  end: fp === 'Q1' ? '2026-03-31' : fp === 'Q2' ? '2026-06-30' : fp === 'Q3' ? '2026-09-30' : '2026-12-31',
  val,
  fy: 2026,
  fp,
  form: fp === 'FY' ? '10-K' : '10-Q',
  filed: '2027-02-15',
  accn,
});
const usd = (facts: SecCompanyFact[]) => ({ units: { USD: facts } });

const bundle: SecCompanyBundleLike = {
  identity: { cik: '0000000123', ticker: 'TEST', title: 'Test' },
  submissions: { cik: '0000000123' },
  retrievedAt: '2027-02-16T00:00:00.000Z',
  companyFacts: { cik: 123, facts: { 'us-gaap': {
    Revenues: usd([ytd('Q1', 100, 'r1'), ytd('Q2', 220, 'r2'), ytd('Q3', 350, 'r3'), ytd('FY', 500, 'rfy')]),
    NetCashProvidedByUsedInOperatingActivities: usd([ytd('Q1', 20, 'o1'), ytd('Q2', 45, 'o2'), ytd('Q3', 75, 'o3'), ytd('FY', 120, 'ofy')]),
    // Narrower PPE concept exists only for Q1. The fallback must fill later periods without replacing Q1.
    PaymentsToAcquirePropertyPlantAndEquipment: usd([ytd('Q1', 5, 'p1')]),
    PaymentsToAcquireProductiveAssets: usd([ytd('Q1', 6, 'a1'), ytd('Q2', 13, 'a2'), ytd('Q3', 22, 'a3'), ytd('FY', 32, 'afy')]),
  } } },
};

const mapped = mapSecBundleToCanonicalFinancials(bundle)!;
const capex = mapped.values['cash_flow.capex'];
assert.deepEqual(capex.map(item => item.value), [0.000005, 0.000007, 0.000009, 0.000010]);
assert.match(capex[0].derivation || '', /PaymentsToAcquirePropertyPlantAndEquipment/);
assert.match(capex[1].derivation || '', /PaymentsToAcquireProductiveAssets/);
const fcf = mapped.values['cash_flow.free_cash_flow'];
assert.ok(fcf.every(item => item.verification === 'verified'));

console.log('SEC productive-assets capex fallback checks passed');
