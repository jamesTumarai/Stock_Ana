import assert from 'node:assert/strict';
import { buildRigorousDCFModel, calculateStrictDCFValue } from '../dcfMathEngine';
import { buildUniversalValuationData } from '../valuationStore';

console.log('Running valuation integrity checks...');

const disclosedReport: any = {
  ticker: 'TEST',
  company_profile: { stock_price: 50, shares_outstanding: '100M' },
  financial_statements: {
    periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    income_statement: { revenue: [100, 110, 120, 130], net_income: [10, 11, 12, 13] },
    balance_sheet: {
      cash_and_equivalents: [20, 21, 22, 25],
      short_term_investments: [5, 5, 6, 7],
      total_debt: [40, 39, 38, 36],
    },
    cash_flow: { free_cash_flow: [12, 13, 14, 15] },
  },
  intrinsic_value: {
    current_price: 50,
    dcf_model: {
      assumptions: { wacc_pct: 10, terminal_growth_pct: 3, projection_years: 5 },
      scenarios: {
        bear: { revenue_cagr_pct: 3, terminal_margin_pct: 8, fair_value_per_share: 999, key_assumption_note: 'bear' },
        base: { revenue_cagr_pct: 6, terminal_margin_pct: 10, fair_value_per_share: 999, key_assumption_note: 'base' },
        bull: { revenue_cagr_pct: 9, terminal_margin_pct: 12, fair_value_per_share: 999, key_assumption_note: 'bull' },
      },
    },
    summary: { fair_value_range_low: 999, fair_value_range_high: 999, base_case_fair_value: 999, margin_of_safety_pct: 0, verdict_text: '' },
  },
};

{
  const { inputs, dcfModel } = buildRigorousDCFModel(disclosedReport, 'TEST');
  assert.equal(inputs.isValid, true);
  assert.equal(inputs.startingRevenueM, 460);
  assert.equal(inputs.sharesOutstandingM, 100);
  assert.equal(inputs.netCashM, -4);
  assert.equal(inputs.sourcePeriod, 'Q1 2025–Q4 2025');
  assert.notEqual(dcfModel.scenarios.base.fair_value_per_share, 999, 'DCF must be recomputed rather than retain an AI target');
  assert.ok(Number.isFinite(dcfModel.scenarios.base.fair_value_per_share));
}

{
  const fiscalYearLabels = structuredClone(disclosedReport);
  fiscalYearLabels.financial_statements.periods = ['Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26'];
  assert.equal(buildRigorousDCFModel(fiscalYearLabels, 'TEST').inputs.isValid, true, 'FY quarter labels are valid disclosed periods');
}

{
  const derivableInputs = structuredClone(disclosedReport);
  delete derivableInputs.company_profile.shares_outstanding;
  derivableInputs.financial_statements.income_statement.eps_diluted = [0.1, 0.11, 0.12, 0.13];
  delete derivableInputs.financial_statements.cash_flow.free_cash_flow;
  derivableInputs.financial_statements.cash_flow.operating_cash_flow = [15, 16, 17, 18];
  derivableInputs.financial_statements.cash_flow.capex = [-3, -3, -3, -3];
  const { inputs } = buildRigorousDCFModel(derivableInputs, 'TEST');
  assert.equal(inputs.isValid, true);
  assert.ok(inputs.derivedFields?.some(field => field.includes('diluted shares')));
  assert.ok(inputs.derivedFields?.some(field => field.includes('free cash flow')));
}

{
  const missingShares = structuredClone(disclosedReport);
  delete missingShares.company_profile.shares_outstanding;
  const { inputs, dcfModel } = buildRigorousDCFModel(missingShares, 'TEST');
  assert.equal(inputs.isValid, false);
  assert.ok(inputs.missingFields?.includes('shares outstanding'));
  assert.equal(dcfModel.scenarios.base.fair_value_per_share, 0);

  const unavailable = buildUniversalValuationData(missingShares, 'TEST');
  assert.equal(unavailable.summary.base_case_fair_value, 0);
  assert.equal(unavailable.validation_alerts?.[0].code, 'VALUATION_INPUTS_INCOMPLETE');
}

{
  const valid = calculateStrictDCFValue(460, 100, -4, 10, 3, 6, 10, 5);
  assert.ok(Number.isFinite(valid));
  assert.ok(Number.isNaN(calculateStrictDCFValue(460, 100, -4, 3, 3, 6, 10, 5)), 'g >= WACC must be rejected');
  assert.ok(Number.isNaN(calculateStrictDCFValue(0, 100, 0, 10, 3, 6, 10, 5)), 'missing revenue must be rejected');
}

console.log('Valuation integrity checks passed');
