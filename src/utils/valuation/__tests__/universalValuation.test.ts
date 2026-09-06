import assert from 'node:assert/strict';
import { detectValuationModel } from '../modelSelector';
import { calculateRegionAwareCostOfCapital, detectRegion } from '../costOfCapital';
import { validateValuationAssumptions } from '../valuationValidator';
import { buildUniversalValuationData } from '../valuationStore';
import { MACRO_TERMINAL_GROWTH_DEFAULT_PCT, MACRO_TERMINAL_GROWTH_MAX_CAP_PCT } from '../constants';
import { buildRigorousDCFModel, calculateStrictDCFValue } from '../dcfMathEngine';
import { calculateDDMModel } from '../ddmCalculator';


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

  // FinTech / Digital Banking test (SOFI)
  const fintechResult = detectValuationModel({ company_profile: { sector: 'Technology', industry: 'Fintech' } }, 'SOFI');
  assert.equal(fintechResult.model_type, 'fintech_pe');
  assert.ok(fintechResult.reason_th.includes('ธนาคารดิจิทัลและ FinTech'));

  console.log('✅ Model Selector: All 7 sector classifications (including FinTech) PASSED!');
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
  const invalidData: any = {
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
  };


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

// 4. Macroeconomic Terminal Growth Cap & Single Source of Truth Tests
{
  console.log('➡️ Testing Macroeconomic Terminal Growth Cap (<= 3.0% GDP Pace)...');

  assert.equal(MACRO_TERMINAL_GROWTH_DEFAULT_PCT, 3.0);
  assert.equal(MACRO_TERMINAL_GROWTH_MAX_CAP_PCT, 3.0);

  // DCF model test: input with 3.5% terminal growth must be strictly capped at 3.0%
  const { dcfModel: cappedModel } = buildRigorousDCFModel({
    intrinsic_value: {
      current_price: 150,
      dcf_model: {
        assumptions: { wacc_pct: 10.0, terminal_growth_pct: 3.5, projection_years: 5 }
      } as any
    } as any
  }, 'NVDA');

  assert.equal(cappedModel.assumptions.terminal_growth_pct, 3.0, 'Terminal growth of 3.5% must be capped at 3.0% GDP anchor');

  // DCF model test: input missing terminal growth must default to 3.0%
  const { dcfModel: defaultModel } = buildRigorousDCFModel({
    intrinsic_value: {
      current_price: 150
    } as any
  }, 'NVDA');

  assert.equal(defaultModel.assumptions.terminal_growth_pct, 3.0, 'Missing terminal growth must default to 3.0%');

  // DDM model test: terminal growth must never exceed 3.0%
  const ddm = calculateDDMModel({
    key_indicators: { roe: 18.0 } as any,
    corporate_actions: { dividends: { summary: { annual_payout_usd: 4.0 } as any } } as any
  }, 'JPM');


  assert.ok(ddm.assumptions.terminal_growth_pct <= 3.0, 'DDM terminal growth must not exceed 3.0%');

  console.log('✅ Macroeconomic Terminal Growth Cap: All 3.0% GDP constraints PASSED!');
}

// 5. Small-Cap Distress WACC & Size Premium Tests (EOSE Fix)
{
  console.log('➡️ Testing Small-Cap Distress WACC & Empirical Size Premium (Kroll Framework)...');

  // EOSE: Micro-cap with negative gross margins and severe cash burn
  const eoseCoc = calculateRegionAwareCostOfCapital({
    intrinsic_value: { current_price: 3.5 } as any
  }, 'EOSE');

  assert.ok(eoseCoc.wacc_pct >= 16.0, `EOSE WACC (${eoseCoc.wacc_pct}%) must be >= 16.0% reflecting small-cap risk`);
  assert.equal(eoseCoc.size_premium_pct, 5.0, 'Micro-cap must have +5.0% Size Premium');
  assert.equal(eoseCoc.distress_premium_pct, 4.5, 'Negative gross margin / cash burn must have +4.5% Distress Premium');
  assert.equal(eoseCoc.is_distressed_or_unprofitable, true);

  // NVDA: Mega-cap must have 0% size premium and 0% distress premium
  const nvdaCoc = calculateRegionAwareCostOfCapital({
    company_profile: { market_cap: '3.2T' } as any
  }, 'NVDA');

  assert.equal(nvdaCoc.size_premium_pct, 0.0, 'Mega-cap must have 0% Size Premium');
  assert.equal(nvdaCoc.distress_premium_pct, 0.0, 'Profitable mega-cap must have 0% Distress Premium');
  assert.ok(nvdaCoc.wacc_pct >= 12.0 && nvdaCoc.wacc_pct <= 16.0, 'NVDA WACC should be ~14-15%');

  console.log('✅ Small-Cap Distress WACC & Size Premium PASSED!');
}

