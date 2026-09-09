import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateFinancialStatements, detectStatementTemplate } from '../../statementValidator';
import { FinancialStatementsData, ReportData } from '../../../types';

console.log('🚀 Running Statement Validator & Impossible-Value Guard Test Suite...');

// 1. Test Balance Sheet Identity Check
console.log('➡️ Testing Balance Sheet Identity Validation...');
const balancedFs: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [1000], net_income: [100] },
  balance_sheet: {
    total_assets: [5000],
    total_liabilities: [3000],
    total_equity: [2000],
    cash_and_equivalents: [1000]
  },
  cash_flow: { operating_cash_flow: [120], capex: [20], free_cash_flow: [100] }
};
const balancedRes = validateFinancialStatements(balancedFs, 'standard');
assert.equal(balancedRes.is_balanced, true);
assert.equal(balancedRes.impossible_guards_passed, true);
assert.equal(balancedRes.ratio_reliability_warning, false);
assert.equal(balancedRes.filing_source, undefined, 'Accounting checks alone must not claim SEC provenance');
assert.equal(balancedRes.filing_date, undefined, 'Missing filing metadata must remain unavailable');
console.log('✅ Balanced Balance Sheet Identity PASSED!');

const sourcedFs: FinancialStatementsData = {
  ...balancedFs,
  source: {
    document_url: 'https://www.sec.gov/Archives/example-filing.htm',
    document_type: 'Form 10-Q',
    filing_date: '2026-08-01',
    period_end: '2026-06-30',
    units: 'USD millions'
  }
};
const sourcedRes = validateFinancialStatements(sourcedFs, 'standard');
assert.equal(sourcedRes.filing_source, 'Form 10-Q · https://www.sec.gov/Archives/example-filing.htm');
assert.equal(sourcedRes.filing_date, '2026-08-01');

// 2. Test Imbalanced Balance Sheet Detection
console.log('➡️ Testing Imbalanced Balance Sheet Identity Detection...');
const imbalancedFs: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [1000], net_income: [100] },
  balance_sheet: {
    total_assets: [5000],
    total_liabilities: [2000], // 2000 + 1500 = 3500 != 5000 (30% error!)
    total_equity: [1500],
    cash_and_equivalents: [1000]
  },
  cash_flow: { operating_cash_flow: [120], capex: [20], free_cash_flow: [100] }
};
const imbalancedRes = validateFinancialStatements(imbalancedFs, 'standard');
assert.equal(imbalancedRes.is_balanced, false);
assert.ok(imbalancedRes.failed_guards?.some(g => g.includes('BALANCE_SHEET_IMBALANCE')));
// Ratio masking flag MUST be activated when balance sheet is imbalanced
assert.equal(imbalancedRes.ratio_reliability_warning, true);
assert.ok(imbalancedRes.flagged_metrics?.roe, 'ROE must be flagged when equity is imbalanced');
console.log('✅ Imbalanced Balance Sheet & Ratio Masking Alert PASSED!');

// 3. Test Impossible-Value Guard: Total Assets < Total Deposits (The SoFi bug)
console.log('➡️ Testing Banking Impossible-Value Guard (Assets < Deposits)...');
const impossibleBankFs: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [820], net_income: [115] },
  balance_sheet: {
    total_assets: [40850], // $40.85B Assets
    deposits: [45500],     // $45.5B Deposits -> IMPOSSIBLE!
    total_liabilities: [35000],
    total_equity: [5850],
    cash_and_equivalents: [5000]
  },
  cash_flow: { operating_cash_flow: [200], capex: [30], free_cash_flow: [170] }
};
const impossibleBankRes = validateFinancialStatements(impossibleBankFs, 'banking', { ticker: 'SOFI' }, 'SOFI');
assert.equal(impossibleBankRes.impossible_guards_passed, false);
assert.ok(impossibleBankRes.failed_guards?.some(g => g.includes('CRITICAL_BANKING_GUARD_FAILED')), 'Must catch Assets < Deposits');
assert.equal(impossibleBankRes.ratio_reliability_warning, true, 'Must flag ratio reliability when impossible value exists');
console.log('✅ Banking Impossible-Value Guard (Assets < Deposits) PASSED!');

