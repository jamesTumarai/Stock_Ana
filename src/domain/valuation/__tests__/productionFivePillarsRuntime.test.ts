import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ReportData } from '../../../types.js';
import { resolveBusinessClassification } from '../../financialMetricContext.js';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver.js';
import { discoverPeers, discoverPeerCandidates, calculateDeterministicMedian } from '../peerDiscoveryEngine.js';

describe('Production Five Pillars Runtime & Archetype Integrity', () => {
  // Production TSLA shape matching actual /api/analyze output where sector/industry were not in overview
  const actualProductionTslaReport: Partial<ReportData> = {
    ticker: 'TSLA',
    company_profile: {
      overview: {
        symbol: 'TSLA',
        company_name: 'Tesla, Inc.',
        description: 'Tesla, Inc. designs, develops, manufactures, sells, and leases electric vehicles, energy generation and storage systems, and offers services related to its products. The company produces and sells... vehicle financing and insurance services...',
      } as any,
    },
    peer_comparison: {
      industry_name: 'Auto Manufacturers',
      peers: [],
    },
    financial_statements: {
      currency: 'USD',
      statement_template: 'banking' as any, // AI hallucinated banking template due to "financing and insurance" in description
      periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
      income_statement: {
        revenue: [21301, 25500, 25182, 25167],
        operating_income: [1171, 1605, 2717, 1583],
        net_income: [1129, 1478, 2167, 2500],
        eps_diluted: [0.34, 0.42, 0.62, 0.71],
        gross_profit: [3696, 4578, 4997, 4200],
        gross_margin_pct: [17.3, 18.0, 19.8, 16.7],
        operating_margin_pct: [5.5, 6.3, 10.8, 6.3],
        net_margin_pct: [5.3, 5.8, 8.6, 9.9],
        yoy_revenue_growth_pct: [-8.7, 2.3, 7.8, 26.0],
      } as any,
      balance_sheet: {
        cash_and_equivalents: [11500, 12000, 13000, 14500],
        short_term_investments: [15000, 16000, 17000, 18000],
        total_debt: [5000, 4800, 5200, 5000],
        total_equity: [65000, 67000, 70000, 75000],
        total_assets: [105000, 110000, 115000, 120000],
      } as any,
      cash_flow: {
        operating_cash_flow: [2500, 3000, 3500, 4000],
        capex: [1500, 1600, 1700, 1800],
        free_cash_flow: [1000, 1400, 1800, 2200],
      } as any,
    },
    valuation_ratios: [
      { name: 'P/E (Trailing)', value: 85.0 } as any,
      { name: 'P/FCF', value: 75.0 } as any,
    ],
  };

  it('1. TSLA production report must classify as industrial_manufacturing despite missing sector/industry and contradictory banking template', () => {
    const classification = resolveBusinessClassification(actualProductionTslaReport, 'TSLA');
    assert.equal(classification.primaryArchetype, 'industrial_manufacturing');
    assert.equal(classification.evidence.conflictingSignals.length > 0, true, 'Should flag statement_template conflict');
  });

  it('2. TSLA Five Pillars must NOT activate Financial Sector Guard and must provide archetype in fivePillarsData', () => {
    const resolved = resolveAdaptiveFivePillars(actualProductionTslaReport, 'TSLA');
    assert.equal(resolved.archetype, 'industrial_manufacturing');
    assert.equal(resolved.fivePillarsData.archetype, 'industrial_manufacturing', 'fivePillarsData must contain archetype');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, undefined, 'FCF must not be guarded for TSLA');
    assert.equal(resolved.fivePillarsData.profitability.gross_margin_pct !== undefined, true, 'Gross margin must be present');
  });

  it('3. EPS Growth fails closed when only adjacent quarters exist without a prior-year comparable', () => {
    const resolved = resolveAdaptiveFivePillars(actualProductionTslaReport, 'TSLA');
    assert.equal(resolved.fivePillarsData.growth.eps_growth_yoy_pct, undefined);
    assert.equal(resolved.fivePillarsData.growth.resolved_metrics?.eps_growth_yoy.status, 'INSUFFICIENT_HISTORY');
    assert.equal(resolved.fivePillarsData.growth.peg_ratio, undefined, 'PEG must not use adjacent-quarter EPS as YoY growth');
  });

  it('4. ROIC must be deterministically derived from operating income, equity, debt, and cash', () => {
    const resolved = resolveAdaptiveFivePillars(actualProductionTslaReport, 'TSLA');
    assert.ok(resolved.fivePillarsData.profitability.roic_pct !== undefined, 'ROIC must be derived deterministically');
    assert.ok(Number.isFinite(resolved.fivePillarsData.profitability.roic_pct));
  });

  it('5. ROE and ROA must use independent denominators and never accidentally be identical', () => {
    const resolved = resolveAdaptiveFivePillars(actualProductionTslaReport, 'TSLA');
    const roe = resolved.fivePillarsData.profitability.roe_pct;
    const roa = resolved.fivePillarsData.profitability.roa_pct;
    assert.ok(roe !== undefined, 'ROE must be defined');
    assert.ok(roa !== undefined, 'ROA must be defined');
    assert.notEqual(roe, roa, 'ROE (netInc/equity) and ROA (netInc/assets) must not share denominator');
  });

  it('6. Stale financial five_pillars in report JSON must NOT override resolved operating archetype', () => {
    const staleReport: Partial<ReportData> = {
      ...actualProductionTslaReport,
      five_pillars: {
        archetype: 'bank',
        yields: {
          is_fcf_guarded: true,
          fcf_guard_reason: 'Deposit institutions exclude corporate FCF',
        },
        balance_sheet: {
          capital_and_funding: 'Deposit liabilities are raw material',
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(staleReport, 'TSLA');
    assert.equal(resolved.archetype, 'industrial_manufacturing');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, undefined, 'Stale financial guard must not persist');
    assert.equal(resolved.pillars.solvency.titleTh.includes('เงินกองทุน'), false, 'Must not use financial capital wording');
  });

  it('7. AI report sector says Financial Services but verified industry says Auto Manufacturers -> trusted industry wins', () => {
    const wrongSectorReport: Partial<ReportData> = {
      ticker: 'EV_MAKER',
      company_profile: {
        sector: 'Financial Services', // AI error
        industry: 'Auto Manufacturers', // Verified industry
        description: 'Manufacturer of electric vehicles and battery packs',
      } as any,
      financial_statements: actualProductionTslaReport.financial_statements,
    };
    const classification = resolveBusinessClassification(wrongSectorReport, 'EV_MAKER');
    assert.equal(classification.primaryArchetype, 'industrial_manufacturing');
  });

  it('8. True financial company (SOFI) must keep Financial Sector Guard ON', () => {
    const sofiReport: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Credit Services',
        description: 'Digital financial services platform providing student loan refinancing, personal loans, mortgages, deposits, and investment services.',
      } as any,
      financial_statements: {
        statement_template: 'banking',
        periods: ['Q3 2024', 'Q4 2024'],
        income_statement: {
          net_interest_income: [350, 390],
          non_interest_income: [220, 240],
          net_income: [30, 45],
        } as any,
        balance_sheet: {
          total_assets: [30000, 32000],
          total_equity: [5500, 5800],
          deposits: [22000, 24000],
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(sofiReport, 'SOFI');
    assert.equal(resolved.archetype, 'fintech');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, true, 'FCF must be guarded for true financial company');
    assert.ok(resolved.pillars.solvency.titleEn.includes('Capital'), 'Pillar 3 must be Capital & Funding');
  });

  it('9. Quarter YoY EPS growth keeps period provenance and does not pair with trailing P/E', () => {
    const epsReport: Partial<ReportData> = {
      ticker: 'GROWTH_CO',
      financial_statements: {
        periods: ['Q2 2025', 'Q2 2026'],
        income_statement: {
          revenue: [1000, 1200],
          eps_diluted: [0.25, 0.40],
          net_income: [25, 40],
        } as any,
        balance_sheet: {
          total_equity: [500, 600],
          total_assets: [1000, 1200],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 30.0 } as any,
      ],
    };
    const resolved = resolveAdaptiveFivePillars(epsReport, 'GROWTH_CO');
    // Growth = (0.40 - 0.25) / 0.25 * 100 = +60%
    assert.equal(resolved.fivePillarsData.growth.eps_growth_yoy_pct, 60);
    assert.equal(resolved.fivePillarsData.growth.resolved_metrics?.eps_growth_yoy.basis, 'QUARTER_YOY');
    assert.equal(resolved.fivePillarsData.growth.peg_ratio, undefined);
    assert.equal(resolved.fivePillarsData.growth.peg_status, 'BASIS_MISMATCH');
  });

  it('10. EPS Turnaround (loss to profit) must not produce misleading PEG input', () => {
    const turnaroundReport: Partial<ReportData> = {
      ticker: 'TURNAROUND_CO',
      financial_statements: {
        periods: ['Q1 2025', 'Q1 2026'],
        income_statement: {
          revenue: [500, 600],
          eps_diluted: [-0.20, 0.10], // turned from loss to profit
          net_income: [-20, 10],
        } as any,
        balance_sheet: {
          total_equity: [300, 350],
          total_assets: [700, 800],
        } as any,
      } as any,
      valuation_ratios: [
        { name: 'P/E (Trailing)', value: 40.0 } as any,
      ],
    };
    const resolved = resolveAdaptiveFivePillars(turnaroundReport, 'TURNAROUND_CO');
    assert.equal(resolved.fivePillarsData.growth.eps_growth_yoy_pct, undefined, 'Percentage growth undefined for loss-to-profit');
    assert.ok(resolved.fivePillarsData.growth.eps_growth_basis?.includes('Loss to Profit'));
    assert.equal(resolved.fivePillarsData.growth.peg_ratio, undefined, 'PEG must be unavailable on turnaround');
  });

  it('11. PEG eligibility: PEG unavailable when EPS growth is missing, available when valid', () => {
    // Missing EPS growth
    const noEpsReport: Partial<ReportData> = {
      ticker: 'NO_EPS_CO',
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          revenue: [1000],
          yoy_revenue_growth_pct: [30.0],
          net_income: [50],
        } as any,
        balance_sheet: {
          total_equity: [500],
          total_assets: [1000],
        } as any,
      } as any,
      valuation_ratios: [{ name: 'P/E (Trailing)', value: 40.0 } as any],
    };
    const resNoEps = resolveAdaptiveFivePillars(noEpsReport, 'NO_EPS_CO');
    assert.equal(resNoEps.fivePillarsData.growth.peg_ratio, undefined, 'PEG must not use revenue growth');

    // Valid EPS growth = 20% -> PEG = 2.0x
    const validEpsReport: Partial<ReportData> = {
      ...noEpsReport,
      key_indicators: {
        growth: {
          yoy_eps_growth_pct: 20.0,
        },
      } as any,
    };
    const resValid = resolveAdaptiveFivePillars(validEpsReport, 'NO_EPS_CO');
    assert.equal(resValid.fivePillarsData.growth.peg_ratio, 2.0);
  });

  it('12. ROIC deterministic derivation from documented formula', () => {
    const roicReport: Partial<ReportData> = {
      ticker: 'ROIC_CO',
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          operating_income: [1000],
          effective_tax_rate_pct: [21.0],
          net_income: [700],
        } as any,
        balance_sheet: {
          total_equity: [4000],
          total_debt: [1500],
          cash_and_equivalents: [500],
          total_assets: [8000],
        } as any,
      } as any,
    };
    // NOPAT = 1000 * (1 - 0.21) = 790
    // Invested Capital = 4000 + 1500 - 500 = 5000
    // ROIC = 790 / 5000 * 100 = 15.8%
    const resolved = resolveAdaptiveFivePillars(roicReport, 'ROIC_CO');
    assert.equal(resolved.fivePillarsData.profitability.roic_pct, 15.8);
    assert.ok(resolved.fivePillarsData.profitability.roic_formula?.includes('NOPAT / Invested Capital') || resolved.fivePillarsData.profitability.roic_formula?.includes('Operating Income'));
  });

  it('13. ROIC input gap completion: recovers Debt then calculates ROIC', () => {
    const missingDebtReport: Partial<ReportData> = {
      ticker: 'GAP_CO',
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          operating_income: [500],
          net_income: [350],
        } as any,
        balance_sheet: {
          total_equity: [2000],
          // total_debt is missing
          cash_and_equivalents: [200],
          total_assets: [3000],
        } as any,
      } as any,
    };
    const beforeGap = resolveAdaptiveFivePillars(missingDebtReport, 'GAP_CO');
    assert.equal(beforeGap.fivePillarsData.profitability.roic_pct, undefined, 'ROIC undefined when debt missing');

    // Supply Debt via Data Completion
    missingDebtReport.financial_statements!.balance_sheet.total_debt = [500];
    const afterGap = resolveAdaptiveFivePillars(missingDebtReport, 'GAP_CO');
    // NOPAT = 500 * (1 - 0.21) = 395
    // Invested Capital = 2000 + 500 - 200 = 2300
    // ROIC = 395 / 2300 * 100 = 17.17%
    assert.ok(afterGap.fivePillarsData.profitability.roic_pct !== undefined, 'ROIC calculated once debt supplied');
  });

  it('14. ROIC truly insufficient leaves value unavailable with reason, no fabricated number', () => {
    const insufficientReport: Partial<ReportData> = {
      ticker: 'EMPTY_CO',
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          // No operating income
          revenue: [100],
        } as any,
        balance_sheet: {} as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(insufficientReport, 'EMPTY_CO');
    assert.equal(resolved.fivePillarsData.profitability.roic_pct, undefined);
    assert.equal(resolved.fivePillarsData.unavailable_reasons?.roic, 'Insufficient verified invested-capital inputs');
  });

  it('15. ROE and ROA denominators test', () => {
    const sanityReport: Partial<ReportData> = {
      ticker: 'SANITY_CO',
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          net_income: [100],
        } as any,
        balance_sheet: {
          total_equity: [1000],
          total_assets: [5000],
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(sanityReport, 'SANITY_CO');
    assert.equal(resolved.fivePillarsData.profitability.roe_pct, 10); // 100 / 1000 * 100
    assert.equal(resolved.fivePillarsData.profitability.roa_pct, 2);  // 100 / 5000 * 100
    assert.notEqual(resolved.fivePillarsData.profitability.roe_pct, resolved.fivePillarsData.profitability.roa_pct);
  });

  it('16. Runtime peer discovery succeeds for new ticker without report peers or fixture ticker', () => {
    const newAutoReport: Partial<ReportData> = {
      ticker: 'NEW_EV_AUTO',
      company_profile: {
        overview: {
          company_name: 'New EV Automaker Inc.',
          sector: 'Consumer Cyclical',
          industry: 'Auto Manufacturers',
          description: 'Electric vehicle manufacturer producing commercial and consumer delivery vans.',
        } as any,
      },
      financial_statements: actualProductionTslaReport.financial_statements,
    };
    // Trusted candidate discovery returns public automotive candidates
    const trustedAutomotiveCandidates = [
      {
        ticker: 'AUTO_1',
        company_name: 'Global Auto Manufacturer 1',
        industry: 'Auto Manufacturers',
        pe_trailing: 12.5,
        revenue_growth_yoy_pct: 8.0,
      },
      {
        ticker: 'AUTO_2',
        company_name: 'Global Auto Manufacturer 2',
        industry: 'Auto Manufacturers',
        pe_trailing: 15.0,
        revenue_growth_yoy_pct: 12.0,
      },
    ];
    const discovered = discoverPeers(newAutoReport, 'NEW_EV_AUTO', { candidates: trustedAutomotiveCandidates as any });
    assert.ok(discovered.peerCount > 0, 'Must discover peers for new automotive ticker');
    assert.ok(discovered.peers.every(p => p.ticker !== 'NEW_EV_AUTO'), 'Must not include self');

    // Also test discoverPeerCandidates directly with an unknown SaaS ticker
    const saasCandidates = discoverPeerCandidates({
      ticker: 'NEW_UNKNOWN_CLOUD',
      primaryArchetype: 'saas_software',
      sector: 'Technology',
      industry: 'Software - Infrastructure',
    });
    assert.ok(saasCandidates.length > 0, 'discoverPeerCandidates must discover public peers for unknown ticker');
  });

  it('17. Production environment disables fixture fallback and returns truthful unavailable state when no candidates', () => {
    const emptyReport: Partial<ReportData> = {
      ticker: 'UNKNOWN_EXTREME',
      company_profile: {
        sector: 'Unknown Sector',
        industry: 'Nonexistent Industry',
      } as any,
    };
    // In production mode with disableFixtureFallback
    const result = discoverPeers(emptyReport, 'UNKNOWN_EXTREME', { disableFixtureFallback: true });
    assert.equal(result.peerCount, 0, 'Must return 0 peers in production when no candidates match');
    assert.equal(result.unavailableReason, 'NO_CANDIDATES');
  });

  it('18. Close comparables qualify when no DIRECT_PEER meets threshold', () => {
    const targetReport: Partial<ReportData> = {
      ticker: 'NICHE_CO',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        description: 'Specialized enterprise observability tool',
      } as any,
      financial_statements: actualProductionTslaReport.financial_statements,
    };
    // Provide 3 candidates that score as CLOSE_COMPARABLE (e.g. general enterprise cloud software)
    const candidates = [
      {
        ticker: 'COMP_A',
        company_name: 'Comp A Inc.',
        industry: 'Software - Infrastructure',
        pe_trailing: 25.0,
        revenue_growth_yoy_pct: 15.0,
      },
      {
        ticker: 'COMP_B',
        company_name: 'Comp B Corp.',
        industry: 'Software - Infrastructure',
        pe_trailing: 30.0,
        revenue_growth_yoy_pct: 20.0,
      },
      {
        ticker: 'COMP_C',
        company_name: 'Comp C LLC',
        industry: 'Software - Infrastructure',
        pe_trailing: 35.0,
        revenue_growth_yoy_pct: 18.0,
      },
    ];
    const result = discoverPeers(targetReport, 'NICHE_CO', { candidates: candidates as any });
    assert.equal(result.peerCount, 3, 'Must populate with close comparables, not zero');
    assert.ok(result.benchmarkRows.length > 0, 'Benchmark rows must be populated');
  });

  it('19. Negative EBITDA peer displays EV/EBITDA as N/M / not meaningful', () => {
    const reportWithNegEbitda: Partial<ReportData> = {
      ticker: 'OP_CO',
      company_profile: {
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
      } as any,
      valuation_ratios: [
        { name: 'EV/EBITDA', value: -8.5 } as any, // Target has negative EBITDA
      ],
      financial_statements: actualProductionTslaReport.financial_statements,
    };
    const candidates = [
      {
        ticker: 'PEER_NEG',
        company_name: 'Peer Neg Corp.',
        industry: 'Auto Manufacturers',
        ev_ebitda: -12.0, // Peer has negative EBITDA
        pe_trailing: 15.0,
      },
    ];
    const result = discoverPeers(reportWithNegEbitda, 'OP_CO', { candidates: candidates as any });
    const evRow = result.benchmarkRows.find(r => r.metric_name === 'EV / EBITDA');
    assert.ok(evRow, 'EV/EBITDA row must exist');
    assert.equal(evRow.target_value, 'N/M', 'Negative target EBITDA must format as N/M');
    assert.equal(evRow.direct_peer_value, 'N/M', 'Negative peer EBITDA must format as N/M');
  });

  it('20. 10Y Treasury yield displays verified value, as-of date, and source', () => {
    const reportWithTreasury: Partial<ReportData> = {
      ticker: 'CORP_TREASURY',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Infrastructure',
      } as any,
      five_pillars: {
        yields: {
          treasury_10yr_yield_pct: 4.45,
          treasury_as_of_date: '2026-03-15',
          treasury_source: 'Federal Reserve H.15',
          fcf_yield_pct: 6.20,
        },
      } as any,
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: { revenue: [1000] } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(reportWithTreasury, 'CORP_TREASURY');
    assert.equal(resolved.fivePillarsData.yields.treasury_10yr_yield_pct, 4.45);
    assert.equal(resolved.fivePillarsData.yields.treasury_as_of_date, '2026-03-15');
    assert.equal(resolved.fivePillarsData.yields.treasury_source, 'Federal Reserve H.15');
    assert.equal(resolved.fivePillarsData.yields.yield_spread_vs_treasury, 1.75); // 6.20 - 4.45 = +1.75%
  });

  it('21. 10Y Treasury yield failure remains undefined, NEVER falls back to 4.25%', () => {
    const reportNoTreasury: Partial<ReportData> = {
      ticker: 'CORP_NO_TREASURY',
      financial_statements: actualProductionTslaReport.financial_statements,
    };
    const resolved = resolveAdaptiveFivePillars(reportNoTreasury, 'CORP_NO_TREASURY');
    assert.equal(resolved.fivePillarsData.yields.treasury_10yr_yield_pct, undefined);
    assert.notEqual(resolved.fivePillarsData.yields.treasury_10yr_yield_pct, 4.25, 'Must NEVER fall back to 4.25%');
    assert.equal(resolved.fivePillarsData.yields.yield_spread_vs_treasury, undefined);
  });

  it('22. Cross-Sector: Software (MSFT-like) classifies as saas_software with FCF valid and ROIC valid', () => {
    const msftReport: Partial<ReportData> = {
      ticker: 'MSFT',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        description: 'Microsoft develops and supports software, services, devices, and solutions worldwide, including Azure and Office 365.',
      } as any,
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          revenue: [65000],
          operating_income: [30000],
          net_income: [24000],
          gross_margin_pct: [71.0],
          operating_margin_pct: [46.0],
          net_margin_pct: [37.0],
        } as any,
        balance_sheet: {
          total_equity: [250000],
          total_debt: [80000],
          cash_and_equivalents: [20000],
          short_term_investments: [60000],
          total_assets: [500000],
        } as any,
        cash_flow: {
          operating_cash_flow: [34000],
          capex: [14000],
          free_cash_flow: [20000],
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(msftReport, 'MSFT');
    assert.equal(resolved.archetype, 'saas_software');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, undefined);
    assert.ok(resolved.fivePillarsData.profitability.roic_pct !== undefined);
  });

  it('23. Cross-Sector: Insurer (TRV-like) classifies as insurer with Financial Sector Guard ON', () => {
    const insurerReport: Partial<ReportData> = {
      ticker: 'TRV',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Insurance - Property & Casualty',
        description: 'The Travelers Companies provides property and casualty insurance products and services.',
      } as any,
      financial_statements: {
        statement_template: 'insurance' as any,
        periods: ['Q1 2026'],
        income_statement: {
          net_income: [1200],
        } as any,
        balance_sheet: {
          total_equity: [25000],
          total_assets: [120000],
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(insurerReport, 'TRV');
    assert.equal(resolved.archetype, 'insurer');
    assert.equal(resolved.fivePillarsData.yields.is_fcf_guarded, true);
  });

  it('24. Cross-Sector: REIT (PLD-like) classifies as reit with FFO semantics', () => {
    const reitReport: Partial<ReportData> = {
      ticker: 'PLD',
      company_profile: {
        sector: 'Real Estate',
        industry: 'REIT - Industrial',
        description: 'Prologis is the global leader in logistics real estate with a focus on high-barrier, high-growth markets.',
      } as any,
      financial_statements: {
        statement_template: 'reit' as any,
        periods: ['Q1 2026'],
        income_statement: {
          revenue: [2000],
          net_income: [800],
        } as any,
        balance_sheet: {
          total_equity: [55000],
          total_assets: [90000],
        } as any,
      } as any,
    };
    const resolved = resolveAdaptiveFivePillars(reitReport, 'PLD');
    assert.equal(resolved.archetype, 'reit');
    assert.ok(resolved.pillars.profitability.titleEn.includes('FFO / AFFO'));
  });
});
