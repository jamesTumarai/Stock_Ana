import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDraftThesisFromReport,
  confirmUserThesis,
  evaluateExpectations,
  matchRiskCatalystTransitions,
  resolveActiveThesisForReport,
  classifyInvalidationCondition,
  resolveBusinessCategory,
  getActiveValuationAssumptions,
  getApplicableExpectationMetrics,
  EXPECTATION_METRIC_REGISTRY,
  InvestmentThesisRecord,
  TrackedExpectation
} from './thesisExpectations';
import { extractMemorySnapshot } from './investmentMemory';

describe('thesisExpectations', () => {
  const sampleReport: any = {
    ticker: 'MSFT',
    schema_version: 2,
    generated_by_version: '1.2.0',
    generated_at: '2026-06-15T10:00:00.000Z',
    intrinsic_value: {
      current_price: 430.0,
      summary: { base_case_fair_value: 480.0 },
      assumptions: {
        discount_rate: 8.5,
        terminal_growth_rate: 2.5,
        revenue_growth_rate: 12.0,
        target_fcf_margin: 32.0
      }
    },
    verdict: {
      conviction_score: 88,
      summary: 'Azure AI enterprise monetization driving cloud operating leverage.',
      key_takeaways: ['Copilot monetization', 'Data center expansion', 'Dividend growth']
    },
    comprehensive_analysis: {
      beginner_summary: {
        top_3_risks: ['Cloud slowdown', 'Regulatory antitrust', 'AI capex overrun']
      }
    },
    catalysts_and_events: {
      items: [
        { title: 'Ignite conference showcase' },
        { title: 'Fiscal Q4 earnings' }
      ]
    },
    financial_statements: {
      periods: ['Q3 2026'],
      income_statement: {
        revenue: [62000],
        yoy_revenue_growth_pct: [17.0],
        operating_income: [27900],
        operating_margin_pct: [45.0],
        net_income: [21900]
      },
      cash_flow: {
        free_cash_flow: [19500]
      }
    }
  };

  it('extractDraftThesisFromReport creates an AI_DRAFT thesis without fabricating facts', () => {
    const draft = extractDraftThesisFromReport(sampleReport, 'usr_123');
    assert.ok(draft);
    assert.equal(draft?.ticker, 'MSFT');
    assert.equal(draft?.version, 1);
    assert.equal(draft?.confirmationStatus, 'AI_DRAFT');
    assert.equal(draft?.status, 'ACTIVE');
    assert.equal(draft?.userId, 'usr_123');
    assert.equal(draft?.keyDrivers.length, 3);
    assert.equal(draft?.keyRisks.length, 3);
    assert.equal(draft?.catalysts.length, 2);
    assert.ok(draft?.invalidationConditions.length > 0);
  });

  it('confirmUserThesis promotes draft to USER_CONFIRMED or USER_EDITED', () => {
    const draft = extractDraftThesisFromReport(sampleReport, 'usr_123')!;

    // User confirms without modification
    const confirmed = confirmUserThesis(draft, undefined, 'usr_123');
    assert.equal(confirmed.version, 2);
    assert.equal(confirmed.confirmationStatus, 'USER_CONFIRMED');

    // User confirms with custom thesis edits
    const edited = confirmUserThesis(draft, {
      summary: 'My personal investment thesis: Azure AI moat is sustainable.',
      invalidationConditions: ['If Azure growth decelerates below 20% YoY']
    }, 'usr_123');

    assert.equal(edited.version, 2);
    assert.equal(edited.confirmationStatus, 'USER_EDITED');
    assert.equal(edited.summary, 'My personal investment thesis: Azure AI moat is sustainable.');
    assert.equal(edited.invalidationConditions[0], 'If Azure growth decelerates below 20% YoY');
  });

  it('evaluateExpectations deterministically evaluates MET, EXCEEDED, MISSED, and PENDING', () => {
    const snapshot = extractMemorySnapshot(sampleReport)!;
    assert.ok(snapshot);

    const expectations: TrackedExpectation[] = [
      {
        expectationId: 'exp_1',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Q3 Revenue',
        targetValue: 60000,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        expectationId: 'exp_2',
        ticker: 'MSFT',
        metricOrEvent: 'operating_margin_pct',
        metricLabel: 'Operating Margin',
        targetValue: 46.0,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'MANAGEMENT_GUIDANCE',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      },
      {
        expectationId: 'exp_3',
        ticker: 'MSFT',
        metricOrEvent: 'free_cash_flow',
        metricLabel: 'Future Q4 FCF',
        targetValue: 25000,
        condition: 'gte',
        targetPeriod: 'Q4 2026', // Future period not yet reached
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    ];

    const evaluated = evaluateExpectations(expectations, snapshot);

    // exp_1: actual 62000 >= target 60000 -> MET (or EXCEEDED if >= 63000)
    assert.equal(evaluated[0].status, 'MET');
    assert.equal(evaluated[0].actualValue, 62000);

    // exp_2: actual 45.0% < target 46.0% -> MISSED
    assert.equal(evaluated[1].status, 'MISSED');
    assert.equal(evaluated[1].actualValue, 45.0);

    // exp_3: target period is Q4 2026, report is Q3 2026 -> strictly PENDING without faking
    assert.equal(evaluated[2].status, 'PENDING');
    assert.equal(evaluated[2].actualValue, null);
  });

  it('evaluateExpectations handles missing data as UNAVAILABLE without assuming zero', () => {
    const sparseReport: any = {
      ticker: 'SPARSE',
      schema_version: 2,
      financial_statements: {
        periods: ['Q1 2026'],
        income_statement: {
          revenue: [1000]
          // free_cash_flow missing entirely
        }
      }
    };
    const snapshot = extractMemorySnapshot(sparseReport)!;

    const exp: TrackedExpectation = {
      expectationId: 'exp_missing',
      ticker: 'SPARSE',
      metricOrEvent: 'free_cash_flow',
      metricLabel: 'FCF Target',
      targetValue: 200,
      condition: 'gte',
      targetPeriod: 'Q1 2026',
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      sourceReportId: 'rep_0',
      actualValue: null,
      evaluationDate: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    const evaluated = evaluateExpectations([exp], snapshot);
    assert.equal(evaluated[0].status, 'UNAVAILABLE');
    assert.equal(evaluated[0].actualValue, null);
  });

  it('matchRiskCatalystTransitions correctly categorizes active, new, evolving, and resolved items', () => {
    const prevRisks = ['Cloud slowdown', 'Regulatory antitrust', 'Margin contraction'];
    const currRisks = ['Cloud slowdown', 'Regulatory antitrust inquiry in EU', 'Hardware capex escalation'];

    const prevCats = ['Product Launch'];
    const currCats = ['Product Launch', 'Earnings Announcement'];

    const transitions = matchRiskCatalystTransitions(prevRisks, currRisks, prevCats, currCats);

    // Cloud slowdown: exact match -> ACTIVE
    const cloudSlowdown = transitions.find(t => t.itemText === 'Cloud slowdown');
    assert.ok(cloudSlowdown);
    assert.equal(cloudSlowdown?.previousState, 'ACTIVE');
    assert.equal(cloudSlowdown?.currentState, 'ACTIVE');
    assert.equal(cloudSlowdown?.isCertain, true);

    // Hardware capex escalation: completely new -> NEW
    const capex = transitions.find(t => t.itemText === 'Hardware capex escalation');
    assert.ok(capex);
    assert.equal(capex?.currentState, 'NEW');

    // Margin contraction: not in current -> RESOLVED
    const margin = transitions.find(t => t.itemText === 'Margin contraction');
    assert.ok(margin);
    assert.equal(margin?.currentState, 'RESOLVED');

    // Earnings Announcement: new catalyst
    const earnings = transitions.find(t => t.itemText === 'Earnings Announcement');
    assert.ok(earnings);
    assert.equal(earnings?.currentState, 'NEW');
  });

  describe('Blocker E — Thesis Tracking Revision History & Historical Linkage', () => {
    const reportA = {
      id: 'rep_A',
      ticker: 'MSFT',
      generated_at: '2026-01-15T00:00:00Z'
    };

    const reportB = {
      id: 'rep_B',
      ticker: 'MSFT',
      generated_at: '2026-06-15T00:00:00Z'
    };

    const oldReport = {
      id: 'rep_legacy',
      ticker: 'MSFT',
      generated_at: '2025-01-01T00:00:00Z'
    };

    it('resolves historical active thesis per report without losing revisions or fabricating past beliefs', () => {
      // 1. Confirm thesis v1 tied to Report A
      const thesisV1: InvestmentThesisRecord = {
        thesisId: 'th_msft_v1',
        ticker: 'MSFT',
        version: 1,
        summary: 'Version 1 thesis: Cloud leadership',
        keyDrivers: ['Azure growth'],
        keyAssumptions: ['8.5% WACC'],
        keyRisks: ['Cloud slowdown'],
        catalysts: ['Q3 earnings'],
        invalidationConditions: ['Azure < 20%'],
        status: 'ACTIVE',
        confirmationStatus: 'USER_CONFIRMED',
        sourceReportId: 'rep_A',
        createdAt: '2026-01-15T12:00:00Z',
        updatedAt: '2026-01-15T12:00:00Z',
        userId: 'user_1'
      };

      // 2. Edit thesis -> v2 tied to Report B
      const thesisV2: InvestmentThesisRecord = {
        thesisId: 'th_msft_v2',
        ticker: 'MSFT',
        version: 2,
        summary: 'Version 2 thesis: AI Copilot monetization',
        keyDrivers: ['Azure growth', 'Copilot enterprise seats'],
        keyAssumptions: ['8.0% WACC'],
        keyRisks: ['Hardware capex'],
        catalysts: ['Ignite launch'],
        invalidationConditions: ['Capex overrun'],
        status: 'ACTIVE',
        confirmationStatus: 'USER_EDITED',
        sourceReportId: 'rep_B',
        createdAt: '2026-01-15T12:00:00Z',
        updatedAt: '2026-06-15T12:00:00Z',
        userId: 'user_1'
      };

      const revisions = [thesisV1, thesisV2];
      const current = thesisV2;

      // Current is v2
      assert.equal(current.version, 2);

      // Revision history contains both v1 and v2
      assert.equal(revisions.length, 2);
      assert.equal(revisions[0].version, 1);
      assert.equal(revisions[1].version, 2);

      // Report A resolves v1
      const resolvedA = resolveActiveThesisForReport(reportA, revisions, current);
      assert.ok(resolvedA);
      assert.equal(resolvedA?.version, 1);
      assert.equal(resolvedA?.summary, 'Version 1 thesis: Cloud leadership');
      assert.equal(resolvedA?.sourceReportId, 'rep_A');

      // Report B resolves v2
      const resolvedB = resolveActiveThesisForReport(reportB, revisions, current);
      assert.ok(resolvedB);
      assert.equal(resolvedB?.version, 2);
      assert.equal(resolvedB?.summary, 'Version 2 thesis: AI Copilot monetization');
      assert.equal(resolvedB?.sourceReportId, 'rep_B');

      // Legacy report from before any thesis was recorded: NOT RECORDED (null), never retroactively fakes current belief
      const resolvedLegacy = resolveActiveThesisForReport(oldReport, revisions, current);
      assert.equal(resolvedLegacy, null, 'Legacy report must not retroactively receive modern thesis');

      // Unknown report without date or matching ID: returns null
      const resolvedUnknown = resolveActiveThesisForReport({ ticker: 'MSFT', id: 'rep_unknown' }, revisions, current);
      assert.equal(resolvedUnknown, null);
    });
  });

  describe('Blocker I — Conservative Risk and Catalyst Lifecycle Transitions', () => {
    it('treats ambiguous semantic rewording as uncertain evolution rather than certain RESOLVED and NEW', () => {
      const prevRisks = ['Cloud demand slowdown'];
      const currRisks = ['Slower enterprise cloud spending'];

      const transitions = matchRiskCatalystTransitions(prevRisks, currRisks, [], []);

      assert.equal(transitions.length, 1, 'Should match as 1 ambiguous/evolving item instead of 2 separate items');
      const item = transitions[0];
      assert.equal(item.category, 'risk');
      assert.equal(item.isCertain, false, 'Semantic rewording must not be marked certain');
      assert.equal(item.currentState, 'UNKNOWN', 'Ambiguous rephrasing must express uncertainty/review-needed');
      assert.equal(item.previousState, 'ACTIVE');
      assert.ok(item.evidence?.includes('Ambiguous rephrasing'), 'Evidence should note review needed');

      // Crucial negative invariant: must NOT produce old = RESOLVED certain or new = NEW certain
      const resolvedCertain = transitions.find(t => t.currentState === 'RESOLVED' && t.isCertain === true);
      const newCertain = transitions.find(t => t.currentState === 'NEW' && t.isCertain === true);
      assert.equal(resolvedCertain, undefined, 'Must NOT produce old = RESOLVED certain');
      assert.equal(newCertain, undefined, 'Must NOT produce new = NEW certain');
    });

    it('marks unmatched unstructured free-text items as uncertain (isCertain: false)', () => {
      const prevRisks = ['Antitrust investigation into app store policies'];
      const currRisks = ['Supply chain disruption in Southeast Asia'];

      const transitions = matchRiskCatalystTransitions(prevRisks, currRisks, [], []);

      const newRisk = transitions.find(t => t.currentState === 'NEW');
      assert.ok(newRisk);
      assert.equal(newRisk?.isCertain, false, 'Unmatched current free-text risk must be isCertain: false');

      const resolvedRisk = transitions.find(t => t.currentState === 'RESOLVED');
      assert.ok(resolvedRisk);
      assert.equal(resolvedRisk?.isCertain, false, 'Unmatched previous free-text risk must be isCertain: false');
    });

    it('reserves isCertain: true exclusively for exact normalized identity', () => {
      const prevRisks = ['Foreign Exchange Currency Headwind'];
      const currRisks = ['foreign exchange currency headwind'];

      const transitions = matchRiskCatalystTransitions(prevRisks, currRisks, [], []);

      assert.equal(transitions.length, 1);
      assert.equal(transitions[0].currentState, 'ACTIVE');
      assert.equal(transitions[0].isCertain, true, 'Exact normalized identity permits isCertain: true');
    });
  });

  describe('Blocker 7 / Test G — Thesis Edit & Current Report Context Linkage', () => {
    it('links new confirmed/edited revision to the current report context and increments version', () => {
      const initialThesis: InvestmentThesisRecord = {
        thesisId: 'th_test_1',
        ticker: 'MSFT',
        version: 1,
        summary: 'Thesis v1 tied to Report A',
        keyDrivers: ['Cloud'],
        keyAssumptions: ['8.5% WACC'],
        keyRisks: ['Slowdown'],
        catalysts: ['Earnings'],
        invalidationConditions: ['Operating margin < 35%'],
        status: 'ACTIVE',
        confirmationStatus: 'USER_CONFIRMED',
        sourceReportId: 'rep_A',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        userId: 'user_123'
      };

      // User edits thesis while viewing Report B
      const edited = confirmUserThesis(
        initialThesis,
        {
          summary: 'Thesis v2 updated while viewing Report B',
          invalidationConditions: ['Operating margin < 30%']
        },
        'user_123',
        'rep_B'
      );

      assert.equal(edited.thesisId, 'th_test_1', 'Must preserve original thesisId');
      assert.equal(edited.version, 2, 'Must increment version');
      assert.equal(edited.confirmationStatus, 'USER_EDITED');
      assert.equal(edited.sourceReportId, 'rep_B', 'Must be tied to the current report context');
      assert.equal(edited.createdAt, '2026-01-01T00:00:00Z', 'Must preserve original createdAt');
      assert.equal(edited.userId, 'user_123');
      assert.ok(edited.updatedAt > edited.createdAt, 'updatedAt must be updated');
      assert.equal(edited.summary, 'Thesis v2 updated while viewing Report B');
      assert.deepEqual(edited.invalidationConditions, ['Operating margin < 30%']);
    });
  });

  describe('Blocker 8 & 9 / Test I — Durable Expectations & Historical Target Period Resolution', () => {
    it('Q3 MISSED expectation remains MISSED when Q4 is the latest report, using historical target data', () => {
      const expectation: TrackedExpectation = {
        expectationId: 'exp_q3_rev',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Q3 2026 Revenue ($M)',
        targetValue: 60000,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_1',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z'
      };

      // 1. In Q3 2026 report, actual revenue was 55,000 (target 60,000 gte) -> MISSED
      const q3Report: any = {
        ticker: 'MSFT',
        id: 'rep_q3',
        generated_at: '2026-07-15T00:00:00Z',
        financial_statements: {
          periods: ['Q3 2026'],
          income_statement: { revenue: [55000], operating_margin_pct: [40.0] }
        }
      };
      const q3Snap = extractMemorySnapshot(q3Report)!;
      const evaluatedQ3 = evaluateExpectations([expectation], q3Snap);

      assert.equal(evaluatedQ3.length, 1);
      assert.equal(evaluatedQ3[0].status, 'MISSED');
      assert.equal(evaluatedQ3[0].actualValue, 55000);
      assert.equal(evaluatedQ3[0].actualPeriodFound, 'Q3 2026');
      assert.equal(evaluatedQ3[0].targetValue, 60000, 'Immutable targetValue must be preserved');
      assert.equal(evaluatedQ3[0].targetPeriod, 'Q3 2026', 'Immutable targetPeriod must be preserved');

      // 2. Later, Q4 2026 report arrives with Revenue = 65,000 (which would have exceeded 60,000 if evaluated against Q4!)
      const q4Report: any = {
        ticker: 'MSFT',
        id: 'rep_q4',
        generated_at: '2026-10-15T00:00:00Z',
        financial_statements: {
          periods: ['Q3 2026', 'Q4 2026'],
          income_statement: {
            revenue: [55000, 65000],
            operating_margin_pct: [40.0, 42.0]
          }
        }
      };
      const q4Snap = extractMemorySnapshot(q4Report)!;

      // Invariant 1: If expectation was already terminal MISSED, it durably stays MISSED
      const reEvaluatedDurable = evaluateExpectations(evaluatedQ3, q4Snap);
      assert.equal(reEvaluatedDurable[0].status, 'MISSED', 'Terminal outcome must be durable');
      assert.equal(reEvaluatedDurable[0].actualValue, 55000);

      // Invariant 3: Even if fresh PENDING expectation for Q3 is evaluated when Q4 is current snapshot,
      // it matches against Q3 in periodHistory, NOT Q4's 65,000!
      const freshEvaluatedAgainstQ4 = evaluateExpectations([expectation], q4Snap);
      assert.equal(freshEvaluatedAgainstQ4[0].status, 'MISSED', 'Canonical target-period resolver must resolve Q3 actual, not Q4');
      assert.equal(freshEvaluatedAgainstQ4[0].actualValue, 55000, 'Must use 55000 from Q3, not 65000 from Q4');
      assert.equal(freshEvaluatedAgainstQ4[0].actualPeriodFound, 'Q3 2026');

      // Invariant: If target period was never available/reached, remains PENDING
      const futureExpectation: TrackedExpectation = {
        ...expectation,
        expectationId: 'exp_future',
        targetPeriod: 'Q1 2027'
      };
      const futureEval = evaluateExpectations([futureExpectation], q4Snap);
      assert.equal(futureEval[0].status, 'PENDING');
    });
  });

  describe('Blocker 12 / Test L — Invalidation Conditions Classification', () => {
    it('correctly classifies deterministic numeric triggers vs manual review conditions', () => {
      // Deterministic triggers
      const condMargin = classifyInvalidationCondition('Operating margin drops below 35.0%');
      assert.equal(condMargin.type, 'DETERMINISTIC_TRIGGER');
      assert.equal(condMargin.metric, 'operating_margin_pct');
      assert.equal(condMargin.threshold, 35.0);

      const condFcf = classifyInvalidationCondition('Free cash flow drops below 25000');
      assert.equal(condFcf.type, 'DETERMINISTIC_TRIGGER');
      assert.equal(condFcf.metric, 'free_cash_flow');
      assert.equal(condFcf.threshold, 25000);

      // Manual review triggers (qualitative / free-text)
      const condComp = classifyInvalidationCondition('Materialization of primary risk: Competition');
      assert.equal(condComp.type, 'MANUAL_REVIEW_TRIGGER');
      assert.equal(condComp.metric, null);
      assert.equal(condComp.threshold, null);

      const condReg = classifyInvalidationCondition('Regulatory antitrust ban in European Union');
      assert.equal(condReg.type, 'MANUAL_REVIEW_TRIGGER');
      assert.equal(condReg.metric, null);
      assert.equal(condReg.threshold, null);
    });
  });

  describe('Sections 38, 39, 40 — Adaptive Valuation Assumptions & Guards (SOFI, MSFT, REIT)', () => {
    it('Section 38: SOFI with Financial Sector Guard does NOT show generic FCFF assumptions (WACC, terminal growth)', () => {
      const sofiReport: any = {
        ticker: 'SOFI',
        company_profile: {
          sector: 'Financial Services',
          industry: 'Credit Services'
        },
        valuation_model_used: {
          model_name: 'fintech_pe',
          is_guarded: true,
          guard_reason: 'Financial sector company: FCFF DCF inappropriate due to banking liabilities and capital requirements'
        },
        intrinsic_value: {
          current_price: 15.2,
          summary: { base_case_fair_value: 18.0 },
          // Even if generic prompt returned assumptions, Lumina guard filters them out
          assumptions: {
            discount_rate: 10.5,
            terminal_growth_rate: 3.0
          }
        },
        financial_statements: {
          periods: ['Q3 2026'],
          income_statement: {
            revenue: [750],
            net_income: [65]
          }
        }
      };

      // 1. Check business category resolution
      const category = resolveBusinessCategory(sofiReport, 'SOFI');
      assert.equal(category, 'financial');

      // 2. Check active valuation assumptions
      const activeBasis = getActiveValuationAssumptions(sofiReport, true);
      assert.equal(activeBasis.isGuarded, true);
      assert.ok(activeBasis.guardStatusTh?.includes('Financial Sector Guard'));
      // Invariant: No generic WACC or terminal growth assumptions presented
      assert.equal(activeBasis.assumptions.length, 0);
      assert.ok(!activeBasis.assumptions.some(a => a.labelEn.includes('WACC') || a.labelEn.includes('Terminal growth')));

      // 3. Check applicable metrics: FCF is NOT an AUTO metric for financial companies
      const applicable = getApplicableExpectationMetrics(sofiReport, 'SOFI');
      const autoMetrics = applicable.filter(m => m.evaluationMode === 'AUTO');
      assert.ok(autoMetrics.some(m => m.id === 'revenue'));
      assert.ok(autoMetrics.some(m => m.id === 'net_income'));
      assert.ok(!autoMetrics.some(m => m.id === 'free_cash_flow'), 'FCF must not be an AUTO expectation metric for banks/fintech');

      // Unsupported metrics are MANUAL only
      const manualMetrics = applicable.filter(m => m.evaluationMode === 'MANUAL');
      assert.ok(manualMetrics.some(m => m.id === 'deposits'));
      assert.ok(manualMetrics.some(m => m.id === 'net_interest_margin'));
      assert.ok(manualMetrics.some(m => m.id === 'net_charge_off_rate'));

      // 4. Draft thesis extraction preserves guarded status
      const draft = extractDraftThesisFromReport(sofiReport, 'user_sofi');
      assert.ok(draft);
      assert.ok(!draft?.keyAssumptions.some(a => a.toLowerCase().includes('wacc')), 'Draft keyAssumptions must not include generic WACC');
    });

    it('Section 39: MSFT Operating Company shows active DCF assumptions and operating metrics', () => {
      const msftReport: any = {
        ticker: 'MSFT',
        company_profile: {
          sector: 'Technology',
          industry: 'Software - Infrastructure'
        },
        intrinsic_value: {
          current_price: 430.0,
          summary: { base_case_fair_value: 480.0 },
          assumptions: {
            discount_rate: 8.5,
            terminal_growth_rate: 2.5,
            revenue_growth_rate: 12.0,
            target_fcf_margin: 32.0,
            forecast_years: 5
          }
        },
        financial_statements: {
          periods: ['Q3 2026'],
          income_statement: {
            revenue: [62000],
            operating_margin_pct: [45.0],
            net_income: [21900]
          },
          cash_flow: {
            free_cash_flow: [19500]
          }
        }
      };

      const category = resolveBusinessCategory(msftReport, 'MSFT');
      assert.equal(category, 'operating');

      const activeBasis = getActiveValuationAssumptions(msftReport, false);
      assert.equal(activeBasis.isGuarded, false);
      assert.ok(activeBasis.assumptions.some(a => a.labelEn.includes('WACC') && a.valueText === '8.5%'));
      assert.ok(activeBasis.assumptions.some(a => a.labelEn.includes('Terminal growth') && a.valueText === '2.5%'));

      const applicable = getApplicableExpectationMetrics(msftReport, 'MSFT');
      const autoMetrics = applicable.filter(m => m.evaluationMode === 'AUTO');
      assert.ok(autoMetrics.some(m => m.id === 'free_cash_flow'), 'FCF must be available for operating companies');
      assert.ok(autoMetrics.some(m => m.id === 'operating_margin_pct'));
    });

    it('Section 40: REIT company adapts valuation basis and does not fake AFFO evaluator', () => {
      const reitReport: any = {
        ticker: 'O',
        company_profile: {
          sector: 'Real Estate',
          industry: 'REIT - Retail'
        },
        valuation_model_used: {
          model_name: 'reit_affo',
          is_guarded: true,
          guard_reason: 'REIT company: Standard FCFF DCF unsuited for depreciation-heavy real estate'
        },
        intrinsic_value: {
          current_price: 52.0,
          summary: { base_case_fair_value: 58.0 }
        }
      };

      const category = resolveBusinessCategory(reitReport, 'O');
      assert.equal(category, 'reit');

      const activeBasis = getActiveValuationAssumptions(reitReport, true);
      assert.equal(activeBasis.isGuarded, true);
      assert.ok(activeBasis.guardStatusTh?.includes('REIT Guard'));
      assert.equal(activeBasis.assumptions.length, 0, 'No fake FCFF assumptions for REIT');

      const applicable = getApplicableExpectationMetrics(reitReport, 'O');
      // AFFO and FFO are MANUAL until canonical backend produces verified real estate fields
      const ffoDef = applicable.find(m => m.id === 'ffo');
      assert.ok(ffoDef);
      assert.equal(ffoDef?.evaluationMode, 'MANUAL', 'REIT FFO must be MANUAL without fake auto-evaluator');
    });
  });

  describe('Sections 41, 42 — Negative FCF and Missing Data Invariants', () => {
    it('Section 41: Negative FCF is handled correctly and not treated as missing or forced positive', () => {
      const negativeFcfReport: any = {
        ticker: 'GROWTH',
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: {
            revenue: [1200]
          },
          cash_flow: {
            free_cash_flow: [-350] // Real negative FCF
          }
        }
      };
      const snap = extractMemorySnapshot(negativeFcfReport)!;
      assert.equal(snap.financials.freeCashFlow, -350);

      const exp: TrackedExpectation = {
        expectationId: 'exp_neg_fcf',
        ticker: 'GROWTH',
        metricOrEvent: 'free_cash_flow',
        metricLabel: 'FCF Burn Target',
        targetValue: -400, // Target is to burn no worse than -$400M (i.e. >= -400)
        condition: 'gte',
        targetPeriod: 'Q2 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const evaluated = evaluateExpectations([exp], snap);
      // Actual -350 >= -400 -> MET or EXCEEDED!
      assert.ok(evaluated[0].status === 'MET' || evaluated[0].status === 'EXCEEDED');
      assert.equal(evaluated[0].actualValue, -350);
    });

    it('Section 42: Missing data is strictly UNAVAILABLE and never converted to 0', () => {
      const missingDataReport: any = {
        ticker: 'MISSING',
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: {
            revenue: [500]
            // net_income is missing
          }
        }
      };
      const snap = extractMemorySnapshot(missingDataReport)!;

      const exp: TrackedExpectation = {
        expectationId: 'exp_missing_ni',
        ticker: 'MISSING',
        metricOrEvent: 'net_income',
        metricLabel: 'Net Income Target',
        targetValue: 50,
        condition: 'gte',
        targetPeriod: 'Q2 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const evaluated = evaluateExpectations([exp], snap);
      assert.equal(evaluated[0].status, 'UNAVAILABLE');
      assert.equal(evaluated[0].actualValue, null, 'Must NOT convert missing net income to 0');
    });
  });

  describe('Sections 43, 44, 45 — Period Mismatch & Auto vs Manual Expectations', () => {
    it('Section 43: Auto expectation evaluates to MET with verified canonical data', () => {
      const report: any = {
        ticker: 'AUTO_CO',
        financial_statements: {
          periods: ['Q4 2026'],
          income_statement: {
            revenue: [1100]
          }
        }
      };
      const snap = extractMemorySnapshot(report)!;

      const exp: TrackedExpectation = {
        expectationId: 'exp_auto_rev',
        ticker: 'AUTO_CO',
        metricOrEvent: 'revenue',
        metricLabel: 'Revenue',
        targetValue: 1000,
        condition: 'gte',
        targetPeriod: 'Q4 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const evaluated = evaluateExpectations([exp], snap);
      assert.ok(evaluated[0].status === 'MET' || evaluated[0].status === 'EXCEEDED');
      assert.equal(evaluated[0].actualValue, 1100);
    });

    it('Section 44: Period mismatch (quarterly target vs annual only data) prevents silent comparison', () => {
      const annualOnlyReport: any = {
        ticker: 'ANNUAL_CO',
        financial_statements: {
          // Annual period only, no Q4 2026!
          periods: ['FY 2026'],
          income_statement: {
            revenue: [4500] // Annual revenue 4,500M
          }
        }
      };
      const snap = extractMemorySnapshot(annualOnlyReport)!;

      const quarterlyExp: TrackedExpectation = {
        expectationId: 'exp_q4_mismatch',
        ticker: 'ANNUAL_CO',
        metricOrEvent: 'revenue',
        metricLabel: 'Q4 Revenue',
        targetValue: 1200, // Target is Q4 2026 revenue of 1,200M
        condition: 'gte',
        targetPeriod: 'Q4 2026', // Quarterly target!
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const evaluated = evaluateExpectations([quarterlyExp], snap);
      // Invariant: Must NOT compare 4500 (annual) against 1200 (quarterly target) to mark it MET!
      assert.equal(evaluated[0].actualValue, null);
      assert.notEqual(evaluated[0].status, 'MET');
      assert.ok(evaluated[0].status === 'PENDING' || evaluated[0].status === 'UNAVAILABLE');
      assert.ok(evaluated[0].evaluationNotes?.includes('Period mismatch'), 'Note must explain period mismatch');
    });

    it('Section 45: Manual expectation is NEVER auto-resolved by AI or deterministic engine', () => {
      const bankReport: any = {
        ticker: 'BANK',
        financial_statements: {
          periods: ['Q3 2026'],
          income_statement: {
            revenue: [800],
            net_income: [90]
          }
        }
      };
      const snap = extractMemorySnapshot(bankReport)!;

      const manualExp: TrackedExpectation = {
        expectationId: 'exp_manual_nim',
        ticker: 'BANK',
        metricOrEvent: 'net_interest_margin',
        metricLabel: 'Net Interest Margin (%)',
        targetValue: 3.2,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        evaluationMode: 'MANUAL', // Marked manual review
        sourceReportId: 'rep_prev',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };

      const evaluated = evaluateExpectations([manualExp], snap);
      // Invariant: Must remain PENDING with manual review note
      assert.equal(evaluated[0].status, 'PENDING');
      assert.equal(evaluated[0].actualValue, null);
      assert.ok(evaluated[0].evaluationNotes?.includes('Manual review required'));
    });
  });

  describe('Sections 46, 47, 48 — Invalidation Triggers, Thesis Revision & Isolation', () => {
    it('Section 46: Narrative invalidation condition is classified as manual review and never auto-invalidated', () => {
      const narrativeCond = 'Material deterioration in consumer lending credit quality';
      const classified = classifyInvalidationCondition(narrativeCond);
      assert.equal(classified.type, 'MANUAL_REVIEW_TRIGGER');
      assert.equal(classified.metric, null);
    });

    it('Section 47: Thesis revision v1 -> edit -> v2 preserves history and does not overwrite v1', () => {
      const initialDraft = extractDraftThesisFromReport(sampleReport, 'user_alice')!;
      assert.equal(initialDraft.version, 1);
      assert.equal(initialDraft.confirmationStatus, 'AI_DRAFT');

      const confirmedV2 = confirmUserThesis(initialDraft, {
        summary: 'Confirmed v2 summary by user'
      }, 'user_alice');

      assert.equal(confirmedV2.version, 2);
      assert.equal(confirmedV2.confirmationStatus, 'USER_EDITED');
      assert.equal(confirmedV2.summary, 'Confirmed v2 summary by user');

      // v1 remains immutable
      assert.equal(initialDraft.version, 1);
      assert.equal(initialDraft.confirmationStatus, 'AI_DRAFT');
    });

    it('Section 48: User scoping ensures User A thesis/expectations carry their userId', () => {
      const thesisA = extractDraftThesisFromReport(sampleReport, 'user_A')!;
      assert.equal(thesisA.userId, 'user_A');

      const expA: TrackedExpectation = {
        expectationId: 'exp_A',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Revenue',
        targetValue: 60000,
        condition: 'gte',
        targetPeriod: 'Q3 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: null,
        userId: 'user_A',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };
      assert.equal(expA.userId, 'user_A');
    });
  });
});