// 4. Test Universal Solvency Guard: Total Assets < Cash
console.log('➡️ Testing Universal Solvency Guard (Assets < Cash)...');
const cashViolationFs: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [100], net_income: [10] },
  balance_sheet: {
    total_assets: [1000],
    cash_and_equivalents: [1500], // Cash > Assets -> IMPOSSIBLE!
    total_liabilities: [600],
    total_equity: [400]
  },
  cash_flow: {}
};
const cashViolationRes = validateFinancialStatements(cashViolationFs, 'standard');
assert.equal(cashViolationRes.impossible_guards_passed, false);
assert.ok(cashViolationRes.failed_guards?.some(g => g.includes('IMPOSSIBLE_VALUE')), 'Must catch Cash > Assets');
console.log('✅ Universal Solvency Guard (Assets < Cash) PASSED!');

// 5. Test M&A Goodwill Requirement for Acquisitive Banks
console.log('➡️ Testing M&A Goodwill Requirement for Acquisitive Bank/Fintech...');
const missingGoodwillFs: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [1200], net_income: [150] },
  balance_sheet: {
    total_assets: [50000],
    deposits: [40000],
    goodwill: [0], // Missing Goodwill despite Galileo/Technisys deals!
    total_liabilities: [40000],
    total_equity: [10000],
    cash_and_equivalents: [5000]
  },
  cash_flow: {}
};
const goodwillRes = validateFinancialStatements(missingGoodwillFs, 'banking', { ticker: 'SOFI' }, 'SOFI');
assert.ok(goodwillRes.failed_guards?.some(g => g.includes('MISSING_GOODWILL_POST_MA')), 'Must flag missing goodwill for acquisitive firm');
console.log('✅ M&A Goodwill Check PASSED!');

// 6. Test Multi-Sector Template Detection Routing
console.log('➡️ Testing Multi-Sector Template Detection Routing...');
assert.equal(detectStatementTemplate({ ticker: 'SOFI', company_profile: { sector: 'Financial Services' } }), 'banking');
assert.equal(detectStatementTemplate({ ticker: 'JPM', company_profile: { sector: 'Financial' } }), 'banking');
assert.equal(detectStatementTemplate({ ticker: 'PGR', company_profile: { sector: 'Financial', industry: 'Property & Casualty Insurance' } }), 'insurance');
assert.equal(detectStatementTemplate({ ticker: 'PLD', company_profile: { sector: 'Real Estate', industry: 'Industrial REIT' } }), 'reit');
assert.equal(detectStatementTemplate({ ticker: 'XOM', company_profile: { sector: 'Energy' } }), 'cyclical');
assert.equal(detectStatementTemplate({ ticker: 'MRNA', company_profile: { sector: 'Healthcare', industry: 'Biotechnology' } }), 'biotech');
assert.equal(detectStatementTemplate({ ticker: 'NVDA', company_profile: { sector: 'Technology', industry: 'Semiconductors' } }), 'standard');
console.log('✅ Multi-Sector Template Detection Routing PASSED!');

// 7. Test Historical Extrapolation Guard (Banning Artificial Linear Slopes)
console.log('➡️ Testing Historical Extrapolation Guard...');
const artificialSlopeFs: FinancialStatementsData = {
  periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
  income_statement: {
    revenue: [1000, 1100, 1200, 1300],
    net_income: [85, 110, 135, 160] // Linear +25M every quarter -> Extrapolation suspect!
  },
  balance_sheet: {
    total_assets: [10000, 11000, 12000, 13000],
    total_liabilities: [6000, 6500, 7000, 7500],
    total_equity: [4000, 4500, 5000, 5500]
  },
  cash_flow: {}
};
const slopeRes = validateFinancialStatements(artificialSlopeFs, 'standard');
assert.ok(slopeRes.failed_guards?.some(g => g.includes('HISTORICAL_EXTRAPOLATION_SUSPECT')), 'Must catch linear extrapolation in Net Income');
console.log('✅ Historical Extrapolation Detection PASSED!');

