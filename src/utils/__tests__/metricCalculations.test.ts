import assert from 'node:assert/strict';
import { getMetricCalculationDetail } from '../metricCalculations';
import { FinancialStatementsData } from '../../types';

const mockData: FinancialStatementsData = {
  periods: ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4'],
  income_statement: {
    revenue: [1000, 1200, 1100, 1300],
    gross_profit: [600, 750, 700, 850],
    operating_income: [250, 300, 280, 360],
    net_income: [200, 240, 220, 290],
  },
  balance_sheet: {
    total_assets: [5000, 5200, 5300, 5500],
    total_current_assets: [2000, 2100, 2200, 2400],
    cash_and_equivalents: [800, 850, 900, 1000],
    short_term_investments: [200, 250, 200, 300],
    receivables: [500, 550, 600, 650],
    total_current_liabilities: [1000, 1050, 1100, 1200],
    total_debt: [1500, 1500, 1400, 1300],
    total_equity: [3000, 3200, 3400, 3600],
  },
  cash_flow: {
    operating_cash_flow: [300, 350, 320, 420],
    capex: [-100, -120, -110, -140],
    free_cash_flow: [200, 230, 210, 280],
  },
};

// 1. Free Cash Flow
const fcfDetail = getMetricCalculationDetail('free_cash_flow', 3, mockData);
assert(fcfDetail !== null, 'FCF detail should not be null');
assert.equal(fcfDetail.key, 'free_cash_flow');
assert.equal(fcfDetail.category, 'cash_flow');
assert.equal(fcfDetail.resultValue, 280); // 420 - 140
assert.equal(fcfDetail.variables.length, 2);
assert.equal(fcfDetail.variables[0].value, 420);
assert.equal(fcfDetail.variables[1].value, 140);
console.log('✓ getMetricCalculationDetail - free_cash_flow verified');

// 2. Gross Margin
const gmDetail = getMetricCalculationDetail('gross_margin', 3, mockData);
assert(gmDetail !== null, 'Gross margin detail should not be null');
assert.equal(gmDetail.key, 'gross_margin');
assert.equal(gmDetail.category, 'profitability');
assert.equal(gmDetail.resultValue, 65.38); // (850 / 1300) * 100
assert.equal(gmDetail.variables[0].value, 850);
assert.equal(gmDetail.variables[1].value, 1300);
console.log('✓ getMetricCalculationDetail - gross_margin verified');

// 3. Operating Margin
const opmDetail = getMetricCalculationDetail('operating_margin', 3, mockData);
assert(opmDetail !== null, 'Operating margin detail should not be null');
assert.equal(opmDetail.key, 'operating_margin');
assert.equal(opmDetail.resultValue, 27.69); // (360 / 1300) * 100
console.log('✓ getMetricCalculationDetail - operating_margin verified');

// 4. Net Margin
const nmDetail = getMetricCalculationDetail('net_margin', 3, mockData);
assert(nmDetail !== null, 'Net margin detail should not be null');
assert.equal(nmDetail.key, 'net_margin');
assert.equal(nmDetail.resultValue, 22.31); // (290 / 1300) * 100
console.log('✓ getMetricCalculationDetail - net_margin verified');

// 5. Current Ratio
const crDetail = getMetricCalculationDetail('current_ratio', 3, mockData);
assert(crDetail !== null, 'Current ratio detail should not be null');
assert.equal(crDetail.key, 'current_ratio');
assert.equal(crDetail.resultValue, 2.0); // 2400 / 1200
console.log('✓ getMetricCalculationDetail - current_ratio verified');

// 6. Quick Ratio
const qrDetail = getMetricCalculationDetail('quick_ratio', 3, mockData);
assert(qrDetail !== null, 'Quick ratio detail should not be null');
assert.equal(qrDetail.key, 'quick_ratio');
assert.equal(qrDetail.resultValue, 1.63); // (1000 + 300 + 650) / 1200 = 1950 / 1200

// Quick Ratio fails closed if cash is missing
const mockMissingCash: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    cash_and_equivalents: [null as any, null as any, null as any, null as any]
  }
};
const qrMissingCash = getMetricCalculationDetail('quick_ratio', 3, mockMissingCash);
assert.equal(qrMissingCash.resultValue, null, 'Quick ratio must be null when cash is missing');

