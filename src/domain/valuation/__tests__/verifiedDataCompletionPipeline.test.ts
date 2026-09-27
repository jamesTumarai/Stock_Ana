import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData, PeerCompanyItem } from '../../../types.js';
import { resolveFundamentalMetrics } from '../metricRegistry.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { discoverPeers, extractCandidateMetrics, type CandidateDefinition } from '../peerDiscoveryEngine.js';
import { candidateToPeerCompanyItem, enrichPeerCandidate } from '../../../../server/services/peerFinancialEnrichmentService.js';
import { normalizeReport } from '../../../utils/reportIntegrity.js';
import { validTrailingFourQuarterLabels, parseFiscalQuarterOrdinalFromLabel } from '../canonicalQuarterWindow.js';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../financialValue.js';

describe('Verified Data Completion Pipeline — PR #172 Regression Repair', () => {

  // 1. Structured Fiscal Identity & Non-Standard Labels
  it('1. Parses structured fiscal quarter ordinals from non-standard display labels without failing', () => {
    assert.equal(parseFiscalQuarterOrdinalFromLabel('Q1 2026'), 2026 * 4 + 0);
    assert.equal(parseFiscalQuarterOrdinalFromLabel('Q2 FY2026'), 2026 * 4 + 1);
    assert.equal(parseFiscalQuarterOrdinalFromLabel('FY2026 Q3'), 2026 * 4 + 2);
    assert.equal(parseFiscalQuarterOrdinalFromLabel('2026-Q4'), 2026 * 4 + 3);
    assert.equal(parseFiscalQuarterOrdinalFromLabel('2026 Q1'), 2026 * 4 + 0);

    // Valid 4-quarter TTM window with varied label styles
    const consecutive = ['Q3 FY2025', 'FY2025 Q4', '2026-Q1', 'Q2 2026'];
    assert.equal(validTrailingFourQuarterLabels(consecutive), true);

    // Non-consecutive window fails closed
    const nonConsecutive = ['Q1 2025', 'Q2 2025', 'Q4 2025', 'Q1 2026'];
    assert.equal(validTrailingFourQuarterLabels(nonConsecutive), false);
  });

  // 2. Partial Canonical Dataset & Metric-Level Verification Gating
  it('2. Metric-level verification: partial canonical financials resolves verified metrics even when provenanceStatus is unverified', () => {
    const periods = ['Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

    const makeSeries = (metric: string, statement: any, vals: number[], verified: boolean = true): CanonicalFinancialValue[] =>
      periods.map((p, i) => {
        const match = p.match(/Q([1-4])\s+(\d{4})/);
        return {
          metric,
          statement,
          value: vals[i],
          unit: 'USD_M',
          period: p,
          fiscalYear: match ? Number(match[2]) : 2025,
          fiscalQuarter: (match ? Number(match[1]) : 1) as (1 | 2 | 3 | 4),
          periodType: 'quarter',
          type: 'reported',
          verification: verified ? 'verified' : 'unverified',
          concept: metric,
          source: { provider: 'SEC EDGAR Test Fixture' },
        };
      });

    const canonicalDataset: CanonicalFinancialDataset = {
      ticker: 'TEST_CORP',
      currency: 'USD',
      schemaVersion: 1,
      generatedBy: 'sec_xbrl_normalizer',
      provenanceStatus: 'unverified', // Unrelated metric is unverified
      periods,
      provenanceWarnings: [],
      sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 10, nonNullValues: 10, missingValues: 0, totalValues: 10 },
      values: {
        'income_statement.revenue': makeSeries('revenue', 'income_statement', [1000, 1100, 1200, 1300, 1400]),
        'income_statement.operating_income': makeSeries('operating_income', 'income_statement', [100, 110, 120, 130, 150]),
        'income_statement.net_income': makeSeries('net_income', 'income_statement', [80, 90, 95, 105, 120]),
        'income_statement.eps_diluted': makeSeries('eps_diluted', 'income_statement', [0.80, 0.90, 0.95, 1.05, 1.20]),
        'balance_sheet.total_equity': makeSeries('total_equity', 'balance_sheet', [2000, 2100, 2200, 2300, 2500]),
        'balance_sheet.total_debt': makeSeries('total_debt', 'balance_sheet', [500, 500, 500, 500, 500]),
        'balance_sheet.cash_and_equivalents': makeSeries('cash_and_equivalents', 'balance_sheet', [300, 350, 400, 450, 500]),
        'balance_sheet.total_assets': makeSeries('total_assets', 'balance_sheet', [3500, 3600, 3700, 3800, 4000]),
        'income_statement.interest_expense': makeSeries('interest_expense', 'income_statement', [-20, -20, -20, -20, -25]),
        // Unrelated metric unverified
        'balance_sheet.operating_lease_liabilities': makeSeries('operating_lease_liabilities', 'balance_sheet', [10, 10, 10, 10, 10], false),
      },
    };

    const report: Partial<ReportData> = {
      ticker: 'TEST_CORP',
      company_profile: { overview: { sector: 'Technology', industry: 'Software—Infrastructure' } as any },
      canonical_financials: canonicalDataset,
      financial_statements: {
        periods,
        currency: 'USD',
        income_statement: {} as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'TEST_CORP');

    // Revenue Growth: Q2 2026 (1400) vs Q2 2025 (1000) = +40.0%
    assert.equal(metrics.revenueGrowthYoY.value, 40);
    assert.equal(metrics.revenueGrowthYoY.status, 'CALCULATED');

    // Operating Margin: 150 / 1400 = 10.71%
    assert.equal(metrics.operatingMargin.value, 10.71);
    assert.equal(metrics.operatingMargin.status, 'REPORTED');

    // EPS Growth: 1.20 vs 0.80 = +50.0%
    assert.equal(metrics.epsGrowthYoY.value, 50);
    assert.equal(metrics.epsGrowthYoY.status, 'CALCULATED');

    // ROE: TTM Net Income (90 + 95 + 105 + 120 = 410) / Average Equity ( (2000 + 2500) / 2 = 2250 ) = 18.22%
    assert.equal(metrics.roe.status, 'CALCULATED');
    assert.ok(metrics.roe.value !== undefined && metrics.roe.value > 15);

    // ROIC: TTM Operating Income (110 + 120 + 130 + 150 = 510) / Average IC = CALCULATED
    assert.equal(metrics.roic.status, 'CALCULATED');
    assert.ok(metrics.roic.value !== undefined && metrics.roic.value > 10);

    // Interest Coverage: 150 / |-25| = 6.0x
    assert.equal(metrics.interestCoverage.value, 6);
    assert.equal(metrics.interestCoverage.status, 'CALCULATED');
    assert.deepEqual(metrics.interestCoverage.conceptsUsed, ['operating_income', 'interest_expense']);
  });

  // 3. FCF Consistency: Standalone Q2 FCF Negative, TTM FCF Positive
  it('3. FCF Consistency: Standalone quarter FCF negative does not break TTM positive yield or conversion', () => {
    const periods = ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'];

    const makeFact = (metric: string, statement: any, val: number, p: string, q: 1 | 2 | 3 | 4, yr: number): CanonicalFinancialValue => ({
      metric,
      statement,
      value: val,
      unit: 'USD_M',
      period: p,
      fiscalYear: yr,
      fiscalQuarter: q,
      periodType: 'quarter',
      type: 'reported',
      verification: 'verified',
    });

    const canonicalDataset: CanonicalFinancialDataset = {
      ticker: 'FCF_TEST',
      currency: 'USD',
      schemaVersion: 1,
      generatedBy: 'sec_xbrl_normalizer',
      provenanceStatus: 'verified',
      periods,
      provenanceWarnings: [],
      sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 12, nonNullValues: 12, missingValues: 0, totalValues: 12 },
      values: {
        'income_statement.revenue': [
          makeFact('revenue', 'income_statement', 2000, 'Q3 2025', 3, 2025),
          makeFact('revenue', 'income_statement', 2200, 'Q4 2025', 4, 2025),
          makeFact('revenue', 'income_statement', 2100, 'Q1 2026', 1, 2026),
          makeFact('revenue', 'income_statement', 2300, 'Q2 2026', 2, 2026),
        ],
        'income_statement.net_income': [
          makeFact('net_income', 'income_statement', 200, 'Q3 2025', 3, 2025),
          makeFact('net_income', 'income_statement', 250, 'Q4 2025', 4, 2025),
          makeFact('net_income', 'income_statement', 180, 'Q1 2026', 1, 2026),
          makeFact('net_income', 'income_statement', 220, 'Q2 2026', 2, 2026),
        ],
        'cash_flow.free_cash_flow': [
          makeFact('free_cash_flow', 'cash_flow', 300, 'Q3 2025', 3, 2025),
          makeFact('free_cash_flow', 'cash_flow', 400, 'Q4 2025', 4, 2025),
          makeFact('free_cash_flow', 'cash_flow', 200, 'Q1 2026', 1, 2026),
          makeFact('free_cash_flow', 'cash_flow', -100, 'Q2 2026', 2, 2026), // Latest quarter negative!
        ],
      },
    };

    const report: Partial<ReportData> = {
      ticker: 'FCF_TEST',
      company_profile: { overview: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any },
      market_snapshot: { market_cap: 80_000_000_000 } as any, // $80B
      canonical_financials: canonicalDataset,
      financial_statements: {
        periods,
        currency: 'USD',
        income_statement: {} as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'FCF_TEST');

    // Quarterly FCF Margin: -100 / 2300 = -4.35%
    assert.equal(metrics.fcfMargin.value, -4.35);
    assert.equal(metrics.fcfMargin.period, 'Q2 2026');

    // TTM FCF: 300 + 400 + 200 - 100 = 800M
    // FCF Yield: 800 / 80,000 = 1.0%
    assert.equal(metrics.fcfYield.value, 1.0);
    assert.equal(metrics.fcfYield.status, 'CALCULATED');

    // TTM Net Income: 200 + 250 + 180 + 220 = 850M
    // FCF Conversion: 800 / 850 = 94.12%
    assert.equal(metrics.fcfConversion.value, 94.12);
    assert.equal(metrics.fcfConversion.status, 'CALCULATED');
  });

  // 4. 3Y Annual Revenue CAGR from Dedicated Annual Facts
  it('4. 3Y Revenue CAGR resolves from verified annual history endpoints', () => {
    const report: Partial<ReportData> = {
      ticker: 'CAGR_CO',
      company_profile: { overview: { sector: 'Technology', industry: 'Software' } as any },
      sec_verification: {
        historical_annual_facts: [
          { metric: 'revenue', fiscal_year: 2023, period: 'FY2023', period_end: '2023-12-31', value: 1000, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
          { metric: 'revenue', fiscal_year: 2024, period: 'FY2024', period_end: '2024-12-31', value: 1200, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
          { metric: 'revenue', fiscal_year: 2025, period: 'FY2025', period_end: '2025-12-31', value: 1440, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
          { metric: 'revenue', fiscal_year: 2026, period: 'FY2026', period_end: '2026-12-31', value: 1728, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
        ],
      } as any,
      financial_statements: {
        periods: ['Q1 2026', 'Q2 2026'], // Only 2 quarters in statements array!
        currency: 'USD',
        income_statement: {} as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'CAGR_CO');
    // 3Y CAGR: (1728 / 1000)^(1/3) - 1 = 1.2 - 1 = +20.0%
    assert.equal(metrics.revenueCagr3Y.value, 20);
    assert.equal(metrics.revenueCagr3Y.status, 'CALCULATED');
  });

  // 5. Peer Matrix Restoration: SEC Enrichment Before Candidate Rejection
  it('5. Peer Candidate with 0 initial verified metrics is enriched and survives with verified status', async () => {
    const rawCandidate: CandidateDefinition = {
      ticker: 'ENRICH_PEER',
      companyName: 'Enrich Peer Corp',
      archetype: 'general_operating',
      sector: 'Consumer Cyclical',
      industry: 'Auto Manufacturers',
      subIndustry: 'automotive',
      revenueModels: ['product_sales'],
      majorBusinessLines: ['automotive'],
      geography: 'US',
      lifecycle: 'mature',
      profitabilityState: 'profitable',
      capitalIntensity: 'capital_intensive',
      scaleTier: 'large',
      metrics: {}, // 0 initial verified metrics!
    };

    const mockSecPackageFetcher = async (_t: string): Promise<any> => ({
      canonicalFinancials: {
        generatedBy: 'sec-xbrl-v1',
        periods: ['Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        provenanceStatus: 'verified',
        values: {
          'income_statement.revenue': [
            { value: 1000, period: 'Q2 2025', periodType: 'quarter', verification: 'verified', derivation: 'Revenue' },
            { value: 1100, period: 'Q3 2025', periodType: 'quarter', verification: 'verified', derivation: 'Revenue' },
            { value: 1200, period: 'Q4 2025', periodType: 'quarter', verification: 'verified', derivation: 'Revenue' },
            { value: 1300, period: 'Q1 2026', periodType: 'quarter', verification: 'verified', derivation: 'Revenue' },
            { value: 1250, period: 'Q2 2026', periodType: 'quarter', verification: 'verified', derivation: 'Revenue' },
          ],
          'income_statement.operating_income': [
            { value: 100, period: 'Q2 2025', periodType: 'quarter', verification: 'verified', derivation: 'OperatingIncome' },
            { value: 110, period: 'Q3 2025', periodType: 'quarter', verification: 'verified', derivation: 'OperatingIncome' },
            { value: 120, period: 'Q4 2025', periodType: 'quarter', verification: 'verified', derivation: 'OperatingIncome' },
            { value: 130, period: 'Q1 2026', periodType: 'quarter', verification: 'verified', derivation: 'OperatingIncome' },
            { value: 150, period: 'Q2 2026', periodType: 'quarter', verification: 'verified', derivation: 'OperatingIncome' },
          ],
        },
      },
    });

    const { candidate, gaps } = await enrichPeerCandidate(rawCandidate, { secPackageFetcher: mockSecPackageFetcher });

    // Candidate should now have verified revenue growth and operating margin
    assert.equal(candidate.metrics.revenue_growth_yoy_pct?.value, 25);
    assert.equal((candidate.metrics.revenue_growth_yoy_pct as any)?.status, 'VERIFIED');
    assert.equal(candidate.metrics.operating_margin_pct?.value, 12);
    assert.equal((candidate.metrics.operating_margin_pct as any)?.status, 'VERIFIED');

    // Convert candidate to PeerCompanyItem
    const peerItem = candidateToPeerCompanyItem(candidate);
    assert.equal(peerItem.revenue_growth_yoy_pct, 25);
    assert.equal(peerItem.revenue_growth_yoy_pct_verified, true);
    assert.equal(peerItem.operating_margin_pct, 12);
    assert.equal(peerItem.operating_margin_pct_verified, true);

    // Downstream extractCandidateMetrics preserves the verified status
    const extracted = extractCandidateMetrics(peerItem, peerItem.ticker, peerItem.company_name);
    const verifiedCount = Object.values(extracted).filter(m => m.status === 'VERIFIED').length;
    assert.equal(extracted.revenue_growth_yoy_pct?.status, 'VERIFIED');
    assert.equal(extracted.operating_margin_pct?.status, 'VERIFIED');
    assert.ok(verifiedCount >= 2);
  });

  // 6. Market-Only Peer Retained For Multiples Rows
  it('6. Market-only peer with verified P/E and EV/EBITDA survives for market multiples', () => {
    const marketPeer: PeerCompanyItem = {
      ticker: 'MKT_PEER',
      company_name: 'Market Peer Inc',
      pe_trailing: 25.5,
      pe_trailing_verified: true,
      ev_ebitda: 14.2,
      ev_ebitda_verified: true,
      revenue_growth_yoy_pct: null, // No fundamentals
      operating_margin_pct: null,
      financial_source: 'Market Data / Yahoo Finance',
    };

    const extracted = extractCandidateMetrics(marketPeer, marketPeer.ticker, marketPeer.company_name);
    const verifiedCount = Object.values(extracted).filter(m => m.status === 'VERIFIED').length;
    assert.equal(extracted.pe_trailing?.status, 'VERIFIED');
    assert.equal(extracted.ev_ebitda?.status, 'VERIFIED');
    assert.equal(extracted.revenue_growth_yoy_pct?.status, 'NOT_REPORTED');
    assert.ok(verifiedCount >= 2, 'Market peer has 2 verified metrics and must not be rejected');
  });

  // 7. Pre-Profit Peer with N/M P/E survives
  it('7. Pre-profit peer with negative earnings produces N/M and is not rejected as 0 verified metrics', () => {
    const preProfitPeer: PeerCompanyItem = {
      ticker: 'PRE_PROFIT',
      company_name: 'Electric Motors Inc',
      pe_trailing: 'N/M',
      pe_trailing_verified: true,
      ev_ebitda: 'N/M',
      ev_ebitda_verified: true,
      revenue_growth_yoy_pct: 35.0,
      revenue_growth_yoy_pct_verified: true,
      financial_source: 'SEC EDGAR',
    };

    const extracted = extractCandidateMetrics(preProfitPeer, preProfitPeer.ticker, preProfitPeer.company_name);
    const verifiedCount = Object.values(extracted).filter(m => m.status === 'VERIFIED').length;
    assert.equal(extracted.pe_trailing?.status, 'VERIFIED');
    assert.equal(extracted.pe_trailing?.reason, 'NEGATIVE_EARNINGS');
    assert.ok(verifiedCount >= 3, 'Pre-profit peer retains verified N/M metrics');
  });

  // 8. Normalization Round-Trip Preserves Verification Metadata
  it('8. normalizeReport preserves enriched peer metrics and verification flags', () => {
    const rawReport: ReportData = {
      ticker: 'TEST',
      company_profile: { overview: { company_name: 'Test Corp' } } as any,
      financial_statements: { periods: ['Q1 2026'] } as any,
      peer_comparison: {
        industry_name: 'Automotive',
        peers: [
          {
            ticker: 'ENRICHED',
            company_name: 'Enriched Peer',
            pe_trailing: 18.5,
            pe_trailing_verified: true,
            revenue_growth_yoy_pct: 22.0,
            revenue_growth_yoy_pct_verified: true,
            operating_margin_pct: 8.5,
            operating_margin_pct_verified: true,
            financial_source: 'SEC EDGAR 10-Q (000123)',
            metrics: {
              revenue_growth_yoy_pct: { value: 22.0, status: 'VERIFIED', source: 'SEC EDGAR 10-Q' },
              operating_margin_pct: { value: 8.5, status: 'VERIFIED', source: 'SEC EDGAR 10-Q' },
            },
          } as any,
        ],
      } as any,
    } as any;

    const normalized = normalizeReport(rawReport);
    const peer = normalized.peer_comparison?.peers?.[0];
    assert.ok(peer);
    assert.equal(peer.pe_trailing_verified, true);
    assert.equal(peer.revenue_growth_yoy_pct_verified, true);
    assert.equal(peer.operating_margin_pct_verified, true);
    assert.equal((peer as any).metrics?.revenue_growth_yoy_pct?.status, 'VERIFIED');
  });
});
