import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { harmonizeReportData } from '../../metricsHarmonizer';
import { ReportData } from '../../../types';

console.log('🚀 Running Financial Statements & Key Indicators Harmonization Test Suite...');

function createMockReport(ticker: string, overrides: Partial<ReportData> = {}): ReportData {
  return {
    ticker,
    company_profile: {
      name: ticker,
      stock_price: 25,
      market_cap: '$24.0B',
      ...overrides.company_profile
    },
    financial_statements: {
      currency: 'USD',
      fiscal_period_type: 'quarterly',
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      income_statement: {
        revenue: [100, 120, 140, 160],
        net_income: [10, 15, 20, 25],
        ...overrides.financial_statements?.income_statement
      },
      balance_sheet: {
        total_assets: [1000, 1100, 1200, 1300],
        total_equity: [600, 650, 700, 750],
        ...overrides.financial_statements?.balance_sheet
      },
      cash_flow: {
        operating_cash_flow: [20, 25, 30, 35],
        capex: [5, 5, 5, 5],
        ...overrides.financial_statements?.cash_flow
      }
    },
    ...overrides
  } as ReportData;
}

// 1. Test SOFI Financial Statements Grounding
console.log('➡️ Testing SOFI (FinTech/Banking) Grounding & Identities...');
const sofiReport = harmonizeReportData(createMockReport('SOFI'), 'SOFI');
const sofiFs = sofiReport.financial_statements!;
assert.equal(sofiFs.periods.length, 4);
assert.equal(sofiFs.statement_template, 'banking');
assert.equal(sofiFs.income_statement.revenue[3], 1220);
assert.equal(sofiFs.income_statement.net_income[3], 156.6);
assert.equal(sofiFs.balance_sheet.total_assets![3], 56600);
assert.equal(sofiFs.balance_sheet.deposits![3], 45500);
assert.ok(sofiFs.balance_sheet.total_assets![3] >= sofiFs.balance_sheet.deposits![3], 'Total Assets must be >= Total Deposits');
assert.equal(sofiFs.balance_sheet.goodwill![3], 1450);
assert.equal(sofiFs.balance_sheet.total_debt![3], 6120);
assert.equal(sofiFs.cash_flow.free_cash_flow![3], 392);
assert.equal(sofiFs.income_statement.cogs, undefined, 'Banks must not have COGS');
assert.equal(sofiFs.validation_summary?.impossible_guards_passed, true);
assert.equal(sofiFs.validation_summary?.is_balanced, true);
console.log('✅ SOFI Grounding & Banking Identities PASSED!');

// 2. Test PLTR Zero-Debt and FCF Grounding
console.log('➡️ Testing PLTR (Software/AIP) Grounding & Zero Debt...');
const pltrReport = harmonizeReportData(createMockReport('PLTR'), 'PLTR');
const pltrFs = pltrReport.financial_statements!;
assert.equal(pltrFs.income_statement.revenue[3], 1004);
assert.equal(pltrFs.balance_sheet.total_debt![3], 0);
assert.equal(pltrFs.balance_sheet.current_ratio![3], 7.94);
assert.equal(pltrFs.cash_flow.free_cash_flow![3], 612);
console.log('✅ PLTR Grounding & Zero Debt PASSED!');

// 3. Test EOSE Small-Cap Scale Normalization (< $100M revenue stays in Millions, never multiplied by 1000)
console.log('➡️ Testing EOSE (Small-Cap Clean Tech) Scale Protection...');
const eoseReport = harmonizeReportData(createMockReport('EOSE', {
  company_profile: { stock_price: 3.65, market_cap: '$1.32B' }
}), 'EOSE');
const eoseFs = eoseReport.financial_statements!;
// Revenue must remain in Millions (32.5M), NOT $32,500M ($32.5B)!
assert.equal(eoseFs.income_statement.revenue[3], 32.5);
assert.ok(eoseFs.income_statement.revenue[3] < 100, 'EOSE revenue must not be multiplied by 1000');
assert.equal(eoseFs.balance_sheet.total_assets![3], 410);
console.log('✅ EOSE Small-Cap Scale Protection PASSED!');

