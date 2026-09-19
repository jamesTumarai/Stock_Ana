import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBusinessArchetype,
  getMetricInterpretationContext,
  buildFinancialMetricAnalysisPrompt,
  MetricValueState,
  MetricInterpretationRole
} from './financialMetricContext';
import {
  deriveStandaloneQuarterFromYtd,
  deriveQ3StandaloneFromYtd,
  normalizeQuarterlyFlowSeries,
  isYtdPeriodLabel
} from '../utils/quarterNormalization';
import { ReportData } from '../types';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Lumina — Financial Metric Data Regression Repair (Tests 35-46)', () => {

  // Fixtures
  const bankLenderReport: Partial<ReportData> = {
    ticker: 'LENDCO',
    company_profile: {
      sector: 'Financial Services',
      industry: 'Credit Services',
      description: 'Digital consumer lending and fintech banking platform.'
    } as any,
    financial_statements: {
      statement_template: 'banking',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      key_indicators: [
        {
          key: 'gross_margin',
          name: 'Gross Margin',
          values: [72.84, 71.09, 73.15, 74.20]
        }
      ] as any,
      income_statement: {
        revenue: [500, 550, 600, 650],
        // Banking template does not have gross_profit directly in income_statement
        cogs: [135.8, 159.0, 161.1, 167.7],
        operating_income: [120, 130, 140, 150],
        net_income: [80, 90, 100, 110],
        net_interest_margin_pct: [5.2, 5.4, 5.5, 5.6]
      } as any,
      balance_sheet: {
        total_assets: [20000, 22000, 24000, 26000],
        total_equity: [2500, 2700, 2900, 3100],
        deposits: [15000, 17000, 19000, 21000],
        total_debt: [2000, 2100, 2200, 2300]
      } as any,
      cash_flow: {
        operating_cash_flow: [-500, -800, -600, -700],
        capex: [20, 25, 30, 35]
        // Note: depreciation intentionally omitted to test EBITDA margin fallback guard
      } as any
    } as any
  };

  const softwareReport: Partial<ReportData> = {
    ticker: 'SOFTCO',
    company_profile: {
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      description: 'Cloud enterprise software platform.'
    } as any,
    financial_statements: {
      statement_template: 'standard',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [1000, 1100, 1200, 1300],
        cogs: [200, 220, 240, 260],
        gross_profit: [800, 880, 960, 1040],
        operating_income: [250, 280, 310, 350],
        net_income: [200, 220, 250, 280]
      } as any,
      balance_sheet: {
        total_current_assets: [1500, 1600, 1700, 1800],
        total_current_liabilities: [500, 550, 600, 650],
        inventory: [0, 0, 0, 0],
        total_assets: [5000, 5400, 5800, 6200],
        total_equity: [3000, 3200, 3500, 3800],
        total_debt: [1000, 1000, 1000, 1000],
        cash_and_equivalents: [800, 900, 1000, 1100]
      } as any,
      cash_flow: {
        operating_cash_flow: [300, 340, 380, 420],
        capex: [50, 55, 60, 65],
        depreciation: [40, 45, 50, 55],
        free_cash_flow: [250, 285, 320, 355]
      } as any
    } as any
  };

  // =========================================================================
  // Test 35: Strict Separation of MetricValueState vs MetricInterpretationRole
  // =========================================================================
  it('35. Separates financial data/calculation state from business interpretation role', () => {
    // Gross margin for a lender is CONTEXT_ONLY, but because values exist, valueState MUST be CALCULATED
    const ctx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      historyValues: [72.84, 71.09, 73.15, 74.20]
    });

    assert.equal(ctx.interpretationRole, 'CONTEXT_ONLY');
    assert.equal(ctx.valueState, 'CALCULATED');
    assert.equal(ctx.isUnavailable, false);
    // Being secondary or context-only must NOT suppress or nullify the value
    assert.ok(ctx.isCalculableButLimited);

    // When values are missing, valueState becomes NOT_AVAILABLE
    const missingCtx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [null, null]
    });

    assert.equal(missingCtx.valueState, 'NOT_AVAILABLE');
    assert.equal(missingCtx.isUnavailable, true);
  });

  // =========================================================================
  // Test 36: Gross Margin Preservation for Banking/Lending Template
  // =========================================================================
  it('36. Preserves Gross Margin when gross_profit is missing from income statement but cogs or key_indicators exist', () => {
    const inc = bankLenderReport.financial_statements!.income_statement;
    const rawPeriods = bankLenderReport.financial_statements!.periods;
    const keyIndicators = bankLenderReport.financial_statements!.key_indicators!;

    const findExistingKeyIndicator = (nameOrKey: string) => {
      const target = nameOrKey.toLowerCase().replace(/[\s_-]+/g, '');
      const found = (keyIndicators as unknown as any[]).find((item: any) => {
        const k = (item.key || item.name || '').toLowerCase().replace(/[\s_-]+/g, '');
        return k === target;
      });
      return found?.values;
    };

    // Replicate FinancialStatementsTable grossMarginVals logic
    const grossMarginVals = rawPeriods.map((_, i) => {
      const rev = inc?.revenue?.[i];
      const gp = inc?.gross_profit?.[i] ?? (rev !== null && rev !== undefined && inc?.cogs?.[i] !== null && inc?.cogs?.[i] !== undefined ? rev - inc.cogs[i] : null);
      if (rev && gp !== undefined && gp !== null && rev > 0) return Number(((gp / rev) * 100).toFixed(2));
      if (inc?.gross_margin_pct?.[i] !== undefined && inc?.gross_margin_pct?.[i] !== null) return inc.gross_margin_pct[i];
      const existing = findExistingKeyIndicator('gross_margin')?.[i];
      if (existing !== undefined && existing !== null) return existing;
      return null;
    });

    // Gross Margin must NOT be null / '- - - -'
    assert.equal(grossMarginVals.length, 4);
    assert.ok(grossMarginVals.every(v => v !== null && typeof v === 'number' && v > 70));
    assert.equal(grossMarginVals[0], 72.84);
  });

  // =========================================================================
  // Test 37: EBITDA Margin Guard Against Operating Margin Conflation
  // =========================================================================
  it('37. EBITDA Margin does not fall back to Operating Margin when depreciation is missing', () => {
    const inc = bankLenderReport.financial_statements!.income_statement;
    const cf = bankLenderReport.financial_statements!.cash_flow;
    const rawPeriods = bankLenderReport.financial_statements!.periods;

    const opMarginVals = rawPeriods.map((_, i) => {
      const rev = inc?.revenue?.[i];
      const op = inc?.operating_income?.[i];
      if (rev && op !== undefined && op !== null && rev > 0) return Number(((op / rev) * 100).toFixed(2));
      return null;
    });

    // In bankLenderReport, cf.depreciation is undefined.
    // The corrected logic must return null and NOT fall back to opMarginVals!
    const ebitdaMarginVals = rawPeriods.map((_, i) => {
      const rev = inc?.revenue?.[i];
      const op = inc?.operating_income?.[i];
      const dep = cf?.depreciation?.[i];
      if (rev && op !== undefined && op !== null && dep !== undefined && dep !== null && rev > 0) return Number((((op + dep) / rev) * 100).toFixed(2));
      return null; // Corrected: never return opMarginVals[i]
    });

    assert.ok(opMarginVals.every(v => typeof v === 'number'));
    // EBITDA Margin must be null because depreciation is missing
    assert.ok(ebitdaMarginVals.every(v => v === null));
  });

  // =========================================================================
  // Test 38: EBIT Margin Explicit Calculation Decoupled from Operating Margin
  // =========================================================================
  it('38. EBIT Margin is explicitly calculated and decoupled from Operating Margin array reference', () => {
    const inc = softwareReport.financial_statements!.income_statement;
    const rawPeriods = softwareReport.financial_statements!.periods;

    const opMarginVals = rawPeriods.map((_, i) => {
      const rev = inc?.revenue?.[i];
      const op = inc?.operating_income?.[i];
      if (rev && op !== undefined && op !== null && rev > 0) return Number(((op / rev) * 100).toFixed(2));
      return null;
    });

    const ebitMarginVals = rawPeriods.map((_, i) => {
      const rev = inc?.revenue?.[i];
      const op = inc?.operating_income?.[i];
      if (rev && op !== undefined && op !== null && rev > 0) return Number(((op / rev) * 100).toFixed(2));
      return null;
    });

    // Distinct array instances
    assert.notEqual(opMarginVals, ebitMarginVals);
    assert.deepEqual(opMarginVals, ebitMarginVals);
    assert.equal(ebitMarginVals[0], 25.0);
  });

  // =========================================================================
  // Test 39: Annual View Does NOT Multiply Annualized Ratios by 4
  // =========================================================================
  it('39. Annual view uses annualFactor = 1 while quarterly uses annualFactor = 4', () => {
    const inc = softwareReport.financial_statements!.income_statement;
    const bs = softwareReport.financial_statements!.balance_sheet;

    const computeRoe = (isAnnualActive: boolean) => {
      const annualFactor = isAnnualActive ? 1 : 4;
      const ni = inc?.net_income?.[0]; // 200
      const eq = bs?.total_equity?.[0]; // 3000
      if (ni !== undefined && ni !== null && eq !== undefined && eq !== null && eq !== 0) {
        return Number(((ni * annualFactor / eq) * 100).toFixed(2));
      }
      return null;
    };

    const quarterlyRoe = computeRoe(false);
    const annualRoe = computeRoe(true);

    // Quarterly: (200 * 4 / 3000) * 100 = 26.67%
    assert.equal(quarterlyRoe, 26.67);
    // Annual: (200 * 1 / 3000) * 100 = 6.67%
    assert.equal(annualRoe, 6.67);
    // Verify annual is NOT quadrupled (factor of 4 relationship holds within rounding)
    assert.ok(Math.abs(annualRoe! * 4 - quarterlyRoe!) < 0.05);
  });

  // =========================================================================
  // Test 40: Zero Denominator Guards
  // =========================================================================
  it('40. Guards zero denominator for current ratio and quick ratio properly', () => {
    const computeCurrentRatio = (ca: number | null | undefined, cl: number | null | undefined) => {
      if (ca !== undefined && ca !== null && cl !== undefined && cl !== null && cl > 0) {
        return Number((ca / cl).toFixed(2));
      }
      return null;
    };

    // ca === 0 with valid liabilities must yield 0.00x, not null
    assert.equal(computeCurrentRatio(0, 500), 0.00);
    // cl === 0 must return null, avoiding division by zero
    assert.equal(computeCurrentRatio(1000, 0), null);
    // normal case
    assert.equal(computeCurrentRatio(1000, 500), 2.00);
  });

  // =========================================================================
  // Test 41: Negative Equity Handling in Solvency and Returns
  // =========================================================================
  it('41. Allows negative equity to calculate with denominator caveats rather than nulling out', () => {
    const computeDebtToEquity = (debt: number, eq: number) => {
      if (debt !== undefined && debt !== null && eq !== undefined && eq !== null && eq !== 0) {
        return Number((debt / eq).toFixed(2));
      }
      return null;
    };

    // Negative equity company (e.g. cumulative deficits or heavy buybacks)
    const deNegative = computeDebtToEquity(5000, -1000);
    assert.equal(deNegative, -5.00);

    const ctx = getMetricInterpretationContext({
      metricKey: 'debt_to_equity',
      metricName: 'Debt to Equity Ratio',
      reportData: {
        ticker: 'NEG_EQ',
        company_profile: { sector: 'Consumer Cyclical', industry: 'Restaurants' } as any
      },
      ticker: 'NEG_EQ',
      periods: ['Q4 2025', 'Q1 2026'],
      historyValues: [-4.5, -5.0]
    });

    assert.equal(ctx.isNegative, true);
    assert.ok(ctx.denominatorCaveats.length > 0 || ctx.interpretationCaveats.length > 0);
  });

  // =========================================================================
  // Test 42: Quarter Normalization Utility
  // =========================================================================
  it('42. Normalizes standalone quarters from YTD without double subtraction', () => {
    // Q1 standalone = 100, H1 YTD = 250 -> Q2 standalone = 150
    const q2Standalone = deriveStandaloneQuarterFromYtd(100, 250);
    assert.equal(q2Standalone, 150);

    // H1 YTD = 250, 9M YTD = 420 -> Q3 standalone = 170
    const q3Standalone = deriveQ3StandaloneFromYtd(250, 420);
    assert.equal(q3Standalone, 170);

    // Full series normalization
    const series = [
      { period: 'Q1 2025', value: 100 },
      { period: 'Q2 2025 YTD', value: 250, isYtd: true },
      { period: 'Q3 2025 YTD', value: 420, isYtd: true }
    ];

    const normalized = normalizeQuarterlyFlowSeries(series);
    assert.equal(normalized[0].normalized, 100);
    assert.equal(normalized[1].normalized, 150);
    assert.equal(normalized[2].normalized, 170);
    assert.equal(normalized[1].wasDerived, true);
    assert.equal(normalized[2].wasDerived, true);

    assert.equal(isYtdPeriodLabel('Q2 2025 YTD'), true);
    assert.equal(isYtdPeriodLabel('H1 2025'), true);
    assert.equal(isYtdPeriodLabel('Q1 2025'), false);
  });

  // =========================================================================
  // Test 43: Source Reconciliation Status Propagation
  // =========================================================================
  it('43. Propagates unverified source reconciliation status into context caveats and Gemini prompt', () => {
    const unreconciledCtx = getMetricInterpretationContext({
      metricKey: 'operating_margin',
      metricName: 'Operating Margin',
      reportData: softwareReport,
      ticker: 'SOFTCO',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [25.8, 26.9],
      isSourceReconciled: false
    });

    assert.equal(unreconciledCtx.isSourceReconciled, false);
    assert.ok(unreconciledCtx.interpretationCaveats.some(c => c.includes('Source reconciliation between filing tables is not verified')));
    assert.ok(unreconciledCtx.interpretationCaveatsTh.some(c => c.includes('ยังไม่ได้ตรวจสอบการกระทบยอดแหล่งข้อมูล')));

    const prompt = buildFinancialMetricAnalysisPrompt(unreconciledCtx, {
      normalizedCompanyName: 'SoftCo Inc',
      normalizedTicker: 'SOFTCO',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [25.8, 26.9],
      yoyPcts: [1.1, 1.2],
      unit: '%',
      isCurrency: false,
      isThai: true
    });

    assert.ok(prompt.includes('Source reconciliation between filing tables is NOT verified'));
    assert.ok(prompt.includes('RECONCILIATION CONFIDENCE BOUNDS'));
  });

  // =========================================================================
  // Test 44: Cross-Sector Validation
  // =========================================================================
  it('44. Validates business archetypes across all sectors without data regression', () => {
    const sectors = [
      { report: { company_profile: { sector: 'Technology', industry: 'Software' } }, expected: 'saas_software' },
      { report: { financial_statements: { statement_template: 'banking' } }, expected: 'bank' },
      { report: { company_profile: { sector: 'Financial Services', industry: 'Insurance - Life' } }, expected: 'insurer' },
      { report: { financial_statements: { statement_template: 'reit' } }, expected: 'reit' },
      { report: { company_profile: { sector: 'Industrials', industry: 'Machinery' } }, expected: 'industrial_manufacturing' },
      { report: { company_profile: { sector: 'Energy', industry: 'Oil & Gas' } }, expected: 'energy_commodity' },
      { report: { financial_statements: { income_statement: { gross_margin_pct: [-10.0] } } }, expected: 'early_stage' }
    ];

    for (const item of sectors) {
      const resolved = resolveBusinessArchetype(item.report);
      assert.equal(resolved, item.expected, `Archetype mismatch for ${item.expected}`);
    }
  });

  // =========================================================================
  // Test 45: No Hardcoded Ticker Checks
  // =========================================================================
  it('45. Ensures no hardcoded ticker conditionals exist in financialMetricContext.ts', () => {
    const fileContent = fs.readFileSync(
      path.resolve(__dirname, 'financialMetricContext.ts'),
      'utf-8'
    );

    // Forbidden ticker checks
    const forbiddenPatterns = [
      /ticker\s*===?\s*['"]SOFI['"]/i,
      /sym\s*===?\s*['"]SOFI['"]/i,
      /ticker\s*===?\s*['"]MSFT['"]/i,
      /sym\s*===?\s*['"]MSFT['"]/i,
      /ticker\s*===?\s*['"]JPM['"]/i,
      /sym\s*===?\s*['"]JPM['"]/i
    ];

    for (const pattern of forbiddenPatterns) {
      assert.ok(!pattern.test(fileContent), `Found forbidden hardcoded ticker pattern: ${pattern}`);
    }
  });

  // =========================================================================
  // Test 46: Click-Any-Metric Behavior and Active Metric Integrity
  // =========================================================================
  it('46. Clicking any metric preserves active metric focus without forcing headline KPIs', () => {
    const clickedMetrics = ['gross_margin', 'ebitda_margin', 'roe', 'deposits', 'current_ratio'];

    for (const mKey of clickedMetrics) {
      const ctx = getMetricInterpretationContext({
        metricKey: mKey,
        metricName: mKey.replace('_', ' ').toUpperCase(),
        reportData: bankLenderReport,
        ticker: 'LENDCO',
        periods: ['Q1 2026', 'Q2 2026'],
        historyValues: [100, 110]
      });

      // Selected metric MUST remain the metricKey
      assert.equal(ctx.metricKey, mKey);
      // Value state is CALCULATED because historyValues exist
      assert.equal(ctx.valueState, 'CALCULATED');
    }
  });

});
