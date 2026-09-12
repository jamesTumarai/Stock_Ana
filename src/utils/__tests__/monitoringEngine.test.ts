import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateTickerAlerts,
  evaluateAllAlerts,
  DEFAULT_MONITORING_PREFERENCES
} from '../monitoringEngine';
import { ReportData, PortfolioSummary } from '../../types';

describe('monitoringEngine', () => {
  it('evaluates MoS valuation alert when price is below fair value beyond threshold', () => {
    const report: any = {
      ticker: 'MSFT',
      report_date: '2026-03-01',
      intrinsic_value: {
        summary: { base_case_fair_value: 500 }
      }
    };
    // Price = 400, Fair Value = 500 -> MoS = +25% (exceeds default 20% threshold)
    const alerts = evaluateTickerAlerts('MSFT', report, 400);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'VALUATION_MOS_BREACH');
    assert.equal(alerts[0].severity, 'info');
    assert.equal(alerts[0].evidence.currentValue, '25%');
    assert.equal(alerts[0].evidence.thresholdValue, '20%');
  });

  it('triggers critical severity for extreme deep discount (MoS >= 35%)', () => {
    const report: any = {
      ticker: 'SOFI',
      report_date: '2026-03-01',
      intrinsic_value: {
        summary: { base_case_fair_value: 20 }
      }
    };
    // Price = 12, Fair Value = 20 -> MoS = +66.7%
    const alerts = evaluateTickerAlerts('SOFI', report, 12);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'VALUATION_MOS_BREACH');
    assert.equal(alerts[0].severity, 'critical');
  });

  it('evaluates Overvalued alert when price trades at high premium over fair value', () => {
    const report: any = {
      ticker: 'NVDA',
      report_date: '2026-03-01',
      intrinsic_value: {
        summary: { base_case_fair_value: 100 }
      }
    };
    // Price = 130, Fair Value = 100 -> +30% premium (> 15% threshold)
    const alerts = evaluateTickerAlerts('NVDA', report, 130);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'VALUATION_OVERVALUED');
    assert.equal(alerts[0].severity, 'warning');
    assert.equal(alerts[0].evidence.currentValue, '+30%');
  });

  it('evaluates Conviction Score Shift when conviction changes >= 10 points', () => {
    const curReport: any = {
      ticker: 'AAPL',
      report_date: '2026-03-01',
      verdict: { conviction_score: 90 }
    };
    const prevReport: any = {
      ticker: 'AAPL',
      report_date: '2026-01-01',
      verdict: { conviction_score: 75 }
    };

    const alerts = evaluateTickerAlerts('AAPL', curReport, null, prevReport);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'CONVICTION_SHIFT');
    assert.equal(alerts[0].severity, 'info'); // +15 upgrade
    assert.equal(alerts[0].evidence.currentValue, 90);
    assert.equal(alerts[0].evidence.previousValue, 75);
  });

  it('evaluates SEC Filing alerts for 10-K and 8-K filings', () => {
    const report: any = {
      ticker: 'MSFT',
      report_date: '2026-03-01',
      findings: [
        {
          document_type: '10-K',
          period: 'FY2025',
          finding: 'Full audited annual report filing',
          source_url: 'https://sec.gov/edgar'
        }
      ]
    };

    const alerts = evaluateTickerAlerts('MSFT', report);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'FILING_NEW_10K_10Q');
    assert.equal(alerts[0].severity, 'info');
    assert.equal(alerts[0].evidence.filingType, '10-K');
    assert.equal(alerts[0].evidence.sourceUrl, 'https://sec.gov/edgar');
  });

  it('evaluates Portfolio Concentration Risk alert', () => {
    const portfolioSummary: PortfolioSummary = {
      total_market_value: 10000,
      total_cost_basis: 9000,
      total_unrealized_pnl: 1000,
      total_unrealized_pnl_pct: 11.1,
      holdings_count: 2,
      top_holding_concentration_pct: 45,
      concentration_risk_alert: true,
      sector_breakdown: [],
      priced_holdings_count: 2,
      unpriced_holdings_count: 0,
      pricing_coverage_pct: 100,
      priced_market_value: 10000,
      unpriced_cost_basis: 0,
      is_fully_priced: true,
      computed_holdings: [
        { ticker: 'MSFT', quantity: 10, average_cost: 400, total_cost: 4000, allocation_pct: 45 },
        { ticker: 'AAPL', quantity: 20, average_cost: 250, total_cost: 5000, allocation_pct: 55 }
      ]
    };

    const alerts = evaluateTickerAlerts('MSFT', undefined, null, undefined, portfolioSummary);

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'PORTFOLIO_CONCENTRATION');
    assert.equal(alerts[0].severity, 'warning');
    assert.equal(alerts[0].evidence.currentValue, '45%');
  });

  it('evaluateAllAlerts: aggregates, deduplicates, and sorts alerts by unread and severity', () => {
    const tickers = ['MSFT', 'NVDA'];
    const latestReports: any = {
      MSFT: {
        ticker: 'MSFT',
        report_date: '2026-03-01',
        intrinsic_value: { summary: { base_case_fair_value: 500 } }
      },
      NVDA: {
        ticker: 'NVDA',
        report_date: '2026-03-01',
        intrinsic_value: { summary: { base_case_fair_value: 100 } }
      }
    };
    const quotes = {
      MSFT: 400, // MoS 25% (severity: info)
      NVDA: 140  // Premium 40% (severity: warning)
    };

    const readIds = new Set<string>(['alert_MSFT_VALUATION_MOS_400_500']);

    const allAlerts = evaluateAllAlerts(tickers, latestReports, quotes, [], undefined, DEFAULT_MONITORING_PREFERENCES, readIds);

    assert.equal(allAlerts.length, 2);
    // Unread (NVDA) should come before read (MSFT)
    assert.equal(allAlerts[0].ticker, 'NVDA');
    assert.equal(allAlerts[0].isRead, false);
    assert.equal(allAlerts[1].ticker, 'MSFT');
    assert.equal(allAlerts[1].isRead, true);
  });

  it('generates distinct stable fingerprints for different valuation levels', () => {
    const report: any = {
      ticker: 'MSFT',
      report_date: '2026-03-01',
      intrinsic_value: { summary: { base_case_fair_value: 500 } }
    };
    const alertsA = evaluateTickerAlerts('MSFT', report, 380);
    const alertsB = evaluateTickerAlerts('MSFT', report, 350);

    assert.equal(alertsA[0].id, 'alert_MSFT_VALUATION_MOS_380_500');
    assert.equal(alertsB[0].id, 'alert_MSFT_VALUATION_MOS_350_500');
    assert.notEqual(alertsA[0].id, alertsB[0].id);
  });

  it('suppresses SEC filing alert when previous report already cited the exact same filing', () => {
    const prevReport: any = {
      ticker: 'MSFT',
      report_date: '2026-02-01',
      findings: [
        {
          document_type: '10-K',
          quarter_period: 'FY2025',
          source_url: 'https://www.sec.gov/Archives/edgar/data/789019/0000950170-25-000100/msft-20250630.htm'
        }
      ]
    };

    const latestReportSameFiling: any = {
      ticker: 'MSFT',
      report_date: '2026-03-01',
      findings: [
        {
          document_type: '10-K',
          quarter_period: 'FY2025',
          source_url: 'https://www.sec.gov/Archives/edgar/data/789019/0000950170-25-000100/msft-20250630.htm'
        }
      ]
    };

    const latestReportNewFiling: any = {
      ticker: 'MSFT',
      report_date: '2026-04-01',
      findings: [
        {
          document_type: '10-Q',
          quarter_period: 'Q3-2026',
          source_url: 'https://www.sec.gov/Archives/edgar/data/789019/0000950170-26-000200/msft-20260331.htm'
        }
      ]
    };

    const alertsSame = evaluateTickerAlerts('MSFT', latestReportSameFiling, null, prevReport);
    assert.equal(alertsSame.filter(a => a.type.startsWith('FILING')).length, 0);

    const alertsNew = evaluateTickerAlerts('MSFT', latestReportNewFiling, null, prevReport);
    const filingAlerts = alertsNew.filter(a => a.type.startsWith('FILING'));
    assert.equal(filingAlerts.length, 1);
    assert.equal(filingAlerts[0].id, 'alert_MSFT_SEC_0000950170-26-000200');
  });

  it('evaluates conviction shift accurately using canonical previous report resolution', () => {
    const historicalReports = [
      {
        id: 'rep-3',
        ticker: 'AAPL',
        createdAt: '2026-03-01T10:00:00.000Z',
        data: {
          ticker: 'AAPL',
          report_date: '2026-03-01',
          verdict: { conviction_score: 92 }
        }
      },
      {
        id: 'rep-2',
        ticker: 'AAPL',
        createdAt: '2026-02-15T10:00:00.000Z',
        data: {
          ticker: 'AAPL',
          report_date: '2026-02-15',
          verdict: { conviction_score: 78 }
        }
      },
      {
        id: 'rep-1',
        ticker: 'AAPL',
        createdAt: '2026-01-10T10:00:00.000Z',
        data: {
          ticker: 'AAPL',
          report_date: '2026-01-10',
          verdict: { conviction_score: 70 }
        }
      }
    ];

    const currentLatest: any = historicalReports[0].data;

    const allAlerts = evaluateAllAlerts(
      ['AAPL'],
      { AAPL: currentLatest },
      {},
      historicalReports
    );

    const convictionAlert = allAlerts.find(a => a.type === 'CONVICTION_SHIFT');
    assert.ok(convictionAlert);
    // Compares latest (92) against strictly previous rep-2 (78) -> +14 diff
    assert.equal(convictionAlert?.evidence.previousValue, 78);
    assert.equal(convictionAlert?.evidence.currentValue, 92);
    assert.equal(convictionAlert?.id, 'alert_AAPL_CONVICTION_78_TO_92');
  });
});