// 4. Test GAAP Deduction when COGS or OpEx is missing
console.log('➡️ Testing Automatic GAAP Deduction for Missing Items...');
const customReport = createMockReport('CUSTOM', {
  financial_statements: {
    currency: 'USD',
    periods: ['Q1 2026'],
    income_statement: {
      revenue: [500],
      gross_profit: [300], // COGS missing
      operating_income: [180], // OpEx missing
      net_income: [120]
    },
    balance_sheet: {
      total_assets: [2000],
      total_equity: [1400], // Total liabilities missing
      total_debt: [200]
    },
    cash_flow: {
      operating_cash_flow: [150],
      capex: [30] // FCF missing
    }
  } as any
});
const harmonizedCustom = harmonizeReportData(customReport, 'CUSTOM');
const customFs = harmonizedCustom.financial_statements!;
// COGS should be deduced as 500 - 300 = 200
assert.equal(customFs.income_statement.cogs![0], 200);
// OpEx should be deduced as 300 - 180 = 120
assert.equal(customFs.income_statement.operating_expenses![0], 120);
// Total Liabilities should be deduced as 2000 - 1400 = 600
assert.equal(customFs.balance_sheet.total_liabilities![0], 600);
// FCF should be deduced as 150 - 30 = 120
assert.equal(customFs.cash_flow.free_cash_flow![0], 120);
console.log('✅ Automatic GAAP Deduction for Missing Items PASSED!');

// 5. Test TSLA (Tesla) SEC 8-K/10-Q Grounding & Cross-Section Margin Synchronization
console.log('➡️ Testing TSLA (Tesla) SEC 8-K Grounding & Cross-Section Margin Sync...');
const tslaReport = harmonizeReportData(createMockReport('TSLA', {
  peer_comparison: {
    peers: [
      { ticker: 'TSLA', company_name: 'Tesla Inc.' } as any,
      { ticker: 'BYDDF', company_name: 'BYD' } as any
    ]
  } as any
}), 'TSLA');
const tslaFs = tslaReport.financial_statements!;
// 1. Q2 2026 Revenue = $28,236M ($28.24B)
assert.equal(tslaFs.income_statement.revenue[3], 28236);
// 2. Q2 2026 Gross Margin = 16.8%
assert.equal(tslaFs.income_statement.gross_margin_pct[3], 16.8);
// 3. Q2 2026 Operating Income = $398M (1.4% margin)
assert.equal(tslaFs.income_statement.operating_income[3], 398);
assert.equal(tslaFs.income_statement.operating_margin_pct[3], 1.4);
// 4. Q2 2026 Net Income = $1,114M (~3.9% margin)
assert.equal(tslaFs.income_statement.net_income[3], 1114);
assert.equal(tslaFs.income_statement.net_margin_pct[3], 3.9);
// 5. Q2 2026 Diluted EPS = $0.32
assert.equal(tslaFs.income_statement.eps_diluted[3], 0.32);
// 6. Q2 2026 CapEx = $5,790M and FCF = -$1,090M (Deficit)
assert.equal(tslaFs.cash_flow.capex![3], 5790);
assert.equal(tslaFs.cash_flow.free_cash_flow![3], -1090);
// 7. Cross-Section Margin Sync: Peer Comparison & Five Pillars MUST match Financial Statements
const tslaPeer = tslaReport.peer_comparison?.peers?.find(p => p.ticker === 'TSLA');
assert.equal(tslaPeer?.net_margin_pct, 3.9, 'Peer Comparison TSLA net margin must match 3.9%');
assert.equal(tslaPeer?.gross_margin_pct, 16.8, 'Peer Comparison TSLA gross margin must match 16.8%');
assert.equal(tslaReport.five_pillars?.profitability?.net_margin_pct, 3.9, 'Five Pillars net margin must match 3.9%');
assert.equal(tslaReport.five_pillars?.profitability?.gross_margin_pct, 16.8, 'Five Pillars gross margin must match 16.8%');

