import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  enforceAnalyzeEntitlements,
  resetUsageStoreForTesting,
  getUserMonthlyUsage,
  recordUserAnalysis,
  getCurrentBillingMonth,
} from '../entitlementAuthority.ts';

describe('Server-Side Entitlement Authority (P0-5)', () => {
  beforeEach(() => {
    resetUsageStoreForTesting();
  });

  const mockResponse = () => {
    const res: any = {
      statusCode: 200,
      body: null,
      locals: {},
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        return this;
      },
    };
    return res;
  };

  it('rejects Pro model (gemini-2.5-pro) for Free tier user with HTTP 403 MODEL_NOT_ENTITLED', () => {
    const req: any = {
      body: { model: 'gemini-2.5-pro', ticker: 'MSFT' },
      auth: { uid: 'user_free_1', tier: 'free' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'MODEL_NOT_ENTITLED');
    assert.equal(res.body?.tier, 'free');
    assert.equal(res.body?.model, 'gemini-2.5-pro');
  });

  it('allows Pro model (gemini-2.5-pro) for Pro tier user', () => {
    const req: any = {
      body: { model: 'gemini-2.5-pro', ticker: 'MSFT' },
      auth: { uid: 'user_pro_1', tier: 'pro' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('rejects Deep Think (useSelfConsistency: true) for Free tier user with HTTP 403 FEATURE_NOT_ENTITLED', () => {
    const req: any = {
      body: { model: 'gemini-3.8-flash', ticker: 'AAPL', useSelfConsistency: true },
      auth: { uid: 'user_free_2', tier: 'free' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body?.code, 'FEATURE_NOT_ENTITLED');
    assert.equal(res.body?.feature, 'deep_think');
    assert.equal(res.body?.tier, 'free');
  });

  it('allows Deep Think (useSelfConsistency: true) for Pro tier user', () => {
    const req: any = {
      body: { model: 'gemini-3.8-flash', ticker: 'AAPL', useSelfConsistency: true },
      auth: { uid: 'user_pro_2', tier: 'pro' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('enforces monthly analysis quota (5 limit) for Free tier users with HTTP 429 ANALYSIS_QUOTA_EXCEEDED', () => {
    const uid = 'user_free_quota';
    const month = getCurrentBillingMonth();

    // Consume all 5 allowed analyses
    for (let i = 0; i < 5; i++) {
      recordUserAnalysis(uid, month);
    }
    assert.equal(getUserMonthlyUsage(uid, month), 5);

    // 6th attempt must be rejected
    const req: any = {
      body: { model: 'gemini-3.8-flash', ticker: 'NVDA' },
      auth: { uid, tier: 'free' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body?.code, 'ANALYSIS_QUOTA_EXCEEDED');
    assert.equal(res.body?.limit, 5);
    assert.equal(res.body?.currentUsage, 5);
  });

  it('allows unlimited analyses for Institutional tier users', () => {
    const uid = 'user_inst_unlimited';
    const month = getCurrentBillingMonth();

    // Simulate 500 analyses
    for (let i = 0; i < 500; i++) {
      recordUserAnalysis(uid, month);
    }
    assert.equal(getUserMonthlyUsage(uid, month), 500);

    const req: any = {
      body: { model: 'gemini-2.5-pro', ticker: 'GOOGL', useSelfConsistency: true },
      auth: { uid, tier: 'institutional' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.statusCode, 200);
  });

  it('increments usage counter when request is allowed', () => {
    const uid = 'user_track_usage';
    const month = getCurrentBillingMonth();
    assert.equal(getUserMonthlyUsage(uid, month), 0);

    const req: any = {
      body: { model: 'gemini-3.8-flash', ticker: 'TSLA' },
      auth: { uid, tier: 'free' },
    };
    const res = mockResponse();
    let nextCalled = false;

    enforceAnalyzeEntitlements(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(getUserMonthlyUsage(uid, month), 1);
  });
});