// Quick Ratio fails closed if receivables are missing
const mockMissingRec: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    receivables: [null as any, null as any, null as any, null as any]
  }
};
const qrMissingRec = getMetricCalculationDetail('quick_ratio', 3, mockMissingRec);
assert.equal(qrMissingRec.resultValue, null, 'Quick ratio must be null when receivables are missing');
console.log('✓ getMetricCalculationDetail - quick_ratio verified');

// 7. Debt to Equity
const deDetail = getMetricCalculationDetail('debt_to_equity', 3, mockData);
assert(deDetail !== null, 'Debt-to-equity detail should not be null');
assert.equal(deDetail.key, 'debt_to_equity');
assert.equal(deDetail.resultValue, 0.36); // 1300 / 3600

// PR D: Debt to Equity missing-vs-zero regression tests
// 7a. STD null + LTD null => unavailable (null)
const mockStdNullLtdNull: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    total_debt: [null as any, null as any, null as any, null as any],
    short_term_debt: [null as any, null as any, null as any, null as any],
    long_term_debt: [null as any, null as any, null as any, null as any],
  },
};
const deStdNullLtdNull = getMetricCalculationDetail('debt_to_equity', 3, mockStdNullLtdNull);
assert.equal(deStdNullLtdNull?.resultValue, null, 'STD null + LTD null must be unavailable (null), not 0.00');

// 7b. STD known + LTD null => unavailable (null)
const mockStdKnownLtdNull: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    total_debt: [null as any, null as any, null as any, null as any],
    short_term_debt: [100, 100, 100, 100],
    long_term_debt: [null as any, null as any, null as any, null as any],
  },
};
const deStdKnownLtdNull = getMetricCalculationDetail('debt_to_equity', 3, mockStdKnownLtdNull);
assert.equal(deStdKnownLtdNull?.resultValue, null, 'STD known + LTD null must be unavailable (null)');

// 7c. STD null + LTD known => unavailable (null)
const mockStdNullLtdKnown: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    total_debt: [null as any, null as any, null as any, null as any],
    short_term_debt: [null as any, null as any, null as any, null as any],
    long_term_debt: [200, 200, 200, 200],
  },
};
const deStdNullLtdKnown = getMetricCalculationDetail('debt_to_equity', 3, mockStdNullLtdKnown);
assert.equal(deStdNullLtdKnown?.resultValue, null, 'STD null + LTD known must be unavailable (null)');

// 7d. STD verified 0 + LTD 100 => valid (0.03 for 100 / 3600)
const mockStdZeroLtd100: FinancialStatementsData = {
  ...mockData,
  balance_sheet: {
    ...mockData.balance_sheet!,
    total_debt: [null as any, null as any, null as any, null as any],
    short_term_debt: [0, 0, 0, 0],
    long_term_debt: [100, 100, 100, 100],
  },
};
const deStdZeroLtd100 = getMetricCalculationDetail('debt_to_equity', 3, mockStdZeroLtd100);
assert.equal(deStdZeroLtd100?.resultValue, 0.03, 'STD verified 0 + LTD 100 must be valid (100 / 3600 = 0.03)');

// 7e. verified total_debt => valid (0.36 for 1300 / 3600)
assert.equal(deDetail.resultValue, 0.36, 'verified total_debt must be valid');
console.log('✓ getMetricCalculationDetail - debt_to_equity verified (including missing-vs-zero)');

// 8. Margin of Safety (Valuation Context)
const mosDetail = getMetricCalculationDetail('margin_of_safety', 0, undefined, {
  currentPrice: 100,
  fairValue: 125,
});
assert(mosDetail !== null, 'Margin of Safety detail should not be null');
assert.equal(mosDetail.key, 'margin_of_safety');
assert.equal(mosDetail.category, 'valuation');
assert.equal(mosDetail.resultValue, 25.0); // ((125 - 100) / 100) * 100
console.log('✓ getMetricCalculationDetail - margin_of_safety verified');

// 9. Unknown metric key returns null
const unknownDetail = getMetricCalculationDetail('non_existent_ratio', 0, mockData);
assert.equal(unknownDetail, null, 'Unknown key should return null');
console.log('✓ getMetricCalculationDetail - unknown key returns null');

console.log('All metric calculations tests passed cleanly.');
