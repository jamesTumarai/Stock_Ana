import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMacroStressScenarios,
  type MacroStressScenario,
} from '../macroStressEngine';

describe('macroStressEngine', () => {
  const baseDcfModel = {
    fairValue: 400,
    currentPrice: 360,
    wacc: 9.0,
    terminalGrowth: 3.0,
    revenueGrowth: 12.0,
    operatingMargin: 35.0,
  };

  it('generates standard institutional stress scenarios', () => {
    const results = evaluateMacroStressScenarios(baseDcfModel, false);
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 5);

    const scenarioIds = results.map(r => r.id);
    assert.ok(scenarioIds.includes('base_case'));
    assert.ok(scenarioIds.includes('stagflation_shock'));
    assert.ok(scenarioIds.includes('recession_demand_drop'));
    assert.ok(scenarioIds.includes('ai_productivity_wave'));
    assert.ok(scenarioIds.includes('rates_higher_for_longer'));
  });

  it('correctly calculates stagflation stress penalty', () => {
    const results = evaluateMacroStressScenarios(baseDcfModel, false);
    const stagflation = results.find(r => r.id === 'stagflation_shock');
    assert.ok(stagflation);

    // Higher WACC (+150 bps) and lower margin must yield a lower fair value than base
    assert.ok(stagflation.stressedFairValue < baseDcfModel.fairValue);
    assert.ok(stagflation.fairValueChangePct < 0);
    assert.ok(stagflation.stressedMarginOfSafety < 10.0);
  });

  it('correctly calculates AI productivity wave upside', () => {
    const results = evaluateMacroStressScenarios(baseDcfModel, false);
    const aiWave = results.find(r => r.id === 'ai_productivity_wave');
    assert.ok(aiWave);

    // Higher growth (+400 bps) and expanded margins must yield higher fair value
    assert.ok(aiWave.stressedFairValue > baseDcfModel.fairValue);
    assert.ok(aiWave.fairValueChangePct > 0);
  });

  it('handles bilingual Thai/English titles and descriptions', () => {
    const resultsTh = evaluateMacroStressScenarios(baseDcfModel, true);
    const stagflationTh = resultsTh.find(r => r.id === 'stagflation_shock');
    assert.ok(stagflationTh);
    assert.ok(stagflationTh.name.includes('ภาวะเงินเฟ้อสูง'));
  });
});
