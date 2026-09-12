import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decomposeValuationDelta,
  classifyThesisHealth,
  type ValuationDrivers,
} from '../valuationDecompositionEngine';

describe('valuationDecompositionEngine', () => {
  const mockPastReport: any = {
    ticker: 'MSFT',
    report_date: '2025-09-01',
    intrinsic_value: {
      current_price: 350,
      summary: {
        base_case_fair_value: 400,
        margin_of_safety: 12.5,
      },
      dcf_model: {
        scenarios: {
          base: {
            fair_value_per_share: 400,
            wacc_percentage: 9.0,
            terminal_growth_rate_percentage: 3.0,
            projected_growth_rate: 12.0,
            shares_outstanding_millions: 7400,
            net_debt_millions: 20000,
          },
        },
      },
    },
    financial_statements: {
      annual: [
        {
          period: 'FY2024',
          revenue: 245000,
          operating_income: 109000,
          operating_cash_flow: 118000,
        },
      ],
    },
    verdict: {
      conviction_score: 82,
    },
  };

  const mockCurrentReport: any = {
    ticker: 'MSFT',
    report_date: '2026-03-01',
    intrinsic_value: {
      current_price: 410,
      summary: {
        base_case_fair_value: 460,
        margin_of_safety: 10.9,
      },
      dcf_model: {
        scenarios: {
          base: {
            fair_value_per_share: 460,
            wacc_percentage: 8.5,
            terminal_growth_rate_percentage: 3.2,
            projected_growth_rate: 14.0,
            shares_outstanding_millions: 7350,
            net_debt_millions: 15000,
          },
        },
      },
    },
    financial_statements: {
      annual: [
        {
          period: 'FY2025',
          revenue: 275000,
          operating_income: 125000,
          operating_cash_flow: 135000,
        },
      ],
    },
    verdict: {
      conviction_score: 88,
    },
  };

  it('decomposes fair value change into empirical drivers accurately via sequential bridge', () => {
    const decomposition: any = decomposeValuationDelta(mockCurrentReport, mockPastReport, false);
    assert.ok(decomposition, 'Decomposition must not be null');
    assert.equal(decomposition.isAvailable, true);

    assert.equal(decomposition.previousFairValue, 400);
    assert.equal(decomposition.currentFairValue, 460);
    assert.equal(decomposition.totalDeltaDollars, 60);
    assert.equal(decomposition.totalDeltaPct, 15.0);

    // Drivers must exist
    assert.ok(decomposition.drivers.length > 0);

    // Sum of driver dollar impacts must match total delta dollars to the exact cent
    const sumDrivers = decomposition.drivers.reduce((acc: number, d: any) => acc + d.dollarImpact, 0);
    assert.ok(
      Math.abs(sumDrivers - decomposition.totalDeltaDollars) < 0.05,
      `Driver sum ${sumDrivers} should match total delta ${decomposition.totalDeltaDollars}`
    );

    // Verify key drivers are present
    const driverKeys = decomposition.drivers.map((d: any) => d.key);
    assert.ok(driverKeys.includes('revenue_base_facts'));
    assert.ok(driverKeys.includes('cash_flow_growth'));
    assert.ok(driverKeys.includes('wacc_discount_rate'));
    assert.ok(driverKeys.includes('capital_structure'));
  });

  it('fails closed when tickers do not match', () => {
    const reportA = { ...mockCurrentReport, ticker: 'MSFT' };
    const reportB = { ...mockPastReport, ticker: 'AAPL' };
    const res: any = decomposeValuationDelta(reportA, reportB, false);

    assert.ok(res);
    assert.equal(res.isAvailable, false);
    assert.ok(res.reason.includes('Ticker mismatch'));
  });

  it('enforces sector guard and fails closed for non-FCFF companies', () => {
    const sofiCur: any = {
      ticker: 'SOFI',
      company_profile: { overview: { symbol: 'SOFI', sector: 'Financial Services' } },
      intrinsic_value: {
        summary: { base_case_fair_value: 12 },
        model_selection: { selected_model: 'fintech_pe' },
      },
    };
    const sofiPrev: any = {
      ticker: 'SOFI',
      company_profile: { overview: { symbol: 'SOFI', sector: 'Financial Services' } },
      intrinsic_value: {
        summary: { base_case_fair_value: 10 },
        model_selection: { selected_model: 'fintech_pe' },
      },
    };

    const res: any = decomposeValuationDelta(sofiCur, sofiPrev, false);
    assert.ok(res);
    assert.equal(res.isAvailable, false);
    assert.ok(res.reason.includes('non-FCFF'));
  });

  it('handles missing conviction score without fabricated ?? 70 defaults', () => {
    const noConvictionCur = {
      ...mockCurrentReport,
      verdict: {}, // No conviction score
    };
    const noConvictionPrev = {
      ...mockPastReport,
      verdict: {}, // No conviction score
    };

    const health = classifyThesisHealth(noConvictionCur, noConvictionPrev, 60, false);
    assert.equal(health.convictionShift, null);
    assert.equal(health.status, 'upgraded');
  });

  it('classifies thesis health correctly as upgraded when fundamentals and conviction expand', () => {
    const health = classifyThesisHealth(mockCurrentReport, mockPastReport, 60, false);
    assert.equal(health.status, 'upgraded');
    assert.ok(health.headline.includes('Thesis Strengthened') || health.headline.includes('Upgraded'));
  });

  it('classifies thesis health as under_pressure when fair value drops significantly due to cash flow contraction', () => {
    const distressedReport: any = {
      ...mockCurrentReport,
      intrinsic_value: {
        ...mockCurrentReport.intrinsic_value,
        summary: { base_case_fair_value: 320, margin_of_safety: -22 },
        dcf_model: {
          scenarios: {
            base: {
              ...mockCurrentReport.intrinsic_value.dcf_model.scenarios.base,
              fair_value_per_share: 320,
              projected_growth_rate: 6.0,
            },
          },
        },
      },
      verdict: { conviction_score: 65 },
    };

    const health = classifyThesisHealth(distressedReport, mockPastReport, -80, false);
    assert.equal(health.status, 'under_pressure');
  });

  it('classifies thesis health as macro_driven when WACC was the primary driver of fair value decline', () => {
    const macroDepressedReport: any = {
      ...mockCurrentReport,
      intrinsic_value: {
        ...mockCurrentReport.intrinsic_value,
        summary: { base_case_fair_value: 360 },
        dcf_model: {
          scenarios: {
            base: {
              ...mockCurrentReport.intrinsic_value.dcf_model.scenarios.base,
              fair_value_per_share: 360,
              wacc_percentage: 11.0, // WACC jumped from 9% to 11%
              projected_growth_rate: 12.0, // Operating growth unchanged
            },
          },
        },
      },
      verdict: { conviction_score: 80 },
    };

    const drivers: ValuationDrivers[] = [
      { key: 'wacc_discount_rate', label: 'WACC Shift', dollarImpact: -38, percentageContribution: 95 },
      { key: 'cash_flow_growth', label: 'Cash Flow', dollarImpact: -2, percentageContribution: 5 },
    ];

    const health = classifyThesisHealth(macroDepressedReport, mockPastReport, -40, false, drivers);
    assert.equal(health.status, 'macro_driven');
  });

  it('returns null gracefully when previous or current report lacks fair value', () => {
    const invalidReport = { report_date: '2026-01-01' };
    const res = decomposeValuationDelta(invalidReport as any, mockPastReport, false);
    assert.equal(res, null);
  });
});
