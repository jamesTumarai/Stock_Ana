import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveExpectations,
  loadExpectations,
  createAndEvaluateExpectation,
  evaluateAndPersistExpectations,
  saveUserThesis,
  loadUserThesis,
  loadThesisRevisions
} from './thesisExpectationsService';
import { TrackedExpectation, InvestmentThesisRecord } from '../domain/thesisExpectations';
import { ResearchMemorySnapshot } from '../domain/investmentMemory';

class MockStorage {
  private store = new Map<string, string>();
  writes = 0;
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.writes++;
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('thesisExpectationsService - Durable Persistence & Evaluation', () => {
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = new MockStorage();
    (globalThis as any).localStorage = mockStorage;
  });

  const baseFinancials = {
    revenue: 62000,
    revenueYoYPct: 15.0,
    operatingMarginPct: 45.0,
    grossMarginPct: 68.0,
    freeCashFlow: 19500,
    freeCashFlowBasis: 'QUARTER' as const,
    netIncome: 21900,
    epsDiluted: 2.95,
    cashAndEquivalents: 35000,
    shortTermInvestments: 15000,
    totalDebt: 50000,
    netCash: null,
    sharesOutstanding: 100,
    currentSharesOutstandingM: 100,
    dilutedWeightedAverageSharesM: 95,
    latestPeriod: 'Q3 2026',
    provenance: 'sec_verified' as const,
    periodHistory: []
  };

