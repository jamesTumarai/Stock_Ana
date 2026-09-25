import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import { resolveFundamentalMetrics } from '../metricRegistry';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import { discoverPeers } from '../peerDiscoveryEngine';
import { normalizeDurationFactsToStandaloneQuarters } from '../../../services/sec/xbrlNormalizer';
import type { SecCompanyFact } from '../../../services/sec/secClient';

describe('Adaptive Five Pillars Data Completeness & Cross-Metric Integrity', () => {

  // =========================================================================
  // 1. CASH FLOW YTD NORMALIZATION & STANDALONE QUARTER FCF DERIVATION
  // =========================================================================
  it('1. Normalizes cumulative cash flows (Q1, 6M YTD, 9M YTD, FY) into standalone quarters and derives standalone FCF', () => {
    // Q1 OCF=100, CapEx=-40 -> FCF=60
    // Q2 6M OCF=260 (Q2 standalone=160), 6M CapEx=-90 (Q2 standalone=-50) -> Q2 FCF=110
    // Q3 9M OCF=450 (Q3 standalone=190), 9M CapEx=-150 (Q3 standalone=-60) -> Q3 FCF=130
    // FY OCF=650 (Q4 standalone=200), FY CapEx=-220 (Q4 standalone=-70) -> Q4 FCF=130
    const ocfFacts: SecCompanyFact[] = [
      { start: '2025-01-01', end: '2025-03-31', val: 100, fy: 2025, fp: 'Q1', form: '10-Q', filed: '2025-05-01', accn: 'acc-q1' },
      { start: '2025-01-01', end: '2025-06-30', val: 260, fy: 2025, fp: 'Q2', form: '10-Q', filed: '2025-08-01', accn: 'acc-q2' },
      { start: '2025-01-01', end: '2025-09-30', val: 450, fy: 2025, fp: 'Q3', form: '10-Q', filed: '2025-11-01', accn: 'acc-q3' },
      { start: '2025-01-01', end: '2025-12-31', val: 650, fy: 2025, fp: 'FY', form: '10-K', filed: '2026-02-15', accn: 'acc-fy' },
    ];
    const capexFacts: SecCompanyFact[] = [
      { start: '2025-01-01', end: '2025-03-31', val: 40, fy: 2025, fp: 'Q1', form: '10-Q', filed: '2025-05-01', accn: 'acc-q1' },
      { start: '2025-01-01', end: '2025-06-30', val: 90, fy: 2025, fp: 'Q2', form: '10-Q', filed: '2025-08-01', accn: 'acc-q2' },
      { start: '2025-01-01', end: '2025-09-30', val: 150, fy: 2025, fp: 'Q3', form: '10-Q', filed: '2025-11-01', accn: 'acc-q3' },
      { start: '2025-01-01', end: '2025-12-31', val: 220, fy: 2025, fp: 'FY', form: '10-K', filed: '2026-02-15', accn: 'acc-fy' },
    ];

    const normOcf = normalizeDurationFactsToStandaloneQuarters(ocfFacts);
    const normCapex = normalizeDurationFactsToStandaloneQuarters(capexFacts);

    assert.equal(normOcf.length, 4);
    assert.deepEqual(normOcf.map(f => [f.fiscalQuarter, f.value]), [[1, 100], [2, 160], [3, 190], [4, 200]]);
    assert.deepEqual(normCapex.map(f => [f.fiscalQuarter, f.value]), [[1, 40], [2, 50], [3, 60], [4, 70]]);

    const standaloneFcf = normOcf.map((ocf, idx) => ocf.value - Math.abs(normCapex[idx].value));
    assert.deepEqual(standaloneFcf, [60, 110, 130, 130]);
  });

  // =========================================================================
  // 2. FCF SAME-QUARTER YOY COMPARISONS (NORMAL, TURNAROUND, DETERIORATION, BOTH NEGATIVE)
  // =========================================================================
  it('2. FCF Same-Quarter YoY handles normal, turnaround, deterioration, and both-negative cases correctly', () => {
    // A: Normal Positive Growth (+25%)
    const reportNormal: Partial<ReportData> = {
      ticker: 'CORP_NORM',
      financial_statements: {
        periods: ['Q2 2024', 'Q2 2025'],
        cash_flow: {
          free_cash_flow: [100, 125],
        } as any,
      } as any,
    };
    const resNormal = resolveFundamentalMetrics(reportNormal, 'CORP_NORM');
    assert.equal(resNormal.fcfGrowthYoY.value, 25);
    assert.equal(resNormal.fcfGrowthYoY.status, 'CALCULATED');

    // B: Turnaround from Negative to Positive
    const reportTurnaround: Partial<ReportData> = {
      ticker: 'CORP_TURN',
      financial_statements: {
        periods: ['Q2 2024', 'Q2 2025'],
        cash_flow: {
          free_cash_flow: [-50, 80],
        } as any,
      } as any,
    };
    const resTurn = resolveFundamentalMetrics(reportTurnaround, 'CORP_TURN');
    assert.equal(resTurn.fcfGrowthYoY.status, 'TURNAROUND');
    assert.equal(resTurn.fcfGrowthYoY.reason, 'TURNAROUND_FROM_NEGATIVE_TO_POSITIVE');

    // C: Deterioration from Positive to Negative
    const reportDeteriorate: Partial<ReportData> = {
      ticker: 'CORP_DET',
      financial_statements: {
        periods: ['Q2 2024', 'Q2 2025'],
        cash_flow: {
          free_cash_flow: [80, -30],
        } as any,
      } as any,
    };
    const resDet = resolveFundamentalMetrics(reportDeteriorate, 'CORP_DET');
    assert.equal(resDet.fcfGrowthYoY.status, 'DETERIORATION');
    assert.equal(resDet.fcfGrowthYoY.reason, 'DETERIORATION_FROM_POSITIVE_TO_NEGATIVE');

    // D: Both Periods Negative
    const reportBothNeg: Partial<ReportData> = {
      ticker: 'CORP_NEG',
      financial_statements: {
        periods: ['Q2 2024', 'Q2 2025'],
        cash_flow: {
          free_cash_flow: [-40, -20],
        } as any,
      } as any,
    };
    const resBothNeg = resolveFundamentalMetrics(reportBothNeg, 'CORP_NEG');
    assert.equal(resBothNeg.fcfGrowthYoY.status, 'UNAVAILABLE');
    assert.equal(resBothNeg.fcfGrowthYoY.reason, 'BOTH_PERIODS_NEGATIVE_FCF');
  });

  // =========================================================================
  // 3. FCF CROSS-METRIC SIGN INVARIANT
  // =========================================================================
  it('3. FCF sign consistency: when TTM Net Income > 0 and TTM FCF < 0, FCF Yield and FCF Conversion are both negative without sign contradiction', () => {
    // 4 quarters: Q1 2024 to Q4 2024
    // Net Income = [500, 500, 500, 500] -> TTM Net Income = 2000 > 0
    // OCF = [200, 200, 200, 200] -> 800
    // CapEx = [-400, -400, -400, -400] -> -1600
    // FCF = [-200, -200, -200, -200] -> TTM FCF = -800 < 0
    // Market Cap = 40,000
    const report: Partial<ReportData> = {
      ticker: 'BURN_CORP',
      market_snapshot: {
        market_cap: 40000,
      } as any,
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        income_statement: {
          revenue: [5000, 5000, 5000, 5000],
          net_income: [500, 500, 500, 500],
        } as any,
        cash_flow: {
          operating_cash_flow: [200, 200, 200, 200],
          capex: [-400, -400, -400, -400],
          free_cash_flow: [-200, -200, -200, -200],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'BURN_CORP');

    // FCF Yield: TTM FCF (-800) / MCap (40,000) = -2.0%
    assert.ok(typeof metrics.fcfYield.value === 'number', 'FCF Yield must be calculated');
    assert.equal(metrics.fcfYield.value, -2.0);
    assert.ok(metrics.fcfYield.value! < 0, 'FCF Yield must be strictly negative');

    // FCF Conversion: TTM FCF (-800) / TTM NI (2,000) = -40.0%
    assert.ok(typeof metrics.fcfConversion.value === 'number', 'FCF Conversion must be calculated');
    assert.equal(metrics.fcfConversion.value, -40.0);
    assert.ok(metrics.fcfConversion.value! < 0, 'FCF Conversion must be strictly negative');

    // Sign Invariant Check: They MUST share the same negative sign!
    assert.equal(Math.sign(metrics.fcfYield.value!), Math.sign(metrics.fcfConversion.value!),
      'FCF Yield and FCF Conversion must share the same canonical TTM FCF sign when Net Income > 0');
  });

  // =========================================================================
  // 4. STANDALONE QUARTER FCF NEGATIVE WHILE TTM FCF POSITIVE
  // =========================================================================
  it('4. Standalone quarter FCF negative while TTM FCF positive: FCF Margin reflects quarter while FCF Yield reflects TTM with distinct period labeling', () => {
    // Q1-Q3 positive, Q4 heavy CapEx investment causing negative standalone FCF
    // Q1: OCF 1000, CapEx -200 -> FCF 800, Rev 5000
    // Q2: OCF 1000, CapEx -200 -> FCF 800, Rev 5000
    // Q3: OCF 1000, CapEx -200 -> FCF 800, Rev 5000
    // Q4: OCF 600, CapEx -1000 -> FCF -400, Rev 5000
    // TTM FCF = 800 + 800 + 800 - 400 = +2000 (Positive!)
    // Latest Quarter (Q4) FCF = -400 (Negative!)
    // Market Cap = 50,000
    const report: Partial<ReportData> = {
      ticker: 'SEASONAL_CO',
      market_snapshot: {
        market_cap: 50000,
      } as any,
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        income_statement: {
          revenue: [5000, 5000, 5000, 5000],
          net_income: [400, 400, 400, 400],
        } as any,
        cash_flow: {
          operating_cash_flow: [1000, 1000, 1000, 600],
          capex: [-200, -200, -200, -1000],
          free_cash_flow: [800, 800, 800, -400],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'SEASONAL_CO');

    // Standalone Q4 FCF Margin = -400 / 5000 = -8.0%
    assert.equal(metrics.fcfMargin.value, -8.0);
    assert.match(metrics.fcfMargin.basis || '', /Q4/i);
    assert.match(metrics.fcfMargin.period || '', /Q4/i);

    // TTM FCF Yield = +2000 / 50000 = +4.0%
    assert.equal(metrics.fcfYield.value, 4.0);
    assert.match(metrics.fcfYield.basis || '', /TTM/);

    // Both coexist truthfully without collision
    assert.ok(metrics.fcfMargin.value! < 0, 'FCF Margin for Q4 should be negative');
    assert.ok(metrics.fcfYield.value! > 0, 'FCF Yield for TTM should be positive');
  });

  // =========================================================================
  // 5. SHAREHOLDER YIELD RETRIEVAL & NEGATIVE DILUTION
  // =========================================================================
  it('5. Shareholder Yield calculates positive returns, permits negative dilution, and handles missing disclosures without false zero assumptions', () => {
    // Case A: Complete Positive Shareholder Yield
    // MCap = 100,000, Dividends = 1,000 (1%), Net Repurchases = 2,000 (2%), Issuance = 0 -> Shareholder Yield = 3.0%
    const reportPositive: Partial<ReportData> = {
      ticker: 'DIV_BUYBACK_CO',
      market_snapshot: { market_cap: 100000, dividend_yield: 0.01 } as any,
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        cash_flow: {
          operating_cash_flow: [1000, 1000, 1000, 1000],
          capex: [-200, -200, -200, -200],
          free_cash_flow: [800, 800, 800, 800],
        } as any,
      } as any,
      sec_verification: {
        sec_period_statements: [
          { period: 'Q1 2024', repurchase_of_common_stock: 500, issuance_of_common_stock: 0, operating_cash_flow: 1000, capital_expenditure: -200 },
          { period: 'Q2 2024', repurchase_of_common_stock: 500, issuance_of_common_stock: 0, operating_cash_flow: 1000, capital_expenditure: -200 },
          { period: 'Q3 2024', repurchase_of_common_stock: 500, issuance_of_common_stock: 0, operating_cash_flow: 1000, capital_expenditure: -200 },
          { period: 'Q4 2024', repurchase_of_common_stock: 500, issuance_of_common_stock: 0, operating_cash_flow: 1000, capital_expenditure: -200 },
        ],
      } as any,
    };
    const resPos = resolveFundamentalMetrics(reportPositive, 'DIV_BUYBACK_CO');
    assert.equal(resPos.netBuybackYield.value, 2.0);
    assert.equal(resPos.dividendYield.value, 1.0);
    assert.equal(resPos.shareholderYield.value, 3.0);
    assert.equal(resPos.shareholderYield.status, 'CALCULATED');

    // Case B: Net Dilution (Negative Shareholder Yield: Issuances exceed Repurchases)
    // MCap = 50,000, Dividends = 0, Repurchases = 200, Issuance = 1,200 -> Net Buyback = -1,000 / 50,000 = -2.0%
    const reportDilutive: Partial<ReportData> = {
      ticker: 'DILUTIVE_CO',
      market_snapshot: { market_cap: 50000, dividend_yield: 0.0 } as any,
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        cash_flow: {
          free_cash_flow: [500, 500, 500, 500],
        } as any,
      } as any,
      sec_verification: {
        sec_period_statements: [
          { period: 'Q1 2024', repurchase_of_common_stock: 50, issuance_of_common_stock: 300 },
          { period: 'Q2 2024', repurchase_of_common_stock: 50, issuance_of_common_stock: 300 },
          { period: 'Q3 2024', repurchase_of_common_stock: 50, issuance_of_common_stock: 300 },
          { period: 'Q4 2024', repurchase_of_common_stock: 50, issuance_of_common_stock: 300 },
        ],
      } as any,
    };
    const resDil = resolveFundamentalMetrics(reportDilutive, 'DILUTIVE_CO');
    assert.equal(resDil.netBuybackYield.value, -2.0);
    assert.equal(resDil.shareholderYield.value, -2.0);
    assert.equal(resDil.shareholderYield.status, 'CALCULATED');

    // Case C: Missing Disclosures (Does NOT assume 0 without disclosure)
    const reportMissing: Partial<ReportData> = {
      ticker: 'MISSING_DATA_CO',
      market_snapshot: { market_cap: 50000 } as any,
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        cash_flow: { free_cash_flow: [100, 100, 100, 100] } as any,
      } as any,
    };
    const resMissing = resolveFundamentalMetrics(reportMissing, 'MISSING_DATA_CO');
    assert.equal(resMissing.shareholderYield.status, 'UNAVAILABLE');
    assert.equal(resMissing.shareholderYield.value, undefined);
  });

  // =========================================================================
  // 6. 3Y REVENUE CAGR RESTORATION FROM ANNUAL HISTORY
  // =========================================================================
  it('6. 3Y Revenue CAGR: merges annual SEC history with verified facts so multi-year history is not discarded', () => {
    // Annual revenue: 2022=50000, 2023=60000, 2024=72000, 2025=86400 (20% CAGR over 3 years)
    const report: Partial<ReportData> = {
      ticker: 'GROWTH_CO',
      financial_statements: {
        periods: ['FY 2022', 'FY 2023', 'FY 2024', 'FY 2025'],
        income_statement: {
          revenue: [50000, 60000, 72000, 86400],
        } as any,
      } as any,
      sec_verification: {
        verified_canonical_financials: {
          values: {
            // Verified canonical has latest FY2025
            'income_statement.revenue': [
              { period: '2025', value: 86400, verification: 'verified' },
            ],
          },
        },
        sec_period_statements: [
          // SEC statements have earlier FY2022, FY2023, FY2024
          { period: 'FY 2022', form: '10-K', revenue: 50000 },
          { period: 'FY 2023', form: '10-K', revenue: 60000 },
          { period: 'FY 2024', form: '10-K', revenue: 72000 },
          { period: 'FY 2025', form: '10-K', revenue: 86400 },
        ],
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'GROWTH_CO');
    assert.equal(metrics.revenueCagr3Y.status, 'CALCULATED');
    assert.equal(Math.round(metrics.revenueCagr3Y.value! * 10) / 10, 20.0);
    assert.match(metrics.revenueCagr3Y.period || '', /2022.*2025/);
  });

  // =========================================================================
  // 7. FCF HISTORY RESTORATION FROM CANONICAL FINANCIALS FOR FCF GROWTH YOY
  // =========================================================================
  it('7. FCF Growth YoY retains canonical multi-quarter statements to find prior year comparable quarter', () => {
    // 8 quarters: Q1 2024 - Q4 2025
    // Latest is Q4 2025 with FCF 1500; Prior year comparable is Q4 2024 with FCF 1000
    // Growth = (1500 / 1000 - 1) * 100 = 50.0%
    const report: Partial<ReportData> = {
      ticker: 'FCF_MULTI_Q',
      financial_statements: {
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
        cash_flow: {
          free_cash_flow: [800, 850, 900, 1000, 1100, 1200, 1300, 1500],
        } as any,
      } as any,
      sec_verification: {
        verified_canonical_financials: {
          values: {
            'cash_flow.free_cash_flow': [
              { period: 'Q4 2024', value: 1000, verification: 'verified' },
              { period: 'Q4 2025', value: 1500, verification: 'verified' },
            ],
          },
        },
        sec_period_statements: [
          // SEC statements only has recent 2 quarters
          { period: 'Q3 2025', operating_cash_flow: 1800, capital_expenditure: -500 },
          { period: 'Q4 2025', operating_cash_flow: 2100, capital_expenditure: -600 },
        ],
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'FCF_MULTI_Q');
    assert.equal(metrics.fcfGrowthYoY.status, 'CALCULATED');
    assert.equal(metrics.fcfGrowthYoY.value, 50.0);
    assert.equal(metrics.fcfGrowthYoY.basis, 'Quarter YoY');
  });

  // =========================================================================
  // 8. PEER REVENUE GROWTH MEDIAN INCLUSION & DIRECT PEER UNVERIFIED ISOLATION
  // =========================================================================
  it('8. Peer Revenue Growth includes verified quarterly peers (n >= 3) and isolates unverified status to direct peer column', () => {
    const targetRep: Partial<ReportData> = {
      ticker: 'TARGET_EV',
      company_profile: {
        company_name: 'Target EV Corp',
        overview: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any,
      } as any,
      financial_statements: {
        currency: 'USD',
        periods: ['Q2 2024', 'Q2 2025'],
        income_statement: {
          revenue: [10000, 12000],
          yoy_revenue_growth_pct: [null, 20.0],
        } as any,
      } as any,
    };

    const candidates = [
      // Direct Peer: Verified identity, quarterly revenue growth 18.2%
      {
        ticker: 'PEER_DIRECT',
        companyName: 'Direct EV Peer',
        archetype: 'industrial_manufacturing',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        subIndustry: 'automotive_manufacturing',
        revenueModels: ['vehicle_sales'],
        majorBusinessLines: ['vehicles'],
        geography: 'US',
        lifecycle: 'mature',
        profitabilityState: 'profitable',
        capitalIntensity: 'capital_intensive',
        regulatoryType: 'standard',
        scaleTier: 'large',
        relation_type: 'DIRECT_PEER',
        metrics: {
          revenue_growth_yoy_pct: {
            value: 18.2, unit: '%', period: 'Q2 2025', status: 'VERIFIED', source: 'SEC Form 10-Q', reportedOrDerived: 'REPORTED',
          },
          pe_trailing: { value: 20.0, unit: 'x', period: 'TTM', status: 'VERIFIED', source: 'SEC Form 10-Q', reportedOrDerived: 'REPORTED' },
        },
      },
      // Peer 2: Close Comparable, quarterly revenue growth 15.0%
      {
        ticker: 'PEER_CLOSE1',
        companyName: 'Close Comparable 1',
        archetype: 'industrial_manufacturing',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        subIndustry: 'automotive_manufacturing',
        revenueModels: ['vehicle_sales'],
        majorBusinessLines: ['vehicles'],
        geography: 'US',
        lifecycle: 'mature',
        profitabilityState: 'profitable',
        capitalIntensity: 'capital_intensive',
        regulatoryType: 'standard',
        scaleTier: 'mega',
        relation_type: 'CLOSE_COMPARABLE',
        metrics: {
          revenue_growth_yoy_pct: {
            value: 15.0, unit: '%', period: 'Q2 2025', status: 'VERIFIED', source: 'SEC Form 10-Q', reportedOrDerived: 'REPORTED',
          },
          pe_trailing: { value: 25.0, unit: 'x', period: 'TTM', status: 'VERIFIED', source: 'Market snapshot', reportedOrDerived: 'REPORTED' },
        },
      },
      // Peer 3: Close Comparable, quarterly revenue growth 22.0%
      {
        ticker: 'PEER_CLOSE2',
        companyName: 'Close Comparable 2',
        archetype: 'industrial_manufacturing',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        subIndustry: 'automotive_manufacturing',
        revenueModels: ['vehicle_sales'],
        majorBusinessLines: ['vehicles'],
        geography: 'US',
        lifecycle: 'mature',
        profitabilityState: 'profitable',
        capitalIntensity: 'capital_intensive',
        regulatoryType: 'standard',
        scaleTier: 'large',
        relation_type: 'CLOSE_COMPARABLE',
        metrics: {
          revenue_growth_yoy_pct: {
            value: 22.0, unit: '%', period: 'Q2 2025', status: 'VERIFIED', source: 'SEC Form 10-Q', reportedOrDerived: 'REPORTED',
          },
          pe_trailing: { value: 30.0, unit: 'x', period: 'TTM', status: 'VERIFIED', source: 'Market snapshot', reportedOrDerived: 'REPORTED' },
        },
      },
    ];

    const result = discoverPeers(targetRep, 'TARGET_EV', {
      candidates: candidates as any,
      disableFixtureFallback: true,
    });

    // Sample count for revenue_growth_yoy_pct must be >= 3!
    assert.equal(result.metricSampleCounts.revenue_growth_yoy_pct, 3);
    assert.equal(result.medians.revenue_growth_yoy_pct, 18.2);

    const revRow = result.benchmarkRows.find(r => r.metric_name.includes('Revenue Growth'));
    assert.ok(revRow, 'Revenue Growth row must exist');
    assert.equal(revRow?.peer_coverage_status, 'SUFFICIENT');
    assert.equal(revRow?.direct_peer_value, '18.2%');
    assert.equal(revRow?.direct_peer_status, 'VERIFIED');
  });

  // =========================================================================
  // 9. CROSS-SECTOR ADAPTIVE PILLAR 4 METRIC SELECTION & UNIFIED TITLE
  // =========================================================================
  it('9. Adapts Pillar 4 metric selection across sectors with unified title "Shareholder Return & Cash Quality"', () => {
    // A: Banking Archetype -> Pillar 4 uses Shareholder Yield / Dividend Yield (FCF guarded)
    const bankReport: Partial<ReportData> = {
      ticker: 'JPM_MOCK',
      company_profile: { sector: 'Financial Services', industry: 'Banks - Diversified' } as any,
      market_snapshot: { market_cap: 500000, dividend_yield: 0.025 } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [150000], net_income: [50000] } as any,
        balance_sheet: { total_equity: [300000], total_assets: [3000000] } as any,
      } as any,
    };
    const bankResolved = resolveAdaptiveFivePillars(bankReport, 'JPM_MOCK');
    assert.equal(bankResolved.pillars.yields.titleEn, '4. Shareholder Return & Cash Quality');
    assert.equal(bankResolved.pillars.yields.titleTh, '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)');
    assert.equal(bankResolved.fivePillarsData.yields.is_fcf_guarded, true);
    const bankFcfMetric = bankResolved.pillars.yields.metrics.find(m => m.key === 'fcf_yield');
    if (bankFcfMetric) {
      assert.equal(bankFcfMetric.status, 'GUARDED_FOR_BUSINESS_MODEL');
    }

    // B: REIT Archetype -> Pillar 4 uses Dividend Yield / P/FFO (FCF guarded)
    const reitReport: Partial<ReportData> = {
      ticker: 'O_MOCK',
      company_profile: { sector: 'Real Estate', industry: 'REIT - Retail' } as any,
      market_snapshot: { market_cap: 40000, dividend_yield: 0.055 } as any,
      valuation_ratios: [{ name: 'P/FFO', value: 14.5 } as any],
    };
    const reitResolved = resolveAdaptiveFivePillars(reitReport, 'O_MOCK');
    assert.equal(reitResolved.pillars.yields.titleEn, '4. Shareholder Return & Cash Quality');
    assert.equal(reitResolved.pillars.yields.titleTh, '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)');
    assert.equal(reitResolved.fivePillarsData.yields.dividend_yield_pct, 5.5);

    // C: Early Stage / Pre-profit Archetype -> Pillar 4 uses Cash Runway / Cash Burn Rate
    const bioReport: Partial<ReportData> = {
      ticker: 'BIO_MOCK',
      company_profile: { sector: 'Healthcare', industry: 'Biotechnology' } as any,
      market_snapshot: { market_cap: 1000 } as any,
      key_indicators: {
        cash_runway_months: 18,
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [10], net_income: [-50] } as any,
        cash_flow: { free_cash_flow: [-40] } as any,
      } as any,
    };
    const bioResolved = resolveAdaptiveFivePillars(bioReport, 'BIO_MOCK');
    assert.equal(bioResolved.pillars.yields.titleEn, '4. Shareholder Return & Cash Quality');
    assert.equal(bioResolved.pillars.yields.titleTh, '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)');
    assert.equal(bioResolved.fivePillarsData.balance_sheet.cash_runway_months, 18);
  });

});
