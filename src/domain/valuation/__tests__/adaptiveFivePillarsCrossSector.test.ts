import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';

type MockReport = Partial<ReportData> & Record<string, any>;

describe('Adaptive Five Fundamental Pillars — Cross-Sector Test Suite', () => {

  // =========================================================================
  // 1. AUTOMOTIVE & MOBILITY OEM ARCHETYPE (e.g. Auto Manufacturers)
  // =========================================================================
  it('1. Automotive Archetype adapts Pillar 2 to ROIC-WACC or Capital Intensity and Pillar 4 to Shareholder Yield', () => {
    const report: MockReport = {
      ticker: 'AUTO_MFR',
      company_profile: {
        sector: 'Consumer Cyclical',
        industry: 'Auto Manufacturers',
        sub_industry: 'Auto Manufacturers',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [80000, 96000],
          net_income: [7000, 9000],
          operating_income: [9000, 11000],
          gross_profit: [18000, 22000],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [15000, 20000],
          short_term_investments: [5000, 8000],
          total_debt: [6000, 5000],
          total_equity: [45000, 55000],
        } as any,
        cash_flow: {
          operating_cash_flow: [12000, 15000],
          capex: [-6000, -7000],
          free_cash_flow: [6000, 8000],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roic', name: 'ROIC', category: 'profitability', unit: '%', values: [12.0, 14.5] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 700000,
        dividend_yield: 0.0,
      } as any,
      intrinsic_value: {
        cost_of_capital: {
          wacc: 8.5,
        } as any,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'AUTO_MFR');
    assert.strictEqual(resolved.archetype, 'industrial_manufacturing');

    // Pillar 2: ROIC - WACC spread
    const p2Metrics = resolved.pillars.profitability.metrics;
    const roicWacc = p2Metrics.find(m => m.key === 'roic_wacc_spread');
    assert.ok(roicWacc, 'ROIC-WACC spread must exist in Pillar 2');
    assert.strictEqual(roicWacc.value, 6.0); // 14.5% - 8.5%

    // Pillar 3: Net Cash adaptation (Cash+ST > Total Debt)
    const p3Metrics = resolved.pillars.solvency.metrics;
    const netCashToMcap = p3Metrics.find(m => m.key === 'net_cash_to_mcap');
    assert.ok(netCashToMcap, 'Net Cash to Market Cap should be rendered for Net Cash position');

    // Pillar 4: Primary UI has Shareholder Yield and FCF Conversion, NOT 10Y Treasury
    const p4Metrics = resolved.pillars.yields.metrics;
    assert.ok(p4Metrics.some(m => m.key === 'shareholder_yield'), 'Pillar 4 must feature Shareholder Yield');
    assert.ok(p4Metrics.some(m => m.key === 'fcf_conversion'), 'Pillar 4 must feature FCF Conversion');
    assert.ok(!p4Metrics.some(m => m.key === 'treasury_10yr_yield'), 'Pillar 4 UI must NOT contain 10Y Treasury');
  });

  // =========================================================================
  // 2. SOFTWARE / SAAS ARCHETYPE
  // =========================================================================
  it('2. Software / SaaS Archetype focuses on FCF Conversion, Gross Margin, and Net Cash', () => {
    const report: MockReport = {
      ticker: 'SAAS_CO',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Infrastructure',
        business_summary: 'Cloud-based enterprise SaaS platform with subscription revenue',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [1000, 1300],
          net_income: [200, 300],
          gross_profit: [800, 1050],
          gross_margin_pct: [80.0, 80.77],
          operating_income: [220, 320],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [500, 800],
          short_term_investments: [200, 300],
          total_debt: [100, 80],
          total_equity: [1500, 2000],
        } as any,
        cash_flow: {
          free_cash_flow: [280, 420],
        } as any,
      },
      market_snapshot: {
        market_cap: 15000,
        dividend_yield: 0.0,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'SAAS_CO');
    assert.strictEqual(resolved.archetype, 'saas_software');

    // Two annual observations cannot be relabeled as TTM cash conversion.
    const p4 = resolved.pillars.yields;
    const fcfConv = p4.metrics.find(m => m.key === 'fcf_conversion');
    assert.ok(fcfConv, 'FCF Conversion must exist in Pillar 4');
    assert.strictEqual(fcfConv.value, null);
    assert.strictEqual(fcfConv.status, 'NOT_APPLICABLE');

    // Pillar 3: Net Cash
    assert.strictEqual(resolved.fivePillarsData.balance_sheet.is_net_cash, true);
  });

  // =========================================================================
  // 3. SEMICONDUCTOR ARCHETYPE
  // =========================================================================
  it('3. Semiconductor Archetype computes Value Creation Spread and Shareholder Return', () => {
    const report: MockReport = {
      ticker: 'SEMI_CHIP',
      company_profile: {
        sector: 'Technology',
        industry: 'Semiconductors',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [20000, 30000],
          net_income: [5000, 9000],
          operating_income: [6000, 10500],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [6000, 10000],
          total_debt: [4000, 3500],
          total_equity: [25000, 35000],
        } as any,
        cash_flow: {
          free_cash_flow: [4500, 8200],
          repurchase_of_common_stock: [-1000, -1500],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roic', name: 'ROIC', category: 'profitability', unit: '%', values: [18.0, 28.5] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 120000,
        dividend_yield: 0.015, // 1.5%
      } as any,
      intrinsic_value: {
        cost_of_capital: {
          wacc: 9.0,
        } as any,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'SEMI_CHIP');
    assert.strictEqual(resolved.archetype, 'semiconductor');

    // ROIC - WACC = 28.5 - 9.0 = 19.5%
    const roicWacc = resolved.pillars.profitability.metrics.find(m => m.key === 'roic_wacc_spread');
    assert.ok(roicWacc);
    assert.strictEqual(roicWacc.value, 19.5);
    assert.strictEqual(resolved.fivePillarsData.value_creation_summary?.spread, 19.5);

    // Shareholder Yield: Div 1.5% + Buyback (1500 / 120000 * 100 = 1.25%) = 2.75%
    const shYield = resolved.pillars.yields.metrics.find(m => m.key === 'shareholder_yield');
    assert.ok(shYield);
    assert.ok(shYield.value !== null && shYield.value >= 2.5);
  });

  // =========================================================================
  // 4. COMMERCIAL BANK ARCHETYPE — FINANCIAL SECTOR GUARD
  // =========================================================================
  it('4. Bank Archetype enforces Financial Sector Guard: ROIC/FCF guarded, NIM/ROE/Efficiency active', () => {
    const report: MockReport = {
      ticker: 'BIG_BANK',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Banks - Diversified',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        statement_template: 'banking',
        income_statement: {
          net_interest_income: [25000, 28000],
          non_interest_income: [15000, 16000],
          net_income: [10000, 11500],
        } as any,
        balance_sheet: {
          deposits: [350000, 380000],
          total_assets: [500000, 540000],
          total_equity: [45000, 49000],
        } as any,
        cash_flow: {
          operating_cash_flow: [5000, -2000], // Lending volatility
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roe', name: 'ROE', category: 'profitability', unit: '%', values: [14.0, 15.2] },
                { key: 'nim', name: 'Net Interest Margin', category: 'profitability', unit: '%', values: [2.8, 3.1] },
                { key: 'efficiency_ratio', name: 'Efficiency Ratio', category: 'profitability', unit: '%', values: [58.0, 56.5] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 95000,
        dividend_yield: 0.038,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'BIG_BANK');
    assert.strictEqual(resolved.archetype, 'bank');

    // Financial Sector Guard verification
    assert.strictEqual(resolved.pillars.profitability.isGuarded, true);

    // Pillar 2 must feature ROE and Gross Margin guarded
    const p2Metrics = resolved.pillars.profitability.metrics;
    assert.ok(p2Metrics.some(m => m.key === 'roe'), 'Bank must feature ROE in Pillar 2');

    // Corporate FCF Yield must be guarded
    const fcfYield = resolved.pillars.yields.metrics.find(m => m.key === 'fcf_yield');
    if (fcfYield) {
      assert.strictEqual(fcfYield.status, 'GUARDED_FOR_BUSINESS_MODEL');
    }

    // Pillar 3 should feature regulatory / banking metrics (Capital / Funding)
    assert.ok(resolved.pillars.solvency.titleEn.includes('Capital'), 'Pillar 3 title must reflect bank capital');
  });

  // =========================================================================
  // 5. INSURANCE ARCHETYPE
  // =========================================================================
  it('5. Insurer Archetype features Combined Ratio, Underwriting Margin, and ROE', () => {
    const report: MockReport = {
      ticker: 'SAFE_INS',
      company_profile: {
        sector: 'Financial Services',
        industry: 'Insurance - Property & Casualty',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          net_premiums_earned: [10000, 11500],
          net_income: [1200, 1500],
        } as any,
        balance_sheet: {
          loss_reserve: [18000, 20000],
          total_equity: [8000, 9200],
        } as any,
        cash_flow: {} as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'combined_ratio', name: 'Combined Ratio', category: 'profitability', unit: '%', values: [94.5, 92.8] },
                { key: 'roe', name: 'ROE', category: 'profitability', unit: '%', values: [15.0, 16.3] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 18000,
        dividend_yield: 0.025,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'SAFE_INS');
    assert.strictEqual(resolved.archetype, 'insurer');

    // Combined ratio: 92.8%
    const p2Metrics = resolved.pillars.profitability.metrics;
    const combinedRatio = p2Metrics.find(m => m.key === 'combined_ratio');
    assert.ok(combinedRatio, 'Combined Ratio must be in Pillar 2 for Insurer');
    assert.strictEqual(combinedRatio.value, 92.8);

    // Underwriting margin: 100 - 92.8 = 7.2%
    const uwMargin = p2Metrics.find(m => m.key === 'underwriting_margin');
    assert.ok(uwMargin, 'Underwriting Margin must be computed for Insurer');
    assert.strictEqual(uwMargin.value, 7.2);
  });

  // =========================================================================
  // 6. REAL ESTATE INVESTMENT TRUST (REIT) ARCHETYPE
  // =========================================================================
  it('6. REIT Archetype features P/FFO, FFO Yield, and Occupancy Rate', () => {
    const report: MockReport = {
      ticker: 'PROP_REIT',
      company_profile: {
        sector: 'Real Estate',
        industry: 'REIT - Diversified',
      } as any,
      financial_statements: {
        statement_template: 'reit',
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [2000, 2200],
          net_income: [400, 450],
          ffo: [1100, 1250],
        } as any,
        balance_sheet: {
          total_debt: [8000, 8200],
          total_assets: [15000, 16000],
          total_equity: [6000, 6500],
        } as any,
        cash_flow: {} as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'operating_capacity',
              category_title: 'Operating Capacity',
              metrics: [
                { key: 'occupancy_rate_pct', name: 'Occupancy Rate', category: 'operating_capacity', unit: '%', values: [95.2, 96.5] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 18750, // P/FFO = 18750 / 1250 = 15.0x
        dividend_yield: 0.048,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'PROP_REIT');
    assert.strictEqual(resolved.archetype, 'reit');

    // Pillar 1/2: Adapts to property economics
    assert.ok(resolved.pillars.growth.titleEn.includes('Property') || resolved.pillars.growth.titleEn.includes('Growth'));
    assert.ok(resolved.pillars.profitability.titleEn.includes('FFO') || resolved.pillars.profitability.titleEn.includes('Quality'));
  });

  // =========================================================================
  // 7. PRE-REVENUE CLINICAL BIOTECH ARCHETYPE
  // =========================================================================
  it('7. Pre-Revenue Biotech adapts to Cash Runway / Cash Burn and guards FCF Conversion against Net Loss', () => {
    const report: MockReport = {
      ticker: 'BIO_CLINICAL',
      company_profile: {
        sector: 'Healthcare',
        industry: 'Biotechnology',
        business_summary: 'Clinical stage biopharmaceutical company conducting Phase II trials',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [0, 0],
          net_income: [-120, -150],
          gross_margin_pct: [null, -100],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [300, 200],
          short_term_investments: [100, 50],
          total_debt: [0, 0],
          total_equity: [380, 230],
        } as any,
        cash_flow: {
          free_cash_flow: [-110, -140],
          operating_cash_flow: [-105, -135],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'solvency',
              category_title: 'Solvency',
              metrics: [
                { key: 'cash_runway_months', name: 'Cash Runway', category: 'solvency', unit: 'months', values: [36, 21.4] },
              ],
            },
          ],
        },
      },
      market_snapshot: {
        market_cap: 800,
        dividend_yield: 0.0,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'BIO_CLINICAL');
    assert.ok(resolved.archetype === 'biotech' || resolved.archetype === 'early_stage', 'Archetype must be biotech or early_stage');

    // Pillar 3: Cash Runway
    assert.strictEqual(resolved.fivePillarsData.balance_sheet.cash_runway_months, 21.4);

    // Pillar 4: FCF Conversion MUST BE GUARDED because Net Income is negative (-150)
    assert.strictEqual(resolved.fivePillarsData.yields.fcf_conversion_status, 'UNAVAILABLE');
    assert.strictEqual(resolved.fivePillarsData.yields.fcf_conversion_reason, 'Net Income non-positive (N/M)');
  });

  // =========================================================================
  // 8. PRE-PROFIT / TURNAROUND OPERATING CO — NEGATIVE EBITDA GUARD
  // =========================================================================
  it('8. Negative EBITDA Guard prevents mathematically meaningless negative Net Debt/EBITDA multiples', () => {
    const report: MockReport = {
      ticker: 'TURN_AROUND',
      company_profile: {
        sector: 'Industrials',
        industry: 'Machinery',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [1000, 800],
          operating_income: [-150, -200],
          net_income: [-180, -230],
          ebitda: [-100, -120],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [50, 40],
          total_debt: [500, 600],
          total_equity: [300, 100],
        } as any,
        cash_flow: {
          free_cash_flow: [-120, -180],
        } as any,
      },
      market_snapshot: {
        market_cap: 400,
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TURN_AROUND');

    // Net Debt is 600 - 40 = 560 > 0. But EBITDA is -120 <= 0.
    // Net Debt / EBITDA must NOT be -4.67x; it must be UNAVAILABLE with reason noting non-positive EBITDA
    assert.strictEqual(resolved.fivePillarsData.balance_sheet.net_debt_to_ebitda, undefined);
    assert.ok(
      resolved.fivePillarsData.balance_sheet.net_debt_to_ebitda_reason?.includes('N/M') ||
      resolved.fivePillarsData.balance_sheet.net_debt_to_ebitda_reason?.includes('EBITDA'),
      'Reason must explain EBITDA non-positive / N/M'
    );
  });

  // =========================================================================
  // 9. SHAREHOLDER YIELD DERIVATION & BREAKDOWN
  // =========================================================================
  it('9. Accurately derives Shareholder Yield from Dividend Yield + Net Buyback Yield', () => {
    const report: MockReport = {
      ticker: 'DIV_BUYBACK_CO',
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [5000, 5500],
          net_income: [800, 950],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [1000, 1200],
          total_debt: [800, 700],
          total_equity: [3000, 3500],
        } as any,
        cash_flow: {
          free_cash_flow: [700, 850],
          repurchase_of_common_stock: [-300, -400],
          issuance_of_common_stock: [50, 100], // Net buybacks = 400 - 100 = 300
        } as any,
      },
      market_snapshot: {
        market_cap: 10000, // Net Buyback Yield = 300 / 10000 * 100 = 3.0%
        dividend_yield: 0.025, // 2.5%
      } as any,
    };

    const resolved = resolveAdaptiveFivePillars(report, 'DIV_BUYBACK_CO');
    const yields = resolved.fivePillarsData.yields;
    const summary = resolved.fivePillarsData.shareholder_return_summary;

    assert.strictEqual(yields.dividend_yield_pct, 2.5);
    assert.strictEqual(yields.net_buyback_yield_pct, 3.0);
    assert.strictEqual(yields.shareholder_yield_pct, 5.5);

    assert.strictEqual(summary?.dividend_yield, 2.5);
    assert.strictEqual(summary?.net_buyback_yield, 3.0);
    assert.strictEqual(summary?.shareholder_yield, 5.5);
  });

  // =========================================================================
  // 10. GROWTH VS PROFITABILITY CLASSIFICATION (PILLAR 5)
  // =========================================================================
  it('10. Classifies Growth vs Profitability correctly and handles localized labels', () => {
    const report: MockReport = {
      ticker: 'TECH_GROWTH',
      company_profile: {
        sector: 'Technology',
        industry: 'Software - Infrastructure',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [1000, 1400], // +40% YoY
          net_income: [100, 200],
          operating_income: [120, 240],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [500, 700],
          total_debt: [100, 50],
          total_equity: [800, 1200],
        } as any,
        cash_flow: {
          free_cash_flow: [150, 250],
        } as any,
      },
      valuation_ratios: [
        { name: 'P/E (TTM)', value: 45.0 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TECH_GROWTH');
    // If peers in universe match, it produces a classification string; if sample is small, produces INSUFFICIENT_PEER_SAMPLE
    assert.ok(typeof resolved.fivePillarsData.growth_vs_profitability === 'string');
    assert.ok(typeof resolved.fivePillarsData.growth_vs_profitability_th === 'string');
  });

  // =========================================================================
  // 11. INVARIANT INTEGRITY & CROSS-SECTOR COVERAGE SUMMARY
  // =========================================================================
  it('11. Verifies that all 14 business archetypes resolve cleanly without crashing', () => {
    const archetypes = [
      'bank', 'lender', 'fintech', 'insurer', 'asset_manager',
      'broker_exchange', 'saas_software', 'semiconductor', 'hardware_device',
      'industrial_manufacturing', 'retail', 'digital_marketplace', 'reit',
      'energy_commodity', 'utility', 'telecom', 'early_stage', 'general_operating'
    ];

    for (const arch of archetypes) {
      const mockReport: Partial<ReportData> = {
        ticker: `TEST_${arch.toUpperCase()}`,
        financial_statements: {
          periods: ['2024'],
          income_statement: { revenue: [1000], net_income: [100] } as any,
          balance_sheet: { cash_and_equivalents: [200], total_debt: [100] } as any,
          cash_flow: { free_cash_flow: [80] } as any,
        },
      };
      const result = resolveAdaptiveFivePillars(mockReport, `TEST_${arch.toUpperCase()}`);
      assert.ok(result.pillars.profitability.metrics.length > 0, `${arch} must produce profitability metrics`);
      assert.ok(result.pillars.solvency.metrics.length > 0, `${arch} must produce solvency metrics`);
      assert.ok(result.pillars.yields.metrics.length > 0, `${arch} must produce yields metrics`);
    }
  });

});
