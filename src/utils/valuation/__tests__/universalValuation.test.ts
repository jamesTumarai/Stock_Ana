import assert from 'node:assert/strict';
import { buildRigorousDCFModel, calculateStrictDCFValue } from '../dcfMathEngine';
import { buildUniversalValuationData } from '../valuationStore';
import { calculateRelativeOnlyModel } from '../relativeEngine';
import { calculateDDMModel } from '../ddmCalculator';
import { calculateREITModel } from '../reitCalculator';
import { calculateCyclicalModel } from '../cyclicalNormalizer';
import { calculateRegionAwareCostOfCapital } from '../costOfCapital';

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
  assert.equal(unavailable, undefined, 'Universal valuation must fail closed when shares are missing');
}

{
  const missingStatements = structuredClone(disclosedReport);
  delete missingStatements.financial_statements.income_statement.revenue;
  assert.equal(buildUniversalValuationData(missingStatements, 'TEST'), undefined, 'Missing revenue must not produce a valuation');

  const missingCash = structuredClone(disclosedReport);
  delete missingCash.financial_statements.balance_sheet.cash_and_equivalents;
  assert.equal(buildUniversalValuationData(missingCash, 'TEST'), undefined, 'Missing cash must not be treated as zero');

  const missingDebt = structuredClone(disclosedReport);
  delete missingDebt.financial_statements.balance_sheet.total_debt;
  assert.equal(buildUniversalValuationData(missingDebt, 'TEST'), undefined, 'Missing debt must not be treated as zero');

  const missingWacc = structuredClone(disclosedReport);
  delete missingWacc.intrinsic_value.dcf_model.assumptions.wacc_pct;
  assert.equal(buildUniversalValuationData(missingWacc, 'TEST'), undefined, 'Missing WACC must not use a benchmark fallback');
}

{
  assert.equal(calculateRelativeOnlyModel({ ticker: 'TEST' }), undefined);
  assert.equal(calculateDDMModel({ ticker: 'TEST' }), undefined);
  assert.equal(calculateREITModel({ ticker: 'TEST' }), undefined);
  assert.equal(calculateCyclicalModel({ ticker: 'TEST' }), undefined);
  assert.equal(calculateRegionAwareCostOfCapital({ ticker: 'TEST' }), undefined);

  const placeholderPeer = structuredClone(disclosedReport);
  placeholderPeer.intrinsic_value.relative_only_model = {
    primary_metric: 'EV/Revenue', peer_median_multiple: 2.8, applied_company_metric_value: 1,
    implied_enterprise_value_b: 2.8, implied_equity_value_b: 3, fair_value_per_share: 30,
    peers_evaluated: [{ ticker: 'PEER_1', name: 'Placeholder', market_cap_b: 5, growth_stage: 'Growth', ev_revenue_multiple: 2.8 }],
    peer_selection_rationale: 'placeholder', stage_confidence_score: 'Low', pre_revenue_disclaimer: '',
  };
  assert.equal(calculateRelativeOnlyModel(placeholderPeer), undefined, 'Placeholder peers must be rejected');
}

{
  const valid = calculateStrictDCFValue(460, 100, -4, 10, 3, 6, 10, 5);
  assert.ok(Number.isFinite(valid));
  assert.ok(Number.isNaN(calculateStrictDCFValue(460, 100, -4, 3, 3, 6, 10, 5)), 'g >= WACC must be rejected');
  assert.ok(Number.isNaN(calculateStrictDCFValue(0, 100, 0, 10, 3, 6, 10, 5)), 'missing revenue must be rejected');
}

console.log('Valuation integrity checks passed');
