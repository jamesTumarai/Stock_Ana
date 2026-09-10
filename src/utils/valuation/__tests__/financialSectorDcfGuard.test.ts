import assert from 'node:assert/strict';
import { buildRigorousDCFModel } from '../dcfMathEngine';

const eligibleSecEnvelope = (ticker: string) => ({
  status: 'verified_eligible',
  ticker,
  retrieved_at: '2026-09-10T00:00:00.000Z',
  provenance_status: 'verified',
  provenance_warnings: [],
  dcf_coverage: {
    eligible: true,
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    current_shares_outstanding_m: 1_000,
    issues: [],
  },
  dcf_financial_inputs: {
    version: 1,
    generated_by: 'sec-verified-financial-inputs-v1',
    eligible: true,
    ticker,
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    source_period: 'Q1 2026–Q4 2026',
    latest_balance_sheet_period_end: '2026-12-31',
    share_as_of: '2027-01-20',
    starting_revenue_m: 5_000,
    trailing_four_free_cash_flow_m: 900,
    historical_fcf_margin_pct: 18,
    cash_and_equivalents_m: 2_000,
    short_term_investments_m: 500,
    total_debt_m: 1_500,
    net_cash_m: 1_000,
    current_shares_outstanding_m: 1_000,
    issues: [],
  },
  latest_statements_source: null,
});

const dcfShape = {
  assumptions: { wacc_pct: 10, terminal_growth_pct: 3, projection_years: 5 },
  scenarios: {
    bear: { revenue_cagr_pct: 3, terminal_margin_pct: 12, fair_value_per_share: null, key_assumption_note: 'bear' },
    base: { revenue_cagr_pct: 6, terminal_margin_pct: 15, fair_value_per_share: null, key_assumption_note: 'base' },
    bull: { revenue_cagr_pct: 9, terminal_margin_pct: 18, fair_value_per_share: null, key_assumption_note: 'bull' },
  },
};

{
  const sofi: any = {
    ticker: 'SOFI',
    company_profile: {
      sector: 'Financial Services',
      industry: 'Credit Services',
      description: 'Digital banking and lending platform',
    },
    market_snapshot: {
      ticker: 'SOFI',
      price: 20,
      currency: 'USD',
      provider: 'TEST',
      asOf: '2026-09-10T00:00:00.000Z',
    },
    intrinsic_value: { current_price: 20, dcf_model: structuredClone(dcfShape) },
    sec_verification: eligibleSecEnvelope('SOFI'),
  };

  const { inputs, dcfModel } = buildRigorousDCFModel(sofi, 'SOFI');
  assert.equal(inputs.financialDataSource, 'sec_verified');
  assert.equal(inputs.isValid, false, 'Complete SEC inputs must not make a lender eligible for an operating-company FCFF DCF.');
  assert.ok(inputs.missingFields?.some(field => field.includes('operating-company FCFF model fit')));
  assert.equal(dcfModel.scenarios.base.fair_value_per_share, null);
}

{
  const operatingCompany: any = {
    ticker: 'TEST',
    company_profile: { sector: 'Technology', industry: 'Software' },
    market_snapshot: {
      ticker: 'TEST',
      price: 50,
      currency: 'USD',
      provider: 'TEST',
      asOf: '2026-09-10T00:00:00.000Z',
    },
    intrinsic_value: { current_price: 50, dcf_model: structuredClone(dcfShape) },
    sec_verification: eligibleSecEnvelope('TEST'),
  };

  const { inputs, dcfModel } = buildRigorousDCFModel(operatingCompany, 'TEST');
  assert.equal(inputs.isValid, true, 'Operating-company SEC DCF path must remain available.');
  assert.equal(inputs.financialDataSource, 'sec_verified');
  assert.ok(typeof dcfModel.scenarios.base.fair_value_per_share === 'number');
}

console.log('Financial-sector generic FCFF guard checks passed');