// 8. TSLA SEC Form 10-Q Authentic Balance Sheet Grounding & Bottom-Up Equity
// Cash & ST Investments Q3 2025 = $18,289M cash + $23,358M ST investments = $41,647M ($41.647B)
assert.equal(tslaFs.balance_sheet.cash_and_equivalents![0], 18289, 'Q3 2025 cash must be $18,289M');
assert.equal(tslaFs.balance_sheet.short_term_investments![0], 23358, 'Q3 2025 ST investments must be $23,358M');

// Net PPE: Must grow monotonically and match SEC 10-Q ($43,213M in Q1 2026, > $37,088M from March 2025)
assert.equal(tslaFs.balance_sheet.net_ppe![0], 39850, 'Q3 2025 Net PPE must be $39,850M (> $37.088B at March 2025)');
assert.equal(tslaFs.balance_sheet.net_ppe![2], 43213, 'Q1 2026 Net PPE must be $43,213M exact from 10-Q');
assert.equal(tslaFs.balance_sheet.net_ppe![3], 47800, 'Q2 2026 Net PPE must be $47,800M');
assert.ok(
  tslaFs.balance_sheet.net_ppe![0]! < tslaFs.balance_sheet.net_ppe![1]! &&
  tslaFs.balance_sheet.net_ppe![1]! < tslaFs.balance_sheet.net_ppe![2]! &&
  tslaFs.balance_sheet.net_ppe![2]! < tslaFs.balance_sheet.net_ppe![3]!,
  'Net PPE must strictly grow across quarters due to CapEx > D&A'
);

// Goodwill and Intangibles: Must be populated ($520M from SolarCity/Grohmann/Maxwell M&A)
assert.equal(tslaFs.balance_sheet.goodwill![3], 520, 'Goodwill must not be empty or null');

// Retained Earnings & Common Stock: Must be populated, not empty or plug figures
assert.equal(tslaFs.balance_sheet.retained_earnings![3], 41231, 'Retained earnings must be $41,231M');
assert.equal(tslaFs.balance_sheet.common_stock![3], 45800, 'Common stock must be $45,800M');

// Total Liabilities & Total Equity: Q1 2026 ($58.92B / $84.80B) and Q2 2026 ($61.01B / $86.86B)
assert.equal(tslaFs.balance_sheet.total_liabilities![2], 58922, 'Q1 2026 Liabilities must be $58,922M ($58.92B)');
assert.equal(tslaFs.balance_sheet.total_liabilities![3], 61005, 'Q2 2026 Liabilities must be $61,005M ($61.01B)');
assert.equal(tslaFs.balance_sheet.total_equity![2], 84800, 'Q1 2026 Equity must be $84,800M ($84.80B)');
assert.equal(tslaFs.balance_sheet.total_equity![3], 86858, 'Q2 2026 Equity must be $86,858M ($86.86B)');

// Total Debt: Must cover finance lease obligations ($9,342M in Q2 2026)
assert.equal(tslaFs.balance_sheet.total_debt![3], 9342, 'Q2 2026 Total Debt must be $9,342M exact');

// Balance Sheet Identity check across all quarters
for (let i = 0; i < 4; i++) {
  const ta = tslaFs.balance_sheet.total_assets![i]!;
  const tl = tslaFs.balance_sheet.total_liabilities![i]!;
  const te = tslaFs.balance_sheet.total_equity![i]!;
  assert.equal(ta, tl + te, `Quarter ${i} Assets (${ta}) must equal Liabilities + Equity (${tl} + ${te})`);
}

console.log('✅ TSLA SEC 8-K/10-Q Grounding & Cross-Section Margin Sync PASSED!');

console.log('🎉 ALL FINANCIAL STATEMENTS & KEY INDICATORS TESTS PASSED SUCCESSFULLY!');
