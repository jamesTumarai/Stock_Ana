import assert from 'node:assert/strict';
import { isLegacyHistoryReport, validateAndPrepareReport } from './reportValidation';

const makeValidReport = () => ({
  generated_at: '2026-09-09T12:00:00.000Z',
  ticker: 'TEST',
  summary: 'Synthetic validation fixture only.',
  verdict: {
    summary: 'Synthetic fixture.',
    conviction_score: 72,
    key_takeaways: ['Synthetic fixture only'],
  },
  company_profile: {
    stock_price: 50,
    shares_outstanding: '100M',
    currency: 'USD',
    sector: 'Technology',
    industry: 'Software',
  },
  financial_statements: {
    currency: 'USD',
    fiscal_period_type: 'quarterly',
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    income_statement: {
      revenue: [100, 110, 120, 130],
      gross_profit: [50, 55, 60, 65],
      operating_income: [20, 22, 24, 26],
      net_income: [10, 13, 11, 16],
      eps_diluted: [0.10, 0.13, 0.11, 0.16],
    },
    balance_sheet: {
      cash_and_equivalents: [20, 22, 24, 26],
      short_term_investments: [5, 5, 6, 6],
      total_debt: [40, 39, 38, 37],
      total_assets: [200, 210, 220, 230],
      total_liabilities: [100, 105, 110, 115],
      total_equity: [100, 105, 110, 115],
    },
    cash_flow: {
      operating_cash_flow: [20, 25, 23, 30],
      capex: [-5, -6, -5, -7],
      free_cash_flow: [15, 19, 18, 23],
    },
  },
  intrinsic_value: {
    current_price: 50,
    dcf_model: {
      assumptions: { wacc_pct: 10, terminal_growth_pct: 3, projection_years: 5 },
      scenarios: {
        bear: { revenue_cagr_pct: 3, terminal_margin_pct: 8, fair_value_per_share: 40, key_assumption_note: 'synthetic bear' },
        base: { revenue_cagr_pct: 6, terminal_margin_pct: 10, fair_value_per_share: 50, key_assumption_note: 'synthetic base' },
        bull: { revenue_cagr_pct: 9, terminal_margin_pct: 12, fair_value_per_share: 60, key_assumption_note: 'synthetic bull' },
      },
    },
    summary: {
      fair_value_range_low: 40,
      fair_value_range_high: 60,
      base_case_fair_value: 50,
      margin_of_safety_pct: 0,
      verdict_text: 'Synthetic fixture',
    },
  },
});

{
  const prepared = validateAndPrepareReport(makeValidReport(), 'TEST');
  assert.ok(prepared.report, 'Valid report should be prepared');
  assert.equal(prepared.validation.status, 'valid');
  assert.equal(prepared.canPersist, true);
  assert.equal(prepared.report?.schema_version, 2);
  assert.equal(prepared.report?.generated_by_version, 'lumina-phase3-provenance-v1');
  assert.equal(prepared.report?.report_provenance?.research_narrative.source, 'ai_research');
  assert.equal(prepared.report?.report_provenance?.financial_statements.source, 'report_snapshot');
  assert.equal(prepared.report?.report_provenance?.dcf_financial_inputs.source, 'report_snapshot');
  assert.equal(prepared.report?.financial_statements?.validation_summary?.is_balanced, true);
  assert.equal(prepared.report?.intrinsic_value?.dcf_model.inputs?.isValid, true);
}

{
  const invalidNumeric: any = makeValidReport();
  invalidNumeric.financial_statements.income_statement.revenue[0] = '100';
  const prepared = validateAndPrepareReport(invalidNumeric, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.equal(prepared.canPersist, false);
  assert.ok(prepared.validation.issues.some(item => item.code === 'INVALID_STATEMENT_NUMBER'));
  assert.equal(prepared.report?.financial_statements?.income_statement.revenue[0], null);
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
  assert.equal(prepared.report?.verdict?.conviction_score, null);
}

{
  const missingOptional: any = makeValidReport();
  delete missingOptional.financial_statements.income_statement.gross_profit;
  const prepared = validateAndPrepareReport(missingOptional, 'TEST');
  assert.ok(prepared.report);
  assert.equal(prepared.report?.financial_statements?.income_statement.gross_profit, undefined);
}

{
  const missingDcfInput: any = makeValidReport();
  delete missingDcfInput.financial_statements.balance_sheet.short_term_investments;
  const prepared = validateAndPrepareReport(missingDcfInput, 'TEST');
  assert.ok(prepared.report);
  assert.equal(prepared.report?.intrinsic_value?.dcf_model.inputs?.isValid, false);
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
}

{
  const invalidGrowth: any = makeValidReport();
  invalidGrowth.intrinsic_value.dcf_model.assumptions.wacc_pct = 3;
  invalidGrowth.intrinsic_value.dcf_model.assumptions.terminal_growth_pct = 3;
  const prepared = validateAndPrepareReport(invalidGrowth, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'TERMINAL_GROWTH_EXCEEDS_DISCOUNT_RATE'));
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
}

