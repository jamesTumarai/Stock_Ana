import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types.js';
import { calculateCanonicalRoic, calculateInvestedCapital } from '../canonicalRoic.js';
import { resolveFundamentalMetrics } from '../metricRegistry.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { discoverPeers } from '../peerDiscoveryEngine.js';

describe('Five Pillars Final Data Integrity & Provenance', () => {

  // SECTION 38: Canonical debt direct total with no overlapping double counting
  it('38. Selects canonical direct total debt without adding overlapping components or leases', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_DEBT',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [1000], operating_income: [100], net_income: [80] } as any,
        balance_sheet: {
          total_debt: [9080], // Reported direct aggregate carrying amount
          short_term_debt: [1340], // Component alias
          long_term_debt: [7721],  // Component alias
          total_equity: [86858],
          cash_and_equivalents: [15219],
          short_term_investments: [28305],
        } as any,
        cash_flow: {} as any,
      } as any,
    };

    const pillars = resolveAdaptiveFivePillars(report, 'TEST_DEBT');
    // Total debt must be 9080 / 1000 = 9.08B (NOT 9080 + 1340 + 7721 = 18.14B)
    assert.equal(pillars.fivePillarsData.balance_sheet.total_debt_b, 9.08);
    // Net cash: Cash (15219) + STI (28305) = 43524. 43524 - 9080 = 34444 => +$34.44B
    assert.equal(pillars.fivePillarsData.balance_sheet.net_cash_or_debt_b, 34.44);
    assert.equal(pillars.fivePillarsData.balance_sheet.is_net_cash, true);
  });

  // SECTION 39: Canonical debt component fallback (short + long)
  it('39. Derives total debt from short + long components only when both are present, fail-closed if one is missing', () => {
    // Case A: Both short and long present
    const reportBoth: Partial<ReportData> = {
      ticker: 'TEST_FALLBACK',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [500] } as any,
        balance_sheet: {
          total_debt: [null], // Missing direct total
          short_term_debt: [200],
          long_term_debt: [800],
          total_equity: [2000],
        } as any,
        cash_flow: {} as any,
      } as any,
    };

    const metricsBoth = resolveFundamentalMetrics(reportBoth);
    const pillarsBoth = resolveAdaptiveFivePillars(reportBoth, 'TEST_FALLBACK');
    assert.equal(pillarsBoth.fivePillarsData.balance_sheet.total_debt_b, 1.0); // (200 + 800) / 1000 = 1.0B
    assert.equal(pillarsBoth.fivePillarsData.balance_sheet.debt_to_equity, 0.5); // 1000 / 2000 = 0.5x

    // Case B: Short present, long missing => fails closed (must NOT treat long-term debt as 0)
    const reportMissing: Partial<ReportData> = {
      ticker: 'TEST_FAIL_CLOSED',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [500] } as any,
        balance_sheet: {
          total_debt: [null],
          short_term_debt: [200],
          long_term_debt: [null], // Missing
          total_equity: [2000],
        } as any,
        cash_flow: {} as any,
      } as any,
    };

    const pillarsMissing = resolveAdaptiveFivePillars(reportMissing, 'TEST_FAIL_CLOSED');
    assert.equal(pillarsMissing.fivePillarsData.balance_sheet.total_debt_b, undefined);
    assert.equal(pillarsMissing.fivePillarsData.balance_sheet.debt_to_equity, undefined);
  });

  // SECTION 40 & 41: Same-period debt and finance leases
  it('40 & 41. Preserves same-period debt and does not combine mismatched periods', () => {
    const reportMismatch: Partial<ReportData> = {
      ticker: 'TEST_PERIOD',
      company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any,
      financial_statements: {
        periods: ['Q1 2026', 'Q2 2026'],
        income_statement: { revenue: [1000, 1100] } as any,
        balance_sheet: {
          total_debt: [null, null],
          short_term_debt: [500, null], // Available in Q1, missing in Q2
          long_term_debt: [1200, 1500],  // Available in both
          total_equity: [5000, 5500],
        } as any,
        cash_flow: {} as any,
      } as any,
    };

    const pillars = resolveAdaptiveFivePillars(reportMismatch, 'TEST_PERIOD');
    // For Q2 (latest index), short_term_debt is null, so total_debt_b fails closed instead of borrowing Q1
    assert.equal(pillars.fivePillarsData.balance_sheet.total_debt_b, undefined);
  });

  // SECTION 42 & 43: Net Cash propagation and ROIC debt dependency
  it('42 & 43. Changing debt affects Net Cash, D/E, and ROIC, but leaves ROE unchanged', () => {
    const baseReport = (debtValue: number): Partial<ReportData> => ({
      ticker: 'TEST_SENSITIVITY',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      financial_statements: {
        periods: ['Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: {
          revenue: [1000, 1000, 1000, 1000, 1000],
          operating_income: [100, 100, 100, 100, 100],
          income_before_tax: [90, 90, 90, 90, 90],
          income_tax_expense: [18, 18, 18, 18, 18],
          net_income: [72, 72, 72, 72, 72],
        } as any,
        balance_sheet: {
          total_equity: [5000, 5000, 5000, 5000, 5000],
          total_debt: [debtValue, debtValue, debtValue, debtValue, debtValue],
          cash_and_equivalents: [1000, 1000, 1000, 1000, 1000],
          short_term_investments: [500, 500, 500, 500, 500],
        } as any,
        cash_flow: {} as any,
      } as any,
    });

    const runLowDebt = resolveAdaptiveFivePillars(baseReport(1000), 'TEST_SENSITIVITY');
    const runHighDebt = resolveAdaptiveFivePillars(baseReport(3000), 'TEST_SENSITIVITY');

    // Net Cash:
    // Low debt: Cash+STI = 1500, Debt = 1000 => Net Cash = +0.5B
    assert.equal(runLowDebt.fivePillarsData.balance_sheet.net_cash_or_debt_b, 0.5);
    // High debt: Cash+STI = 1500, Debt = 3000 => Net Debt = -1.5B
    assert.equal(runHighDebt.fivePillarsData.balance_sheet.net_cash_or_debt_b, 1.5);
    assert.equal(runHighDebt.fivePillarsData.balance_sheet.is_net_cash, false);

    // ROE must be identical (debt change does not directly affect TTM NI / Avg Equity)
    assert.equal(runLowDebt.fivePillarsData.profitability.roe_pct, runHighDebt.fivePillarsData.profitability.roe_pct);

    // ROIC must differ because Invested Capital differs:
    // Higher debt => Higher Invested Capital => Lower ROIC
    const roicLow = runLowDebt.fivePillarsData.profitability.roic_pct;
    const roicHigh = runHighDebt.fivePillarsData.profitability.roic_pct;
    assert.ok(typeof roicLow === 'number' && typeof roicHigh === 'number');
    assert.ok(roicLow > roicHigh, `Low debt ROIC (${roicLow}%) must be higher than high debt ROIC (${roicHigh}%)`);
  });

  // SECTION 44 & 45: Operating Margin period basis compatibility
  it('44 & 45. Includes same-basis peer operating margin and excludes mismatched TTM margin when target is quarterly', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_AUTO',
      company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [28236], operating_income: [398] } as any, // 398 / 28236 = 1.41% (Q2 standalone)
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    // Peer A: Same standalone quarter (Q2 2026) => eligible
    const peerA: any = {
      ticker: 'PEER_QTR',
      companyName: 'Quarter Peer Inc',
      fingerprint: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', archetype: 'corporate_standard' },
      similarityScore: 85,
      relationType: 'DIRECT_PEER',
      metrics: {
        operating_margin_pct: { metric: 'operating_margin_pct', value: 6.2, status: 'VERIFIED', period: 'Q2 2026', periodBasis: 'QUARTERLY', source: 'SEC 10-Q' },
      },
    };

    // Peer B: Another standalone quarter (Q2 2026) => eligible
    const peerB: any = {
      ticker: 'PEER_QTR2',
      companyName: 'Quarter Peer 2 Inc',
      fingerprint: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', archetype: 'corporate_standard' },
      similarityScore: 80,
      relationType: 'CLOSE_COMPARABLE',
      metrics: {
        operating_margin_pct: { metric: 'operating_margin_pct', value: -42.1, status: 'VERIFIED', period: 'Q2 2026', periodBasis: 'QUARTERLY', source: 'SEC 10-Q' },
      },
    };

    // Peer C: TTM Operating Margin => MISMATCH (must be excluded from standalone quarterly median)
    const peerTTM: any = {
      ticker: 'PEER_TTM',
      companyName: 'TTM Peer Inc',
      fingerprint: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', archetype: 'corporate_standard' },
      similarityScore: 75,
      relationType: 'CLOSE_COMPARABLE',
      metrics: {
        operating_margin_pct: { metric: 'operating_margin_pct', value: 15.0, status: 'VERIFIED', period: 'TTM 2026', periodBasis: 'TTM', source: 'SEC 10-K' },
      },
    };

    const discovery = discoverPeers(targetReport, 'TARGET_AUTO', {
      candidates: [peerA, peerB, peerTTM],
      disableFixtureFallback: true,
    });

    const opRow = discovery.benchmarkRows.find(r => r.metric_name === 'Operating Margin');
    assert.ok(opRow);
    // PeerTTM was excluded, so sample size is n=2 (peerA + peerB)
    assert.equal(opRow.peer_sample_size, 2);
    assert.equal(opRow.peer_coverage_status, 'LIMITED');
    // Median of [6.2, -42.1] is (-42.1 + 6.2) / 2 = -17.95%
    assert.equal(opRow.sector_median, '-17.95%');
  });

  // SECTION 46: LIMITED n=2 language qualification
  it('46. Displays qualified status label with (ตัวอย่างจำกัด) when peer sample is LIMITED (n=2)', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_TECH',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [1000] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
      valuation_ratios: [{ name: 'P/E (TTM)', value: 15.0 }],
    };

    const peer1: any = {
      ticker: 'PEERA',
      companyName: 'Peer A Inc',
      fingerprint: { sector: 'Technology', industry: 'Software', archetype: 'corporate_standard' },
      similarityScore: 90,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 20.0, status: 'VERIFIED', source: 'Market Feed' },
      },
    };

    const peer2: any = {
      ticker: 'PEERB',
      companyName: 'Peer B Inc',
      fingerprint: { sector: 'Technology', industry: 'Software', archetype: 'corporate_standard' },
      similarityScore: 85,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: 30.0, status: 'VERIFIED', source: 'Market Feed' },
      },
    };

    const discovery = discoverPeers(targetReport, 'TARGET_TECH', { candidates: [peer1, peer2], disableFixtureFallback: true });
    const peRow = discovery.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.ok(peRow);
    assert.equal(peRow.peer_sample_size, 2);
    assert.equal(peRow.peer_coverage_status, 'LIMITED');
    // When target (15x) < median (25x), label must explicitly disclose limited sample
    assert.match(peRow.status_label_th || '', /ตัวอย่างจำกัด/);
  });

  // SECTION 47 & 48: Pillar 2 / Pillar 5 ROIC Narrative Consistency
  it('47. Does not claim ROIC is below peer median when peer ROIC coverage is insufficient and Pillar 5 fell back', () => {
    const reportNoPeerRoic: Partial<ReportData> = {
      ticker: 'TEST_NO_PEER_ROIC',
      company_profile: { sector: 'Industrials', industry: 'Machinery' } as any,
      sec_verification: {
        is_sec_verified: true,
        sec_period_statements: [
          { period: 'Q2 2025', total_equity: 10000, total_debt: 2000, cash: 1000, short_term_investments: 0 },
          { period: 'Q3 2025', operating_income: 150, income_before_tax: 140, income_tax_expense: 28 },
          { period: 'Q4 2025', operating_income: 150, income_before_tax: 140, income_tax_expense: 28 },
          { period: 'Q1 2026', operating_income: 150, income_before_tax: 140, income_tax_expense: 28 },
          { period: 'Q2 2026', operating_income: 150, income_before_tax: 140, income_tax_expense: 28, total_equity: 11000, total_debt: 2000, cash: 1000, short_term_investments: 0 },
        ],
      } as any,
      financial_statements: {
        periods: ['Q2 2025', 'Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
        income_statement: {
          revenue: [5000, 5000, 5000, 5000, 5000],
          operating_income: [150, 150, 150, 150, 150],
          operating_margin_pct: [3.0, 3.0, 3.0, 3.0, 3.0],
        } as any,
        balance_sheet: { total_equity: [10000, 10200, 10500, 10800, 11000], total_debt: [2000, 2000, 2000, 2000, 2000], cash_and_equivalents: [1000, 1000, 1000, 1000, 1000] } as any,
        cash_flow: {} as any,
      } as any,
    };

    // Candidates have verified operating margin, but NO verified 4-quarter ROIC
    const peer1: any = {
      ticker: 'PEERA',
      companyName: 'Peer A Inc',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 85,
      relationType: 'DIRECT_PEER',
      metrics: {
        operating_margin_pct: { metric: 'operating_margin_pct', value: 8.0, status: 'VERIFIED', period: 'Q2 2026', source: 'SEC 10-Q' },
      },
    };
    const peer2: any = {
      ticker: 'PEERB',
      companyName: 'Peer B Inc',
      fingerprint: { sector: 'Industrials', industry: 'Machinery', archetype: 'corporate_standard' },
      similarityScore: 80,
      relationType: 'CLOSE_COMPARABLE',
      metrics: {
        operating_margin_pct: { metric: 'operating_margin_pct', value: 10.0, status: 'VERIFIED', period: 'Q2 2026', source: 'SEC 10-Q' },
      },
    };

    reportNoPeerRoic.peer_comparison = {
      peers: [peer1, peer2],
      industry_name: 'Machinery',
    } as any;

    const pillars = resolveAdaptiveFivePillars(reportNoPeerRoic, 'TEST_NO_PEER_ROIC');
    // Pillar 5 fell back to Operating Margin because peer ROIC is insufficient
    const p5ProfitRow = pillars.fivePillarsData.peer_matrix.find(r => r.metric_name === 'Operating Margin');
    assert.ok(p5ProfitRow, 'Pillar 5 must fall back to Operating Margin');

    // Pillar 2 verdict MUST NOT claim target ROIC is below peer median or below average
    const verdict = pillars.fivePillarsData.profitability.capital_efficiency_verdict || '';
    assert.doesNotMatch(verdict, /ต่ำกว่าเกณฑ์เฉลี่ย/, 'Must not claim below average when peer ROIC is absent');
    assert.doesNotMatch(verdict, /ต่ำกว่าค่ากลางกลุ่มคู่แข่ง/, 'Must not claim below peer median when peer ROIC is absent');
    assert.match(verdict, /TTM NOPAT \/ Average Invested Capital/, 'Must state canonical basis neutrally');
  });

  // SECTION 49: RIVN-like P/E N/M semantics when earnings are verified negative
  it('49. Displays P/E as N/M when peer has verified negative earnings, and N/A when unknown', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'TARGET_TECH',
      company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any,
      financial_statements: {
        periods: ['Q2 2026'],
        income_statement: { revenue: [2000] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    // Peer 1: Loss-making EV peer with verified negative net margin and pre_profit lifecycle (like RIVN)
    const lossMakingPeer: any = {
      ticker: 'RIVN_MOCK',
      companyName: 'Rivian Automotive Inc',
      fingerprint: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', archetype: 'corporate_standard', profitabilityState: 'pre_profit' },
      similarityScore: 92,
      relationType: 'DIRECT_PEER',
      metrics: {
        pe_trailing: { metric: 'pe_trailing', value: null, status: 'NOT_REPORTED' }, // Missing raw positive P/E
        net_margin_pct: { metric: 'net_margin_pct', value: -74.1, status: 'VERIFIED', source: 'SEC 10-Q' },
        operating_income: { metric: 'operating_income', value: -858, status: 'VERIFIED', source: 'SEC 10-Q' },
      },
    };

    const discoveryLoss = discoverPeers(targetReport, 'TARGET_TECH', { candidates: [lossMakingPeer], disableFixtureFallback: true });
    const peRowLoss = discoveryLoss.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.ok(peRowLoss);
    // Because earnings are verified negative, direct peer P/E must be N/M (Not Meaningful), NOT N/A
    assert.equal(peRowLoss.direct_peer_value, 'N/M');
    assert.match(peRowLoss.direct_peer_reason || '', /Not Meaningful/i);

    // Peer 2: Candidate with genuinely unknown earnings status (no operating facts, but verified revenue growth)
    const unknownPeer: any = {
      ticker: 'PEERU',
      companyName: 'Unknown Peer Inc',
      fingerprint: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', archetype: 'corporate_standard', profitabilityState: 'profitable' },
      similarityScore: 80,
      relationType: 'DIRECT_PEER',
      metrics: {
        revenue_growth_yoy_pct: { metric: 'revenue_growth_yoy_pct', value: 8.5, status: 'VERIFIED', source: 'SEC 10-Q' },
        pe_trailing: { metric: 'pe_trailing', value: null, status: 'NOT_REPORTED' },
      },
    };

    const discoveryUnknown = discoverPeers(targetReport, 'TARGET_TECH', { candidates: [unknownPeer], disableFixtureFallback: true });
    const peRowUnknown = discoveryUnknown.benchmarkRows.find(r => r.metric_key === 'pe_trailing');
    assert.ok(peRowUnknown);
    // Unknown earnings => stays N/A
    assert.equal(peRowUnknown.direct_peer_value, 'N/A');
  });
});
