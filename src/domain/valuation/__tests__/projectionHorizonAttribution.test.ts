import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractMemorySnapshot, compareMemorySnapshots, type ResearchMemorySnapshot } from '../../investmentMemory';
import { computeWhatChanged } from '../../whatChangedEngine';
import { buildDecisionContext } from '../../decisionContextEngine';
import type { ReportData } from '../../../types';

describe('Projection Horizon Change Tracking & Valuation Attribution (System-Wide)', () => {
  // =========================================================================
  // 1. REGRESSION TEST (Section 9): 5 -> 10 years
  // =========================================================================
  it('TEST 1: Regression Test — Projection Horizon 5 -> 10 years is captured in What Changed, Decision Context, and Valuation Attribution', () => {
    const prevReport: Partial<ReportData> = {
      ticker: 'TSLA',
      as_of_date: '2026-01-15',
      company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
      financial_statements: {
        periods: ['Q4 2025'],
        income_statement: { revenue: [25000], net_income: [2000] } as any,
        balance_sheet: { cash_and_equivalents: [28000], total_debt: [5000] } as any,
        cash_flow: { free_cash_flow: [3000] } as any,
      } as any,
      intrinsic_value: {
        current_price: 220,
        summary: { base_case_fair_value: 250, margin_of_safety_pct: 13.6 } as any,
        dcf_model: {
          assumptions: {
            wacc_pct: 9.0,
            terminal_growth_pct: 2.5,
            projection_years: 5,
          },
          scenarios: {
            base: { revenue_cagr_pct: 18.0, terminal_margin_pct: 15.0, fair_value_per_share: 250, key_assumption_note: '' },
          } as any,
        } as any,
      } as any,
    };

    const curReport: Partial<ReportData> = {
      ticker: 'TSLA',
      as_of_date: '2026-02-15',
      company_profile: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' },
      financial_statements: {
        periods: ['Q4 2025'], // No new financial statement period
        income_statement: { revenue: [25000], net_income: [2000] } as any,
        balance_sheet: { cash_and_equivalents: [28000], total_debt: [5000] } as any,
        cash_flow: { free_cash_flow: [3000] } as any,
      } as any,
      intrinsic_value: {
        current_price: 220,
        summary: { base_case_fair_value: 320, margin_of_safety_pct: 45.5 } as any,
        dcf_model: {
          assumptions: {
            wacc_pct: 8.0, // lower WACC (-1.0%)
            terminal_growth_pct: 2.5,
            projection_years: 10, // Projection horizon lengthened: 5 -> 10
          },
          scenarios: {
            base: { revenue_cagr_pct: 20.0, terminal_margin_pct: 16.0, fair_value_per_share: 320, key_assumption_note: '' }, // higher growth & margin
          } as any,
        } as any,
      } as any,
    };

    // 1. Single source of truth in snapshots
    const prevSnap = extractMemorySnapshot(prevReport)!;
    const curSnap = extractMemorySnapshot(curReport)!;

    assert.ok(prevSnap, 'Previous snapshot must be extracted');
    assert.ok(curSnap, 'Current snapshot must be extracted');
    assert.equal(prevSnap.valuation.assumptions.projectionYears, 5, 'Previous projectionYears must be 5');
    assert.equal(curSnap.valuation.assumptions.projectionYears, 10, 'Current projectionYears must be 10');
    assert.equal(prevSnap.valuation.inputSnapshot?.projectionYears, 5, 'Previous inputSnapshot.projectionYears must be 5');
    assert.equal(curSnap.valuation.inputSnapshot?.projectionYears, 10, 'Current inputSnapshot.projectionYears must be 10');

    // 2. Memory snapshot delta
    const delta = compareMemorySnapshots(curSnap, prevSnap);
    assert.equal(delta.valuationAssumptionsDelta.projectionYearsDelta, 5, 'Projection years delta must be +5');

    // 3. What Changed item emission
    const whatChanged = computeWhatChanged(curSnap, prevSnap, []);
    const projChange = whatChanged.items.find(i => i.id === 'change_projection_years');
    assert.ok(projChange, 'What Changed must include change_projection_years');
    assert.equal(projChange.metricLabel, 'Projection Horizon');
    assert.equal(projChange.metricLabelTh, 'ระยะเวลาการประมาณการ (Projection Horizon)');
    assert.equal(projChange.semanticType, 'MODEL_ASSUMPTION_CHANGE');
    assert.equal(projChange.confirmation, 'CONFIRMED');
    assert.equal(projChange.materiality, 'HIGH');
    assert.equal(projChange.previousValue, '5 years');
    assert.equal(projChange.currentValue, '10 years');
    assert.equal(projChange.deltaDisplay, '+5 yrs');
    assert.equal(
      projChange.explanationTh,
      'ระยะเวลาการประมาณการเปลี่ยนจาก 5 ปีเป็น 10 ปี ซึ่งเป็นการเปลี่ยนแปลงโครงสร้างแบบจำลอง ไม่ใช่หลักฐานการดำเนินงานของบริษัท'
    );

    // 4. Decision Context Reason & Stance
    const decisionContext = buildDecisionContext(curSnap, prevSnap, null, whatChanged, []);
    assert.equal(decisionContext.stance, 'MODEL_ASSUMPTION_REVIEW', 'Stance must be MODEL_ASSUMPTION_REVIEW');

    const projReason = decisionContext.reasons.find(r => r.id === 'dec_change_projection_years');
    assert.ok(projReason, 'Decision Context reasons must include projection horizon change');
    assert.equal(projReason.category, 'VALUATION');
    assert.equal(
      projReason.detailTh,
      'ระยะเวลาการประมาณการเปลี่ยนจาก 5 ปีเป็น 10 ปี ซึ่งเป็นการเปลี่ยนแปลงโครงสร้างแบบจำลอง ไม่ใช่หลักฐานการดำเนินงานของบริษัท'
    );

    // 5. Valuation Attribution includes Projection Horizon
    assert.ok(whatChanged.valuationAttribution, 'Valuation attribution must be generated');
    assert.equal(whatChanged.valuationAttribution?.isDeterministic, false, 'No false deterministic causal claim');
    assert.equal(whatChanged.valuationAttribution?.primaryDriver, 'MULTIPLE_MODEL_ASSUMPTIONS');
    assert.ok(
      whatChanged.valuationAttribution?.impactDescription.includes('a longer projection horizon'),
      'English attribution must mention longer projection horizon'
    );
    assert.ok(
      whatChanged.valuationAttribution?.impactDescriptionTh.includes('ระยะเวลาการประมาณการที่ยาวนานขึ้น'),
      'Thai attribution must mention longer projection horizon'
    );
  });

  // =========================================================================
  // 2. CONTROL TEST (Section 10): 10 -> 10 years (Unchanged Horizon)
  // =========================================================================
  it('TEST 2: Control Test — Unchanged Projection Horizon (10 -> 10 years) produces NO change item', () => {
    const prevSnap: any = {
      snapshotId: 'snap_c1',
      reportId: 'rep_c1',
      ticker: 'CONTROL_TEST',
      asOfDate: '2026-01-15',
      createdTimestamp: 1000,
      marketPrice: 100,
      valuation: {
        baseFairValue: 120,
        modelType: 'dcf_standard',
        isAvailable: true,
        assumptions: { waccPct: 8.5, terminalGrowthPct: 2.5, projectionYears: 10 },
        inputSnapshot: { modelType: 'dcf_standard', projectionYears: 10 },
        provenance: 'DETERMINISTIC_DERIVATION',
      },
      conviction: { score: 75 },
      financials: { revenue: null, freeCashFlow: null },
      thesis: { keyRisks: [], catalysts: [] },
      evidence: {},
      engineVersion: { schemaVersion: 2 },
    };

    const curSnap: any = {
      ...prevSnap,
      snapshotId: 'snap_c2',
      reportId: 'rep_c2',
      asOfDate: '2026-02-15',
      createdTimestamp: 2000,
      valuation: {
        ...prevSnap.valuation,
        baseFairValue: 120,
        assumptions: { waccPct: 8.5, terminalGrowthPct: 2.5, projectionYears: 10 },
        inputSnapshot: { modelType: 'dcf_standard', projectionYears: 10 },
      },
    };

    const delta = compareMemorySnapshots(curSnap, prevSnap);
    assert.equal(delta.valuationAssumptionsDelta.projectionYearsDelta, 0, 'Projection years delta must be 0');

    const whatChanged = computeWhatChanged(curSnap, prevSnap, []);
    const projChange = whatChanged.items.find(i => i.id === 'change_projection_years');
    assert.equal(projChange, undefined, 'Must NOT emit change_projection_years when horizon is unchanged');
  });

  // =========================================================================
  // 3. DIRECTIONAL SHORTENING TEST: 10 -> 5 years
  // =========================================================================
  it('TEST 3: Horizon Shortened (10 -> 5 years) -> emits -5 yrs with shorter projection horizon', () => {
    const prevSnap: any = {
      snapshotId: 'snap_s1',
      reportId: 'rep_s1',
      ticker: 'SHORTEN_TEST',
      asOfDate: '2026-01-15',
      createdTimestamp: 1000,
      marketPrice: 100,
      valuation: {
        baseFairValue: 150,
        modelType: 'dcf_standard',
        isAvailable: true,
        assumptions: { waccPct: 8.5, projectionYears: 10 },
        inputSnapshot: { modelType: 'dcf_standard', projectionYears: 10 },
        provenance: 'DETERMINISTIC_DERIVATION',
      },
      conviction: { score: 75 },
      financials: { revenue: null, freeCashFlow: null },
      thesis: { keyRisks: [], catalysts: [] },
      evidence: {},
      engineVersion: { schemaVersion: 2 },
    };

    const curSnap: any = {
      ...prevSnap,
      snapshotId: 'snap_s2',
      reportId: 'rep_s2',
      asOfDate: '2026-02-15',
      createdTimestamp: 2000,
      valuation: {
        ...prevSnap.valuation,
        baseFairValue: 110,
        assumptions: { waccPct: 8.5, projectionYears: 5 },
        inputSnapshot: { modelType: 'dcf_standard', projectionYears: 5 },
      },
    };

    const delta = compareMemorySnapshots(curSnap, prevSnap);
    assert.equal(delta.valuationAssumptionsDelta.projectionYearsDelta, -5, 'Projection years delta must be -5');

    const whatChanged = computeWhatChanged(curSnap, prevSnap, []);
    const projChange = whatChanged.items.find(i => i.id === 'change_projection_years');
    assert.ok(projChange, 'Must emit change_projection_years for shortened horizon');
    assert.equal(projChange.previousValue, '10 years');
    assert.equal(projChange.currentValue, '5 years');
    assert.equal(projChange.deltaDisplay, '-5 yrs');

    assert.ok(
      whatChanged.valuationAttribution?.impactDescription.includes('a shorter projection horizon'),
      'Attribution must note shorter projection horizon'
    );
  });

  // =========================================================================
  // 4. CROSS-SECTOR TESTS (Section 11)
  // =========================================================================
  describe('Cross-Sector Model-Specific Support', () => {
    it('SaaS DCF: captures projection horizon', () => {
      const saasReport: Partial<ReportData> = {
        ticker: 'SNOW',
        company_profile: { sector: 'Technology', industry: 'Software - Infrastructure' },
        intrinsic_value: {
          current_price: 150,
          summary: { base_case_fair_value: 180 } as any,
          dcf_model: {
            assumptions: { wacc_pct: 9.5, terminal_growth_pct: 3.0, projection_years: 7 },
            scenarios: { base: { revenue_cagr_pct: 25, terminal_margin_pct: 22, fair_value_per_share: 180, key_assumption_note: '' } } as any,
          } as any,
        } as any,
      };

      const snap = extractMemorySnapshot(saasReport)!;
      assert.equal(snap.valuation.assumptions.projectionYears, 7, 'SaaS DCF must capture projectionYears: 7');
      assert.equal(snap.valuation.inputSnapshot?.projectionYears, 7);
    });

    it('Semiconductor DCF: captures projection horizon', () => {
      const semiReport: Partial<ReportData> = {
        ticker: 'NVDA',
        company_profile: { sector: 'Technology', industry: 'Semiconductors' },
        intrinsic_value: {
          current_price: 130,
          summary: { base_case_fair_value: 160 } as any,
          dcf_model: {
            assumptions: { wacc_pct: 9.0, terminal_growth_pct: 3.5, projection_years: 10 },
            scenarios: { base: { revenue_cagr_pct: 30, terminal_margin_pct: 35, fair_value_per_share: 160, key_assumption_note: '' } } as any,
          } as any,
        } as any,
      };

      const snap = extractMemorySnapshot(semiReport)!;
      assert.equal(snap.valuation.assumptions.projectionYears, 10, 'Semiconductor DCF must capture projectionYears: 10');
      assert.equal(snap.valuation.inputSnapshot?.projectionYears, 10);
    });

    it('Bank / Lender DDM: captures explicit forecast horizon if specified in DDM model', () => {
      const bankReport: Partial<ReportData> = {
        ticker: 'JPM',
        company_profile: { sector: 'Financial Services', industry: 'Banks - Diversified' },
        intrinsic_value: {
          current_price: 210,
          summary: { base_case_fair_value: 230 } as any,
          ddm_model: {
            assumptions: {
              cost_of_equity_pct: 9.5,
              terminal_growth_pct: 2.5,
              current_dividend_per_share: 4.80,
              current_payout_ratio_pct: 32,
              current_roe_pct: 15.5,
              projection_years: 5,
            } as any,
            scenarios: { base: { dividend_growth_rate_pct: 6.0, fair_value_per_share: 230, key_assumption_note: '', terminal_payout_ratio_pct: 35 } } as any,
          } as any,
        } as any,
      };

      const snap = extractMemorySnapshot(bankReport)!;
      assert.equal(snap.valuation.assumptions.projectionYears, 5, 'Bank DDM with explicit forecast horizon must capture projectionYears: 5');
    });

    it('Relative-Only Early Stage: NEVER manufactures projectionYears (must remain null)', () => {
      const earlyStageReport: Partial<ReportData> = {
        ticker: 'RKLB',
        company_profile: { sector: 'Technology', industry: 'Space & Orbital' },
        financial_statements: {
          periods: ['Q3 2025'],
          income_statement: { revenue: [50], operating_income: [-150], net_income: [-180] } as any,
          cash_flow: { free_cash_flow: [-100] } as any,
          balance_sheet: { total_assets: [1000], total_debt: [100], total_equity: [800] } as any,
        } as any,
        intrinsic_value: {
          current_price: 25,
          selected_model: { model_type: 'relative_only' } as any,
          summary: { base_case_fair_value: 28 } as any,
          relative_only_model: {
            primary_metric: 'EV/Revenue',
            peer_median_multiple: 8.5,
            applied_company_metric_value: 200,
            implied_enterprise_value_b: 1.7,
            implied_equity_value_b: 1.6,
            fair_value_per_share: 28,
            peers_evaluated: [],
            peer_selection_rationale: '',
            stage_confidence_score: 'Moderate',
            pre_revenue_disclaimer: '',
          },
        } as any,
      };

      const snap = extractMemorySnapshot(earlyStageReport)!;
      assert.equal(
        snap.valuation.assumptions.projectionYears,
        null,
        'Relative-only models must NOT have a manufactured projectionYears (must be null)'
      );
      assert.equal(
        snap.valuation.inputSnapshot?.projectionYears,
        null,
        'inputSnapshot.projectionYears must be null for relative-only'
      );
    });
  });
});
