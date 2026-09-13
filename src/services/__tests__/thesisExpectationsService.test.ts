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
});