// 8. Test Lending Cash Flow Guard (Loans Held for Sale vs Negative OCF)
console.log('➡️ Testing Lending Cash Flow Guard...');
const lendingNegativeOcfWithoutLoans: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [1200], net_income: [166.7] },
  balance_sheet: { total_assets: [56000], total_liabilities: [45000], total_equity: [11000] },
  cash_flow: {
    operating_cash_flow: [-2315] // Massive negative OCF without change_in_loans_held_for_sale
  }
};
const missingLoansRes = validateFinancialStatements(lendingNegativeOcfWithoutLoans, 'banking');
assert.ok(missingLoansRes.failed_guards?.some(g => g.includes('MISSING_LOANS_HELD_FOR_SALE_LINE')), 'Must flag missing loans held for sale line');

const lendingNegativeOcfWithLoans: FinancialStatementsData = {
  periods: ['Q1 2026'],
  income_statement: { revenue: [1200], net_income: [166.7] },
  balance_sheet: { total_assets: [56000], total_liabilities: [45000], total_equity: [11000] },
  cash_flow: {
    operating_cash_flow: [-2315],
    change_in_loans_held_for_sale: [-2850]
  }
};
const verifiedLoansRes = validateFinancialStatements(lendingNegativeOcfWithLoans, 'banking');
assert.ok(verifiedLoansRes.passed_guards?.some(g => g.includes('LENDING_OCF_LOAN_ORIGINATION_CONSISTENT')), 'Must flag internal consistency between negative OCF and loan originations');
console.log('✅ Lending Cash Flow Guard PASSED!');

// 9. Test OCF Sign Inversion & Volatility Guard
console.log('➡️ Testing OCF Sign Inversion & Volatility Guard...');
const volatileOcfFs: FinancialStatementsData = {
  periods: ['Q4 2025', 'Q1 2026', 'Q2 2026'],
  income_statement: { revenue: [1000, 1100, 1200], net_income: [174, 166.7, 156.6] },
  balance_sheet: { total_assets: [50000, 56000, 56600], total_liabilities: [40000, 45000, 45500], total_equity: [10000, 11000, 11100] },
  cash_flow: {
    operating_cash_flow: [240, -2315, 440], // +240 -> -2315 -> +440
    change_in_loans_held_for_sale: [-180, -2850, -120]
  }
};
const volatileRes = validateFinancialStatements(volatileOcfFs, 'banking');
assert.ok(volatileRes.passed_guards?.some(g => g.includes('OCF_SIGN_INVERSION_OBSERVED')), 'Must observe violent OCF sign flip without claiming source verification');
console.log('✅ OCF Sign Inversion & Volatility Guard PASSED!');

// 10. Test Cross-Section Margin Consistency Guard (e.g. The TSLA bug: 10.36% vs 3.9%)
console.log('➡️ Testing Cross-Section Margin Consistency Guard...');
const reportWithDiscrepancy: Partial<ReportData> = {
  ticker: 'TSLA',
  peer_comparison: {
    peers: [
      { ticker: 'TSLA', net_margin_pct: 3.9, gross_margin_pct: 16.8 } as any
    ]
  } as any,
  five_pillars: {
    profitability: { net_margin_pct: 3.9, gross_margin_pct: 16.8 }
  } as any
};

const conflictingFs: FinancialStatementsData = {
  periods: ['Q2 2026'],
  income_statement: {
    revenue: [30120],
    gross_profit: [6320], // 20.9% vs 16.8% in peer comparison
    net_income: [3120]    // 10.36% vs 3.9% in peer comparison -> DISCREPANCY!
  },
  balance_sheet: { total_assets: [140000], total_liabilities: [55000], total_equity: [85000] },
  cash_flow: {}
};

const discrepancyRes = validateFinancialStatements(conflictingFs, 'standard', reportWithDiscrepancy as ReportData, 'TSLA');
assert.ok(discrepancyRes.failed_guards?.some(g => g.includes('CROSS_SECTION_NET_MARGIN_DISCREPANCY')), 'Must catch Net Margin discrepancy between Income Statement and Peer Comparison');
assert.ok(discrepancyRes.failed_guards?.some(g => g.includes('CROSS_SECTION_GROSS_MARGIN_DISCREPANCY')), 'Must catch Gross Margin discrepancy');
assert.equal(discrepancyRes.ratio_reliability_warning, true, 'Must activate ratio reliability warning when cross-section discrepancy exists');

