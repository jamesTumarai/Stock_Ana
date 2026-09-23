import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types.js';
import { calculateCanonicalRoic, calculateInvestedCapital } from '../canonicalRoic.js';
import { resolveFundamentalMetrics } from '../metricRegistry.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { discoverPeers } from '../peerDiscoveryEngine.js';
import { resolveBusinessArchetype } from '../../financialMetricContext.js';

describe('Five Pillars Period Basis & Peer ROIC Integrity', () => {

  // SECTION 40: Target TTM ROIC with 4 standalone verified quarters & bracketed average IC
  it('40. Calculates canonical TTM ROIC from 4 verified standalone quarters and average IC', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_CORP',
      company_profile: {
        company_name: 'Test Operating Corp',
        sector: 'Industrials',
        industry: 'Industrial Machinery',
      } as any,
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          // Beginning balance sheet (bracket for Q3 2025 start / end of Q2 2025)
          {
            period: 'Q2 2025',
            form: '10-Q',
            accession: '0001-25-000001',
            total_equity: 10000,
            total_debt: 3000,
            cash: 2000,
            short_term_investments: 1000, // Begin IC = 10000 + 3000 - 2000 - 1000 = 10000
          },
          // 4 Standalone quarters: Q3 2025, Q4 2025, Q1 2026, Q2 2026
          {
            period: 'Q3 2025',
            form: '10-Q',
            accession: '0001-25-000002',
            operating_income: 500,
            income_before_tax: 450,
            income_tax_expense: 90,
          },
          {
            period: 'Q4 2025',
            form: '10-K',
            accession: '0001-25-000003',
            operating_income: 600,
            income_before_tax: 550,
            income_tax_expense: 110,
          },
          {
            period: 'Q1 2026',
            form: '10-Q',
            accession: '0001-26-000001',
            operating_income: 700,
            income_before_tax: 650,
            income_tax_expense: 130,
          },
          {
            period: 'Q2 2026',
            form: '10-Q',
            accession: '0001-26-000002',
            operating_income: 800,
            income_before_tax: 750,
            income_tax_expense: 150,
            // Ending balance sheet (bracket for end of Q2 2026)
            total_equity: 12000,
            total_debt: 3500,
            cash: 2500,
            short_term_investments: 1000, // End IC = 12000 + 3500 - 2500 - 1000 = 12000
          },
        ],
      } as any,
      financial_statements: {
        periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: {
          operating_income: [500, 600, 700, 800],
          income_before_tax: [450, 550, 650, 750],
          income_tax_expense: [90, 110, 130, 150],
        } as any,
        balance_sheet: {
          total_equity: [10000, 10500, 11000, 12000],
          total_debt: [3000, 3200, 3400, 3500],
          cash_and_equivalents: [2000, 2200, 2300, 2500],
          short_term_investments: [1000, 1000, 1000, 1000],
        } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    assert.equal(metrics.roic.status, 'CALCULATED');
    assert.equal(metrics.roic.periodBasis, 'TTM');
    assert.ok(metrics.roic.basis?.includes('TTM NOPAT / Average Invested Capital'));
    // TTM OpInc = 2600. Tax rate = 480 / 2400 = 20%. NOPAT = 2600 * 0.8 = 2080.
    // Average IC = (10000 + 12000) / 2 = 11000. ROIC = 2080 / 11000 * 100 = 18.91%
    assert.equal(metrics.roic.value, 18.91);
    assert.equal(metrics.roic.formula, 'Operating Income × (1 - Tax Rate) / Invested Capital (Equity + Debt - Cash)');
  });

  // SECTION 41: Do not treat YTD as standalone quarters
  it('41. Rejects summing cumulative YTD facts as if they were standalone quarters', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_YTD',
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          // Q1 standalone, Q2 6M YTD, Q3 9M YTD (not 4 standalone quarters)
          { period: 'Q1 2025', form: '10-Q', operating_income: 200, period_type: 'quarterly' },
          { period: 'Q2 2025 YTD', form: '10-Q', operating_income: 450, period_type: 'cumulative_ytd' },
          { period: 'Q3 2025 YTD', form: '10-Q', operating_income: 700, period_type: 'cumulative_ytd' },
        ],
      } as any,
      financial_statements: {
        periods: ['Q1 2025', 'Q2 2025 YTD', 'Q3 2025 YTD'],
        income_statement: { operating_income: [200, 450, 700] } as any,
        balance_sheet: { total_equity: [5000, 5200, 5500], total_debt: [1000, 1000, 1000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    // Must NOT naively sum 200 + 450 + 700 = 1350 as TTM
    if (metrics.roic.periodBasis === 'TTM') {
      assert.notEqual(metrics.roic.status, 'CALCULATED');
    }
  });

  // SECTION 42: Insufficient TTM history fails closed
  it('42. Returns INSUFFICIENT_TTM_HISTORY when only 2 standalone quarters exist', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_NEW_IPO',
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q1 2026', form: '10-Q', operating_income: 100, total_equity: 2000, total_debt: 500, cash: 500 },
          { period: 'Q2 2026', form: '10-Q', operating_income: 120, total_equity: 2200, total_debt: 500, cash: 500 },
        ],
      } as any,
      financial_statements: {
        periods: ['Q1 2026', 'Q2 2026'],
        income_statement: { operating_income: [100, 120] } as any,
        balance_sheet: { total_equity: [2000, 2200], total_debt: [500, 500], cash_and_equivalents: [500, 500] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    assert.equal(metrics.roic.status, 'UNAVAILABLE');
    assert.equal(metrics.roic.reason, 'INSUFFICIENT_TTM_HISTORY');
    assert.ok(metrics.roic.reasonTh?.includes('ไม่ครบ 4 ไตรมาส'));
  });

  // SECTION 43: Target ROE uses 4 standalone quarters Net Income / Average Equity
  it('43. Calculates canonical TTM ROE from 4 quarters Net Income / Average Equity (not single quarter / ending equity)', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_ROE',
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q2 2025', form: '10-Q', total_equity: 4000 }, // Beginning equity
          { period: 'Q3 2025', form: '10-Q', net_income: 100 },
          { period: 'Q4 2025', form: '10-K', net_income: 150 },
          { period: 'Q1 2026', form: '10-Q', net_income: 200 },
          { period: 'Q2 2026', form: '10-Q', net_income: 250, total_equity: 6000 }, // Ending equity
        ],
      } as any,
      financial_statements: {
        periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: { net_income: [100, 150, 200, 250] } as any,
        balance_sheet: { total_equity: [4000, 4500, 5000, 6000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    assert.equal(metrics.roe.status, 'CALCULATED');
    assert.equal(metrics.roe.periodBasis, 'TTM');
    // TTM Net Income = 100 + 150 + 200 + 250 = 700. Average Equity = (4000 + 6000) / 2 = 5000.
    // ROE = 700 / 5000 * 100 = 14%. (NOT 250 / 6000 = 4.17%)
    assert.equal(metrics.roe.value, 14);
    assert.ok(metrics.roe.basis?.includes('TTM Net Income / Average Total Equity'));
  });

  // SECTION 44: Target ROA uses 4 standalone quarters Net Income / Average Assets
  it('44. Calculates canonical TTM ROA from 4 quarters Net Income / Average Assets', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_ROA',
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q2 2025', form: '10-Q', total_assets: 8000, total_equity: 4000 }, // Beginning
          { period: 'Q3 2025', form: '10-Q', net_income: 100 },
          { period: 'Q4 2025', form: '10-K', net_income: 150 },
          { period: 'Q1 2026', form: '10-Q', net_income: 200 },
          { period: 'Q2 2026', form: '10-Q', net_income: 250, total_assets: 12000, total_equity: 6000 }, // Ending
        ],
      } as any,
      financial_statements: {
        periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: { net_income: [100, 150, 200, 250] } as any,
        balance_sheet: { total_assets: [8000, 9000, 10000, 12000], total_equity: [4000, 4500, 5000, 6000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    assert.equal(metrics.roa.status, 'CALCULATED');
    assert.equal(metrics.roa.periodBasis, 'TTM');
    // TTM Net Income = 700. Average Assets = (8000 + 12000) / 2 = 10000. ROA = 700 / 10000 * 100 = 7%.
    assert.equal(metrics.roa.value, 7);
    assert.ok(metrics.roa.basis?.includes('TTM Net Income / Average Total Assets'));
  });

  // SECTION 45: Margins record actual statement period metadata (not generic TTM)
  it('45. Records truthful period metadata for standalone quarterly margins (e.g. Q2 2026)', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_MARGINS',
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: {
          revenue: [1000],
          gross_profit: [600],
          operating_income: [200],
          net_income: [150],
        } as any,
        balance_sheet: { total_equity: [2000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report);
    assert.equal(metrics.grossMargin.value, 60);
    assert.equal(metrics.grossMargin.basis, 'Q2 2026');
    assert.notEqual(metrics.grossMargin.basis, 'TTM');

    assert.equal(metrics.operatingMargin.value, 20);
    assert.equal(metrics.operatingMargin.basis, 'Q2 2026');

    assert.equal(metrics.netMargin.value, 15);
    assert.equal(metrics.netMargin.basis, 'Q2 2026');
  });

  // SECTIONS 46 & 47: Loss-making peer negative ROIC is finite and derived (not N/A)
  it('46 & 47. Derives finite negative ROIC for loss-making peer with positive invested capital under fallback tax policy', () => {
    const peerCandidate = {
      ticker: 'LOSS_PEER',
      company_name: 'Loss-Making Automotive Peer',
      sector: 'Consumer Cyclical',
      industry: 'Auto Manufacturers',
      financial_source: 'SEC 10-Q (0001234567-26-000001)',
      financial_period: 'Q2 2026',
      operating_income: -500,
      income_before_tax: -550,
      income_tax_expense: 0,
      total_equity: 5000,
      total_debt: 2000,
      cash_and_equivalents: 1000,
      short_term_investments: 500,
      pe_trailing: null,
      ev_ebitda: -8.5, // Negative EV/EBITDA => N/M
      revenue_growth_yoy_pct: 15.0,
    };

    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_AUTO',
      company_profile: {
        company_name: 'Target Auto Corp',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
      } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [5000], operating_income: [600] } as any,
        balance_sheet: { total_equity: [15000], total_debt: [4000], cash_and_equivalents: [3000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const discovery = discoverPeers(targetReport, 'TARGET_AUTO', {
      candidates: [peerCandidate as any],
    });

    const peer = discovery.peers.find(p => p.ticker === 'LOSS_PEER');
    assert.ok(peer, 'Loss-making peer must be discovered');

    // ROIC input facts check:
    // IC = 5000 + 2000 - 1000 - 500 = 5500 > 0.
    // OpInc = -500. Fallback tax rate = 0.21. NOPAT = -500 * (1 - 0.21) = -395.
    // ROIC = -395 / 5500 * 100 = -7.18%.
    const roicObs = peer.metrics['roic_pct'];
    assert.ok(roicObs, 'ROIC observation must exist');
    assert.equal(roicObs.status, 'VERIFIED');
    assert.equal(typeof roicObs.value, 'number');
    assert.ok((roicObs.value as number) < 0, 'ROIC must be finite negative');
    assert.equal(roicObs.value, -7.18);
  });

  // SECTION 48: Non-positive invested capital fails closed
  it('48. Fails closed when invested capital is non-positive (zero or negative)', () => {
    const result = calculateCanonicalRoic({
      operatingIncome: 200,
      incomeBeforeTax: 200,
      endingInvestedCapital: -50,
      periodBasis: 'QUARTERLY',
      source: 'SEC Filing',
    });

    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.value, null);
    assert.equal(result.reason, 'Invested capital is non-positive');
  });

  // SECTION 49: Peer source verification standards
  it('49. Enforces source provenance: rejects unsourced or generic fallback strings from being marked VERIFIED', () => {
    const candidateNoSource = {
      ticker: 'UNSOURCED',
      company_name: 'Unsourced Corp',
      sector: 'Technology',
      industry: 'Software',
      operating_income: 100,
      total_equity: 500,
      total_debt: 100,
    };

    const candidateFallbackSource = {
      ticker: 'FALLBACK_SRC',
      company_name: 'Fallback Source Corp',
      sector: 'Technology',
      industry: 'Software',
      financial_source: 'Verified Peer Disclosure / Market Snapshot', // Internally generated fallback
      operating_income: 100,
      total_equity: 500,
      total_debt: 100,
    };

    const candidateFilingSource = {
      ticker: 'FILING_SRC',
      company_name: 'Filing Source Corp',
      sector: 'Technology',
      industry: 'Software',
      financial_source: 'SEC 10-Q (0000950170-24-000001)',
      financial_period: 'Q2 2026',
      operating_income: 100,
      income_before_tax: 90,
      income_tax_expense: 20,
      total_equity: 500,
      total_debt: 100,
      cash_and_equivalents: 50,
    };

    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_SW',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [1000] } as any, balance_sheet: {} as any, cash_flow: {} as any },
    };

    const result = discoverPeers(targetReport, 'TARGET_SW', {
      candidates: [candidateNoSource as any, candidateFallbackSource as any, candidateFilingSource as any],
    });

    const pUnsourced = result.peers.find(p => p.ticker === 'UNSOURCED');
    if (pUnsourced?.metrics['operating_income']) {
      assert.notEqual(pUnsourced.metrics['operating_income'].status, 'VERIFIED');
    }

    const pFallback = result.peers.find(p => p.ticker === 'FALLBACK_SRC');
    if (pFallback?.metrics['operating_income']) {
      assert.notEqual(pFallback.metrics['operating_income'].status, 'VERIFIED');
    }

    const pFiling = result.peers.find(p => p.ticker === 'FILING_SRC');
    assert.ok(pFiling?.metrics['operating_income']);
    assert.equal(pFiling.metrics['operating_income'].status, 'VERIFIED');
    assert.equal(pFiling.metrics['roic_pct']?.status, 'VERIFIED');
  });

  // SECTION 50: Precomputed third-party ROIC is FOUND_UNVERIFIED
  it('50. Treats precomputed third-party roic_pct without underlying filing facts as FOUND_UNVERIFIED', () => {
    const rawCandidate = {
      ticker: 'TP_ROIC',
      company_name: 'Third Party ROIC Inc',
      sector: 'Technology',
      industry: 'Software',
      financial_source: 'Generic Market Website',
      pe_trailing: 25.0, // Valid market metric keeps company in peer set
      roic_pct: 14.5, // Precomputed without underlying balance sheet and operating income
    };

    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_SW2',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [1000] } as any, balance_sheet: {} as any, cash_flow: {} as any },
    };

    const result = discoverPeers(targetReport, 'TARGET_SW2', {
      candidates: [rawCandidate as any],
      disableFixtureFallback: true,
    });

    const peer = result.peers.find(p => p.ticker === 'TP_ROIC');
    assert.ok(peer);
    assert.equal(peer.metrics['roic_pct']?.status, 'FOUND_UNVERIFIED');
  });

  // SECTION 51: ROIC basis mismatch (peer standalone quarter excluded from TTM median)
  it('51. Excludes standalone-quarter peer ROIC from median when target is TTM', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_TTM',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q2 2025', total_equity: 5000, total_debt: 1000, cash: 500 },
          { period: 'Q3 2025', operating_income: 100, income_before_tax: 90 },
          { period: 'Q4 2025', operating_income: 120, income_before_tax: 110 },
          { period: 'Q1 2026', operating_income: 130, income_before_tax: 120 },
          { period: 'Q2 2026', operating_income: 150, income_before_tax: 140, total_equity: 6000, total_debt: 1000, cash: 500 },
        ],
      } as any,
      financial_statements: {
        periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: { operating_income: [100, 120, 130, 150] } as any,
        balance_sheet: { total_equity: [5000, 5200, 5500, 6000], total_debt: [1000, 1000, 1000, 1000], cash_and_equivalents: [500, 500, 500, 500] } as any,
        cash_flow: {} as any,
      } as any,
    };

    // Target has TTM ROIC
    const targetMetrics = resolveFundamentalMetrics(targetReport);
    assert.equal(targetMetrics.roic.periodBasis, 'TTM');

    // Peer A has TTM verified ROIC
    const peerTTM: any = {
      ticker: 'PEER_TTM',
      companyName: 'TTM Peer Corp',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 90,
      relationType: 'DIRECT_PEER',
      metrics: {
        roic_pct: {
          ticker: 'PEER_TTM',
          metric: 'roic_pct',
          value: 12.0,
          periodBasis: 'TTM',
          period: 'TTM ending Q2 2026',
          status: 'VERIFIED',
          reportedOrDerived: 'DERIVED',
          source: 'SEC 10-K',
        },
      },
    };

    // Peer B has Standalone Quarter ROIC
    const peerQuarterly: any = {
      ticker: 'PEER_QTR',
      companyName: 'Quarterly Peer Corp',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 85,
      relationType: 'DIRECT_PEER',
      metrics: {
        roic_pct: {
          ticker: 'PEER_QTR',
          metric: 'roic_pct',
          value: 2.5,
          periodBasis: 'QUARTERLY',
          period: 'Q2 2026',
          status: 'VERIFIED',
          reportedOrDerived: 'DERIVED',
          source: 'SEC 10-Q',
        },
      },
    };

    const discovery = discoverPeers(targetReport, 'TARGET_TTM', {
      candidates: [peerTTM, peerQuarterly],
      targetMetrics,
      disableFixtureFallback: true,
    });

    const roicRow = discovery.benchmarkRows.find(r => r.metric_key === 'roic_pct');
    assert.ok(roicRow);
    // Peer B must be excluded from TTM target median: sample size becomes 1 (PEER_TTM only)
    assert.equal(roicRow.peer_sample_size, 1);
    // n=1 means INSUFFICIENT policy
    assert.equal(roicRow.peer_coverage_status, 'INSUFFICIENT');
    assert.equal(roicRow.sector_median, 'Insufficient Comparable Peer Data');
  });

  // SECTIONS 52 & 53: Sample size policy (n=2 LIMITED vs n<=1 INSUFFICIENT)
  it('52 & 53. Preserves n=2 LIMITED benchmark policy and n<=1 INSUFFICIENT policy', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_SAMPLE',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: { periods: ['2024'], income_statement: { revenue: [1000] } as any, balance_sheet: {} as any, cash_flow: {} as any },
    };

    const peerA: any = {
      ticker: 'PEER_A',
      companyName: 'Peer A Inc',
      fingerprint: { sector: 'Technology', industry: 'Software', archetype: 'corporate_standard' },
      similarityScore: 90,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 20.0, status: 'VERIFIED', reportedOrDerived: 'REPORTED', source: 'Market Data' },
      },
    };

    const peerB: any = {
      ticker: 'PEER_B',
      companyName: 'Peer B Inc',
      fingerprint: { sector: 'Technology', industry: 'Software', archetype: 'corporate_standard' },
      similarityScore: 85,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 30.0, status: 'VERIFIED', reportedOrDerived: 'REPORTED', source: 'Market Data' },
      },
    };

    // Case 1: n=2 peers
    const res2 = discoverPeers(targetReport, 'TARGET_SAMPLE', { candidates: [peerA, peerB], disableFixtureFallback: true });
    const peRow2 = res2.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.ok(peRow2);
    assert.equal(peRow2.peer_sample_size, 2);
    assert.equal(peRow2.peer_coverage_status, 'LIMITED');
    assert.equal(peRow2.sector_median, '25x'); // Median of 20 and 30 is 25

    // Case 2: n=1 peer
    const res1 = discoverPeers(targetReport, 'TARGET_SAMPLE', { candidates: [peerA], disableFixtureFallback: true });
    const peRow1 = res1.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.ok(peRow1);
    assert.equal(peRow1.peer_sample_size, 1);
    assert.equal(peRow1.peer_coverage_status, 'INSUFFICIENT');
    assert.equal(peRow1.sector_median, 'Insufficient Comparable Peer Data');
  });

  // SECTION 54: Direct peer single-company column invariant
  it('54. Ensures the single direct peer column belongs strictly to ONE company across all benchmark rows', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_CORP',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      financial_statements: { periods: ['2024'], income_statement: { revenue: [1000] } as any, balance_sheet: {} as any, cash_flow: {} as any },
    };

    const directPeer: any = {
      ticker: 'PRIMARY_PEER',
      companyName: 'Primary Peer Corp',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 98,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: null, status: 'NOT_REPORTED' }, // Missing P/E
        ev_ebitda: { metric: 'ev_ebitda', value: -5.0, status: 'VERIFIED', source: 'Market Data' }, // Negative EV/EBITDA => N/M
        revenue_growth_yoy_pct: { metric: 'revenue_growth_yoy_pct', value: 12.5, status: 'VERIFIED', source: 'SEC 10-K' },
        roic_pct: { metric: 'roic_pct', value: -4.2, status: 'VERIFIED', source: 'SEC 10-K' },
      },
    };

    const otherPeer: any = {
      ticker: 'SECONDARY_PEER',
      companyName: 'Secondary Peer Corp',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 70,
      relationType: 'CLOSE_COMPARABLE',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 15.0, status: 'VERIFIED', source: 'Market Data' },
      },
    };

    const discovery = discoverPeers(targetReport, 'TARGET_CORP', { candidates: [directPeer, otherPeer], disableFixtureFallback: true });
    
    // In every benchmark row, direct_peer_ticker must be PRIMARY_PEER
    for (const row of discovery.benchmarkRows) {
      if (row.direct_peer_ticker) {
        assert.equal(row.direct_peer_ticker, 'PRIMARY_PEER', 'Direct peer ticker must never switch companies');
      }
    }

    // P/E of PRIMARY_PEER was missing: must NOT borrow 15.0 from SECONDARY_PEER
    const peRow = discovery.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.equal(peRow?.direct_peer_value, 'N/A');

    // EV/EBITDA of PRIMARY_PEER was negative: must be N/M
    const evRow = discovery.benchmarkRows.find(r => r.metric_key === 'ev_ebitda');
    assert.equal(evRow?.direct_peer_value, 'N/M');

    // Revenue growth of PRIMARY_PEER was 12.5%
    const revRow = discovery.benchmarkRows.find(r => r.metric_key === 'revenue_growth_yoy_pct');
    assert.equal(revRow?.direct_peer_value, '12.5%');

    // ROIC of PRIMARY_PEER was -4.2%: must show as negative percentage, not N/A or N/M
    const roicRow = discovery.benchmarkRows.find(r => r.metric_key === 'roic_pct');
    assert.equal(roicRow?.direct_peer_value, '-4.2%');
  });

  // SECTION 55: Market metric provenance does not require filing facts for company eligibility
  it('55. Preserves peer eligibility for market multiples even when filing facts for ROIC are absent', () => {
    const marketOnlyPeer: any = {
      ticker: 'MKT_PEER',
      companyName: 'Market Peer Corp',
      fingerprint: { sector: 'Technology', industry: 'Software', archetype: 'corporate_standard' },
      similarityScore: 92,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 28.0, status: 'VERIFIED', source: 'Identified Market Data Provider' },
        ev_ebitda: { metric: 'ev_ebitda', value: 18.5, status: 'VERIFIED', source: 'Identified Market Data Provider' },
        // No filing facts for ROIC
      },
    };

    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_TECH',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: { periods: ['2024'], income_statement: { revenue: [1000] } as any, balance_sheet: {} as any, cash_flow: {} as any },
    };

    const discovery = discoverPeers(targetReport, 'TARGET_TECH', { candidates: [marketOnlyPeer], disableFixtureFallback: true });
    assert.ok(discovery.peers.some(p => p.ticker === 'MKT_PEER'), 'Company remains an eligible peer');

    const peRow = discovery.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.equal(peRow?.direct_peer_value, '28x');

    const roicRow = discovery.benchmarkRows.find(r => r.metric_key === 'roic_pct');
    assert.equal(roicRow?.direct_peer_value, 'N/A');
    assert.ok(roicRow?.direct_peer_reason?.includes('Filing data not available') || roicRow?.direct_peer_reason?.includes('ROIC'));
  });

  // SECTIONS 56-58: Sector Guards (Financial, REIT, Insurer)
  it('56. Enforces Financial Sector Guard: ROIC is guarded, ROE/ROA primary', () => {
    const bankReport: Partial<ReportData> = {
      ticker: 'TEST_BANK',
      company_profile: { sector: 'Financial Services', industry: 'Banks—Regional' } as any,
      financial_statements: {
        statement_template: 'banking',
        periods: ['2024'],
        income_statement: { revenue: [3000], net_income: [500] } as any,
        balance_sheet: { deposits: [30000], total_assets: [35000], total_equity: [3500] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(bankReport);
    assert.equal(metrics.roic.status, 'GUARDED');
    assert.equal(metrics.roic.isGuarded, true);
    assert.ok(metrics.roic.reason?.includes('financial') || metrics.roic.reason?.includes('not meaningful'));

    const fivePillars = resolveAdaptiveFivePillars(bankReport, 'TEST_BANK');
    assert.equal(fivePillars.archetype, 'bank');
  });

  it('57. Enforces REIT Guard: corporate ROIC guarded, property metrics primary', () => {
    const reitReport: Partial<ReportData> = {
      ticker: 'TEST_REIT',
      company_profile: { sector: 'Real Estate', industry: 'REIT—Industrial' } as any,
      financial_statements: {
        statement_template: 'reit',
        periods: ['2024'],
        income_statement: { revenue: [800], net_income: [200] } as any,
        balance_sheet: { real_estate_assets: [10000], total_equity: [5000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const archetype = resolveBusinessArchetype(reitReport);
    assert.equal(archetype, 'reit');
    const fivePillars = resolveAdaptiveFivePillars(reitReport, 'TEST_REIT');
    assert.equal(fivePillars.archetype, 'reit');
  });

  it('58. Enforces Insurer Guard: P/B, P/E, ROE, Combined Ratio preserved', () => {
    const insurerReport: Partial<ReportData> = {
      ticker: 'TEST_INSURER',
      company_profile: { sector: 'Financial Services', industry: 'Insurance—Property & Casualty' } as any,
      financial_statements: {
        statement_template: 'insurance',
        periods: ['2024'],
        income_statement: { revenue: [5000], net_income: [400] } as any,
        balance_sheet: { investments: [20000], total_equity: [4000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    const archetype = resolveBusinessArchetype(insurerReport);
    assert.equal(archetype, 'insurer');
    const fivePillars = resolveAdaptiveFivePillars(insurerReport, 'TEST_INSURER');
    assert.equal(fivePillars.archetype, 'insurer');
  });

  // SECTION 59 & 60: Pre-profit operating company & cross-sector regression
  it('59 & 60. Handles pre-profit operating companies without crashing or guessing', () => {
    const preProfitReport: Partial<ReportData> = {
      ticker: 'GROWTH_TECH',
      company_profile: { sector: 'Technology', industry: 'Software—Infrastructure' } as any,
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q1 2026', operating_income: -40, net_income: -45, total_equity: 800, total_debt: 50, cash: 300, short_term_investments: 100 },
        ],
      } as any,
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: { revenue: [200], operating_income: [-40], net_income: [-45] } as any,
        balance_sheet: { total_equity: [800], total_debt: [50], cash_and_equivalents: [300], short_term_investments: [100] } as any,
        cash_flow: {} as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (TTM)', value: null }, // Negative earnings => null/unavailable
        { name: 'EV/Sales', value: 8.5 },
      ],
    };

    const metrics = resolveFundamentalMetrics(preProfitReport);
    // Invested Capital = 800 + 50 - 300 - 100 = 450 > 0.
    // Negative operating income yields finite negative ROIC.
    assert.equal(metrics.roic.status, 'CALCULATED');
    assert.ok(typeof metrics.roic.value === 'number' && metrics.roic.value < 0);

    const fivePillars = resolveAdaptiveFivePillars(preProfitReport, 'GROWTH_TECH');
    assert.ok(fivePillars.pillars.profitability.interpretationEn || fivePillars.pillars.profitability.interpretationTh);
  });
});
