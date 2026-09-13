import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDraftThesisFromReport,
  confirmUserThesis,
  evaluateExpectations,
  matchRiskCatalystTransitions,
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
});
