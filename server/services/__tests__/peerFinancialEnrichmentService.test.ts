import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enrichPeerCandidate,
  enrichPeerCandidates,
  candidateToPeerCompanyItem,
  clearPeerEnrichmentCache,
  type PeerEnrichmentOptions,
} from '../peerFinancialEnrichmentService.js';
import { discoverPeers } from '../../../src/domain/valuation/peerDiscoveryEngine.js';
import { resolveAdaptiveFivePillars } from '../../../src/domain/valuation/fivePillarsResolver.js';
import type { ReportData } from '../../../src/types.js';
import type { SecVerifiedIntegrationPackage } from '../../../src/services/sec/secIntegration.js';

describe('Verified Peer Data Completion Pipeline', () => {
  beforeEach(() => {
    clearPeerEnrichmentCache();
  });

  const createMockSecPackage = (overrides: {
    periods?: string[];
    revenues?: number[];
    opIncomes?: number[];
    netIncomes?: number[];
    grossProfits?: number[];
    debts?: number[];
    equities?: number[];
    cashes?: number[];
    stis?: number[];
    pretax?: number[];
    tax?: number[];
  } = {}): SecVerifiedIntegrationPackage => {
    const periods = overrides.periods || ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'];
    const n = periods.length;

    const fill = (arr: number[] | undefined, defaultVal: number) =>
      arr && arr.length === n ? arr : Array(n).fill(defaultVal);

    const revs = fill(overrides.revenues, 1000);
    const opIncs = fill(overrides.opIncomes, 150);
    const netIncs = fill(overrides.netIncomes, 100);
    const grossProfits = fill(overrides.grossProfits, 400);
    const debts = fill(overrides.debts, 500);
    const equities = fill(overrides.equities, 2000);
    const cashes = fill(overrides.cashes, 300);
    const stis = fill(overrides.stis, 100);
    const pretaxes = fill(overrides.pretax, 120);
    const taxes = fill(overrides.tax, 25);

    const makeVal = (v: number) => ({
      value: v,
      source: {
        documentType: '10-Q',
        sourceDocument: 'SEC Form 10-Q',
      },
    });

    return {
      ticker: 'MOCK',
      canonicalFinancials: {
        ticker: 'MOCK',
        periods,
        values: {
          'income_statement.revenue': revs.map(makeVal),
          'income_statement.operating_income': opIncs.map(makeVal),
          'income_statement.net_income': netIncs.map(makeVal),
          'income_statement.gross_profit': grossProfits.map(makeVal),
          'income_statement.income_before_tax': pretaxes.map(makeVal),
          'income_statement.income_tax_expense': taxes.map(makeVal),
          'balance_sheet.total_debt': debts.map(makeVal),
          'balance_sheet.total_equity': equities.map(makeVal),
          'balance_sheet.cash_and_equivalents': cashes.map(makeVal),
          'balance_sheet.short_term_investments': stis.map(makeVal),
        } as any,
        provenanceStatus: 'verified',
        generatedBy: 'sec-xbrl-mock',
      } as any,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: { eligible: true, periods: [], currentSharesOutstandingM: 100, issues: [] },
    };
  };

  it('36. TEST — PEER SEC ENRICHMENT: derives revenue growth, operating margin, and canonical ROIC', async () => {
    // Q2 2025 revenue: 1200, Q2 2024 revenue: 1000 -> Growth = 20.0%
    // Q2 2025 operating income: 180, revenue: 1200 -> Margin = 15.0%
    const mockPackage = createMockSecPackage({
      periods: ['Q1 2024', 'Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'],
      revenues: [950, 1000, 1050, 1100, 1150, 1200],
      opIncomes: [140, 150, 160, 170, 175, 180],
      equities: [1800, 1850, 1900, 1950, 2000, 2100],
      debts: [400, 400, 450, 450, 500, 500],
      cashes: [200, 220, 240, 250, 280, 300],
    });

    const mockFetcher = async (_t: string) => mockPackage;

    const { candidate, gaps } = await enrichPeerCandidate(
      { ticker: 'PEER1', companyName: 'Peer One Corp', archetype: 'industrial_manufacturing', industry: 'Automotive' } as any,
      { secPackageFetcher: mockFetcher }
    );

    assert.equal(gaps.length, 0, 'Should have 0 gaps for fully disclosed peer');
    const m = candidate.metrics as Record<string, any>;

    // Derived Revenue Growth YoY (same-quarter prior-year: Q2 2025 vs Q2 2024)
    assert.ok(m.revenue_growth_yoy_pct);
    assert.equal(m.revenue_growth_yoy_pct.value, 20); // (1200 - 1000) / 1000 * 100 = 20%
    assert.equal(m.revenue_growth_yoy_pct.status, 'VERIFIED');
    assert.equal(m.revenue_growth_yoy_pct.periodBasis, 'QUARTERLY');
    assert.match(m.revenue_growth_yoy_pct.source || '', /SEC Form 10-Q/);

    // Derived Operating Margin (standalone Q2 2025: 180 / 1200 = 15.0%)
    assert.ok(m.operating_margin_pct);
    assert.equal(m.operating_margin_pct.value, 15);
    assert.equal(m.operating_margin_pct.status, 'VERIFIED');
    assert.equal(m.operating_margin_pct.periodBasis, 'QUARTERLY');

    // Derived Canonical ROIC (TTM ending Q2 2025)
    assert.ok(m.roic_pct);
    assert.equal(m.roic_pct.status, 'VERIFIED');
    assert.equal(m.roic_pct.periodBasis, 'TTM');
    assert.ok(typeof m.roic_pct.value === 'number' && m.roic_pct.value > 0);
  });

  it('37. TEST — PARTIAL ENRICHMENT: handles partial facts gracefully (Revenue & Margin valid, ROIC unavailable)', async () => {
    // Only 2 quarters available -> revenue growth & margin work, but ROIC has insufficient 4-quarter history
    const mockPackage = createMockSecPackage({
      periods: ['Q1 2025', 'Q2 2025'],
      revenues: [1000, 1100],
      opIncomes: [100, 110],
    });

    const { candidate, gaps } = await enrichPeerCandidate(
      { ticker: 'PARTIAL', companyName: 'Partial Peer', archetype: 'general_operating' } as any,
      { secPackageFetcher: async () => mockPackage }
    );

    const m = candidate.metrics as Record<string, any>;
    assert.equal(m.operating_margin_pct?.value, 10);
    assert.equal(m.operating_margin_pct?.status, 'VERIFIED');
    // ROIC is unavailable because < 4 quarters disclosed
    assert.equal(m.roic_pct, undefined);
    assert.ok(gaps.some(g => g.metric === 'roic_pct'));
    assert.equal(candidate.ticker, 'PARTIAL');
  });

  it('38. TEST — MULTIPLE PEERS: three verified peers produce SUFFICIENT median without AI growth', async () => {
    const peersData = [
      { ticker: 'P1', revYoY: 10, opMargin: 12 },
      { ticker: 'P2', revYoY: 20, opMargin: 15 },
      { ticker: 'P3', revYoY: 30, opMargin: 18 },
    ];

    const candidates = peersData.map(p => {
      const pkg = createMockSecPackage({
        periods: ['Q2 2024', 'Q2 2025'],
        revenues: [1000, 1000 * (1 + p.revYoY / 100)],
        opIncomes: [100, 1000 * (1 + p.revYoY / 100) * (p.opMargin / 100)],
      });
      return {
        cand: { ticker: p.ticker, companyName: p.ticker, archetype: 'industrial_manufacturing', industry: 'Auto' },
        pkg,
      };
    });

    const fetcher = async (t: string) => {
      const match = candidates.find(c => c.cand.ticker === t);
      if (!match) throw new Error(`Unknown ticker ${t}`);
      return match.pkg;
    };

    const { enrichedCandidates } = await enrichPeerCandidates(
      candidates.map(c => c.cand as any),
      { secPackageFetcher: fetcher }
    );

    assert.equal(enrichedCandidates.length, 3);
    const peerItems = enrichedCandidates.map(candidateToPeerCompanyItem);
    assert.ok(peerItems.every(peer => peer.revenue_growth_yoy_pct_verified === true));
    assert.ok(peerItems.every(peer => peer.operating_margin_pct_verified === true));

    // Target report
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET',
      company_profile: { industry: 'Auto' } as any,
      peer_comparison: { peers: peerItems, industry_name: 'Auto' },
      financial_statements: {
        periods: ['Q2 2024', 'Q2 2025'],
        income_statement: {
          revenue: [2000, 2400], // +20% YoY
          operating_income: [200, 288], // 12%
        } as any,
        balance_sheet: {
          total_debt: [1000, 1000],
          total_equity: [5000, 5500],
          cash_and_equivalents: [800, 900],
        } as any,
        cash_flow: {
          operating_cash_flow: [300, 400],
          capex: [100, 150],
          free_cash_flow: [200, 250],
        } as any,
      } as any,
    };

    const discovery = discoverPeers(targetReport, 'TARGET');
    assert.equal(discovery.peers.length, 3);

    // Benchmark rows should have Revenue Growth with n=3 SUFFICIENT coverage
    const revRow = discovery.benchmarkRows.find(r => r.metric_key === 'revenue_growth_yoy_pct');
    assert.ok(revRow, 'Revenue Growth benchmark row must exist');
    assert.equal(revRow.peer_coverage_status, 'SUFFICIENT');
    assert.equal(revRow.median_value, 20); // Median of [10, 20, 30] is 20
  });

  it('39. TEST — ENRICHMENT FAILURE: failure of one peer is isolated, other peers succeed', async () => {
    const rawPeers = [
      { ticker: 'GOOD1', companyName: 'Good 1' },
      { ticker: 'BAD_NET', companyName: 'Network Error Corp' },
      { ticker: 'GOOD2', companyName: 'Good 2' },
    ];

    const fetcher = async (t: string) => {
      if (t === 'BAD_NET') {
        throw new Error('ECONNRESET network failure connecting to SEC');
      }
      return createMockSecPackage();
    };

    const { enrichedCandidates, allGaps } = await enrichPeerCandidates(rawPeers as any, {
      secPackageFetcher: fetcher,
    });

    assert.equal(enrichedCandidates.length, 3, 'All 3 candidates must be returned');
    assert.ok(enrichedCandidates.find(c => c.ticker === 'GOOD1')?.metrics.revenue_growth_yoy_pct);
    assert.ok(enrichedCandidates.find(c => c.ticker === 'GOOD2')?.metrics.revenue_growth_yoy_pct);
    assert.equal(enrichedCandidates.find(c => c.ticker === 'BAD_NET')?.metrics.revenue_growth_yoy_pct, undefined);
    assert.ok(allGaps.some(g => g.ticker === 'BAD_NET' && g.reason.includes('ECONNRESET')));
  });

  it('40. TEST — PERIOD MISMATCH: records gap and excludes non-matching comparison period', async () => {
    // Only Q1 2025 and Q2 2025 (no Q2 2024 prior-year same-quarter)
    const mockPackage = createMockSecPackage({
      periods: ['Q1 2025', 'Q2 2025'],
      revenues: [1000, 1100],
    });

    const { candidate, gaps } = await enrichPeerCandidate(
      { ticker: 'MISMATCH', companyName: 'Mismatch Inc' } as any,
      { secPackageFetcher: async () => mockPackage }
    );

    assert.equal(candidate.metrics.revenue_growth_yoy_pct, undefined, 'Cannot derive YoY revenue growth without prior-year same quarter');
    assert.ok(gaps.some(g => g.metric === 'revenue_growth_yoy_pct' && g.reason.includes('prior-year comparable quarter')));
  });

  it('replaces AI semantic percentages with SEC GAAP revenue and operating-income ratios', async () => {
    const pkg = createMockSecPackage({
      periods: ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'],
      revenues: [100, 110, 120, 130, 125],
      opIncomes: [10, 11, 12, 13, 25],
    });
    const raw = {
      ticker: 'SEMANTIC_PEER', companyName: 'Peer',
      metrics: {
        revenue_growth_yoy_pct: { value: 350, unit: '%', period: 'Q2 2025', source: 'AI discovery', reportedOrDerived: 'REPORTED' },
        operating_margin_pct: { value: 0.5, unit: '%', period: 'Q2 2025', source: 'AI discovery', reportedOrDerived: 'REPORTED' },
      },
    };
    const { candidate } = await enrichPeerCandidate(raw as any, { secPackageFetcher: async () => pkg });
    assert.equal(candidate.metrics.revenue_growth_yoy_pct?.value, 25);
    assert.equal(candidate.metrics.operating_margin_pct?.value, 20);
    const peer = candidateToPeerCompanyItem(candidate);
    assert.equal(peer.revenue_growth_yoy_pct, 25);
    assert.equal(peer.operating_margin_pct, 20);
    assert.deepEqual(peer.revenue_growth_yoy_pct_inputs_used, { currentRevenue: 125, priorYearRevenue: 100 });
    assert.deepEqual(peer.operating_margin_pct_inputs_used, { operatingIncome: 25, revenue: 125 });
  });

  it('excludes a prior-year revenue comparison when filing concepts differ', async () => {
    const pkg = createMockSecPackage({ periods: ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'] });
    (pkg.canonicalFinancials!.values['income_statement.revenue'][0] as any).derivation = 'SEC us-gaap:Revenues reported standalone fiscal quarter.';
    (pkg.canonicalFinancials!.values['income_statement.revenue'][4] as any).derivation = 'SEC us-gaap:SalesRevenueNet reported standalone fiscal quarter.';
    const { candidate, gaps } = await enrichPeerCandidate({ ticker: 'CONCEPT_CHANGE' } as any,
      { secPackageFetcher: async () => pkg });
    assert.equal(candidate.metrics.revenue_growth_yoy_pct, undefined);
    assert.ok(gaps.some(gap => gap.metric === 'revenue_growth_yoy_pct' && /concept differs/.test(gap.reason)));
  });

  it('41. TEST — FOREIGN / NON-REPORTING ISSUER: preserves market metrics, leaves fundamentals unverified', async () => {
    const emptySecPackage: SecVerifiedIntegrationPackage = {
      ticker: 'FOREIGN',
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: { eligible: false, periods: [], currentSharesOutstandingM: null, issues: [] },
    };

    const candidateWithQuote = {
      ticker: 'FOREIGN',
      companyName: 'Foreign Auto Ltd',
      metrics: {
        market_cap: { value: 25.5, unit: 'B', source: 'Live Quote', reportedOrDerived: 'REPORTED' as const },
        pe_trailing: { value: 14.2, unit: 'x', period: 'TTM', source: 'Live Quote', reportedOrDerived: 'REPORTED' as const },
      },
    };

    const { candidate, gaps } = await enrichPeerCandidate(candidateWithQuote as any, {
      secPackageFetcher: async () => emptySecPackage,
    });

    assert.equal(candidate.metrics.market_cap?.value, 25.5);
    assert.equal(candidate.metrics.pe_trailing?.value, 14.2);
    // Fundamentals must not be fabricated
    assert.equal(candidate.metrics.revenue_growth_yoy_pct, undefined);
    assert.equal(candidate.metrics.operating_margin_pct, undefined);
    assert.ok(gaps.some(g => g.metric === 'canonical_financials'));
  });

  it('42. TEST — CACHE: repeated enrichment in same TTL avoids duplicate network requests', async () => {
    let callCount = 0;
    const fetcher = async (_t: string) => {
      callCount++;
      return createMockSecPackage();
    };

    await enrichPeerCandidate({ ticker: 'CACHED' } as any, { secPackageFetcher: fetcher });
    assert.equal(callCount, 1, 'First call must fetch');

    await enrichPeerCandidate({ ticker: 'CACHED' } as any, { secPackageFetcher: fetcher });
    assert.equal(callCount, 1, 'Second call within TTL must hit cache without refetching');
  });

  it('43. TEST — ENRICHMENT BEFORE FIVE PILLARS: enriched peer facts flow into resolveAdaptiveFivePillars', async () => {
    // Verify that when peer data is enriched before resolveAdaptiveFivePillars,
    // Pillar 5 peer_matrix has full benchmark rows with medians
    const mockPackage = createMockSecPackage({
      periods: ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'],
      revenues: [1000, 1050, 1100, 1150, 1250], // +25.0% YoY
      opIncomes: [100, 110, 120, 130, 150], // 12.0% Margin
      equities: [3000, 3100, 3200, 3300, 3500],
      debts: [500, 500, 500, 500, 500],
      cashes: [400, 400, 400, 400, 400],
    });

    const peers = ['PEER_A', 'PEER_B', 'PEER_C'].map(ticker => ({
      ticker,
      company_name: `${ticker} Corp`,
    }));

    const { enrichedCandidates } = await enrichPeerCandidates(peers as any, {
      secPackageFetcher: async () => mockPackage,
    });

    const enrichedPeerItems = enrichedCandidates.map(candidateToPeerCompanyItem);

    const report: Partial<ReportData> = {
      ticker: 'LEAD',
      company_profile: { industry: 'Auto' } as any,
      financial_statements: {
        periods: ['Q2 2024', 'Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'],
        income_statement: {
          revenue: [1000, 1050, 1100, 1150, 1200],
          operating_income: [100, 110, 120, 130, 140],
        } as any,
        balance_sheet: {
          total_debt: [500, 500, 500, 500, 500],
          total_equity: [3000, 3100, 3200, 3300, 3500],
          cash_and_equivalents: [400, 400, 400, 400, 400],
        } as any,
        cash_flow: {
          operating_cash_flow: [150, 160, 170, 180, 200],
          capex: [50, 50, 50, 50, 50],
          free_cash_flow: [100, 110, 120, 130, 150],
        } as any,
      } as any,
      peer_comparison: {
        as_of_date: '2026-06-30',
        industry_name: 'Auto',
        peers: enrichedPeerItems,
      },
    };

    // Five Pillars resolution with enriched peers
    const result = resolveAdaptiveFivePillars(report, 'LEAD');
    assert.ok(result.fivePillarsData.peer_matrix.length > 0, 'Pillar 5 peer_matrix must be populated');

    const revBenchmark = result.fivePillarsData.peer_matrix.find(r => r.metric_key === 'revenue_growth_yoy_pct');
    assert.ok(revBenchmark, 'Revenue growth benchmark row must exist');
    assert.equal(revBenchmark.peer_coverage_status, 'SUFFICIENT');
    assert.equal(revBenchmark.median_value, 25);
  });

  it('30 & 31. TEST — P/E N/M AND LOSS-MAKING AUTOMOTIVE: negative earnings produce N/M, negative ROIC is preserved', async () => {
    // Loss-making peer (like RIVN):
    // TTM Net Income negative: -800
    // TTM Operating Income negative: -900
    // Positive Invested Capital: Equity 5000 + Debt 2000 - Cash 3000 = 4000
    const mockLossPackage = createMockSecPackage({
      periods: ['Q3 2024', 'Q4 2024', 'Q1 2025', 'Q2 2025'],
      revenues: [800, 850, 900, 1000],
      opIncomes: [-250, -250, -200, -200], // TTM OpInc = -900
      netIncomes: [-220, -220, -180, -180], // TTM NetInc = -800
      equities: [6000, 5700, 5300, 5000],
      debts: [2000, 2000, 2000, 2000],
      cashes: [4000, 3600, 3300, 3000],
    });

    const { candidate } = await enrichPeerCandidate(
      { ticker: 'LOSS_AUTO', companyName: 'Loss Automotive Inc', archetype: 'industrial_manufacturing' } as any,
      { secPackageFetcher: async () => mockLossPackage }
    );

    const m = candidate.metrics as Record<string, any>;
    // P/E must be marked N/M due to verified negative earnings
    assert.equal(m.pe_trailing?.value, null);
    assert.equal(m.pe_trailing?.reason, 'NEGATIVE_EARNINGS');

    // ROIC must be negative (mathematically valid negative ROIC for loss-making operating company)
    assert.ok(m.roic_pct);
    assert.equal(m.roic_pct.status, 'VERIFIED');
    assert.ok(typeof m.roic_pct.value === 'number' && m.roic_pct.value < 0);

    // Serialization to PeerCompanyItem
    const item = candidateToPeerCompanyItem(candidate);
    assert.equal(item.pe_trailing, 'N/M');
    assert.ok(typeof item.roic_pct === 'number' && item.roic_pct < 0);
    assert.equal(item.roic_verified, true);
  });
});
