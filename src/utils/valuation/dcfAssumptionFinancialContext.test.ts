import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecVerificationEnvelope } from '../../domain/secVerification';
import { upgradeCanonicalTestFixture } from '../../domain/__tests__/verifiedFixtureBuilder';
import { resolveDcfAssumptionFinancialContext } from './dcfAssumptionProposal';

function envelope(): SecVerificationEnvelope {
  const periods = ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];
  const values: CanonicalFinancialDataset['values'] = {};
  for (const metric of ['income_statement.revenue', 'cash_flow.free_cash_flow']) {
    const [statement, name] = metric.split('.') as [CanonicalFinancialValue['statement'], string];
    values[metric] = periods.map((period, i) => ({
      statement, metric: name, period, value: metric.endsWith('.revenue') ? [100, 200, 300, 400][i] : [-10, 20, 30, 40][i],
      unit: 'USD_M', currency: 'USD', periodType: 'standalone_quarter', type: 'reported', verification: 'verified',
      source: { provider: 'SEC EDGAR' },
    }));
  }
  return {
    status: 'verified_partial', ticker: 'TEST', retrieved_at: '2026-09-30T00:00:00Z',
    provenance_status: 'verified', provenance_warnings: [], dcf_coverage: null, dcf_financial_inputs: null,
    latest_statements_source: null,
    canonical_financials: upgradeCanonicalTestFixture({
      schemaVersion: 1, generatedBy: 'lumina-financial-provenance-v1+sec-xbrl-v1', ticker: 'TEST', currency: 'USD',
      periods, values, provenanceStatus: 'verified', provenanceWarnings: [],
      sourceCoverage: { totalValues: 8, nonNullValues: 8, missingValues: 0, verifiedValues: 8, sourceLinkedValues: 8 },
    }),
  };
}

test('partial coverage can inform forward assumptions using only the canonical four-quarter flow window', () => {
  assert.deepEqual(resolveDcfAssumptionFinancialContext(envelope(), 'TEST'), {
    sourcePeriod: 'Q2 2026', startingRevenueM: 1000, trailingFourFreeCashFlowM: 80, historicalFcfMarginPct: 8,
  });
});

test('missing, duplicate, YTD, unverified or foreign-currency quarters never enable assumptions', () => {
  const mutate = [
    (d: CanonicalFinancialDataset) => { d.values['cash_flow.free_cash_flow'].pop(); },
    (d: CanonicalFinancialDataset) => { d.values['income_statement.revenue'].push({ ...d.values['income_statement.revenue'][0] }); },
    (d: CanonicalFinancialDataset) => { d.values['cash_flow.free_cash_flow'][3].periodType = 'ytd'; },
    (d: CanonicalFinancialDataset) => { d.values['income_statement.revenue'][2].verification = 'unverified'; },
    (d: CanonicalFinancialDataset) => { d.values['income_statement.revenue'][2].currency = 'EUR'; },
    (d: CanonicalFinancialDataset) => { d.currency = 'EUR'; },
    (d: CanonicalFinancialDataset) => { d.ticker = 'OTHER'; },
    (d: CanonicalFinancialDataset) => { d.generatedBy = 'model-asserted'; },
    (d: CanonicalFinancialDataset) => { d.values['cash_flow.free_cash_flow'][3].periodStart = '2026-01-01'; },
  ];
  for (const mutation of mutate) {
    const input = envelope(); mutation(input.canonical_financials!);
    assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST'), null);
  }
  assert.equal(resolveDcfAssumptionFinancialContext(envelope(), 'OTHER'), null);
  assert.equal(resolveDcfAssumptionFinancialContext({ ...envelope(), status: 'unavailable' }, 'TEST'), null);
});

test('nonpositive revenue is unavailable while a verified negative FCF remains a legitimate context', () => {
  const input = envelope();
  input.canonical_financials!.values['cash_flow.free_cash_flow'].forEach(fact => { fact.value = -10; });
  assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST')?.historicalFcfMarginPct, -4);
  input.canonical_financials!.values['income_statement.revenue'].forEach(fact => { fact.value = 0; });
  assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST'), null);
});

test('legacy verified eligibility stays compatible but cannot override invalid canonical observations', () => {
  const input = envelope();
  delete input.canonical_financials;
  input.status = 'verified_eligible';
  input.dcf_financial_inputs = {
    version: 1, generated_by: 'sec-verified-financial-inputs-v1', eligible: true, ticker: 'TEST', periods: [],
    source_period: 'Q2 2026', latest_balance_sheet_period_end: null, share_as_of: null,
    starting_revenue_m: 1000, trailing_four_free_cash_flow_m: 80, historical_fcf_margin_pct: 8,
    cash_and_equivalents_m: null, short_term_investments_m: null, total_debt_m: null, net_cash_m: null,
    current_shares_outstanding_m: null, issues: [],
  };
  assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST')?.startingRevenueM, 1000);
  input.canonical_financials = envelope().canonical_financials;
  input.canonical_financials!.values['cash_flow.free_cash_flow'].pop();
  assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST'), null);
  delete input.canonical_financials;
  input.status = 'verified_partial';
  assert.equal(resolveDcfAssumptionFinancialContext(input, 'TEST'), null);
});
