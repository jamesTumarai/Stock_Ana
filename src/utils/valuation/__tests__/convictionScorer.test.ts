import assert from 'node:assert/strict';
import { calculateDeterministicConvictionScore } from '../convictionScorer';
import { harmonizeReportData } from '../../metricsHarmonizer';

console.log('🚀 Running Conviction Scorer Test Suite...');

// 1. High Quality / High Conviction Stock (e.g., NVDA-like high growth profile)
{
  console.log('➡️ Testing High Conviction Stock Profile...');

  const highQualityStock: any = {
    ticker: 'NVDA',
    company_profile: {
      stock_price: 180,
      sector: 'Technology'
    },
    financial_statements: {
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      income_statement: {
        revenue: [726, 828, 884, 1004],
        yoy_revenue_growth_pct: [63, 70, 85, 93],
        net_income: [143, 79, 214, 326],
        net_margin_pct: [19.7, 9.5, 24.2, 32.5]
      },
      balance_sheet: {
        total_debt: [11000, 10500, 10200, 9800],
        cash_and_equivalents: [18290, 16510, 16600, 15220], // Net cash
        debt_to_equity: [0.22, 0.20, 0.18, 0.16],
        current_ratio: [3.8, 3.9, 4.1, 4.0]
      },
      cash_flow: {
        operating_cash_flow: [450, 520, 610, 720],
        capex: [80, 90, 100, 110],
        free_cash_flow: [370, 430, 510, 610],
        fcf_margin_pct: [50.9, 51.9, 57.6, 60.7]
      }
    },
    intrinsic_value: {
      current_price: 180,
      fair_value_base: 220,
      margin_of_safety_pct: 22.2,
      model_type: 'dcf_standard'
    },
    valuation_ratios: [
      { name: 'PEG Ratio', value: 0.85 }
    ],
    comprehensive_analysis: {
      business_strengths: '1. CUDA Ecosystem network effect monopoly\n2. Pricing power\n3. High switching costs\n4. Technology leadership',
      scoring: {
        understandability: { score: 8, reason: 'Clear tech' },
        revenue_quality: { score: 9, reason: 'High margin recurring' },
        financial_strength: { score: 10, reason: 'Net cash' },
        growth_potential: { score: 10, reason: 'AI hyper-growth' },
        risk_level: { score: 2, reason: 'Low risk' },
        overall_attractiveness: { score: 9, reason: 'Compelling' }
      }
    }
  };

  const result = calculateDeterministicConvictionScore(highQualityStock, 'NVDA');
  assert.ok(result, 'Complete sourced inputs must produce a conviction score');
  assert.ok(result.conviction_score >= 75, `Expected high conviction >= 75, got ${result.conviction_score}`);
  assert.equal(result.conviction_breakdown.growth.maxScore, 30);
  assert.equal(result.conviction_breakdown.financial_health.maxScore, 30);
  assert.equal(result.conviction_breakdown.valuation.maxScore, 20);
  assert.equal(result.conviction_breakdown.moat_and_risk.maxScore, 20);
  assert.ok(result.conviction_breakdown.growth.score >= 25, 'Growth score should be high');
  assert.ok(result.conviction_breakdown.financial_health.score >= 25, 'Health score should be high');

  console.log(`✅ High Conviction Profile PASSED (Score: ${result.conviction_score}/100)`);
}

