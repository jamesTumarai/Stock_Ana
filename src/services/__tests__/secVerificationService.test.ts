import assert from 'node:assert/strict';
import { fetchSecVerificationEnvelope } from '../secVerificationService';

console.log('Running SEC verification service checks...');

const originalFetch = globalThis.fetch;
const originalWindow = (globalThis as any).window;
(globalThis as any).window = globalThis;

const eligibleBody = {
  ticker: 'AAPL',
  retrievedAt: '2026-09-09T19:20:00.000Z',
  provenanceStatus: 'verified',
  provenanceWarnings: [],
  dcfCoverage: {
    eligible: true,
    periods: ['Q4 FY25', 'Q1 FY26', 'Q2 FY26', 'Q3 FY26'],
    currentSharesOutstandingM: 14750,
    issues: [],
  },
  dcfFinancialInputs: {
    version: 1,
    generatedBy: 'sec-verified-financial-inputs-v1',
    eligible: true,
    ticker: 'AAPL',
    periods: ['Q4 FY25', 'Q1 FY26', 'Q2 FY26', 'Q3 FY26'],
    sourcePeriod: 'Q4 FY25–Q3 FY26',
    latestBalanceSheetPeriodEnd: '2026-06-27',
    shareAsOf: '2026-07-17',
    startingRevenueM: 420000,
    trailingFourFreeCashFlowM: 120000,
    historicalFcfMarginPct: 28.57,
    cashAndEquivalentsM: 30000,
    shortTermInvestmentsM: 20000,
    totalDebtM: 90000,
    netCashM: -40000,
    currentSharesOutstandingM: 14750,
    issues: [],
  },
  latestStatementsSource: {
    document_url: 'https://www.sec.gov/example',
    document_type: '10-Q',
    filing_date: '2026-08-01',
    period_end: '2026-06-27',
    units: 'USD millions',
  },
};

try {
  globalThis.fetch = (async () => new Response(JSON.stringify(eligibleBody), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const eligible = await fetchSecVerificationEnvelope('aapl');
  assert.equal(eligible?.status, 'verified_eligible');
  assert.equal(eligible?.ticker, 'AAPL');
  assert.equal(eligible?.dcf_financial_inputs?.eligible, true);
  assert.equal(eligible?.dcf_financial_inputs?.net_cash_m, -40000);
  assert.equal(eligible?.dcf_financial_inputs?.current_shares_outstanding_m, 14750);

  const withCanonical = {
    ...eligibleBody,
    canonicalFinancials: {
      ticker: 'AAPL', generatedBy: 'lumina-sec-xbrl-v1', provenanceStatus: 'verified',
      periods: ['Q2 2026'],
      values: { 'income_statement.eps_diluted': [{ period: 'Q2 2026', value: 0.32, verification: 'verified' }] },
    },
  };
  globalThis.fetch = (async () => new Response(JSON.stringify(withCanonical), { status: 200 })) as typeof fetch;
  const withHistory = await fetchSecVerificationEnvelope('AAPL');
  assert.equal(withHistory?.canonical_financials?.values['income_statement.eps_diluted'][0].value, 0.32);
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...withCanonical, canonicalFinancials: { ...withCanonical.canonicalFinancials, ticker: 'MSFT' },
  }), { status: 200 })) as typeof fetch;
  const wrongIssuer = await fetchSecVerificationEnvelope('AAPL');
  assert.equal(wrongIssuer?.canonical_financials, undefined);
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ...withCanonical,
    canonicalFinancials: { ...withCanonical.canonicalFinancials,
      values: { 'income_statement.eps_diluted': [{ period: 'Q1 2026', value: 0.32, verification: 'verified' }] },
    },
  }), { status: 200 })) as typeof fetch;
  const mismatchedPeriod = await fetchSecVerificationEnvelope('AAPL');
  assert.equal(mismatchedPeriod?.canonical_financials, undefined);

  const malformed = structuredClone(eligibleBody);
  malformed.dcfFinancialInputs.netCashM = -39999;
  globalThis.fetch = (async () => new Response(JSON.stringify(malformed), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const downgraded = await fetchSecVerificationEnvelope('AAPL');
  assert.equal(downgraded?.status, 'verified_partial');
  assert.equal(downgraded?.dcf_financial_inputs?.eligible, false);
  assert.ok(downgraded?.dcf_financial_inputs?.issues.some(issue => issue.code === 'SEC_CLIENT_RUNTIME_VALIDATION_FAILED'));

  globalThis.fetch = (async () => new Response(JSON.stringify({
    ticker: 'MSFT',
    error: 'not the requested ticker',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  const mismatch = await fetchSecVerificationEnvelope('AAPL');
  assert.equal(mismatch?.status, 'unavailable');
  assert.equal(mismatch?.error?.code, 'SEC_RESPONSE_TICKER_MISMATCH');
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete (globalThis as any).window;
  else (globalThis as any).window = originalWindow;
}

console.log('SEC verification service checks passed');
