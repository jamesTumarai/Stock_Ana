import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportData } from '../../../types.js';
import { resolveFundamentalMetrics } from '../metricRegistry.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { normalizeReport } from '../../../utils/reportIntegrity.js';
import {
  discoverPeers,
  discoverPeerCandidates,
  PUBLIC_CANDIDATE_UNIVERSE,
  type CandidateDefinition
} from '../peerDiscoveryEngine.js';

describe('Final Five Pillars Metric & True Peer Discovery Repair (PR #158)', () => {

  // =========================================================================
  // 43: TEST — PEG CONSISTENCY
  // =========================================================================
  it('43. PEG consistency: resolved EPS Growth = 37.25%, P/E = 334.2 -> PEG ≈ 8.97, badge and interpretation match without claiming EPS unavailable', () => {
    const report: Partial<ReportData> = {
      ticker: 'TSLA',
      financial_statements: {
        currency: 'USD',
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        income_statement: {
          eps_diluted: [0.30, 0.35, 0.40, 0.41175],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 334.2 } as any,
      ],
      key_indicators: {
        growth: {
          eps_growth_yoy_pct: 37.25,
        } as any,
      },
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TSLA');
    const growth = resolved.fivePillarsData.growth;

    assert.equal(growth.eps_growth_yoy_pct, 37.25);
    assert.ok(growth.peg_ratio !== undefined, 'PEG ratio must be calculated');
    assert.equal(Math.round(growth.peg_ratio! * 100) / 100, 8.97);
    assert.equal(growth.peg_status, 'CALCULATED');
    assert.ok(growth.peg_interpretation, 'PEG interpretation must be present');
    assert.equal(growth.peg_interpretation?.includes('ไม่พร้อม') || growth.peg_interpretation?.includes('unavailable'), false,
      'PEG interpretation must NOT claim EPS Growth is unavailable when it is present');
  });

  // =========================================================================
  // 44: TEST — PEG BASIS MISMATCH
  // =========================================================================
  it('44. PEG basis mismatch: Trailing P/E + Forward EPS Growth -> PEG unavailable with reason BASIS_MISMATCH', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_STOCK',
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 25.0 } as any,
      ],
      key_indicators: {
        growth: {
          eps_growth_forward_pct: 15.0,
        } as any,
      },
    };

    const metrics = resolveFundamentalMetrics(report, 'TEST_STOCK');
    assert.equal(metrics.peg.status, 'BASIS_MISMATCH', 'PEG status must be BASIS_MISMATCH');
    assert.equal(metrics.peg.value, null, 'PEG value must be null when basis mismatch occurs');
    assert.ok(metrics.peg.reasonTh?.includes('คนละฐานช่วงเวลา'), 'Thai reason must mention basis mismatch');
  });

  // =========================================================================
  // 45: TEST — ROIC SHARED RESULT
  // =========================================================================
  it('45. ROIC shared result: Derived ROIC = 0.76% -> Pillar 2 = 0.76% and Peer target row = 0.76%', () => {
    const report: Partial<ReportData> = {
      ticker: 'TSLA',
      company_profile: {
        overview: {
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
        } as any,
      },
      financial_statements: {
        currency: 'USD',
        periods: ['FY2024'],
        income_statement: {
          operating_income: [760],
          tax_provision: [152],
        } as any,
        balance_sheet: {
          total_equity: [80000],
          total_debt: [25000],
          cash_and_equivalents: [5000],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 100 } as any,
      ],
      peer_comparison: {
        industry_name: 'Auto Manufacturers',
        peers: [
          { ticker: 'PEER_AUTO', company_name: 'Peer Auto', roic_pct: 12.5, pe_trailing: 15.0 } as any,
        ],
      },
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TSLA');
    const p2Roic = resolved.fivePillarsData.profitability.roic_pct;
    assert.ok(typeof p2Roic === 'number', 'Pillar 2 ROIC must be derived');

    const peerMatrix = resolved.fivePillarsData.peer_matrix || [];
    const roicRow = peerMatrix.find(r => r.metric_name === 'ROIC' || r.metric_name_th?.includes('ROIC'));
    assert.ok(roicRow, 'ROIC row must be present in Peer Benchmark Matrix');
    assert.equal(roicRow.target_value, `${p2Roic}%`, 'Target row ROIC must consume canonical derived ROIC, not raw/stale N/A');
  });

  // =========================================================================
  // 46: TEST — PEER ROIC MISSING
  // =========================================================================
  it('46. Peer ROIC missing: Target ROIC available, peers lack compatible ROIC -> exact insufficient-comparable-data state', () => {
    const report: Partial<ReportData> = {
      ticker: 'TARGET',
      company_profile: {
        overview: {
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
        } as any,
      },
      financial_statements: {
        currency: 'USD',
        periods: ['FY2024'],
        income_statement: {
          operating_income: [760],
          tax_provision: [152],
        } as any,
        balance_sheet: {
          total_equity: [80000],
          total_debt: [25000],
          cash_and_equivalents: [5000],
        } as any,
      } as any,
      peer_comparison: {
        industry_name: 'Auto Manufacturers',
        peers: [
          { ticker: 'PEER1', company_name: 'Peer 1', roic_pct: undefined, pe_trailing: 15.0 } as any,
          { ticker: 'PEER2', company_name: 'Peer 2', roic_pct: undefined, pe_trailing: 18.0 } as any,
        ],
      },
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TARGET');
    const peerMatrix = resolved.fivePillarsData.peer_matrix || [];
    const roicRow = peerMatrix.find(r => r.metric_name === 'ROIC' || r.metric_name_th?.includes('ROIC'));
    assert.ok(roicRow, 'ROIC row must exist');
    assert.ok(roicRow.target_value !== 'N/A', 'Target ROIC must be preserved');
    assert.equal(roicRow.sector_median, 'Insufficient Comparable Peer Data', 'Weak coverage must not produce a misleading median');
    assert.equal(roicRow.peer_sample_size, 0);
    assert.equal(roicRow.direct_peer_value, 'N/A', 'Direct peer ROIC must be N/A if that peer lacks ROIC (no borrowing)');
  });

  // =========================================================================
  // 47: TEST — DIRECT PEER IDENTITY
  // =========================================================================
  it('47. Direct peer identity: Selected peer ticker = ABC, name = Auto Corp -> Header shows ABC — Auto Corp and all direct peer values originate from ABC', () => {
    const report: Partial<ReportData> = {
      ticker: 'ABC_TARGET',
      company_profile: {
        overview: {
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
        } as any,
      },
      peer_comparison: {
        industry_name: 'Auto Manufacturers',
        peers: [
          {
            ticker: 'ABC',
            company_name: 'Auto Corp',
            pe_trailing: 15.2,
            ev_ebitda: 7.5,
            revenue_growth_yoy_pct: 5.0,
            relation_type: 'DIRECT_PEER',
          } as any,
        ],
      },
    };

    const resolved = resolveAdaptiveFivePillars(report, 'ABC_TARGET');
    const peerMatrix = resolved.fivePillarsData.peer_matrix || [];
    assert.ok(peerMatrix.length > 0, 'Peer matrix must have rows');

    const firstRow = peerMatrix[0];
    assert.equal(firstRow.direct_peer_ticker, 'ABC');
    assert.equal(firstRow.direct_peer_name, 'Auto Corp');
    assert.equal(firstRow.direct_peer_relation, 'DIRECT_PEER');
    assert.ok(firstRow.direct_peer_header_en?.includes('ABC — Auto Corp'));
    assert.ok(firstRow.direct_peer_header_th?.includes('ABC — Auto Corp'));

    const peRow = peerMatrix.find(r => /P\/E/i.test(r.metric_name));
    if (peRow) {
      assert.equal(peRow.direct_peer_value, '15.2x');
    }
  });

  // =========================================================================
  // 48: TEST — CLOSE COMPARABLE LABEL
  // =========================================================================
  it('48. Close comparable label: No DIRECT_PEER, top candidate CLOSE_COMPARABLE -> Header: Closest Comparable: XYZ, NOT Direct Peer', () => {
    const report: Partial<ReportData> = {
      ticker: 'TARGET',
      peer_comparison: {
        industry_name: 'Specialty Industrial',
        peers: [
          {
            ticker: 'XYZ',
            company_name: 'XYZ Corp',
            relation_type: 'CLOSE_COMPARABLE',
            pe_trailing: 18.0,
          } as any,
        ],
      },
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TARGET');
    const peerMatrix = resolved.fivePillarsData.peer_matrix || [];
    assert.ok(peerMatrix.length > 0);

    const firstRow = peerMatrix[0];
    assert.equal(firstRow.direct_peer_relation, 'CLOSE_COMPARABLE');
    assert.ok(firstRow.direct_peer_header_en?.startsWith('Closest Comparable:'));
    assert.ok(firstRow.direct_peer_header_th?.startsWith('บริษัทเทียบเคียงที่ใกล้ที่สุด:'));
    assert.equal(firstRow.direct_peer_header_en?.startsWith('Direct Peer:'), false,
      'Close comparable must NOT be mislabeled Direct Peer');
  });

  // =========================================================================
  // 49: TEST — TRUE RUNTIME DISCOVERY
  // =========================================================================
  it('49. True runtime discovery: Synthetic/new public ticker absent from PUBLIC_CANDIDATE_UNIVERSE succeeds via runtime discoverer', () => {
    const syntheticTarget = {
      ticker: 'NEWTECH',
      companyName: 'NewTech Systems Inc',
      primaryArchetype: 'saas_software' as const,
      sector: 'Technology',
      industry: 'Software - Infrastructure',
      businessDescription: 'Cloud infrastructure security monitoring platform',
    };

    assert.equal(PUBLIC_CANDIDATE_UNIVERSE.some(p => p.ticker === 'NEWTECH'), false);

    const mockRuntimeDiscoverer = (): CandidateDefinition[] => [
      {
        ticker: 'CROWD',
        companyName: 'Crowd Security Inc',
        archetype: 'saas_software',
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        subIndustry: 'enterprise_cloud_software',
        revenueModels: ['recurring_subscription'],
        majorBusinessLines: ['Cloud Security'],
        geography: 'global',
        lifecycle: 'growth',
        profitabilityState: 'profitable',
        capitalIntensity: 'asset_light',
        regulatoryType: 'standard',
        scaleTier: 'large',
        metrics: {
          pe_trailing: { value: 65.0, unit: 'x', period: '2024', source: 'verified_source', reportedOrDerived: 'REPORTED' },
          revenue_growth_yoy: { value: 32.0, unit: '%', period: '2024', source: 'verified_source', reportedOrDerived: 'REPORTED' },
        },
      } as CandidateDefinition,
    ];

    const result = discoverPeerCandidates(syntheticTarget as any, {
      candidateDiscoverer: mockRuntimeDiscoverer,
      disableFixtureFallback: true,
    });

    assert.ok(result.length > 0, 'Runtime candidate discovery must succeed for new ticker');
    assert.equal(result[0].ticker, 'CROWD');
  });

  // =========================================================================
  // 50: TEST — PRODUCTION WITHOUT STATIC UNIVERSE
  // =========================================================================
  it('50. Production mode without static universe: Runtime peer discovery works even with disableFixtureFallback = true', () => {
    const mockDiscoverer = (): CandidateDefinition[] => [
      {
        ticker: 'PUBCO',
        companyName: 'Public Company Corp',
        archetype: 'industrial_manufacturing',
        sector: 'Industrials',
        industry: 'Machinery',
        subIndustry: 'machinery_manufacturing',
        revenueModels: ['hardware_sales'],
        majorBusinessLines: ['Equipment'],
        geography: 'global',
        lifecycle: 'mature',
        profitabilityState: 'profitable',
        capitalIntensity: 'capital_intensive',
        regulatoryType: 'standard',
        scaleTier: 'large',
        metrics: {
          pe_trailing: { value: 20.0, unit: 'x', period: '2024', source: 'verified_source', reportedOrDerived: 'REPORTED' },
        },
      } as CandidateDefinition,
    ];

    const result = discoverPeerCandidates(
      {
        ticker: 'IND_TARGET',
        companyName: 'Target Ind',
        primaryArchetype: 'industrial_manufacturing',
        sector: 'Industrials',
        industry: 'Machinery',
      } as any,
      {
        candidateDiscoverer: mockDiscoverer,
        disableFixtureFallback: true,
      }
    );

    assert.ok(result.length > 0);
    assert.equal(result[0].ticker, 'PUBCO');
  });

  // =========================================================================
  // 51: TEST — SEARCH DISCOVERY REQUIRES VERIFICATION
  // =========================================================================
  it('51. Search discovery requires verification: Candidate A (verified equity) accepted, Candidate B (unverified/ETF/private) rejected', () => {
    const mixedCandidates = [
      {
        ticker: 'VERIF_CO',
        company_name: 'Verified Operating Corp',
        pe_trailing: 30.0,
      },
      {
        ticker: 'SPY', // ETF ticker that must be rejected
        company_name: 'SPDR S&P 500 ETF Trust',
        pe_trailing: 25.0,
      },
    ];

    const result = discoverPeers(
      {
        ticker: 'SAAS_TARGET',
        company_profile: {
          overview: { sector: 'Technology', industry: 'Software - Application' } as any,
        },
      },
      'SAAS_TARGET',
      {
        candidates: mixedCandidates as any,
      }
    );

    const tickers = result.peers.map(c => c.ticker);
    assert.ok(tickers.includes('VERIF_CO'), 'Verified candidate must be accepted');
    assert.equal(tickers.includes('SPY'), false, 'ETF or invalid candidate must be rejected');
  });

  // =========================================================================
  // 52: TEST — FCF GROWTH
  // =========================================================================
  it('52. FCF Growth: Verified Q2 current FCF = 120, Q2 prior year FCF = 100 -> FCF Growth YoY = +20%', () => {
    const report: Partial<ReportData> = {
      ticker: 'OPERATING_CO',
      financial_statements: {
        currency: 'USD',
        periods: ['Q2 2023', 'Q3 2023', 'Q4 2023', 'Q1 2024', 'Q2 2024'],
        cash_flow: {
          free_cash_flow: [100, 110, 115, 105, 120],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'OPERATING_CO');
    assert.ok(metrics.fcfGrowthYoY.value !== null, 'FCF Growth YoY must be calculated');
    assert.equal(metrics.fcfGrowthYoY.value, 20);
    assert.equal(metrics.fcfGrowthYoY.status, 'CALCULATED');
  });

  // =========================================================================
  // 53: TEST — FCF SIGN FLIP
  // =========================================================================
  it('53. FCF sign flip: Prior FCF = -100, Current FCF = +50 -> turnaround state, not -150% or misleading percentage', () => {
    const report: Partial<ReportData> = {
      ticker: 'TURNAROUND_CO',
      financial_statements: {
        currency: 'USD',
        periods: ['FY2023', 'FY2024'],
        cash_flow: {
          free_cash_flow: [-100, 50],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'TURNAROUND_CO');
    assert.equal(metrics.fcfGrowthYoY.value, null, 'Turnaround FCF growth percentage must be null to avoid misleading %');
    assert.equal(metrics.fcfGrowthYoY.status, 'TURNAROUND');
    assert.ok(metrics.fcfGrowthYoY.reasonTh?.includes('บวก') || metrics.fcfGrowthYoY.reasonTh?.includes('ฟื้น'));
  });

  // =========================================================================
  // 54: TEST — 3Y REVENUE CAGR
  // =========================================================================
  it('54. 3Y Revenue CAGR: Verified annual revenue 2023 = 100, 2026 = 172.8 -> 3Y CAGR ≈ 20%', () => {
    const report: Partial<ReportData> = {
      ticker: 'GROWTH_CO',
      financial_statements: {
        currency: 'USD',
        periods: ['FY2023', 'FY2024', 'FY2025', 'FY2026'],
        income_statement: {
          revenue: [100, 120, 144, 172.8],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'GROWTH_CO');
    assert.ok(metrics.revenueCagr3Y.value !== null, '3Y Revenue CAGR must be calculated');
    assert.equal(Math.round(metrics.revenueCagr3Y.value! * 10) / 10, 20.0);
    assert.equal(metrics.revenueCagr3Y.status, 'CALCULATED');
  });

  // =========================================================================
  // 55: TEST — INSUFFICIENT HISTORY
  // =========================================================================
  it('55. Insufficient history: Only 4 quarters exist -> 3Y Revenue CAGR unavailable with INSUFFICIENT_HISTORY', () => {
    const report: Partial<ReportData> = {
      ticker: 'SHORT_HISTORY_CO',
      financial_statements: {
        currency: 'USD',
        periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024'],
        income_statement: {
          revenue: [25, 27, 28, 30],
        } as any,
      } as any,
    };

    const metrics = resolveFundamentalMetrics(report, 'SHORT_HISTORY_CO');
    assert.equal(metrics.revenueCagr3Y.value, null);
    assert.equal(metrics.revenueCagr3Y.status, 'INSUFFICIENT_HISTORY');
    assert.ok(metrics.revenueCagr3Y.reasonTh?.includes('ไม่เพียงพอ') || metrics.revenueCagr3Y.reasonTh?.includes('ไม่ครอบคลุม'));
  });

  // =========================================================================
  // 56: TEST — CROSS-SECTOR UNKNOWN COMPANY
  // =========================================================================
  it('56. Cross-sector unknown company: Discovers peers for software, industrial, REIT, and financial without static repository code changes', () => {
    const sectorsToTest = [
      { ticker: 'NEW_SFT', archetype: 'saas_software' as const, sector: 'Technology', industry: 'Software - Infrastructure' },
      { ticker: 'NEW_IND', archetype: 'industrial_manufacturing' as const, sector: 'Industrials', industry: 'Specialty Industrial Machinery' },
      { ticker: 'NEW_REIT', archetype: 'reit' as const, sector: 'Real Estate', industry: 'REIT - Industrial' },
      { ticker: 'NEW_BANK', archetype: 'bank' as const, sector: 'Financial Services', industry: 'Banks - Regional' },
    ];

    for (const item of sectorsToTest) {
      const mockDiscoverer = (): CandidateDefinition[] => [
        {
          ticker: `PEER_${item.ticker}`,
          companyName: `Peer for ${item.ticker}`,
          archetype: item.archetype,
          sector: item.sector,
          industry: item.industry,
          subIndustry: 'general',
          revenueModels: ['standard'],
          majorBusinessLines: ['Operations'],
          geography: 'global',
          lifecycle: 'growth',
          profitabilityState: 'profitable',
          capitalIntensity: 'moderate',
          regulatoryType: 'standard',
          scaleTier: 'large',
          metrics: {
            pe_trailing: { value: 18.0, unit: 'x', period: '2024', source: 'verified', reportedOrDerived: 'REPORTED' },
          },
        } as CandidateDefinition,
      ];

      const result = discoverPeerCandidates(
        {
          ticker: item.ticker,
          companyName: `Target ${item.ticker}`,
          primaryArchetype: item.archetype,
          sector: item.sector,
          industry: item.industry,
        } as any,
        { candidateDiscoverer: mockDiscoverer }
      );

      assert.ok(result.length > 0, `Discovery must succeed for ${item.ticker} in ${item.sector}`);
      assert.equal(result[0].archetype, item.archetype);
    }
  });

  // =========================================================================
  // 57: TEST — FINANCIAL SECTOR REGRESSION
  // =========================================================================
  it('57. Financial sector regression: SOFI-like company keeps Financial Sector Guard active, PEG guarded, ROIC not forced as primary', () => {
    const sofiReport: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        overview: {
          symbol: 'SOFI',
          company_name: 'SoFi Technologies, Inc.',
          sector: 'Financial Services',
          industry: 'Credit Services',
          description: 'SoFi Technologies, Inc. provides digital financial services, lending, and student loan refinancing...',
        } as any,
      },
      financial_statements: {
        currency: 'USD',
        statement_template: 'banking' as any,
        periods: ['FY2024'],
        income_statement: {
          revenue: [2500],
          net_income: [200],
        } as any,
        balance_sheet: {
          total_assets: [32000],
          total_equity: [5500],
          total_debt: [4000],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 45.0 } as any,
      ],
    };

    const resolved = resolveAdaptiveFivePillars(sofiReport, 'SOFI');
    assert.ok(['bank', 'lender', 'fintech'].includes(resolved.archetype), 'SOFI must classify into financial archetype');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, true, 'FCF must remain guarded for financial company');
    assert.equal(resolved.fivePillarsData.profitability.gross_margin_pct, undefined, 'Gross margin not applicable to bank/lender');
    assert.ok(resolved.fivePillarsData.profitability.roe_pct !== undefined, 'ROE must be the primary return metric for financial archetype');
  });

  // =========================================================================
  // 58: TEST — REIT REGRESSION
  // =========================================================================
  it('58. REIT regression: PLD-like company uses P/FFO orientation, discovery finds REIT comparables, no automotive metrics leak', () => {
    const pldReport: Partial<ReportData> = {
      ticker: 'PLD',
      company_profile: {
        overview: {
          symbol: 'PLD',
          company_name: 'Prologis, Inc.',
          sector: 'Real Estate',
          industry: 'REIT - Industrial',
          description: 'Prologis, Inc. is the global leader in logistics real estate with a focus on high-barrier, high-growth markets...',
        } as any,
      },
      financial_statements: {
        currency: 'USD',
        statement_template: 'real_estate' as any,
        periods: ['FY2024'],
        income_statement: {
          revenue: [8000],
          net_income: [3000],
        } as any,
        balance_sheet: {
          total_assets: [90000],
          total_equity: [55000],
          total_debt: [30000],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/FFO', value: 22.5 } as any,
      ],
    };

    const resolved = resolveAdaptiveFivePillars(pldReport, 'PLD');
    assert.equal(resolved.archetype, 'reit');
    const peerMatrix = resolved.fivePillarsData.peer_matrix || [];
    const pffoRow = peerMatrix.find(r => /FFO/i.test(r.metric_name));
    assert.ok(pffoRow !== undefined, 'P/FFO row must be present for REIT archetype');
  });

  // =========================================================================
  // 59: TEST — SEMICONDUCTOR REGRESSION
  // =========================================================================
  it('59. Semiconductor regression: Fabless target does not treat foundry/equipment candidates as direct peers', () => {
    const candidates = [
      {
        ticker: 'NVDA_LIKE',
        company_name: 'Fabless AI Chip Corp',
        archetype: 'semiconductor' as const,
        sector: 'Technology',
        industry: 'Semiconductors',
        subIndustry: 'fabless_accelerator',
        pe_trailing: 40.0,
      },
      {
        ticker: 'TSMC_LIKE',
        company_name: 'Pure-Play Foundry Corp',
        archetype: 'semiconductor' as const,
        sector: 'Technology',
        industry: 'Semiconductors',
        subIndustry: 'foundry_manufacturing',
        pe_trailing: 20.0,
      },
    ];

    const result = discoverPeers(
      {
        ticker: 'AMD_LIKE',
        company_profile: {
          overview: {
            sector: 'Technology',
            industry: 'Semiconductors',
            description: 'Fabless semiconductor design and GPU innovation',
          } as any,
        },
      },
      'AMD_LIKE',
      {
        candidates: candidates as any,
      }
    );

    const directCandidate = result.peers.find(c => c.ticker === 'NVDA_LIKE');
    const foundryCandidate = result.peers.find(c => c.ticker === 'TSMC_LIKE');

    assert.ok(directCandidate, 'Fabless candidate must be found');
    assert.ok(foundryCandidate, 'Foundry candidate may be present as comparable');
    // Fabless peer must be prioritized over foundry
    assert.equal(result.peers[0].ticker, 'NVDA_LIKE', 'Fabless peer must rank higher than foundry for fabless target');
    assert.notEqual(foundryCandidate.relationType, 'DIRECT_PEER', 'Foundry must NOT be labeled DIRECT_PEER for fabless target');
  });

  it('60. Atomic PEG: P/E 334.2 and historical EPS growth 17.95 resolve to one consistent 18.62x state', () => {
    const resolved = resolveAdaptiveFivePillars({
      ticker: 'TSLA',
      valuation_ratios: [{ name: 'P/E (Trailing)', value: 334.2 } as any],
      key_indicators: { growth: { eps_growth_yoy_pct: 17.95 } as any },
    }, 'TSLA');
    const growth = resolved.fivePillarsData.growth;
    assert.equal(growth.peg_ratio, 18.62);
    assert.equal(growth.resolved_metrics?.peg.value, 18.62);
    assert.equal(growth.resolved_metrics?.peg.status, 'CALCULATED');
    assert.equal(growth.peg_interpretation?.includes('ไม่พร้อม'), false);
  });

  it('61. Ambiguous reported P/E fails closed instead of being assumed trailing', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'AMBIG',
      key_indicators: { valuation: { pe_ratio: 25 }, growth: { eps_growth_yoy_pct: 20 } } as any,
    }, 'AMBIG');
    assert.equal(metrics.peTrailing.basis, 'REPORTED');
    assert.equal(metrics.peg.status, 'BASIS_MISMATCH');
    assert.equal(metrics.peg.value, null);
  });

  it('62. Negative EPS growth has a semantic reason and never masquerades as missing data', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'DECLINE',
      valuation_ratios: [{ name: 'P/E (Trailing)', value: 30 } as any],
      key_indicators: { growth: { eps_growth_yoy_pct: -8 } as any },
    }, 'DECLINE');
    assert.equal(metrics.peg.status, 'UNAVAILABLE');
    assert.equal(metrics.peg.reason, 'Negative or zero EPS growth');
    assert.match(metrics.peg.reasonTh || '', /ติดลบ|ศูนย์/);
  });

  it('63. Verified completion facts survive normalization and recover a true three-year revenue CAGR', () => {
    const facts = [
      { fiscalPeriod: 'FY2023', value: 100 },
      { fiscalPeriod: 'FY2026', value: 172.8 },
    ].map(item => ({
      ...item,
      metricKey: 'income_statement.revenue', unit: 'USD_M', periodType: 'DURATION_ANNUAL',
      sourceType: 'SEC_XBRL', sourceDocument: '10-K', extractionMethod: 'STRUCTURED_XBRL',
      reportedOrDerived: 'GAAP', verificationStatus: 'VERIFIED', confidence: 1, issuerIdentity: 'RECOVER',
    }));
    const normalized = normalizeReport({
      ticker: 'RECOVER',
      financial_statements: { currency: 'USD', periods: ['FY2026'], income_statement: { revenue: [172.8] } as any } as any,
      data_completeness: { verifiedFacts: facts } as any,
    } as ReportData, 'RECOVER');
    assert.equal(normalized.five_pillars?.growth.resolved_metrics?.revenue_cagr_3y.status, 'CALCULATED');
    assert.equal(normalized.five_pillars?.growth.revenue_cagr_3yr_pct, 20);
  });

  it('64. Three annual observations spanning only two years are insufficient for a 3Y CAGR', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'TWO_YEAR',
      financial_statements: {
        currency: 'USD', periods: ['FY2024', 'FY2025', 'FY2026'],
        income_statement: { revenue: [100, 120, 144] } as any,
      } as any,
    }, 'TWO_YEAR');
    assert.equal(metrics.revenueCagr3Y.status, 'INSUFFICIENT_HISTORY');
    assert.equal(metrics.revenueCagr3Y.value, null);
  });

  it('65. SEC FCF uses matching Q2 periods even when statement order contains unrelated quarters', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'SEC_FCF',
      sec_verification: {
        status: 'verified_eligible', ticker: 'SEC_FCF', retrieved_at: '2026-09-20', provenance_status: 'verified',
        provenance_warnings: [], dcf_coverage: null, dcf_financial_inputs: null, latest_statements_source: null,
        sec_period_statements: [
          { period: '2025-Q2', fiscal_year: 2025, fiscal_quarter: 2, operating_cash_flow: 130, capital_expenditure: -30 },
          { period: '2026-Q1', fiscal_year: 2026, fiscal_quarter: 1, operating_cash_flow: 95, capital_expenditure: -15 },
          { period: '2026-Q2', fiscal_year: 2026, fiscal_quarter: 2, operating_cash_flow: 150, capital_expenditure: -30 },
        ],
      },
    }, 'SEC_FCF');
    assert.equal(metrics.fcfGrowthYoY.value, 20);
    assert.equal(metrics.fcfGrowthYoY.period, 'Q2 2025 → Q2 2026');
    assert.match(metrics.fcfGrowthYoY.source || '', /SEC verified/);
  });

  it('66. REIT FCF growth is explicitly not applicable instead of generic N/A', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'REITX',
      company_profile: { overview: { sector: 'Real Estate', industry: 'REIT - Industrial' } as any },
    }, 'REITX');
    assert.equal(metrics.fcfGrowthYoY.status, 'NOT_APPLICABLE');
    assert.match(metrics.fcfGrowthYoY.reasonTh || '', /FFO\/AFFO/);
  });

  it('67. Missing P/E reports the P/E gap, not an EPS-history contradiction', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'NO_PE',
      key_indicators: { growth: { eps_growth_yoy_pct: 20 } as any },
    }, 'NO_PE');
    assert.equal(metrics.peg.reason, 'MISSING_PE');
    assert.match(metrics.peg.reasonTh || '', /P\/E/);
    assert.equal(metrics.peg.reasonTh?.includes('EPS Growth ไม่พร้อม'), false);
  });

  it('68. Independently verified SEC canonical history recovers annual CAGR without legacy arrays', () => {
    const canonicalItem = (period: string, value: number) => ({
      metric: 'revenue', statement: 'income_statement', value, unit: 'USD_M', period,
      type: 'reported', verification: 'verified', source: { provider: 'SEC EDGAR' },
    });
    const metrics = resolveFundamentalMetrics({
      ticker: 'CANON',
      canonical_financials: {
        schemaVersion: 1, generatedBy: 'sec-xbrl-companyfacts-v1', ticker: 'CANON', currency: 'USD',
        periods: ['FY2023', 'FY2026'], provenanceStatus: 'verified', provenanceWarnings: [],
        values: { 'income_statement.revenue': [canonicalItem('FY2023', 100), canonicalItem('FY2026', 172.8)] },
        sourceCoverage: { sourceLinkedValues: 2, verifiedValues: 2, nonNullValues: 2, missingValues: 0, totalValues: 2 },
      } as any,
    }, 'CANON');
    assert.equal(metrics.revenueCagr3Y.status, 'CALCULATED');
    assert.equal(metrics.revenueCagr3Y.value, 20);
    assert.match(metrics.revenueCagr3Y.source || '', /canonical/);
  });

});