// 2. Distressed / High Risk Profile
{
  console.log('➡️ Testing Distressed / High Risk Stock Profile...');

  const distressedStock: any = {
    ticker: 'WEAK',
    company_profile: {
      stock_price: 50,
      sector: 'Consumer Cyclical'
    },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [100, 90, 80, 70],
        yoy_revenue_growth_pct: [-10, -15, -18, -22],
        net_income: [-20, -30, -40, -50],
        net_margin_pct: [-20, -33, -50, -71]
      },
      balance_sheet: {
        total_debt: [800, 850, 900, 950],
        total_equity: [100, 70, 30, -20],
        debt_to_equity: [8.0, 12.1, 30.0, 50.0],
        cash_and_equivalents: [10, 8, 5, 3],
        current_ratio: [0.6, 0.5, 0.4, 0.35]
      },
      cash_flow: {
        free_cash_flow: [-40, -50, -60, -70]
      }
    },
    intrinsic_value: {
      current_price: 50,
      fair_value_base: 25,
      margin_of_safety_pct: -50.0 // 50% overvalued
    },
    valuation_ratios: [
      { name: 'PEG Ratio', value: 4.5 }
    ],
    comprehensive_analysis: {
      business_strengths: 'None',
      scoring: {
        understandability: { score: 4, reason: 'Opaque' },
        revenue_quality: { score: 2, reason: 'Commoditized' },
        financial_strength: { score: 1, reason: 'Near bankruptcy' },
        growth_potential: { score: 2, reason: 'Declining' },
        risk_level: { score: 9, reason: 'Insolvency risk' },
        overall_attractiveness: { score: 2, reason: 'Avoid' }
      }
    }
  };

  const result = calculateDeterministicConvictionScore(distressedStock, 'WEAK');
  assert.ok(result, 'Complete sourced inputs must produce a conviction score');
  assert.ok(result.conviction_score < 50, `Expected low conviction < 50, got ${result.conviction_score}`);
  console.log(`✅ Distressed Profile PASSED (Score: ${result.conviction_score}/100)`);
}

// 3. Zero-Drift Determinism Test (100 runs must yield 0.0 variance)
{
  console.log('➡️ Testing Zero-Drift Determinism (100 runs)...');

  const testStock: any = {
    ticker: 'AAPL',
    company_profile: { stock_price: 240, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [90000, 92000, 95000, 98000],
        yoy_revenue_growth_pct: [5, 6, 8, 10],
        net_margin_pct: [24, 25, 26, 26.5],
        net_income: [25000, 26000, 27000, 28000]
      },
      balance_sheet: {
        debt_to_equity: [1.4, 1.3, 1.2, 1.1],
        current_ratio: [1.3, 1.35, 1.4, 1.42]
      },
      cash_flow: {
        free_cash_flow: [28000, 29000, 30000, 31000],
        fcf_margin_pct: [26, 27, 28, 28.5]
      }
    },
    intrinsic_value: {
      current_price: 240,
      fair_value_base: 245,
      margin_of_safety_pct: 2.1
    },
    valuation_ratios: [{ name: 'PEG Ratio', value: 1.8 }],
    comprehensive_analysis: {
      business_strengths: '1. iOS Ecosystem\n2. Brand loyalty\n3. High Services margins',
      scoring: {
        risk_level: { score: 3, reason: 'Low risk' }
      }
    }
  };

  const initial = calculateDeterministicConvictionScore(testStock, 'AAPL');
  assert.ok(initial, 'Complete sourced inputs must produce a conviction score');
  for (let i = 0; i < 100; i++) {
    const run = calculateDeterministicConvictionScore(testStock, 'AAPL');
    assert.ok(run, 'Complete sourced inputs must produce a conviction score');
    assert.equal(run.conviction_score, initial.conviction_score, `Run ${i} diverged from initial score!`);
    assert.equal(run.conviction_breakdown.growth.score, initial.conviction_breakdown.growth.score);
    assert.equal(run.conviction_breakdown.financial_health.score, initial.conviction_breakdown.financial_health.score);
    assert.equal(run.conviction_breakdown.valuation.score, initial.conviction_breakdown.valuation.score);
    assert.equal(run.conviction_breakdown.moat_and_risk.score, initial.conviction_breakdown.moat_and_risk.score);
  }
  console.log(`✅ Zero-Drift Determinism PASSED (Score: ${initial.conviction_score}/100 strictly invariant across 100 runs)`);
}

