import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveGrossMarginLineage,
  findKeyIndicatorInSource,
  alignMetricValuesByPeriod,
  parsePeriodIdentity,
  periodsMatch,
  MetricResolutionResult
} from './metricLineage';
import {
  resolveBusinessArchetype,
  getMetricInterpretationContext,
  buildFinancialMetricAnalysisPrompt,
  getBusinessAwareLocalFallback
} from './financialMetricContext';
import { FinancialStatementsData, KeyIndicatorsData, ReportData } from '../types';

describe('Lumina — Key Indicator Data Lineage & Empty State (Tests 33–51)', () => {

  // =========================================================================
  // Test 33: Verified Gross Profit Path
  // =========================================================================
  it('33. Calculates Gross Margin directly from verified Gross Profit and Revenue', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [1000],
        gross_profit: [700],
        net_income: [200]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 70);
    assert.equal(res.valueState, 'CALCULATED');
    assert.equal(res.sourcePath, 'income_statement.gross_profit / income_statement.revenue');
  });

  // =========================================================================
  // Test 34: COGS Path for Operating Company
  // =========================================================================
  it('34. Calculates Gross Margin from Revenue - COGS when Gross Profit is null in operating company', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [1000],
        cogs: [300],
        gross_profit: [null],
        net_income: [200]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 70);
    assert.equal(res.valueState, 'CALCULATED');
    assert.match(res.sourcePath, /cogs/);
  });

  // =========================================================================
  // Test 35: Financial Invalid COGS Substitute
  // =========================================================================
  it('35. Banking/lender template fails closed and does NOT coerce interest expense into COGS', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'banking',
      income_statement: {
        revenue: [1000],
        total_interest_expense: [300],
        operating_expenses: [400],
        net_income: [200]
      } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, null);
    assert.equal(res.valueState, 'NOT_AVAILABLE');
    assert.equal(res.unavailableReason, 'UNSUPPORTED_FORMULA');
  });

  // =========================================================================
  // Test 36: Canonical Key Indicator Fallback (Real Production Shape)
  // =========================================================================
  it('36. Recovers Gross Margin from canonical KeyIndicatorsData ({ periods, categories }) when statement items absent', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026', 'Q2 2026'],
      statement_template: 'banking',
      key_indicators: {
        periods: ['Q1 2026', 'Q2 2026'],
        categories: [
          {
            category_key: 'profitability',
            category_title: 'Profitability',
            metrics: [
              {
                key: 'gross_margin',
                name: 'Gross Margin',
                category: 'profitability',
                unit: '%',
                values: [71.0, 72.5]
              }
            ]
          }
        ]
      },
      income_statement: {
        revenue: [1000, 1100],
        net_income: [200, 220]
      } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const resQ1 = resolveGrossMarginLineage('Q1 2026', 0, data);
    const resQ2 = resolveGrossMarginLineage('Q2 2026', 1, data);

    assert.equal(resQ1.value, 71.0);
    assert.equal(resQ2.value, 72.5);
    assert.equal(resQ1.sourcePath, 'financial_statements.key_indicators.gross_margin');
  });

  // =========================================================================
  // Test 37: Misaligned Key Indicator Series
  // =========================================================================
  it('37. Maps key indicators strictly by period identity and does NOT align by index when periods differ', () => {
    const fsPeriods = ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];
    const kiPeriods = ['Q4 2025', 'Q1 2026', 'Q2 2026'];
    const kiValues = [71.09, 73.15, 74.20];

    const data: FinancialStatementsData = {
      periods: fsPeriods,
      statement_template: 'banking',
      key_indicators: {
        periods: kiPeriods,
        categories: [
          {
            category_key: 'profitability',
            category_title: 'Profitability',
            metrics: [
              {
                key: 'gross_margin',
                name: 'Gross Margin',
                category: 'profitability',
                unit: '%',
                values: kiValues
              }
            ]
          }
        ]
      },
      income_statement: {
        revenue: [400, 450, 500, 550],
        net_income: [50, 60, 70, 80]
      } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const resQ3 = resolveGrossMarginLineage('Q3 2025', 0, data);
    const resQ4 = resolveGrossMarginLineage('Q4 2025', 1, data);
    const resQ1 = resolveGrossMarginLineage('Q1 2026', 2, data);
    const resQ2 = resolveGrossMarginLineage('Q2 2026', 3, data);

    // Q3 2025 was missing from key indicators -> must be null, NOT Q4's 71.09!
    assert.equal(resQ3.value, null);
    assert.equal(resQ4.value, 71.09);
    assert.equal(resQ1.value, 73.15);
    assert.equal(resQ2.value, 74.20);
  });

  // =========================================================================
  // Test 38: Ratios Are NOT YTD-Subtracted
  // =========================================================================
  it('38. Does not perform YTD subtraction on ratios', () => {
    // If Q1 ratio = 70% and H1 ratio = 72%, Q2 ratio is NOT 2%!
    // Ratios are calculated from flow inputs or reported directly.
    const q1Ratio = 70.0;
    const h1Ratio = 72.0;

    // A flawed double-subtraction would do: h1Ratio - q1Ratio = 2%
    const flawedSubtraction = h1Ratio - q1Ratio;
    assert.notEqual(flawedSubtraction, 72.0);

    // With our resolver, reported ratio is preserved as-is without YTD subtraction
    const data: FinancialStatementsData = {
      periods: ['Q1 2026', 'H1 2026'],
      statement_template: 'standard',
      income_statement: {
        gross_margin_pct: [70.0, 72.0],
        revenue: [1000, 2100],
        net_income: [200, 420]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const resH1 = resolveGrossMarginLineage('H1 2026', 1, data);
    assert.equal(resH1.value, 72.0, 'Reported ratio must remain 72%, never 2%');
  });

  // =========================================================================
  // Test 39: Zero Gross Profit
  // =========================================================================
  it('39. Preserves legitimate 0% Gross Margin when Gross Profit is zero', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [100],
        gross_profit: [0],
        net_income: [-50]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 0);
    assert.notEqual(res.value, null);
    assert.equal(res.valueState, 'CALCULATED');
  });

  // =========================================================================
  // Test 40: Negative Gross Profit
  // =========================================================================
  it('40. Preserves negative Gross Margin when Gross Profit is negative', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [100],
        gross_profit: [-20],
        net_income: [-80]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, -20);
    assert.equal(res.valueState, 'CALCULATED');
  });

  // =========================================================================
  // Test 41: Zero Revenue (Denominator Guard)
  // =========================================================================
  it('41. Fails closed and returns ZERO_DENOMINATOR when Revenue is zero', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [0],
        gross_profit: [0],
        net_income: [-10]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, null);
    assert.equal(res.unavailableReason, 'ZERO_DENOMINATOR');
  });

  // =========================================================================
  // Test 42: All Null Selected Metric
  // =========================================================================
  it('42. Produces deterministic empty insight and clears live analysis when all values are null', () => {
    const reportData: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Credit Services',
        description: 'Fintech platform.'
      } as any,
      financial_statements: {
        statement_template: 'banking',
        periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: {
          revenue: [400, 450, 500, 550],
          net_income: [50, 60, 70, 80]
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any
      } as any
    };

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData,
      ticker: 'SOFI',
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      historyValues: [null, null, null, null]
    });

    assert.equal(ctx.valueState, 'NOT_AVAILABLE');
    assert.equal(ctx.isUnavailable, true);

    const fallback = getBusinessAwareLocalFallback(ctx, null, true);
    assert.equal(fallback.status, 'neutral');
    assert.equal(fallback.status_label_th, 'ไม่มีข้อมูล');
    assert.match(fallback.interpretation_th, /ยังไม่มีข้อมูลที่เพียงพอสำหรับการวิเคราะห์ตัวชี้วัดนี้/);
    assert.deepEqual(fallback.pros_th, ['ยังไม่มีข้อมูลที่เพียงพอสำหรับการประเมินข้อดี']);

    const fallbackEn = getBusinessAwareLocalFallback(ctx, null, false);
    assert.match(fallbackEn.interpretation_en, /Insufficient data to analyze this metric/);
  });

  // =========================================================================
  // Test 43: Partial Series
  // =========================================================================
  it('43. Handles partial series with available points and notes missing periods in prompt', () => {
    const reportData: Partial<ReportData> = {
      ticker: 'PARTIALCO',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Application'
      } as any
    };

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData,
      ticker: 'PARTIALCO',
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      historyValues: [null, 20.0, 21.0, null]
    });

    const prompt = buildFinancialMetricAnalysisPrompt(ctx, {
      normalizedCompanyName: 'Partial Co',
      normalizedTicker: 'PARTIALCO',
      periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
      historyValues: [null, 20.0, 21.0, null],
      yoyPcts: [null, null, 5.0, null],
      unit: '%',
      isCurrency: false
    });

    assert.match(prompt, /PARTIAL SERIES NOTE/, 'Must include partial series note');
    assert.match(prompt, /Missing periods: \[Q3 2025, Q2 2026\]/);
    assert.match(prompt, /Analyze ONLY the available periods/);
  });

  // =========================================================================
  // Test 44: Source Reconciliation
  // =========================================================================
  it('44. Retains source reconciliation unverified warning and bounds AI confidence', () => {
    const reportData: Partial<ReportData> = {
      ticker: 'UNRECONCO',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        validation_summary: {
          is_reconciled: false,
          is_balanced: true,
          impossible_guards_passed: true
        }
      } as any
    };

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData,
      ticker: 'UNRECONCO',
      periods: ['Q1 2026'],
      historyValues: [75.0],
      isSourceReconciled: false
    });

    assert.equal(ctx.isSourceReconciled, false);
    assert.equal(ctx.provenanceStatus, 'Source reconciliation not verified');

    const prompt = buildFinancialMetricAnalysisPrompt(ctx, {
      normalizedCompanyName: 'Unrecon Co',
      normalizedTicker: 'UNRECONCO',
      periods: ['Q1 2026'],
      historyValues: [75.0],
      yoyPcts: [null],
      unit: '%',
      isCurrency: false
    });

    assert.match(prompt, /Source reconciliation between filing tables is NOT verified/);
  });

  // =========================================================================
  // Tests 45–51: Cross-Sector Invariants
  // =========================================================================

  // Test 45: Operating Company (MSFT-like)
  it('45. Operating company has normal Gross Margin without financial sector guard leakage', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [50000],
        gross_profit: [35000],
        net_income: [20000]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 70.0);

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Technology', industry: 'Software - Infrastructure' } as any },
      ticker: 'MSFT',
      periods: ['Q1 2026'],
      historyValues: [70.0]
    });

    assert.equal(ctx.businessArchetype, 'saas_software');
    assert.equal(ctx.applicability, 'PRIMARY');
    assert.equal(ctx.isFinancialSectorGuardActive, false);
  });

  // Test 46: Manufacturer
  it('46. Manufacturer derives Gross Margin from Revenue - COGS with primary applicability', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [2000],
        cogs: [1400],
        net_income: [100]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 30.0);

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Industrials', industry: 'Specialty Industrial Machinery' } as any },
      ticker: 'MFGCO',
      periods: ['Q1 2026'],
      historyValues: [30.0]
    });

    assert.equal(ctx.applicability, 'PRIMARY');
    assert.equal(ctx.isFinancialSectorGuardActive, false);
  });

  // Test 47: Retail
  it('47. Retail company retains operating Gross Margin relevance', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [10000],
        gross_profit: [2500],
        net_income: [400]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, 25.0);

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Consumer Cyclical', industry: 'Specialty Retail' } as any },
      ticker: 'RETAILCO',
      periods: ['Q1 2026'],
      historyValues: [25.0]
    });

    assert.equal(ctx.applicability, 'PRIMARY');
  });

  // Test 48: Financial Lender (Two scenarios)
  it('48. Financial Lender: A. verified key indicator exists -> CONTEXT_ONLY; B. no source -> unavailable', () => {
    // Scenario A: Verified canonical key indicator exists
    const dataWithKi: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'banking',
      key_indicators: {
        periods: ['Q1 2026'],
        categories: [
          {
            category_key: 'profitability',
            category_title: 'Profitability',
            metrics: [{ key: 'gross_margin', name: 'Gross Margin', category: 'profitability', unit: '%', values: [71.09] }]
          }
        ]
      },
      income_statement: { revenue: [500], net_income: [100] } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const resA = resolveGrossMarginLineage('Q1 2026', 0, dataWithKi);
    assert.equal(resA.value, 71.09);

    const ctxA = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Financial Services', industry: 'Credit Services' } as any },
      ticker: 'SOFI',
      periods: ['Q1 2026'],
      historyValues: [71.09]
    });
    assert.equal(ctxA.applicability, 'CONTEXT_ONLY');
    assert.equal(ctxA.valueState, 'CALCULATED');

    // Scenario B: No legitimate source exists
    const dataWithoutKi: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'banking',
      income_statement: { revenue: [500], net_income: [100] } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const resB = resolveGrossMarginLineage('Q1 2026', 0, dataWithoutKi);
    assert.equal(resB.value, null);
    assert.equal(resB.valueState, 'NOT_AVAILABLE');

    const ctxB = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Financial Services', industry: 'Credit Services' } as any },
      ticker: 'SOFI',
      periods: ['Q1 2026'],
      historyValues: [null]
    });
    assert.equal(ctxB.valueState, 'NOT_AVAILABLE');
  });

  // Test 49: Insurer
  it('49. Insurer does not reuse lender COGS assumptions; archetype controls interpretation', () => {
    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: { company_profile: { sector: 'Financial Services', industry: 'Insurance - Diversified' } as any },
      ticker: 'INSCO',
      periods: ['Q1 2026'],
      historyValues: [null]
    });

    assert.equal(ctx.businessArchetype, 'insurer');
    assert.equal(ctx.applicability, 'CONTEXT_ONLY');
  });

  // Test 50: REIT
  it('50. REIT does not fabricate Gross Margin or FFO/AFFO without source facts', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'reit',
      income_statement: {
        rental_revenue: [500],
        net_income: [150]
      } as any,
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, null);
    assert.equal(res.valueState, 'NOT_AVAILABLE');

    const ctx = getMetricInterpretationContext({
      metricKey: 'fcf',
      metricName: 'Free Cash Flow',
      reportData: { company_profile: { sector: 'Real Estate', industry: 'REIT - Residential' } as any },
      ticker: 'REITCO',
      periods: ['Q1 2026'],
      historyValues: [120]
    });

    assert.equal(ctx.businessArchetype, 'reit');
    assert.match(ctx.interpretationCaveats[0], /FFO and AFFO/);
  });

  // Test 51: Early-Stage
  it('51. Early-stage preserves negative Gross Margin as valid unit economics indicator', () => {
    const data: FinancialStatementsData = {
      periods: ['Q1 2026'],
      statement_template: 'standard',
      income_statement: {
        revenue: [100],
        gross_profit: [-30],
        net_income: [-150]
      },
      balance_sheet: {} as any,
      cash_flow: {} as any
    };

    const res = resolveGrossMarginLineage('Q1 2026', 0, data);
    assert.equal(res.value, -30);

    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: {
        company_profile: { sector: 'Healthcare', industry: 'Biotechnology' } as any,
        financial_statements: {
          income_statement: { gross_margin_pct: [-30] }
        } as any
      },
      ticker: 'EARLYCO',
      periods: ['Q1 2026'],
      historyValues: [-30]
    });

    assert.equal(ctx.businessArchetype, 'early_stage');
    assert.equal(ctx.applicability, 'PRIMARY');
    assert.equal(ctx.isNegative, true);
    assert.match(ctx.interpretationCaveats[0], /unit economics/);
  });
});
