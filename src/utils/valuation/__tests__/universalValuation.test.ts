import assert from 'node:assert/strict';
import { detectValuationModel } from '../modelSelector';
import { calculateRegionAwareCostOfCapital, detectRegion } from '../costOfCapital';
import { validateValuationAssumptions } from '../valuationValidator';
import { buildUniversalValuationData } from '../valuationStore';

console.log('🚀 Running Universal Valuation Engine Test Suite...');

// 1. Model Selector Tests
{
  console.log('➡️ Testing Model Selector...');

  // Bank test
  const bankResult = detectValuationModel({ company_profile: { sector: 'Financial Services', industry: 'Diversified Banking' } }, 'JPM');
  assert.equal(bankResult.model_type, 'ddm');
  assert.ok(bankResult.reason_th.includes('หนี้สินและเงินฝากเป็นวัตถุดิบ'));

  // REIT test
  const reitResult = detectValuationModel({ company_profile: { sector: 'Real Estate', industry: 'Industrial REIT' } }, 'PLD');
  assert.equal(reitResult.model_type, 'reit_affo');
  assert.ok(reitResult.reason_th.includes('AFFO'));

  // Cyclical test
  const cyclicalResult = detectValuationModel({ company_profile: { sector: 'Energy', industry: 'Oil & Gas Integrated' } }, 'XOM');
  assert.equal(cyclicalResult.model_type, 'dcf_cyclical');
  assert.ok(cyclicalResult.reason_th.includes('วัฏจักร'));

  // Pre-revenue / Negative FCF test
  const preRevResult = detectValuationModel({ 
    financial_statements: { 
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: { revenue: [10, 20], net_income: [-50, -60] },
      balance_sheet: {},
      cash_flow: { free_cash_flow: [-500, -800, -1200, -900] } 
    } 
  }, 'RIVN');
  assert.equal(preRevResult.model_type, 'relative_only');
  assert.ok(preRevResult.reason_th.includes('Relative Valuation'));

  // Super Growth test
  const growthResult = detectValuationModel({ 
    financial_statements: { 
      periods: ['Q1', 'Q2'],
      income_statement: { revenue: [1000, 1300], net_income: [100, 200], yoy_revenue_growth_pct: [28.5] },
      balance_sheet: {},
      cash_flow: { free_cash_flow: [200, 350] }
    } 
  }, 'TSLA');
  assert.equal(growthResult.model_type, 'dcf_multistage');

  // Mature Value test
  const matureResult = detectValuationModel({ company_profile: { sector: 'Utilities', industry: 'Regulated Electric' } }, 'SO');
  assert.equal(matureResult.model_type, 'dcf_gordon');

  console.log('✅ Model Selector: All 6 sector classifications PASSED!');
}

// 2. Region-aware Cost of Capital Tests
{
  console.log('➡️ Testing Region-Aware Cost of Capital...');

  // Thai Stock
  const thaiRegion = detectRegion('PTT.BK');
  assert.equal(thaiRegion.currency, 'THB');
  assert.equal(thaiRegion.riskFreeRate, 2.65);
  assert.equal(thaiRegion.benchmarkIndex, 'SET Index');

  const thaiCoc = calculateRegionAwareCostOfCapital({}, 'KBANK.BK');
  assert.equal(thaiCoc.currency, 'THB');
  assert.equal(thaiCoc.risk_free_rate_pct, 2.65);
  assert.equal(thaiCoc.beta_benchmark_index, 'SET Index');

  // US Stock
  const usCoc = calculateRegionAwareCostOfCapital({}, 'TSLA');
  assert.equal(usCoc.currency, 'USD');
  assert.equal(usCoc.risk_free_rate_pct, 4.25);
  assert.equal(usCoc.beta_benchmark_index, 'S&P 500');
  assert.ok(usCoc.cost_of_equity_pct > 8.0);

  // Japan Stock
  const jpRegion = detectRegion('7203.T');
  assert.equal(jpRegion.currency, 'JPY');
  assert.equal(jpRegion.riskFreeRate, 1.05);
  assert.ok(jpRegion.benchmarkIndex.includes('TOPIX'));

  console.log('✅ Cost of Capital: All regional benchmarks (TH, US, JP) PASSED!');
}

// 3. Valuation Validation Tests
{
  console.log('➡️ Testing Valuation Sanity & Validation Alerts...');

  // Terminal Growth > WACC
  const invalidData = buildUniversalValuationData({
    ticker: 'TEST',
    intrinsic_value: {
      current_price: 100,
      dcf_model: {
        assumptions: { wacc_pct: 7.0, terminal_growth_pct: 12.0, projection_years: 5 },
        scenarios: {
          bear: { revenue_cagr_pct: 10, terminal_margin_pct: 10, fair_value_per_share: 80, key_assumption_note: '' },
          base: { revenue_cagr_pct: 20, terminal_margin_pct: 15, fair_value_per_share: 100, key_assumption_note: '' },
          bull: { revenue_cagr_pct: 30, terminal_margin_pct: 20, fair_value_per_share: 130, key_assumption_note: '' }
        }
      },
      summary: { fair_value_range_low: 80, fair_value_range_high: 130, base_case_fair_value: 100, margin_of_safety_pct: 0, verdict_text: '' }
    }
  });

  const alerts = validateValuationAssumptions(invalidData);
  const err = alerts.find(a => a.code === 'TERMINAL_GROWTH_EXCEEDS_DISCOUNT_RATE');
  assert.ok(err, 'Should flag error for Terminal Growth >= WACC');
  assert.equal(err.type, 'error');

  // Fair Value Deviation > 40%
  const devData = buildUniversalValuationData({
    ticker: 'TEST',
    intrinsic_value: {
      current_price: 100,
      dcf_model: {
        assumptions: { wacc_pct: 9.0, terminal_growth_pct: 2.5, projection_years: 5 },
        scenarios: {
          bear: { revenue_cagr_pct: 10, terminal_margin_pct: 10, fair_value_per_share: 150, key_assumption_note: '' },
          base: { revenue_cagr_pct: 20, terminal_margin_pct: 15, fair_value_per_share: 180, key_assumption_note: '' },
          bull: { revenue_cagr_pct: 30, terminal_margin_pct: 20, fair_value_per_share: 220, key_assumption_note: '' }
        }
      },
      summary: { fair_value_range_low: 150, fair_value_range_high: 220, base_case_fair_value: 180, margin_of_safety_pct: 80, verdict_text: '' }
    }
  });

  const devAlerts = validateValuationAssumptions(devData);
  const devWarn = devAlerts.find(a => a.code === 'HIGH_VALUATION_DEVIATION');
  assert.ok(devWarn, 'Should flag warning for deviation > 40%');
  assert.equal(devWarn.type, 'warning');

  console.log('✅ Validation & Sanity Engine: All error/warning triggers PASSED!');
}

console.log('🎉 ALL UNIVERSAL VALUATION ENGINE TESTS PASSED SUCCESSFULLY!');
