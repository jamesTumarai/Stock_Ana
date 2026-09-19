import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBusinessArchetype,
  getMetricInterpretationContext,
  buildFinancialMetricAnalysisPrompt,
  getBusinessAwareLocalFallback,
  BusinessArchetype
} from './financialMetricContext';
import { ReportData } from '../types';

describe('Lumina — Business-Aware Interactive Financial Metric Analyst', () => {

  // Fixtures
  const softwareCompanyReport: Partial<ReportData> = {
    ticker: 'CLOUDX',
    company_profile: {
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      description: 'Enterprise cloud infrastructure and SaaS platform provider.'
    } as any,
    financial_statements: {
      statement_template: 'standard',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [1000, 1200, 1400, 1600],
        cogs: [250, 300, 350, 400],
        operating_income: [300, 380, 460, 560],
        net_income: [240, 300, 370, 450],
        gross_margin_pct: [75.0, 75.0, 75.0, 75.0]
      } as any,
      cash_flow: {
        operating_cash_flow: [350, 420, 510, 620],
        capex: [50, 60, 70, 80],
        free_cash_flow: [300, 360, 440, 540]
      } as any,
      balance_sheet: {
        total_assets: [5000, 5500, 6000, 7000],
        total_equity: [3500, 4000, 4500, 5200]
      } as any
    } as any
  };

  const bankLenderReport: Partial<ReportData> = {
    ticker: 'LENDCO',
    company_profile: {
      sector: 'Financial Services',
      industry: 'Credit Services',
      description: 'Digital consumer finance, personal lending, and depository banking platform.'
    } as any,
    financial_statements: {
      statement_template: 'banking',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [500, 550, 600, 650],
        operating_income: [120, 130, 140, 150],
        net_income: [80, 90, 100, 110],
        net_interest_margin_pct: [5.2, 5.4, 5.5, 5.6],
        operating_expenses: [350, 380, 410, 440]
      } as any,
      balance_sheet: {
        total_assets: [20000, 22000, 24000, 26000],
        total_equity: [2500, 2700, 2900, 3100],
        deposits: [15000, 17000, 19000, 21000]
      } as any,
      cash_flow: {
        operating_cash_flow: [-500, -800, -600, -700], // loan originations flow through OCF
        capex: [20, 25, 30, 35],
        free_cash_flow: [-520, -825, -630, -735]
      } as any
    } as any
  };

  const reitReport: Partial<ReportData> = {
    ticker: 'PROPCO',
    company_profile: {
      sector: 'Real Estate',
      industry: 'REIT - Industrial',
      description: 'Industrial warehouse and logistics real estate investment trust.'
    } as any,
    financial_statements: {
      statement_template: 'reit',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [200, 210, 220, 230],
        operating_income: [80, 85, 90, 95],
        net_income: [30, 32, 35, 38] // Low due to massive non-cash depreciation
      } as any,
      cash_flow: {
        operating_cash_flow: [110, 115, 120, 125],
        depreciation: [60, 62, 65, 68],
        free_cash_flow: [50, 52, 55, 58]
      } as any,
      balance_sheet: {
        total_assets: [8000, 8200, 8400, 8600],
        total_equity: [4000, 4100, 4200, 4300]
      } as any
    } as any
  };

  const insurerReport: Partial<ReportData> = {
    ticker: 'INSURCO',
    company_profile: {
      sector: 'Financial Services',
      industry: 'Insurance - Property & Casualty',
      description: 'Commercial property and casualty insurance underwriter.'
    } as any,
    financial_statements: {
      statement_template: 'standard',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [1000, 1050, 1100, 1150],
        operating_income: [150, 160, 170, 180],
        net_income: [120, 128, 135, 142]
      } as any,
      balance_sheet: {
        total_assets: [15000, 15500, 16000, 16500],
        total_current_assets: [3000, 3100, 3200, 3300],
        total_current_liabilities: [2500, 2600, 2700, 2800],
        total_equity: [3500, 3600, 3700, 3800]
      } as any,
      cash_flow: {
        operating_cash_flow: [200, 210, 220, 230],
        free_cash_flow: [180, 190, 200, 210]
      } as any
    } as any
  };

  const cyclicalReport: Partial<ReportData> = {
    ticker: 'COMMODCO',
    company_profile: {
      sector: 'Energy',
      industry: 'Oil & Gas E&P',
      description: 'Upstream exploration and crude oil production.'
    } as any,
    financial_statements: {
      statement_template: 'standard',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [3000, 3500, 2800, 2200],
        operating_income: [1200, 1500, 800, 400],
        net_income: [900, 1150, 600, 280]
      } as any,
      balance_sheet: {
        total_assets: [12000, 12500, 13000, 13500]
      } as any,
      cash_flow: {
        free_cash_flow: [800, 1000, 500, 200]
      } as any
    } as any
  };

  const earlyStageReport: Partial<ReportData> = {
    ticker: 'DEEPTECH',
    company_profile: {
      sector: 'Industrials',
      industry: 'Aerospace & Space Technology',
      description: 'Next-generation orbital rocket development and space launch infrastructure.'
    } as any,
    financial_statements: {
      statement_template: 'standard',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      income_statement: {
        revenue: [10, 15, 25, 40],
        operating_income: [-80, -95, -110, -130],
        net_income: [-85, -100, -115, -135],
        gross_margin_pct: [-20.0, -10.0, 5.0, 15.0]
      } as any,
      cash_flow: {
        free_cash_flow: [-100, -120, -140, -160]
      } as any,
      balance_sheet: {
        total_assets: [500, 420, 350, 280],
        total_equity: [50, -20, -100, -180], // Negative equity
        cash_and_equivalents: [300, 210, 130, 60]
      } as any
    } as any
  };

  // =========================================================================
  // 1. Business Archetype Resolution
  // =========================================================================
  it('1. Resolves business archetypes accurately without hardcoded tickers', () => {
    assert.equal(resolveBusinessArchetype(softwareCompanyReport), 'saas_software');
    assert.equal(resolveBusinessArchetype(bankLenderReport), 'fintech');
    assert.equal(resolveBusinessArchetype(reitReport), 'reit');
    assert.equal(resolveBusinessArchetype(insurerReport), 'insurer');
    assert.equal(resolveBusinessArchetype(cyclicalReport), 'energy_commodity');
    assert.equal(resolveBusinessArchetype(earlyStageReport), 'early_stage');
  });

  // =========================================================================
  // 2. Click-Any-Metric Freedom
  // =========================================================================
  it('2. Preserves click-any-metric freedom: all valid metrics resolve to context without throwing', () => {
    const testMetrics = [
      'gross_margin',
      'operating_margin',
      'ebitda_margin',
      'net_margin',
      'current_ratio',
      'quick_ratio',
      'roe',
      'roa',
      'roic',
      'fcf',
      'fcf_to_sales',
      'fcf_to_net_income',
      'inventory_turnover',
      'ccc',
      'nim',
      'deposit_growth',
      'loan_deposit_ratio',
      'efficiency_ratio'
    ];

    for (const key of testMetrics) {
      const ctx = getMetricInterpretationContext({
        metricKey: key,
        metricName: key.toUpperCase(),
        reportData: bankLenderReport,
        ticker: 'LENDCO',
        periods: ['Q1 2026', 'Q2 2026'],
        historyValues: [70.0, 71.0]
      });
      assert.ok(ctx, `Metric ${key} must resolve to interpretation context`);
      assert.equal(ctx.metricKey, key);
      assert.ok(ctx.applicability, `Metric ${key} must have applicability defined`);
    }
  });

  // =========================================================================
  // 3. Business Context Changes Analysis (Same Metric, Different Archetype)
  // =========================================================================
  it('3. Business context changes analysis: EBITDA Margin for Software vs Lender', () => {
    const softwareCtx = getMetricInterpretationContext({
      metricKey: 'ebitda_margin',
      metricName: 'EBITDA Margin',
      reportData: softwareCompanyReport,
      ticker: 'CLOUDX',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [32.0, 35.0]
    });

    const lenderCtx = getMetricInterpretationContext({
      metricKey: 'ebitda_margin',
      metricName: 'EBITDA Margin',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [22.0, 23.0]
    });

    // Software: Primary operating KPI, no banking caveats
    assert.equal(softwareCtx.applicability, 'PRIMARY');
    assert.equal(softwareCtx.isFinancialSectorGuardActive, false);
    assert.equal(softwareCtx.interpretationCaveats.length, 0);

    // Lender: Secondary KPI with banking funding caveats
    assert.equal(lenderCtx.applicability, 'SECONDARY');
    assert.ok(lenderCtx.interpretationCaveats.some(c => c.includes('not generally the primary analytical lens for banking and lending')));
    assert.ok(lenderCtx.interpretationCaveatsTh.some(c => c.includes('ไม่ใช่ดัชนีชี้วัดหลักสำหรับธุรกิจการเงินและสินเชื่อ')));
  });

  // =========================================================================
  // 4. Financial Company Gross Margin Caveats
  // =========================================================================
  it('4. Financial company Gross Margin is explorable but receives CONTEXT_ONLY and caveats', () => {
    const grossMarginCtx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      historyValues: [74.5, 72.84, 71.64, 71.09]
    });

    assert.equal(grossMarginCtx.applicability, 'CONTEXT_ONLY');
    assert.equal(grossMarginCtx.industryStandardStatus, 'LUMINA_DERIVED_METRIC');
    assert.ok(grossMarginCtx.isCalculableButLimited);
    assert.ok(grossMarginCtx.interpretationCaveats.some(c => c.includes('Gross Margin is not a primary standard banking or lending KPI')));
    assert.ok(grossMarginCtx.interpretationCaveatsTh.some(c => c.includes('อัตรากำไรขั้นต้น (Gross Margin) ไม่ใช่ดัชนีชี้วัดหลักตามมาตรฐานธุรกิจธนาคารหรือสินเชื่อ')));

    // Suggests looking at verified banking metrics
    assert.ok(grossMarginCtx.relatedMetrics.some(m => m.key === 'nim'));
    assert.ok(grossMarginCtx.relatedMetrics.some(m => m.key === 'deposits'));
  });

  // =========================================================================
  // 5. Financial Sector Guard Integration for FCF
  // =========================================================================
  it('5. Financial Sector Guard applies to FCF for lenders and banks, preventing false alarms', () => {
    const fcfCtx = getMetricInterpretationContext({
      metricKey: 'fcf_to_net_income',
      metricName: 'FCF to Net Income Ratio',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [-700.0, -668.0] // Extreme negative due to loan originations
    });

    assert.equal(fcfCtx.isFinancialSectorGuardActive, true);
    assert.equal(fcfCtx.applicability, 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION');
    assert.ok(fcfCtx.interpretationCaveats.some(c => c.includes('Financial Sector Guard active')));
    assert.ok(fcfCtx.interpretationCaveats.some(c => c.includes('does not indicate operational deterioration or poor business quality')));
    assert.ok(fcfCtx.interpretationCaveatsTh.some(c => c.includes('Financial Sector Guard มีผลบังคับใช้')));
  });

  // =========================================================================
  // 6. Operating Company FCF Remains Normal
  // =========================================================================
  it('6. Operating company FCF retains normal cash-conversion interpretation without bank caveats', () => {
    const opFcfCtx = getMetricInterpretationContext({
      metricKey: 'fcf_to_net_income',
      metricName: 'FCF to Net Income Ratio',
      reportData: softwareCompanyReport,
      ticker: 'CLOUDX',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [118.0, 120.0]
    });

    assert.equal(opFcfCtx.isFinancialSectorGuardActive, false);
    assert.equal(opFcfCtx.applicability, 'PRIMARY');
    assert.equal(opFcfCtx.interpretationCaveats.length, 0);
  });

  // =========================================================================
  // 7. Missing Data (missing != zero)
  // =========================================================================
  it('7. Missing metric is marked unavailable and never substituted with zero', () => {
    const missingCtx = getMetricInterpretationContext({
      metricKey: 'nim',
      metricName: 'Net Interest Margin (NIM)',
      reportData: softwareCompanyReport,
      ticker: 'CLOUDX',
      periods: ['Q1 2026'],
      historyValues: [null]
    });

    assert.equal(missingCtx.isUnavailable, true);
    assert.equal(missingCtx.provenance, 'UNAVAILABLE');

    const fallback = getBusinessAwareLocalFallback(missingCtx, null, true);
    assert.equal(fallback.status_label_th, 'ไม่มีข้อมูล');
    assert.equal(fallback.status_label_en, 'Data unavailable');
    assert.ok(fallback.interpretation_th.includes('ไม่มีข้อมูล จึงไม่สร้างค่าหรือข้อสรุปทดแทน'));
  });

  // =========================================================================
  // 8. Negative Data (negative != missing)
  // =========================================================================
  it('8. Negative metric is evaluated as negative without being coerced to missing', () => {
    const negCtx = getMetricInterpretationContext({
      metricKey: 'fcf',
      metricName: 'Free Cash Flow',
      reportData: earlyStageReport,
      ticker: 'DEEPTECH',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [-140, -160]
    });

    assert.equal(negCtx.isUnavailable, false);
    assert.equal(negCtx.isNegative, true);
    assert.equal(negCtx.applicability, 'PRIMARY'); // For early stage, negative FCF is primary burn indicator
  });

  // =========================================================================
  // 9. Denominator Distortion Guard
  // =========================================================================
  it('9. Denominator distortion guard activates on extreme ratios from small/negative base', () => {
    const extremeRatioReport: Partial<ReportData> = {
      ticker: 'TINYNI',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        statement_template: 'standard',
        periods: ['Q1 2026', 'Q2 2026'],
        income_statement: {
          revenue: [100, 100],
          net_income: [0.2, 0.1] // Near zero
        } as any,
        cash_flow: {
          free_cash_flow: [50, 60]
        } as any
      } as any
    };

    const ratioCtx = getMetricInterpretationContext({
      metricKey: 'fcf_to_net_income',
      metricName: 'FCF to Net Income Ratio',
      reportData: extremeRatioReport,
      ticker: 'TINYNI',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [25000, 60000] // Extremely large percentage
    });

    assert.ok(ratioCtx.denominatorCaveats.some(c => c.includes('Denominator Distortion')));
    assert.ok(ratioCtx.denominatorCaveatsTh.some(c => c.includes('ตัวหารบิดเบือน')));
  });

  // =========================================================================
  // 10. REIT Specific Caveats
  // =========================================================================
  it('10. REIT generic FCF receives REIT-specific depreciation and FFO/AFFO caveats', () => {
    const reitCtx = getMetricInterpretationContext({
      metricKey: 'fcf',
      metricName: 'Free Cash Flow',
      reportData: reitReport,
      ticker: 'PROPCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [52, 55]
    });

    assert.equal(reitCtx.applicability, 'SECONDARY');
    assert.ok(reitCtx.interpretationCaveats.some(c => c.includes('For REITs, standard FCF includes large accounting depreciation')));
    assert.ok(reitCtx.interpretationCaveats.some(c => c.includes('prioritizes FFO and AFFO')));
  });

  // =========================================================================
  // 11. Insurer Specific Caveats
  // =========================================================================
  it('11. Insurer Current Ratio receives liquidity/statutory reserve caveats', () => {
    const insurerCtx = getMetricInterpretationContext({
      metricKey: 'current_ratio',
      metricName: 'Current Ratio',
      reportData: insurerReport,
      ticker: 'INSURCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [1.19, 1.18]
    });

    assert.equal(insurerCtx.applicability, 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION');
    assert.ok(insurerCtx.interpretationCaveats.some(c => c.includes('designed for non-financial commercial firms')));
  });

  // =========================================================================
  // 12. Cyclical / Energy Commodity Caveats
  // =========================================================================
  it('12. Cyclical commodity company EBITDA receives commodity cycle sensitivity caveats', () => {
    const cyclicalCtx = getMetricInterpretationContext({
      metricKey: 'ebitda_margin',
      metricName: 'EBITDA Margin',
      reportData: cyclicalReport,
      ticker: 'COMMODCO',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [28.5, 18.2]
    });

    assert.equal(cyclicalCtx.applicability, 'PRIMARY');
    assert.ok(cyclicalCtx.interpretationCaveats.some(c => c.includes('commodity and cyclical companies is highly sensitive to commodity price swings')));
  });

  // =========================================================================
  // 13. Early-Stage ROE Denominator Limitation
  // =========================================================================
  it('13. Early-stage pre-profit ROE receives negative equity denominator caveat', () => {
    const earlyRoeCtx = getMetricInterpretationContext({
      metricKey: 'roe',
      metricName: 'ROE',
      reportData: earlyStageReport,
      ticker: 'DEEPTECH',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [300.0, 75.0] // Distorted mathematically due to negative equity
    });

    assert.equal(earlyRoeCtx.applicability, 'CONTEXT_ONLY');
    assert.ok(earlyRoeCtx.interpretationCaveats.some(c => c.includes('negative or negligible equity, ROE and ROA denominators can produce mathematically extreme or misleading percentages')));
  });

  // =========================================================================
  // 14. Prompt Construction & Integrity
  // =========================================================================
  it('14. Prompt construction injects business context, rules, caveats, and guards', () => {
    const grossMarginCtx = getMetricInterpretationContext({
      metricKey: 'gross_margin',
      metricName: 'Gross Margin',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [72.84, 71.09],
      yoyPcts: [-2.2, -2.4]
    });

    const prompt = buildFinancialMetricAnalysisPrompt(grossMarginCtx, {
      normalizedCompanyName: 'LendCo Financial',
      normalizedTicker: 'LENDCO',
      periods: ['Q1 2026', 'Q2 2026'],
      historyValues: [72.84, 71.09],
      yoyPcts: [-2.2, -2.4],
      unit: '%',
      isCurrency: false,
      isThai: true
    });

    assert.ok(prompt.includes('SELECTED METRIC MUST REMAIN THE SUBJECT'));
    assert.ok(prompt.includes('Gross Margin is not a primary standard banking or lending KPI'));
    assert.ok(prompt.includes('NO UNSOURCED BENCHMARKS'));
    assert.ok(prompt.includes('STRICT_STRENGTHS_AND_WATCHOUTS') || prompt.includes('KEY STRENGTHS & WATCHOUTS'));
    assert.ok(prompt.includes('FinTech & Digital Banking Platform') || prompt.includes('fintech'));
  });

  // =========================================================================
  // 15. Local Fallback Quality
  // =========================================================================
  it('15. Local fallback provides business-aware content when AI is offline or loading', () => {
    const fcfCtx = getMetricInterpretationContext({
      metricKey: 'fcf_to_net_income',
      metricName: 'FCF to Net Income Ratio',
      reportData: bankLenderReport,
      ticker: 'LENDCO',
      periods: ['Q3 2026', 'Q4 2026'],
      historyValues: [-700.0, -668.0]
    });

    const fallbackTh = getBusinessAwareLocalFallback(fcfCtx, -668.0, true);
    assert.equal(fallbackTh.status, 'neutral');
    assert.ok(fallbackTh.status_label_th.includes('Financial Sector Guard'));
    assert.ok(fallbackTh.interpretation_th.includes('ไม่สะท้อนปัญหาการดำเนินงาน'));
    assert.ok(fallbackTh.pros_th.length > 0);

    const fallbackEn = getBusinessAwareLocalFallback(fcfCtx, -668.0, false);
    assert.equal(fallbackEn.status, 'neutral');
    assert.ok(fallbackEn.status_label_en.includes('Financial Sector Guard'));
    assert.ok(fallbackEn.interpretation_en.includes('do not indicate operational failure'));
  });

});
