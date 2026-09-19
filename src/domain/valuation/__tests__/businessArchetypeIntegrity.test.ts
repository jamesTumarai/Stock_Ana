import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData, PeerCompanyItem } from '../../../types';
import {
  resolveBusinessClassification,
  resolveBusinessArchetype,
  getMetricInterpretationContext,
} from '../../financialMetricContext';
import { detectValuationModel } from '../../../utils/valuation/modelSelector';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import {
  discoverPeers,
  buildPeerBusinessFingerprint,
  calculatePeerSimilarity,
} from '../peerDiscoveryEngine';

describe('Business Archetype Integrity & Dynamic Peer Discovery', () => {
  // 46. TEST — TESLA-LIKE AUTO MANUFACTURER
  it('46. Classifies TSLA-like automaker as industrial/automotive, suppresses Financial Sector Guard', () => {
    const tslaReport: Partial<ReportData> = {
      ticker: 'TSLA',
      company_profile: {
        company_name: 'Tesla, Inc.',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        description: 'Designs, manufactures, and sells electric vehicles, energy generation and storage systems, and offers financial services through vehicle financing and leasing.',
      } as any,
      financial_statements: {
        periods: ['2024'],
        income_statement: {
          revenue: [96773],
          net_income: [7091],
          operating_income: [7077],
          yoy_revenue_growth_pct: [0.9],
        } as any,
        balance_sheet: {
          total_cash: [33648],
          total_debt: [13411],
        } as any,
        cash_flow: {
          free_cash_flow: [3583],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E', value: 75.0 },
      ],
    };

    const classification = resolveBusinessClassification(tslaReport, 'TSLA');
    assert.equal(classification.primaryArchetype, 'industrial_manufacturing', 'Primary archetype must be industrial_manufacturing');
    assert.ok(classification.secondaryBusinessLines.includes('vehicle_financing'), 'Captive finance must be secondary business');
    assert.equal(classification.confidence, 'HIGH');

    // Five Pillars resolution
    const fivePillars = resolveAdaptiveFivePillars(tslaReport, 'TSLA');
    assert.equal(fivePillars.archetype, 'industrial_manufacturing');
    assert.equal(fivePillars.pillars.profitability.isGuarded, false, 'Financial Sector Guard must be OFF');
    assert.ok(!fivePillars.pillars.solvency.titleEn.includes('Capital & Funding') && fivePillars.pillars.solvency.titleEn.includes('Balance Sheet'), 'Must use Balance Sheet & Solvency, not Capital & Funding');
    assert.ok(!fivePillars.pillars.profitability.metrics.some(m => m.key === 'nim'), 'NIM must not be present');
    assert.ok(!fivePillars.pillars.solvency.metrics.some(m => m.key === 'deposits'), 'Deposits must not be present');
  });

  // 47. TEST — AUTO COMPANY WITH CAPTIVE FINANCE ARM
  it('47. Large automaker with captive finance subsidiary remains operating archetype', () => {
    const autoReport: Partial<ReportData> = {
      ticker: 'CAR_CO',
      company_profile: {
        company_name: 'Global Auto Holdings',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        description: 'Worldwide automotive manufacturer operating vehicle assembly plants and captive financing credit arm.',
      } as any,
      financial_statements: {
        statement_template: 'standard',
        periods: ['2024'],
      } as any,
    };

    const classification = resolveBusinessClassification(autoReport, 'CAR_CO');
    assert.equal(classification.primaryArchetype, 'industrial_manufacturing');
    assert.ok(classification.secondaryBusinessLines.includes('vehicle_financing'));
    assert.notEqual(classification.primaryArchetype, 'bank');
    assert.notEqual(classification.primaryArchetype, 'lender');
  });

  // 48. TEST — ACTUAL FINTECH
  it('48. Resolves actual fintech (SOFI) with Financial Sector Guard active', () => {
    const fintechReport: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        company_name: 'SoFi Technologies, Inc.',
        sector: 'Financial Services',
        industry: 'Credit Services',
        description: 'Digital financial services company providing lending, deposits, and financial products.',
      } as any,
      financial_statements: {
        statement_template: 'banking',
        periods: ['2024'],
      } as any,
    };

    const classification = resolveBusinessClassification(fintechReport, 'SOFI');
    assert.equal(classification.primaryArchetype, 'fintech');

    const fivePillars = resolveAdaptiveFivePillars(fintechReport, 'SOFI');
    assert.equal(fivePillars.pillars.profitability.isGuarded, true, 'Financial Sector Guard must be ON for fintech');
  });

  // 49. TEST — RETAILER WITH CREDIT CARD PROGRAM
  it('49. Retailer with credit card program remains retail archetype', () => {
    const retailerReport: Partial<ReportData> = {
      ticker: 'TGT_TEST',
      company_profile: {
        company_name: 'Big Box Retailer',
        sector: 'Consumer Defensive',
        industry: 'Discount Stores',
        description: 'Operates retail stores and co-branded credit card rewards program for shoppers.',
      } as any,
      financial_statements: {
        statement_template: 'standard',
      } as any,
    };

    const classification = resolveBusinessClassification(retailerReport, 'TGT_TEST');
    assert.equal(classification.primaryArchetype, 'retail');
    assert.ok(classification.secondaryBusinessLines.includes('credit_card_program'));
    assert.notEqual(classification.primaryArchetype, 'bank');
  });

  // 50. TEST — TECHNOLOGY COMPANY WITH PAYMENTS PRODUCT
  it('50. Software company with payments feature remains software/platform archetype', () => {
    const techReport: Partial<ReportData> = {
      ticker: 'TECH_PAY',
      company_profile: {
        company_name: 'Cloud Platform Corp',
        sector: 'Technology',
        industry: 'Software—Infrastructure',
        description: 'Enterprise cloud software provider with embedded payment processing services for merchants.',
      } as any,
    };

    const classification = resolveBusinessClassification(techReport, 'TECH_PAY');
    assert.equal(classification.primaryArchetype, 'saas_software');
    assert.ok(classification.secondaryBusinessLines.includes('merchant_payments'));
  });

  // 51. TEST — DYNAMIC PEER DISCOVERY
  it('51. Discovers peers dynamically when target ticker is not in static universe', () => {
    // Synthetic automotive target not in static universe
    const dynamicTarget: Partial<ReportData> = {
      ticker: 'DYNAMIC_AUTO',
      company_profile: {
        company_name: 'Dynamic EV Mobility Inc.',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        description: 'Manufacturer of electric passenger vehicles.',
      } as any,
      peer_comparison: {
        as_of_date: '2026-03-01',
        peers: [
          {
            ticker: 'COMP_A',
            company_name: 'EV Peer A',
            industry: 'Auto Manufacturers',
            pe_trailing: 30.0,
            pe_forward: 22.0,
            revenue_growth_yoy_pct: 25.0,
            gross_margin_pct: 20.0,
            net_margin_pct: 8.0,
            ev_ebitda: 18.0,
          },
          {
            ticker: 'COMP_B',
            company_name: 'EV Peer B',
            industry: 'Auto Manufacturers',
            pe_trailing: 35.0,
            pe_forward: 26.0,
            revenue_growth_yoy_pct: 30.0,
            gross_margin_pct: 22.0,
            net_margin_pct: 10.0,
            ev_ebitda: 20.0,
          },
          {
            ticker: 'COMP_C',
            company_name: 'EV Peer C',
            industry: 'Auto Manufacturers',
            pe_trailing: 25.0,
            pe_forward: 18.0,
            revenue_growth_yoy_pct: 15.0,
            gross_margin_pct: 18.0,
            net_margin_pct: 6.0,
            ev_ebitda: 15.0,
          },
        ],
      },
    };

    const result = discoverPeers(dynamicTarget, 'DYNAMIC_AUTO', { disableFixtureFallback: true });
    assert.equal(result.peerCount, 3, 'Must discover all 3 dynamic peers');
    assert.ok(result.peers.some(p => p.ticker === 'COMP_A'));
    assert.ok(result.peers.some(p => p.ticker === 'COMP_B'));
    assert.ok(result.peers.some(p => p.ticker === 'COMP_C'));
    assert.equal(result.medians.pe_trailing, 30.0, 'Median of [25, 30, 35] is 30.0');
  });

  // 52. TEST — UNKNOWN NEW IPO
  it('52. Synthetic new IPO ticker forms candidate universe without code changes', () => {
    const ipoReport: Partial<ReportData> = {
      ticker: 'NEW_IPO_2026',
      company_profile: {
        company_name: 'New Space Telecom IPO',
        sector: 'Technology',
        industry: 'Telecommunications',
        description: 'New satellite communication IPO in pre-profit stage.',
      } as any,
    };

    const dynamicCandidates: PeerCompanyItem[] = [
      {
        ticker: 'SAT_1',
        company_name: 'Satellite One',
        industry: 'Telecommunications',
        revenue_growth_yoy_pct: 80.0,
        ev_ebitda: 15.0,
      },
      {
        ticker: 'SAT_2',
        company_name: 'Satellite Two',
        industry: 'Telecommunications',
        revenue_growth_yoy_pct: 95.0,
        ev_ebitda: 18.0,
      },
    ];

    const result = discoverPeers(ipoReport, 'NEW_IPO_2026', { candidates: dynamicCandidates });
    assert.equal(result.peerCount, 2);
    assert.equal(result.isLimitedSample, true);
    assert.equal(result.peers[0].ticker, 'SAT_1');
  });

  // 54. TEST — PEER BUSINESS QUALITY
  it('54. Automotive target admits automaker and rejects bank and semiconductor candidates', () => {
    const autoReport: Partial<ReportData> = {
      ticker: 'AUTO_X',
      company_profile: {
        company_name: 'Auto Motors',
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
      } as any,
    };

    const candidates: PeerCompanyItem[] = [
      { ticker: 'AUTO_PEER', company_name: 'Automaker Peer', industry: 'Auto Manufacturers', sector: 'Consumer Cyclical', pe_trailing: 15.0 },
      { ticker: 'BIG_BANK', company_name: 'Megabank Inc', industry: 'Banks—Diversified', sector: 'Financial Services', pe_trailing: 10.0 },
      { ticker: 'CHIP_MAKER', company_name: 'Semiconductor Fab', industry: 'Semiconductors', sector: 'Technology', pe_trailing: 30.0 },
    ];

    const result = discoverPeers(autoReport, 'AUTO_X', { candidates });
    assert.equal(result.peerCount, 1, 'Only the automaker should be admitted');
    assert.equal(result.peers[0].ticker, 'AUTO_PEER');
  });

  // 55. TEST — SEMICONDUCTOR SUBTYPE
  it('55. Fabless target does not treat foundry candidate as direct peer', () => {
    const fablessFingerprint = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Technology', industry: 'Semiconductors', description: 'Fabless chip designer specializing in GPUs' } as any,
    }, 'FABLESS');

    const foundryFingerprint = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Technology', industry: 'Semiconductors', description: 'Pure-play foundry wafer manufacturing' } as any,
    }, 'FOUNDRY');

    const sim = calculatePeerSimilarity(fablessFingerprint, foundryFingerprint);
    assert.notEqual(sim.relationType, 'DIRECT_PEER', 'Foundry cannot be direct peer of fabless');
  });

  // 56. TEST — REIT SUBSECTOR
  it('56. Industrial REIT rejects office REIT as direct peer', () => {
    const industrialReit = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Real Estate', industry: 'REIT—Industrial', description: 'Logistics warehouses' } as any,
    }, 'IND_REIT');

    const officeReit = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Real Estate', industry: 'REIT—Office', description: 'Commercial office towers' } as any,
    }, 'OFF_REIT');

    const sim = calculatePeerSimilarity(industrialReit, officeReit);
    assert.notEqual(sim.relationType, 'DIRECT_PEER', 'Office REIT cannot be direct peer of industrial REIT');
  });

  // 57. TEST — BANK VS INSURER
  it('57. Bank and Insurer reject each other as direct peers under hard filter', () => {
    const bank = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Financial Services', industry: 'Banks—Diversified' } as any,
      financial_statements: { statement_template: 'banking' } as any,
    }, 'BANK_CO');

    const insurer = buildPeerBusinessFingerprint({
      company_profile: { sector: 'Financial Services', industry: 'Insurance—Property & Casualty' } as any,
      financial_statements: { statement_template: 'insurance' } as any,
    }, 'INS_CO');

    assert.equal(bank.archetype, 'bank');
    assert.equal(insurer.archetype, 'insurer');

    // Hard filter check
    const result = discoverPeers({
      company_profile: { sector: 'Financial Services', industry: 'Banks—Diversified' } as any,
      financial_statements: { statement_template: 'banking' } as any,
    }, 'BANK_CO', {
      candidates: [
        { ticker: 'INS_CO', company_name: 'Insurer Co', sector: 'Financial Services', industry: 'Insurance—Property & Casualty' },
      ],
      disableFixtureFallback: true,
    });
    assert.equal(result.peerCount, 0, 'Insurer must be rejected for bank');
  });

  // 58. TEST — ONLY BROADER REFERENCES
  it('58. Shows Close/Broader Comparables when no direct peer is available, without failing', () => {
    const target: Partial<ReportData> = {
      ticker: 'NICHE_CO',
      company_profile: {
        company_name: 'Niche Tech',
        sector: 'Technology',
        industry: 'Computer Hardware',
      } as any,
    };

    // Candidates in broader technology sector
    const candidates: PeerCompanyItem[] = [
      { ticker: 'BROAD_1', company_name: 'Tech Giant 1', sector: 'Technology', industry: 'Software—Infrastructure', pe_trailing: 25.0 },
      { ticker: 'BROAD_2', company_name: 'Tech Giant 2', sector: 'Technology', industry: 'Semiconductors', pe_trailing: 28.0 },
    ];

    const result = discoverPeers(target, 'NICHE_CO', { candidates });
    assert.ok(result.peerCount > 0, 'Must not fail the section when broader comparables exist');
    assert.equal(result.benchmarkRows.length > 0, true, 'Benchmark rows must be generated');
  });

  // 59. TEST — NO VALID PEERS (Truthful unavailable state)
  it('59. Produces truthful unavailable state when zero peers match', () => {
    const target: Partial<ReportData> = {
      ticker: 'ALIEN_CO',
      company_profile: {
        company_name: 'Alien Tech',
        sector: 'Unknown',
        industry: 'Unknown',
      } as any,
    };

    const result = discoverPeers(target, 'ALIEN_CO', { candidates: [], disableFixtureFallback: true });
    assert.equal(result.peerCount, 0);
    assert.equal(result.unavailableReason, 'NO_CANDIDATES');
    assert.equal(result.benchmarkRows.length, 0);
  });

  // 60. TEST — TREASURY MISSING
  it('60. Treasury yield remains undefined when unavailable, NEVER falls back to 4.25%', () => {
    const reportWithoutTreasury: Partial<ReportData> = {
      ticker: 'CORP_A',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      financial_statements: {
        periods: ['2024'],
        cash_flow: { free_cash_flow: [500] } as any,
        income_statement: { net_income: [400] } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/FCF', value: 20.0 }, // FCF Yield = 5%
      ],
      five_pillars: {
        // No treasury_10yr_yield_pct provided
      } as any,
    };

    const result = resolveAdaptiveFivePillars(reportWithoutTreasury, 'CORP_A');
    assert.equal(result.fivePillarsData.yields?.treasury_10yr_yield_pct, undefined, 'Treasury yield must be undefined');
    assert.notEqual(result.fivePillarsData.yields?.treasury_10yr_yield_pct, 4.25, 'Must NEVER fall back to 4.25%');
    assert.equal(result.fivePillarsData.yields?.yield_spread_vs_treasury, undefined, 'Yield spread must be undefined without Treasury rate');
  });

  // 61. TEST — TREASURY VERIFIED
  it('61. Treasury yield displays verified value, as-of date, and source', () => {
    const reportWithTreasury: Partial<ReportData> = {
      ticker: 'CORP_B',
      company_profile: { sector: 'Technology', industry: 'Software' } as any,
      valuation_ratios: [{ name: 'P/E', value: 20.0 }],
      five_pillars: {
        yields: {
          treasury_10yr_yield_pct: 4.45,
          treasury_as_of_date: '2026-03-15',
          treasury_source: 'Federal Reserve H.15',
        },
      } as any,
    };

    const result = resolveAdaptiveFivePillars(reportWithTreasury, 'CORP_B');
    assert.equal(result.fivePillarsData.yields?.treasury_10yr_yield_pct, 4.45);
    assert.equal(result.fivePillarsData.yields?.treasury_as_of_date, '2026-03-15');
    assert.equal(result.fivePillarsData.yields?.treasury_source, 'Federal Reserve H.15');
    assert.equal(result.fivePillarsData.yields?.yield_spread_vs_treasury, 0.55); // Earnings yield (5.0%) - 4.45% = 0.55%
  });

  // 62. TEST — PEG CALCULATION (Earnings Growth vs Revenue Growth)
  it('62. PEG is unavailable when EPS growth is null, even if Revenue Growth is available', () => {
    const reportWithRevOnly: Partial<ReportData> = {
      ticker: 'GROWTH_CO',
      valuation_ratios: [{ name: 'P/E', value: 40.0 }],
      financial_statements: {
        periods: ['2024'],
        income_statement: {
          yoy_revenue_growth_pct: [30.0],
          // No EPS growth!
        } as any,
      } as any,
    };

    const res1 = resolveAdaptiveFivePillars(reportWithRevOnly, 'GROWTH_CO');
    assert.equal(res1.fivePillarsData.growth?.peg_ratio, undefined, 'PEG must be undefined without EPS growth');
    assert.notEqual(res1.fivePillarsData.growth?.peg_ratio, 1.33, 'Must NOT compute PEG from revenue growth');

    // When verified EPS growth is provided
    const reportWithEpsGrowth: Partial<ReportData> = {
      ticker: 'GROWTH_CO',
      valuation_ratios: [{ name: 'P/E', value: 40.0 }],
      financial_statements: {
        periods: ['2024'],
        income_statement: {
          yoy_revenue_growth_pct: [30.0],
          yoy_eps_growth_pct: [20.0],
        } as any,
      } as any,
    };

    const res2 = resolveAdaptiveFivePillars(reportWithEpsGrowth, 'GROWTH_CO');
    assert.equal(res2.fivePillarsData.growth?.peg_ratio, 2.0, 'PEG = 40 / 20 = 2.0x');
  });

  // 63. TEST — ARCHETYPE CONSISTENCY
  it('63. Report consumers share identical business classification without divergence', () => {
    const sampleReport: Partial<ReportData> = {
      ticker: 'UNIFIED_CO',
      company_profile: {
        company_name: 'Unified Corp',
        sector: 'Industrials',
        industry: 'Aerospace & Defense',
      } as any,
    };

    const classification = resolveBusinessClassification(sampleReport, 'UNIFIED_CO');
    const archetype = resolveBusinessArchetype(sampleReport, 'UNIFIED_CO');
    const model = detectValuationModel(sampleReport, 'UNIFIED_CO');
    const fivePillars = resolveAdaptiveFivePillars(sampleReport, 'UNIFIED_CO');
    const peerResult = discoverPeers(sampleReport, 'UNIFIED_CO');

    assert.equal(classification.primaryArchetype, archetype);
    assert.equal(fivePillars.archetype, archetype);
    assert.equal(peerResult.targetFingerprint.archetype, archetype);
  });

  // 64. TEST — WEAK KEYWORD CONTAMINATION
  it('64. Operating company with "financial services" in narrative text is NOT classified as financial', () => {
    const narrativeReport: Partial<ReportData> = {
      ticker: 'MFG_CO',
      company_profile: {
        company_name: 'Industrial Machinery Corp',
        sector: 'Industrials',
        industry: 'Specialty Industrial Machinery',
        description: 'Manufacturer of industrial robotic arms. Also offers financial services and leasing options for industrial equipment buyers.',
      } as any,
    };

    const classification = resolveBusinessClassification(narrativeReport, 'MFG_CO');
    assert.equal(classification.primaryArchetype, 'industrial_manufacturing');
    assert.notEqual(classification.primaryArchetype, 'bank');
    assert.notEqual(classification.primaryArchetype, 'lender');
    assert.notEqual(classification.primaryArchetype, 'fintech');
  });

  // 65. TEST — STRONG FINANCIAL EVIDENCE
  it('65. Company with official banking sector and statement template resolves to bank', () => {
    const bankReport: Partial<ReportData> = {
      ticker: 'LEGACY_BANK',
      company_profile: {
        company_name: 'First National Bank',
        sector: 'Financial Services',
        industry: 'Banks—Regional',
        description: 'Commercial and retail banking services.',
      } as any,
      financial_statements: {
        statement_template: 'banking',
      } as any,
    };

    const classification = resolveBusinessClassification(bankReport, 'LEGACY_BANK');
    assert.equal(classification.primaryArchetype, 'bank');
  });
});