const consistentFs: FinancialStatementsData = {
  periods: ['Q2 2026'],
  income_statement: {
    revenue: [28236],
    gross_profit: [4750], // 16.8%
    net_income: [1114]    // 3.95% (~3.9%)
  },
  balance_sheet: {
    total_assets: [147863],
    total_liabilities: [61005],
    total_equity: [86858],
    common_stock: [45800],
    retained_earnings: [41231],
    aoci: [-173],
    goodwill: [520],
    net_ppe: [47800],
    total_debt: [9342],
    short_term_debt: [2450]
  },
  cash_flow: {}
};

const consistentRes = validateFinancialStatements(consistentFs, 'standard', reportWithDiscrepancy as ReportData, 'TSLA');
assert.ok(consistentRes.passed_guards?.some(g => g.includes('CROSS_SECTION_NET_MARGIN_VERIFIED')), 'Must verify consistent Net Margin');
assert.ok(consistentRes.passed_guards?.some(g => g.includes('CROSS_SECTION_GROSS_MARGIN_VERIFIED')), 'Must verify consistent Gross Margin');
assert.ok(consistentRes.passed_guards?.some(g => g.includes('EQUITY_COMPONENT_INTEGRITY_OK')), 'Must verify equity component integrity');
assert.ok(consistentRes.passed_guards?.some(g => g.includes('GOODWILL_POST_MA_PRESENT')), 'Must verify TSLA goodwill present');
console.log('✅ Cross-Section Margin Consistency Guard PASSED!');

// 11. Test Universal M&A Goodwill for Standard/Tech Companies (e.g. TSLA)
console.log('➡️ Testing Universal M&A Goodwill for Non-Banking (TSLA)...');
const tslaMissingGoodwillFs: FinancialStatementsData = {
  periods: ['Q2 2026'],
  income_statement: { revenue: [28236], net_income: [1114] },
  balance_sheet: {
    total_assets: [147863],
    total_liabilities: [61005],
    total_equity: [86858],
    goodwill: [0] // Missing Goodwill despite SolarCity, Maxwell, Grohmann acquisitions!
  },
  cash_flow: {}
};
const tslaGoodwillRes = validateFinancialStatements(tslaMissingGoodwillFs, 'standard', { ticker: 'TSLA' }, 'TSLA');
assert.ok(tslaGoodwillRes.failed_guards?.some(g => g.includes('MISSING_GOODWILL_POST_MA')), 'Must flag missing goodwill for TSLA');
console.log('✅ TSLA Universal M&A Goodwill Check PASSED!');

// 12. Test Net PPE Trend vs CapEx Growth Guard
console.log('➡️ Testing Net PPE Trend vs CapEx Growth Guard...');
const anomalyPpeFs: FinancialStatementsData = {
  periods: ['Q1 2026', 'Q2 2026'],
  income_statement: { revenue: [22000, 28000], net_income: [500, 1100] },
  balance_sheet: {
    total_assets: [140000, 145000],
    total_liabilities: [55000, 58000],
    total_equity: [85000, 87000],
    net_ppe: [45000, 30000] // Severe drop (-33%) despite heavy CapEx!
  },
  cash_flow: {
    capex: [2500, 5800], // High CapEx ($8,300M total)
    depreciation: [1200, 1400] // D&A only $2,600M
  }
};
const ppeAnomalyRes = validateFinancialStatements(anomalyPpeFs, 'standard', { ticker: 'TSLA' }, 'TSLA');
assert.ok(ppeAnomalyRes.failed_guards?.some(g => g.includes('NET_PPE_TREND_ANOMALY')), 'Must catch Net PPE collapsing backward while CapEx > D&A');
console.log('✅ Net PPE Trend vs CapEx Growth Guard PASSED!');

console.log('🎉 ALL STATEMENT VALIDATOR & IMPOSSIBLE-VALUE GUARD TESTS PASSED SUCCESSFULLY!');
