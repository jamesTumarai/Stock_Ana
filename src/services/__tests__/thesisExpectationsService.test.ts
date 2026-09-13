import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveUserThesis,
  loadUserThesis,
  saveExpectations,
  loadExpectations
} from '../thesisExpectationsService';
import { InvestmentThesisRecord, TrackedExpectation } from '../../domain/thesisExpectations';

describe('thesisExpectationsService', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) || null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k)
      }
    };
  });

  it('saves and loads user thesis via local storage fallback', async () => {
    const thesis: InvestmentThesisRecord = {
      thesisId: 'th_msft_1',
      ticker: 'MSFT',
      version: 1,
      summary: 'Long-term enterprise cloud and AI leadership',
      keyDrivers: ['Azure scaling'],
      keyAssumptions: ['8.5% WACC'],
      keyRisks: ['Cloud saturation'],
      catalysts: ['AI copilots'],
      invalidationConditions: ['Operating margin < 35%'],
      status: 'ACTIVE',
      confirmationStatus: 'USER_CONFIRMED',
      sourceReportId: 'rep_1',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z'
    };

    await saveUserThesis(thesis, null);
    const loaded = await loadUserThesis('MSFT', null);

    assert.ok(loaded);
    assert.equal(loaded?.ticker, 'MSFT');
    assert.equal(loaded?.summary, 'Long-term enterprise cloud and AI leadership');
    assert.equal(loaded?.confirmationStatus, 'USER_CONFIRMED');
    assert.equal(loaded?.status, 'ACTIVE');
  });

  it('isolates different tickers in thesis storage', async () => {
    const msftThesis: InvestmentThesisRecord = {
      thesisId: 'th_msft',
      ticker: 'MSFT',
      version: 1,
      summary: 'MSFT thesis',
      keyDrivers: [],
      keyAssumptions: [],
      keyRisks: [],
      catalysts: [],
      invalidationConditions: [],
      status: 'ACTIVE',
      confirmationStatus: 'USER_CONFIRMED',
      sourceReportId: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    };

    await saveUserThesis(msftThesis, null);
    const aapl = await loadUserThesis('AAPL', null);
    assert.equal(aapl, null);
  });

  it('saves and loads expectations via local storage fallback', async () => {
    const exps: TrackedExpectation[] = [
      {
        expectationId: 'exp_rev',
        ticker: 'MSFT',
        metricOrEvent: 'revenue',
        metricLabel: 'Revenue Target',
        targetValue: 65000,
        condition: 'gte',
        targetPeriod: 'Q4 2026',
        status: 'PENDING',
        origin: 'USER_EXPECTATION',
        sourceReportId: 'rep_1',
        actualValue: null,
        evaluationDate: null,
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z'
      }
    ];

    await saveExpectations('MSFT', exps, null);
    const loaded = await loadExpectations('MSFT', null);

    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].expectationId, 'exp_rev');
    assert.equal(loaded[0].targetValue, 65000);
    assert.equal(loaded[0].status, 'PENDING');
  });

  describe('Blocker D — User-Isolated Local Cache', () => {
    const userA = { uid: 'user_a_123' } as any;
    const userB = { uid: 'user_b_456' } as any;

    it('prevents User B from seeing User A thesis via local fallback', async () => {
      const thesisA: InvestmentThesisRecord = {
        thesisId: 'th_a_msft',
        ticker: 'MSFT',
        version: 1,
        summary: 'User A confidential thesis',
        keyDrivers: ['Driver A'],
        keyAssumptions: [],
        keyRisks: [],
        catalysts: [],
        invalidationConditions: [],
        status: 'ACTIVE',
        confirmationStatus: 'USER_CONFIRMED',
        sourceReportId: 'rep_1',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z'
      };

      // User A saves MSFT thesis
      await saveUserThesis(thesisA, userA);

      // User B attempts to load MSFT thesis
      const loadedByB = await loadUserThesis('MSFT', userB);
      assert.equal(loadedByB, null, 'User B must not see User A thesis');

      // User A loads MSFT thesis
      const loadedByA = await loadUserThesis('MSFT', userA);
      assert.ok(loadedByA);
      assert.equal(loadedByA?.summary, 'User A confidential thesis');
    });

    it('prevents User B from seeing User A expectations via local fallback', async () => {
      const expsA: TrackedExpectation[] = [
        {
          expectationId: 'exp_a_1',
          ticker: 'MSFT',
          metricOrEvent: 'revenue',
          metricLabel: 'User A Target',
          targetValue: 80000,
          condition: 'gte',
          targetPeriod: 'FY26',
          status: 'PENDING',
          origin: 'USER_EXPECTATION',
          sourceReportId: 'rep_1',
          actualValue: null,
          evaluationDate: null,
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-01T00:00:00Z'
        }
      ];

      // User A saves expectations
      await saveExpectations('MSFT', expsA, userA);

      // User B attempts to load expectations
      const loadedByB = await loadExpectations('MSFT', userB);
      assert.equal(loadedByB.length, 0, 'User B must not see User A expectations');

      // User A loads expectations
      const loadedByA = await loadExpectations('MSFT', userA);
      assert.equal(loadedByA.length, 1);
      assert.equal(loadedByA[0].metricLabel, 'User A Target');
    });

    it('ensures authenticated Firestore failure does NOT fall back to foreign user or anonymous cache', async () => {
      // Setup anonymous cache with some public/legacy thesis
      const anonThesis: InvestmentThesisRecord = {
        thesisId: 'th_anon',
        ticker: 'GOOGL',
        version: 1,
        summary: 'Anonymous draft',
        keyDrivers: [],
        keyAssumptions: [],
        keyRisks: [],
        catalysts: [],
        invalidationConditions: [],
        status: 'ACTIVE',
        confirmationStatus: 'AI_DRAFT',
        sourceReportId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      };
      await saveUserThesis(anonThesis, null);

      // User B loads GOOGL when User B has no saved thesis
      const userBLoaded = await loadUserThesis('GOOGL', userB);
      assert.equal(userBLoaded, null, 'Authenticated User B must not fall back to anonymous cache');
    });
  });
});