// 4. Cross-Run Perturbation & Stability Test (Variance bounded to <= 1 point)
{
  console.log('➡️ Testing Cross-Run AI Perturbation (Delta <= 1 pt)...');
  
  // Run 1: slightly more optimistic search results (MOS +21.5%, PEG 0.95, Risk 2)
  const run1: any = {
    ticker: 'NVDA',
    company_profile: { stock_price: 180, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [20000, 25000, 30000, 35000],
        yoy_revenue_growth_pct: [70, 75, 80, 85],
        net_income: [10000, 13000, 16000, 19000],
        net_margin_pct: [50, 52, 53, 54]
      },
      balance_sheet: {
        total_debt: [10000], cash_and_equivalents: [25000], debt_to_equity: [0.2], current_ratio: [3.5]
      },
      cash_flow: { free_cash_flow: [12000], fcf_margin_pct: [45] }
    },
    intrinsic_value: { current_price: 180, margin_of_safety_pct: 21.5 },
    valuation_ratios: [{ name: 'PEG Ratio', value: 0.95 }],
    comprehensive_analysis: {
      business_strengths: '1. CUDA Ecosystem\n2. Monopoly\n3. High pricing power\n4. Switching costs',
      scoring: { risk_level: { score: 2 } }
    }
  };

  // Run 2: slightly different search results (MOS +18.2%, PEG 1.15, Risk 3, 3 bullets)
  const run2: any = {
    ...run1,
    intrinsic_value: { current_price: 180, margin_of_safety_pct: 18.2 },
    valuation_ratios: [{ name: 'PEG Ratio', value: 1.15 }],
    comprehensive_analysis: {
      business_strengths: '1. CUDA Ecosystem\n2. Pricing power\n3. Switching costs',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const res1 = calculateDeterministicConvictionScore(run1, 'NVDA');
  const res2 = calculateDeterministicConvictionScore(run2, 'NVDA');
  assert.ok(res1 && res2, 'Complete sourced inputs must produce conviction scores');
  const delta = Math.abs(res1.conviction_score - res2.conviction_score);
  
  console.log(`   Run 1 Score: ${res1.conviction_score}, Run 2 Score: ${res2.conviction_score}, Delta: ${delta}`);
  assert.ok(delta <= 1, `Delta ${delta} exceeded target bound of <= 1!`);
  console.log(`✅ Cross-Run Stability PASSED (Delta: ${delta} point, strictly within ±1 target)`);
}

// 5. Missing financial inputs must not be replaced with synthetic pillar scores.
{
  console.log('➡️ Testing missing-data fail-closed behavior...');
  const incomplete: any = {
    ticker: 'MISS',
    company_profile: { stock_price: 100, sector: 'Technology' },
    financial_statements: {
      income_statement: { yoy_revenue_growth_pct: [], net_margin_pct: [], net_income: [] },
      balance_sheet: {},
      cash_flow: {}
    },
    comprehensive_analysis: {
      business_strengths: 'Pricing power',
      scoring: {
        growth_potential: { score: 10 },
        revenue_quality: { score: 10 },
        financial_strength: { score: 10 },
        risk_level: { score: 2 }
      }
    }
  };

  assert.equal(
    calculateDeterministicConvictionScore(incomplete, 'MISS'),
    undefined,
    'Missing financial inputs must make scoring unavailable instead of using qualitative defaults'
  );
  console.log('✅ Missing-data fail-closed behavior PASSED');
}

// 6. Harmonizer Integration Test
{
  console.log('➡️ Testing metricsHarmonizer Integration...');

  const rawData: any = {
    ticker: 'TSLA',
    verdict: {
      summary: 'TSLA Summary',
      conviction_score: 50 // Old arbitrary score from LLM
    },
    company_profile: { stock_price: 350 },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [25000, 26000, 27000, 29000],
        yoy_revenue_growth_pct: [12, 14, 18, 22],
        net_income: [2000, 2200, 2500, 2800],
        net_margin_pct: [8, 8.5, 9.2, 9.6]
      },
      balance_sheet: {
        total_debt: [5000, 4800, 4500, 4200],
        cash_and_equivalents: [28000, 29000, 30000, 32000], // Huge net cash
        debt_to_equity: [0.1, 0.09, 0.08, 0.07],
        current_ratio: [2.1, 2.2, 2.3, 2.4]
      },
      cash_flow: {
        free_cash_flow: [1500, 1800, 2200, 2600]
      }
    }
  };

  const harmonized = harmonizeReportData(rawData, 'TSLA');
  assert.ok(harmonized.verdict, 'verdict must exist');
  assert.equal(harmonized.verdict.conviction_score, 50, 'harmonizer must preserve the sourced score');
  assert.equal(harmonized.verdict.conviction_breakdown, undefined, 'harmonizer must not synthesize a missing score breakdown');

  console.log(`✅ metricsHarmonizer Integration PASSED (Preserved Score: ${harmonized.verdict.conviction_score}/100)`);
}

console.log('🎉 ALL CONVICTION SCORER TESTS PASSED SUCCESSFULLY!');
