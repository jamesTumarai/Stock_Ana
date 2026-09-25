import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import { DataGapState } from '../../dataCompleteness/types';

describe('Adaptive Five Pillars Resolver', () => {
  // 54. DATA CONSISTENCY TEST: ROE, ROIC, Net Margin, Debt/Equity in Key Indicators must match Five Pillars
  it('54. Consistently consumes canonical Key Indicators for ROE, ROIC, Net Margin, Debt/Equity', () => {
    const report: Partial<ReportData> = {
      ticker: 'TEST_OP',
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [1000, 1200],
          net_income: [150, 200],
          operating_income: [200, 250],
          gross_profit: [600, 750],
          yoy_revenue_growth_pct: [null, 20.0],
          gross_margin_pct: [60.0, 62.5],
          net_margin_pct: [15.0, 16.67],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [200, 300],
          short_term_investments: [100, 150],
          total_debt: [400, 350],
          total_equity: [800, 1000],
        } as any,
        cash_flow: {
          free_cash_flow: [120, 180],
          yoy_fcf_growth_pct: [null, 50.0],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roe', name: 'ROE', category: 'profitability', unit: '%', values: [18.75, 20.0] },
                { key: 'roic', name: 'ROIC', category: 'profitability', unit: '%', values: [15.5, 17.2] },
              ],
            },
            {
              category_key: 'solvency',
              category_title: 'Solvency',
              metrics: [
                { key: 'debt_to_equity', name: 'Debt to Equity', category: 'solvency', unit: 'x', values: [0.5, 0.35] },
              ],
            },
          ],
        },
      },
      valuation_ratios: [
        { name: 'P/E (TTM)', value: 25.0 },
        { name: 'P/FCF', value: 27.8 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(report, 'TEST_OP');
    const data = resolved.fivePillarsData;

    // Must match Key Indicators exactly without becoming N/A
    assert.equal(data.profitability.roe_pct, 20.0, 'ROE must match Key Indicators');
    assert.equal(data.profitability.roic_pct, 17.2, 'ROIC must match Key Indicators');
    assert.equal(data.balance_sheet.debt_to_equity, 0.35, 'Debt/Equity must match Key Indicators');
    assert.equal(data.growth.revenue_growth_yoy_pct, 20.0, 'Revenue Growth YoY must match');
    assert.equal(data.profitability.net_margin_pct, 16.67, 'Net Margin must match');
  });

  // 55. TEST — FINANCIAL COMPANY (SOFI-like)
  it('55. Financial company adheres to Financial Sector Guard: ROE/ROA prioritized, FCF guarded, balance sheet adapted', () => {
    const sofiReport: Partial<ReportData> = {
      ticker: 'SOFI',
      company_profile: {
        company_name: 'SoFi Technologies, Inc.',
        sector: 'Financial Services',
        industry: 'Credit Services',
        description: 'Digital financial services platform providing lending, banking, and technology services.',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        statement_template: 'banking',
        income_statement: {
          revenue: [2100, 2700],
          net_income: [-300, 200],
          yoy_revenue_growth_pct: [null, 28.5],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [2500, 3100],
          short_term_investments: [500, 600],
          total_debt: [4000, 4200],
          total_equity: [5200, 5800],
          deposits: [18000, 24000],
          loans_held_for_investment: [19000, 25000],
        } as any,
        cash_flow: {
          free_cash_flow: [-1500, -2200], // Operating lending cash outflow
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roe', name: 'ROE', values: [-5.8, 8.4] },
                { key: 'roa', name: 'ROA', values: [-0.9, 1.2] },
                { key: 'net_interest_margin_pct', name: 'NIM', values: [5.6, 5.85] },
              ],
            },
            {
              category_key: 'solvency',
              category_title: 'Solvency',
              metrics: [
                { key: 'tier1_capital_ratio', name: 'Tier 1 Capital Ratio', values: [15.2, 16.1] },
              ],
            },
          ],
        } as any,
      },
      valuation_ratios: [
        { name: 'P/E (TTM)', value: 38.5 },
        { name: 'Forward P/E', value: 24.0 },
        { name: 'P/B', value: 2.1 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(sofiReport, 'SOFI');
    const data = resolved.fivePillarsData;
    const pillars = resolved.pillars;

    // 1. ROE and ROA are available from canonical data
    assert.equal(data.profitability.roe_pct, 8.4, 'ROE must be 8.4%');
    assert.equal(pillars.profitability.badgeLabel, 'ROE');

    // 2. FCF Yield is guarded by Financial Sector Guard
    assert.equal(data.yields.fcf_yield_pct, undefined, 'FCF Yield must be undefined for financial institutions');
    assert.equal(data.yields.is_fcf_guarded, true, 'FCF Guard flag must be set');
    const fcfYieldMetric = pillars.yields.metrics.find(m => m.key === 'fcf_yield');
    assert.equal(fcfYieldMetric?.status, DataGapState.GUARDED_FOR_BUSINESS_MODEL);
    assert.equal(fcfYieldMetric?.formattedValue, 'Not used — Financial Sector Guard');

    // 3. Balance sheet does NOT show simplistic "Net Cash Fortress"
    assert.equal(data.balance_sheet.is_net_cash, undefined, 'is_net_cash must not be forced for bank');
    assert.ok(data.balance_sheet.solvency_score_label?.includes('Financial Sector Guard'), 'Solvency label must contextualize financial structure');

    // 4. Gross Margin is not forced
    assert.equal(data.profitability.gross_margin_pct, undefined, 'Gross Margin must be undefined for bank without COGS');
    const gmMetric = pillars.profitability.metrics.find(m => m.key === 'gross_margin');
    assert.equal(gmMetric?.status, DataGapState.NOT_APPLICABLE);

    // 5. Earnings Yield identifies basis (TTM)
    assert.equal(data.yields.earnings_yield_pct, 2.6, 'Earnings Yield 100/38.5 = 2.6%');
    const eyMetric = pillars.yields.metrics.find(m => m.key === 'earnings_yield');
    assert.ok(eyMetric?.labelEn.includes('TTM'), 'Earnings yield basis must be explicit');
  });

  // 56. TEST — SOFTWARE / PLATFORM (MSFT-like)
  it('56. Software company preserves standard operating metrics: Gross Margin, ROIC, FCF', () => {
    const msftReport: Partial<ReportData> = {
      ticker: 'MSFT',
      company_profile: {
        company_name: 'Microsoft Corporation',
        sector: 'Technology',
        industry: 'Software—Infrastructure',
        description: 'Developer of enterprise software, cloud infrastructure, and personal computing.',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [211915, 245122],
          gross_profit: [146052, 171122],
          operating_income: [88523, 109433],
          net_income: [72361, 88136],
          yoy_revenue_growth_pct: [null, 15.67],
          gross_margin_pct: [68.92, 69.81],
          operating_margin_pct: [41.77, 44.64],
          net_margin_pct: [34.15, 35.96],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [34704, 32185],
          short_term_investments: [76558, 43360],
          total_debt: [59965, 58000],
          total_equity: [206223, 268488],
        } as any,
        cash_flow: {
          free_cash_flow: [59475, 74071],
          yoy_fcf_growth_pct: [null, 24.54],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'profitability',
              category_title: 'Profitability',
              metrics: [
                { key: 'roic', name: 'ROIC', values: [27.5, 29.5] },
                { key: 'roe', name: 'ROE', values: [35.0, 38.8] },
              ],
            },
          ],
        } as any,
      },
      valuation_ratios: [
        { name: 'P/E (TTM)', value: 34.2 },
        { name: 'P/FCF', value: 35.7 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(msftReport, 'MSFT');
    const data = resolved.fivePillarsData;
    const pillars = resolved.pillars;

    assert.equal(data.profitability.roic_pct, 29.5, 'ROIC must be 29.5%');
    assert.equal(data.profitability.gross_margin_pct, 69.81, 'Gross Margin must be 69.81%');
    assert.equal(data.yields.fcf_yield_pct, undefined, 'P/FCF alone cannot replace canonical four-quarter FCF history');
    assert.equal(pillars.profitability.badgeLabel, 'ROIC');
    assert.equal(data.balance_sheet.is_net_cash, true, 'Microsoft has net cash');
  });

  // 57. TEST — REIT (PLD-like)
  it('57. REIT company adapts to property economics: NOI growth, coverage, no generic FCF dominance', () => {
    const reitReport: Partial<ReportData> = {
      ticker: 'PLD',
      company_profile: {
        company_name: 'Prologis, Inc.',
        sector: 'Real Estate',
        industry: 'REIT—Industrial',
        description: 'Global logistics real estate investment trust.',
      } as any,
      financial_statements: {
        statement_template: 'reit',
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [7000, 8000],
          net_income: [3000, 3200],
          yoy_revenue_growth_pct: [null, 14.3],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [500, 600],
          short_term_investments: [0, 0],
          total_debt: [28000, 30000],
          total_equity: [54000, 56000],
        } as any,
        cash_flow: {} as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'operating_capacity',
              category_title: 'Operations',
              metrics: [
                { key: 'occupancy_rate_pct', name: 'Occupancy Rate', values: [97.1, 96.8] },
              ],
            },
          ],
        } as any,
      },
      valuation_ratios: [
        { name: 'P/E', value: 35.0 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(reitReport, 'PLD');
    const pillars = resolved.pillars;

    assert.ok(pillars.growth.titleEn.includes('Property') || pillars.growth.titleEn.includes('Growth'));
    assert.ok(pillars.profitability.titleEn.includes('FFO') || pillars.profitability.titleEn.includes('Quality'));
  });

  // 62. TEST — EARLY-STAGE / PRE-PROFIT (RKLB-like)
  it('62. Early-stage company does not force P/E or PEG; adapts to revenue growth and cash runway', () => {
    const rklbReport: Partial<ReportData> = {
      ticker: 'RKLB',
      company_profile: {
        company_name: 'Rocket Lab USA, Inc.',
        sector: 'Industrials',
        industry: 'Aerospace & Defense',
        description: 'End-to-end space company providing launch services and space systems.',
      } as any,
      financial_statements: {
        periods: ['2023', '2024'],
        income_statement: {
          revenue: [244, 350],
          net_income: [-182, -160],
          gross_profit: [60, 95],
          yoy_revenue_growth_pct: [null, 43.4],
          gross_margin_pct: [24.6, 27.1],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [300, 280],
          short_term_investments: [50, 40],
          total_debt: [120, 110],
          total_equity: [450, 410],
        } as any,
        cash_flow: {
          free_cash_flow: [-140, -120],
        } as any,
        key_indicators: {
          periods: ['2023', '2024'],
          categories: [
            {
              category_key: 'solvency',
              category_title: 'Solvency',
              metrics: [
                { key: 'cash_runway_months', name: 'Cash Runway', values: [30, 28] },
              ],
            },
          ],
        } as any,
      },
      valuation_ratios: [
        { name: 'P/S', value: 14.5 },
      ],
    };

    const resolved = resolveAdaptiveFivePillars(rklbReport, 'RKLB');
    const data = resolved.fivePillarsData;

    // PEG must not be forced for pre-profit
    assert.equal(data.growth.peg_ratio, undefined, 'PEG must not be forced for pre-profit');
    assert.ok(data.growth.peg_interpretation?.includes('ไม่เหมาะกับบริษัทที่ยังไม่มีกำไรสุทธิ'), 'Must explain why PEG is not applicable');

    // Balance sheet mentions cash runway
    assert.ok(data.balance_sheet.solvency_score_label?.includes('28 เดือน') || data.balance_sheet.solvency_score_label?.includes('Cash Runway'), 'Should note cash runway');
  });
});
