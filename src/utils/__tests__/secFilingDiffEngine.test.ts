import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffSecFinancialStatements,
  type SecFilingPeriodDiff,
} from '../secFilingDiffEngine';

describe('secFilingDiffEngine', () => {
  const mockAnnualStatements = [
    {
      period: 'FY2025',
      fiscal_year: 2025,
      revenue: 280000,
      operating_income: 130000,
      net_income: 100000,
      operating_cash_flow: 140000,
      capital_expenditure: -35000,
      total_debt: 75000,
      stockholders_equity: 220000,
      diluted_shares: 7400,
      accounts_receivable: 35000,
    },
    {
      period: 'FY2024',
      fiscal_year: 2024,
      revenue: 245000,
      operating_income: 109000,
      net_income: 88000,
      operating_cash_flow: 118000,
      capital_expenditure: -28000,
      total_debt: 80000,
      stockholders_equity: 200000,
      diluted_shares: 7450,
      accounts_receivable: 32000,
    },
  ];

  it('computes factual YoY deltas without hallucinating numbers', () => {
    const diff = diffSecFinancialStatements(mockAnnualStatements as any, false);
    assert.ok(diff, 'Diff must not be null');

    assert.equal(diff.currentPeriod, 'FY2025');
    assert.equal(diff.priorPeriod, 'FY2024');
    assert.equal(diff.comparisonType, 'annual_yoy');

    // Revenue YoY: (280000 - 245000) / 245000 = +14.29%
    assert.equal(diff.revenueYoYPct, 14.29);

    // Net Income YoY: (100000 - 88000) / 88000 = +13.64%
    assert.equal(diff.netIncomeYoYPct, 13.64);

    // OCF YoY: (140000 - 118000) / 118000 = +18.64%
    assert.equal(diff.ocfYoYPct, 18.64);

    // FCF = 140000 - 35000 = 105000 vs 118000 - 28000 = 90000: (105 - 90) / 90 = +16.67%
    assert.equal(diff.fcfYoYPct, 16.67);

    // Operating margin expansion: (130/280) - (109/245) = 46.43% - 44.49% = +194 bps
    assert.ok(diff.operatingMarginBpsDelta !== null && diff.operatingMarginBpsDelta > 180 && diff.operatingMarginBpsDelta < 210);

    // Shares reduction (buybacks): from 7450 to 7400 = -0.67%
    assert.equal(diff.shareCountDeltaPct, -0.67);
    assert.equal(diff.dilutionOrBuyback, 'buybacks');

    // Factual Cash Conversion Ratio: 140000 / 100000 = 1.40x
    assert.equal(diff.ocfToNetIncomeRatioCurrent, 1.4);
    assert.equal(diff.ocfToNetIncomeRatioPrior, 1.34);
    assert.equal(diff.cashConversionStatus, 'healthy');
    assert.ok(diff.cashConversionSummary.includes('1.4x'));
  });

  it('guarantees chronological ordering independence (ascending vs descending array input)', () => {
    // Pass statements in ascending order: FY2024 first, then FY2025
    const ascendingStatements = [mockAnnualStatements[1], mockAnnualStatements[0]];
    const diff = diffSecFinancialStatements(ascendingStatements as any, false);

    assert.ok(diff);
    assert.equal(diff.currentPeriod, 'FY2025');
    assert.equal(diff.priorPeriod, 'FY2024');
    assert.equal(diff.revenueYoYPct, 14.29); // Must be positive +14.29%, never inverted to negative
  });

  it('correctly matches same-quarter YoY pairs (Q3 2025 vs Q3 2024)', () => {
    const quarterlyStatements = [
      {
        period: 'Q3 2025',
        fiscal_year: 2025,
        revenue: 72000,
        operating_income: 34000,
        net_income: 26000,
        operating_cash_flow: 32000,
        capital_expenditure: -9000,
      },
      {
        period: 'Q3 2024',
        fiscal_year: 2024,
        revenue: 63000,
        operating_income: 28000,
        net_income: 21000,
        operating_cash_flow: 27000,
        capital_expenditure: -7500,
      },
    ];

    const diff = diffSecFinancialStatements(quarterlyStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.currentPeriod, 'Q3 2025');
    assert.equal(diff.priorPeriod, 'Q3 2024');
    assert.equal(diff.comparisonType, 'quarter_yoy');
    assert.equal(diff.revenueYoYPct, 14.29);
  });

  it('fails closed and returns null when periods are mixed and non-comparable', () => {
    // 1 quarter and 1 annual statement cannot be meaningfully compared
    const mixedStatements = [
      {
        period: 'Q3 2025',
        revenue: 72000,
      },
      {
        period: 'FY2024',
        revenue: 245000,
      },
    ];

    const diff = diffSecFinancialStatements(mixedStatements as any, false);
    assert.equal(diff, null, 'Mixed quarter and annual periods must return null');
  });

  it('detects cash conversion health anomaly if revenue grows but OCF drops', () => {
    const divergingStatements = [
      {
        ...mockAnnualStatements[0],
        operating_cash_flow: 90000, // Dropped while revenue increased!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(divergingStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.cashConversionStatus, 'warning');
    assert.ok(diff.cashConversionSummary.includes('Cash conversion divergence'));
  });

  it('detects severe divergence when net income is positive but OCF is negative', () => {
    const cashBurnStatements = [
      {
        ...mockAnnualStatements[0],
        net_income: 40000,
        operating_cash_flow: -15000, // Cash burn despite accounting profit!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(cashBurnStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.cashConversionStatus, 'warning');
    assert.ok(diff.cashConversionSummary.includes('negative operating cash flow'));
  });

  it('identifies working capital expansion when accounts receivable outpaces revenue', () => {
    const arSpikeStatements = [
      {
        ...mockAnnualStatements[0],
        accounts_receivable: 55000, // +71.9% increase vs +14.29% revenue!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(arSpikeStatements as any, false);
    assert.ok(diff);
    assert.ok(diff.workingCapitalNote?.includes('Accounts receivable expanded'));
  });

  it('handles bilingual Thai summary correctly', () => {
    const diffTh = diffSecFinancialStatements(mockAnnualStatements as any, true);
    assert.ok(diffTh);
    assert.ok(diffTh.cashConversionSummary.includes('คุณภาพกระแสเงินสด'));
  });

  it('returns null if fewer than 2 periods are available', () => {
    const single = [mockAnnualStatements[0]];
    const diff = diffSecFinancialStatements(single as any, false);
    assert.equal(diff, null);
  });
});