// 6. Cross-Model Discrepancy & Valuation Divergence Tests
{
  console.log('➡️ Testing DCF vs Relative Valuation Discrepancy Alert...');

  // Discrepancy test: DCF $16.35 vs Relative $3.10 (5.3x divergence!)
  const divergentAlerts = validateValuationAssumptions({
    current_price: 3.50,
    cost_of_capital: { wacc_pct: 18.5, is_distressed_or_unprofitable: true } as any,
    summary: { base_case_fair_value: 16.35 } as any,
    relative_valuation: { fair_value_per_share: 3.10 } as any
  } as any);

  const divergenceAlert = divergentAlerts.find(a => a.code === 'DCF_RELATIVE_DISCREPANCY_ALERT');
  assert.ok(divergenceAlert, 'Must trigger DCF_RELATIVE_DISCREPANCY_ALERT when DCF is > 2.5x Relative Valuation');
  assert.equal(divergenceAlert.type, 'warning');
  assert.ok(divergenceAlert.message_th.includes('5.3 เท่า') || divergenceAlert.message_th.includes('ขัดแย้ง'));

  console.log('✅ DCF vs Relative Valuation Discrepancy Alert PASSED!');
}

// 7. Multi-Sector Valuation Harmonization & FinTech Calibration (SOFI, JPM, XOM, SO, PLD, EOSE)
{
  console.log('➡️ Testing Multi-Sector Valuation Harmonization & FinTech (SOFI) Calibration...');

  // 1. SoFi Technologies (FinTech / Digital Bank)
  const sofiData = buildUniversalValuationData({
    intrinsic_value: { current_price: 17.89 } as any
  }, 'SOFI');
  assert.equal(sofiData.selected_model.model_type, 'fintech_pe');
  assert.ok(sofiData.summary.base_case_fair_value >= 18.0 && sofiData.summary.base_case_fair_value <= 23.0, 
    `SOFI Base Case ($${sofiData.summary.base_case_fair_value}) must be healthy (~$18–$23) and not collapsed by deposit deduction`);
  assert.ok(sofiData.summary.fair_value_range_low < sofiData.summary.base_case_fair_value, 'Bear must be lower than Base');
  assert.ok(sofiData.summary.base_case_fair_value < sofiData.summary.fair_value_range_high, 'Base must be lower than Bull');
  assert.ok(sofiData.relative_valuation.method.includes('FinTech'), 'Relative method should be tailored for FinTech');

  // 1.05 Anti-Drift Determinism: When AI outputs a wild guess ($28.00), engine dampens it near ~$21–$23
  const sofiDriftData = buildUniversalValuationData({
    intrinsic_value: { 
      current_price: 17.89,
      dcf_model: { scenarios: { base: { fair_value_per_share: 28.00 } } } as any
    } as any
  }, 'SOFI');
  assert.ok(sofiDriftData.summary.base_case_fair_value <= 23.0 && sofiDriftData.summary.base_case_fair_value >= 20.0,
    `SOFI Anti-Drift must prevent wild $28 swing and keep base case anchored near consensus ($21–$23), got $${sofiDriftData.summary.base_case_fair_value}`);

  // 1.1 Robinhood Markets (HOOD) - Decoupled DCF vs Relative Valuation & Bull Case Reality Grounding
  const hoodData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 122.10,
      relative_valuation: { fair_value_per_share: 68.00 } as any
    } as any
  }, 'HOOD');
  assert.equal(hoodData.selected_model.model_type, 'fintech_pe');
  assert.equal(hoodData.relative_valuation.fair_value_per_share, 68.00, 'HOOD Relative Valuation preserves peer multiple 68.00');
  assert.notEqual(hoodData.dcf_model.scenarios.base.fair_value_per_share, hoodData.relative_valuation.fair_value_per_share, 
    `HOOD DCF Base Case ($${hoodData.dcf_model.scenarios.base.fair_value_per_share}) must be decoupled from Relative Valuation ($${hoodData.relative_valuation.fair_value_per_share})`);
  assert.ok(Math.abs(hoodData.dcf_model.scenarios.base.fair_value_per_share - 68.00) > 2.0, 'HOOD DCF Base Case must have meaningful independent calculation');
  assert.ok(hoodData.dcf_model.scenarios.bull.fair_value_per_share > hoodData.current_price, 
    `HOOD Bull Case ($${hoodData.dcf_model.scenarios.bull.fair_value_per_share}) must show upside above current price ($${hoodData.current_price})`);

  // 2. Commercial Bank (JPM)
  const jpmData = buildUniversalValuationData({
    intrinsic_value: { current_price: 215.0 } as any,
    corporate_actions: { dividends: { summary: { annual_payout_usd: 4.60 } as any } } as any,
    key_indicators: { roe: 17.5 } as any
  }, 'JPM');
  assert.equal(jpmData.selected_model.model_type, 'ddm');
  assert.ok(jpmData.summary.base_case_fair_value > 0);
  assert.ok(jpmData.relative_valuation.method.includes('P/BV') || jpmData.relative_valuation.method.includes('ธนาคาร'));
  assert.notEqual(jpmData.summary.base_case_fair_value, jpmData.relative_valuation.fair_value_per_share, 'JPM Base Case must not equal Relative Valuation');

  // 3. Deep Cyclical (XOM)
  const xomData = buildUniversalValuationData({
    intrinsic_value: { current_price: 110.0 } as any
  }, 'XOM');
  assert.equal(xomData.selected_model.model_type, 'dcf_cyclical');
  assert.ok(xomData.summary.base_case_fair_value > 0);
  assert.notEqual(xomData.summary.base_case_fair_value, xomData.relative_valuation.fair_value_per_share, 'XOM Base Case must not equal Relative Valuation');

  // 4. Regulated Utility (SO)
  const soData = buildUniversalValuationData({
    intrinsic_value: { current_price: 85.0 } as any
  }, 'SO');
  assert.equal(soData.selected_model.model_type, 'dcf_gordon');
  assert.ok(soData.cost_of_capital.wacc_pct < 12.0, `Regulated utility WACC (${soData.cost_of_capital.wacc_pct}%) must reflect low asset risk`);
  assert.notEqual(soData.summary.base_case_fair_value, soData.relative_valuation.fair_value_per_share, 'SO Base Case must not equal Relative Valuation');

  // 5. REIT (PLD)
  const pldData = buildUniversalValuationData({
    intrinsic_value: { current_price: 115.0 } as any
  }, 'PLD');
  assert.equal(pldData.selected_model.model_type, 'reit_affo');
  assert.notEqual(pldData.summary.base_case_fair_value, pldData.relative_valuation.fair_value_per_share, 'PLD Base Case must not equal Relative Valuation');

  // 6. Speculative Small-Cap (EOSE) - Decoupled DCF vs Relative Valuation
  const eoseData = buildUniversalValuationData({
    intrinsic_value: { 
      current_price: 3.88,
      relative_valuation: { fair_value_per_share: 4.50 } as any,
      dcf_model: {
        assumptions: { wacc_pct: 20.4, terminal_growth_pct: 2.5 },
        scenarios: {
          base: { revenue_cagr_pct: 38.0, terminal_margin_pct: 4.5 }
        }
      } as any
    } as any
  }, 'EOSE');
  assert.equal(eoseData.selected_model.model_type, 'relative_only');
  assert.ok(eoseData.cost_of_capital.wacc_pct >= 16.0);
  assert.equal(eoseData.relative_valuation.fair_value_per_share, 4.50, 'Relative valuation must preserve peer multiple value');
  assert.notEqual(eoseData.dcf_model.scenarios.base.fair_value_per_share, eoseData.relative_valuation.fair_value_per_share, 'DCF Base Case must be decoupled and calculated independently from Relative Valuation');
  assert.ok(eoseData.dcf_model.scenarios.base.fair_value_per_share > 3.5 && eoseData.dcf_model.scenarios.base.fair_value_per_share < 4.45, `DCF Base Case (${eoseData.dcf_model.scenarios.base.fair_value_per_share}) should be grounded around $4.00–$4.30`);


  // 7. TSLA Bear Case Reality Grounding
  const tslaData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 354.0,
      dcf_model: {
        scenarios: {
          bear: { key_assumption_note: 'Robotaxi ล่าช้าเข้าปี 2028' } as any
        }
      } as any
    } as any
  }, 'TSLA');
  assert.ok(tslaData.dcf_model.scenarios.bear.key_assumption_note.includes('ขยายสเกลเชิงพาณิชย์ได้ช้ากว่าที่บริษัทเคยประกาศไว้มาก'));
  assert.ok(!tslaData.dcf_model.scenarios.bear.key_assumption_note.includes('ล่าช้าเข้าปี 2028'));

  // 8. Universal Cross-Sector Anti-Drift Calibration Tests
  // (Verifying that wild AI drift is universally clamped and re-routed to Bull Case across ALL sectors)

  // 8.1 Enterprise Tech / AI (PLTR - Standard DCF): Wild $180 input clamped to consensus corridor ($115–$135)
  const pltrDriftData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 155.0,
      dcf_model: {
        scenarios: {
          base: { fair_value_per_share: 180.00 }
        }
      } as any
    } as any
  }, 'PLTR');
  assert.ok(pltrDriftData.summary.base_case_fair_value <= 135.0, 
    `PLTR Universal Anti-Drift must clamp wild $180 Base Case down to consensus corridor (<= $135), got $${pltrDriftData.summary.base_case_fair_value}`);
  assert.ok(pltrDriftData.summary.fair_value_range_high >= 180.0,
    `PLTR Bull Case must capture the $180 street-high target, got $${pltrDriftData.summary.fair_value_range_high}`);

  // 8.2 CleanTech / Pre-Revenue (EOSE - Relative Only): Wild $9.00 input clamped to consensus corridor ($4.00–$4.60)
  const eoseDriftData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 3.88,
      relative_valuation: { fair_value_per_share: 4.50 } as any,
      dcf_model: {
        scenarios: {
          base: { fair_value_per_share: 9.00 }
        }
      } as any
    } as any
  }, 'EOSE');
  assert.ok(eoseDriftData.summary.base_case_fair_value <= 4.60,
    `EOSE Universal Anti-Drift must clamp wild $9.00 Base Case down to consensus corridor (<= $4.60), got $${eoseDriftData.summary.base_case_fair_value}`);
  assert.ok(eoseDriftData.summary.fair_value_range_high >= 9.00,
    `EOSE Bull Case must capture the $9.00 blue sky target, got $${eoseDriftData.summary.fair_value_range_high}`);

  // 8.3 Commercial Bank (JPM - DDM): Wild $450 input clamped to fundamental corridor (<= $295)
  const jpmDriftData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 215.0,
      dcf_model: {
        scenarios: {
          base: { fair_value_per_share: 450.00 }
        }
      } as any
    } as any,
    corporate_actions: { dividends: { summary: { annual_payout_usd: 4.60 } as any } } as any,
    key_indicators: { roe: 17.5 } as any
  }, 'JPM');
  assert.ok(jpmDriftData.summary.base_case_fair_value <= 295.0,
    `JPM Universal Anti-Drift must clamp wild $450 Base Case down to fundamental corridor (<= $295), got $${jpmDriftData.summary.base_case_fair_value}`);
  assert.ok(jpmDriftData.summary.fair_value_range_high >= 450.0,
    `JPM Bull Case must capture the $450 street-high target, got $${jpmDriftData.summary.fair_value_range_high}`);

  // 8.4 Deep Cyclical (XOM - Cyclical DCF): Wild $165 input clamped to mid-cycle corridor ($105–$120)
  const xomDriftData = buildUniversalValuationData({
    intrinsic_value: {
      current_price: 110.0,
      dcf_model: {
        scenarios: {
          base: { fair_value_per_share: 165.00 }
        }
      } as any
    } as any
  }, 'XOM');
  assert.ok(xomDriftData.summary.base_case_fair_value <= 120.0,
    `XOM Universal Anti-Drift must clamp wild $165 Base Case down to mid-cycle corridor (<= $120), got $${xomDriftData.summary.base_case_fair_value}`);
  assert.ok(xomDriftData.summary.fair_value_range_high >= 165.0,
    `XOM Bull Case must capture the $165 peak-cycle target, got $${xomDriftData.summary.fair_value_range_high}`);

  console.log('✅ Multi-Sector Valuation Harmonization & Universal Cross-Sector Anti-Drift PASSED!');
}

