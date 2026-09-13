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

  describe('Blocker 5 & 6 / Test F, G, H — Prior Belief Resolution', () => {
    it('uses historical thesis v1 as prior belief for Report B, never substituting current v2', () => {
      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const thesisV1: InvestmentThesisRecord = {
        thesisId: 'th_msft_v1',
        ticker: 'MSFT',
        version: 1,
        summary: 'Cloud thesis: Azure dominance drives operating leverage',
        keyDrivers: ['Azure'],
        keyAssumptions: ['8.5% WACC'],
        keyRisks: ['Slowdown'],
        catalysts: ['Earnings'],
        invalidationConditions: [],
        status: 'ACTIVE',
        confirmationStatus: 'USER_CONFIRMED',
        sourceReportId: 'rep_1',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
        userId: 'u1'
      };

      const thesisV2: InvestmentThesisRecord = {
        thesisId: 'th_msft_v1',
        ticker: 'MSFT',
        version: 2,
        summary: 'AI monetization thesis: Copilot adds high-margin software ARR',
        keyDrivers: ['Copilot', 'Azure'],
        keyAssumptions: ['8.0% WACC'],
        keyRisks: ['Capex'],
        catalysts: ['Ignite'],
        invalidationConditions: [],
        status: 'ACTIVE',
        confirmationStatus: 'USER_EDITED',
        sourceReportId: 'rep_2',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-04-15T00:00:00Z',
        userId: 'u1'
      };

      // Current thesis is v2, previous thesis for rep_1 is v1
      const context = buildDecisionContext(
        currSnap,
        prevSnap,
        thesisV2, // current thesis
        null,
        [],
        thesisV1  // previous thesis
      );

      // Prior belief must be v1 ("Cloud thesis"), NOT current v2 ("AI monetization thesis")
      assert.ok(context.priorBeliefSummary.thesisSummary);
      assert.equal(
        context.priorBeliefSummary.thesisSummary,
        'Cloud thesis: Azure dominance drives operating leverage',
        'Prior belief must truthfully reflect historical thesis v1'
      );
      assert.notEqual(
        context.priorBeliefSummary.thesisSummary,
        thesisV2.summary,
        'Must NOT substitute current thesis v2 for yesterday belief'
      );
    });

    it('legacy report before any confirmed thesis does NOT use current thesis as prior belief', () => {
      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const modernThesis: InvestmentThesisRecord = {
        thesisId: 'th_msft_modern',
        ticker: 'MSFT',
        version: 1,
        summary: 'Modern active thesis: AI leadership',
        keyDrivers: ['AI'],
        keyAssumptions: [],
        keyRisks: [],
        catalysts: [],
        invalidationConditions: [],
        status: 'ACTIVE',
        confirmationStatus: 'USER_CONFIRMED',
        sourceReportId: 'rep_2',
        createdAt: '2026-04-15T00:00:00Z',
        updatedAt: '2026-04-15T00:00:00Z'
      };

      // When no confirmed thesis existed for prior report (previousThesis = null):
      const context = buildDecisionContext(
        currSnap,
        prevSnap,
        modernThesis,
        null,
        [],
        null // No confirmed prior thesis
      );

      // Must NOT be modernThesis.summary
      assert.notEqual(
        context.priorBeliefSummary.thesisSummary,
        modernThesis.summary,
        'Must NOT substitute current thesis as prior belief for legacy report'
      );

      // If prior report had draft text, it is labeled as [Historical Report Draft], otherwise null
      if (context.priorBeliefSummary.thesisSummary) {
        assert.match(context.priorBeliefSummary.thesisSummary, /\[Historical Report Draft\]/);
      }
    });
  });

  describe('Blocker 12 / Test L — Manual Invalidation Conditions', () => {
    it('preserves manual review conditions without falsely auto-triggering them', () => {
      const prevSnap = extractMemorySnapshot(prevReport)!;
      // An intact report without margin contraction
      const intactReport = {
        ...prevReport,
        id: 'rep_intact',
        generated_at: '2026-03-01T00:00:00Z'
      };
      const currSnap = extractMemorySnapshot(intactReport)!;

      const qualitativeThesis: InvestmentThesisRecord = {
        ...sampleThesis,
        invalidationConditions: [
          'Materialization of primary risk: Competition in enterprise search'
        ]
      };

      const context = buildDecisionContext(currSnap, prevSnap, qualitativeThesis, null, []);

      // Qualitative condition must be captured in manualReviewConditions
      assert.equal(context.manualReviewConditions.length, 1);
      assert.equal(context.manualReviewConditions[0], 'Materialization of primary risk: Competition in enterprise search');

      // Crucial: Must NOT be placed in invalidationTriggersFound (never falsely auto-evaluated)
      assert.equal(context.invalidationTriggersFound.length, 0);

      // Stance must NOT become THESIS_CONDITION_TRIGGERED
      assert.notEqual(context.stance, 'THESIS_CONDITION_TRIGGERED');
      assert.equal(context.stance, 'MONITORING_CONTINUES_UNCHANGED');
    });
  });

  describe('Blocker 10 / Test J — One Expectation State Across All Consumers', () => {
    it('ensures ThesisExpectations, WhatChanged, DecisionContext, and Watchlist agree when Q4 report follows Q3 miss', () => {
      const q3Expectation: TrackedExpectation = {
        expectationId: 'exp_q3_msft',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Q3 Revenue Target',
        targetValue: 60000,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_q3',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z'
      };

      const q3ReportData: any = {
        ticker: 'MSFT',
        id: 'rep_q3',
        generated_at: '2026-07-15T00:00:00Z',
        financial_statements: {
          periods: ['Q3 2026'],
          income_statement: { revenue: [55000], operating_margin_pct: [40.0] }
        }
      };
      const q3Snap = extractMemorySnapshot(q3ReportData)!;

      // 1. Initial evaluation against Q3 -> MISSED
      const evaluatedQ3 = evaluateExpectations([q3Expectation], q3Snap);
      assert.equal(evaluatedQ3[0].status, 'MISSED');

      // 2. Newest report arrives for Q4 2026 (Revenue 65000)
      const q4ReportData: any = {
        ticker: 'MSFT',
        id: 'rep_q4',
        generated_at: '2026-10-15T00:00:00Z',
        financial_statements: {
          periods: ['Q3 2026', 'Q4 2026'],
          income_statement: { revenue: [55000, 65000], operating_margin_pct: [40.0, 42.0] }
        }
      };
      const q4Snap = extractMemorySnapshot(q4ReportData)!;

      // 3. Consumer 1: ThesisExpectations / evaluateExpectations
      const durableEvaluated = evaluateExpectations(evaluatedQ3, q4Snap, [q3Snap]);
      assert.equal(durableEvaluated[0].status, 'MISSED', 'Thesis expectations card sees MISSED');

      // 4. Consumer 2: WhatChanged
      const whatChanged = computeWhatChanged(q4Snap, q3Snap, durableEvaluated);
      const wcMissItem = whatChanged.items.find(i => i.category === 'EXPECTATIONS' && i.deltaDisplay === 'MISSED');
      assert.ok(wcMissItem, 'WhatChanged must see MISSED');

      // 5. Consumer 3: DecisionContext
      const decisionContext = buildDecisionContext(
        q4Snap,
        q3Snap,
        sampleThesis,
        whatChanged,
        durableEvaluated
      );
      assert.equal(decisionContext.stance, 'EXPECTATIONS_REVIEW_NEEDED', 'DecisionContext sees EXPECTATIONS_REVIEW_NEEDED');
      assert.equal(decisionContext.expectationsSummary.missedCount, 1);

      // 6. Consumer 4: WatchlistIntelligence
      const watchlist = computeWatchlistIntelligence(
        'MSFT',
        q4Snap,
        q3Snap,
        sampleThesis,
        durableEvaluated,
        whatChanged,
        true,
        450.0
      );
      const factor = watchlist.factors.find(f => f.code === 'EXP_MISSED');
      assert.ok(factor, 'Watchlist retains expectation-miss factor across Q4 transition');
      assert.equal(factor?.points, 30);
    });
  });
});
