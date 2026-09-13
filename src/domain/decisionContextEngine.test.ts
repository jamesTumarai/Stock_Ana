import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemorySnapshot } from './investmentMemory';
import { InvestmentThesisRecord, TrackedExpectation, evaluateExpectations } from './thesisExpectations';
import { computeWhatChanged } from './whatChangedEngine';
import { buildDecisionContext } from './decisionContextEngine';
import { computeWatchlistIntelligence } from './watchlistIntelligence';

describe('decisionContextEngine', () => {
  const prevReport: any = {
    ticker: 'MSFT',
    id: 'rep_1',
    schema_version: 2,
    generated_at: '2026-01-15T00:00:00Z',
    intrinsic_value: {
      current_price: 400.0,
      summary: { base_case_fair_value: 460.0 },
      assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
    },
    verdict: { conviction_score: 82, summary: 'Enterprise AI secular tailwinds' },
    comprehensive_analysis: { beginner_summary: { top_3_risks: ['Cloud slowdown'] } },
    catalysts_and_events: { items: [{ title: 'Q2 earnings' }] },
    financial_statements: {
      periods: ['Q2 2026'],
      income_statement: { revenue: [50000], operating_margin_pct: [42.0] }
    }
  };

  const currReport: any = {
    ticker: 'MSFT',
    id: 'rep_2',
    schema_version: 2,
    generated_at: '2026-04-15T00:00:00Z',
    intrinsic_value: {
      current_price: 430.0,
      summary: { base_case_fair_value: 480.0 },
      assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
    },
    verdict: { conviction_score: 85, summary: 'Enterprise AI secular tailwinds' },
    comprehensive_analysis: { beginner_summary: { top_3_risks: ['Cloud slowdown'] } },
    catalysts_and_events: { items: [{ title: 'Q2 earnings' }] },
    financial_statements: {
      periods: ['Q3 2026'],
      income_statement: { revenue: [55000], operating_margin_pct: [32.0] } // Margin contracted to 32%
    }
  };

  const sampleThesis: InvestmentThesisRecord = {
    thesisId: 'th_msft_1',
    ticker: 'MSFT',
    version: 1,
    summary: 'Cloud leadership with high margins',
    keyDrivers: ['Azure growth'],
    keyAssumptions: ['8.5% WACC'],
    keyRisks: ['Cloud slowdown'],
    catalysts: ['AI copilots'],
    invalidationConditions: ['Operating margin drops below 35.0%'],
    status: 'ACTIVE',
    confirmationStatus: 'USER_CONFIRMED',
    sourceReportId: 'rep_1',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z'
  };

  it('handles first analysis gracefully with NO_PRIOR_RESEARCH_FOUND', () => {
    const currSnap = extractMemorySnapshot(currReport)!;
    const context = buildDecisionContext(currSnap, null, null, null, []);

    assert.equal(context.ticker, 'MSFT');
    assert.equal(context.stance, 'NO_PRIOR_RESEARCH_FOUND');
    assert.equal(context.requiresAttention, false);
    assert.match(context.headline, /Initial Research Baseline Established/);
    assert.match(context.headlineTh, /สร้างเกณฑ์การวิจัยเริ่มต้น/);
  });

  it('detects invalidation condition trigger and sets CRITICAL attention', () => {
    const prevSnap = extractMemorySnapshot(prevReport)!;
    const currSnap = extractMemorySnapshot(currReport)!;
    const whatChanged = computeWhatChanged(currSnap, prevSnap, []);

    const context = buildDecisionContext(currSnap, prevSnap, sampleThesis, whatChanged, []);

    assert.equal(context.stance, 'THESIS_CONDITION_TRIGGERED');
    assert.equal(context.requiresAttention, true);
    assert.equal(context.invalidationTriggersFound.length, 1);
    assert.match(context.invalidationTriggersFound[0], /Operating margin drops below 35.0%/);

    const critReason = context.reasons.find(r => r.id === 'trig_margin_invalidation');
    assert.ok(critReason);
    assert.equal(critReason?.severity, 'CRITICAL');
    assert.match(critReason?.detail, /fell below tracked invalidation threshold/);
    assert.ok(critReason?.titleTh);
    assert.ok(critReason?.detailTh);
  });

  it('detects expectation miss and requests fundamental review', () => {
    const prevSnap = extractMemorySnapshot(prevReport)!;
    const currSnap = extractMemorySnapshot(currReport)!;

    const expectations: TrackedExpectation[] = [
      {
        expectationId: 'exp_q3_rev',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Q3 Revenue Target',
        targetValue: 60000,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'MISSED',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_1',
        actualValue: 55000,
        evaluationDate: '2026-04-15',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-04-15T00:00:00Z'
      }
    ];

    const context = buildDecisionContext(currSnap, prevSnap, null, null, expectations);

    assert.equal(context.stance, 'EXPECTATIONS_REVIEW_NEEDED');
    assert.equal(context.requiresAttention, true);
    assert.equal(context.expectationsSummary.missedCount, 1);
    assert.match(context.headline, /Expectations Missed/);
  });

  it('sets MONITORING_CONTINUES_UNCHANGED when thesis intact and no triggers fired', () => {
    const prevSnap = extractMemorySnapshot(prevReport)!;
    const intactReport = {
      ...prevReport,
      id: 'rep_intact',
      generated_at: '2026-03-01T00:00:00Z'
    };
    const currSnap = extractMemorySnapshot(intactReport)!;
    const whatChanged = computeWhatChanged(currSnap, prevSnap, []);

    const context = buildDecisionContext(currSnap, prevSnap, sampleThesis, whatChanged, []);

    assert.equal(context.stance, 'MONITORING_CONTINUES_UNCHANGED');
    assert.equal(context.requiresAttention, false);
    assert.match(context.summaryNarrative, /Prior investment thesis and key drivers remain intact/);
    assert.match(context.summaryNarrativeTh, /สมมติฐานการลงทุนและปัจจัยขับเคลื่อนหลักยังคงสมบูรณ์/);
  });

  it('proves zero automated Buy/Sell commands in output', () => {
    const prevSnap = extractMemorySnapshot(prevReport)!;
    const currSnap = extractMemorySnapshot(currReport)!;
    const context = buildDecisionContext(currSnap, prevSnap, sampleThesis, null, []);

    const stringified = JSON.stringify(context);
    assert.doesNotMatch(stringified, /"action":\s*"BUY"/i);
    assert.doesNotMatch(stringified, /"action":\s*"SELL"/i);
    assert.doesNotMatch(stringified, /"trade_instruction"/i);
  });

  describe('Blocker F — Canonical Expectation Evaluation Integration', () => {
    it('evaluates PENDING expectation to MISSED and synchronizes WhatChanged, DecisionContext, and Watchlist', () => {
      // 1. Stored expectation: Revenue >= 100, Target Period: FY26, Status: PENDING
      const storedExpectation: TrackedExpectation = {
        expectationId: 'exp_fy26_rev',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'FY26 Revenue ($M)',
        targetValue: 100,
        condition: 'gte',
        targetPeriod: 'FY26',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_1',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z'
      };

      // 2. Current verified memory snapshot: FY26 Revenue = 90
      const currentSnapshotReport: any = {
        ticker: 'MSFT',
        id: 'rep_fy26_actual',
        generated_at: '2026-10-15T00:00:00Z',
        intrinsic_value: {
          current_price: 450.0,
          summary: { base_case_fair_value: 480.0 },
          assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
        },
        financial_statements: {
          periods: ['FY26'],
          income_statement: {
            revenue: [90], // FY26 Revenue = 90
            operating_margin_pct: [40.0]
          }
        }
      };

      const currentSnapshot = extractMemorySnapshot(currentSnapshotReport)!;
      const prevSnapshot = extractMemorySnapshot(prevReport)!;

      // 3. Canonical evaluation pipeline
      const evaluated = evaluateExpectations([storedExpectation], currentSnapshot);

      // Prove evaluated expectation = MISSED
      assert.equal(evaluated.length, 1);
      assert.equal(evaluated[0].status, 'MISSED');
      assert.equal(evaluated[0].actualValue, 90);
      assert.equal(evaluated[0].actualPeriodFound, 'FY26');
      // Prove original historical intent was NOT rewritten
      assert.equal(evaluated[0].targetValue, 100);
      assert.equal(evaluated[0].targetPeriod, 'FY26');
      assert.equal(evaluated[0].origin, 'USER_EXPECTATION');
      assert.equal(evaluated[0].createdAt, '2026-01-15T00:00:00Z');

      // 4. Prove WhatChanged contains expectation miss
      const whatChanged = computeWhatChanged(currentSnapshot, prevSnapshot, evaluated);
      const missedItem = whatChanged.items.find(i => i.category === 'EXPECTATIONS' && i.deltaDisplay === 'MISSED');
      assert.ok(missedItem, 'WhatChanged must contain the expectation miss item');
      assert.equal(missedItem?.currentValue, 'Actual 90');

      // 5. Prove DecisionContext contains EXPECTATION review reason and appropriate stance
      const decisionContext = buildDecisionContext(
        currentSnapshot,
        prevSnapshot,
        sampleThesis,
        whatChanged,
        evaluated
      );
      assert.equal(decisionContext.stance, 'EXPECTATIONS_REVIEW_NEEDED');
      assert.equal(decisionContext.requiresAttention, true);
      assert.equal(decisionContext.expectationsSummary.missedCount, 1);
      const decReason = decisionContext.reasons.find(r => r.category === 'EXPECTATION' && r.id === 'exp_miss_exp_fy26_rev');
      assert.ok(decReason, 'DecisionContext must contain EXPECTATION review reason');
      assert.match(decReason?.detail || '', /Reported actual 90 vs target expectation of 100/);

      // 6. Prove Watchlist receives missed-expectation factor
      const watchlistIntel = computeWatchlistIntelligence(
        'MSFT',
        currentSnapshot,
        prevSnapshot,
        sampleThesis,
        evaluated,
        whatChanged,
        true,
        450.0
      );
      const expMissFactor = watchlistIntel.factors.find(f => f.code === 'EXP_MISSED');
      assert.ok(expMissFactor, 'Watchlist must receive EXP_MISSED factor');
      assert.equal(expMissFactor?.points, 30);
      assert.ok(watchlistIntel.attentionScore >= 30, 'Score should reflect missed expectation');
    });
  });
});