{
  const brokenBalance: any = makeValidReport();
  brokenBalance.financial_statements.balance_sheet.total_assets[3] = 300;
  const prepared = validateAndPrepareReport(brokenBalance, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'BALANCE_SHEET_IMBALANCE'));
}

{
  const brokenFcf: any = makeValidReport();
  brokenFcf.financial_statements.cash_flow.free_cash_flow[2] = 80;
  const prepared = validateAndPrepareReport(brokenFcf, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'FCF_IDENTITY_MISMATCH'));
}

{
  const conflictingPrice: any = makeValidReport();
  conflictingPrice.intrinsic_value.current_price = 70;
  const prepared = validateAndPrepareReport(conflictingPrice, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'CURRENT_PRICE_CONFLICT'));
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
}

{
  const conflictingPeriods: any = makeValidReport();
  conflictingPeriods.financial_statements.key_indicators = {
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q3 2026'],
    categories: [],
  };
  const prepared = validateAndPrepareReport(conflictingPeriods, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'FISCAL_PERIOD_CONFLICT'));
}

{
  assert.equal(isLegacyHistoryReport({ data: { ticker: 'TEST' } }), true);
  assert.equal(isLegacyHistoryReport({ schemaVersion: 2, data: { schema_version: 2 } }), false);
}


