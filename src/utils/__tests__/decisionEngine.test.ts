import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDcfPerShare,
  generateValuationScenarios,
  computeSensitivityMatrix,
  calculateReverseDcf,
  extractNormalizedPeers,
  generateCanonicalScenarios,
  computeCanonicalSensitivityMatrix,
  calculateCanonicalReverseDcf
} from '../decisionEngine';
import type { CanonicalValuationSandboxInputs } from '../valuationSandboxAdapter';
import { calculateStrictDCFValue } from '../valuation/dcfMathEngine';

describe('decisionEngine', () => {
  it('calculateDcfPerShare: computes discounted cash flow and terminal value accurately', () => {
    // Base FCF/share = $10, Growth = 10%, WACC = 9%, Terminal Growth = 2.5%
    const fv = calculateDcfPerShare(10, 10, 9, 2.5, 5);

    assert.ok(fv > 0);
    assert.ok(fv > 200 && fv < 250);
  });

  it('calculateDcfPerShare: returns 0 when WACC is less than or equal to terminal growth or inputs invalid', () => {
    assert.equal(calculateDcfPerShare(10, 10, 2.5, 2.5), 0);
    assert.equal(calculateDcfPerShare(10, 10, 2.0, 3.0), 0);
    assert.equal(calculateDcfPerShare(-5, 10, 9.0, 2.5), 0);
    assert.equal(calculateDcfPerShare(NaN, 10, 9.0, 2.5), 0);
  });

  it('generateValuationScenarios: generates deterministic Bear < Base < Bull ranking with explicit inputs', () => {
    const scenarios = generateValuationScenarios(10, 180, 10, 9.0, 2.5);

    assert.equal(scenarios.length, 3);
    const bear = scenarios.find(s => s.name === 'bear')!;
    const base = scenarios.find(s => s.name === 'base')!;
    const bull = scenarios.find(s => s.name === 'bull')!;

    assert.ok(bear && base && bull);
    assert.ok(bear.fairValuePerShare < base.fairValuePerShare);
    assert.ok(base.fairValuePerShare < bull.fairValuePerShare);
    assert.ok(bear.marginOfSafetyPct < base.marginOfSafetyPct);
    assert.ok(base.marginOfSafetyPct < bull.marginOfSafetyPct);
  });

  it('generateValuationScenarios: fails closed without returning fabricated values when inputs are invalid', () => {
    assert.deepEqual(generateValuationScenarios(NaN, 180, 10, 9.0, 2.5), []);
    assert.deepEqual(generateValuationScenarios(10, 0, 10, 9.0, 2.5), []);
    assert.deepEqual(generateValuationScenarios(10, 180, 10, 2.0, 2.5), []);
  });

  it('computeSensitivityMatrix: generates 5x5 grid with proper inverse discount rate behavior', () => {
    const matrix = computeSensitivityMatrix(10, 180, 9.0, 2.5, 10);

    assert.equal(matrix.discountRates.length, 5);
    assert.equal(matrix.terminalGrowthRates.length, 5);
    assert.equal(matrix.cells.length, 5);
    assert.equal(matrix.cells[0].length, 5);

    // Lowest WACC (row 0) should have higher fair value than highest WACC (row 4)
    const lowestWaccVal = matrix.cells[0][2].fairValue;
    const highestWaccVal = matrix.cells[4][2].fairValue;
    assert.ok(lowestWaccVal > highestWaccVal);

    // Highest terminal growth (col 4) should have higher fair value than lowest terminal growth (col 0)
    const lowestTgVal = matrix.cells[2][0].fairValue;
    const highestTgVal = matrix.cells[2][4].fairValue;
    assert.ok(highestTgVal > lowestTgVal);
  });

  it('computeSensitivityMatrix: fails closed when required inputs are missing or invalid', () => {
    const empty = computeSensitivityMatrix(0, 180, 9.0, 2.5, 10);
    assert.deepEqual(empty, { discountRates: [], terminalGrowthRates: [], cells: [] });
  });

  it('calculateReverseDcf: back-solves implied growth rate with descriptive non-speculative language', () => {
    // Current price = $216.71, Base FCF/share = $10, WACC = 9%, TG = 2.5%
    const res = calculateReverseDcf(216.71, 10, 9.0, 2.5, 5);

    assert.ok(res.impliedGrowthPct !== null && res.impliedGrowthPct >= 9.5 && res.impliedGrowthPct <= 10.5);
    assert.equal(res.isHurdleHigh, false);
    // Descriptive assessment without speculative probability claims
    assert.ok(res.assessment.includes('implies approximately'));
    assert.ok(res.assessment.includes('WACC: 9%'));
    assert.ok(res.assessmentTh.includes('สะท้อนอัตราการเติบโต'));
  });

  it('calculateReverseDcf: flags demanding / high hurdle when market prices aggressive growth', () => {
    const res = calculateReverseDcf(400, 10, 9.0, 2.5, 5);

    assert.ok(res.impliedGrowthPct !== null && res.impliedGrowthPct > 20);
    assert.equal(res.isHurdleHigh, true);
  });

  it('calculateReverseDcf: returns null and isOutOfRange when target price is unbracketed by [-50%, +150%]', () => {
    const res = calculateReverseDcf(50000, 10, 9.0, 2.5, 5);
    assert.equal(res.impliedGrowthPct, null);
    assert.equal(res.isOutOfRange, true);
    assert.ok(res.assessment.includes('exceeds the valuation at +150%'));
  });

  it('calculateReverseDcf: fails closed on invalid or non-positive inputs', () => {
    const res = calculateReverseDcf(0, 10, 9.0, 2.5);
    assert.equal(res.impliedGrowthPct, null);
    assert.ok(res.assessment.includes('missing or invalid verified inputs'));
  });

  // Canonical Valuation Engine Integration Tests
  const mockCanonicalInputs: CanonicalValuationSandboxInputs = {
    ticker: 'MSFT',
    currentPrice: 420.50,
    startingRevenueM: 245120,
    sharesOutstandingM: 7430,
    netCashM: 30000,
    waccPct: 8.5,
    terminalGrowthPct: 3.0,
    projectionYears: 5,
    baseRevenueCagrPct: 12.0,
    baseFcfMarginPct: 32.0,
    canonicalBaseFairValue: calculateStrictDCFValue(245120, 7430, 30000, 8.5, 3.0, 12.0, 32.0, 5)
  };

  it('generateCanonicalScenarios: base scenario matches canonical DCF math exactly', () => {
    const scenarios = generateCanonicalScenarios(mockCanonicalInputs);

    assert.equal(scenarios.length, 3);
    const base = scenarios.find(s => s.name === 'base')!;
    const bear = scenarios.find(s => s.name === 'bear')!;
    const bull = scenarios.find(s => s.name === 'bull')!;

    assert.ok(base && bear && bull);
    // Base fair value must match canonical DCF exactly
    assert.equal(base.fairValuePerShare, mockCanonicalInputs.canonicalBaseFairValue);
    assert.ok(bear.fairValuePerShare < base.fairValuePerShare);
    assert.ok(base.fairValuePerShare < bull.fairValuePerShare);
  });

  it('computeCanonicalSensitivityMatrix: reuses calculateStrictDCFValue across grid', () => {
    const matrix = computeCanonicalSensitivityMatrix(mockCanonicalInputs);

    assert.equal(matrix.discountRates.length, 5);
    assert.equal(matrix.terminalGrowthRates.length, 5);

    // Center cell (index 2, 2) corresponds to base WACC (8.5%) and base TG (3.0%)
    const centerCell = matrix.cells[2][2];
    assert.equal(centerCell.discountRatePct, 8.5);
    assert.equal(centerCell.terminalGrowthPct, 3.0);
    assert.equal(centerCell.fairValue, mockCanonicalInputs.canonicalBaseFairValue);
  });

  it('computeCanonicalSensitivityMatrix: returns null fairValue and null MoS when WACC <= TG', () => {
    // Construct inputs where low discount rates collide with high terminal growth
    const borderInputs = {
      ...mockCanonicalInputs,
      waccPct: 4.5,
      terminalGrowthPct: 4.0,
    };
    const matrix = computeCanonicalSensitivityMatrix(borderInputs);
    // Row 0 has WACC 4.5 - 1.5 = 3.0%, while high TG columns have TG >= 3.5%
    const invalidCell = matrix.cells[0].find(c => c.discountRatePct <= c.terminalGrowthPct);
    assert.ok(invalidCell, 'Must have at least one cell where WACC <= TG');
    assert.equal(invalidCell.fairValue, null);
    assert.equal(invalidCell.marginOfSafetyPct, null);
  });

  it('calculateCanonicalReverseDcf: back-solves implied revenue CAGR using canonical strict DCF engine', () => {
    const targetPrice = mockCanonicalInputs.canonicalBaseFairValue!;
    const res = calculateCanonicalReverseDcf({
      ...mockCanonicalInputs,
      currentPrice: targetPrice
    });

    // Solving for targetPrice should yield the base CAGR (12.0%)
    assert.ok(res.impliedGrowthPct !== null);
    assert.ok(Math.abs(res.impliedGrowthPct - mockCanonicalInputs.baseRevenueCagrPct) < 0.2);
    assert.ok(res.assessment.includes('implies approximately'));
    assert.ok(res.assessment.includes('Base report assumption: 12%'));
  });

  it('calculateCanonicalReverseDcf: returns null and isOutOfRange when target price is unbracketed by [-50%, +150%]', () => {
    const res = calculateCanonicalReverseDcf({
      ...mockCanonicalInputs,
      currentPrice: 50000.0 // Astronomical price far exceeding +150% CAGR DCF
    });

    assert.equal(res.impliedGrowthPct, null);
    assert.equal(res.isOutOfRange, true);
    assert.ok(res.assessment.includes('exceeds the valuation at +150%'));
  });

  it('extractNormalizedPeers: extracts structured peers without fabricating missing values', () => {
    const mockReport: any = {
      peer_comparison: [
        {
          ticker: 'AAPL',
          company_name: 'Apple Inc.',
          market_cap: 3000000000000,
          pe_ratio: 30.5,
          operating_margin: 31.2
        },
        {
          ticker: 'GOOGL',
          name: 'Alphabet Inc.',
          pe_ratio: 24.1
        }
      ]
    };

    const peers = extractNormalizedPeers(mockReport);

    assert.equal(peers.length, 2);
    assert.equal(peers[0].ticker, 'AAPL');
    assert.equal(peers[0].peRatio, 30.5);
    assert.equal(peers[0].operatingMarginPct, 31.2);

    assert.equal(peers[1].ticker, 'GOOGL');
    assert.equal(peers[1].peRatio, 24.1);
    assert.equal(peers[1].operatingMarginPct, null);
  });
});
