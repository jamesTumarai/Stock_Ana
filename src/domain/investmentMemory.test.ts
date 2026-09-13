import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMemorySnapshot,
  buildMemoryTimeline,
  getPreviousMemorySnapshot,
  compareMemorySnapshots
} from './investmentMemory';

describe('investmentMemory', () => {
  it('extracts complete snapshot from modern report without fabricating values', () => {
    const report: any = {
      ticker: 'MSFT',
      schema_version: 2,
      generated_by_version: '1.2.0',
      generated_at: '2026-06-15T10:00:00.000Z',
      company_profile: {
        shares_outstanding: 7450
      },
      intrinsic_value: {
        current_price: 430.0,
        summary: {
          base_case_fair_value: 480.0
        },
        assumptions: {
          discount_rate: 8.5,
          terminal_growth_rate: 2.5,
          revenue_growth_rate: 12.0,
          target_fcf_margin: 32.0
        }
      },
      verdict: {
        conviction_score: 88,
        summary: 'Strong AI growth and robust cloud margins.',
        key_takeaways: ['Azure scaling rapidly', 'Margin expansion in Cloud', 'High capital return']
      },
      comprehensive_analysis: {
        beginner_summary: {
          top_3_risks: ['Cloud spending slowdown', 'Antitrust regulation', 'Hardware capex escalation']
        }
      },
      catalysts_and_events: {
        items: [
          { title: 'Next generation Azure AI launch' },
          { title: 'Q4 earnings release' }
        ]
      },
      financial_statements: {
        periods: ['FY24', 'FY25'],
        income_statement: {
          revenue: [245120, 281000],
          yoy_revenue_growth_pct: [15.6, 14.6],
          operating_income: [109430, 128000],
          net_income: [88140, 102000]
        },
        cash_flow: {
          free_cash_flow: [74000, 85000]
        },
        balance_sheet: {
          cash_and_equivalents: [35000, 42000],
          short_term_investments: [45000, 50000],
          total_debt: [48000, 45000]
        }
      },
      sec_verification: {
        financialDataSource: 'sec_verified',
        sec_period_statements: [
          { period: 'FY24', revenue: 245120 },
          {
            period: 'FY25',
            revenue: 281000,
            operating_income: 128000,
            net_income: 102000,
            operating_cash_flow: 100000,
            capital_expenditure: 15000,
            total_debt: 45000,
            diluted_shares: 7450
          }
        ],
        dcf_financial_inputs: {
          version: 1,
          generated_by: 'sec-verified-financial-inputs-v1',
          eligible: true,
          ticker: 'MSFT',
          periods: ['FY25'],
          source_period: 'FY25',
          latest_balance_sheet_period_end: '2025-06-30',
          share_as_of: '2025-06-30',
          starting_revenue_m: 281000,
          trailing_four_free_cash_flow_m: 85000,
          historical_fcf_margin_pct: 30.2,
          cash_and_equivalents_m: 42000,
          short_term_investments_m: 50000,
          total_debt_m: 45000,
          net_cash_m: 47000,
          current_shares_outstanding_m: 7450,
          issues: []
        },
        submissions: {
          recentFilings: [
            { accessionNumber: '0000950170-25-001234', filingDate: '2025-07-30' }
          ]
        }
      }
    };

    const snap = extractMemorySnapshot(report, 'rep_msft_001');
    assert.ok(snap);
    assert.equal(snap?.ticker, 'MSFT');
    assert.equal(snap?.reportId, 'rep_msft_001');
    assert.equal(snap?.marketPrice, 430.0);
    assert.equal(snap?.valuation.baseFairValue, 480.0);
    assert.equal(snap?.valuation.assumptions.waccPct, 8.5);
    assert.equal(snap?.valuation.assumptions.terminalGrowthPct, 2.5);
    assert.equal(snap?.conviction.score, 88);
    assert.equal(snap?.financials.revenue, 281000);
    assert.equal(snap?.financials.revenueYoYPct, 14.64);
    assert.equal(snap?.financials.freeCashFlow, 85000);
    assert.equal(snap?.financials.netCash, 47000);
    assert.equal(snap?.financials.provenance, 'sec_verified');
    assert.equal(snap?.evidence.secAccession, '0000950170-25-001234');
    assert.equal(snap?.evidence.hasVerifiedSecStatements, true);
    assert.equal(snap?.thesis.keyDrivers.length, 3);
    assert.equal(snap?.thesis.keyRisks.length, 3);
    assert.equal(snap?.thesis.catalysts.length, 2);
    assert.equal(snap?.isLegacy, false);
  });

  it('gracefully degrades on legacy reports without crashing or faking facts', () => {
    const legacyReport: any = {
      ticker: 'LEGACY_CO',
      report_date: '2024-05-10',
      verdict: {
        summary: 'Legacy summary prose.'
      }
    };

    const snap = extractMemorySnapshot(legacyReport);
    assert.ok(snap);
    assert.equal(snap?.ticker, 'LEGACY_CO');
    assert.equal(snap?.isLegacy, true);
    assert.equal(snap?.marketPrice, null);
    assert.equal(snap?.valuation.baseFairValue, null);
    assert.equal(snap?.valuation.isAvailable, false);
    assert.equal(snap?.valuation.assumptions.waccPct, null);
    assert.equal(snap?.financials.revenue, null);
    assert.equal(snap?.financials.freeCashFlow, null);
    assert.equal(snap?.financials.provenance, 'unavailable');
    assert.equal(snap?.evidence.hasVerifiedSecStatements, false);
    assert.equal(snap?.thesis.confirmationStatus, 'ai_draft');
  });

  it('preserves sector guard and handles financial institution (SOFI) safely', () => {
    const sofiReport: any = {
      ticker: 'SOFI',
      schema_version: 2,
      company_profile: {
        industry: 'Credit Services',
        sector: 'Financial Services'
      },
      intrinsic_value: {
        current_price: 12.5,
        summary: {
          base_case_fair_value: 15.0
        }
      },
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          revenue: [600],
          net_income: [50]
        }
      }
    };

    const snap = extractMemorySnapshot(sofiReport);
    assert.ok(snap);
    assert.equal(snap?.ticker, 'SOFI');
    assert.equal(snap?.valuation.baseFairValue, 15.0);
    // SOFI should not have generic FCFF assumptions forced upon it
    assert.equal(snap?.valuation.assumptions.waccPct, null);
    assert.equal(snap?.financials.freeCashFlow, null);
  });

  it('buildMemoryTimeline filters, dedupes, and sorts strictly descending by timestamp', () => {
    const r1 = { ticker: 'AAPL', report_date: '2026-01-01', id: 'r1', generated_at: '2026-01-01T00:00:00Z' };
    const r2 = { ticker: 'AAPL', report_date: '2026-03-01', id: 'r2', generated_at: '2026-03-01T00:00:00Z' };
    const rOther = { ticker: 'MSFT', report_date: '2026-02-01', id: 'r3', generated_at: '2026-02-01T00:00:00Z' };

    const timeline = buildMemoryTimeline('AAPL', [r1, r2, rOther]);
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].reportId, 'r2');
    assert.equal(timeline[1].reportId, 'r1');

    const prev = getPreviousMemorySnapshot('AAPL', [r1, r2], r2);
    assert.ok(prev);
    assert.equal(prev?.reportId, 'r1');
  });

  it('compareMemorySnapshots computes deterministic deltas and detects risk/catalyst evolution', () => {
    const prevSnap = extractMemorySnapshot({
      ticker: 'MSFT',
      id: 'rep_1',
      report_date: '2026-01-15',
      generated_at: '2026-01-15T00:00:00Z',
      intrinsic_value: {
        current_price: 400.0,
        summary: { base_case_fair_value: 450.0 },
        assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
      },
      verdict: { conviction_score: 80, summary: 'Initial thesis' },
      comprehensive_analysis: {
        beginner_summary: { top_3_risks: ['Competition', 'Margin pressure'] }
      },
      catalysts_and_events: {
        items: [{ title: 'Product announcement' }]
      },
      financial_statements: {
        periods: ['Q1'],
        income_statement: { revenue: [50000], yoy_revenue_growth_pct: [12.0], operating_income: [20000] },
        cash_flow: { free_cash_flow: [15000] }
      }
    });

    const currSnap = extractMemorySnapshot({
      ticker: 'MSFT',
      id: 'rep_2',
      report_date: '2026-04-15',
      generated_at: '2026-04-15T00:00:00Z',
      intrinsic_value: {
        current_price: 440.0,
        summary: { base_case_fair_value: 495.0 },
        assumptions: { discount_rate: 8.0, terminal_growth_rate: 2.7 }
      },
      verdict: { conviction_score: 85, summary: 'Upgraded thesis' },
      comprehensive_analysis: {
        beginner_summary: { top_3_risks: ['Competition', 'Supply chain'] }
      },
      catalysts_and_events: {
        items: [{ title: 'Product announcement' }, { title: 'Dividend hike' }]
      },
      financial_statements: {
        periods: ['Q2'],
        income_statement: { revenue: [58000], yoy_revenue_growth_pct: [16.0], operating_income: [24360] },
        cash_flow: { free_cash_flow: [18000] }
      }
    });

    assert.ok(prevSnap && currSnap);
    const delta = compareMemorySnapshots(currSnap, prevSnap);

    assert.equal(delta.previousReportId, 'rep_1');
    assert.equal(delta.currentReportId, 'rep_2');
    assert.equal(delta.priceDelta?.previous, 400.0);
    assert.equal(delta.priceDelta?.current, 440.0);
    assert.equal(delta.priceDelta?.deltaPct, 10.0); // +10%
    assert.equal(delta.fairValueDelta?.previous, 450.0);
    assert.equal(delta.fairValueDelta?.current, 495.0);
    assert.equal(delta.fairValueDelta?.deltaPct, 10.0); // +10%
    assert.equal(delta.convictionScoreDelta?.deltaPoints, 5); // 85 - 80
    assert.equal(delta.revenueYoYDelta?.deltaPctPoints, 4.0); // 16 - 12
    assert.equal(delta.freeCashFlowDelta?.deltaPct, 20.0); // (18000 - 15000) / 15000 = +20%
    assert.equal(delta.valuationAssumptionsDelta.waccDeltaPoints, -0.5); // 8.0 - 8.5
    assert.equal(delta.valuationAssumptionsDelta.terminalGrowthDeltaPoints, 0.2); // 2.7 - 2.5
    assert.equal(delta.thesisChanged, true);
    assert.equal(delta.newRisksCount, 1); // Supply chain
    assert.equal(delta.resolvedRisksCount, 1); // Margin pressure
    assert.equal(delta.newCatalystsCount, 1); // Dividend hike
  });

  describe('Blocker A — SEC Authority Invariant', () => {
    it('prefers verified SEC facts over conflicting report statements (100000 vs 999999)', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          income_statement: {
            revenue: [999999] // Deliberately wrong AI / report value
          }
        },
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            {
              period: 'FY25',
              revenue: 100000 // Authoritative verified SEC value
            }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 100000);
      assert.equal(snap?.financials.provenance, 'sec_verified');
      assert.notEqual(snap?.financials.revenue, 999999);
    });

    it('does not promote unverified canonical dataset to sec_verified', () => {
      const report: any = {
        ticker: 'MSFT',
        canonical_financials: {
          schemaVersion: 1,
          ticker: 'MSFT',
          provenanceStatus: 'unverified',
          generatedBy: 'lumina-financial-provenance-v1',
          periods: ['FY25'],
          values: {
            'income_statement.revenue': [{ period: 'FY25', value: 200000 }]
          }
        },
        financial_statements: {
          periods: ['FY25'],
          income_statement: { revenue: [200000] }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.provenance, 'unverified');
      assert.notEqual(snap?.financials.provenance, 'sec_verified');
    });

    it('does not promote source-linked canonical dataset to sec_verified', () => {
      const report: any = {
        ticker: 'MSFT',
        canonical_financials: {
          schemaVersion: 1,
          ticker: 'MSFT',
          provenanceStatus: 'source_linked',
          generatedBy: 'lumina-financial-provenance-v1',
          periods: ['FY25'],
          values: {
            'income_statement.revenue': [{ period: 'FY25', value: 200000 }]
          }
        },
        financial_statements: {
          periods: ['FY25'],
          income_statement: { revenue: [200000] }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.provenance, 'unverified');
      assert.notEqual(snap?.financials.provenance, 'sec_verified');
    });

    it('accepts verified sec-xbrl canonical dataset as sec_verified', () => {
      const report: any = {
        ticker: 'MSFT',
        canonical_financials: {
          schemaVersion: 1,
          ticker: 'MSFT',
          provenanceStatus: 'verified',
          generatedBy: 'sec-xbrl-parser-v1',
          periods: ['FY25'],
          values: {
            'income_statement.revenue': [{ period: 'FY25', value: 245000, source: { form: '10-K', accession: '0001', filed: '2025-08-01' } }]
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.provenance, 'sec_verified');
      assert.equal(snap?.financials.revenue, 245000);
      assert.equal(snap?.evidence.secAccession, '0001');
    });

    it('never labels AI statements as sec_verified merely because sec_verification status is verified_eligible', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          income_statement: { revenue: [200000] }
        },
        sec_verification: {
          status: 'verified_eligible',
          financialDataSource: 'sec_verified'
          // No sec_period_statements or verified canonical_financials!
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.provenance, 'unverified');
      assert.notEqual(snap?.financials.provenance, 'sec_verified');
    });

    it('fails closed when report is SEC eligible but lacks trusted SEC fact for the field', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          income_statement: {
            revenue: [999999] // AI value present
          }
        },
        sec_verification: {
          status: 'verified_eligible',
          sec_period_statements: [
            {
              period: 'FY25'
              // revenue is NOT in SEC statements!
            }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.provenance, 'sec_verified');
      // Missing trusted SEC values remain missing (null). Must NOT substitute report value!
      assert.equal(snap?.financials.revenue, null);
    });
  });

  describe('Blocker B — Missing Short-Term Investments Must Not Become Zero', () => {
    it('sets netCash to null when short_term_investments is missing (Missing != Zero)', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          balance_sheet: {
            cash_and_equivalents: [10000],
            // short_term_investments is omitted/undefined!
            total_debt: [4000]
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.netCash, null);
    });

    it('calculates netCash correctly when short_term_investments is explicitly 0', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          balance_sheet: {
            cash_and_equivalents: [10000],
            short_term_investments: [0], // Explicit 0
            total_debt: [4000]
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.netCash, 6000); // 10000 + 0 - 4000
    });

    it('calculates netCash correctly when short_term_investments > 0', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['FY25'],
          balance_sheet: {
            cash_and_equivalents: [10000],
            short_term_investments: [5000],
            total_debt: [4000]
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.netCash, 11000); // 10000 + 5000 - 4000
    });
  });

  describe('Blocker C — Do Not Fabricate Historical Time / Identity', () => {
    it('uses deterministic ID and unknown timestamp without using Date.now()', () => {
      const report: any = {
        ticker: 'MSFT'
        // No id, no generated_at, no as_of_date
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.reportId, 'rep_msft_unknown');
      assert.equal(snap?.createdTimestamp, 0);
      assert.equal(snap?.asOfDate, 'Unknown Date');
    });

    it('does not treat unknown-time report as previous report purely because Date.now() was assigned', () => {
      const reportWithoutTime: any = {
        ticker: 'AAPL',
        id: 'rep_no_time'
        // No timestamps
      };

      const validReport: any = {
        ticker: 'AAPL',
        id: 'rep_valid',
        generated_at: '2026-05-01T00:00:00Z'
      };

      // getPreviousMemorySnapshot for reportWithoutTime should be null because its time is unknown
      const prev = getPreviousMemorySnapshot('AAPL', [reportWithoutTime, validReport], reportWithoutTime);
      assert.equal(prev, null);
    });
  });

  describe('Blocker 1 — SEC Memory YoY Must Actually Be YoY (Comparable Period Resolver)', () => {
    it('returns null revenueYoYPct when only Q4 2026 + Q3 2026 are present (QoQ != YoY)', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q3 2026', revenue: 50000 },
            { period: 'Q4 2026', revenue: 55000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 55000);
      // Q4 vs Q3 is QoQ, NOT YoY. Must be null!
      assert.equal(snap?.financials.revenueYoYPct, null);
    });

    it('calculates correct YoY when Q4 2026 + Q4 2025 are present', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q4 2025', revenue: 50000 },
            { period: 'Q4 2026', revenue: 60000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 60000);
      // (60000 - 50000) / 50000 = +20.00%
      assert.equal(snap?.financials.revenueYoYPct, 20.0);
    });

    it('calculates correct YoY when FY2026 + FY2025 are present', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'FY2025', revenue: 200000 },
            { period: 'FY2026', revenue: 230000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 230000);
      // (230000 - 200000) / 200000 = +15.00%
      assert.equal(snap?.financials.revenueYoYPct, 15.0);
    });

    it('returns null revenueYoYPct when non-consecutive years are present (FY2026 + FY2024)', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'FY2024', revenue: 180000 },
            { period: 'FY2026', revenue: 230000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 230000);
      assert.equal(snap?.financials.revenueYoYPct, null);
    });

    it('returns null revenueYoYPct when mixed quarterly and annual periods are present without comparable match', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'FY2025', revenue: 200000 },
            { period: 'Q4 2026', revenue: 60000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 60000);
      // FY vs Quarter is not comparable!
      assert.equal(snap?.financials.revenueYoYPct, null);
    });

    it('returns same correct YoY when input order is shuffled', () => {
      const reportShuffled: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q4 2026', revenue: 60000 },
            { period: 'Q3 2026', revenue: 54000 },
            { period: 'Q4 2025', revenue: 50000 }
          ]
        }
      };

      const snap = extractMemorySnapshot(reportShuffled);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 60000);
      // Matches Q4 2026 with Q4 2025 (ignoring Q3 2026) -> +20.0%
      assert.equal(snap?.financials.revenueYoYPct, 20.0);
    });
  });

  describe('Blocker 2 — Preserve Share-Count Semantics', () => {
    it('preserves currentSharesOutstandingM and dilutedWeightedAverageSharesM independently', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            {
              period: 'Q4 2026',
              revenue: 60000,
              diluted_shares: 7520 // Diluted shares from income statement period
            }
          ],
          dcf_financial_inputs: {
            version: 1,
            generated_by: 'sec-verified-financial-inputs-v1',
            current_shares_outstanding_m: 7450 // Current shares outstanding from balance sheet / snapshot
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.dilutedWeightedAverageSharesM, 7520);
      assert.equal(snap?.financials.currentSharesOutstandingM, 7450);
      // sharesOutstanding explicitly maps to current shares
      assert.equal(snap?.financials.sharesOutstanding, 7450);
      assert.notEqual(snap?.financials.currentSharesOutstandingM, snap?.financials.dilutedWeightedAverageSharesM);
    });

    it('never silently substitutes diluted shares for current shares when DCF shares are missing', () => {
      const report: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            {
              period: 'Q4 2026',
              revenue: 60000,
              diluted_shares: 7520
            }
          ]
          // No dcf_financial_inputs / current shares
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.dilutedWeightedAverageSharesM, 7520);
      assert.equal(snap?.financials.currentSharesOutstandingM, null);
      assert.equal(snap?.financials.sharesOutstanding, null);
    });
  });

  describe('Blocker 3 — Report Financials Provenance Must Be Truthful', () => {
    it('labels raw report financials as unverified, never calculated or sec_verified', () => {
      const report: any = {
        ticker: 'MSFT',
        financial_statements: {
          periods: ['Q4 2026'],
          income_statement: {
            revenue: [65000]
          }
        }
      };

      const snap = extractMemorySnapshot(report);
      assert.ok(snap);
      assert.equal(snap?.financials.revenue, 65000);
      assert.equal(snap?.financials.provenance, 'unverified');
      assert.notEqual(snap?.financials.provenance, 'sec_verified');
      assert.notEqual(snap?.financials.provenance, 'calculated');
    });
  });

  describe('Blocker 4 — Do Not Mix FCF Period Bases', () => {
    it('sets correct FCF period basis on snapshots', () => {
      const secQuarterReport: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            {
              period: 'Q4 2026',
              revenue: 60000,
              operating_cash_flow: 25000,
              capital_expenditure: 5000
            }
          ]
        }
      };

      const secLtmReport: any = {
        ticker: 'MSFT',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q4 2026', revenue: 60000 }
          ],
          dcf_financial_inputs: {
            version: 1,
            generated_by: 'sec-verified-financial-inputs-v1',
            trailing_four_free_cash_flow_m: 75000
          }
        }
      };

      const snapQuarter = extractMemorySnapshot(secQuarterReport);
      const snapLtm = extractMemorySnapshot(secLtmReport);

      assert.equal(snapQuarter?.financials.freeCashFlow, 20000);
      assert.equal(snapQuarter?.financials.freeCashFlowPeriodBasis, 'QUARTER');

      assert.equal(snapLtm?.financials.freeCashFlow, 75000);
      assert.equal(snapLtm?.financials.freeCashFlowPeriodBasis, 'LTM');
    });

    it('rejects comparing quarterly FCF against LTM FCF in compareMemorySnapshots', () => {
      const snapQuarter = extractMemorySnapshot({
        ticker: 'MSFT',
        id: 'rep_q',
        as_of_date: '2026-06-30',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q2 2026', revenue: 50000, operating_cash_flow: 20000, capital_expenditure: 4000 }
          ]
        }
      });

      const snapLtm = extractMemorySnapshot({
        ticker: 'MSFT',
        id: 'rep_ltm',
        as_of_date: '2026-09-30',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q3 2026', revenue: 55000 }
          ],
          dcf_financial_inputs: {
            version: 1,
            generated_by: 'sec-verified-financial-inputs-v1',
            trailing_four_free_cash_flow_m: 75000
          }
        }
      });

      assert.ok(snapQuarter && snapLtm);
      const delta = compareMemorySnapshots(snapLtm, snapQuarter);
      // Quarterly (16000) vs LTM (75000) have different period bases -> delta unavailable!
      assert.equal(delta.freeCashFlowDelta, null);
    });

    it('allows comparing FCF when period bases are identical', () => {
      const snapQ1 = extractMemorySnapshot({
        ticker: 'MSFT',
        id: 'rep_q1',
        as_of_date: '2026-03-31',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q1 2026', revenue: 50000, operating_cash_flow: 20000, capital_expenditure: 5000 }
          ]
        }
      });

      const snapQ2 = extractMemorySnapshot({
        ticker: 'MSFT',
        id: 'rep_q2',
        as_of_date: '2026-06-30',
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [
            { period: 'Q2 2026', revenue: 55000, operating_cash_flow: 25000, capital_expenditure: 7000 }
          ]
        }
      });

      assert.ok(snapQ1 && snapQ2);
      const delta = compareMemorySnapshots(snapQ2, snapQ1);
      // Q1: 15000, Q2: 18000 -> (18000 - 15000) / 15000 = +20.00%
      assert.ok(delta.freeCashFlowDelta);
      assert.equal(delta.freeCashFlowDelta?.deltaPct, 20.0);
    });
  });
});
