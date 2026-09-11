import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDcfPerShare,
  generateValuationScenarios,
  computeSensitivityMatrix,
  calculateReverseDcf,
  extractNormalizedPeers
} from '../decisionEngine';

describe('decisionEngine', () => {
  it('calculateDcfPerShare: computes discounted cash flow and terminal value accurately', () => {
    // Base FCF/share = $10, Growth = 10%, WACC = 9%, Terminal Growth = 2.5%
    const fv = calculateDcfPerShare(10, 10, 9, 2.5, 5);

    assert.ok(fv > 0);
    // Rough check: 5-yr cash flows (~$11, $12.1, $13.3, $14.6, $16.1) PV ~ $51
    // Terminal value = $16.1 * 1.025 / (0.09 - 0.025) = $254 -> PV ~ $165
    // Total FV ~ $216
    assert.ok(fv > 200 && fv < 250);
  });

  it('calculateDcfPerShare: returns 0 when WACC is less than or equal to terminal growth', () => {
    const fv = calculateDcfPerShare(10, 10, 2.5, 2.5);
    assert.equal(fv, 0);

    const fvNegative = calculateDcfPerShare(10, 10, 2.0, 3.0);
    assert.equal(fvNegative, 0);
  });

  it('generateValuationScenarios: generates deterministic Bear < Base < Bull ranking', () => {
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

  it('calculateReverseDcf: back-solves implied growth rate matching current price', () => {
    // Current price = $216.71, Base FCF/share = $10, WACC = 9%, TG = 2.5%
    // We expect implied growth to be ~10%
    const res = calculateReverseDcf(216.71, 10, 9.0, 2.5, 5);

    assert.ok(res.impliedGrowthPct >= 9.5 && res.impliedGrowthPct <= 10.5);
    assert.equal(res.isHurdleHigh, false);
    assert.ok(res.assessment.includes('hurdle'));
  });

  it('calculateReverseDcf: flags demanding / high hurdle when market prices aggressive growth', () => {
    // Current price = $400 for $10 FCF/share -> Requires very high growth
    const res = calculateReverseDcf(400, 10, 9.0, 2.5, 5);

    assert.ok(res.impliedGrowthPct > 20);
    assert.equal(res.isHurdleHigh, true);
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
          // Missing operating_margin, gross_margin, etc.
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
    assert.equal(peers[1].operatingMarginPct, null); // Preserved as null, NOT fabricated!
  });
});
