import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveExpectations,
  loadExpectations,
  createAndEvaluateExpectation,
  evaluateAndPersistExpectations
} from './thesisExpectationsService';
import { TrackedExpectation } from '../domain/thesisExpectations';
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
    freeCashFlow: 19500,
    freeCashFlowBasis: 'QUARTER' as const,
    netIncome: 21900,
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
});
