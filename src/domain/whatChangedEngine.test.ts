import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemorySnapshot } from './investmentMemory';
import { TrackedExpectation } from './thesisExpectations';
import { computeWhatChanged } from './whatChangedEngine';

describe('whatChangedEngine', () => {
  const basePrevReport: any = {
    ticker: 'MSFT',
    id: 'rep_prev',
    schema_version: 2,
    generated_at: '2026-01-15T00:00:00Z',
    intrinsic_value: {
      current_price: 400.0,
      summary: { base_case_fair_value: 450.0 },
      assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
    },
    verdict: { conviction_score: 80, summary: 'Initial thesis prose' },
    comprehensive_analysis: {
      beginner_summary: { top_3_risks: ['Cloud slowdown', 'Regulatory antitrust'] }
    },
    catalysts_and_events: {
      items: [{ title: 'Q2 earnings release' }]
    },
    financial_statements: {
      periods: ['Q2 2026'],
      income_statement: { revenue: [50000], yoy_revenue_growth_pct: [12.0], operating_income: [20000], operating_margin_pct: [40.0] },
      cash_flow: { free_cash_flow: [15000] }
    },
    sec_verification: {
      financialDataSource: 'sec_verified',
      sec_period_statements: [{ period: 'Q2 2026', accession: '0000950170-26-000100' }],
      submissions: { recentFilings: [{ accessionNumber: '0000950170-26-000100', filingDate: '2026-01-20' }] }
    }
  };

  const baseCurrReport: any = {
    ticker: 'MSFT',
    id: 'rep_curr',
    schema_version: 2,
    generated_at: '2026-04-15T00:00:00Z',
    intrinsic_value: {
      current_price: 460.0, // +15%
      summary: { base_case_fair_value: 500.0 }, // +11.1%
      assumptions: { discount_rate: 8.0, terminal_growth_rate: 2.5 } // WACC -0.5%
    },
    verdict: { conviction_score: 87, summary: 'Upgraded thesis prose' }, // +7 pts
    comprehensive_analysis: {
      beginner_summary: { top_3_risks: ['Cloud slowdown', 'Hardware capex escalation'] } // New risk: capex; Resolved: antitrust
    },
    catalysts_and_events: {
      items: [{ title: 'Q2 earnings release' }, { title: 'Azure AI developer summit' }] // New catalyst
    },
    financial_statements: {
      periods: ['Q3 2026'],
      income_statement: { revenue: [58000], yoy_revenue_growth_pct: [16.0], operating_income: [25520], operating_margin_pct: [44.0] },
      cash_flow: { free_cash_flow: [18500] }
    },
    sec_verification: {
      financialDataSource: 'sec_verified',
      sec_period_statements: [{ period: 'Q3 2026', accession: '0000950170-26-000200' }],
      submissions: { recentFilings: [{ accessionNumber: '0000950170-26-000200', filingDate: '2026-04-20' }] }
    }
  };

  it('computes unified What Changed result with deterministic deltas and materiality rankings', () => {
    const prevSnap = extractMemorySnapshot(basePrevReport)!;
    const currSnap = extractMemorySnapshot(baseCurrReport)!;

    const expectations: TrackedExpectation[] = [
      {
        expectationId: 'exp_rev',
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
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z'
      }
    ];

    const result = computeWhatChanged(currSnap, prevSnap, expectations);

    assert.equal(result.ticker, 'MSFT');
    assert.equal(result.hasMaterialChanges, true);
    assert.ok(result.materialChangesCount >= 4);

    // Verify fair value change
    const fvItem = result.items.find(i => i.id === 'change_fair_value');
    assert.ok(fvItem);
    assert.equal(fvItem?.materiality, 'HIGH');
    assert.equal(fvItem?.deltaDisplay, '+11.1%');
    assert.ok(fvItem?.explanationTh);

    // Verify price change
    const priceItem = result.items.find(i => i.id === 'change_price');
    assert.ok(priceItem);
    assert.equal(priceItem?.materiality, 'HIGH');
    assert.equal(priceItem?.deltaDisplay, '+15.0%');

    // Verify expectation evaluation: target 60000 vs actual 58000 -> MISSED
    const expItem = result.items.find(i => i.id === 'change_exp_exp_rev');
    assert.ok(expItem);
    assert.equal(expItem?.deltaDisplay, 'MISSED');
    assert.equal(expItem?.materiality, 'HIGH');

    // Verify SEC filing change
    const secItem = result.items.find(i => i.id === 'change_sec_filing');
    assert.ok(secItem);
    assert.equal(secItem?.materiality, 'HIGH');
    assert.equal(secItem?.evidenceRef, '0000950170-26-000200');

    // Verify valuation attribution
    assert.ok(result.valuationAttribution);
    assert.equal(result.valuationAttribution?.isDeterministic, true);
  });

  it('handles unchanged state truthfully without inventing false changes', () => {
    const prevSnap = extractMemorySnapshot(basePrevReport)!;
    const identicalReport = {
      ...basePrevReport,
      id: 'rep_curr_same',
      generated_at: '2026-01-20T00:00:00Z'
    };
    const currSnap = extractMemorySnapshot(identicalReport)!;

    const result = computeWhatChanged(currSnap, prevSnap, []);

    assert.equal(result.hasMaterialChanges, false);
    assert.equal(result.materialChangesCount, 0);
    assert.match(result.summaryNarrative, /No material changes detected/);
    assert.match(result.summaryNarrativeTh, /ไม่พบการเปลี่ยนแปลงที่มีนัยสำคัญ/);
  });

  it('evaluates financial-sector company (SOFI) safely without generic FCFF', () => {
    const prevSofi = {
      ticker: 'SOFI',
      id: 'sofi_1',
      schema_version: 2,
      company_profile: { industry: 'Credit Services', sector: 'Financial Services' },
      intrinsic_value: { current_price: 10.0, summary: { base_case_fair_value: 12.0 } },
      financial_statements: { periods: ['Q1 2026'], income_statement: { revenue: [500] } }
    };
    const currSofi = {
      ticker: 'SOFI',
      id: 'sofi_2',
      schema_version: 2,
      company_profile: { industry: 'Credit Services', sector: 'Financial Services' },
      intrinsic_value: { current_price: 11.0, summary: { base_case_fair_value: 13.5 } },
      financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [560] } }
    };

    const prevSnap = extractMemorySnapshot(prevSofi)!;
    const currSnap = extractMemorySnapshot(currSofi)!;

    const result = computeWhatChanged(currSnap, prevSnap, []);
    assert.equal(result.ticker, 'SOFI');
    assert.equal(result.hasMaterialChanges, true);
    // Fair value moved +12.5%
    const fvItem = result.items.find(i => i.id === 'change_fair_value');
    assert.ok(fvItem);
    assert.equal(fvItem?.deltaDisplay, '+12.5%');
    // FCF item should not exist
    const fcfItem = result.items.find(i => i.id === 'change_fcf');
    assert.equal(fcfItem, undefined);
  });
});
