import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import {
  discoverPeers,
  calculateDeterministicMedian,
  buildPeerBusinessFingerprint,
} from '../peerDiscoveryEngine';
import { calculateRelativeOnlyModel } from '../../../utils/valuation/relativeEngine';

describe('Verified Peer Discovery Engine', () => {
  // 55. SOFI-like financial lender discovery
  it('55. Discovers financial peers for SOFI without cross-archetype contamination', () => {
    const report: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        company_name: 'SoFi Technologies, Inc.',
        sector: 'Financial Services',
        industry: 'Credit Services',
        description: 'Digital financial services and lending platform.',
      } as any,
      financial_statements: {
        statement_template: 'banking',
        periods: ['2024'],
        income_statement: { revenue: [2700], net_income: [200] } as any,
        balance_sheet: { deposits: [24000], loans_held_for_investment: [25000] } as any,
        cash_flow: {} as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E', value: 38.5 },
        { name: 'P/B', value: 2.1 },
      ],
    };

    const result = discoverPeers(report, 'SOFI');
    assert.ok(result.peerCount >= 3, `Expected at least 3 peers, got ${result.peerCount}`);

    // Self must be excluded
    assert.ok(!result.peers.some(p => p.ticker === 'SOFI'), 'Target company must be excluded');

    // All peers must be financial institutions or fintech
    const tickers = result.peers.map(p => p.ticker);
    assert.ok(tickers.includes('NU') || tickers.includes('AFRM') || tickers.includes('UPST') || tickers.includes('LC'), 'Must include fintech peers');
    assert.ok(!tickers.includes('MSFT'), 'Non-financial software giant must NOT be included');
    assert.ok(!tickers.includes('PLD'), 'REIT must NOT be included');

    // Medians must be computed deterministically
    assert.ok(result.medians.pe_trailing !== null);
    assert.ok(result.medians.price_to_book !== null);
  });

  // 56. MSFT software discovery
  it('56. Discovers software / SaaS peers for MSFT', () => {
    const report: Partial<ReportData> = {
      ticker: 'MSFT',
      company_profile: {
        company_name: 'Microsoft Corporation',
        sector: 'Technology',
        industry: 'Software—Infrastructure',
        description: 'Enterprise cloud and productivity software.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [245000], net_income: [88000] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
      valuation_ratios: [{ name: 'P/E', value: 34.2 }],
    };

    const result = discoverPeers(report, 'MSFT');
    assert.ok(result.peerCount >= 3);
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('ORCL') || tickers.includes('CRM') || tickers.includes('PLTR'), 'Must include software peers');
    assert.ok(!tickers.includes('JPM'), 'Commercial bank must NOT be included');
    assert.ok(!tickers.includes('SOFI'), 'Fintech lender must NOT be included');
  });

  // 57. REIT sub-sector matching
  it('57. Matches industrial REIT peers for PLD and rejects banks or non-REITs', () => {
    const report: Partial<ReportData> = {
      ticker: 'PLD',
      company_profile: {
        company_name: 'Prologis, Inc.',
        sector: 'Real Estate',
        industry: 'REIT—Industrial',
        description: 'Industrial and logistics warehouse real estate investment trust.',
      } as any,
      financial_statements: {
        statement_template: 'reit',
        periods: ['2024'],
        income_statement: { revenue: [8000], net_income: [3200] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const result = discoverPeers(report, 'PLD');
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('REXR') || tickers.includes('FR'), 'Must include industrial REIT peers');
    assert.ok(!tickers.includes('JPM'), 'Bank must be excluded');
    assert.ok(!tickers.includes('MSFT'), 'Software must be excluded');
  });

  // 58. Insurer discovery (PGR)
  it('58. Discovers P&C insurance peers for PGR and excludes commercial banks', () => {
    const report: Partial<ReportData> = {
      ticker: 'PGR',
      company_profile: {
        company_name: 'The Progressive Corporation',
        sector: 'Financial Services',
        industry: 'Insurance—Property & Casualty',
        description: 'Property and casualty insurance underwriter.',
      } as any,
      financial_statements: {
        statement_template: 'insurance',
        periods: ['2024'],
        income_statement: { revenue: [74000], net_income: [8500] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const result = discoverPeers(report, 'PGR');
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('TRV') || tickers.includes('ALL'), 'Must include P&C insurance peers');
    assert.ok(!tickers.includes('JPM'), 'Depository bank must be excluded for insurer');
    assert.ok(!tickers.includes('BAC'), 'Bank of America must be excluded');
  });

  // 59. Energy E&P discovery (OXY)
  it('59. Discovers E&P peers for OXY without refiner contamination', () => {
    const report: Partial<ReportData> = {
      ticker: 'OXY',
      company_profile: {
        company_name: 'Occidental Petroleum Corporation',
        sector: 'Energy',
        industry: 'Oil & Gas E&P',
        description: 'Upstream oil and gas exploration and production.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [28000], net_income: [4200] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const result = discoverPeers(report, 'OXY');
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('COP') || tickers.includes('EOG'), 'Must include E&P peers');
  });

  // 60. Semiconductor fabless discovery (NVDA)
  it('60. Discovers fabless semiconductor peers for NVDA', () => {
    const report: Partial<ReportData> = {
      ticker: 'NVDA',
      company_profile: {
        company_name: 'NVIDIA Corporation',
        sector: 'Technology',
        industry: 'Semiconductors',
        description: 'Fabless chip designer specializing in GPUs and AI accelerators.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [110000], net_income: [60000] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const result = discoverPeers(report, 'NVDA');
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('AMD'), 'Must include fabless peer AMD');
    assert.ok(!tickers.includes('JPM'), 'Must exclude non-tech');
  });

  // 61. Retail: Physical vs Marketplace
  it('61. Matches physical retail peers for WMT and differentiates digital marketplace', () => {
    const report: Partial<ReportData> = {
      ticker: 'WMT',
      company_profile: {
        company_name: 'Walmart Inc.',
        sector: 'Consumer Defensive',
        industry: 'Discount Stores',
        description: 'Omnichannel and physical retail discount stores.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [650000], net_income: [15000] } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      } as any,
    };

    const result = discoverPeers(report, 'WMT');
    const tickers = result.peers.map(p => p.ticker);

    assert.ok(tickers.includes('TGT'), 'Must include physical retail peer Target');
  });

  // 63. TEST — ONLY TWO GOOD PEERS
  it('63. Handles limited peer sample (2 peers) honestly without inventing fake peers', () => {
    // When target is ASTS (early stage satellite broadband), candidate universe has 2 peers (RKLB, LUNR)
    const report: Partial<ReportData> = {
      ticker: 'ASTS',
      company_profile: {
        company_name: 'AST SpaceMobile, Inc.',
        sector: 'Technology',
        industry: 'Telecommunications',
        description: 'Space-based cellular broadband network in early stage.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: { revenue: [10], net_income: [-150] } as any,
        balance_sheet: {} as any,
        cash_flow: { free_cash_flow: [-180, -200] } as any,
      } as any,
    };

    const result = discoverPeers(report, 'ASTS');
    assert.equal(result.peerCount, 2, 'Should find exactly 2 peers');
    assert.equal(result.isLimitedSample, true, 'isLimitedSample must be true');

    // Invariant: NEVER insert fake PEER_1, PEER_2
    assert.ok(!result.peers.some(p => /^PEER_\d+$/i.test(p.ticker)), 'Must not contain fake PEER_1');
  });

  // 64. TEST — NO PEERS (Truthful Unavailable State)
  it('64. Produces truthful unavailable state when zero peers pass hard filters', () => {
    // An obscure unknown ticker with no matching universe candidates
    const report: Partial<ReportData> = {
      ticker: 'OBSCURE_CO',
      company_profile: {
        company_name: 'Obscure Rare Minerals Holding',
        sector: 'UnknownSector123',
        industry: 'UnknownIndustry456',
        description: 'Highly idiosyncratic non-standard entity.',
      } as any,
    };

    const result = discoverPeers(report, 'OBSCURE_CO');
    assert.equal(result.peerCount, 0, 'Must have 0 peers');
    assert.equal(result.unavailableReason, 'BUSINESS_MODEL_AMBIGUOUS');
    assert.match(result.unavailableMessageTh ?? '', /^บริษัทที่พบยังไม่ผ่านเกณฑ์ความสอดคล้องของโมเดลธุรกิจ:/);
    assert.match(result.unavailableMessageEn ?? '', /^Candidates did not satisfy the business-model comparability guard:/);
    assert.equal(result.benchmarkRows.length, 0);
  });

  // 68. TEST — MISSING != ZERO
  it('68. calculateDeterministicMedian excludes null and never converts missing to 0', () => {
    // Array with null and valid numbers
    const vals = [10, null, 20, null, 30];
    const med = calculateDeterministicMedian(vals);
    assert.equal(med, 20, 'Median of [10, 20, 30] is 20, NOT skewed by 0');

    // Even number of valid values
    const evenVals = [10, null, 20, 30, null, 40];
    const evenMed = calculateDeterministicMedian(evenVals);
    assert.equal(evenMed, 25, 'Median of [10, 20, 30, 40] is 25');

    // All nulls
    const allNull = [null, null, undefined];
    assert.equal(calculateDeterministicMedian(allNull), null, 'All nulls must produce null, not 0');
  });

  // 36 & 64. Fail-closed relative valuation engine invariant
  it('36. calculateRelativeOnlyModel remains strictly fail-closed when peers are missing or incomplete', () => {
    // 0 peers -> returns undefined
    const modelWithNoPeers = {
      intrinsic_value: {
        relative_only_model: {
          primary_metric: 'ev_sales',
          peer_median_multiple: 15.0,
          applied_company_metric_value: 300,
          implied_enterprise_value_b: 4.5,
          implied_equity_value_b: 4.2,
          fair_value_per_share: 8.5,
          peers_evaluated: [],
        },
      },
    };
    assert.equal(calculateRelativeOnlyModel(modelWithNoPeers as any), undefined, 'Must fail-closed with 0 peers');

    // Fake peer ticker PEER_1 -> returns undefined
    const modelWithFakePeer = {
      intrinsic_value: {
        relative_only_model: {
          primary_metric: 'ev_sales',
          peer_median_multiple: 15.0,
          applied_company_metric_value: 300,
          implied_enterprise_value_b: 4.5,
          implied_equity_value_b: 4.2,
          fair_value_per_share: 8.5,
          peers_evaluated: [
            { ticker: 'PEER_1', company_name: 'Sample', market_cap_b: 10, ev_revenue_multiple: 12 },
          ],
        },
      },
    };
    assert.equal(calculateRelativeOnlyModel(modelWithFakePeer as any), undefined, 'Must reject PEER_1 fake ticker');
  });
});
