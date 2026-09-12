import assert from 'node:assert/strict';
import {
  parseQuarterPeriod,
  findAggregationWindows,
  sumFlowMetric,
  takeInstantMetric,
  aggregateQuarterlyToAnnual
} from '../statementAggregation';
import type { FinancialStatementsData } from '../../types';

// 1. Period Parsing Tests
assert.deepEqual(parseQuarterPeriod('Q1 2024', 0), { raw: 'Q1 2024', year: 2024, quarter: 1, index: 0 });
assert.deepEqual(parseQuarterPeriod('Q4-2023', 3), { raw: 'Q4-2023', year: 2023, quarter: 4, index: 3 });
assert.deepEqual(parseQuarterPeriod('2024-Q2', 1), { raw: '2024-Q2', year: 2024, quarter: 2, index: 1 });
assert.deepEqual(parseQuarterPeriod('Q3 24', 2), { raw: 'Q3 24', year: 2024, quarter: 3, index: 2 });
assert.equal(parseQuarterPeriod('InvalidPeriod', 0), null);

// 2. Window Detection Tests
const fullFyPeriods = ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'];
const fyWindows = findAggregationWindows(fullFyPeriods);
assert.equal(fyWindows.length, 1);
assert.equal(fyWindows[0].label, 'FY 2024');
assert.equal(fyWindows[0].kind, 'annual_fy');
assert.deepEqual(fyWindows[0].quarterIndices, [0, 1, 2, 3]);

const trailingPeriods = ['Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024'];
const ltmWindows = findAggregationWindows(trailingPeriods);
assert.equal(ltmWindows.length, 1);
assert.match(ltmWindows[0].label, /LTM/);
assert.equal(ltmWindows[0].kind, 'ltm');
assert.deepEqual(ltmWindows[0].quarterIndices, [0, 1, 2, 3]);

// Insufficient periods (< 4)
assert.equal(findAggregationWindows(['Q1 2024', 'Q2 2024', 'Q3 2024']).length, 0);

// Gapped quarters must be rejected (no LTM created)
const gappedPeriods = ['Q1 2024', 'Q2 2024', 'Q4 2024', 'Q1 2025'];
assert.equal(findAggregationWindows(gappedPeriods).length, 0);

// Duplicate quarters must be rejected
const duplicatePeriods = ['Q1 2024', 'Q2 2024', 'Q2 2024', 'Q3 2024'];
assert.equal(findAggregationWindows(duplicatePeriods).length, 0);

// Annual periods must be rejected
const annualPeriods = ['2021', '2022', '2023', '2024'];
assert.equal(findAggregationWindows(annualPeriods).length, 0);
assert.equal(findAggregationWindows(['FY 2021', 'FY 2022', 'FY 2023', 'FY 2024']).length, 0);

// Malformed periods must be rejected
const malformedPeriods = ['Q1 2024', 'UNKNOWN_PERIOD', 'Q3 2024', 'Q4 2024'];
assert.equal(findAggregationWindows(malformedPeriods).length, 0);

// Exactly four period fallback removed: 4 arbitrary periods do not produce LTM
const arbitraryFourPeriods = ['Period 1', 'Period 2', 'Period 3', 'Period 4'];
assert.equal(findAggregationWindows(arbitraryFourPeriods).length, 0);

// 3. Flow Summation Tests (Strict Fail-Closed)
assert.equal(sumFlowMetric([100, 120, 130, 150], [0, 1, 2, 3]), 500);
// Missing one quarter must return null, never fabricate or ignore!
assert.equal(sumFlowMetric([100, null, 130, 150], [0, 1, 2, 3]), null);
assert.equal(sumFlowMetric([100, 120, undefined, 150], [0, 1, 2, 3]), null);

// 4. Instant Stock Metric (Ending Quarter Balance)
assert.equal(takeInstantMetric([10, 20, 30, 45], 3), 45);
assert.equal(takeInstantMetric([10, 20, 30, null], 3), null);

// 5. Full End-to-End Statement Aggregation Test
const sampleQuarterlyData: FinancialStatementsData = {
  periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
  income_statement: {
    revenue: [1000, 1200, 1100, 1500],
    gross_profit: [600, 720, 660, 900],
    operating_income: [300, 360, 330, 450],
    net_income: [200, 240, 220, 300],
    eps_diluted: [0.50, 0.60, 0.55, 0.75],
  },
  balance_sheet: {
    cash_and_equivalents: [500, 520, 550, 600],
    total_current_assets: [1500, 1600, 1650, 1800],
    total_assets: [4000, 4200, 4300, 4500],
    short_term_debt: [100, 100, 120, 150],
    long_term_debt: [800, 800, 750, 750],
    total_debt: [900, 900, 870, 900],
    total_current_liabilities: [600, 650, 700, 720],
    total_liabilities: [1800, 1900, 1950, 2000],
    total_equity: [2200, 2300, 2350, 2500],
  },
  cash_flow: {
    operating_cash_flow: [250, 300, 280, 400],
    capex: [-50, -60, -70, -80],
    free_cash_flow: [200, 240, 210, 320],
    stock_based_compensation: [30, 35, 40, 45],
    beginning_cash: [450, 500, 520, 550],
    ending_cash: [500, 520, 550, 600],
  },
};

const annualResult = aggregateQuarterlyToAnnual(sampleQuarterlyData);
assert.ok(annualResult);
assert.equal(annualResult.fiscal_period_type, 'annual');
assert.deepEqual(annualResult.periods, ['FY 2024']);

// Verify Income Statement Sums
assert.deepEqual(annualResult.income_statement.revenue, [4800]);
assert.deepEqual(annualResult.income_statement.gross_profit, [2880]);
assert.deepEqual(annualResult.income_statement.operating_income, [1440]);
assert.deepEqual(annualResult.income_statement.net_income, [960]);
assert.deepEqual(annualResult.income_statement.eps_diluted, [2.40]);
assert.deepEqual(annualResult.income_statement.gross_margin_pct, [60]);
assert.deepEqual(annualResult.income_statement.operating_margin_pct, [30]);
assert.deepEqual(annualResult.income_statement.net_margin_pct, [20]);

// Verify Balance Sheet Ending Balances
assert.deepEqual(annualResult.balance_sheet.cash_and_equivalents, [600]);
assert.deepEqual(annualResult.balance_sheet.total_assets, [4500]);
assert.deepEqual(annualResult.balance_sheet.total_debt, [900]);
assert.deepEqual(annualResult.balance_sheet.total_equity, [2500]);
assert.deepEqual(annualResult.balance_sheet.current_ratio, [2.5]);
assert.deepEqual(annualResult.balance_sheet.debt_to_equity, [0.36]);

// Verify Cash Flow Sums and Cash Positions
assert.deepEqual(annualResult.cash_flow.operating_cash_flow, [1230]);
assert.deepEqual(annualResult.cash_flow.capex, [-260]);
assert.deepEqual(annualResult.cash_flow.free_cash_flow, [970]);
assert.deepEqual(annualResult.cash_flow.stock_based_compensation, [150]);
assert.deepEqual(annualResult.cash_flow.beginning_cash, [450]);
assert.deepEqual(annualResult.cash_flow.ending_cash, [600]);
// Verify already-annual data is rejected
assert.equal(aggregateQuarterlyToAnnual({ fiscal_period_type: 'annual', periods: ['2021', '2022', '2023', '2024'] } as any), null);

console.log('✓ statementAggregation unit tests passed completely.');
