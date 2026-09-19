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
      sec_period_statements: [{ period: 'Q2 2026', revenue: 50000, operating_income: 20000, accession: '0000950170-26-000100' }],
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
      sec_period_statements: [{ period: 'Q3 2026', revenue: 58000, operating_income: 25520, accession: '0000950170-26-000200' }],
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

  describe('Blocker 11 / Test K — Risk and Catalyst Uncertainty Propagation', () => {
    it('ambiguous risk rewording ("Cloud demand slowdown" vs "Slower enterprise cloud spending") produces at most one review-needed change and never definitive NEW/RESOLVED/HIGH', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Cloud demand slowdown'] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Slower enterprise cloud spending'] }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);

      // 1. Must NOT produce "New material risk emerged"
      const newMaterialRisk = result.items.find(i =>
        i.explanation?.toLowerCase().includes('new material risk emerged') ||
        i.metricLabel === 'New Risk Identified' ||
        i.deltaDisplay === 'NEW RISK'
      );
      assert.equal(newMaterialRisk, undefined, 'Must NOT produce definitive New Risk Identified or NEW RISK');

      // 2. Must NOT produce "Prior Risk Resolved"
      const resolvedRisk = result.items.find(i =>
        i.metricLabel === 'Prior Risk Resolved' ||
        i.deltaDisplay === 'RESOLVED'
      );
      assert.equal(resolvedRisk, undefined, 'Must NOT produce definitive Prior Risk Resolved');

      // 3. Must produce at most one uncertain / review-needed change
      const riskItems = result.items.filter(i => i.category === 'RISKS_AND_CATALYSTS');
      assert.equal(riskItems.length, 1, 'Should produce at most one uncertain/review-needed change');

      const uncertainItem = riskItems[0];
      assert.equal(uncertainItem.deltaDisplay, 'POSSIBLE RISK CHANGE');
      assert.match(uncertainItem.metricLabel, /Risk Wording Changed/i);
      assert.notEqual(uncertainItem.materiality, 'HIGH', 'Uncertain AI wording change must NOT generate a definitive HIGH event');
    });

    it('unmatched free-text risk produces unconfirmed transition without definitive HIGH materiality', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Antitrust investigation into app store policies'] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Supply chain disruption in Southeast Asia'] }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);

      // Unmatched free text items are uncertain (isCertain === false)
      for (const item of result.items.filter(i => i.category === 'RISKS_AND_CATALYSTS')) {
        assert.notEqual(item.materiality, 'HIGH', 'Free-text risk transition must not receive definitive HIGH materiality');
        assert.notEqual(item.deltaDisplay, 'NEW RISK', 'Free-text risk must not state definitive NEW RISK');
        assert.notEqual(item.deltaDisplay, 'RESOLVED', 'Free-text risk must not state definitive RESOLVED');
      }
    });
  });

  describe('What Changed Intelligence Semantics — Tests 31 to 41 & Cross-Sector', () => {
    it('Test 31: Canonical change counts eliminate contradictory counts across UI surfaces', () => {
      const prevReport = {
        ticker: 'SOFI',
        id: 'sofi_prev',
        schema_version: 2,
        generated_at: '2026-09-19T05:22:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 74 },
        comprehensive_analysis: {
          beginner_summary: {
            top_3_risks: ['Risk A', 'Risk B', 'Risk C', 'Risk D', 'Risk E', 'Risk F', 'Risk G', 'Risk H']
          }
        },
        catalysts_and_events: {
          items: [{ title: 'Cat A' }, { title: 'Cat B' }]
        },
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: { revenue: [500], net_income: [156.59] }
        }
      };

      // Current report with 3 review items (ambiguous rewording) and 10 research coverage items (omissions + conviction drift)
      const currReport = {
        ticker: 'SOFI',
        id: 'sofi_curr',
        schema_version: 2,
        generated_at: '2026-09-19T05:30:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 76 }, // +2 pts drift without evidence
        comprehensive_analysis: {
          beginner_summary: {
            top_3_risks: [
              'Risk A evolved slightly in wording', // Needs Review 1
              'Risk B evolved slightly in wording'  // Needs Review 2
            ]
            // Risks C-H omitted -> Research coverage omissions
          }
        },
        catalysts_and_events: {
          items: [
            { title: 'Cat A evolved in prose' } // Needs Review 3
            // Cat B omitted -> Research coverage omission
          ]
        },
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: { revenue: [500], net_income: [156.59] }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);

      // 1. Canonical summary must have 0 confirmed material
      assert.equal(result.summary.confirmedMaterial, 0);
      assert.equal(result.hasMaterialChanges, false);
      assert.equal(result.materialChangesCount, 0);

      // 2. Needs Review count matches ambiguous items
      assert.ok(result.summary.needsReview >= 3);

      // 3. Research coverage count matches omissions + conviction drift
      assert.ok(result.summary.researchCoverage >= 5);

      // 4. Summary narrative does NOT claim "significant changes" when confirmedMaterial is 0
      assert.doesNotMatch(result.summaryNarrative, /Identified [1-9]\d* confirmed material/);
      assert.match(result.summaryNarrative, /0 confirmed material changes/);
      assert.match(result.summaryNarrativeTh, /ยังไม่มีการเปลี่ยนแปลงที่ยืนยันแล้วและมีนัยสำคัญ/);
      assert.match(result.summaryNarrativeTh, /ประเด็นที่ควรตรวจสอบเพิ่มเติม/);
    });

    it('Test 32: "Omitted from prose" defaults to RESEARCH_COVERAGE_CHANGE / RESEARCH_ONLY and never triggers re-evaluation', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 450.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Macroeconomic recession risk'] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 450.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: [] } // Omitted
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const omittedItem = result.items.find(i => i.currentValue === 'Omitted from prose');

      assert.ok(omittedItem, 'Should produce an omitted item');
      assert.equal(omittedItem?.domain, 'RESEARCH_COVERAGE_CHANGE');
      assert.equal(omittedItem?.confirmation, 'RESEARCH_ONLY');
      assert.equal(omittedItem?.materiality, 'LOW');
      assert.notEqual(omittedItem?.deltaDisplay, 'RESOLVED');
      assert.equal(result.summary.confirmedMaterial, 0);
    });

    it('Test 33: "Not tracked -> mentioned" risk without evidence is UNCONFIRMED Needs Review, never confirmed company change', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 450.0 } },
        comprehensive_analysis: { beginner_summary: { top_3_risks: [] } }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 450.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Competition with banks may cause slowdown'] }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const newItem = result.items.find(i => i.currentValue === 'Competition with banks may cause slowdown');

      assert.ok(newItem);
      assert.equal(newItem?.domain, 'RESEARCH_COVERAGE_CHANGE');
      assert.equal(newItem?.confirmation, 'UNCONFIRMED');
      assert.equal(newItem?.deltaDisplay, 'POSSIBLE RISK CHANGE');
      assert.equal(result.summary.confirmedMaterial, 0);
      assert.equal(result.summary.needsReview, 1);
    });

    it('Test 34: Real fundamental change produces CONFIRMED EVIDENCE_CHANGE with calculated severity', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        financial_statements: {
          periods: ['Q1 2026'],
          income_statement: { revenue: [50000], yoy_revenue_growth_pct: [10.0] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: { revenue: [58000], yoy_revenue_growth_pct: [16.0] } // +6.0% pts -> HIGH
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const revItem = result.items.find(i => i.id === 'change_revenue_yoy');

      assert.ok(revItem);
      assert.equal(revItem?.domain, 'EVIDENCE_CHANGE');
      assert.equal(revItem?.confirmation, 'CONFIRMED');
      assert.equal(revItem?.materiality, 'HIGH');
      assert.equal(result.summary.confirmedMaterial, 1);
    });

    it('Test 35: Material SEC filing update is CONFIRMED EVIDENCE_CHANGE eligible for re-evaluation', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        evidence: { secAccession: '0000950170-26-000100', secFilingDate: '2026-01-20' }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        evidence: { secAccession: '0000950170-26-000200', secFilingDate: '2026-04-20' }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const secItem = result.items.find(i => i.id === 'change_sec_filing');

      assert.ok(secItem);
      assert.equal(secItem?.domain, 'EVIDENCE_CHANGE');
      assert.equal(secItem?.confirmation, 'CONFIRMED');
      assert.equal(secItem?.evidenceRef, '0000950170-26-000200');
    });

    it('Test 36: Conviction drift (74 -> 76 in 8 min without evidence) is classified as ANALYSIS_DRIFT / RESEARCH_ONLY', () => {
      const prevReport = {
        ticker: 'SOFI',
        id: 'sofi_1',
        schema_version: 2,
        generated_at: '2026-09-19T05:22:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 74 },
        financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [500], net_income: [156.59] } }
      };

      const currReport = {
        ticker: 'SOFI',
        id: 'sofi_2',
        schema_version: 2,
        generated_at: '2026-09-19T05:30:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 76 }, // +2 pts
        financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [500], net_income: [156.59] } }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const convItem = result.items.find(i => i.id === 'change_conviction');

      assert.ok(convItem);
      assert.equal(convItem?.domain, 'RESEARCH_COVERAGE_CHANGE');
      assert.equal(convItem?.confirmation, 'RESEARCH_ONLY');
      assert.equal(convItem?.materiality, 'LOW');
      assert.equal(result.summary.confirmedMaterial, 0);
    });

    it('Test 37: Evidence-driven conviction change is CONFIRMED THESIS_MODEL_CHANGE', () => {
      const prevReport = {
        ticker: 'SOFI',
        id: 'sofi_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 10.0, summary: { base_case_fair_value: 12.0 } },
        verdict: { conviction_score: 74 },
        financial_statements: { periods: ['Q1 2026'], income_statement: { revenue: [500], net_income: [100] } }
      };

      const currReport = {
        ticker: 'SOFI',
        id: 'sofi_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 12.0, summary: { base_case_fair_value: 14.0 } },
        verdict: { conviction_score: 82 }, // +8 pts backed by net income + revenue growth
        financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [600], net_income: [150] } }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const convItem = result.items.find(i => i.id === 'change_conviction');

      assert.ok(convItem);
      assert.equal(convItem?.domain, 'THESIS_MODEL_CHANGE');
      assert.equal(convItem?.confirmation, 'CONFIRMED');
      assert.equal(convItem?.materiality, 'MEDIUM');
    });

    it('Test 38: Unattributable score change states truthful explanation without inventing facts', () => {
      const prevReport = {
        ticker: 'SOFI',
        id: 'sofi_1',
        schema_version: 2,
        generated_at: '2026-09-19T05:22:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 74 }
      };

      const currReport = {
        ticker: 'SOFI',
        id: 'sofi_2',
        schema_version: 2,
        generated_at: '2026-09-19T05:30:00Z',
        intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
        verdict: { conviction_score: 76 }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      const convItem = result.items.find(i => i.id === 'change_conviction');

      assert.ok(convItem);
      assert.match(convItem?.explanationTh || '', /สาเหตุของการเปลี่ยนแปลงคะแนนยังไม่สามารถเชื่อมโยงกับหลักฐานใหม่ได้/);
      assert.match(convItem?.explanation || '', /delta is not attributable to new verified evidence/);
    });

    it('Test 39: Multiple low research changes are grouped under researchCoverage', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: {
            top_3_risks: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']
          }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: {
            top_3_risks: [] // 9 omissions
          }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);

      assert.equal(result.summary.researchCoverage, 9);
      assert.equal(result.summary.confirmedMaterial, 0);
    });

    it('Test 40: Needs Review triggers REVIEW_SUGGESTED, never RE_EVALUATION_WARRANTED without confirmed material change', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: { top_3_risks: ['Risk 1', 'Risk 2', 'Risk 3'] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        comprehensive_analysis: {
          beginner_summary: {
            top_3_risks: [
              'Risk 1 rephrased slightly',
              'Risk 2 rephrased slightly',
              'Risk 3 rephrased slightly'
            ]
          }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      assert.equal(result.summary.confirmedMaterial, 0);
      assert.equal(result.summary.needsReview, 3);
    });

    it('Test 41: Confirmed material change triggers RE_EVALUATION_WARRANTED', () => {
      const prevReport = {
        ticker: 'MSFT',
        id: 'rep_1',
        schema_version: 2,
        generated_at: '2026-01-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
        financial_statements: {
          periods: ['Q1 2026'],
          income_statement: { revenue: [50000], operating_margin_pct: [40.0] }
        }
      };

      const currReport = {
        ticker: 'MSFT',
        id: 'rep_2',
        schema_version: 2,
        generated_at: '2026-04-15T00:00:00Z',
        intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 460.0 } }, // +15% FV -> HIGH
        financial_statements: {
          periods: ['Q2 2026'],
          income_statement: { revenue: [50000], operating_margin_pct: [40.0] }
        }
      };

      const prevSnap = extractMemorySnapshot(prevReport)!;
      const currSnap = extractMemorySnapshot(currReport)!;

      const result = computeWhatChanged(currSnap, prevSnap, []);
      assert.equal(result.summary.confirmedMaterial, 1);
      assert.equal(result.hasMaterialChanges, true);
    });

    describe('Cross-Sector Generic Validation (no ticker-specific hacks)', () => {
      it('evaluates REIT fixture safely without generic FCFF', () => {
        const prevReit = {
          ticker: 'O',
          id: 'reit_1',
          schema_version: 2,
          company_profile: { sector: 'Real Estate', industry: 'REIT - Retail' },
          intrinsic_value: { current_price: 52.0, summary: { base_case_fair_value: 58.0 } },
          financial_statements: { periods: ['Q1 2026'], income_statement: { revenue: [1200] } }
        };
        const currReit = {
          ticker: 'O',
          id: 'reit_2',
          schema_version: 2,
          company_profile: { sector: 'Real Estate', industry: 'REIT - Retail' },
          intrinsic_value: { current_price: 53.0, summary: { base_case_fair_value: 58.0 } },
          financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [1250] } }
        };

        const prevSnap = extractMemorySnapshot(prevReit)!;
        const currSnap = extractMemorySnapshot(currReit)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);
        assert.equal(result.ticker, 'O');
        assert.equal(result.items.some(i => i.id === 'change_fcf'), false);
      });

      it('evaluates cyclical company fixture with margin and revenue fluctuations', () => {
        const prevCyclical = {
          ticker: 'XOM',
          id: 'xom_1',
          schema_version: 2,
          company_profile: { sector: 'Energy', industry: 'Oil & Gas Integrated' },
          intrinsic_value: { current_price: 110.0, summary: { base_case_fair_value: 120.0 } },
          financial_statements: {
            periods: ['Q1 2026'],
            income_statement: { revenue: [85000], operating_margin_pct: [15.0] }
          }
        };
        const currCyclical = {
          ticker: 'XOM',
          id: 'xom_2',
          schema_version: 2,
          company_profile: { sector: 'Energy', industry: 'Oil & Gas Integrated' },
          intrinsic_value: { current_price: 115.0, summary: { base_case_fair_value: 120.0 } },
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [92000], operating_margin_pct: [19.0] } // Margin +4.0% pts -> HIGH
          }
        };

        const prevSnap = extractMemorySnapshot(prevCyclical)!;
        const currSnap = extractMemorySnapshot(currCyclical)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);
        assert.equal(result.ticker, 'XOM');
        const opm = result.items.find(i => i.id === 'change_op_margin');
        assert.ok(opm);
        assert.equal(opm?.materiality, 'HIGH');
        assert.equal(opm?.domain, 'EVIDENCE_CHANGE');
        assert.equal(opm?.confirmation, 'CONFIRMED');
      });

      it('evaluates negative-FCF early-stage company without crashing or false zero', () => {
        const prevEarly = {
          ticker: 'RIVN',
          id: 'rivn_1',
          schema_version: 2,
          company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
          intrinsic_value: { current_price: 12.0, summary: { base_case_fair_value: 15.0 } },
          financial_statements: {
            periods: ['Q1 2026'],
            income_statement: { revenue: [1200] },
            cash_flow: { free_cash_flow: [-1500] }
          }
        };
        const currEarly = {
          ticker: 'RIVN',
          id: 'rivn_2',
          schema_version: 2,
          company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
          intrinsic_value: { current_price: 13.0, summary: { base_case_fair_value: 15.0 } },
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [1400] },
            cash_flow: { free_cash_flow: [-1000] } // Cash burn improved by 33.3%
          }
        };

        const prevSnap = extractMemorySnapshot(prevEarly)!;
        const currSnap = extractMemorySnapshot(currEarly)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);
        assert.equal(result.ticker, 'RIVN');
        const fcfItem = result.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfItem);
        assert.equal(fcfItem?.domain, 'EVIDENCE_CHANGE');
        assert.equal(fcfItem?.confirmation, 'CONFIRMED');
        assert.equal(fcfItem?.deltaDisplay, '+33.3%');
      });
    });

    describe('Semantic Deduplication & Lifecycle Reconciliation (Tests 34-42)', () => {
      it('Test 34: Paraphrase of same risk resolves to single TRACKED -> TRACKED without duplicate new + omitted', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: {
            beginner_summary: {
              top_3_risks: ['Macroeconomic recession could weaken borrower quality.']
            }
          }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: {
            beginner_summary: {
              top_3_risks: ['Economic slowdown may increase borrower stress.']
            }
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        // Exactly 1 risk transition: ACTIVE -> ACTIVE (TRACKED -> TRACKED)
        const riskTransitions = result.itemTransitions.filter(t => t.category === 'risk');
        assert.equal(riskTransitions.length, 1);
        assert.equal(riskTransitions[0].previousState, 'ACTIVE');
        assert.equal(riskTransitions[0].currentState, 'ACTIVE');

        // Must NOT output both NEW and OMITTED
        assert.equal(result.items.some(i => i.deltaDisplay === 'NEW RISK'), false);
        assert.equal(result.items.some(i => i.deltaDisplay === 'OMITTED FROM PROSE'), false);
        assert.equal(result.items.some(i => i.deltaDisplay === 'POSSIBLE RISK CHANGE'), true);
        assert.equal(result.summary.totalDetected, 1);
        assert.equal(result.summary.needsReview, 1);
      });

      it('Test 35: Genuinely new subject emits single NEWLY_TRACKED item', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: {
            beginner_summary: { top_3_risks: [] }
          }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: {
            beginner_summary: { top_3_risks: ['Cybersecurity data breach risk'] }
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        assert.equal(result.summary.totalDetected, 1);
        assert.equal(result.summary.needsReview, 1);
        assert.equal(result.items[0].deltaDisplay, 'POSSIBLE RISK CHANGE');
        assert.equal(result.items[0].driftSubtype, 'PROSE_COVERAGE');
      });

      it('Test 36: Omitted subject emits single OMITTED_FROM_CURRENT_RESEARCH item under Research Coverage', () => {
        const prevReport = {
          ticker: 'O',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 50.0, summary: { base_case_fair_value: 55.0 } },
          comprehensive_analysis: {
            beginner_summary: { top_3_risks: ['Debt maturity refinancing risk'] }
          }
        };

        const currReport = {
          ticker: 'O',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 50.0, summary: { base_case_fair_value: 55.0 } },
          comprehensive_analysis: {
            beginner_summary: { top_3_risks: [] }
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        assert.equal(result.summary.totalDetected, 1);
        assert.equal(result.summary.researchCoverage, 1);
        assert.equal(result.items[0].deltaDisplay, 'OMITTED FROM PROSE');
        assert.equal(result.items[0].confirmation, 'RESEARCH_ONLY');
        assert.equal(result.items[0].driftSubtype, 'PROSE_COVERAGE');
      });

      it('Test 37: Same entity with different topics remain distinct without over-merging', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          catalysts_and_events: {
            items: [{ title: 'Citizens Bank partnership supports distribution' }]
          }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          catalysts_and_events: {
            items: [{ title: 'Citizens Bank competition pressures lending economics' }]
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        // Different topics (partnership vs competition) MUST NOT be merged!
        // 1 omitted partnership catalyst + 1 new competition catalyst = 2 distinct items
        assert.equal(result.items.length, 2);
        assert.ok(result.items.some(i => i.deltaDisplay === 'OMITTED FROM PROSE'));
        assert.ok(result.items.some(i => i.deltaDisplay === 'POSSIBLE CATALYST CHANGE'));
      });

      it('Test 38: Duplicate paraphrases within same report normalize to single canonical subject', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: [] } }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 15.0, summary: { base_case_fair_value: 18.0 } },
          comprehensive_analysis: {
            beginner_summary: {
              top_3_risks: [
                'Macro slowdown risk could hurt lending volume',
                'Economic recession risk may reduce borrower demand'
              ]
            }
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        // Both refer to macroeconomy:recession -> deduplicated to 1 canonical item
        assert.equal(result.summary.totalDetected, 1);
        assert.equal(result.items.length, 1);
      });

      it('Test 39: Conviction drift without verified evidence is classified as ANALYSIS_MODEL_DRIFT', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'sofi_1',
          schema_version: 2,
          generated_at: '2026-09-19T05:22:00Z',
          intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
          verdict: { conviction_score: 76 }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'sofi_2',
          schema_version: 2,
          generated_at: '2026-09-19T05:30:00Z',
          intrinsic_value: { current_price: 16.96, summary: { base_case_fair_value: 20.0 } },
          verdict: { conviction_score: 75 } // -1 pt drift
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);
        const convItem = result.items.find(i => i.id === 'change_conviction');

        assert.ok(convItem);
        assert.equal(convItem?.domain, 'RESEARCH_COVERAGE_CHANGE');
        assert.equal(convItem?.confirmation, 'RESEARCH_ONLY');
        assert.equal(convItem?.driftSubtype, 'ANALYSIS_MODEL_DRIFT');
        assert.equal(convItem?.materiality, 'LOW');
        assert.equal(result.hasMaterialChanges, false);
      });

      it('Test 40: Evidence-driven conviction change is THESIS_MODEL_CHANGE', () => {
        const prevReport = {
          ticker: 'SOFI',
          id: 'sofi_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 10.0, summary: { base_case_fair_value: 12.0 } },
          verdict: { conviction_score: 76 },
          financial_statements: { periods: ['Q1 2026'], income_statement: { revenue: [500], net_income: [100] } }
        };

        const currReport = {
          ticker: 'SOFI',
          id: 'sofi_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 12.0, summary: { base_case_fair_value: 14.0 } },
          verdict: { conviction_score: 79 }, // +3 pts backed by verified net income + revenue
          financial_statements: { periods: ['Q2 2026'], income_statement: { revenue: [600], net_income: [150] } }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);
        const convItem = result.items.find(i => i.id === 'change_conviction');

        assert.ok(convItem);
        assert.equal(convItem?.domain, 'THESIS_MODEL_CHANGE');
        assert.equal(convItem?.confirmation, 'CONFIRMED');
      });

      it('Test 41: Canonical counts strictly reflect deduped items without double-counting', () => {
        const prevReport = {
          ticker: 'MSFT',
          id: 'rep_1',
          schema_version: 2,
          generated_at: '2026-01-15T00:00:00Z',
          intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
          comprehensive_analysis: {
            beginner_summary: {
              top_3_risks: [
                'Macroeconomic recession could weaken demand',
                'Cloud slowdown risk',
                'Regulatory antitrust investigation'
              ]
            }
          }
        };

        const currReport = {
          ticker: 'MSFT',
          id: 'rep_2',
          schema_version: 2,
          generated_at: '2026-04-15T00:00:00Z',
          intrinsic_value: { current_price: 400.0, summary: { base_case_fair_value: 400.0 } },
          comprehensive_analysis: {
            beginner_summary: {
              top_3_risks: [
                'Economic slowdown may reduce customer spend', // Paraphrase of recession
                'Cloud slowdown risk', // Exact match
                'Cybersecurity threat' // New risk
              ]
            }
          }
        };

        const prevSnap = extractMemorySnapshot(prevReport)!;
        const currSnap = extractMemorySnapshot(currReport)!;

        const result = computeWhatChanged(currSnap, prevSnap, []);

        // Items:
        // 1. Cloud slowdown: CONTINUED_UNCHANGED -> no item
        // 2. Recession / slowdown: CONTINUED_PARAPHRASED -> 1 item (UNCONFIRMED / Needs Review)
        // 3. Antitrust: OMITTED_FROM_CURRENT_RESEARCH -> 1 item (RESEARCH_ONLY / Research Coverage)
        // 4. Cybersecurity: NEWLY_TRACKED -> 1 item (UNCONFIRMED / Needs Review)
        // Total = 3 items
        assert.equal(result.items.length, 3);
        assert.equal(result.summary.totalDetected, 3);
        assert.equal(result.summary.needsReview, 2);
        assert.equal(result.summary.researchCoverage, 1);
        assert.equal(result.summary.confirmedMaterial, 0);
      });

      it('Test 42: Semantic dedupe works across sectors without ticker-specific branches', () => {
        // Tech
        const techPrev = extractMemorySnapshot({
          ticker: 'MSFT', id: '1', schema_version: 2,
          intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 400 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['AI competition from hyperscalers'] } }
        })!;
        const techCurr = extractMemorySnapshot({
          ticker: 'MSFT', id: '2', schema_version: 2,
          intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 400 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Competitive pressure from cloud AI platforms'] } }
        })!;
        const techRes = computeWhatChanged(techCurr, techPrev, []);
        assert.equal(techRes.items.length, 1);
        assert.equal(techRes.items[0].deltaDisplay, 'POSSIBLE RISK CHANGE');

        // Financial
        const finPrev = extractMemorySnapshot({
          ticker: 'JPM', id: '1', schema_version: 2,
          company_profile: { sector: 'Financial Services' },
          intrinsic_value: { current_price: 200, summary: { base_case_fair_value: 200 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Credit deterioration risk'] } }
        })!;
        const finCurr = extractMemorySnapshot({
          ticker: 'JPM', id: '2', schema_version: 2,
          company_profile: { sector: 'Financial Services' },
          intrinsic_value: { current_price: 200, summary: { base_case_fair_value: 200 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Higher delinquencies may pressure credit quality'] } }
        })!;
        const finRes = computeWhatChanged(finCurr, finPrev, []);
        assert.equal(finRes.items.length, 1);
        assert.equal(finRes.items[0].deltaDisplay, 'POSSIBLE RISK CHANGE');

        // REIT
        const reitPrev = extractMemorySnapshot({
          ticker: 'PLD', id: '1', schema_version: 2,
          company_profile: { sector: 'Real Estate' },
          intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 120 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Refinancing risk'] } }
        })!;
        const reitCurr = extractMemorySnapshot({
          ticker: 'PLD', id: '2', schema_version: 2,
          company_profile: { sector: 'Real Estate' },
          intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 120 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Higher debt refinancing costs'] } }
        })!;
        const reitRes = computeWhatChanged(reitCurr, reitPrev, []);
        assert.equal(reitRes.items.length, 1);
        assert.equal(reitRes.items[0].deltaDisplay, 'POSSIBLE RISK CHANGE');

        // Energy
        const energyPrev = extractMemorySnapshot({
          ticker: 'CVX', id: '1', schema_version: 2,
          company_profile: { sector: 'Energy' },
          intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 150 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Oil price downside risk'] } }
        })!;
        const energyCurr = extractMemorySnapshot({
          ticker: 'CVX', id: '2', schema_version: 2,
          company_profile: { sector: 'Energy' },
          intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 150 } },
          comprehensive_analysis: { beginner_summary: { top_3_risks: ['Lower crude prices could pressure earnings'] } }
        })!;
        const energyRes = computeWhatChanged(energyCurr, energyPrev, []);
        assert.equal(energyRes.items.length, 1);
        assert.equal(energyRes.items[0].deltaDisplay, 'POSSIBLE RISK CHANGE');
      });
    });
  });
});
