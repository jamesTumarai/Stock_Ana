import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemorySnapshot } from './investmentMemory';
import { InvestmentThesisRecord, TrackedExpectation } from './thesisExpectations';
import {
  computeWatchlistIntelligence,
  rankWatchlistByPriority,
  WatchlistIntelligenceEntry
} from './watchlistIntelligence';

describe('watchlistIntelligence', () => {
  const sampleReport: any = {
    ticker: 'MSFT',
    id: 'rep_1',
    schema_version: 2,
    generated_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago (stale)
    intrinsic_value: {
      current_price: 350.0,
      summary: { base_case_fair_value: 480.0 }, // +37% MoS
      assumptions: { discount_rate: 8.5 }
    },
    verdict: { conviction_score: 85 },
    financial_statements: {
      periods: ['Q1 2026'],
      income_statement: { revenue: [50000], operating_margin_pct: [30.0] } // Margin 30%
    }
  };

  const sampleThesis: InvestmentThesisRecord = {
    thesisId: 'th_1',
    ticker: 'MSFT',
    version: 1,
    summary: 'Cloud AI',
    keyDrivers: [],
    keyAssumptions: [],
    keyRisks: [],
    catalysts: [],
    invalidationConditions: ['Operating margin drops below 35.0%'], // Triggered!
    status: 'ACTIVE',
    confirmationStatus: 'USER_CONFIRMED',
    sourceReportId: 'rep_1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const missedExp: TrackedExpectation = {
    expectationId: 'exp_1',
    ticker: 'MSFT',
    metricOrEvent: 'revenue',
    metricLabel: 'Revenue',
    targetValue: 60000,
    condition: 'gte',
    targetPeriod: 'Q1 2026',
    status: 'MISSED',
    origin: 'USER_EXPECTATION',
    sourceReportId: 'rep_1',
    actualValue: 50000,
    evaluationDate: '2026-02-01',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z'
  };

  it('computes URGENT_ATTENTION priority when invalidation and missed expectations trigger', () => {
    const snap = extractMemorySnapshot(sampleReport)!;
    const entry = computeWatchlistIntelligence(
      'MSFT',
      snap,
      null,
      sampleThesis,
      [missedExp],
      null,
      true, // Owned
      350.0
    );

    assert.equal(entry.ticker, 'MSFT');
    assert.equal(entry.priority, 'URGENT_ATTENTION');
    // Expected points: 40 (invalidation) + 30 (missed exp) + 20 (MoS >= 20%) + 15 (stale >= 90d) + 10 (owned) = 115 -> clamped to 100
    assert.equal(entry.attentionScore, 100);
    assert.ok(entry.factors.length >= 4);

    const invalFactor = entry.factors.find(f => f.code === 'INVAL_TRIGGER');
    assert.ok(invalFactor);
    assert.equal(invalFactor?.points, 40);
    assert.ok(invalFactor?.labelTh);

    assert.ok(entry.summaryReason);
    assert.ok(entry.summaryReasonTh);
  });

  it('computes ROUTINE_MONITORING for a healthy company with no triggers or missed expectations', () => {
    const freshReport: any = {
      ticker: 'AAPL',
      id: 'rep_fresh',
      schema_version: 2,
      generated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      intrinsic_value: {
        current_price: 220.0,
        summary: { base_case_fair_value: 230.0 } // 4.5% MoS (low divergence)
      },
      verdict: { conviction_score: 85 },
      financial_statements: {
        periods: ['Q3 2026'],
        income_statement: { revenue: [90000], operating_margin_pct: [32.0] }
      }
    };

    const snap = extractMemorySnapshot(freshReport)!;
    const entry = computeWatchlistIntelligence(
      'AAPL',
      snap,
      null,
      null,
      [],
      null,
      false, // Not owned
      220.0
    );

    assert.equal(entry.ticker, 'AAPL');
    assert.equal(entry.priority, 'ROUTINE_MONITORING');
    assert.equal(entry.attentionScore, 0);
    assert.equal(entry.factors.length, 0);
    assert.match(entry.summaryReason, /Routine tracking active/);
    assert.match(entry.summaryReasonTh, /อยู่ในเกณฑ์ติดตามปกติ/);
  });

  it('rankWatchlistByPriority deterministically sorts highest attention scores first', () => {
    const entries: WatchlistIntelligenceEntry[] = [
      {
        ticker: 'LOW_PRIO',
        priority: 'ROUTINE_MONITORING',
        attentionScore: 10,
        factors: [],
        latestResearchDate: '2026-05-01',
        daysSinceResearch: 10,
        latestReportId: 'r1',
        currentPrice: 100,
        fairValue: 105,
        marginOfSafetyPct: 5,
        thesisStatus: 'ACTIVE',
        unresolvedExpectationsCount: 0,
        missedExpectationsCount: 0,
        materialChangesCount: 0,
        isOwnedInPortfolio: false,
        summaryReason: '',
        summaryReasonTh: ''
      },
      {
        ticker: 'HIGH_PRIO',
        priority: 'URGENT_ATTENTION',
        attentionScore: 85,
        factors: [],
        latestResearchDate: '2026-01-01',
        daysSinceResearch: 90,
        latestReportId: 'r2',
        currentPrice: 80,
        fairValue: 120,
        marginOfSafetyPct: 50,
        thesisStatus: 'POTENTIALLY_CHALLENGED',
        unresolvedExpectationsCount: 1,
        missedExpectationsCount: 1,
        materialChangesCount: 3,
        isOwnedInPortfolio: true,
        summaryReason: '',
        summaryReasonTh: ''
      },
      {
        ticker: 'MID_PRIO',
        priority: 'REVIEW_RECOMMENDED',
        attentionScore: 45,
        factors: [],
        latestResearchDate: '2026-03-01',
        daysSinceResearch: 40,
        latestReportId: 'r3',
        currentPrice: 200,
        fairValue: 240,
        marginOfSafetyPct: 20,
        thesisStatus: 'ACTIVE',
        unresolvedExpectationsCount: 1,
        missedExpectationsCount: 0,
        materialChangesCount: 1,
        isOwnedInPortfolio: false,
        summaryReason: '',
        summaryReasonTh: ''
      }
    ];

    const ranked = rankWatchlistByPriority(entries);
    assert.equal(ranked[0].ticker, 'HIGH_PRIO');
    assert.equal(ranked[1].ticker, 'MID_PRIO');
    assert.equal(ranked[2].ticker, 'LOW_PRIO');
  });
});
