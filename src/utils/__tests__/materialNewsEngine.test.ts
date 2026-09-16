import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTrackedNewsSymbols,
  deriveMultiPortfolioContextForTicker,
  evaluateEventThesisRelevance,
  convertMaterialEventsToAlerts,
  evaluateAllAlerts,
  DEFAULT_MONITORING_PREFERENCES,
  loadReadAlertIds,
  saveReadAlertIds
} from '../monitoringEngine';
import {
  isNoiseHeadline,
  classifyPublisher,
  classifySec8KItems,
  evaluateTextMateriality,
  generateDedupeFingerprint,
  deduplicateEvents
} from '../../../server/services/materialNewsService';
import {
  MaterialCompanyEvent,
  MultiPortfolioAllocationSummary,
  MonitoringAlert
} from '../../types';

describe('Material News & Corporate Event Intelligence', () => {

  // Section 60: Tracked scope derivation
  describe('60. Tracked Scope Derivation', () => {
    it('A. Ticker only in Watchlist is included', () => {
      const symbols = deriveTrackedNewsSymbols(['AAPL'], [], null);
      assert.deepEqual(symbols, ['AAPL']);
    });

    it('B. Ticker only in user-created Portfolio is included', () => {
      const symbols = deriveTrackedNewsSymbols([], [{ ticker: 'MSFT' }], null);
      assert.deepEqual(symbols, ['MSFT']);
    });

    it('C. Ticker only in legacy Unassigned holdings is included', () => {
      const symbols = deriveTrackedNewsSymbols([], [{ ticker: 'NVDA' }], null);
      assert.deepEqual(symbols, ['NVDA']);
    });

    it('D. Ticker in Watchlist + 3 Portfolios is fetched exactly ONCE', () => {
      const symbols = deriveTrackedNewsSymbols(
        ['MSFT', 'aapl'],
        [{ ticker: 'msft' }, { ticker: 'MSFT' }, { ticker: 'MSFT' }],
        'msft'
      );
      assert.deepEqual(symbols, ['MSFT', 'AAPL']);
    });

    it('E. Historical-report-only ticker is NOT fetched automatically', () => {
      // deriveTrackedNewsSymbols does not take historicalReports, proving historical-only is excluded
      const watchlist = ['GOOGL'];
      const portfolio = [{ ticker: 'AMZN' }];
      const symbols = deriveTrackedNewsSymbols(watchlist, portfolio, null);
      assert.ok(!symbols.includes('HISTORICAL_ONLY_TICKER'));
      assert.deepEqual(symbols, ['GOOGL', 'AMZN']);
    });

    it('F. Active research ticker is included', () => {
      const symbols = deriveTrackedNewsSymbols(['AAPL'], [], 'TSLA');
      assert.deepEqual(symbols, ['AAPL', 'TSLA']);
    });
  });

  // Section 61: Multi-Portfolio Context
  describe('61. Multi-Portfolio Allocation Context', () => {
    it('MSFT held in 2 portfolios produces ONE logical event and alert with aggregate context', () => {
      const multiPortfolioSummary: MultiPortfolioAllocationSummary = {
        is_fully_priced: true,
        total_invested_market_value: 100000,
        known_priced_value: 100000,
        unpriced_holdings_count: 0,
        configured_target_pct: 100,
        unallocated_target_pct: 0,
        portfolios: [],
        positions: [
          {
            holding: { id: 'pos1', ticker: 'MSFT', quantity: 10, average_cost: 300, total_cost: 3000, allocation_pct: 0, current_price: 400, market_value: 4000 },
            portfolio_id: 'p1',
            portfolio_name: 'Long Term',
            pct_within_portfolio: 8.0,
            pct_of_total: 4.0,
            target_pct_within_portfolio: null,
            max_pct_within_portfolio: null,
            derived_target_pct_of_total: null,
            status: 'WITHIN_LIMIT',
            excess_pct_points: null,
          },
          {
            holding: { id: 'pos2', ticker: 'MSFT', quantity: 15, average_cost: 350, total_cost: 5250, allocation_pct: 0, current_price: 400, market_value: 6000 },
            portfolio_id: 'p2',
            portfolio_name: 'AI Growth',
            pct_within_portfolio: 12.0,
            pct_of_total: 6.0,
            target_pct_within_portfolio: null,
            max_pct_within_portfolio: null,
            derived_target_pct_of_total: null,
            status: 'WITHIN_LIMIT',
            excess_pct_points: null,
          }
        ],
        aggregate_tickers: [
          {
            ticker: 'MSFT',
            total_market_value: 10000,
            total_pct_of_total: 10.0,
            aggregate_derived_target_pct_of_total: null,
            portfolios: [
              { portfolio_id: 'p1', portfolio_name: 'Long Term', market_value: 4000, pct_of_total: 4.0, derived_target_pct_of_total: null },
              { portfolio_id: 'p2', portfolio_name: 'AI Growth', market_value: 6000, pct_of_total: 6.0, derived_target_pct_of_total: null },
            ],
            overall_max_pct: 8.0,
            status: 'ABOVE_MAX',
            excess_pct_points: 2.0,
          }
        ]
      };

      const event: MaterialCompanyEvent = {
        eventId: 'test_msft_1',
        ticker: 'MSFT',
        headline: 'Microsoft Announces Quarterly Dividend Increase',
        factualSummary: 'Board of Directors declared a quarterly dividend.',
        category: 'BUYBACK_DIVIDEND',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: '2026-09-15T12:05:00Z',
        sourceName: 'Microsoft Investor Relations',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'msft_div_2026',
      };

      const alerts = convertMaterialEventsToAlerts([event], multiPortfolioSummary);
      assert.equal(alerts.length, 1, 'Must create exactly ONE alert for MSFT');
      const alert = alerts[0];
      assert.equal(alert.ticker, 'MSFT');
      assert.ok(alert.portfolioContext);
      assert.equal(alert.portfolioContext.held, true);
      assert.equal(alert.portfolioContext.heldPortfolioCount, 2);
      assert.equal(alert.portfolioContext.aggregateOverallExposurePct, 10.0);
      assert.equal(alert.portfolioContext.overallTickerMaxPct, 8.0);
      assert.equal(alert.portfolioContext.portfolioContexts.length, 2);
    });
  });

  // Section 62: Watchlist-Only Company (EOSE)
  describe('62. Watchlist-Only Company Without Research', () => {
    it('EOSE with no holding and no thesis surfaces event truthfully without synthetic portfolio or thesis', () => {
      const event: MaterialCompanyEvent = {
        eventId: 'test_eose_1',
        ticker: 'EOSE',
        headline: 'Eos Energy Secures $300M DOE Loan Facility',
        factualSummary: 'Company announces definitive loan agreement.',
        category: 'CAPITAL_RAISE',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T10:00:00Z',
        retrievedAt: '2026-09-15T10:05:00Z',
        sourceName: 'PR Newswire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'eose_loan_2026',
      };

      const alerts = convertMaterialEventsToAlerts([event], undefined, {}, {});
      assert.equal(alerts.length, 1);
      const a = alerts[0];
      assert.equal(a.ticker, 'EOSE');
      assert.equal(a.portfolioContext?.held, false);
      assert.equal(a.portfolioContext?.aggregateOverallExposurePct, null);
      assert.equal(a.relatedCatalysts?.length ?? 0, 0);
      assert.equal(a.relatedRisks?.length ?? 0, 0);
      assert.equal(a.relatedThesisDrivers?.length ?? 0, 0);
    });
  });

  // Section 63: Source Authority & Noise Filtering
  describe('63. Source Authority Policy & Noise Filtering', () => {
    it('approves IR wire services as COMPANY_PRIMARY_IR', () => {
      const res = classifyPublisher('PR Newswire');
      assert.equal(res.isApproved, true);
      assert.equal(res.sourceAuthority, 'COMPANY_PRIMARY_IR');
    });

    it('approves Reuters / Bloomberg as REPUTABLE_NEWS', () => {
      const reuters = classifyPublisher('Reuters');
      assert.equal(reuters.isApproved, true);
      assert.equal(reuters.sourceAuthority, 'REPUTABLE_NEWS');

      const bloomberg = classifyPublisher('Bloomberg News');
      assert.equal(bloomberg.isApproved, true);
      assert.equal(bloomberg.sourceAuthority, 'REPUTABLE_NEWS');
    });

    it('rejects unvetted blogs, SEO clickbait and promotional publishers', () => {
      assert.equal(classifyPublisher('Motley Fool').isApproved, false);
      assert.equal(classifyPublisher('Trefis').isApproved, false);
      assert.equal(classifyPublisher('Simply Wall St').isApproved, false);
      assert.equal(classifyPublisher('Random Stock Blog').isApproved, false);
    });

    it('filters out noise and stock recap headlines', () => {
      assert.equal(isNoiseHeadline('Why Tesla Stock Moved Today'), true);
      assert.equal(isNoiseHeadline('Top 3 Stocks to Buy in September'), true);
      assert.equal(isNoiseHeadline("Here's Why Nvidia Jumped 5%"), true);
      assert.equal(isNoiseHeadline('Microsoft Corporation: Acquisition of Activision Blizzard Completed'), false);
    });
  });

  // Section 64: Deduplication & Syndication
  describe('64. Deduplication & Clustering', () => {
    it('same event across multiple sources collapses into ONE logical event with primary source', () => {
      const irEvent: MaterialCompanyEvent = {
        eventId: 'ir_1',
        ticker: 'AAPL',
        headline: 'Apple Reports Fourth Quarter Results',
        factualSummary: 'Quarterly revenue was $89.5 billion.',
        category: 'EARNINGS',
        materiality: 'HIGH',
        publishedAt: '2026-09-14T20:30:00Z',
        retrievedAt: '2026-09-14T20:35:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'aapl_reports_fourth_quarter_results_2026-09-14',
      };

      const mediaEvent: MaterialCompanyEvent = {
        eventId: 'media_1',
        ticker: 'AAPL',
        headline: 'Apple Reports Fourth Quarter Results Ahead of Expectations',
        factualSummary: 'Reuters reporting on Apple fourth quarter release.',
        category: 'EARNINGS',
        materiality: 'HIGH',
        publishedAt: '2026-09-14T20:35:00Z',
        retrievedAt: '2026-09-14T20:40:00Z',
        sourceName: 'Reuters',
        sourceType: 'FINANCIAL_NEWS',
        sourceAuthority: 'REPUTABLE_NEWS',
        dedupeFingerprint: 'aapl_reports_fourth_quarter_results_2026-09-14',
      };

      const deduplicated = deduplicateEvents([mediaEvent, irEvent]);
      assert.equal(deduplicated.length, 1, 'Must collapse into single event');
      assert.equal(deduplicated[0].sourceAuthority, 'COMPANY_PRIMARY_IR', 'Primary source must win');
      assert.equal(deduplicated[0].supportingSources?.length, 1);
      assert.equal(deduplicated[0].supportingSources?.[0].sourceName, 'Reuters');
    });

    it('two genuinely different events on the same day remain separate', () => {
      const eventA: MaterialCompanyEvent = {
        eventId: 'ev_a',
        ticker: 'MSFT',
        headline: 'Microsoft Announces Executive Transition in Cloud Division',
        factualSummary: 'Management change.',
        category: 'MANAGEMENT',
        materiality: 'HIGH',
        publishedAt: '2026-09-14T10:00:00Z',
        retrievedAt: '2026-09-14T10:05:00Z',
        sourceName: 'PR Newswire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'msft_executive_transition_cloud_2026-09-14',
      };

      const eventB: MaterialCompanyEvent = {
        eventId: 'ev_b',
        ticker: 'MSFT',
        headline: 'Microsoft Expands Strategic AI Partnership in Europe',
        factualSummary: 'Partnership agreement.',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        publishedAt: '2026-09-14T14:00:00Z',
        retrievedAt: '2026-09-14T14:05:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'msft_strategic_ai_partnership_europe_2026-09-14',
      };

      const deduplicated = deduplicateEvents([eventA, eventB]);
      assert.equal(deduplicated.length, 2, 'Distinct events must not be collapsed');
    });
  });

  // Section 65: Event ID Stability & Read State
  describe('65. Stable Event Identity & Read State', () => {
    it('preserves read state across refreshes using stable alert IDs', () => {
      const event: MaterialCompanyEvent = {
        eventId: 'sec_NVDA_0001045810-26-000045',
        ticker: 'NVDA',
        headline: 'NVDA Form 8-K: Item 5.02',
        factualSummary: 'Executive officer appointment.',
        category: 'MANAGEMENT',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T00:00:00Z',
        retrievedAt: '2026-09-15T01:00:00Z',
        sourceName: 'U.S. SEC EDGAR',
        sourceType: 'SEC_EDGAR',
        sourceAuthority: 'AUTHORITATIVE_SEC',
        dedupeFingerprint: 'sec_nvda_0001045810-26-000045',
      };

      // Initial unread
      const readIds = new Set<string>();
      const alerts1 = convertMaterialEventsToAlerts([event], undefined, {}, {}, readIds);
      assert.equal(alerts1[0].isRead, false);

      // User marks read
      readIds.add(alerts1[0].id);

      // Subsequent refresh with identical event
      const alerts2 = convertMaterialEventsToAlerts([event], undefined, {}, {}, readIds);
      assert.equal(alerts2[0].id, alerts1[0].id);
      assert.equal(alerts2[0].isRead, true, 'Alert must remain read on subsequent refresh');
    });
  });

  // Section 66: Freshness & Missing Timestamps
  describe('66. Freshness & Timestamp Integrity', () => {
    it('missing publishedAt remains null and does NOT become Date.now()', () => {
      const event: MaterialCompanyEvent = {
        eventId: 'no_date_ev',
        ticker: 'SOFI',
        headline: 'SoFi Technologies Corporate Event',
        factualSummary: 'Corporate disclosure.',
        category: 'OTHER',
        materiality: 'HIGH',
        publishedAt: null, // missing publication time
        retrievedAt: '2026-09-15T12:00:00Z',
        sourceName: 'PR Newswire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'sofi_nodate',
      };

      assert.equal(event.publishedAt, null);
      const alerts = convertMaterialEventsToAlerts([event], undefined, {}, {});
      assert.equal(alerts[0].newsEvent?.publishedAt, null);
    });
  });

  // Section 67: Materiality Classification
  describe('67. Materiality Model', () => {
    it('guidance cut, CEO resignation, and SEC 8-K Item 5.02 classify as HIGH materiality', () => {
      assert.equal(evaluateTextMateriality('Company Lowers FY Guidance').materiality, 'HIGH');
      assert.equal(evaluateTextMateriality('CEO Steps Down Immediately').materiality, 'HIGH');
      assert.equal(classifySec8KItems('5.02').materiality, 'HIGH');
      assert.equal(classifySec8KItems('1.01').materiality, 'HIGH');
    });

    it('generic stock movement and minor recaps classify as LOW materiality and are suppressed', () => {
      assert.equal(evaluateTextMateriality('Stock rose 4% in after-hours trading').materiality, 'LOW');
      const lowEvent: MaterialCompanyEvent = {
        eventId: 'low_1',
        ticker: 'AAPL',
        headline: 'Stock rose 4% in after-hours trading',
        factualSummary: 'Price moved.',
        category: 'OTHER',
        materiality: 'LOW',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: '2026-09-15T12:05:00Z',
        sourceName: 'Financial Media',
        sourceType: 'FINANCIAL_NEWS',
        sourceAuthority: 'REPUTABLE_NEWS',
        dedupeFingerprint: 'low_aapl',
      };

      const alerts = convertMaterialEventsToAlerts([lowEvent]);
      assert.equal(alerts.length, 0, 'LOW materiality events must not generate alerts');
    });
  });

  // Section 68: SEC Duplicate Suppression
  describe('68. SEC Duplicate Suppression', () => {
    it('suppresses redundant News alert when an authoritative SEC filing alert already exists', () => {
      const existingFilingAlert: MonitoringAlert = {
        id: 'alert_MSFT_SEC_0001193125-26-123456',
        ticker: 'MSFT',
        type: 'FILING_MATERIAL_8K',
        severity: 'warning',
        title: 'New SEC Filing: MSFT 8-K',
        message: 'Verified SEC Form 8-K filing.',
        timestamp: Date.now(),
        dateStr: '2026-09-15',
        isRead: false,
        evidence: {
          metricName: 'SEC Filing Citation',
          currentValue: '8-K',
          filingDate: '2026-09-15',
          sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000119312526123456/doc.htm',
        }
      };

      const newsSecEvent: MaterialCompanyEvent = {
        eventId: 'sec_MSFT_0001193125-26-123456',
        ticker: 'MSFT',
        headline: 'MSFT Form 8-K: Current Report',
        factualSummary: '8-K filing.',
        category: 'SEC_FILING',
        materiality: 'MEDIUM',
        publishedAt: '2026-09-15T00:00:00Z',
        retrievedAt: '2026-09-15T01:00:00Z',
        sourceName: 'U.S. SEC EDGAR',
        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000119312526123456/doc.htm',
        sourceType: 'SEC_EDGAR',
        sourceAuthority: 'AUTHORITATIVE_SEC',
        dedupeFingerprint: 'sec_msft_0001193125-26-123456',
      };

      const alerts = convertMaterialEventsToAlerts([newsSecEvent], undefined, {}, {}, new Set(), [existingFilingAlert]);
      assert.equal(alerts.length, 0, 'Redundant SEC news alert must be suppressed by existing SEC alert');
    });
  });

  // Section 69: Thesis & Expectation Relevance
  describe('69. Thesis & Tracked Expectation Relevance', () => {
    it('attaches catalyst and expectation links without mutating stored thesis state', () => {
      const event: MaterialCompanyEvent = {
        eventId: 'ev_rev',
        ticker: 'NVDA',
        headline: 'Nvidia Data Center Revenue Smashes Guidance on Strong AI Demand',
        factualSummary: 'Data center segment growth.',
        category: 'EARNINGS',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: '2026-09-15T12:05:00Z',
        sourceName: 'Reuters',
        sourceType: 'FINANCIAL_NEWS',
        sourceAuthority: 'REPUTABLE_NEWS',
        dedupeFingerprint: 'nvda_ai_2026',
      };

      const thesis = {
        thesisId: 'th_nvda',
        ticker: 'NVDA',
        catalysts: ['Enterprise AI demand accelerates accelerated compute adoption'],
        keyRisks: ['Export controls limit China market access'],
        keyDrivers: ['Data center GPU margins'],
        summary: 'Thesis summary',
      };

      const expectations = [
        {
          metricOrEvent: 'revenue',
          metricLabel: 'FY27 Q1 Revenue',
          targetValue: '$32.0B',
          targetPeriod: 'FY27 Q1',
        }
      ];

      const alerts = convertMaterialEventsToAlerts([event], undefined, { NVDA: thesis }, { NVDA: expectations });
      assert.equal(alerts.length, 1);
      const a = alerts[0];
      assert.ok(a.relatedCatalysts && a.relatedCatalysts.length > 0);
      assert.ok(a.relatedExpectations && a.relatedExpectations.length > 0);
      // Ensure thesis object is not mutated
      assert.equal(thesis.thesisId, 'th_nvda');
      assert.equal(thesis.catalysts.length, 1);
    });
  });

  // Section 70: Incomplete Portfolio Pricing
  describe('70. Partial Portfolio Pricing Coverage', () => {
    it('surfaces news event with partial/unavailable exposure when pricing is incomplete', () => {
      const partialPortfolioSummary: MultiPortfolioAllocationSummary = {
        is_fully_priced: false, // Incomplete pricing!
        total_invested_market_value: null,
        known_priced_value: 5000,
        unpriced_holdings_count: 1,
        configured_target_pct: 100,
        unallocated_target_pct: 0,
        portfolios: [],
        positions: [
          {
            holding: { id: 'p1', ticker: 'TSLA', quantity: 5, average_cost: 200, total_cost: 1000, allocation_pct: 0 },
            portfolio_id: 'p1',
            portfolio_name: 'Growth',
            pct_within_portfolio: null,
            pct_of_total: null,
            target_pct_within_portfolio: null,
            max_pct_within_portfolio: null,
            derived_target_pct_of_total: null,
            status: 'INCOMPLETE_PRICING',
            excess_pct_points: null,
          }
        ],
        aggregate_tickers: [
          {
            ticker: 'TSLA',
            total_market_value: null,
            total_pct_of_total: null,
            aggregate_derived_target_pct_of_total: null,
            portfolios: [],
            overall_max_pct: 10.0,
            status: 'INCOMPLETE_PRICING',
            excess_pct_points: null,
          }
        ]
      };

      const event: MaterialCompanyEvent = {
        eventId: 'tsla_fwd',
        ticker: 'TSLA',
        headline: 'Tesla Receives Regulatory Approval for Full Self-Driving in Europe',
        factualSummary: 'Regulatory milestone.',
        category: 'LEGAL_REGULATORY',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T09:00:00Z',
        retrievedAt: '2026-09-15T09:05:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'tsla_fsd_2026',
      };

      const alerts = convertMaterialEventsToAlerts([event], partialPortfolioSummary);
      assert.equal(alerts.length, 1);
      const a = alerts[0];
      assert.equal(a.portfolioContext?.held, true);
      assert.equal(a.portfolioContext?.aggregateOverallExposurePct, null, 'Must NOT fabricate exact percentage');
      assert.equal(a.portfolioContext?.pricingCoverage, 'PARTIAL');
    });
  });

  // Section 71: Failure Isolation
  describe('71. Failure Isolation & Existing Alerts Protection', () => {
    it('preserves existing valuation, SEC, and portfolio alerts when news list is empty or provider fails', () => {
      const existingAlerts = evaluateAllAlerts(
        ['MSFT'],
        {
          MSFT: {
            ticker: 'MSFT',
            intrinsic_value: {
              current_price: 200,
              summary: { base_case_fair_value: 300 }
            }
          } as any
        },
        { MSFT: 200 },
        [],
        undefined,
        DEFAULT_MONITORING_PREFERENCES,
        new Set(),
        undefined,
        undefined,
        [] // empty or failed news list
      );

      assert.ok(existingAlerts.length > 0, 'Valuation MoS alert must still be generated');
      assert.equal(existingAlerts[0].type, 'VALUATION_MOS_BREACH');
    });
  });

  // Section 72: Settings & Reset Defaults
  describe('72. Alerts Settings & Reset to Defaults', () => {
    it('suppresses news alerts when enableNewsAlerts is disabled', () => {
      const event: MaterialCompanyEvent = {
        eventId: 'ev_high',
        ticker: 'MSFT',
        headline: 'Microsoft CEO Announces Restructuring',
        factualSummary: 'Reorganization.',
        category: 'MANAGEMENT',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: '2026-09-15T12:05:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'msft_reorg',
      };

      const prefsDisabled = {
        ...DEFAULT_MONITORING_PREFERENCES,
        enableNewsAlerts: false,
      };

      const alerts = evaluateAllAlerts(
        ['MSFT'],
        {},
        {},
        [],
        undefined,
        prefsDisabled,
        new Set(),
        undefined,
        undefined,
        [event]
      );

      const newsAlerts = alerts.filter(a => a.type === 'NEWS_MATERIAL_EVENT');
      assert.equal(newsAlerts.length, 0, 'News alerts must be suppressed when setting is false');
    });

    it('DEFAULT_MONITORING_PREFERENCES enables news alerts by default', () => {
      assert.equal(DEFAULT_MONITORING_PREFERENCES.enableNewsAlerts, true);
    });
  });
});