// 8. Robust DCF Simulator & Monotonicity Extremes Tests
{
  console.log('➡️ Testing Robust DCF Simulator & Extreme Parameter Invariants...');

  const startingRevM = 97600;
  const sharesM = 3950;
  const netCashM = 27280;
  const margin = 18.0;

  // Test 1: CAGR Monotonicity at high CAGR (>150% and 200%)
  const val101 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 12.88, 3.0, 101.9, margin, 5);
  const val153 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 12.88, 3.0, 153.7, margin, 5);
  const val200 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 12.88, 3.0, 200.0, margin, 5);
  assert.ok(val153 > val101, `Fair value at 153.7% CAGR ($${val153}) MUST be strictly greater than at 101.9% ($${val101})`);
  assert.ok(val200 > val153, `Fair value at 200% CAGR ($${val200}) MUST be strictly greater than at 153.7% ($${val153})`);

  // Test 2: Low WACC (down to 3%) does not collapse to dummy $2.49
  const valWacc3 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 3.0, 3.0, 14.5, margin, 5);
  const valWacc12 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 12.88, 3.0, 14.5, margin, 5);
  assert.ok(valWacc3 > valWacc12, `Fair value at 3% WACC ($${valWacc3}) MUST be greater than at 12.88% WACC ($${valWacc12})`);
  assert.ok(valWacc3 > 100, `Fair value at 3% WACC ($${valWacc3}) MUST NOT collapse to dummy penny value`);

  // Test 3: Terminal Growth >= WACC (e.g. g=5% or 8% when WACC=3%) preserves positivity and monotonicity
  const valG5 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 3.0, 5.0, 14.5, margin, 5);
  const valG8 = calculateStrictDCFValue(startingRevM, sharesM, netCashM, 3.0, 8.0, 14.5, margin, 5);
  assert.ok(Number.isFinite(valG5) && valG5 > valWacc3, `Higher terminal growth ($${valG5}) must be finite and > at 3% g ($${valWacc3})`);
  assert.ok(Number.isFinite(valG8) && valG8 >= valG5, `Terminal growth 8% ($${valG8}) must be finite and >= at 5% g ($${valG5})`);

  console.log('✅ Robust DCF Simulator Monotonicity & Boundary Invariants PASSED!');
}

console.log('🎉 ALL UNIVERSAL VALUATION ENGINE TESTS PASSED SUCCESSFULLY!');


