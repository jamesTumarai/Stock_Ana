import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReportDate,
  extractReportPrice,
  extractReportFairValue,
  extractReportConviction,
  buildResearchTimeline,
  computeHistoricalDelta,
  unwrapHistoryRecord,
  getPreviousReport
} from '../researchTimeline';
import { ReportData } from '../../types';

describe('researchTimeline', () => {
  it('extractors: parses date, price, fair value, and conviction accurately', () => {
    const mockReport: any = {
      report_date: '2026-03-01',
      intrinsic_value: {
        current_price: 420.5,
        summary: {
          base_case_fair_value: 480.0
        }
      },
      verdict: {
        conviction_score: 85
      }
    };

    assert.equal(extractReportDate(mockReport), '2026-03-01');
    assert.equal(extractReportPrice(mockReport), 420.5);
    assert.equal(extractReportFairValue(mockReport), 480.0);
    assert.equal(extractReportConviction(mockReport), 85);
  });

  it('buildResearchTimeline: filters by ticker, sorts descending, and includes active report', () => {
    const history = [
      {
        ticker: 'MSFT',
        report_date: '2026-01-15',
        intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 460 } },
        verdict: { conviction_score: 80 }
      },
      {
        ticker: 'NVDA', // Different ticker, should be excluded
        report_date: '2026-02-01',
        intrinsic_value: { current_price: 120 }
      },
      {
        ticker: 'MSFT',
        report_date: '2026-02-15',
        intrinsic_value: { current_price: 420, summary: { base_case_fair_value: 470 } },
        verdict: { conviction_score: 82 }
      }
    ];

    const activeReport: any = {
      ticker: 'MSFT',
      report_date: '2026-03-01',
      intrinsic_value: { current_price: 440, summary: { base_case_fair_value: 490 } },
      verdict: { conviction_score: 86 }
    };

    const timeline = buildResearchTimeline('msft', history, activeReport);

    assert.equal(timeline.length, 3);
    // Should be sorted descending by date
    assert.equal(timeline[0].reportDate, '2026-03-01');
    assert.equal(timeline[1].reportDate, '2026-02-15');
    assert.equal(timeline[2].reportDate, '2026-01-15');
  });

  it('computeHistoricalDelta: calculates exact empirical mathematical deltas without hallucination', () => {
    const prevReport: any = {
      report_date: '2026-01-01',
      intrinsic_value: {
        current_price: 400.0,
        summary: { base_case_fair_value: 450.0 }
      },
      verdict: { conviction_score: 80 },
      financial_statements: {
        periods: ['2025-Q3', '2025-Q4'],
        income_statement: {
          revenue: [1000, 1200],
          operating_income: [200, 300], // Opm: 20% -> 25%
          yoy_revenue_growth_pct: [10.0, 15.0]
        },
        cash_flow: {
          free_cash_flow: [150, 200]
        }
      }
    };

    const curReport: any = {
      report_date: '2026-02-01',
      intrinsic_value: {
        current_price: 440.0, // +10%
        summary: { base_case_fair_value: 495.0 } // +10%
      },
      verdict: { conviction_score: 85 }, // +5 points
      financial_statements: {
        periods: ['2025-Q4', '2026-Q1'],
        income_statement: {
          revenue: [1200, 1400],
          operating_income: [300, 392], // Opm: 25% -> 28%
          yoy_revenue_growth_pct: [15.0, 18.5] // +3.5 pct points
        },
        cash_flow: {
          free_cash_flow: [200, 260] // +30%
        }
      }
    };

    const delta = computeHistoricalDelta(curReport, prevReport);

    assert.ok(delta !== null);
    assert.equal(delta.previousReportDate, '2026-01-01');
    assert.equal(delta.currentReportDate, '2026-02-01');
    assert.equal(delta.daysBetween, 31);

    // Price delta
    assert.ok(delta.priceDelta);
    assert.equal(delta.priceDelta.previous, 400.0);
    assert.equal(delta.priceDelta.current, 440.0);
    assert.equal(delta.priceDelta.deltaPct, 10.0);

    // Fair Value delta
    assert.ok(delta.fairValueDelta);
    assert.equal(delta.fairValueDelta.previous, 450.0);
    assert.equal(delta.fairValueDelta.current, 495.0);
    assert.equal(delta.fairValueDelta.deltaPct, 10.0);

    // Conviction score delta
    assert.ok(delta.convictionScoreDelta);
    assert.equal(delta.convictionScoreDelta.previous, 80);
    assert.equal(delta.convictionScoreDelta.current, 85);
    assert.equal(delta.convictionScoreDelta.deltaPoints, 5);

    // Fundamental deltas
    assert.ok(delta.revenueYoYDelta);
    assert.equal(delta.revenueYoYDelta.previous, 15.0);
    assert.equal(delta.revenueYoYDelta.current, 18.5);
    assert.equal(delta.revenueYoYDelta.deltaPctPoints, 3.5);

    assert.ok(delta.operatingMarginDelta);
    assert.equal(delta.operatingMarginDelta.previous, 25.0);
    assert.equal(delta.operatingMarginDelta.current, 28.0);
    assert.equal(delta.operatingMarginDelta.deltaPctPoints, 3.0);

    assert.ok(delta.freeCashFlowDelta);
    assert.equal(delta.freeCashFlowDelta.previous, 200);
    assert.equal(delta.freeCashFlowDelta.current, 260);
    assert.equal(delta.freeCashFlowDelta.deltaPct, 30.0);
  });

  it('unwrapHistoryRecord: seamlessly unwraps real Firestore wrapper shape and legacy shapes', () => {
    const firestoreWrapper = {
      id: 'doc_abc123',
      userId: 'user_xyz',
      ticker: 'MSFT',
      createdAt: { seconds: 1773300000, nanoseconds: 0 },
      schemaVersion: '1.2.0',
      validationStatus: 'valid',
      data: {
        ticker: 'MSFT',
        intrinsic_value: { current_price: 430, summary: { base_case_fair_value: 480 } },
        verdict: { conviction_score: 88 }
      }
    };

    const unwrapped = unwrapHistoryRecord(firestoreWrapper);
    assert.ok(unwrapped !== null);
    assert.equal(unwrapped.reportId, 'doc_abc123');
    assert.equal(unwrapped.ticker, 'MSFT');
    assert.equal(unwrapped.createdTimestamp, 1773300000 * 1000);
    assert.equal(unwrapped.schemaVersion, '1.2.0');
    assert.equal(unwrapped.validationStatus, 'valid');
    assert.equal(unwrapped.data.verdict?.conviction_score, 88);
  });

  it('buildResearchTimeline: preserves multiple same-day analyses without overwriting (P1-3)', () => {
    // Two analyses on the exact same date (2026-03-01): 10:00 AM and 02:00 PM
    const morningTimestamp = Date.parse('2026-03-01T10:00:00Z');
    const afternoonTimestamp = Date.parse('2026-03-01T14:00:00Z');

    const history = [
      {
        id: 'rep_morning',
        ticker: 'MSFT',
        createdAt: { seconds: morningTimestamp / 1000 },
        data: {
          ticker: 'MSFT',
          intrinsic_value: { current_price: 410, summary: { base_case_fair_value: 460 } },
          verdict: { conviction_score: 80 }
        }
      },
      {
        id: 'rep_afternoon',
        ticker: 'MSFT',
        createdAt: { seconds: afternoonTimestamp / 1000 },
        data: {
          ticker: 'MSFT',
          intrinsic_value: { current_price: 415, summary: { base_case_fair_value: 465 } },
          verdict: { conviction_score: 82 }
        }
      }
    ];

    const timeline = buildResearchTimeline('MSFT', history);

    // Both reports on the same day must remain in timeline (neither overwritten)
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].id, 'rep_afternoon');
    assert.equal(timeline[0].marketPrice, 415);
    assert.equal(timeline[1].id, 'rep_morning');
    assert.equal(timeline[1].marketPrice, 410);
  });

  it('getPreviousReport: reliably selects strictly previous report regardless of input ordering', () => {
    const t1 = Date.parse('2026-01-10T12:00:00Z');
    const t2 = Date.parse('2026-02-10T12:00:00Z');
    const t3 = Date.parse('2026-03-10T12:00:00Z');

    const history = [
      {
        id: 'rep_1',
        ticker: 'MSFT',
        createdAt: { seconds: t1 / 1000 },
        data: { ticker: 'MSFT', intrinsic_value: { current_price: 390 } }
      },
      {
        id: 'rep_3', // Out of chronological order
        ticker: 'MSFT',
        createdAt: { seconds: t3 / 1000 },
        data: { ticker: 'MSFT', intrinsic_value: { current_price: 430 } }
      },
      {
        id: 'rep_2',
        ticker: 'MSFT',
        createdAt: { seconds: t2 / 1000 },
        data: { ticker: 'MSFT', intrinsic_value: { current_price: 410 } }
      }
    ];

    const activeReport: any = {
      id: 'rep_3',
      ticker: 'MSFT',
      generated_at: '2026-03-10T12:00:00Z',
      intrinsic_value: { current_price: 430 }
    };

    // When active report is rep_3 (March), strictly previous report should be rep_2 (February)
    const prev = getPreviousReport('MSFT', history, activeReport);
    assert.ok(prev !== null);
    assert.equal(prev?.intrinsic_value?.current_price, 410);
  });
});