{
  const malformedIntrinsic: any = makeValidReport();
  malformedIntrinsic.intrinsic_value = 'not-an-object';
  const prepared = validateAndPrepareReport(malformedIntrinsic, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.equal(prepared.canPersist, false);
  assert.ok(prepared.validation.issues.some(item => item.code === 'INVALID_SECTION_SHAPE' && item.section === 'valuation'));
  assert.equal(prepared.report?.intrinsic_value, undefined);
}

{
  const malformedVerdict: any = makeValidReport();
  malformedVerdict.verdict = 'not-an-object';
  const prepared = validateAndPrepareReport(malformedVerdict, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.equal(prepared.canPersist, false);
  assert.ok(prepared.validation.issues.some(item => item.code === 'INVALID_SECTION_SHAPE' && item.path === 'verdict'));
}

{
  const conflictingShares: any = makeValidReport();
  conflictingShares.intrinsic_value.dcf_model.inputs = {
    ticker: 'TEST',
    currentPrice: 50,
    startingRevenueM: 460,
    sharesOutstandingM: 120,
    netCashM: -5,
    waccPct: 10,
    terminalGrowthPct: 3,
    projectionYears: 5,
    isValid: true,
  };
  const prepared = validateAndPrepareReport(conflictingShares, 'TEST');
  assert.equal(prepared.validation.status, 'invalid');
  assert.ok(prepared.validation.issues.some(item => item.code === 'DCF_SHARE_COUNT_CONFLICT'));
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
}

{
  const malformedPillars: any = makeValidReport();
  malformedPillars.five_pillars = 'not-an-object';
  const prepared = validateAndPrepareReport(malformedPillars, 'TEST');
  assert.ok(prepared.report);
  assert.equal(prepared.validation.status, 'warning');
  assert.equal(prepared.canPersist, true);
  assert.ok(prepared.validation.issues.some(item => item.code === 'INVALID_SECTION_SHAPE' && item.path === 'five_pillars'));
  assert.equal(typeof prepared.report?.five_pillars, 'object');
  assert.notEqual(prepared.report?.five_pillars as any, 'not-an-object');
}



const makeEligibleSecEnvelope = () => ({
  status: 'verified_eligible',
  ticker: 'TEST',
  retrieved_at: '2026-09-10T00:00:00.000Z',
  provenance_status: 'verified',
  provenance_warnings: [],
  dcf_coverage: {
    eligible: true,
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    current_shares_outstanding_m: 80,
    issues: [],
  },
  dcf_financial_inputs: {
    version: 1,
    generated_by: 'sec-verified-financial-inputs-v1',
    eligible: true,
    ticker: 'TEST',
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    source_period: 'Q1 2026–Q4 2026',
    latest_balance_sheet_period_end: '2026-12-31',
    share_as_of: '2027-01-20',
    starting_revenue_m: 1000,
    trailing_four_free_cash_flow_m: 160,
    historical_fcf_margin_pct: 16,
    cash_and_equivalents_m: 100,
    short_term_investments_m: 30,
    total_debt_m: 110,
    net_cash_m: 20,
    current_shares_outstanding_m: 80,
    issues: [],
  },
  latest_statements_source: null,
});


{
  const prepared = validateAndPrepareReport(makeValidReport(), 'TEST', {
    marketQuotes: {
      TEST: {
        symbol: 'TEST',
        price: 55,
        provider: 'Test Provider',
        asOf: '2026-09-10T00:00:00.000Z',
        retrievedAt: '2026-09-10T00:00:01.000Z',
      },
    },
    requireMarketSnapshot: true,
  });
  const reportWithMarket = prepared.report as any;
  assert.equal(prepared.validation.status, 'valid');
  assert.equal(prepared.canPersist, true);
  assert.equal(reportWithMarket?.market_snapshot?.price, 55);
  assert.equal(reportWithMarket?.market_snapshot?.provider, 'Test Provider');
  assert.ok(!Object.values(reportWithMarket?.market_snapshot ?? {}).includes(undefined), 'Persisted market snapshot must not contain undefined fields');
  assert.equal(reportWithMarket?.intrinsic_value?.current_price, 55);
  assert.equal(reportWithMarket?.intrinsic_value?.dcf_model?.inputs?.priceSource, 'market_snapshot');
  assert.equal(reportWithMarket?.report_provenance?.market_price?.source, 'market_snapshot');
}



{
  const conflictingPrice: any = makeValidReport();
  conflictingPrice.intrinsic_value.current_price = 70;
  const prepared = validateAndPrepareReport(conflictingPrice, 'TEST', {
    marketQuotes: {
      TEST: {
        symbol: 'TEST',
        price: 55,
        provider: 'Test Provider',
        asOf: '2026-09-10T00:00:00.000Z',
        retrievedAt: '2026-09-10T00:00:01.000Z',
      },
    },
    requireMarketSnapshot: true,
  });
  assert.equal(prepared.validation.status, 'warning');
  assert.equal(prepared.canPersist, true);
  assert.ok(prepared.validation.issues.some(item => item.code === 'REPORT_PRICE_OVERRIDDEN_BY_MARKET_SNAPSHOT'));
  assert.ok(!prepared.validation.issues.some(item => item.code === 'CURRENT_PRICE_CONFLICT'));
  assert.equal(prepared.report?.company_profile?.stock_price, 55);
  assert.equal(prepared.report?.intrinsic_value?.current_price, 55);
}


{
  const report: any = makeValidReport();
  report.sec_verification = makeEligibleSecEnvelope();
  const prepared = validateAndPrepareReport(report, 'TEST', {
    marketQuotes: {
      TEST: {
        symbol: 'TEST',
        price: 55,
        provider: 'Test Provider',
        asOf: '2026-09-10T00:00:00.000Z',
        retrievedAt: '2026-09-10T00:00:01.000Z',
      },
    },
    requireMarketSnapshot: true,
  });
  const finalReport = prepared.report as any;
  assert.equal(prepared.canPersist, true);
  assert.equal(finalReport?.sec_verification?.status, 'verified_eligible');
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.financialDataSource, 'sec_verified');
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.priceSource, 'market_snapshot');
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.startingRevenueM, 1000);
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.sharesOutstandingM, 80);
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.netCashM, 20);
  assert.equal(finalReport?.intrinsic_value?.dcf_model?.inputs?.currentPrice, 55);
  assert.equal(finalReport?.report_provenance?.dcf_financial_inputs?.source, 'sec_verified');
  assert.equal(finalReport?.report_provenance?.market_price?.source, 'market_snapshot');
}


{
  const prepared = validateAndPrepareReport(makeValidReport(), 'TEST', {
    marketQuotes: {},
    requireMarketSnapshot: true,
  });
  assert.equal(prepared.validation.status, 'invalid');
  assert.equal(prepared.canPersist, false);
  assert.ok(prepared.validation.issues.some(item => item.code === 'MARKET_SNAPSHOT_UNAVAILABLE'));
  assert.equal(prepared.report?.intrinsic_value?.dcf_model?.inputs?.isValid, false);
  assert.equal(prepared.report?.intrinsic_value?.summary.base_case_fair_value, null);
}

console.log('Runtime report validation checks passed');
