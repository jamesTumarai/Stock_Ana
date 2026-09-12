import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCanonicalValuationSandboxInputs,
  recalculateSandboxFairValue
} from '../valuationSandboxAdapter';
import { calculateStrictDCFValue } from '../valuation/dcfMathEngine';

describe('valuationSandboxAdapter', () => {
  const createValidDcfReport = (): any => ({
    ticker: 'MSFT',
    analysis_type: 'fundamental',
    company_profile: {
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      stock_price: 420.00,
      shares_outstanding: '7,430M'
    },
    financial_statements: {
      periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
      income_statement: {
        revenue: [60000, 62000, 61000, 65000],
        net_income: [20000, 21000, 20500, 22000],
        eps_diluted: [2.70, 2.80, 2.75, 2.95]
      },
      balance_sheet: {
        cash_and_equivalents: [30000, 31000, 29000, 35000],
        short_term_investments: [50000, 52000, 51000, 55000],
        total_debt: [60000, 61000, 59000, 60000]
      },
      cash_flow: {
        free_cash_flow: [19000, 20000, 19500, 21000]
      }
    },
    intrinsic_value: {
      current_price: 420.00,
      dcf_model: {
        assumptions: {
          wacc_pct: 8.5,
          terminal_growth_pct: 2.8,
          projection_years: 5
        },
        scenarios: {
          bear: {
            revenue_cagr_pct: 7.0,
            terminal_margin_pct: 28.0,
            fair_value_per_share: 350.00,
            key_assumption_note: 'Bear case'
          },
          base: {
            revenue_cagr_pct: 12.0,
            terminal_margin_pct: 32.0,
            fair_value_per_share: 450.00,
            key_assumption_note: 'Base case'
          },
          bull: {
            revenue_cagr_pct: 17.0,
            terminal_margin_pct: 36.0,
            fair_value_per_share: 550.00,
            key_assumption_note: 'Bull case'
          }
        }
      }
    }
  });

  it('valid canonical operating company DCF is eligible with extracted verified inputs', () => {
    const report = createValidDcfReport();
    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');

    assert.equal(result.isEligible, true);
    if (result.isEligible) {
      assert.equal(result.inputs.ticker, 'MSFT');
      assert.equal(result.inputs.currentPrice, 420.00);
      assert.equal(result.inputs.startingRevenueM, 248000); // sum of 4 quarters (60000+62000+61000+65000)
      assert.equal(result.inputs.sharesOutstandingM, 7430);
      assert.equal(result.inputs.netCashM, 30000); // 35000 + 55000 - 60000
      assert.equal(result.inputs.waccPct, 8.5);
      assert.equal(result.inputs.terminalGrowthPct, 2.8);
      assert.equal(result.inputs.baseRevenueCagrPct, 12.0);
      assert.equal(result.inputs.baseFcfMarginPct, 32.0);
      assert.equal(result.inputs.projectionYears, 5);
    }
  });

  it('recalculates DCF fair value using the exact same canonical engine as dcfMathEngine', () => {
    const report = createValidDcfReport();
    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');

    assert.equal(result.isEligible, true);
    if (result.isEligible) {
      const recalculatedBase = recalculateSandboxFairValue(result.inputs);
      const strictEngineValue = calculateStrictDCFValue(
        result.inputs.startingRevenueM,
        result.inputs.sharesOutstandingM,
        result.inputs.netCashM,
        result.inputs.waccPct,
        result.inputs.terminalGrowthPct,
        result.inputs.baseRevenueCagrPct,
        result.inputs.baseFcfMarginPct,
        result.inputs.projectionYears
      );
      assert.equal(recalculatedBase, strictEngineValue);
      assert.ok(recalculatedBase > 0);
    }
  });

  it('missing price produces no scenario numerical output (fails closed)', () => {
    const report = createValidDcfReport();
    delete report.intrinsic_value.current_price;
    delete report.company_profile.stock_price;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.reason.includes('current share price'));
      assert.ok(result.missingFields.some(f => f.includes('current share price')));
    }
  });

  it('missing FCF / revenue / financial statements data produces no numerical output', () => {
    const report = createValidDcfReport();
    delete report.financial_statements;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.reason.includes('Insufficient verified valuation inputs'));
    }
  });

  it('missing shares outstanding data produces no numerical output', () => {
    const report = createValidDcfReport();
    delete report.company_profile.shares_outstanding;
    // Also remove net income / eps diluted so it cannot derive shares
    delete report.financial_statements.income_statement.net_income;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.missingFields.some(f => f.includes('shares outstanding')));
    }
  });

  it('missing WACC produces unavailable state without assuming 9.0%', () => {
    const report = createValidDcfReport();
    delete report.intrinsic_value.dcf_model.assumptions.wacc_pct;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.missingFields.some(f => f.includes('discount rate (WACC)')));
    }
  });

  it('missing terminal growth produces unavailable state without assuming 2.5%', () => {
    const report = createValidDcfReport();
    delete report.intrinsic_value.dcf_model.assumptions.terminal_growth_pct;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.missingFields.some(f => f.includes('terminal growth')));
    }
  });

  it('WACC <= terminal growth fails closed and produces unavailable state', () => {
    const report = createValidDcfReport();
    report.intrinsic_value.dcf_model.assumptions.wacc_pct = 2.5;
    report.intrinsic_value.dcf_model.assumptions.terminal_growth_pct = 2.5;

    const result = getCanonicalValuationSandboxInputs(report, 'MSFT');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.ok(result.missingFields.some(f => f.includes('discount rate greater than terminal growth')));
    }
  });

  it('financial institution (SOFI / Bank) fails closed and does not open generic FCFF scenario calculations', () => {
    const sofiReport: any = {
      ticker: 'SOFI',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Credit Services',
        stock_price: 15.00,
        shares_outstanding: '1,050M'
      },
      intrinsic_value: {
        current_price: 15.00,
        dcf_model: {
          assumptions: {
            wacc_pct: 10.0,
            terminal_growth_pct: 2.5,
            projection_years: 5
          },
          scenarios: {
            bear: { revenue_cagr_pct: 10, terminal_margin_pct: 15, fair_value_per_share: 12, key_assumption_note: 'Bear' },
            base: { revenue_cagr_pct: 15, terminal_margin_pct: 20, fair_value_per_share: 18, key_assumption_note: 'Base' },
            bull: { revenue_cagr_pct: 20, terminal_margin_pct: 25, fair_value_per_share: 24, key_assumption_note: 'Bull' }
          }
        }
      }
    };

    const result = getCanonicalValuationSandboxInputs(sofiReport, 'SOFI');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.equal(result.modelType, 'fintech_pe');
      assert.ok(result.reason.includes('financial institutions or non-FCFF models'));
      assert.ok(result.reasonTh.includes('สถาบันการเงิน'));
    }
  });

  it('bank model (JPM) fails closed and does not open generic FCFF scenario calculations', () => {
    const jpmReport: any = {
      ticker: 'JPM',
      company_profile: {
        sector: 'Financial',
        industry: 'Banks - Diversified',
        stock_price: 210.00,
        shares_outstanding: '2,850M'
      }
    };

    const result = getCanonicalValuationSandboxInputs(jpmReport, 'JPM');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      assert.equal(result.modelType, 'ddm');
      assert.ok(result.reason.includes('financial institutions or non-FCFF models'));
    }
  });

  it('proves zero hidden fallback defaults (9.0 / 2.5 / 10 / $100 / FCF 10) in empty input', () => {
    const emptyReport: any = {
      ticker: 'TEST'
    };

    const result = getCanonicalValuationSandboxInputs(emptyReport, 'TEST');
    assert.equal(result.isEligible, false);
    if (!result.isEligible) {
      // Must not succeed with manufactured 9.0 WACC, 2.5 TG, $100 price, or FCF 10
      assert.ok(result.missingFields.length > 0);
    }
  });
});
