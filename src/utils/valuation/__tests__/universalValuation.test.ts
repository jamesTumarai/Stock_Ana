import assert from 'node:assert/strict';
import { buildRigorousDCFModel, calculateStrictDCFValue } from '../dcfMathEngine';
import { buildUniversalValuationData } from '../valuationStore';
import { calculateRelativeOnlyModel } from '../relativeEngine';
import { calculateDDMModel } from '../ddmCalculator';
import { calculateREITModel } from '../reitCalculator';
import { calculateCyclicalModel } from '../cyclicalNormalizer';
import { calculateRegionAwareCostOfCapital } from '../costOfCapital';
import { detectValuationModel } from '../modelSelector';

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

const eligibleSecEnvelope = () => ({
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
  const { inputs, dcfModel } = buildRigorousDCFModel(disclosedReport, 'TEST');
  assert.equal(inputs.isValid, true);
  assert.equal(inputs.startingRevenueM, 460);
  assert.equal(inputs.sharesOutstandingM, 100);
  assert.equal(inputs.netCashM, -4);
  assert.equal(inputs.sourcePeriod, 'Q1 2025–Q4 2025');
  assert.equal(inputs.financialDataSource, 'report_statements');
  assert.notEqual(dcfModel.scenarios.base.fair_value_per_share, 999, 'DCF must be recomputed rather than retain an AI target');
  assert.ok(typeof dcfModel.scenarios.base.fair_value_per_share === 'number' && Number.isFinite(dcfModel.scenarios.base.fair_value_per_share));
}

{
  const secBacked = structuredClone(disclosedReport);
  secBacked.sec_verification = eligibleSecEnvelope();
  // Deliberately make report financials different. An eligible SEC envelope must be used as one
  // complete financial source rather than mixing these statement values into the DCF.
  secBacked.financial_statements.income_statement.revenue = [1, 1, 1, 1];
  secBacked.financial_statements.balance_sheet.cash_and_equivalents = [1, 1, 1, 1];
  secBacked.financial_statements.balance_sheet.short_term_investments = [1, 1, 1, 1];
  secBacked.financial_statements.balance_sheet.total_debt = [999, 999, 999, 999];
  secBacked.company_profile.shares_outstanding = '999M';
  const { inputs } = buildRigorousDCFModel(secBacked, 'TEST');
  assert.equal(inputs.isValid, true);
  assert.equal(inputs.financialDataSource, 'sec_verified');
  assert.equal(inputs.startingRevenueM, 1000);
  assert.equal(inputs.sharesOutstandingM, 80);
  assert.equal(inputs.netCashM, 20);
  assert.equal(inputs.sourcePeriod, 'Q1 2026–Q4 2026');
  assert.equal(inputs.financialDataAsOf, '2026-12-31');
  assert.equal(inputs.sharesAsOf, '2027-01-20');
}

{
  const partialSec = structuredClone(disclosedReport);
  const envelope = eligibleSecEnvelope();
  envelope.status = 'verified_partial';
  envelope.dcf_coverage.eligible = false;
  envelope.dcf_financial_inputs.eligible = false;
  envelope.dcf_financial_inputs.issues = [{ code: 'SEC_TOTAL_DEBT_UNAVAILABLE', field: 'balance_sheet.total_debt', message: 'Missing debt.' }];
  partialSec.sec_verification = envelope;
  const { inputs } = buildRigorousDCFModel(partialSec, 'TEST');
  assert.equal(inputs.isValid, true, 'Partial SEC coverage should use the existing complete report-statement path without mixing SEC values');
  assert.equal(inputs.financialDataSource, 'report_statements');
  assert.equal(inputs.startingRevenueM, 460);
  assert.equal(inputs.sharesOutstandingM, 100);
  assert.equal(inputs.netCashM, -4);
}

{
  const malformedEligible = structuredClone(disclosedReport);
  const envelope = eligibleSecEnvelope();
  envelope.dcf_financial_inputs.net_cash_m = 999; // no longer reconciles with cash + investments - debt
  malformedEligible.sec_verification = envelope;
  const { inputs, dcfModel } = buildRigorousDCFModel(malformedEligible, 'TEST');
  assert.equal(inputs.isValid, false, 'Malformed SEC data that claims eligibility must fail closed rather than silently fall back');
  assert.equal(inputs.financialDataSource, 'sec_verified');
  assert.ok(inputs.missingFields?.includes('runtime-valid SEC verified DCF financial inputs'));
  assert.equal(dcfModel.scenarios.base.fair_value_per_share, null);
}

{
  const secWithMarketPrice = structuredClone(disclosedReport);
  secWithMarketPrice.sec_verification = eligibleSecEnvelope();
  secWithMarketPrice.market_snapshot = {
    ticker: 'TEST',
    price: 55,
    currency: 'USD',
    provider: 'TEST',
    asOf: '2026-09-10T00:00:00.000Z',
  };
  const { inputs } = buildRigorousDCFModel(secWithMarketPrice, 'TEST');
  assert.equal(inputs.currentPrice, 55);
  assert.equal(inputs.priceSource, 'market_snapshot', 'SEC financials must not replace the independent live market-price source');
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
  assert.equal(dcfModel.scenarios.base.fair_value_per_share, null);

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

{
  // Bank / Financial Institution (JPM) using DDM without requiring generic operating FCFF
  const jpmReport: any = {
    ticker: 'JPM',
    company_profile: {
      sector: 'Financial Services',
      industry: 'Banks - Diversified',
      stock_price: 200,
    },
    intrinsic_value: {
      current_price: 200,
      selected_model: {
        model_type: 'ddm',
        model_name_th: 'Dividend Discount Model (DDM) & Residual Income',
        model_name_en: 'Dividend Discount Model & Residual Income',
        sector_category: 'Financial Institutions',
      },
      ddm_model: {
        assumptions: {
          cost_of_equity_pct: 10,
          terminal_growth_pct: 3,
          current_dividend_per_share: 5.0,
          current_payout_ratio_pct: 35,
          current_roe_pct: 16,
        },
        book_value_per_share: 100,
      },
    },
  };

  const valuation = buildUniversalValuationData(jpmReport, 'JPM');
  assert.ok(valuation !== undefined, 'Bank with valid DDM inputs must evaluate successfully');
  assert.equal(valuation.selected_model?.model_type, 'ddm');
  assert.ok(valuation.ddm_model !== undefined);
  // Expected base: 5.0 * 1.03 / (0.10 - 0.03) = 5.15 / 0.07 = 73.57
  assert.equal(valuation.ddm_model?.scenarios.base.fair_value_per_share, 73.57);
  assert.equal(valuation.summary?.base_case_fair_value, 73.57);
  assert.equal(valuation.summary?.fair_value_range_low, valuation.ddm_model?.scenarios.bear.fair_value_per_share);
  assert.equal(valuation.summary?.fair_value_range_high, valuation.ddm_model?.scenarios.bull.fair_value_per_share);
  assert.equal(valuation.summary?.verdict_text, 'Overvalued'); // 73.57 vs 200
  // Residual income should be calculated: BVPS + BVPS * (ROE - r) / (r - g) = 100 + 100 * (0.16 - 0.10) / (0.07) = 100 + 6 / 0.07 = 185.71
  assert.equal(valuation.ddm_model?.residual_income_fair_value, 185.71);
}

{
  // Bank with terminal growth g >= Ke must fail closed
  const invalidGrowthReport: any = {
    ticker: 'JPM',
    company_profile: { sector: 'Financial Services', industry: 'Banks', stock_price: 200 },
    intrinsic_value: {
      current_price: 200,
      ddm_model: {
        assumptions: {
          cost_of_equity_pct: 8,
          terminal_growth_pct: 8, // g == Ke -> infinite value -> fail closed
          current_dividend_per_share: 5.0,
        },
      },
    },
  };
  assert.equal(calculateDDMModel(invalidGrowthReport), undefined, 'g >= Ke in DDM must fail closed');
  assert.equal(buildUniversalValuationData(invalidGrowthReport, 'JPM'), undefined, 'buildUniversalValuationData must fail closed when DDM fails');
}

{
  // Bank with missing dividend and no ROE/BVPS to derive it must fail closed
  const missingDividendReport: any = {
    ticker: 'JPM',
    company_profile: { sector: 'Financial Services', industry: 'Banks', stock_price: 200 },
    intrinsic_value: {
      current_price: 200,
      ddm_model: {
        assumptions: {
          cost_of_equity_pct: 10,
          terminal_growth_pct: 3,
        },
      },
    },
  };
  assert.equal(calculateDDMModel(missingDividendReport), undefined, 'Missing dividend in DDM must fail closed');
  assert.equal(buildUniversalValuationData(missingDividendReport, 'JPM'), undefined);
}

{
  // Bank with missing payout ratio does NOT assume 50%; preserves null
  const noPayoutReport: any = {
    ticker: 'JPM',
    company_profile: { sector: 'Financial Services', industry: 'Banks', stock_price: 200 },
    intrinsic_value: {
      current_price: 200,
      ddm_model: {
        assumptions: {
          cost_of_equity_pct: 10,
          terminal_growth_pct: 3,
          current_dividend_per_share: 5.0,
        },
      },
    },
  };
  const ddm = calculateDDMModel(noPayoutReport);
  assert.ok(ddm !== undefined);
  assert.equal(ddm.assumptions.current_payout_ratio_pct, null, 'Must not assume payout=0 or payout=50');
  assert.equal(ddm.scenarios.base.terminal_payout_ratio_pct, null, 'Must not assume payout=50 for terminal');
  assert.equal(ddm.scenarios.bear.source_type, 'system_illustrative');
  assert.equal(ddm.scenarios.bull.source_type, 'system_illustrative');
}

{
  // Sector valuation models are documented as sourced_non_canonical, standard DCF as canonical_dcf
  const bankModel = detectValuationModel({ company_profile: { sector: 'Financial Services', industry: 'Banks' } }, 'JPM');
  assert.equal(bankModel.model_type, 'ddm');
  assert.equal(bankModel.canonical_status, 'sourced_non_canonical');

  const reitModel = detectValuationModel({ company_profile: { sector: 'Real Estate', industry: 'REIT' } }, 'PLD');
  assert.equal(reitModel.model_type, 'reit_affo');
  assert.equal(reitModel.canonical_status, 'sourced_non_canonical');

  const cyclicalModel = detectValuationModel({ company_profile: { sector: 'Energy', industry: 'Oil & Gas' } }, 'XOM');
  assert.equal(cyclicalModel.model_type, 'dcf_cyclical');
  assert.equal(cyclicalModel.canonical_status, 'sourced_non_canonical');

  const standardModel = detectValuationModel({ company_profile: { sector: 'Technology', industry: 'Consumer Electronics' } }, 'AAPL');
  assert.equal(standardModel.model_type, 'dcf_standard');
  assert.equal(standardModel.canonical_status, 'canonical_dcf');
}

{
  // REIT (PLD) using AFFO model
  const reitReport: any = {
    ticker: 'PLD',
    company_profile: { sector: 'Real Estate', industry: 'Industrial REIT', stock_price: 120 },
    intrinsic_value: {
      current_price: 120,
      selected_model: {
        model_type: 'reit_affo',
        model_name_th: 'FFO / AFFO Multiple Valuation',
        model_name_en: 'FFO / AFFO Multiple Valuation',
        sector_category: 'REITs',
      },
      reit_model: {
        sub_sector: 'Industrial',
        assumptions: {
          current_ffo_per_share: 5.5,
          current_affo_per_share: 4.8,
          peer_median_affo_multiple: 26,
        },
        scenarios: {
          bear: { affo_multiple: 22, affo_growth_cagr_pct: 2, fair_value_per_share: 105.6, key_assumption_note: 'Bear multiple 22x' },
          base: { affo_multiple: 26, affo_growth_cagr_pct: 5, fair_value_per_share: 124.8, key_assumption_note: 'Base multiple 26x' },
          bull: { affo_multiple: 30, affo_growth_cagr_pct: 8, fair_value_per_share: 144.0, key_assumption_note: 'Bull multiple 30x' },
        },
      },
    },
  };
  const reitValuation = buildUniversalValuationData(reitReport, 'PLD');
  assert.ok(reitValuation !== undefined, 'REIT with valid AFFO model must evaluate successfully');
  assert.equal(reitValuation.selected_model?.model_type, 'reit_affo');
  assert.equal(reitValuation.summary?.base_case_fair_value, 124.8);
  assert.equal(reitValuation.summary?.fair_value_range_low, 105.6);
  assert.equal(reitValuation.summary?.fair_value_range_high, 144.0);
}

{
  // FinTech (SOFI) using Relative Valuation
  const fintechReport: any = {
    ticker: 'SOFI',
    company_profile: { sector: 'Financial Services', industry: 'Credit Services', stock_price: 15 },
    intrinsic_value: {
      current_price: 15,
      selected_model: {
        model_type: 'fintech_pe',
        model_name_th: 'FinTech Platform & Residual Income',
        model_name_en: 'FinTech Platform Model',
        sector_category: 'FinTech / Digital Banking',
      },
      relative_valuation: {
        method: 'Forward P/E & Platform Multiple',
        peer_multiple_used: 18.5,
        metric_applied: 'Forward EPS $0.92',
        fair_value_per_share: 17.02,
      },
      summary: {
        fair_value_range_low: 14.5,
        base_case_fair_value: 17.02,
        fair_value_range_high: 20.0,
        margin_of_safety_pct: 13.5,
        verdict_text: 'Fairly Valued',
      },
    },
  };
  const fintechValuation = buildUniversalValuationData(fintechReport, 'SOFI');
  assert.ok(fintechValuation !== undefined, 'FinTech with valid relative valuation must evaluate successfully');
  assert.equal(fintechValuation.selected_model?.model_type, 'fintech_pe');
  assert.equal(fintechValuation.summary?.base_case_fair_value, 17.02);
  assert.equal(fintechValuation.summary?.fair_value_range_low, 14.5, 'Sourced explicit range low must be preserved');
  assert.equal(fintechValuation.summary?.fair_value_range_high, 20.0, 'Sourced explicit range high must be preserved');
}

{
  // FinTech (SOFI) with point value only (NO source range) - must NOT synthesize +/-15% range
  const fintechPointOnly: any = {
    ticker: 'SOFI',
    company_profile: { sector: 'Financial Services', industry: 'Credit Services', stock_price: 15 },
    intrinsic_value: {
      current_price: 15,
      selected_model: {
        model_type: 'fintech_pe',
        model_name_th: 'FinTech Platform & Residual Income',
        model_name_en: 'FinTech Platform Model',
        sector_category: 'FinTech / Digital Banking',
      },
      relative_valuation: {
        method: 'Forward P/E & Platform Multiple',
        peer_multiple_used: 18.5,
        metric_applied: 'Forward EPS $0.92',
        fair_value_per_share: 17.02,
      },
      // Explicitly NO summary range
    },
  };
  const val = buildUniversalValuationData(fintechPointOnly, 'SOFI');
  assert.ok(val !== undefined);
  assert.equal(val.summary?.base_case_fair_value, 17.02);
  assert.equal(val.summary?.fair_value_range_low, null, 'fintech_pe point value without source range must have null low range');
  assert.equal(val.summary?.fair_value_range_high, null, 'fintech_pe point value without source range must have null high range');
}

{
  // relative_only model with point value only (NO source range) - must NOT synthesize +/-15% range
  const relativePointOnly: any = {
    ticker: 'RIVN',
    company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', stock_price: 12 },
    intrinsic_value: {
      current_price: 12,
      selected_model: {
        model_type: 'relative_only',
        model_name_th: 'แบบจำลองมูลค่าเชิงเปรียบเทียบเท่านั้น',
        model_name_en: 'Relative Valuation Only',
      },
      relative_only_model: {
        methodology: 'Peer Multiples EV/Sales',
        primary_metric: 'EV/Sales',
        peer_median_multiple: 2.5,
        applied_company_metric_value: 5000,
        implied_enterprise_value_b: 12.5,
        implied_equity_value_b: 11.5,
        fair_value_per_share: 25.5,
        peers_evaluated: [
          { ticker: 'LCID', name: 'Lucid Group', market_cap_b: 7.2, ev_revenue_multiple: 2.3, multiple_used: 2.3, metric_type: 'EV/Sales' },
          { ticker: 'NIO', name: 'NIO Inc', market_cap_b: 9.1, ev_revenue_multiple: 2.7, multiple_used: 2.7, metric_type: 'EV/Sales' },
        ],
      },
    },
  };
  const val = buildUniversalValuationData(relativePointOnly, 'RIVN');
  assert.ok(val !== undefined);
  assert.equal(val.summary?.base_case_fair_value, 25.5);
  assert.equal(val.summary?.fair_value_range_low, null, 'relative_only point value without source range must have null low range');
  assert.equal(val.summary?.fair_value_range_high, null, 'relative_only point value without source range must have null high range');
}

console.log('Valuation integrity checks passed');