  const q3Snapshot: ResearchMemorySnapshot = {
    snapshotId: 'snap_q3',
    reportId: 'rep_msft_q3',
    ticker: 'MSFT',
    asOfDate: '2026-09-15',
    createdTimestamp: Date.parse('2026-09-15T00:00:00.000Z'),
    marketPrice: 430,
    priceProvenance: 'MARKET_SNAPSHOT',
    financials: {
      ...baseFinancials,
      revenue: 55000, // actual 55,000 vs target 60,000 -> MISSED
      latestPeriod: 'Q3 2026'
    },
    valuation: {
      baseFairValue: 480,
      modelType: 'dcf_standard',
      marginOfSafetyPct: 11.6,
      isAvailable: true,
      assumptions: {
        waccPct: 8.5,
        terminalGrowthPct: 2.5,
        revenueCagrPct: 12.0,
        fcfMarginPct: 32.0
      },
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    conviction: {
      score: 88,
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    thesis: {
      summary: 'Cloud AI monetization drives growth.',
      keyDrivers: ['Azure growth'],
      keyRisks: ['Slow enterprise spend'],
      catalysts: ['Q3 earnings'],
      confirmationStatus: 'ai_draft',
      provenance: 'AI_DRAFT'
    },
    evidence: {
      secAccession: '000123-26-000003',
      secFilingDate: '2026-09-10',
      hasVerifiedSecStatements: true,
      citationsCount: 5,
      provenance: 'VERIFIED_FACT'
    },
    engineVersion: {
      schemaVersion: 2,
      generatedByVersion: '1.2.0'
    },
    isLegacy: false
  };

  const q4Snapshot: ResearchMemorySnapshot = {
    snapshotId: 'snap_q4',
    reportId: 'rep_msft_q4',
    ticker: 'MSFT',
    asOfDate: '2026-12-15',
    createdTimestamp: Date.parse('2026-12-15T00:00:00.000Z'),
    marketPrice: 450,
    priceProvenance: 'MARKET_SNAPSHOT',
    financials: {
      ...baseFinancials,
      revenue: 70000, // Q4 revenue 70,000
      latestPeriod: 'Q4 2026'
    },
    valuation: {
      baseFairValue: 500,
      modelType: 'dcf_standard',
      marginOfSafetyPct: 11.1,
      isAvailable: true,
      assumptions: {
        waccPct: 8.5,
        terminalGrowthPct: 2.5,
        revenueCagrPct: 12.0,
        fcfMarginPct: 32.0
      },
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    conviction: {
      score: 90,
      provenance: 'DETERMINISTIC_DERIVATION'
    },
    thesis: {
      summary: 'Cloud AI monetization drives growth.',
      keyDrivers: ['Azure growth'],
      keyRisks: ['Slow enterprise spend'],
      catalysts: ['Q4 earnings'],
      confirmationStatus: 'ai_draft',
      provenance: 'AI_DRAFT'
    },
    evidence: {
      secAccession: '000123-26-000004',
      secFilingDate: '2026-12-10',
      hasVerifiedSecStatements: true,
      citationsCount: 6,
      provenance: 'VERIFIED_FACT'
    },
    engineVersion: {
      schemaVersion: 2,
      generatedByVersion: '1.2.0'
    },
    isLegacy: false
  };

  it('creation survives full reload while PENDING, then persists terminal results without repeat writes or intent changes', async () => {
    const user = { uid: 'pending_creation_owner' } as any;
    const initial: TrackedExpectation = {
      expectationId: 'exp_msft_future_q4', ticker: 'MSFT',
      metricOrEvent: 'revenue', metricLabel: 'Revenue ($M)',
      targetValue: 60000, condition: 'gte', targetPeriod: 'Q4 2026',
      status: 'PENDING', origin: 'USER_EXPECTATION',
      sourceReportId: q3Snapshot.reportId, actualValue: null,
      evaluationDate: null, createdAt: '2026-09-15T00:00:00.000Z',
      updatedAt: '2026-09-15T00:00:00.000Z', userId: user.uid
    };
    const intent = (exp: TrackedExpectation) => ({
      expectationId: exp.expectationId, ticker: exp.ticker,
      metricOrEvent: exp.metricOrEvent, metricLabel: exp.metricLabel,
      targetValue: exp.targetValue, condition: exp.condition,
      targetPeriod: exp.targetPeriod, origin: exp.origin,
      sourceReportId: exp.sourceReportId, createdAt: exp.createdAt, userId: exp.userId
    });
    // Exercise the same creation orchestration as handleAddExpectation, with a current report.
    await createAndEvaluateExpectation('MSFT', [], initial, q3Snapshot, [], user);
    assert.equal(mockStorage.writes, 1, 'Persist creation exactly once even without a terminal transition');

    // Discard returned/UI state and read only persisted JSON, as after a page reload.
    const pendingReload = await loadExpectations('MSFT', user);
    assert.equal(pendingReload.length, 1);
    assert.deepEqual(pendingReload[0], initial);
    assert.notEqual(pendingReload[0], initial, 'Reload must return a deserialized record');
    const unchanged = await evaluateAndPersistExpectations('MSFT', pendingReload, q3Snapshot, [], user);
    assert.equal(unchanged.hasPersistedChanges, false);
    assert.equal(unchanged.persistedCount, 0);
    assert.equal(mockStorage.writes, 1, 'Same report must not write pending records again');
    assert.deepEqual(await loadExpectations('MSFT', user), pendingReload);

    // A later report supplies verified actuals for the original target period.
    const terminal = await evaluateAndPersistExpectations('MSFT', pendingReload, q4Snapshot, [q3Snapshot], user);
    assert.equal(terminal.hasPersistedChanges, true);
    assert.equal(terminal.persistedCount, 1);
    assert.equal(mockStorage.writes, 2);
    const terminalReload = await loadExpectations('MSFT', user);
    assert.equal(terminalReload[0].status, 'EXCEEDED');
    assert.equal(terminalReload[0].actualValue, 70000);
    assert.equal(terminalReload[0].actualPeriodFound, 'Q4 2026');
    assert.ok(terminalReload[0].evaluationDate);
    assert.deepEqual(intent(terminalReload[0]), intent(initial));
    const repeated = await evaluateAndPersistExpectations('MSFT', terminalReload, q4Snapshot, [q3Snapshot], user);
    assert.equal(repeated.persistedCount, 0);
    assert.equal(mockStorage.writes, 2, 'Terminal reload/re-evaluation must not write again');
    assert.deepEqual(await loadExpectations('MSFT', user), terminalReload);
  });

  it('persists a new expectation when no snapshot is available', async () => {
    const initial: TrackedExpectation = {
      expectationId: 'exp_no_snapshot', ticker: 'MSFT',
      metricOrEvent: 'revenue', metricLabel: 'Revenue ($M)',
      targetValue: 60000, condition: 'gte', targetPeriod: 'Q4 2026',
      status: 'PENDING', origin: 'USER_EXPECTATION', sourceReportId: null,
      actualValue: null, evaluationDate: null,
      createdAt: '2026-09-15T00:00:00.000Z', updatedAt: '2026-09-15T00:00:00.000Z'
    };
    await createAndEvaluateExpectation('MSFT', [], initial, null);
    assert.deepEqual(await loadExpectations('MSFT'), [initial]);
    assert.equal(mockStorage.writes, 1);
  });

  it('mandatory persistence regression: durable evaluation outcome persists across reloads and later reports', async () => {
    const user = { uid: 'user_analyst_01' } as any;

    // 1. Save PENDING Q3 expectation
    const initialExp: TrackedExpectation = {
      expectationId: 'exp_msft_q3_rev',
      ticker: 'MSFT',
      metricOrEvent: 'revenue',
      metricLabel: 'Revenue ($M)',
      targetValue: 60000,
      condition: 'gte',
      targetPeriod: 'Q3 2026',
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      sourceReportId: 'rep_msft_q2',
      actualValue: null,
      actualPeriodFound: null,
      evaluationDate: null,
      evaluationNotes: undefined,
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      userId: 'user_analyst_01'
    };

    await saveExpectations('MSFT', [initialExp], user);

    // Verify initial stored state is PENDING
    const initialLoaded = await loadExpectations('MSFT', user);
    assert.equal(initialLoaded.length, 1);
    assert.equal(initialLoaded[0].status, 'PENDING');
    assert.equal(initialLoaded[0].actualValue, null);

    // 2 & 3. Evaluate Q3 actual -> MISSED and persist
    const evalResult1 = await evaluateAndPersistExpectations(
      'MSFT',
      initialLoaded,
      q3Snapshot,
      [],
      user
    );

    assert.equal(evalResult1.hasPersistedChanges, true, 'Must flag persisted changes on terminal transition');
    assert.equal(evalResult1.persistedCount, 1);
    assert.equal(evalResult1.expectations[0].status, 'MISSED');
    assert.equal(evalResult1.expectations[0].actualValue, 55000);
    assert.equal(evalResult1.expectations[0].actualPeriodFound, 'Q3 2026');

    // 4. Simulate full reload using loadExpectations()
    const reloadedAfterQ3 = await loadExpectations('MSFT', user);

    // 5. Assert stored result is still MISSED with original actualValue, actualPeriodFound and evaluation metadata
    assert.equal(reloadedAfterQ3.length, 1);
    assert.equal(reloadedAfterQ3[0].status, 'MISSED');
    assert.equal(reloadedAfterQ3[0].actualValue, 55000);
    assert.equal(reloadedAfterQ3[0].actualPeriodFound, 'Q3 2026');
    assert.ok(reloadedAfterQ3[0].evaluationDate, 'Must have evaluationDate recorded');
    assert.ok(reloadedAfterQ3[0].evaluationNotes?.includes('55000'), 'Must record evaluation notes with actual value');

    // 6. Make Q4 current (historical Q3 passed in historicalSnapshots)
    // Run evaluateAndPersistExpectations again with Q4 as current snapshot
    const evalResult2 = await evaluateAndPersistExpectations(
      'MSFT',
      reloadedAfterQ3,
      q4Snapshot,
      [q3Snapshot],
      user
    );

    // Assert no repeated writes since stored outcome is already terminal and unchanged
    assert.equal(evalResult2.hasPersistedChanges, false, 'Avoid repeated writes when outcome is unchanged');
    assert.equal(evalResult2.persistedCount, 0);

    // 7. Reload again
    const reloadedAfterQ4 = await loadExpectations('MSFT', user);

    // 8. Assert still MISSED (not reverted to PENDING by Q4 being current)
    assert.equal(reloadedAfterQ4.length, 1);
    assert.equal(reloadedAfterQ4[0].status, 'MISSED');
    assert.equal(reloadedAfterQ4[0].actualValue, 55000);
    assert.equal(reloadedAfterQ4[0].actualPeriodFound, 'Q3 2026');

    // 9. Prove immutable target fields never changed
    assert.equal(reloadedAfterQ4[0].expectationId, initialExp.expectationId);
    assert.equal(reloadedAfterQ4[0].ticker, initialExp.ticker);
    assert.equal(reloadedAfterQ4[0].metricOrEvent, initialExp.metricOrEvent);
    assert.equal(reloadedAfterQ4[0].metricLabel, initialExp.metricLabel);
    assert.equal(reloadedAfterQ4[0].targetValue, initialExp.targetValue);
    assert.equal(reloadedAfterQ4[0].condition, initialExp.condition);
    assert.equal(reloadedAfterQ4[0].targetPeriod, initialExp.targetPeriod);
    assert.equal(reloadedAfterQ4[0].origin, initialExp.origin);
    assert.equal(reloadedAfterQ4[0].sourceReportId, initialExp.sourceReportId);
    assert.equal(reloadedAfterQ4[0].createdAt, initialExp.createdAt);
    assert.equal(reloadedAfterQ4[0].userId, initialExp.userId);
  });

  it('avoids repeated writes when stored expectations are unchanged', async () => {
    const user = { uid: 'user_02' } as any;
    const futureExp: TrackedExpectation = {
      expectationId: 'exp_future_1',
      ticker: 'MSFT',
      metricOrEvent: 'revenue',
      metricLabel: 'Revenue ($M)',
      targetValue: 80000,
      condition: 'gte',
      targetPeriod: 'Q1 2027', // Future period
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      sourceReportId: 'rep_q3',
      actualValue: null,
      evaluationDate: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      userId: 'user_02'
    };

    await saveExpectations('MSFT', [futureExp], user);

    // Evaluate against Q3 (future target period not reached)
    const result = await evaluateAndPersistExpectations(
      'MSFT',
      [futureExp],
      q3Snapshot,
      [],
      user
    );

    assert.equal(result.hasPersistedChanges, false, 'No terminal transition -> no persistence write');
    assert.equal(result.expectations[0].status, 'PENDING');
  });

  it('Section 19 & 20: evaluateAndPersistExpectations preserves evaluationMode, unit, source, and provenance on terminal transition', async () => {
    const user = { uid: 'user_meta_test' } as any;
    const initial: TrackedExpectation = {
      expectationId: 'exp_meta_1',
      ticker: 'MSFT',
      metricOrEvent: 'revenue',
      metricLabel: 'Revenue ($M)',
      targetValue: 50000,
      condition: 'gte',
      targetPeriod: 'Q3 2026',
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      evaluationMode: 'AUTO',
      unit: '$M',
      sourceReportId: 'rep_q3',
      actualValue: null,
      evaluationDate: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      userId: 'user_meta_test'
    };

    const result = await evaluateAndPersistExpectations(
      'MSFT',
      [initial],
      q3Snapshot, // revenue is 55000 in q3Snapshot => MET / EXCEEDED
      [],
      user
    );

    assert.equal(result.hasPersistedChanges, true);
    assert.equal(result.expectations[0].status, 'EXCEEDED');
    assert.equal(result.expectations[0].evaluationMode, 'AUTO');
    assert.equal(result.expectations[0].unit, '$M');
    assert.ok(result.expectations[0].source);
    assert.equal(result.expectations[0].provenance, 'DETERMINISTIC_DERIVATION');

    // Reload from storage to verify persistent storage retained them
    const loaded = await loadExpectations('MSFT', user);
    assert.equal(loaded[0].status, 'EXCEEDED');
    assert.equal(loaded[0].evaluationMode, 'AUTO');
    assert.equal(loaded[0].unit, '$M');
    assert.equal(loaded[0].provenance, 'DETERMINISTIC_DERIVATION');
  });

  it('Section 22: saveUserThesis & loadUserThesis round-trip preserves frozen valuation without source report', async () => {
    const user = { uid: 'user_thesis_persist' } as any;
    const thesisV2: InvestmentThesisRecord = {
      thesisId: 'th_persist_1',
      ticker: 'NVDA',
      version: 2,
      summary: 'Data center AI acceleration moat.',
      keyDrivers: ['Hopper & Blackwell ramping'],
      keyAssumptions: [
        'Discount rate (WACC): 9.0%',
        'Explicit forecast period: 5 Years',
        'Terminal growth rate: 3.0%',
        'Base Revenue CAGR: 14.5%',
        'Target terminal margin: 13.5%'
      ],
      keyRisks: ['Export curbs'],
      catalysts: ['Next gen architecture unveil'],
      invalidationConditions: ['Operating Margin < 1.1%'],
      status: 'ACTIVE',
      confirmationStatus: 'USER_CONFIRMED',
      sourceReportId: 'rep_A_nvda',
      valuationSnapshot: {
        modelType: 'dcf_standard',
        methodTitleEn: 'Valuation Approach: Discounted Cash Flow (FCFF DCF)',
        methodTitleTh: 'วิธีประเมิน: แบบจำลองคิดลดกระแสเงินสด (FCFF DCF)',
        isGuarded: false,
        assumptions: {
          waccPct: 9.0,
          terminalGrowthPct: 3.0,
          projectionYears: 5,
          revenueCagrPct: 14.5,
          terminalMarginPct: 13.5
        },
        assumptionsList: [
          { labelEn: 'Discount rate (WACC)', labelTh: 'อัตราคิดลด (WACC)', valueText: '9.0%', provenance: 'MODEL_ASSUMPTION' },
          { labelEn: 'Terminal growth rate', labelTh: 'อัตราเติบโตระยะยาว (Terminal Growth)', valueText: '3.0%', provenance: 'MODEL_ASSUMPTION' },
          { labelEn: 'Explicit forecast period', labelTh: 'ระยะเวลาประมาณการ', valueText: '5 Years', provenance: 'MODEL_ASSUMPTION' },
          { labelEn: 'Base Revenue CAGR', labelTh: 'รายได้เติบโตเฉลี่ย (Base Revenue CAGR)', valueText: '14.5%', provenance: 'MODEL_ASSUMPTION' },
          { labelEn: 'Target terminal margin', labelTh: 'อัตรากำไรเป้าหมาย (Terminal Margin)', valueText: '13.5%', provenance: 'MODEL_ASSUMPTION' }
        ],
        sourceReportId: 'rep_A_nvda',
        capturedAt: '2026-03-01T10:00:00Z',
        provenance: 'FROZEN_CONFIRMATION_SNAPSHOT'
      },
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
      userId: 'user_thesis_persist'
    };

    // Save thesis v2
    await saveUserThesis(thesisV2, user);

    // Reload without any report context
    const loaded = await loadUserThesis('NVDA', user);
    assert.ok(loaded);
    assert.equal(loaded?.version, 2);
    assert.equal(loaded?.confirmationStatus, 'USER_CONFIRMED');
    assert.equal(loaded?.sourceReportId, 'rep_A_nvda');
    assert.equal(loaded?.valuationSnapshot?.assumptions.waccPct, 9.0);
    assert.equal(loaded?.valuationSnapshot?.assumptions.projectionYears, 5);

    // Verify frozen valuation basis is hydrated
    assert.ok(loaded?.frozenValuationBasis);
    assert.equal(loaded?.frozenValuationBasis?.assumptions.length, 5);
    assert.equal(loaded?.frozenValuationBasis?.assumptions[0].valueText, '9.0%');
    assert.equal(loaded?.frozenValuationBasis?.assumptions[2].valueText, '5 Years');
  });

  it('hydrates legacy thesis records lacking frozenValuationBasis or valuationSnapshot', async () => {
    const user = { uid: 'user_legacy_test' } as any;
    // Simulate legacy record saved before structured snapshot was introduced
    const legacyThesis: InvestmentThesisRecord = {
      thesisId: 'th_legacy_1',
      ticker: 'AAPL',
      version: 2,
      summary: 'Ecosystem services expansion.',
      keyDrivers: ['Services gross margin'],
      keyAssumptions: [
        'Discount rate (WACC): 8.5%',
        'Explicit forecast period: 7 Years',
        'Terminal growth rate: 2.5%'
      ],
      keyRisks: ['Antitrust in App Store'],
      catalysts: ['WWDC keynote'],
      invalidationConditions: ['Operating margin < 25%'],
      status: 'ACTIVE',
      confirmationStatus: 'USER_CONFIRMED',
      sourceReportId: 'rep_legacy_aapl',
      createdAt: '2025-10-01T00:00:00Z',
      updatedAt: '2025-10-01T00:00:00Z',
      userId: 'user_legacy_test'
    };

    await saveUserThesis(legacyThesis, user);

    const loaded = await loadUserThesis('AAPL', user);
    assert.ok(loaded);
    // Legacy thesis must have frozenValuationBasis hydrated from keyAssumptions
    assert.ok(loaded?.frozenValuationBasis);
    assert.equal(loaded?.frozenValuationBasis?.assumptions.find(a => a.labelEn.includes('WACC'))?.valueText, '8.5%');
    assert.equal(loaded?.frozenValuationBasis?.assumptions.find(a => a.labelEn.includes('forecast period'))?.valueText, '7 Years');
    assert.equal(loaded?.frozenValuationBasis?.assumptions.find(a => a.labelEn.includes('Terminal growth'))?.valueText, '2.5%');
  });

  it('loadThesisRevisions maintains immutable history of versions', async () => {
    const user = { uid: 'user_rev_test' } as any;

    const v2: InvestmentThesisRecord = {
      thesisId: 'th_rev_1',
      ticker: 'TSLA',
      version: 2,
      summary: 'Energy storage and autonomy inflection.',
      keyDrivers: ['Megapack volume'],
      keyAssumptions: ['Discount rate (WACC): 9.0%', 'Explicit forecast period: 5 Years'],
      keyRisks: ['EV price competition'],
      catalysts: ['Investor day'],
      invalidationConditions: ['Operating Margin < 1.1%'],
      status: 'ACTIVE',
      confirmationStatus: 'USER_CONFIRMED',
      sourceReportId: 'rep_1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      userId: 'user_rev_test'
    };

    await saveUserThesis(v2, user);

    // Now save v3 (from a newer report)
    const v3: InvestmentThesisRecord = {
      ...v2,
      version: 3,
      confirmationStatus: 'USER_EDITED',
      sourceReportId: 'rep_2',
      summary: 'Energy storage, autonomy inflection, and Cybercab ramp.',
      keyAssumptions: ['Discount rate (WACC): 9.5%', 'Explicit forecast period: 10 Years'],
      updatedAt: '2026-06-01T00:00:00Z'
    };

    await saveUserThesis(v3, user);

    const revisions = await loadThesisRevisions('TSLA', user);
    assert.equal(revisions.length, 2);
    assert.equal(revisions[0].version, 2);
    assert.equal(revisions[0].sourceReportId, 'rep_1');
    assert.equal(revisions[0].frozenValuationBasis?.assumptions.find(a => a.labelEn.includes('WACC'))?.valueText, '9.0%');

    assert.equal(revisions[1].version, 3);
    assert.equal(revisions[1].sourceReportId, 'rep_2');
    assert.equal(revisions[1].frozenValuationBasis?.assumptions.find(a => a.labelEn.includes('WACC'))?.valueText, '9.5%');
  });
});
