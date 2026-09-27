import assert from 'node:assert/strict';
import { normalizeReport } from '../../../utils/reportIntegrity';
import { calculateDeterministicConvictionScore } from '../../../utils/valuation/convictionScorer';
import {
  buildCanonicalExecutiveSnapshot,
  reconcileExecutiveSummary,
  reconcileKeyTakeaways,
  validateStructuredSotpModel,
  validateSection1Integrity,
  extractBaseValuationMentionedValue,
  type SotpModel,
} from '../../canonicalExecutiveSnapshot';
import { computeWhatChanged, runCounterfactualDcfReplay } from '../../whatChangedEngine';
import { compareMemorySnapshots, extractMemorySnapshot, type ResearchMemorySnapshot } from '../../investmentMemory';
import type { ReportData } from '../../../types';

console.log('🚀 Running Canonical Section 1 Integrity & Cross-Sector Conviction Test Suite...');

// =========================================================================
// 1. TEST — DCF NARRATIVE SYNCHRONIZATION (Section 64)
// =========================================================================
{
  console.log('➡️ Testing DCF narrative synchronization...');

  const reportFixture: any = {
    ticker: 'TEST',
    verdict: {
      summary: 'บริษัทมีพื้นฐานแข็งแกร่ง โดยการประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 174.68 ดอลลาร์ ขณะที่ราคาตลาดอยู่ที่ 372.11 ดอลลาร์ แนะนำถือ',
      key_takeaways: [
        'รายได้เติบโตแข็งแกร่ง',
        'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 174.68 ดอลลาร์ ขณะที่ราคาตลาดปัจจุบันซื้อขายที่ 372.11 ดอลลาร์'
      ],
      conviction_score: 50
    },
    company_profile: { stock_price: 372.11, sector: 'Technology', shares_outstanding: '1000M' },
    financial_statements: {
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      income_statement: {
        revenue: [25000, 26000, 27000, 29000],
        yoy_revenue_growth_pct: [12, 14, 18, 22],
        net_income: [2000, 2200, 2500, 2800],
        net_margin_pct: [8, 8.5, 9.2, 9.6]
      },
      balance_sheet: {
        total_debt: [5000, 4800, 4500, 4200],
        cash_and_equivalents: [28000, 29000, 30000, 32000],
        short_term_investments: [0, 0, 0, 0],
        debt_to_equity: [0.1, 0.09, 0.08, 0.07],
        current_ratio: [2.1, 2.2, 2.3, 2.4]
      },
      cash_flow: {
        free_cash_flow: [1500, 1800, 2200, 2600],
        fcf_margin_pct: [6, 6.9, 8.1, 9.0]
      }
    },
    intrinsic_value: {
      current_price: 372.11,
      summary: {
        base_case_fair_value: 220.42,
        margin_of_safety_pct: -40.8,
        verdict_text: 'DCF canonical'
      },
      dcf_model: {
        assumptions: {
          wacc_pct: 9.0,
          terminal_growth_pct: 2.5,
          projection_years: 5
        },
        scenarios: {
          bear: { revenue_cagr_pct: 8, terminal_margin_pct: 8, fair_value_per_share: 160 },
          base: { revenue_cagr_pct: 15, terminal_margin_pct: 12, fair_value_per_share: 220.42 },
          bull: { revenue_cagr_pct: 22, terminal_margin_pct: 16, fair_value_per_share: 280 }
        }
      }
    },
    valuation_ratios: [
      { name: 'PEG Ratio', value: 1.5 }
    ],
    comprehensive_analysis: {
      business_strengths: 'Ecosystem leadership\nPricing power',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const normalized = normalizeReport(reportFixture, 'TEST');
  const canonicalFv = normalized.intrinsic_value?.summary?.base_case_fair_value;
  assert.ok(canonicalFv !== null && canonicalFv !== undefined && canonicalFv > 0, 'Canonical Fair value must be positive number');

  // Verify Executive Summary mentions canonical DCF, not stale 174.68
  assert.ok(normalized.verdict?.summary.includes(canonicalFv.toFixed(2)), `Expected summary to contain canonical DCF ${canonicalFv.toFixed(2)}, got: ${normalized.verdict?.summary}`);
  assert.ok(!normalized.verdict?.summary.includes('174.68'), 'Stale DCF 174.68 must not remain in summary');

  // Verify Key Takeaways mentions canonical DCF, not stale 174.68
  const valTakeaway = normalized.verdict?.key_takeaways[1] || '';
  assert.ok(valTakeaway.includes(canonicalFv.toFixed(2)), `Expected takeaway to contain canonical DCF ${canonicalFv.toFixed(2)}, got: ${valTakeaway}`);
  assert.ok(!valTakeaway.includes('174.68'), 'Stale DCF 174.68 must not remain in takeaway');

  console.log('✅ DCF narrative synchronization PASSED');
}

// =========================================================================
// 2. TEST — MARKET REFRESH (Section 65)
// =========================================================================
{
  console.log('➡️ Testing Market snapshot refresh...');

  const initialReport: any = {
    ticker: 'MKT',
    verdict: {
      summary: 'ราคาปัจจุบันที่ 300.00 ดอลลาร์ คิดเป็น P/E สูงถึง 280 เท่า แนะนำถือ',
      key_takeaways: ['ซื้อขายที่ 300.00 ดอลลาร์'],
      conviction_score: 70
    },
    company_profile: { stock_price: 300, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [1000, 1100, 1200, 1300],
        yoy_revenue_growth_pct: [10, 12, 14, 15],
        net_income: [100, 120, 130, 150],
        net_margin_pct: [10, 11, 11, 11.5]
      },
      balance_sheet: {
        total_debt: [200], cash_and_equivalents: [500], current_ratio: [2.0], debt_to_equity: [0.3]
      },
      cash_flow: {
        free_cash_flow: [80, 90, 100, 110], fcf_margin_pct: [8, 8, 8, 8.5]
      }
    },
    intrinsic_value: {
      current_price: 300,
      summary: { base_case_fair_value: 250, margin_of_safety_pct: -16.7 }
    },
    valuation_ratios: [{ name: 'PEG Ratio', value: 1.2 }],
    comprehensive_analysis: {
      business_strengths: 'Tech leadership',
      scoring: { risk_level: { score: 3 } }
    }
  };

  // Simulate market refresh with live quote: Price = 370, P/E = 340
  const liveQuote = {
    MKT: {
      price: 370.00,
      change: 70.00,
      changePercent: 23.33,
      pe: 340,
      source: 'Yahoo Finance'
    }
  };

  const refreshed = normalizeReport(initialReport, 'MKT', liveQuote);

  assert.equal(refreshed.company_profile?.stock_price, 370.00);
  assert.equal(refreshed.intrinsic_value?.current_price, 370.00);
  assert.ok(refreshed.verdict?.summary.includes('370.00'), `Expected fresh price 370.00 in summary, got: ${refreshed.verdict?.summary}`);
  assert.ok(refreshed.verdict?.summary.includes('340'), `Expected fresh P/E 340 in summary, got: ${refreshed.verdict?.summary}`);
  assert.ok(!refreshed.verdict?.summary.includes('300.00'), 'Stale price 300 must not remain in summary');
  assert.ok(!refreshed.verdict?.summary.includes('280'), 'Stale P/E 280 must not remain in summary');

  console.log('✅ Market snapshot refresh PASSED');
}

// =========================================================================
// 3. TEST — PEG UNAVAILABLE (Section 66)
// =========================================================================
{
  console.log('➡️ Testing PEG unavailable / BASIS_MISMATCH handling...');

  const basisMismatchReport: any = {
    ticker: 'PEGMIS',
    company_profile: { stock_price: 100, sector: 'Technology' },
    financial_statements: {
      periods: ['Q4 2025', 'Q1 2026'],
      income_statement: {
        revenue: [900, 1000],
        yoy_revenue_growth_pct: [12, 15],
        net_income: [90, 100],
        net_margin_pct: [10, 10]
      },
      balance_sheet: {
        total_debt: [200, 200], cash_and_equivalents: [500, 500], current_ratio: [2.5, 2.5], debt_to_equity: [0.4, 0.4]
      },
      cash_flow: { free_cash_flow: [90], fcf_margin_pct: [9] }
    },
    intrinsic_value: {
      current_price: 100,
      summary: { base_case_fair_value: 120, margin_of_safety_pct: 20 }
    },
    valuation_ratios: [
      { name: 'PEG Ratio', value: 3.8 } // Legacy raw PEG
    ],
    comprehensive_analysis: {
      business_strengths: 'Competitive strength',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const result = calculateDeterministicConvictionScore(basisMismatchReport, 'PEGMIS');
  assert.ok(result, 'Report with valid valuation must produce conviction score');

  // PEG must NOT use 3.8
  const valReason = result.conviction_breakdown.valuation.reasonEn;
  assert.ok(!valReason.includes('3.80x'), `Conviction reason must not display stale PEG 3.8x, got: ${valReason}`);

  console.log('✅ PEG unavailable / BASIS_MISMATCH handling PASSED');
}

// =========================================================================
// 4. TEST — PEG VALID (Section 67)
// =========================================================================
{
  console.log('➡️ Testing PEG valid handling...');

  const validPegReport: any = {
    ticker: 'PEGVAL',
    company_profile: { stock_price: 150, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700],
        yoy_revenue_growth_pct: [10, 12, 14, 15, 40, 36, 33, 31],
        net_income: [100, 110, 120, 130, 150, 165, 180, 195],
        net_margin_pct: [10, 10, 10, 10, 10.7, 11, 11.2, 11.5]
      },
      balance_sheet: {
        total_debt: [500], cash_and_equivalents: [1000], current_ratio: [2.5], debt_to_equity: [0.3]
      },
      cash_flow: { free_cash_flow: [120], fcf_margin_pct: [8] }
    },
    intrinsic_value: {
      current_price: 150,
      summary: { base_case_fair_value: 180, margin_of_safety_pct: 20 }
    },
    valuation_ratios: [
      { name: 'PEG Ratio', value: 1.25 }
    ],
    comprehensive_analysis: {
      business_strengths: 'Competitive strength',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const result = calculateDeterministicConvictionScore(validPegReport, 'PEGVAL');
  assert.ok(result, 'Valid report must produce conviction score');
  assert.ok(result.conviction_breakdown.valuation.score > 0);
  console.log('✅ PEG valid handling PASSED');
}

// =========================================================================
// 5. TEST — TTM VS QUARTER GROWTH (Section 68)
// =========================================================================
{
  console.log('➡️ Testing TTM vs Quarter growth period semantics...');

  const rawSummaryTh = 'บริษัทมีรายได้รอบ 12 เดือน 103,619 ล้านดอลลาร์ เติบโต 12.8% YoY และกำไรเพิ่มขึ้น';
  const snapshot: any = {
    identity: { ticker: 'TSLA', archetype: 'automotive' },
    market: { currentPrice: 372.11 },
    valuation: { fairValue: 220.42 },
    facts: {}
  };

  const reconciledTh = reconcileExecutiveSummary(rawSummaryTh, snapshot, true);
  assert.ok(reconciledTh.includes('ขณะที่รายได้ไตรมาสล่าสุดเติบโต 12.8% YoY'), `Expected distinct period semantics, got: ${reconciledTh}`);

  const rawSummaryEn = 'Tesla trailing 12-month revenue of $103,619M grew 12.8% YoY with expanding margins';
  const reconciledEn = reconcileExecutiveSummary(rawSummaryEn, snapshot, false);
  assert.ok(reconciledEn.includes('while latest-quarter revenue grew 12.8% YoY'), `Expected distinct period semantics in EN, got: ${reconciledEn}`);

  console.log('✅ TTM vs Quarter growth period semantics PASSED');
}

// =========================================================================
// 6. TEST — MARGIN OF SAFETY WORDING (Section 69)
// =========================================================================
{
  console.log('➡️ Testing Margin of Safety wording and terminology...');

  const currentPrice = 372.11;
  const fairValue = 220.42;
  const mosPct = ((fairValue - currentPrice) / currentPrice) * 100;
  const premiumPct = ((currentPrice - fairValue) / fairValue) * 100;

  assert.equal(mosPct.toFixed(1), '-40.8');
  assert.equal(premiumPct.toFixed(1), '68.8');

  // In convictionScorer:
  const report: any = {
    ticker: 'MOS',
    company_profile: { stock_price: 372.11, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [1000, 1100, 1200, 1300], yoy_revenue_growth_pct: [10, 12, 14, 15], net_income: [100, 110, 120, 130], net_margin_pct: [10, 10, 10, 10]
      },
      balance_sheet: {
        total_debt: [100], cash_and_equivalents: [500], current_ratio: [2.5], debt_to_equity: [0.2]
      },
      cash_flow: { free_cash_flow: [100], fcf_margin_pct: [8] }
    },
    intrinsic_value: {
      current_price: 372.11,
      summary: { base_case_fair_value: 220.42, margin_of_safety_pct: -40.8 }
    },
    comprehensive_analysis: { business_strengths: 'Strengths', scoring: { risk_level: { score: 3 } } }
  };

  const result = calculateDeterministicConvictionScore(report, 'MOS');
  assert.ok(result);
  const valReasonEn = result.conviction_breakdown.valuation.reasonEn;
  const valReasonTh = result.conviction_breakdown.valuation.reasonTh;

  // Must NOT label -40.8% as "Premium over Fair Value (40.8%)"
  assert.ok(!valReasonEn.includes('Premium over Fair Value (40.8%)'), `Forbidden terminology found in: ${valReasonEn}`);
  assert.ok(valReasonEn.includes('below current price') || valReasonEn.includes('Margin of Safety -40.8%'));
  assert.ok(valReasonTh.includes('ต่ำกว่าราคาตลาด') || valReasonTh.includes('Margin of Safety -40.8%'));

  console.log('✅ Margin of Safety wording and terminology PASSED');
}

// =========================================================================
// 7. TEST — SOTP INTEGRITY (Section 70 & 71)
// =========================================================================
{
  console.log('➡️ Testing SOTP integrity (unsupported stripped, structured permitted)...');

  // A. No structured SOTP model -> strip $385.00
  const rawSummaryWithSotp = 'ราคา 372.11 ดอลลาร์ สะท้อนมูลค่าแฝงของ Robotaxi และ Optimus ตามวิธี Sum-of-the-Parts (SOTP) ที่ 385.00 ดอลลาร์';
  const snapshotNoSotp: any = {
    identity: { ticker: 'TSLA', archetype: 'automotive' },
    market: { currentPrice: 372.11 },
    valuation: { fairValue: 220.42, sotpModel: undefined },
    facts: {}
  };

  const reconciledNoSotp = reconcileExecutiveSummary(rawSummaryWithSotp, snapshotNoSotp, true);
  assert.ok(!reconciledNoSotp.includes('385.00'), 'Unsupported SOTP dollar claim must be stripped');
  assert.ok(reconciledNoSotp.includes('Robotaxi และ Optimus'), 'Qualitative optionality thesis must be preserved');
  assert.ok(reconciledNoSotp.includes('Sum-of-the-Parts (SOTP)'), 'SOTP methodology mention must be preserved');

  // B. Structured SOTP model exists -> validate and preserve
  const validSotp: SotpModel = {
    components: [
      { name: 'Core Auto', value: 500_000 },
      { name: 'Energy Storage', value: 150_000 },
      { name: 'Robotaxi Optionality', value: 350_000 }
    ],
    equityValue: 1_000_000,
    dilutedShares: 3_150,
    valuePerShare: 317.46
  };
  const valResult = validateStructuredSotpModel(validSotp);
  assert.equal(valResult.isValid, true);
  assert.equal(valResult.valuePerShare, 317.46);

  const snapshotWithSotp: any = {
    ...snapshotNoSotp,
    valuation: { fairValue: 220.42, sotpModel: validSotp }
  };
  const reconciledWithSotp = reconcileExecutiveSummary(rawSummaryWithSotp, snapshotWithSotp, true);
  assert.ok(reconciledWithSotp.includes('317.46'), `Expected reconciled SOTP 317.46, got: ${reconciledWithSotp}`);

  console.log('✅ SOTP integrity PASSED');
}

// =========================================================================
// 8. TEST — MOAT TEXT FORMATTING NEUTRALITY (Section 72)
// =========================================================================
{
  console.log('➡️ Testing Moat text formatting neutrality (bullets vs prose vs synonyms)...');

  const baseReport: any = {
    ticker: 'MOATTEST',
    company_profile: { stock_price: 100, sector: 'Technology' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [1000, 1100, 1200, 1300], yoy_revenue_growth_pct: [20, 22, 25, 28], net_income: [200, 230, 260, 300], net_margin_pct: [20, 21, 22, 23]
      },
      balance_sheet: {
        total_debt: [100], cash_and_equivalents: [800], current_ratio: [3.0], debt_to_equity: [0.1]
      },
      cash_flow: { free_cash_flow: [200], fcf_margin_pct: [15] }
    },
    intrinsic_value: { current_price: 100, summary: { base_case_fair_value: 120, margin_of_safety_pct: 20 } },
    valuation_ratios: [{ name: 'PEG Ratio', value: 1.1 }]
  };

  const reportA = {
    ...baseReport,
    comprehensive_analysis: {
      business_strengths: 'The company has an extensive global enterprise customer base and high customer loyalty.',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const reportB = {
    ...baseReport,
    comprehensive_analysis: {
      business_strengths: '• Monopoly pricing power\n• Network effect\n• Patent moat\n• High switching costs\n• Market leadership',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const reportC = {
    ...baseReport,
    comprehensive_analysis: {
      business_strengths: '1. Brand recognition\n2. Cost advantage\n3. Efficient scale',
      scoring: { risk_level: { score: 3 } }
    }
  };

  const scoreA = calculateDeterministicConvictionScore(reportA, 'MOATTEST');
  const scoreB = calculateDeterministicConvictionScore(reportB, 'MOATTEST');
  const scoreC = calculateDeterministicConvictionScore(reportC, 'MOATTEST');

  assert.ok(scoreA && scoreB && scoreC);
  assert.equal(scoreA.conviction_breakdown.moat_and_risk.score, scoreB.conviction_breakdown.moat_and_risk.score, 'Bullets/keywords must not alter moat score');
  assert.equal(scoreA.conviction_breakdown.moat_and_risk.score, scoreC.conviction_breakdown.moat_and_risk.score, 'Prose variations must not alter moat score');
  assert.equal(scoreA.conviction_score, scoreB.conviction_score, 'Total conviction score must be identical across text formats');

  console.log('✅ Moat text formatting neutrality PASSED');
}

// =========================================================================
// 9. CROSS-SECTOR TESTS (Sections 74 - 81)
// =========================================================================
{
  console.log('➡️ Testing Cross-Sector Policies (Bank, Insurer, REIT, Pre-Profit, SaaS, Operating)...');

  // Bank Fixture (No corporate FCF, no Current Ratio)
  const bankReport: any = {
    ticker: 'JPM_MOCK',
    company_profile: { stock_price: 200, sector: 'Financial Services', industry: 'Commercial Banking' },
    financial_statements: {
      statement_template: 'banking',
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [10000, 10500, 11000, 11500],
        yoy_revenue_growth_pct: [8, 9, 10, 11],
        net_income: [3000, 3200, 3400, 3600],
        net_margin_pct: [30, 30.5, 31, 31.3]
      },
      balance_sheet: {
        deposits: [200000, 210000, 220000, 230000],
        total_equity: [30000, 31000, 32000, 33000]
      },
      cash_flow: {}
    },
    intrinsic_value: {
      current_price: 200,
      selected_model: { model_type: 'ddm', model_name_en: 'Dividend Discount Model' },
      ddm_model: { scenarios: { base: { fair_value_per_share: 220 } } }
    },
    comprehensive_analysis: {
      business_strengths: 'Scale and deposit moat',
      scoring: { financial_strength: { score: 9 }, risk_level: { score: 3 } }
    }
  };

  const bankScore = calculateDeterministicConvictionScore(bankReport, 'JPM_MOCK');
  assert.ok(bankScore, 'Bank fixture must produce conviction score without corporate FCF');
  assert.ok(bankScore.conviction_breakdown.financial_health.score >= 20, 'Bank health score should be healthy');
  console.log(`   Bank Policy PASSED (Score: ${bankScore.conviction_score}/100)`);

  // Insurer Fixture
  const insurerReport: any = {
    ticker: 'TRV_MOCK',
    company_profile: { stock_price: 220, sector: 'Financial Services', industry: 'Property & Casualty Insurance' },
    financial_statements: {
      statement_template: 'insurance',
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [8000, 8200, 8500, 8800],
        yoy_revenue_growth_pct: [6, 7, 8, 9],
        net_income: [800, 850, 900, 950],
        net_margin_pct: [10, 10.4, 10.6, 10.8]
      },
      balance_sheet: { total_equity: [25000, 26000, 27000, 28000] },
      cash_flow: {}
    },
    intrinsic_value: {
      current_price: 220,
      summary: { base_case_fair_value: 240, margin_of_safety_pct: 9.1 }
    },
    comprehensive_analysis: {
      business_strengths: 'Underwriting discipline',
      scoring: { financial_strength: { score: 8 }, risk_level: { score: 3 } }
    }
  };

  const insurerScore = calculateDeterministicConvictionScore(insurerReport, 'TRV_MOCK');
  assert.ok(insurerScore, 'Insurer fixture must produce conviction score');
  console.log(`   Insurer Policy PASSED (Score: ${insurerScore.conviction_score}/100)`);

  // REIT Fixture
  const reitReport: any = {
    ticker: 'PLD_MOCK',
    company_profile: { stock_price: 120, sector: 'Real Estate', industry: 'Industrial REIT' },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: {
        revenue: [1500, 1600, 1700, 1800],
        yoy_revenue_growth_pct: [8, 9, 10, 11],
        net_income: [500, 520, 540, 560],
        net_margin_pct: [33, 32.5, 31.8, 31.1]
      },
      balance_sheet: {
        total_debt: [20000],
        total_assets: [60000],
        total_equity: [40000]
      },
      cash_flow: {}
    },
    intrinsic_value: {
      current_price: 120,
      selected_model: { model_type: 'reit_affo', model_name_en: 'REIT AFFO Model' },
      reit_model: { scenarios: { base: { fair_value_per_share: 135 } } }
    },
    comprehensive_analysis: {
      business_strengths: 'Prime logistics footprint',
      scoring: { financial_strength: { score: 8 }, risk_level: { score: 3 } }
    }
  };

  const reitScore = calculateDeterministicConvictionScore(reitReport, 'PLD_MOCK');
  assert.ok(reitScore, 'REIT fixture must produce conviction score');
  console.log(`   REIT Policy PASSED (Score: ${reitScore.conviction_score}/100)`);

  console.log('✅ Cross-Sector Policies PASSED');
}

// =========================================================================
// 10. SECTION 1 INTEGRITY VALIDATOR TEST
// =========================================================================
{
  console.log('➡️ Testing Section 1 Integrity Validator...');

  const validReport: any = {
    ticker: 'SYNCTEST',
    verdict: {
      summary: 'มูลค่าพื้นฐาน DCF อยู่ที่ 220.42 ดอลลาร์ ราคาตลาด 372.11 ดอลลาร์',
      key_takeaways: [
        'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 220.42 ดอลลาร์ ซื้อขายที่ 372.11 ดอลลาร์'
      ],
      conviction_score: 80
    },
    company_profile: { stock_price: 372.11, sector: 'Technology' },
    intrinsic_value: {
      current_price: 372.11,
      summary: { base_case_fair_value: 220.42, margin_of_safety_pct: -40.8 }
    }
  };

  const validRes = validateSection1Integrity(validReport, 'SYNCTEST');
  assert.equal(validRes.isValid, true, 'Fully synchronized report must pass validator');

  const conflictingReport: any = {
    ticker: 'CONFLICT',
    verdict: {
      summary: 'มูลค่าพื้นฐาน DCF อยู่ที่ 174.68 ดอลลาร์',
      key_takeaways: ['การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 174.68 ดอลลาร์'],
      conviction_score: 80
    },
    company_profile: { stock_price: 372.11, sector: 'Technology' },
    intrinsic_value: {
      current_price: 372.11,
      summary: { base_case_fair_value: 220.42, margin_of_safety_pct: -40.8 }
    }
  };

  const conflictRes = validateSection1Integrity(conflictingReport, 'CONFLICT');
  assert.equal(conflictRes.isValid, false, 'Conflicting DCF numbers must fail validator');
  assert.ok(conflictRes.issues.length >= 2, 'Must flag both summary and key takeaway conflicts');

  console.log('✅ Section 1 Integrity Validator PASSED');
}

// =========================================================================
// 11. TEST — QUALITATIVE LEADERSHIP CLAIM (Section 32)
// =========================================================================
{
  console.log('➡️ Testing Qualitative Leadership claim softening and evidence backing...');

  // A. Without market leadership evidence -> soften superlatives
  const rawSummaryEn = 'Tesla is a global leader in EVs and the market leader in autonomous driving with best-in-class margins.';
  const rawSummaryTh = 'Tesla เป็นผู้นำระดับโลกด้าน EV และเป็นผู้นำตลาดด้านระบบขับขี่อัตโนมัติ โดยมีงบการเงินที่แข็งแกร่งที่สุด';

  const snapshotNoEvidence: any = {
    identity: { ticker: 'TSLA', archetype: 'automotive' },
    market: { currentPrice: 372.11 },
    valuation: { fairValue: 220.42 },
    evidence: { hasVerifiedMarketLeadership: false },
    facts: {}
  };

  const softenedEn = reconcileExecutiveSummary(rawSummaryEn, snapshotNoEvidence, false);
  assert.ok(!softenedEn.includes('global leader in EVs'), `Superlative must be softened in EN, got: ${softenedEn}`);
  assert.ok(softenedEn.includes('one of the major global EV manufacturers'), `Expected neutral phrasing in EN, got: ${softenedEn}`);
  assert.ok(!softenedEn.includes('best-in-class'), 'best-in-class must be softened');

  const softenedTh = reconcileExecutiveSummary(rawSummaryTh, snapshotNoEvidence, true);
  assert.ok(!softenedTh.includes('เป็นผู้นำระดับโลกด้าน EV'), `Superlative must be softened in TH, got: ${softenedTh}`);
  assert.ok(softenedTh.includes('เป็นหนึ่งในผู้ผลิตยานยนต์ไฟฟ้ารายสำคัญระดับโลก'), `Expected neutral phrasing in TH, got: ${softenedTh}`);

  // B. With explicit verified leadership evidence -> allow stronger claim
  const snapshotWithEvidence: any = {
    ...snapshotNoEvidence,
    evidence: { hasVerifiedMarketLeadership: true, marketPositionEvidence: 'SEC Verified #1 EV Sales Volume' }
  };

  const preservedEn = reconcileExecutiveSummary(rawSummaryEn, snapshotWithEvidence, false);
  assert.ok(preservedEn.includes('global leader in EVs'), 'Verified leadership evidence permits stronger claim in EN');

  const preservedTh = reconcileExecutiveSummary(rawSummaryTh, snapshotWithEvidence, true);
  assert.ok(preservedTh.includes('เป็นผู้นำระดับโลกด้าน EV'), 'Verified leadership evidence permits stronger claim in TH');

  console.log('✅ Qualitative Leadership claim softening and evidence backing PASSED');
}

// =========================================================================
// 12. TEST — TECHNICAL SYNC & UPDATE (Sections 33 & 34)
// =========================================================================
{
  console.log('➡️ Testing Technical trade plan synchronization and update...');

  // Technical plan in snapshot
  const snapshotWithTech: any = {
    identity: { ticker: 'TECHSTK', archetype: 'general_operating' },
    market: { currentPrice: 350.00 },
    valuation: { fairValue: 380.00 },
    technicalPlan: {
      hasStructuredPlan: true,
      strategy: 'Buy on Dip',
      strategyTh: 'ซื้อเมื่อย่อตัว (Buy on Dip)',
      entryZone: '345',
      stopLoss: '315',
      target1: '400',
      target2: '450',
      riskRewardRatio: '1:2.8'
    },
    facts: {}
  };

  // Initial AI narrative contained old entry: 340
  const staleTakeaways = [
    'พื้นฐานธุรกิจเติบโตแข็งแกร่ง',
    'กลยุทธ์ทางเทคนิค: สัญญาณ Buy on Dip จุดเข้า $340 Stop Loss $315 Target $400'
  ];

  const reconciledTakeaways = reconcileKeyTakeaways(staleTakeaways, snapshotWithTech, true);
  assert.ok(reconciledTakeaways[1].includes('$345'), `Expected updated entry 345, got: ${reconciledTakeaways[1]}`);
  assert.ok(!reconciledTakeaways[1].includes('$340'), 'Stale entry 340 must not survive in takeaways');
  assert.ok(reconciledTakeaways[1].includes('$315'), 'Stop loss must match technical plan');
  assert.ok(reconciledTakeaways[1].includes('$400'), 'Target must match technical plan');

  // Case B: No structured technical plan -> strip invented numbers and use neutral qualitative statement
  const snapshotNoTech: any = {
    ...snapshotWithTech,
    technicalPlan: { hasStructuredPlan: false, strategy: 'Neutral' }
  };
  const neutralTakeaways = reconcileKeyTakeaways(staleTakeaways, snapshotNoTech, true);
  assert.ok(!neutralTakeaways[1].includes('$340'), 'Invented entry must be stripped when no structured tech plan');
  assert.ok(!neutralTakeaways[1].includes('$315'), 'Invented stop loss must be stripped');
  assert.ok(neutralTakeaways[1].includes('สัญญาณทางเทคนิคยังอยู่ในช่วงรอดูความชัดเจน'), `Expected qualitative neutral takeaway, got: ${neutralTakeaways[1]}`);

  console.log('✅ Technical trade plan synchronization and update PASSED');
}

// =========================================================================
// 13. TEST — FAIR VALUE & MARKET SNAPSHOT SYNC (Sections 35 & 36)
// =========================================================================
{
  console.log('➡️ Testing Fair Value and Market Snapshot cross-section sync...');

  const snapshot: any = {
    identity: { ticker: 'SYNCALL', archetype: 'general_operating' },
    market: { currentPrice: 375.00 },
    valuation: { fairValue: 225.50 },
    facts: {}
  };

  const rawSummary = 'มูลค่าพื้นฐาน DCF อยู่ที่ 190.00 ดอลลาร์ ราคาปัจจุบัน 320.00 ดอลลาร์';
  const rawTakeaways = ['DCF พื้นฐานอยู่ที่ 190.00 ดอลลาร์ ซื้อขายที่ 320.00 ดอลลาร์'];

  const summarySynced = reconcileExecutiveSummary(rawSummary, snapshot, true);
  const takeawaysSynced = reconcileKeyTakeaways(rawTakeaways, snapshot, true);

  // Verify Fair value 225.50 synchronized everywhere
  assert.ok(summarySynced.includes('225.50'), `Summary must contain canonical fair value 225.50, got: ${summarySynced}`);
  assert.ok(!summarySynced.includes('190.00'), 'Stale fair value 190.00 must not survive in summary');
  assert.ok(takeawaysSynced[0].includes('225.50'), `Takeaway must contain canonical fair value 225.50, got: ${takeawaysSynced[0]}`);

  // Verify Market price 375.00 synchronized everywhere
  assert.ok(summarySynced.includes('375.00'), `Summary must contain current price 375.00, got: ${summarySynced}`);
  assert.ok(!summarySynced.includes('320.00'), 'Stale price 320.00 must not survive in summary');
  assert.ok(takeawaysSynced[0].includes('375.00'), `Takeaway must contain current price 375.00, got: ${takeawaysSynced[0]}`);

  // Also verify normalizeReport end-to-end with valid profile
  const fullReport: any = {
    ticker: 'SYNCALL',
    company_profile: { stock_price: 375.00, sector: 'Technology', shares_outstanding: '1000M' },
    verdict: { summary: rawSummary, key_takeaways: rawTakeaways, conviction_score: 75 },
    intrinsic_value: { current_price: 375.00, summary: { base_case_fair_value: 225.50, margin_of_safety_pct: -39.9 } },
    financial_statements: {
      periods: ['Q1', 'Q2', 'Q3', 'Q4'],
      income_statement: { revenue: [1000, 1100, 1200, 1300], yoy_revenue_growth_pct: [10, 12, 14, 16], net_income: [100, 110, 120, 130], net_margin_pct: [10, 10, 10, 10] },
      balance_sheet: { total_debt: [100], cash_and_equivalents: [500], current_ratio: [2.0], debt_to_equity: [0.2] },
      cash_flow: { free_cash_flow: [100], fcf_margin_pct: [8] }
    },
    comprehensive_analysis: { business_strengths: 'Tech leadership', scoring: { risk_level: { score: 3 } } }
  };
  const normalized = normalizeReport(fullReport, 'SYNCALL');
  assert.ok(normalized.verdict?.summary.includes('375.00'), 'Normalized summary must contain 375.00');
  assert.ok(!normalized.verdict?.summary.includes('320.00'), 'Normalized summary must not contain 320.00');

  console.log('✅ Fair Value and Market Snapshot cross-section sync PASSED');
}

// =========================================================================
// 14. TEST — CROSS-SECTOR ARCHETYPE MATRIX (Section 38)
// =========================================================================
{
  console.log('➡️ Testing 10-Archetype Cross-Sector Snapshot Matrix...');

  const archetypes = [
    { ticker: 'STD_OP', sector: 'Consumer Discretionary', expectedArchetype: 'general_operating' },
    { ticker: 'SAAS_OP', sector: 'Technology', industry: 'Software - Infrastructure', expectedArchetype: 'saas_software' },
    { ticker: 'SEMI_OP', sector: 'Technology', industry: 'Semiconductors', expectedArchetype: 'semiconductor' },
    { ticker: 'BANK_OP', sector: 'Financial Services', industry: 'Banks - Diversified', expectedArchetype: 'bank' },
    { ticker: 'FINTECH_OP', sector: 'Financial Services', industry: 'Credit Services', expectedArchetype: 'lender' },
    { ticker: 'INS_OP', sector: 'Financial Services', industry: 'Insurance - Diversified', expectedArchetype: 'insurer' },
    { ticker: 'REIT_OP', sector: 'Real Estate', industry: 'REIT - Industrial', expectedArchetype: 'reit' },
    { ticker: 'PRE_PROF', sector: 'Healthcare', industry: 'Biotechnology', netIncome: -50, expectedArchetype: 'early_stage' },
    { ticker: 'ENERGY_OP', sector: 'Energy', industry: 'Oil & Gas E&P', expectedArchetype: 'energy_commodity' },
    { ticker: 'UTIL_OP', sector: 'Utilities', industry: 'Utilities - Regulated Electric', expectedArchetype: 'utility' }
  ];

  for (const item of archetypes) {
    const mockReport: any = {
      ticker: item.ticker,
      company_profile: { stock_price: 100, sector: item.sector, industry: item.industry },
      financial_statements: {
        periods: ['Q1', 'Q2', 'Q3', 'Q4'],
        income_statement: {
          revenue: [1000, 1100, 1200, 1300],
          yoy_revenue_growth_pct: [10, 10, 10, 10],
          net_income: [item.netIncome ?? 100],
          net_margin_pct: [item.netIncome ? item.netIncome / 10 : 10]
        },
        balance_sheet: { total_debt: [200], cash_and_equivalents: [500], current_ratio: [2.0] },
        cash_flow: { free_cash_flow: [100] }
      },
      intrinsic_value: { current_price: 100, summary: { base_case_fair_value: 120, margin_of_safety_pct: 20 } }
    };

    const snapshot = buildCanonicalExecutiveSnapshot(mockReport, item.ticker);
    assert.ok(snapshot.identity.archetype, `Archetype must resolve for ${item.ticker}`);

    if (snapshot.identity.archetype === 'bank' || snapshot.identity.archetype === 'lender') {
      // Banks must not emphasize corporate FCF or Current Ratio as valid corporate facts
      assert.equal(snapshot.cashFlow.status, 'NOT_APPLICABLE', `Bank ${item.ticker} corporate FCF must be NOT_APPLICABLE`);
      assert.equal(snapshot.balanceSheet.status, 'SEC_VERIFIED');
    }

    if (snapshot.identity.archetype === 'early_stage') {
      // Pre-profit must mark P/E as NOT_APPLICABLE
      if (snapshot.facts.peTrailing) {
        assert.equal(snapshot.facts.peTrailing.status, 'NOT_APPLICABLE', 'Pre-profit P/E must be NOT_APPLICABLE');
      }
    }
  }

  console.log('✅ 10-Archetype Cross-Sector Snapshot Matrix PASSED');
}

// =========================================================================
// 15. TEST — STALE BASE CASE (Section 28)
// =========================================================================
{
  console.log('➡️ Testing Stale Base Case elimination and synchronization (Section 28)...');

  const snapshot: any = {
    identity: { ticker: 'STALE_BC', archetype: 'general_operating' },
    market: { currentPrice: 372.11 },
    valuation: { fairValue: 276.31 },
    canonicalValuation: {
      modelType: 'dcf_standard',
      baseFairValue: 276.31,
      bearFairValue: 190.00,
      bullFairValue: 350.00,
      currentPrice: 372.11,
      marginOfSafetyPct: -25.7,
      premiumToFairValuePct: 34.7,
      asOf: '2026-09-26',
      assumptions: {},
      provenance: 'CANONICAL_VALUATION_ENGINE'
    },
    facts: {}
  };

  // English: AI initially produced Base Case target = $380.00
  const initialAiSummaryEn = 'HOLD with Base Case target = $380.00. Intrinsic value suggests long-term potential.';
  const reconciledEn = reconcileExecutiveSummary(initialAiSummaryEn, snapshot, false);

  assert.ok(reconciledEn.includes('276.31'), `Reconciled summary must contain canonical fair value 276.31, got: ${reconciledEn}`);
  assert.ok(!reconciledEn.includes('380.00'), `Stale Base Case target 380.00 must NOT survive in summary, got: ${reconciledEn}`);
  assert.ok(!reconciledEn.includes('380'), `380 must not survive as Base Case, got: ${reconciledEn}`);

  // Thai: AI initially produced Base Case = 380 ดอลลาร์
  const initialAiSummaryTh = 'แนะนำถือ (HOLD) โดยมีราคาเป้าหมาย Base Case = 380.00 ดอลลาร์';
  const reconciledTh = reconcileExecutiveSummary(initialAiSummaryTh, snapshot, true);

  assert.ok(reconciledTh.includes('276.31'), `Reconciled TH summary must contain canonical fair value 276.31, got: ${reconciledTh}`);
  assert.ok(!reconciledTh.includes('380.00'), `Stale Base Case 380.00 must NOT survive in TH summary, got: ${reconciledTh}`);

  // Also test with full report validation
  const fullReport: any = {
    ticker: 'STALE_BC',
    company_profile: { stock_price: 372.11, sector: 'Technology' },
    verdict: {
      summary: reconciledTh,
      key_takeaways: [reconciledTh],
      conviction_score: 70
    },
    intrinsic_value: {
      current_price: 372.11,
      summary: { base_case_fair_value: 276.31, margin_of_safety_pct: -25.7 }
    }
  };
  const valRes = validateSection1Integrity(fullReport, 'STALE_BC');
  assert.equal(valRes.isValid, true, 'Fully reconciled report must pass Section 1 integrity validation');

  console.log('✅ Stale Base Case elimination PASSED');
}

// =========================================================================
// 16. TEST — TECHNICAL TARGET AS DISTINCT CONCEPT (Section 29)
// =========================================================================
{
  console.log('➡️ Testing Technical Target relabeling vs Base Case (Section 29)...');

  const snapshotWithTech: any = {
    identity: { ticker: 'TECH_DIFF', archetype: 'general_operating' },
    market: { currentPrice: 350.00 },
    valuation: { fairValue: 276.31 },
    canonicalValuation: {
      modelType: 'dcf_standard',
      baseFairValue: 276.31,
      bearFairValue: 190.00,
      bullFairValue: 350.00,
      currentPrice: 350.00,
      marginOfSafetyPct: -21.1,
      premiumToFairValuePct: 26.7,
      asOf: '2026-09-26',
      assumptions: {},
      provenance: 'CANONICAL_VALUATION_ENGINE'
    },
    technicalPlan: {
      hasStructuredPlan: true,
      strategy: 'Breakout',
      strategyTh: 'เบรคเอาท์ (Breakout)',
      entryZone: '350',
      stopLoss: '320',
      target1: '380',
      target2: '410',
      riskRewardRatio: '1:2.0'
    },
    facts: {}
  };

  // Raw AI prose masquerades technical target 380 as "Base Case target = $380"
  const rawProseEn = 'HOLD with Base Case target = $380.00 following technical breakout setup.';
  const rawProseTh = 'แนะนำถือ โดยมี Base Case target = 380 ดอลลาร์ ตามรูปแบบราคาเบรคเอาท์';

  const reconciledEn = reconcileExecutiveSummary(rawProseEn, snapshotWithTech, false);
  const reconciledTh = reconcileExecutiveSummary(rawProseTh, snapshotWithTech, true);

  // In EN: Relabeled to Technical Target = $380.00, NEVER Base Case = $380.00
  assert.ok(reconciledEn.includes('Technical Target = $380.00'), `Expected Technical Target label in EN, got: ${reconciledEn}`);
  assert.ok(!reconciledEn.includes('Base Case target = $380.00') && !reconciledEn.includes('Base Case = $380'), 'Must not call 380 Base Case in EN');

  // In TH: Relabeled to เป้าหมายทางเทคนิค = $380
  assert.ok(reconciledTh.includes('เป้าหมายทางเทคนิค = 380'), `Expected TH technical target label, got: ${reconciledTh}`);
  assert.ok(!reconciledTh.includes('Base Case target = 380') && !reconciledTh.includes('Base Case = 380'), 'Must not call 380 Base Case in TH');

  console.log('✅ Technical Target distinct concept PASSED');
}

// =========================================================================
// 17. TEST — NEGATIVE MARGIN OF SAFETY TRUTHFUL WORDING (Section 30)
// =========================================================================
{
  console.log('➡️ Testing Negative Margin of Safety truthful wording (Section 30)...');

  const snapshotNegativeMos: any = {
    identity: { ticker: 'MOS_NEG', archetype: 'general_operating' },
    market: { currentPrice: 372.00 },
    valuation: { fairValue: 276.00 },
    canonicalValuation: {
      modelType: 'dcf_standard',
      baseFairValue: 276.00,
      bearFairValue: 200.00,
      bullFairValue: 350.00,
      currentPrice: 372.00,
      marginOfSafetyPct: -25.8,
      premiumToFairValuePct: 34.8,
      asOf: '2026-09-26',
      assumptions: {},
      provenance: 'CANONICAL_VALUATION_ENGINE'
    },
    facts: {}
  };

  // Thai text with soft/euphemistic "Margin of Safety ต่ำ"
  const rawTh = 'หุ้นมี Margin of Safety ต่ำ โดยซื้อขายที่ 372.00 ดอลลาร์ เทียบกับมูลค่าพื้นฐาน 276.00 ดอลลาร์';
  const reconciledTh = reconcileExecutiveSummary(rawTh, snapshotNegativeMos, true);

  assert.ok(reconciledTh.includes('Margin of Safety ติดลบประมาณ 25.8%') || reconciledTh.includes('ราคาตลาดสูงกว่ามูลค่าพื้นฐาน'), `Must explicitly state negative MOS or premium, got: ${reconciledTh}`);
  assert.ok(!reconciledTh.includes('Margin of Safety ต่ำ'), `Must NOT merely say "Margin of Safety ต่ำ", got: ${reconciledTh}`);

  // English text with "low Margin of Safety"
  const rawEn = 'The stock has a low Margin of Safety, trading at $372.00 against fair value $276.00.';
  const reconciledEn = reconcileExecutiveSummary(rawEn, snapshotNegativeMos, false);

  assert.ok(reconciledEn.includes('negative Margin of Safety of approximately -25.8%') || reconciledEn.includes('trading at a premium over intrinsic value'), `Must explicitly state negative MOS in EN, got: ${reconciledEn}`);
  assert.ok(!reconciledEn.includes('low Margin of Safety'), `Must NOT merely say "low Margin of Safety", got: ${reconciledEn}`);

  console.log('✅ Negative Margin of Safety truthful wording PASSED');
}

// =========================================================================
// 18. TEST — VALUATION ASSUMPTION COMPLETENESS IN TIMELINE (Sections 31 & 32)
// =========================================================================
{
  console.log('➡️ Testing Valuation Assumption Completeness (Projection Horizon & Multi-DCF Deltas)...');

  // Base previous snapshot
  const prevSnapshot: ResearchMemorySnapshot = {
    snapshotId: 'mem_VAL_1',
    reportId: 'rep_1',
    ticker: 'VAL_TEST',
    asOfDate: '2026-01-01',
    createdTimestamp: Date.now() - 30 * 24 * 3600 * 1000,
    marketPrice: 200,
    priceProvenance: 'MARKET_SNAPSHOT',
    valuation: {
      baseFairValue: 200,
      marginOfSafetyPct: 0,
      isAvailable: true,
      modelType: 'dcf_standard',
      assumptions: {
        waccPct: 10.5,
        terminalGrowthPct: 2.5,
        revenueCagrPct: 18.0,
        fcfMarginPct: 15.0,
        projectionYears: 5,
        terminalMarginPct: 12.0
      },
      inputSnapshot: {
        modelType: 'dcf_standard',
        projectionYears: 5,
        discountRate: 10.5,
        terminalGrowth: 2.5,
        baseRevenueCagr: 18.0,
        terminalMargin: 12.0,
        normalizedBaseFcf: 1000,
        netCashOrDebt: 1000,
        dilutedShares: 500
      },
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    conviction: { score: 70, provenance: 'DETERMINISTIC_DERIVATION' },
    financials: {
      latestPeriod: 'Q4 2025',
      revenue: 10000,
      revenueYoYPct: 18,
      operatingMarginPct: 15,
      grossMarginPct: 40,
      netIncome: 1200,
      epsDiluted: 2.4,
      freeCashFlow: 1000,
      cashAndEquivalents: 2000,
      shortTermInvestments: 0,
      totalDebt: 1000,
      netCash: 1000,
      sharesOutstanding: 500,
      currentSharesOutstandingM: 500,
      dilutedWeightedAverageSharesM: 500,
      provenance: 'sec_verified'
    },
    thesis: {
      summary: 'Solid growth profile',
      keyDrivers: ['Cloud expansion'],
      keyRisks: ['Competition'],
      catalysts: ['Product launch'],
      confirmationStatus: 'user_confirmed',
      provenance: 'USER_INPUT'
    },
    evidence: {
      secAccession: '0001',
      secFilingDate: '2025-12-31',
      hasVerifiedSecStatements: true,
      citationsCount: 5,
      provenance: 'VERIFIED_FACT'
    },
    engineVersion: { schemaVersion: 2, generatedByVersion: '1.0.0' },
    isLegacy: false
  };

  // Current snapshot with updated assumptions (WACC 9.25, Projection 10, Revenue CAGR 20.5, Terminal Margin 14.5)
  const curSnapshot: ResearchMemorySnapshot = {
    ...prevSnapshot,
    snapshotId: 'mem_VAL_2',
    reportId: 'rep_2',
    asOfDate: '2026-02-01',
    createdTimestamp: Date.now(),
    valuation: {
      ...prevSnapshot.valuation,
      baseFairValue: 260,
      assumptions: {
        waccPct: 9.25,
        terminalGrowthPct: 2.8,
        revenueCagrPct: 20.5,
        fcfMarginPct: 16.0,
        projectionYears: 10,
        terminalMarginPct: 14.5
      },
      inputSnapshot: {
        modelType: 'dcf_standard',
        projectionYears: 10,
        discountRate: 9.25,
        terminalGrowth: 2.8,
        baseRevenueCagr: 20.5,
        terminalMargin: 14.5,
        normalizedBaseFcf: 1100,
        netCashOrDebt: 1000,
        dilutedShares: 500
      }
    }
  };

  const delta = compareMemorySnapshots(curSnapshot, prevSnapshot);

  // Check structured deltas
  assert.equal(delta.valuationAssumptionsDelta.projectionYearsDelta, 5, 'Projection years delta must be +5');
  assert.equal(delta.valuationAssumptionsDelta.waccDeltaPoints, -1.25, 'WACC delta must be -1.25');
  assert.equal(delta.valuationAssumptionsDelta.revenueCagrDeltaPoints, 2.5, 'Revenue CAGR delta must be +2.5');
  assert.equal(delta.valuationAssumptionsDelta.terminalMarginDeltaPoints, 2.5, 'Terminal margin delta must be +2.5');

  const whatChanged = computeWhatChanged(curSnapshot, prevSnapshot);
  const changeIds = whatChanged.items.map(it => it.id);

  // Section 31: Projection horizon change captured as MODEL_ASSUMPTION_CHANGE
  const projChange = whatChanged.items.find(it => it.id === 'change_projection_years');
  assert.ok(projChange, 'Timeline must include change_projection_years');
  assert.equal(projChange?.semanticType, 'MODEL_ASSUMPTION_CHANGE');
  assert.equal(projChange?.deltaDisplay, '+5 yrs');

  // Section 32: All material compatible deltas appear, not just WACC
  assert.ok(changeIds.includes('change_wacc'), 'Timeline must include change_wacc');
  assert.ok(changeIds.includes('change_projection_years'), 'Timeline must include change_projection_years');
  assert.ok(changeIds.includes('change_revenue_cagr'), 'Timeline must include change_revenue_cagr');
  assert.ok(changeIds.includes('change_terminal_margin'), 'Timeline must include change_terminal_margin');
  assert.ok(changeIds.includes('change_terminal_growth'), 'Timeline must include change_terminal_growth');

  console.log('✅ Valuation Assumption Completeness in Timeline PASSED');
}

// =========================================================================
// 19. TEST — HUGE FAIR VALUE CHANGE GUARD (Section 33)
// =========================================================================
{
  console.log('➡️ Testing Huge Fair Value Change Guard & Incomplete Attribution (Section 33)...');

  // Previous fair value: 100
  const prevSnapshot: any = {
    snapshotId: 'mem_HUGE_1',
    reportId: 'rep_h1',
    ticker: 'HUGE_STK',
    asOfDate: '2026-01-01',
    createdTimestamp: Date.now() - 30 * 24 * 3600 * 1000,
    marketPrice: 100,
    valuation: {
      baseFairValue: 100,
      modelType: 'dcf_standard',
      assumptions: { waccPct: 10.0 }
    },
    conviction: { score: 70 },
    financials: { revenue: null, freeCashFlow: null }, // incomplete counterfactual inputs
    thesis: { keyRisks: [], catalysts: [] },
    evidence: {}
  };

  // Current fair value: 276 (delta = +176%)
  // But only a tiny WACC change (10.0 -> 9.8 = -0.2%) and no other drivers stored
  const curSnapshot: any = {
    ...prevSnapshot,
    snapshotId: 'mem_HUGE_2',
    reportId: 'rep_h2',
    asOfDate: '2026-02-01',
    createdTimestamp: Date.now(),
    valuation: {
      baseFairValue: 276,
      modelType: 'dcf_standard',
      assumptions: { waccPct: 9.8 }
    }
  };

  const baseDelta: any = {
    fairValueDelta: { previous: 100, current: 276, deltaPct: 176.0 },
    freeCashFlowDelta: null,
    valuationAssumptionsDelta: { waccDeltaPoints: -0.2 }
  };

  const attribution = runCounterfactualDcfReplay(curSnapshot, prevSnapshot, baseDelta);

  assert.equal(attribution.primaryDriver, 'ATTRIBUTION_INPUTS_INCOMPLETE', 'Must emit ATTRIBUTION_INPUTS_INCOMPLETE for huge FV shift with incomplete inputs');
  assert.equal(attribution.isDeterministic, false, 'Must not claim deterministic attribution');
  assert.ok(
    attribution.impactDescription.includes('stored assumption snapshot is insufficient for complete attribution') ||
    attribution.impactDescriptionTh.includes('ไม่เพียงพอสำหรับการระบุสาเหตุอย่างสมบูรณ์'),
    `Truthful message required, got: ${attribution.impactDescription}`
  );

  console.log('✅ Huge Fair Value Change Guard PASSED');
}

// =========================================================================
// 20. TEST — CROSS-SECTOR BASE-CASE TARGET SEMANTICS (Section 34)
// =========================================================================
{
  console.log('➡️ Testing Cross-Sector Base Case Target Semantics (Operating, Bank, Insurer, REIT, Pre-profit)...');

  const sectorCases = [
    { ticker: 'OP_CO', sector: 'Industrials', modelType: 'dcf_standard', fv: 150.00 },
    { ticker: 'BANK_CO', sector: 'Financial Services', industry: 'Commercial Banking', modelType: 'ddm', fv: 220.00 },
    { ticker: 'INS_CO', sector: 'Financial Services', industry: 'Property & Casualty Insurance', modelType: 'residual_income', fv: 240.00 },
    { ticker: 'REIT_CO', sector: 'Real Estate', industry: 'Industrial REIT', modelType: 'reit_affo', fv: 135.00 },
    { ticker: 'PRE_CO', sector: 'Healthcare', industry: 'Biotechnology', netIncome: -50, modelType: 'early_stage_scenario', fv: 45.00 }
  ];

  for (const sc of sectorCases) {
    const mockReport: any = {
      ticker: sc.ticker,
      company_profile: { stock_price: 100, sector: sc.sector, industry: sc.industry },
      financial_statements: {
        periods: ['Q1', 'Q2', 'Q3', 'Q4'],
        income_statement: {
          revenue: [1000, 1100, 1200, 1300],
          yoy_revenue_growth_pct: [10, 10, 10, 10],
          net_income: [sc.netIncome ?? 100],
          net_margin_pct: [10]
        },
        balance_sheet: { total_debt: [100], cash_and_equivalents: [500] },
        cash_flow: { free_cash_flow: [100] }
      },
      intrinsic_value: {
        current_price: 100,
        selected_model: { model_type: sc.modelType },
        summary: { base_case_fair_value: sc.fv, margin_of_safety_pct: ((sc.fv - 100) / 100) * 100 }
      },
      verdict: {
        summary: `HOLD with Base Case target = $999.00 for ${sc.ticker}`,
        key_takeaways: [`Base Case target = $999.00 for ${sc.ticker}`],
        conviction_score: 75
      }
    };

    const snapshot = buildCanonicalExecutiveSnapshot(mockReport, sc.ticker);

    // 1. Verify canonical valuation object exists and has the model's base fair value
    assert.equal(snapshot.canonicalValuation.baseFairValue, sc.fv, `Canonical baseFairValue must be ${sc.fv} for ${sc.ticker}`);
    assert.equal(snapshot.recommendation.targetValue, sc.fv, `Recommendation targetValue must match baseFairValue for ${sc.ticker}`);
    assert.equal(snapshot.recommendation.targetType, 'VALUATION_BASE_CASE', `Recommendation targetType must be VALUATION_BASE_CASE for ${sc.ticker}`);

    // 2. Reconcile prose: stale AI 999.00 must be replaced by canonical fair value
    const reconciledSummary = reconcileExecutiveSummary(mockReport.verdict.summary, snapshot, false);
    assert.ok(reconciledSummary.includes(sc.fv.toFixed(2)), `Reconciled summary must contain ${sc.fv.toFixed(2)} for ${sc.ticker}, got: ${reconciledSummary}`);
    assert.ok(!reconciledSummary.includes('999.00'), `Stale target 999.00 must not survive for ${sc.ticker}`);

    const reconciledTakeaways = reconcileKeyTakeaways(mockReport.verdict.key_takeaways, snapshot, false);
    assert.ok(reconciledTakeaways[0].includes(sc.fv.toFixed(2)), `Reconciled takeaway must contain ${sc.fv.toFixed(2)} for ${sc.ticker}`);
    assert.ok(!reconciledTakeaways[0].includes('999.00'), `Stale takeaway target 999.00 must not survive for ${sc.ticker}`);
  }

  console.log('✅ Cross-Sector Base Case Target Semantics PASSED');
}

// =========================================================================
// 21. TEST — DRAFT DCF 136.08 VS CANONICAL DCF 148.67 ELIMINATION
// =========================================================================
{
  console.log('➡️ Testing Draft DCF (136.08) vs Final Canonical DCF (148.67) elimination...');

  const reportFixture: any = {
    ticker: 'AAPL_TEST',
    verdict: {
      summary: 'The company demonstrates durable competitive advantages. DCF base case = $136.08, while current market price is $125.00.',
      key_takeaways: [
        'Revenue continues to expand with stable margins.',
        'DCF base case = $136.08 against current market price of $125.00.'
      ],
      conviction_score: 78
    },
    company_profile: { stock_price: 125.00, sector: 'Technology', shares_outstanding: '15000M' },
    financial_statements: {
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [80000, 85000, 90000, 95000],
        yoy_revenue_growth_pct: [8, 9, 10, 11],
        net_income: [20000, 21000, 22000, 24000],
        net_margin_pct: [25, 24.7, 24.4, 25.2]
      },
      balance_sheet: {
        total_debt: [100000],
        cash_and_equivalents: [60000],
        short_term_investments: [30000],
        debt_to_equity: [1.2],
        current_ratio: [1.1]
      },
      cash_flow: {
        free_cash_flow: [22000, 23000, 24000, 26000],
        fcf_margin_pct: [27.5, 27.0, 26.6, 27.3]
      }
    },
    intrinsic_value: {
      current_price: 125.00,
      selected_model: {
        model_type: 'dcf_standard',
        model_name_en: 'Discounted Cash Flow (DCF)',
        model_name_th: 'แบบจำลองคิดลดกระแสเงินสด (DCF)'
      },
      summary: {
        base_case_fair_value: 148.67,
        margin_of_safety_pct: 18.94
      },
      dcf_model: {
        scenarios: {
          base: { fair_value_per_share: 148.67 }
        },
        assumptions: {
          wacc_pct: 8.5,
          terminal_growth_pct: 2.5
        }
      }
    },
    canonical_executive_snapshot: {
      identity: { ticker: 'AAPL_TEST', archetype: 'general_operating' },
      market: { currentPrice: 125.00 },
      valuation: { fairValue: 148.67, modelType: 'dcf_standard' },
      canonicalValuation: {
        modelType: 'dcf_standard',
        baseFairValue: 148.67,
        canonicalLabelEn: 'DCF base case',
        canonicalLabelTh: 'มูลค่าพื้นฐาน (Base Case)',
        structuredValuationSummaryEn: 'DCF base case = $148.67',
        structuredValuationSummaryTh: 'มูลค่าพื้นฐาน (Base Case) = 148.67 ดอลลาร์',
        provenance: 'CANONICAL_VALUATION_ENGINE'
      },
      facts: {}
    }
  };

  const normalized = normalizeReport(reportFixture, 'AAPL_TEST');
  const snapshot = normalized.canonical_executive_snapshot;

  // 1. Exactly one canonical base valuation value
  assert.equal(snapshot.canonicalValuation.baseFairValue, 148.67, 'Canonical baseFairValue must be exactly 148.67');
  assert.equal(snapshot.valuation.fairValue, 148.67, 'Header Fair Value snapshot must be exactly 148.67');

  // 2. Draft DCF 136.08 must NOT survive
  assert.ok(!normalized.verdict.summary.includes('136.08'), 'Draft DCF 136.08 must not survive in normalized summary');
  assert.ok(!normalized.verdict.key_takeaways[1].includes('136.08'), 'Draft DCF 136.08 must not survive in normalized takeaways');

  // 3. Final canonical DCF 148.67 must be present
  assert.ok(normalized.verdict.summary.includes('148.67'), `Summary must contain canonical 148.67, got: ${normalized.verdict.summary}`);
  assert.ok(normalized.verdict.key_takeaways[1].includes('148.67'), `Takeaway must contain canonical 148.67, got: ${normalized.verdict.key_takeaways[1]}`);

  // 4. Also test Thai prose synchronization
  const rawThaiSummary = 'บริษัทมีปัจจัยพื้นฐานแข็งแกร่ง โดย DCF base case = $136.08 เทียบกับราคาปัจจุบัน $125.00';
  const reconciledTh = reconcileExecutiveSummary(rawThaiSummary, snapshot, true);
  assert.ok(!reconciledTh.includes('136.08'), 'Draft 136.08 must not survive in Thai summary');
  assert.ok(reconciledTh.includes('148.67'), `Thai summary must contain canonical 148.67, got: ${reconciledTh}`);

  // 5. Section 1 Integrity validation
  const integrity = validateSection1Integrity(normalized, 'AAPL_TEST');
  assert.equal(integrity.isValid, true, `Integrity validation should pass, issues: ${integrity.issues.join(', ')}`);
  assert.equal(integrity.details.canonicalBaseFairValue, 148.67);
  assert.equal(integrity.details.baseDcfMentionedValue, 148.67);

  console.log('✅ Draft DCF 136.08 vs Final Canonical DCF 148.67 elimination PASSED');
}

// =========================================================================
// 22. TEST — 5 ARCHETYPES BASE VALUATION NARRATIVE SYNCHRONIZATION
// =========================================================================
{
  console.log('➡️ Testing Base Valuation Narrative across 5 Archetypes (Operating, Bank, REIT, Insurer, Pre-profit)...');

  const archetypesToTest = [
    {
      ticker: 'OP_CORP',
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      archetype: 'general_operating',
      modelType: 'dcf_standard',
      draftProse: 'DCF base case = $136.08 with solid free cash flow generation.',
      draftProseTh: 'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 136.08 ดอลลาร์ จากกระแสเงินสดที่แข็งแกร่ง',
      canonicalFv: 148.67,
      netIncome: 500,
      expectedLabelEn: 'DCF base case',
      mustNotContainLabel: []
    },
    {
      ticker: 'JPM_BANK',
      sector: 'Financial Services',
      industry: 'Banks - Diversified',
      archetype: 'bank',
      modelType: 'ddm',
      draftProse: 'DCF base case = $136.08 with regulatory capital compliance.',
      draftProseTh: 'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 136.08 ดอลลาร์ บนฐานเงินทุนตามเกณฑ์กำกับ',
      canonicalFv: 148.67,
      netIncome: 1200,
      expectedLabelEn: 'Canonical DDM Base Case',
      mustNotContainLabel: ['DCF base case', 'DCF', 'การประเมินมูลค่าด้วย DCF']
    },
    {
      ticker: 'PLD_REIT',
      sector: 'Real Estate',
      industry: 'REIT - Industrial',
      archetype: 'reit',
      modelType: 'reit_affo',
      draftProse: 'DCF base case = $136.08 supported by high occupancy logistics facilities.',
      draftProseTh: 'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 136.08 ดอลลาร์ จากอัตราการเช่าคลังสินค้าสูง',
      canonicalFv: 148.67,
      netIncome: 300,
      expectedLabelEn: 'Canonical AFFO Base Case',
      mustNotContainLabel: ['DCF base case', 'DCF', 'การประเมินมูลค่าด้วย DCF']
    },
    {
      ticker: 'PGR_INS',
      sector: 'Financial Services',
      industry: 'Insurance - Property & Casualty',
      archetype: 'insurer',
      modelType: 'ddm',
      draftProse: 'DCF base case = $136.08 backed by strong underwriting margins.',
      draftProseTh: 'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 136.08 ดอลลาร์ หนุนด้วยกำไรจากการรับประกันภัย',
      canonicalFv: 148.67,
      netIncome: 450,
      expectedLabelEn: 'Canonical DDM Base Case',
      mustNotContainLabel: ['DCF base case', 'DCF', 'การประเมินมูลค่าด้วย DCF']
    },
    {
      ticker: 'BIO_PRE',
      sector: 'Healthcare',
      industry: 'Biotechnology',
      archetype: 'early_stage',
      modelType: 'relative_only',
      draftProse: 'DCF base case = $136.08 reflecting pipeline optionality.',
      draftProseTh: 'การประเมินมูลค่าด้วย DCF พื้นฐานอยู่ที่ 136.08 ดอลลาร์ สะท้อนมูลค่ายาในกระบวนการวิจัย',
      canonicalFv: 148.67,
      netIncome: -80,
      expectedLabelEn: 'Canonical Relative Base Valuation',
      mustNotContainLabel: ['DCF base case', 'DCF', 'การประเมินมูลค่าด้วย DCF']
    }
  ];

  for (const item of archetypesToTest) {
    const rawReport: any = {
      ticker: item.ticker,
      company_profile: { stock_price: 120.00, sector: item.sector, industry: item.industry },
      financial_statements: {
        periods: ['Q1', 'Q2', 'Q3', 'Q4'],
        income_statement: {
          revenue: [1000, 1100, 1200, 1300],
          yoy_revenue_growth_pct: [10, 10, 10, 10],
          net_income: [item.netIncome],
          net_margin_pct: [10]
        },
        balance_sheet: { total_debt: [200], cash_and_equivalents: [500] },
        cash_flow: { free_cash_flow: [100] }
      },
      intrinsic_value: {
        current_price: 120.00,
        selected_model: { model_type: item.modelType },
        summary: { base_case_fair_value: item.canonicalFv, margin_of_safety_pct: 23.89 },
        ddm_model: item.modelType === 'ddm' ? { scenarios: { base: { fair_value_per_share: item.canonicalFv } } } : undefined,
        reit_model: item.modelType === 'reit_affo' ? { scenarios: { base: { fair_value_per_share: item.canonicalFv } } } : undefined,
        relative_only_model: item.modelType === 'relative_only' ? { fair_value_per_share: item.canonicalFv } : undefined,
        dcf_model: item.modelType === 'dcf_standard' ? { scenarios: { base: { fair_value_per_share: item.canonicalFv } } } : undefined
      },
      canonical_executive_snapshot: {
        identity: { ticker: item.ticker, archetype: item.archetype },
        market: { currentPrice: 120.00 },
        valuation: { fairValue: item.canonicalFv, modelType: item.modelType },
        canonicalValuation: {
          modelType: item.modelType,
          baseFairValue: item.canonicalFv,
          canonicalLabelEn: item.expectedLabelEn,
          canonicalLabelTh: item.expectedLabelEn === 'DCF base case' ? 'มูลค่าพื้นฐาน (Base Case)' : item.expectedLabelEn.replace('Canonical ', 'มูลค่าพื้นฐาน ').concat(' (Base Case)'),
          provenance: 'CANONICAL_VALUATION_ENGINE'
        },
        facts: {}
      },
      verdict: {
        summary: item.draftProse,
        key_takeaways: [item.draftProse],
        conviction_score: 70
      }
    };

    const normalized = normalizeReport(rawReport, item.ticker);
    const summaryEn = normalized.verdict.summary;
    const takeawayEn = normalized.verdict.key_takeaways[0];

    // 1. Verify 136.08 does not survive
    assert.ok(!summaryEn.includes('136.08'), `Stale 136.08 must not survive in summary for ${item.ticker}, got: ${summaryEn}`);
    assert.ok(!takeawayEn.includes('136.08'), `Stale 136.08 must not survive in takeaway for ${item.ticker}`);

    // 2. Verify 148.67 is present
    assert.ok(summaryEn.includes('148.67'), `Canonical 148.67 must be present in summary for ${item.ticker}, got: ${summaryEn}`);
    assert.ok(takeawayEn.includes('148.67'), `Canonical 148.67 must be present in takeaway for ${item.ticker}`);

    // 3. For non-DCF archetypes, must NOT manufacture or retain DCF label
    for (const forbidden of item.mustNotContainLabel) {
      assert.ok(!summaryEn.includes(forbidden), `Non-DCF ${item.ticker} summary must not manufacture/retain '${forbidden}', got: ${summaryEn}`);
    }

    // 4. Test Thai prose reconciliation
    const summaryTh = reconcileExecutiveSummary(item.draftProseTh, normalized.canonical_executive_snapshot, true);
    assert.ok(!summaryTh.includes('136.08'), `Stale 136.08 must not survive in Thai summary for ${item.ticker}`);
    assert.ok(summaryTh.includes('148.67'), `Canonical 148.67 must be present in Thai summary for ${item.ticker}, got: ${summaryTh}`);
    for (const forbidden of item.mustNotContainLabel) {
      assert.ok(!summaryTh.includes(forbidden), `Non-DCF ${item.ticker} Thai summary must not contain '${forbidden}', got: ${summaryTh}`);
    }

    // 5. Section 1 Integrity check
    const integrity = validateSection1Integrity(normalized, item.ticker);
    assert.equal(integrity.isValid, true, `Integrity validation should pass for ${item.ticker}, issues: ${integrity.issues.join(', ')}`);
  }

  console.log('✅ 5 Archetypes Base Valuation Narrative Synchronization PASSED');
}

// =========================================================================
// 23. TEST — SECTION 1 ASSERTION: summary.baseDcfMentionedValue == canonicalValuation.baseFairValue
// =========================================================================
{
  console.log('➡️ Testing Section 1 Assertion: summary.baseDcfMentionedValue == canonicalValuation.baseFairValue...');

  // Case A: Perfect synchronization
  const synchedReport: any = {
    ticker: 'SYNC_OK',
    company_profile: { stock_price: 100, sector: 'Technology' },
    intrinsic_value: {
      current_price: 100,
      summary: { base_case_fair_value: 148.67, margin_of_safety_pct: 48.67 }
    },
    verdict: {
      summary: 'Strong balance sheet. DCF base case = $148.67 with attractive upside.',
      key_takeaways: ['DCF base case = $148.67'],
      conviction_score: 80
    }
  };

  const snapshotA = buildCanonicalExecutiveSnapshot(synchedReport, 'SYNC_OK');
  const mentionedA = extractBaseValuationMentionedValue(synchedReport.verdict.summary);
  assert.equal(mentionedA, 148.67, 'Mentioned base value must extract 148.67');
  assert.equal(snapshotA.canonicalValuation.baseFairValue, 148.67);
  assert.ok(Math.abs(mentionedA! - snapshotA.canonicalValuation.baseFairValue!) <= 0.05, 'Must be within 0.05 display-rounding tolerance');

  const valResA = validateSection1Integrity(synchedReport, 'SYNC_OK');
  assert.equal(valResA.isValid, true);
  assert.equal(valResA.details.baseDcfMentionedValue, 148.67);
  assert.equal(valResA.details.canonicalBaseFairValue, 148.67);

  // Case B: Conflicted report (unreconciled 136.08 vs canonical 148.67)
  const conflictedReport: any = {
    ticker: 'SYNC_BAD',
    company_profile: { stock_price: 100, sector: 'Technology' },
    intrinsic_value: {
      current_price: 100,
      summary: { base_case_fair_value: 148.67, margin_of_safety_pct: 48.67 }
    },
    verdict: {
      summary: 'Strong balance sheet. DCF base case = $136.08 with attractive upside.',
      key_takeaways: ['DCF base case = $136.08'],
      conviction_score: 80
    }
  };

  const valResB = validateSection1Integrity(conflictedReport, 'SYNC_BAD');
  assert.equal(valResB.isValid, false, 'Conflicted report must fail Section 1 integrity validation');
  assert.ok(
    valResB.issues.some(issue => issue.includes('conflicts with canonical Fair Value 148.67')),
    `Issues should report conflict with 148.67, got: ${valResB.issues.join('; ')}`
  );
  assert.equal(valResB.details.baseDcfMentionedValue, 136.08);
  assert.equal(valResB.details.canonicalBaseFairValue, 148.67);

  // Case C: Non-DCF archetype manufacturing DCF label must fail integrity
  const bankWithDcfReport: any = {
    ticker: 'BANK_ERR',
    company_profile: { stock_price: 100, sector: 'Financial Services', industry: 'Banks - Regional' },
    intrinsic_value: {
      current_price: 100,
      selected_model: { model_type: 'ddm' },
      summary: { base_case_fair_value: 148.67, margin_of_safety_pct: 48.67 }
    },
    verdict: {
      summary: 'Bank analysis completed. DCF base case = $148.67 based on cash flow.',
      key_takeaways: ['DCF base case = $148.67'],
      conviction_score: 75
    }
  };

  const valResC = validateSection1Integrity(bankWithDcfReport, 'BANK_ERR');
  assert.equal(valResC.isValid, false, 'Bank report manufacturing DCF label must fail Section 1 integrity validation');
  assert.ok(
    valResC.issues.some(issue => issue.includes('must not manufacture a DCF valuation label')),
    `Issues should flag manufactured DCF label, got: ${valResC.issues.join('; ')}`
  );

  console.log('✅ Section 1 Assertion: summary.baseDcfMentionedValue == canonicalValuation.baseFairValue PASSED');
}

console.log('🎉 ALL CANONICAL SECTION 1 INTEGRITY TESTS PASSED SUCCESSFULLY!');
