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
    },
  ];

  it('computes factual YoY deltas without hallucinating numbers', () => {
    const diff = diffSecFinancialStatements(mockAnnualStatements as any, false);
    assert.ok(diff, 'Diff must not be null');

    assert.equal(diff.currentPeriod, 'FY2025');
    assert.equal(diff.priorPeriod, 'FY2024');

    // Revenue YoY: (280000 - 245000) / 245000 = +14.29%
    assert.equal(diff.revenueYoYPct, 14.29);

    // Net Income YoY: (100000 - 88000) / 88000 = +13.64%
    assert.equal(diff.netIncomeYoYPct, 13.64);

    // OCF YoY: (140000 - 118000) / 118000 = +18.64%
    assert.equal(diff.ocfYoYPct, 18.64);

    // Operating margin expansion: (130/280) - (109/245) = 46.43% - 44.49% = +194 bps
    assert.ok(diff.operatingMarginBpsDelta > 180 && diff.operatingMarginBpsDelta < 210);

    // Shares reduction (buybacks): from 7450 to 7400 = -0.67%
    assert.equal(diff.shareCountDeltaPct, -0.67);
    assert.equal(diff.dilutionOrBuyback, 'buybacks');
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
  });

  it('returns null if fewer than 2 periods are available', () => {
    const single = [mockAnnualStatements[0]];
    const diff = diffSecFinancialStatements(single as any, false);
    assert.equal(diff, null);
  });
});
