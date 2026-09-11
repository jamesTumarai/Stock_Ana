import assert from 'node:assert/strict';
import { validateAndPrepareReport } from './reportValidation';
import { validateFinancialStatements } from './statementValidator';
import type { FinancialStatementsData, ReportData } from '../types';

console.log('Running financial data coverage and validation regression checks...');

// 1. Fresh report with generated_at must not trigger MISSING_GENERATED_AT
const sampleInput = {
  ticker: 'MSFT',
  generated_at: new Date().toISOString(),
  analysis_type: 'combined',
  company_profile: {
    stock_price: 490,
  },
  intrinsic_value: {
    current_price: 490,
    summary: {
      base_case_fair_value: 500,
    },
  },
};

const validated = validateAndPrepareReport(sampleInput as unknown as ReportData, 'MSFT', {
  requireMarketSnapshot: false,
});

assert.ok(validated.report, 'Report should be prepared successfully');
assert.ok(
  !validated.validation.issues.some((i) => i.code === 'MISSING_GENERATED_AT'),
  'Fresh report with generated_at should not have MISSING_GENERATED_AT issue',
);

// 2. Banking template validation with canonical banking metrics (e.g. SOFI)
const bankingFs: FinancialStatementsData = {
  currency: 'USD',
  periods: ['Q1 2026', 'Q2 2026'],
  income_statement: {
    revenue: [1000, 1100],
    cogs: [200, 220],
    net_interest_income: [500, 550],
    non_interest_income: [500, 550],
    provision_for_credit_losses: [50, 60],
    operating_expenses: [700, 750],
    operating_income: [250, 290],
    net_income: [200, 230],
  },
  balance_sheet: {
    total_assets: [30000, 32000],
    cash_and_equivalents: [5000, 6000],
    deposits: [22000, 24000],
    loans_held_for_investment: [20000, 21000],
    total_liabilities: [25000, 26500],
    total_equity: [5000, 5500],
    goodwill: [1200, 1200],
  },
  cash_flow: {
    operating_cash_flow: [400, 450],
    capex: [50, 60],
    free_cash_flow: [350, 390],
  },
};

const bankingSummary = validateFinancialStatements(bankingFs, 'banking', { ticker: 'SOFI' }, 'SOFI');
assert.ok(
  !bankingSummary.failed_guards?.some((g) => g.includes('UNSUITABLE_TEMPLATE_DETECTED')),
  'Banking template with net_interest_income should not fail UNSUITABLE_TEMPLATE_DETECTED',
);
assert.ok(
  !bankingSummary.failed_guards?.some((g) => g.includes('CRITICAL_BANKING_GUARD_FAILED')),
  'Assets >= Deposits should not trigger CRITICAL_BANKING_GUARD_FAILED',
);
assert.ok(
  bankingSummary.passed_guards?.some((g) => g.includes('BANKING_ASSETS_GE_DEPOSITS_OK')),
  'Banking sanity guard should pass',
);
assert.ok(
  bankingSummary.passed_guards?.some((g) => g.includes('GOODWILL_POST_MA_PRESENT')),
  'Goodwill post M&A check should pass for SOFI when goodwill is present',
);

// 3. Established profitable corporation with goodwill and equity components (e.g. MSFT)
const corporateFs: FinancialStatementsData = {
  currency: 'USD',
  periods: ['FY2025', 'FY2026'],
  income_statement: {
    revenue: [245000, 280000],
    cogs: [75000, 85000],
    gross_profit: [170000, 195000],
    operating_expenses: [60000, 70000],
    operating_income: [110000, 125000],
    net_income: [90000, 105000],
  },
  balance_sheet: {
    total_assets: [500000, 550000],
    cash_and_equivalents: [80000, 90000],
    goodwill: [70000, 75000],
    total_liabilities: [240000, 260000],
    total_equity: [260000, 290000],
    common_stock: [100000, 110000],
    retained_earnings: [160000, 180000],
  },
  cash_flow: {
    operating_cash_flow: [120000, 135000],
    capex: [30000, 35000],
    free_cash_flow: [90000, 100000],
  },
};

const corpSummary = validateFinancialStatements(corporateFs, 'standard', { ticker: 'MSFT' }, 'MSFT');
assert.ok(
  !corpSummary.failed_guards?.some((g) => g.includes('MISSING_GOODWILL_POST_MA')),
  'Goodwill should not be reported missing when present in balance sheet',
);
assert.ok(
  !corpSummary.failed_guards?.some((g) => g.includes('MISSING_RETAINED_EARNINGS')),
  'Retained earnings should not be reported missing when present in balance sheet',
);
assert.ok(
  !corpSummary.failed_guards?.some((g) => g.includes('MISSING_COMMON_STOCK')),
  'Common stock should not be reported missing when present in balance sheet',
);
assert.ok(
  corpSummary.passed_guards?.some((g) => g.includes('GOODWILL_POST_MA_PRESENT')),
  'Goodwill check should pass for MSFT',
);
assert.ok(
  corpSummary.passed_guards?.some((g) => g.includes('RETAINED_EARNINGS_PRESENT')),
  'Retained earnings check should pass for MSFT',
);
assert.ok(
  corpSummary.passed_guards?.some((g) => g.includes('COMMON_STOCK_PRESENT')),
  'Common stock check should pass for MSFT',
);

console.log('Financial data coverage and validation regression checks passed');
