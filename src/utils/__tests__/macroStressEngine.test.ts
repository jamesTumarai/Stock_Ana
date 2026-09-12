import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMacroStressScenarios,
  type MacroStressScenario,
} from '../macroStressEngine';
import { calculateStrictDCFValue } from '../valuation/dcfMathEngine';

describe('macroStressEngine', () => {
  const baseCanonicalModel = {
    ticker: 'MSFT',
    startingRevenueM: 245000,
    sharesOutstandingM: 7400,
    netCashM: 20000,
    waccPct: 9.0,
    terminalGrowthPct: 3.0,
    revenueCagrPct: 12.0,
    fcfMarginPct: 35.0,
    projectionYears: 5,
    currentPrice: 360,
  };

  it('generates standard institutional stress scenarios using canonical DCF recalculation', () => {
    const results = evaluateMacroStressScenarios(baseCanonicalModel, false);
    assert.ok(Array.isArray(results));
    assert.equal(results.isAvailable, true);
    assert.equal(results.length, 5);
    assert.ok(results.methodologyNote?.includes('illustrative stress assumptions'));

    const scenarioIds = results.map((r) => r.id);
    assert.ok(scenarioIds.includes('base_case'));
    assert.ok(scenarioIds.includes('stagflation_shock'));
    assert.ok(scenarioIds.includes('recession_demand_drop'));
    assert.ok(scenarioIds.includes('ai_productivity_wave'));
    assert.ok(scenarioIds.includes('rates_higher_for_longer'));
  });

  it('correctly calculates stagflation stress penalty via strict DCF recalculation', () => {
    const results = evaluateMacroStressScenarios(baseCanonicalModel, false);
    const stagflation = results.find((r) => r.id === 'stagflation_shock');
    assert.ok(stagflation);

    // Expected value recalculated via calculateStrictDCFValue:
    // WACC 10.5%, TG 2.5%, Growth 9.0%, Margin 33.0%
    const expectedStressedFv = calculateStrictDCFValue(
      245000,
      7400,
      20000,
      10.5,
      2.5,
      9.0,
      33.0,
      5
    );

    assert.equal(stagflation.stressedFairValue, expectedStressedFv);
    assert.ok(stagflation.stressedFairValue < (results.baseFairValue ?? 0));
    assert.ok(stagflation.fairValueChangePct < 0);
  });

  it('correctly calculates AI productivity wave upside via strict DCF recalculation', () => {
    const results = evaluateMacroStressScenarios(baseCanonicalModel, false);
    const aiWave = results.find((r) => r.id === 'ai_productivity_wave');
    assert.ok(aiWave);

    // Expected value recalculated via calculateStrictDCFValue:
    // WACC 8.75%, TG 3.3%, Growth 16.0%, Margin 37.5%
    const expectedStressedFv = calculateStrictDCFValue(
      245000,
      7400,
      20000,
      8.75,
      3.3,
      16.0,
      37.5,
      5
    );

    assert.equal(aiWave.stressedFairValue, expectedStressedFv);
    assert.ok(aiWave.stressedFairValue > (results.baseFairValue ?? 0));
    assert.ok(aiWave.fairValueChangePct > 0);
  });

  it('enforces sector guard and fails closed for non-FCFF companies', () => {
    const sofiReport: any = {
      ticker: 'SOFI',
      company_profile: {
        overview: {
          symbol: 'SOFI',
          industry: 'Consumer Finance',
          sector: 'Financial Services',
        },
      },
      intrinsic_value: {
        model_selection: {
          selected_model: 'fintech_pe',
        },
      },
    };

    const results = evaluateMacroStressScenarios(sofiReport, false, 'SOFI');
    assert.equal(results.isAvailable, false);
    assert.equal(results.length, 0);
    assert.ok(results.reason?.includes('non-FCFF'));
  });

  it('fails closed when canonical inputs are incomplete', () => {
    const incompleteModel = {
      ticker: 'AAPL',
      // Missing starting revenue and shares
      waccPct: 9.0,
      terminalGrowthPct: 3.0,
      revenueCagrPct: 10.0,
      fcfMarginPct: 25.0,
    };

    const results = evaluateMacroStressScenarios(incompleteModel as any, false);
    assert.equal(results.isAvailable, false);
    assert.equal(results.length, 0);
    assert.ok(results.reason?.includes('missing verified valuation inputs'));
  });

  it('handles bilingual Thai/English titles and descriptions', () => {
    const resultsTh = evaluateMacroStressScenarios(baseCanonicalModel, true);
    const stagflationTh = resultsTh.find((r) => r.id === 'stagflation_shock');
    assert.ok(stagflationTh);
    assert.ok(stagflationTh.name.includes('ภาวะเงินเฟ้อสูง'));
    assert.ok(resultsTh.methodologyNoteTh?.includes('การจำลองภาวะวิกฤต'));
  });

  it('reproduces canonical base inputs exactly without silent clamping (WACC 3.5, FCF margin 0.5, TG 0)', () => {
    const lowBaseModel = {
      ...baseCanonicalModel,
      waccPct: 3.5,
      fcfMarginPct: 0.5,
      terminalGrowthPct: 0.0,
    };
    const results = evaluateMacroStressScenarios(lowBaseModel, false);
    const baseCase = results.find((r) => r.id === 'base_case');
    assert.ok(baseCase);
    assert.equal(baseCase.stressedWacc, 3.5, 'base WACC 3.5 must remain 3.5 without silent floor');
    assert.equal(baseCase.stressedMargin, 0.5, 'base FCF margin 0.5 must remain 0.5 without silent floor');
    assert.equal(baseCase.stressedTerminalGrowth, 0.0, 'base TG 0 must remain 0 without silent floor');
  });

  it('preserves negative stressed margin without silently changing to +1%', () => {
    const lowMarginModel = {
      ...baseCanonicalModel,
      fcfMarginPct: 0.5,
    };
    const results = evaluateMacroStressScenarios(lowMarginModel, false);
    const stagflation = results.find((r) => r.id === 'stagflation_shock');
    assert.ok(stagflation);
    // 0.5% - 2.00% delta = -1.5%
    assert.equal(stagflation.stressedMargin, -1.5, 'negative stressed margin must not be silently clamped to 1.0%');
  });

  it('fails closed when stress creates mathematically invalid WACC <= TG', () => {
    // Model where AI productivity wave pushes TG > WACC
    // AI wave: waccDeltaBps: -25 (-0.25%), tgDeltaBps: +30 (+0.30%)
    // If base WACC=3.0% and TG=2.8%:
    // stressedWacc = 2.75%, stressedTG = 3.10% -> invalid!
    const tightSpreadModel = {
      ...baseCanonicalModel,
      waccPct: 3.0,
      terminalGrowthPct: 2.8,
    };
    const results = evaluateMacroStressScenarios(tightSpreadModel, false);
    const aiWave = results.find((r) => r.id === 'ai_productivity_wave');
    assert.ok(aiWave);
    assert.equal(aiWave.isAvailable, false);
    assert.equal(aiWave.stressedFairValue, null);
    assert.ok(aiWave.reason?.includes('must exceed terminal growth'));
  });
});
