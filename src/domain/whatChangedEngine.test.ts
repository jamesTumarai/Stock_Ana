import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemorySnapshot } from './investmentMemory';
import { TrackedExpectation } from './thesisExpectations';
import {
  computeWhatChanged,
  getSemanticCategoryBadge,
  formatValuationDriverLabel
} from './whatChangedEngine';
import { buildDecisionContext } from './decisionContextEngine';

describe('whatChangedEngine', () => {
  const basePrevReport: any = {
    ticker: 'MSFT',
    id: 'rep_prev',
    schema_version: 2,
    generated_at: '2026-01-15T00:00:00Z',
    company_profile: { shares_outstanding: 1000 },
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
      sec_period_statements: [{ period: 'Q2 2026', revenue: 50000, operating_income: 20000, accession: '0000950170-26-000100', diluted_shares: 1000 }],
      submissions: { recentFilings: [{ accessionNumber: '0000950170-26-000100', filingDate: '2026-01-20' }] }
    }
  };

  const baseCurrReport: any = {
    ticker: 'MSFT',
    id: 'rep_curr',
    schema_version: 2,
    generated_at: '2026-04-15T00:00:00Z',
    company_profile: { shares_outstanding: 1000 },
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
      sec_period_statements: [{ period: 'Q3 2026', revenue: 58000, operating_income: 25520, accession: '0000950170-26-000200', diluted_shares: 1000 }],
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
        },
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [{ period: 'Q1 2026', revenue: 50000 }]
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
        },
        sec_verification: {
          financialDataSource: 'sec_verified',
          sec_period_statements: [{ period: 'Q2 2026', revenue: 58000 }]
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
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q1 2026', revenue: 85000, operating_income: 12750 }]
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
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', revenue: 92000, operating_income: 17480 }]
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
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q1 2026', revenue: 1200, operating_cash_flow: -1000, capital_expenditure: 500 }]
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
            cash_flow: { free_cash_flow: [-1000] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', revenue: 1400, operating_cash_flow: -700, capital_expenditure: 300 }]
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
        assert.equal(fcfItem?.deltaDisplay, 'DEFICIT NARROWED (+$500M)');
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

    describe('Sections 25-30, 36: Research Timeline Change Semantics, Evidence Identity & Valuation Attribution Tests', () => {
      it('Section 25: Same period + same accession FCF unverified -> verified is SOURCE_UPGRADE (not confirmed business change)', () => {
        const prev = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_1', schema_version: 2,
          generated_at: '2026-06-15T10:43:00Z',
          intrinsic_value: { current_price: 372.11, summary: { base_case_fair_value: 209.16 }, assumptions: { discount_rate: 9.5 } },
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [25000], operating_margin_pct: [1.41] },
            cash_flow: { free_cash_flow: [1264] }
          },
          sec_verification: {
            financialDataSource: 'unverified',
            sec_period_statements: [],
            submissions: { recentFilings: [{ accessionNumber: '0000950170-26-000100', filingDate: '2026-06-15' }] }
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_2', schema_version: 2,
          generated_at: '2026-06-15T11:36:00Z',
          intrinsic_value: { current_price: 372.11, summary: { base_case_fair_value: 99.78 }, assumptions: { discount_rate: 10.5 } },
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [25000], operating_margin_pct: [1.41] },
            cash_flow: { free_cash_flow: [-1092] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', revenue: 25000, operating_income: 352, accession: '0000950170-26-000100' }],
            submissions: { recentFilings: [{ accessionNumber: '0000950170-26-000100', filingDate: '2026-06-15' }] }
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const fcfItem = res.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfItem, 'FCF item must exist');
        assert.equal(fcfItem?.domain, 'SOURCE_UPGRADE');
        assert.equal(fcfItem?.confirmation, 'SUPPORTED');
        assert.equal(fcfItem?.semanticType, 'SOURCE_UPGRADE');
        assert.equal(fcfItem?.deltaDisplay, 'SOURCE UPGRADE');
        assert.notEqual(fcfItem?.confirmation, 'CONFIRMED');
        assert.ok(fcfItem?.explanation.includes('Prior value +1,264M was replaced by verified Q2 FCF -1,092M.'));
        assert.ok(fcfItem?.explanation.includes('Current research replaced prior unverified value with filing-verified value'));

        // Must NOT be counted as a confirmed company evidence change
        const confirmedEvidenceItems = res.items.filter(i => (i.domain === 'EVIDENCE_CHANGE' || i.domain === 'RESTATED_EVIDENCE') && i.confirmation === 'CONFIRMED');
        assert.equal(confirmedEvidenceItems.length, 0, 'No company evidence change should be confirmed');
        assert.ok(!confirmedEvidenceItems.some(i => i.id === 'change_fcf'), 'FCF must not appear under confirmed evidence');
      });

      it('Section 26: New-quarter FCF positive -> negative is NEW_REAL_WORLD_EVIDENCE with DETERIORATION semantics', () => {
        const prev = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_1', schema_version: 2,
          intrinsic_value: { current_price: 300, summary: { base_case_fair_value: 300 } },
          financial_statements: {
            periods: ['Q1 2026'],
            cash_flow: { free_cash_flow: [1444] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q1 2026', accession: '0000950170-26-000050' }]
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_2', schema_version: 2,
          intrinsic_value: { current_price: 300, summary: { base_case_fair_value: 300 } },
          financial_statements: {
            periods: ['Q2 2026'],
            cash_flow: { free_cash_flow: [-1092] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', accession: '0000950170-26-000100' }]
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const fcfItem = res.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfItem, 'FCF item must exist');
        assert.equal(fcfItem?.domain, 'EVIDENCE_CHANGE');
        assert.equal(fcfItem?.confirmation, 'CONFIRMED');
        assert.equal(fcfItem?.semanticType, 'NEW_REAL_WORLD_EVIDENCE');
        assert.equal(fcfItem?.deltaDisplay, 'DETERIORATION (Pos → Neg)');
        assert.equal(fcfItem?.materiality, 'HIGH');
        assert.ok(res.summary.confirmedMaterial >= 1);
      });

      it('Section 27: Restatement with later accession is classified as RESTATED_EVIDENCE, not analysis drift', () => {
        const prev = extractMemorySnapshot({
          ticker: 'AAPL', id: 'rep_1', schema_version: 2,
          intrinsic_value: { current_price: 200, summary: { base_case_fair_value: 200 } },
          financial_statements: {
            periods: ['Q2 2026'],
            cash_flow: { free_cash_flow: [1264] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', accession: '0000320193-26-000050' }]
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'AAPL', id: 'rep_2', schema_version: 2,
          intrinsic_value: { current_price: 200, summary: { base_case_fair_value: 200 } },
          financial_statements: {
            periods: ['Q2 2026'],
            cash_flow: { free_cash_flow: [1100] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', accession: '0000320193-26-000080' }] // Later accession for same period
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const fcfItem = res.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfItem);
        assert.equal(fcfItem?.domain, 'RESTATED_EVIDENCE');
        assert.equal(fcfItem?.confirmation, 'CONFIRMED');
        assert.equal(fcfItem?.semanticType, 'RESTATED_OR_AMENDED_EVIDENCE');
        assert.equal(fcfItem?.deltaDisplay, 'RESTATED');
        assert.notEqual(fcfItem?.semanticType, 'ANALYSIS_OUTPUT_DRIFT');
      });

      it('Section 28: Provenance contradiction guard: unverified financial fact CANNOT have confirmation = CONFIRMED', () => {
        const prev = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_1', schema_version: 2,
          intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 120 } },
          financial_statements: { periods: ['Q1 2026'], cash_flow: { free_cash_flow: [5000] } },
          sec_verification: { financialDataSource: 'unverified', sec_period_statements: [] }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_2', schema_version: 2,
          intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 120 } },
          financial_statements: { periods: ['Q2 2026'], cash_flow: { free_cash_flow: [8000] } },
          sec_verification: { financialDataSource: 'unverified', sec_period_statements: [] }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const fcfItem = res.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfItem);
        assert.equal(fcfItem?.confirmation, 'UNCONFIRMED');
        assert.notEqual(fcfItem?.confirmation, 'CONFIRMED');
        assert.equal(res.summary.confirmedMaterial, 0);
        assert.ok(res.summary.needsReview >= 1);
      });

      it('Section 29: Valuation attribution executes deterministic counterfactual replay or falls back truthfully', () => {
        // 29A: Deterministic replay with complete inputs
        const prevFull = extractMemorySnapshot({
          ticker: 'MSFT', id: '1', schema_version: 2,
          company_profile: { shares_outstanding: 1000 },
          intrinsic_value: {
            current_price: 400,
            summary: { base_case_fair_value: 450 },
            assumptions: { discount_rate: 8.5, terminal_growth_rate: 2.5 }
          },
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [50000], yoy_revenue_growth_pct: [12.0], operating_margin_pct: [40.0] },
            cash_flow: { free_cash_flow: [20000] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', revenue: 50000, operating_income: 20000, accession: '001', diluted_shares: 1000 }]
          }
        })!;

        const currFull = extractMemorySnapshot({
          ticker: 'MSFT', id: '2', schema_version: 2,
          company_profile: { shares_outstanding: 1000 },
          intrinsic_value: {
            current_price: 400,
            summary: { base_case_fair_value: 410 },
            assumptions: { discount_rate: 9.5, terminal_growth_rate: 2.5 }
          },
          financial_statements: {
            periods: ['Q3 2026'],
            income_statement: { revenue: [52000], yoy_revenue_growth_pct: [12.0], operating_margin_pct: [40.0] },
            cash_flow: { free_cash_flow: [20800] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q3 2026', revenue: 52000, operating_income: 20800, accession: '002', diluted_shares: 1000 }]
          }
        })!;

        const resFull = computeWhatChanged(currFull, prevFull, []);
        assert.ok(resFull.valuationAttribution);
        assert.equal(resFull.valuationAttribution?.isDeterministic, true);
        assert.ok(resFull.valuationAttribution?.waterfall);
        assert.equal(resFull.valuationAttribution?.primaryDriver, 'DISCOUNT_RATE');
        assert.ok(resFull.valuationAttribution?.impactDescription.includes('Deterministic counterfactual replay'));

        // 29B: Incomplete inputs fallback does NOT claim isDeterministic: true
        const prevIncomplete = extractMemorySnapshot({
          ticker: 'MSFT', id: '1', schema_version: 2,
          intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 450 } }
        })!;
        const currIncomplete = extractMemorySnapshot({
          ticker: 'MSFT', id: '2', schema_version: 2,
          intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 380 } }
        })!;
        const resIncomplete = computeWhatChanged(currIncomplete, prevIncomplete, []);
        assert.ok(resIncomplete.valuationAttribution);
        assert.equal(resIncomplete.valuationAttribution?.isDeterministic, false);
        assert.equal(resIncomplete.valuationAttribution?.primaryDriver, 'HEURISTIC_ASSOCIATION');
      });

      it('Section 30: Conviction score is treated as derived output, avoiding double counting in Decision Context', () => {
        const prev = extractMemorySnapshot({
          ticker: 'GOOGL', id: '1', schema_version: 2,
          intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 180 }, assumptions: { discount_rate: 8.0 } },
          verdict: { conviction_score: 85 }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'GOOGL', id: '2', schema_version: 2,
          intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 155 }, assumptions: { discount_rate: 9.0 } },
          verdict: { conviction_score: 75 }
        })!;

        const whatChanged = computeWhatChanged(curr, prev, []);
        const convItem = whatChanged.items.find(i => i.id === 'change_conviction');
        assert.ok(convItem);
        assert.equal(convItem?.semanticType, 'DERIVED_OUTPUT_CHANGE');
        // Confirmed material count must NOT count conviction score as a separate independent reason
        assert.equal(whatChanged.summary.confirmedMaterial, 2);

        const decContext = buildDecisionContext(curr, prev, null, whatChanged, []);
        const convReason = decContext.reasons.find(r => r.id === 'dec_change_conviction');
        assert.ok(convReason);
        assert.equal(convReason?.severity, 'INFO');
        assert.ok(convReason?.title.includes('Derived Output'));
        assert.ok(convReason?.detail.includes('Conviction score is a downstream derivation and not an independent evidence source'));
      });

      it('Section 36: Cross-sector test matrix across 10 business archetypes', () => {
        // 1. Operating company (MSFT) -> Standard DCF replay allowed
        const s1_prev = extractMemorySnapshot({ ticker: 'MSFT', id: '1', schema_version: 2, company_profile: { sector: 'Technology' }, intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 450 } } })!;
        const s1_curr = extractMemorySnapshot({ ticker: 'MSFT', id: '2', schema_version: 2, company_profile: { sector: 'Technology' }, intrinsic_value: { current_price: 400, summary: { base_case_fair_value: 440 } } })!;
        const r1 = computeWhatChanged(s1_curr, s1_prev, []);
        assert.notEqual(r1.valuationAttribution?.primaryDriver, 'SECTOR_MODEL_SWITCH');

        // 2. SaaS (CRM)
        const s2_prev = extractMemorySnapshot({ ticker: 'CRM', id: '1', schema_version: 2, company_profile: { sector: 'Technology', industry: 'Software—Application' }, intrinsic_value: { current_price: 250, summary: { base_case_fair_value: 280 } } })!;
        const s2_curr = extractMemorySnapshot({ ticker: 'CRM', id: '2', schema_version: 2, company_profile: { sector: 'Technology', industry: 'Software—Application' }, intrinsic_value: { current_price: 250, summary: { base_case_fair_value: 270 } } })!;
        const r2 = computeWhatChanged(s2_curr, s2_prev, []);
        assert.ok(r2);

        // 3. Semiconductor (NVDA)
        const s3_prev = extractMemorySnapshot({ ticker: 'NVDA', id: '1', schema_version: 2, company_profile: { sector: 'Technology', industry: 'Semiconductors' }, intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 130 } } })!;
        const s3_curr = extractMemorySnapshot({ ticker: 'NVDA', id: '2', schema_version: 2, company_profile: { sector: 'Technology', industry: 'Semiconductors' }, intrinsic_value: { current_price: 120, summary: { base_case_fair_value: 125 } } })!;
        const r3 = computeWhatChanged(s3_curr, s3_prev, []);
        assert.ok(r3);

        // 4. Bank (JPM) -> Archetype guard prevents generic FCFF attribution
        const s4_prev = extractMemorySnapshot({ ticker: 'JPM', id: '1', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Banks—Diversified' }, intrinsic_value: { model_type: 'dividend_discount', current_price: 200, summary: { base_case_fair_value: 210 } } })!;
        const s4_curr = extractMemorySnapshot({ ticker: 'JPM', id: '2', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Banks—Diversified' }, intrinsic_value: { model_type: 'dividend_discount', current_price: 200, summary: { base_case_fair_value: 205 } } })!;
        const r4 = computeWhatChanged(s4_curr, s4_prev, []);
        assert.equal(r4.valuationAttribution?.primaryDriver, 'UNAVAILABLE');
        assert.ok(r4.valuationAttribution?.impactDescription.includes('dividend_discount'));

        // 5. FinTech (PYPL)
        const s5_prev = extractMemorySnapshot({ ticker: 'PYPL', id: '1', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Credit Services' }, intrinsic_value: { current_price: 70, summary: { base_case_fair_value: 80 } } })!;
        const s5_curr = extractMemorySnapshot({ ticker: 'PYPL', id: '2', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Credit Services' }, intrinsic_value: { current_price: 70, summary: { base_case_fair_value: 75 } } })!;
        const r5 = computeWhatChanged(s5_curr, s5_prev, []);
        assert.ok(r5);

        // 6. Insurer (PGR) -> Archetype guard
        const s6_prev = extractMemorySnapshot({ ticker: 'PGR', id: '1', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Insurance—Property & Casualty' }, intrinsic_value: { model_type: 'excess_return', current_price: 240, summary: { base_case_fair_value: 260 } } })!;
        const s6_curr = extractMemorySnapshot({ ticker: 'PGR', id: '2', schema_version: 2, company_profile: { sector: 'Financial Services', industry: 'Insurance—Property & Casualty' }, intrinsic_value: { model_type: 'excess_return', current_price: 240, summary: { base_case_fair_value: 250 } } })!;
        const r6 = computeWhatChanged(s6_curr, s6_prev, []);
        assert.equal(r6.valuationAttribution?.primaryDriver, 'UNAVAILABLE');

        // 7. REIT (PLD) -> Archetype guard
        const s7_prev = extractMemorySnapshot({ ticker: 'PLD', id: '1', schema_version: 2, company_profile: { sector: 'Real Estate' }, intrinsic_value: { model_type: 'nav_affo', current_price: 120, summary: { base_case_fair_value: 130 } } })!;
        const s7_curr = extractMemorySnapshot({ ticker: 'PLD', id: '2', schema_version: 2, company_profile: { sector: 'Real Estate' }, intrinsic_value: { model_type: 'nav_affo', current_price: 120, summary: { base_case_fair_value: 125 } } })!;
        const r7 = computeWhatChanged(s7_curr, s7_prev, []);
        assert.equal(r7.valuationAttribution?.primaryDriver, 'UNAVAILABLE');

        // 8. Pre-profit (RIVN) -> Archetype guard
        const s8_prev = extractMemorySnapshot({ ticker: 'RIVN', id: '1', schema_version: 2, company_profile: { sector: 'Consumer Cyclical' }, intrinsic_value: { model_type: 'ev_sales_relative', current_price: 12, summary: { base_case_fair_value: 15 } } })!;
        const s8_curr = extractMemorySnapshot({ ticker: 'RIVN', id: '2', schema_version: 2, company_profile: { sector: 'Consumer Cyclical' }, intrinsic_value: { model_type: 'ev_sales_relative', current_price: 12, summary: { base_case_fair_value: 14 } } })!;
        const r8 = computeWhatChanged(s8_curr, s8_prev, []);
        assert.equal(r8.valuationAttribution?.primaryDriver, 'UNAVAILABLE');

        // 9. Energy (CVX)
        const s9_prev = extractMemorySnapshot({ ticker: 'CVX', id: '1', schema_version: 2, company_profile: { sector: 'Energy' }, intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 160 } } })!;
        const s9_curr = extractMemorySnapshot({ ticker: 'CVX', id: '2', schema_version: 2, company_profile: { sector: 'Energy' }, intrinsic_value: { current_price: 150, summary: { base_case_fair_value: 155 } } })!;
        const r9 = computeWhatChanged(s9_curr, s9_prev, []);
        assert.ok(r9);

        // 10. Utility (NEE)
        const s10_prev = extractMemorySnapshot({ ticker: 'NEE', id: '1', schema_version: 2, company_profile: { sector: 'Utilities' }, intrinsic_value: { current_price: 75, summary: { base_case_fair_value: 82 } } })!;
        const s10_curr = extractMemorySnapshot({ ticker: 'NEE', id: '2', schema_version: 2, company_profile: { sector: 'Utilities' }, intrinsic_value: { current_price: 75, summary: { base_case_fair_value: 80 } } })!;
        const r10 = computeWhatChanged(s10_curr, s10_prev, []);
        assert.ok(r10);
      });
    });

    describe('Lumina Minor Research Timeline Semantic Polish Tests (Tests A-E)', () => {
      it('TEST A: WACC changes & Fair Value changes +0.6% -> primaryDriver is NO_MATERIAL_ATTRIBUTION (not plain UNCHANGED)', () => {
        const prev = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_1', schema_version: 2,
          intrinsic_value: {
            current_price: 372.11,
            summary: { base_case_fair_value: 99.78 },
            assumptions: { discount_rate: 10.5 }
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'TSLA', id: 'rep_2', schema_version: 2,
          intrinsic_value: {
            current_price: 372.11,
            summary: { base_case_fair_value: 100.34 }, // +0.56% (~ +0.6%)
            assumptions: { discount_rate: 9.5 } // WACC -1.0%
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        assert.ok(res.valuationAttribution);
        assert.notEqual(res.valuationAttribution?.primaryDriver, 'UNCHANGED');
        assert.equal(res.valuationAttribution?.primaryDriver, 'NO_MATERIAL_ATTRIBUTION');
        assert.ok(res.valuationAttribution?.impactDescription.includes('Fair value changed modestly'));
        assert.ok(res.valuationAttribution?.impactDescription.includes('below the threshold for assigning a material primary driver'));

        // Formatted display label checks
        const enLabel = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, false, 0.56);
        const thLabel = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, true, 0.56);
        assert.equal(enLabel, 'NO MATERIAL ATTRIBUTION');
        assert.equal(thLabel, 'ไม่มีสาเหตุหลักที่มีนัยสำคัญ');
      });

      it('TEST B: Fair Value exactly identical -> primaryDriver is UNCHANGED and displays UNCHANGED', () => {
        const prev = extractMemorySnapshot({
          ticker: 'MSFT', id: 'rep_1', schema_version: 2,
          intrinsic_value: {
            current_price: 400.0,
            summary: { base_case_fair_value: 450.0 },
            assumptions: { discount_rate: 8.5 }
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'MSFT', id: 'rep_2', schema_version: 2,
          intrinsic_value: {
            current_price: 400.0,
            summary: { base_case_fair_value: 450.0 }, // 0.00% delta
            assumptions: { discount_rate: 8.5 }
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        assert.ok(res.valuationAttribution);
        assert.equal(res.valuationAttribution?.primaryDriver, 'UNCHANGED');
        const enLabel = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, false, 0);
        const thLabel = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, true, 0);
        assert.equal(enLabel, 'UNCHANGED');
        assert.equal(thLabel, 'ไม่เปลี่ยนแปลง');
      });

      it('TEST C: Confirmed WACC change -> category/badge indicates MODEL ASSUMPTION (never EVIDENCE)', () => {
        const prev = extractMemorySnapshot({
          ticker: 'AAPL', id: 'rep_1', schema_version: 2,
          intrinsic_value: {
            current_price: 200,
            summary: { base_case_fair_value: 200 },
            assumptions: { discount_rate: 8.0 }
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'AAPL', id: 'rep_2', schema_version: 2,
          intrinsic_value: {
            current_price: 200,
            summary: { base_case_fair_value: 200 },
            assumptions: { discount_rate: 9.0 }
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const waccItem = res.items.find(i => i.id === 'change_wacc');
        assert.ok(waccItem);
        const badge = getSemanticCategoryBadge(waccItem!, false);
        const badgeTh = getSemanticCategoryBadge(waccItem!, true);
        assert.equal(badge.badgeType, 'MODEL_ASSUMPTION');
        assert.equal(badge.label, 'MODEL ASSUMPTION');
        assert.equal(badgeTh.label, 'สมมติฐานแบบจำลอง');
        assert.notEqual(badge.badgeType, 'EVIDENCE');
      });

      it('TEST D: Verified revenue / margin change from a new filing -> category/badge indicates EVIDENCE', () => {
        const prev = extractMemorySnapshot({
          ticker: 'MSFT', id: 'rep_1', schema_version: 2,
          financial_statements: {
            periods: ['Q2 2026'],
            income_statement: { revenue: [50000], yoy_revenue_growth_pct: [10.0] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q2 2026', accession: '001', revenue: 50000 }]
          }
        })!;

        const curr = extractMemorySnapshot({
          ticker: 'MSFT', id: 'rep_2', schema_version: 2,
          financial_statements: {
            periods: ['Q3 2026'],
            income_statement: { revenue: [55000], yoy_revenue_growth_pct: [15.0] }
          },
          sec_verification: {
            financialDataSource: 'sec_verified',
            sec_period_statements: [{ period: 'Q3 2026', accession: '002', revenue: 55000 }]
          }
        })!;

        const res = computeWhatChanged(curr, prev, []);
        const revItem = res.items.find(i => i.id === 'change_revenue_yoy');
        assert.ok(revItem);
        const badge = getSemanticCategoryBadge(revItem!, false);
        const badgeTh = getSemanticCategoryBadge(revItem!, true);
        assert.equal(badge.badgeType, 'EVIDENCE');
        assert.equal(badge.label, 'EVIDENCE');
        assert.equal(badgeTh.label, 'ข้อมูลจริง');
      });

      it('TEST E: Data correction / source upgrade -> category indicates DATA CORRECTION / SOURCE UPGRADE', () => {
        // Source upgrade item
        const prevUnverified = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_1', schema_version: 2,
          financial_statements: { periods: ['Q2 2026'], cash_flow: { free_cash_flow: [5000] } },
          sec_verification: { financialDataSource: 'unverified', sec_period_statements: [] }
        })!;
        const currVerified = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_2', schema_version: 2,
          financial_statements: { periods: ['Q2 2026'], cash_flow: { free_cash_flow: [4800] } },
          sec_verification: { financialDataSource: 'sec_verified', sec_period_statements: [{ period: 'Q2 2026', accession: '001' }] }
        })!;
        const resSourceUpgrade = computeWhatChanged(currVerified, prevUnverified, []);
        const fcfUpgrade = resSourceUpgrade.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfUpgrade);
        const upgradeBadge = getSemanticCategoryBadge(fcfUpgrade!, false);
        const upgradeBadgeTh = getSemanticCategoryBadge(fcfUpgrade!, true);
        assert.equal(upgradeBadge.badgeType, 'SOURCE_UPGRADE');
        assert.equal(upgradeBadge.label, 'SOURCE UPGRADE');
        assert.equal(upgradeBadgeTh.label, 'อัปเกรดแหล่งข้อมูล');

        // Data correction under identical verified filing
        const prevCorr = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_3', schema_version: 2,
          financial_statements: { periods: ['Q2 2026'], cash_flow: { free_cash_flow: [5000] } },
          sec_verification: { financialDataSource: 'sec_verified', sec_period_statements: [{ period: 'Q2 2026', accession: '001' }] }
        })!;
        const currCorr = extractMemorySnapshot({
          ticker: 'NVDA', id: 'rep_4', schema_version: 2,
          financial_statements: { periods: ['Q2 2026'], cash_flow: { free_cash_flow: [4900] } },
          sec_verification: { financialDataSource: 'sec_verified', sec_period_statements: [{ period: 'Q2 2026', accession: '001' }] }
        })!;
        const resCorr = computeWhatChanged(currCorr, prevCorr, []);
        const fcfCorr = resCorr.items.find(i => i.id === 'change_fcf');
        assert.ok(fcfCorr);
        const corrBadge = getSemanticCategoryBadge(fcfCorr!, false);
        const corrBadgeTh = getSemanticCategoryBadge(fcfCorr!, true);
        assert.equal(corrBadge.badgeType, 'DATA_CORRECTION');
        assert.equal(corrBadge.label, 'DATA CORRECTION');
        assert.equal(corrBadgeTh.label, 'แก้ไขข้อมูล');
      });
    });

    describe('Lumina Multi-Factor Heuristic Valuation Attribution Tests', () => {
      it('WACC up, Revenue CAGR down, Terminal Margin down, Fair Value down -> MULTIPLE_MODEL_ASSUMPTIONS (not WACC alone)', () => {
        const prevSnap: any = {
          snapshotId: 'mem_MULTI_1',
          reportId: 'rep_1',
          ticker: 'MULTI_TEST',
          asOfDate: '2026-01-01',
          createdTimestamp: Date.now() - 30 * 24 * 3600 * 1000,
          marketPrice: 200,
          priceProvenance: 'MARKET_SNAPSHOT',
          valuation: {
            baseFairValue: 276.31,
            modelType: 'dcf_standard',
            isAvailable: true,
            marginOfSafetyPct: 0,
            assumptions: {
              waccPct: 9.25,
              revenueCagrPct: 20.5,
              terminalMarginPct: 14.5,
              terminalGrowthPct: 2.5
            },
            provenance: 'DETERMINISTIC_DERIVATION'
          },
          conviction: { score: 75, provenance: 'DETERMINISTIC_DERIVATION' },
          financials: { revenue: null, freeCashFlow: null },
          thesis: { keyRisks: [], catalysts: [] },
          evidence: {},
          engineVersion: { schemaVersion: 2, generatedByVersion: '1.0.0' },
          isLegacy: false
        };

        const currSnap: any = {
          ...prevSnap,
          snapshotId: 'mem_MULTI_2',
          reportId: 'rep_2',
          asOfDate: '2026-02-01',
          createdTimestamp: Date.now(),
          valuation: {
            ...prevSnap.valuation,
            baseFairValue: 163.31,
            assumptions: {
              waccPct: 10.50,
              revenueCagrPct: 16.5,
              terminalMarginPct: 14.0,
              terminalGrowthPct: 2.5
            }
          }
        };

        const res = computeWhatChanged(currSnap, prevSnap, []);
        assert.ok(res.valuationAttribution);
        assert.equal(res.valuationAttribution?.isDeterministic, false);
        assert.equal(res.valuationAttribution?.primaryDriver, 'MULTIPLE_MODEL_ASSUMPTIONS');

        const labelEn = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, false);
        const labelTh = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, true);
        assert.equal(labelEn, 'MULTIPLE MODEL ASSUMPTIONS');
        assert.equal(labelTh, 'สมมติฐานหลายรายการ (Heuristic)');

        // Verify that descriptions mention all consistent factors without claiming WACC alone
        assert.ok(res.valuationAttribution?.impactDescription.includes('higher discount rate'));
        assert.ok(res.valuationAttribution?.impactDescription.includes('lower growth expectations'));
        assert.ok(res.valuationAttribution?.impactDescription.includes('lower terminal margin'));
        assert.ok(!res.valuationAttribution?.impactDescription.includes('primarily driven by WACC'));

        assert.ok(res.valuationAttribution?.impactDescriptionTh.includes('WACC ที่สูงขึ้น'));
        assert.ok(res.valuationAttribution?.impactDescriptionTh.includes('อัตราการเติบโตที่ลดลง'));
        assert.ok(res.valuationAttribution?.impactDescriptionTh.includes('Terminal Margin ที่ลดลง'));
      });

      it('Conflicting assumptions (WACC up + Revenue CAGR up, Fair Value down) -> MIXED_MODEL_ASSUMPTIONS', () => {
        const prevSnap: any = {
          snapshotId: 'mem_MIX_1',
          reportId: 'rep_m1',
          ticker: 'MIX_TEST',
          asOfDate: '2026-01-01',
          createdTimestamp: Date.now() - 30 * 24 * 3600 * 1000,
          marketPrice: 200,
          valuation: {
            baseFairValue: 250,
            modelType: 'dcf_standard',
            assumptions: {
              waccPct: 9.0,
              revenueCagrPct: 15.0
            }
          },
          conviction: { score: 75 },
          financials: { revenue: null, freeCashFlow: null },
          thesis: { keyRisks: [], catalysts: [] },
          evidence: {}
        };

        const currSnap: any = {
          ...prevSnap,
          snapshotId: 'mem_MIX_2',
          reportId: 'rep_m2',
          asOfDate: '2026-02-01',
          createdTimestamp: Date.now(),
          valuation: {
            ...prevSnap.valuation,
            baseFairValue: 200,
            assumptions: {
              waccPct: 10.5, // implies DOWN
              revenueCagrPct: 20.0 // implies UP
            }
          }
        };

        const res = computeWhatChanged(currSnap, prevSnap, []);
        assert.ok(res.valuationAttribution);
        assert.equal(res.valuationAttribution?.isDeterministic, false);
        assert.equal(res.valuationAttribution?.primaryDriver, 'MIXED_MODEL_ASSUMPTIONS');

        const labelEn = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, false);
        const labelTh = formatValuationDriverLabel(res.valuationAttribution!.primaryDriver, true);
        assert.equal(labelEn, 'MIXED MODEL ASSUMPTION CHANGES');
        assert.equal(labelTh, 'สมมติฐานเปลี่ยนทิศทางผสม (Mixed)');
      });

      it('Exactly one material assumption changed -> HEURISTIC_ASSOCIATION', () => {
        const prevSnap: any = {
          snapshotId: 'mem_SINGLE_1',
          reportId: 'rep_s1',
          ticker: 'SINGLE_TEST',
          asOfDate: '2026-01-01',
          createdTimestamp: Date.now() - 30 * 24 * 3600 * 1000,
          marketPrice: 200,
          valuation: {
            baseFairValue: 200,
            modelType: 'dcf_standard',
            assumptions: {
              waccPct: 9.0
            }
          },
          conviction: { score: 75 },
          financials: { revenue: null, freeCashFlow: null },
          thesis: { keyRisks: [], catalysts: [] },
          evidence: {}
        };

        const currSnap: any = {
          ...prevSnap,
          snapshotId: 'mem_SINGLE_2',
          reportId: 'rep_s2',
          asOfDate: '2026-02-01',
          createdTimestamp: Date.now(),
          valuation: {
            ...prevSnap.valuation,
            baseFairValue: 180,
            assumptions: {
              waccPct: 10.25
            }
          }
        };

        const res = computeWhatChanged(currSnap, prevSnap, []);
        assert.ok(res.valuationAttribution);
        assert.equal(res.valuationAttribution?.isDeterministic, false);
        assert.equal(res.valuationAttribution?.primaryDriver, 'HEURISTIC_ASSOCIATION');
      });
    });
  });
});
