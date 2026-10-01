import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../types';
import { reconcileCashTerminology } from './cashTerminology';
import { resolveCurrentBalanceSheetSnapshot } from './currentBalanceSheetSnapshot';
import { buildCanonicalExecutiveSnapshot, reconcileExecutiveSummary, reconcileKeyTakeaways } from './canonicalExecutiveSnapshot';
import { extractMemorySnapshot } from './investmentMemory';
import { resolveAdaptiveFivePillars } from './valuation/fivePillarsResolver';
import { resolveFundamentalMetrics } from './valuation/metricRegistry';
import { calculateDeterministicConvictionScore } from '../utils/valuation/convictionScorer';
import { decomposeValuationDelta } from '../utils/valuationDecompositionEngine';

const report = (debt = 9300): Partial<ReportData> => ({
  ticker: 'EXAMPLE',
  company_profile: { sector: 'Industrials', stock_price: 100 } as any,
  financial_statements: {
    periods: ['Q2 2026'],
    source: { period_end: '2026-06-30' },
    balance_sheet: { cash_and_equivalents: [15200], short_term_investments: [28300], total_debt: [debt], current_ratio: [2] },
    income_statement: { revenue: [1000], yoy_revenue_growth_pct: [10], net_margin_pct: [20] },
    cash_flow: { free_cash_flow: [200], fcf_margin_pct: [20] },
  } as any,
});
const current = resolveCurrentBalanceSheetSnapshot(report());

describe('Current-report cash terminology, without calculation changes', () => {
  const cases = [
    ['Cash & Cash Equivalents: $34.2B', 'Net Cash: $34.2B'],
    ['Cash and short-term investments of $34,200 million', 'Net Cash of $34,200 million'],
    ['เงินสดและรายการเทียบเท่าเงินสด อยู่ที่ 34.2 พันล้านดอลลาร์', 'สถานะเงินสดสุทธิ อยู่ที่ 34.2 พันล้านดอลลาร์'],
    ['เงินสดรวมเงินลงทุนระยะสั้น 34,200 ล้านดอลลาร์', 'สถานะเงินสดสุทธิ 34,200 ล้านดอลลาร์'],
    ['Net Cash: $43.5B', 'Cash + Short-Term Investments: $43.5B'],
    ['Net Cash: $15.2B', 'Cash & Cash Equivalents: $15.2B'],
    ['เงินสดสุทธิ 34.2 พันล้านดอลลาร์', 'สถานะเงินสดสุทธิ 34.2 พันล้านดอลลาร์'],
    ['Cash + Short-Term Investments - Canonical Debt: $34.2B', 'Net Cash: $34.2B'],
    ['เงินสดรวมเงินลงทุนระยะสั้นหักหนี้สินทางการเงิน 34.2 พันล้าน', 'สถานะเงินสดสุทธิ 34.2 พันล้าน'],
    ['**Cash & Cash Equivalents**: **$34.2B**', '**Net Cash**: **$34.2B**'],
    ['เงินสดและรายการเทียบเท่าเงินสด (Cash & Cash Equivalents) 34.2 พันล้าน', 'สถานะเงินสดสุทธิ 34.2 พันล้าน'],
    ['Cash & Cash Equivalents: 34,200,000,000 USD', 'Net Cash: 34,200,000,000 USD'],
    ['Holds $34.2B in cash and cash equivalents.', 'Holds $34.2B in Net Cash.'],
    ['Cash & Cash Equivalents of approximately $34.2B', 'Net Cash of approximately $34.2B'],
    ['เงินสดและรายการเทียบเท่าเงินสดสูงถึง 34.2 พันล้านดอลลาร์', 'สถานะเงินสดสุทธิสูงถึง 34.2 พันล้านดอลลาร์'],
  ];
  for (const [input, expected] of cases) {
    it(`labels ${input} by its canonical concept`, () => {
      const before = structuredClone(current);
      const result = reconcileCashTerminology(input, current);
      assert.equal(result, expected);
      assert.deepEqual(result.match(/[-+]?\d[\d,]*(?:\.\d+)?/g), input.match(/[-+]?\d[\d,]*(?:\.\d+)?/g));
      assert.deepEqual(current, before);
      assert.equal(reconcileCashTerminology(result, current), result);
    });
  }

  it('preserves both separate cash concepts and figures in the same paragraph', () => {
    const text = 'Cash & Cash Equivalents: $15.2B; Cash + Short-Term Investments: $43.5B; Net Cash: $34.2B.';
    assert.equal(reconcileCashTerminology(text, current), text.replace('Net Cash: $34.2B', 'Net Cash: $34.2B'));
    assert.equal(current.cashAndEquivalents, 15200);
    assert.equal(current.cashPlusShortTermInvestments, 43500);
    assert.equal(current.netCash, 34200);
  });

  it('distinguishes positive Net Debt magnitude from signed Net Cash', () => {
    const indebted = resolveCurrentBalanceSheetSnapshot(report(50000));
    assert.equal(reconcileCashTerminology('Cash & Cash Equivalents: $6.5B', indebted), 'Net Debt: $6.5B');
    assert.equal(reconcileCashTerminology('Net Cash: $6.5B', indebted), 'Net Debt: $6.5B');
    assert.equal(reconcileCashTerminology('Net Cash: -$6.5B', indebted), 'Net Cash: -$6.5B');
    assert.equal(reconcileCashTerminology('หนี้สินสุทธิ 6.5 พันล้าน', indebted), 'หนี้สินสุทธิ 6.5 พันล้าน');
    const metric = resolveFundamentalMetrics(report(50000)).netCashOrDebt;
    assert.equal(indebted.netCash, -6500);
    assert.equal(metric.value, 6.5);
    assert.equal(metric.reason, 'Net Debt $6.5B');
    assert.equal(metric.reasonTh, 'หนี้สินสุทธิ $6.5B');
  });

  it('does not infer a mislabel from ambiguous zero-debt values, missing data or unrelated cash flow', () => {
    const zeroDebt = resolveCurrentBalanceSheetSnapshot(report(0));
    const missing = resolveCurrentBalanceSheetSnapshot({});
    const unchanged = [
      'Cash + Short-Term Investments: $43.5B',
      'Cash & Cash Equivalents: $36.8B',
      'Operating net cash flow: $34.2B',
      '$34.2B of net cash flow from operating activities',
      'Cash & Cash Equivalents grew 34.2% YoY',
      'Cash & Cash Equivalents: 34.2 basis points',
    ];
    for (const text of unchanged) {
      assert.equal(reconcileCashTerminology(text, zeroDebt), text);
      assert.equal(reconcileCashTerminology(text, missing), text);
    }
  });

  it('reconciles Summary and Takeaways before their separate combined-cash value audit', () => {
    const snapshot = buildCanonicalExecutiveSnapshot(report());
    const text = 'Cash and short-term investments: $34.2B; Cash + Short-Term Investments: $43.5B.';
    assert.equal(reconcileExecutiveSummary(text, snapshot, false), 'Net Cash: $34.2B; Cash + Short-Term Investments: $43.5B.');
    assert.deepEqual(reconcileKeyTakeaways([text], snapshot, false), [reconcileExecutiveSummary(text, snapshot, false)]);
    assert.equal(snapshot.facts.totalCashAndInvestments.value, 43500);
    assert.equal(snapshot.facts.netCash.value, 34200);
  });

  it('keeps Five Pillars liquidity and Net Cash distinct', () => {
    const pillars = resolveAdaptiveFivePillars(report());
    assert.equal(pillars.fivePillarsData.balance_sheet.total_cash_and_investments_b, 43.5);
    assert.equal(pillars.fivePillarsData.balance_sheet.net_cash_or_debt_b, 34.2);
    assert.match(pillars.fivePillarsData.balance_sheet.solvency_score_label!, /สถานะเงินสดสุทธิ \(Net Cash/);
  });

  it('polishes new draft Thesis prose while preserving confirmed Thesis content', () => {
    const summary = 'Cash & Cash Equivalents: $34.2B';
    const input = { ...report(), verdict: { summary, key_takeaways: [summary] } } as any;
    const draft = extractMemorySnapshot(input)!;
    assert.equal(draft.thesis.summary, 'Net Cash: $34.2B');
    assert.deepEqual(draft.thesis.keyDrivers, ['Net Cash: $34.2B']);
    const confirmed = extractMemorySnapshot({ ...input, thesis_confirmation_status: 'user_confirmed' })!;
    assert.equal(confirmed.thesis.summary, summary);
    assert.deepEqual(confirmed.thesis.keyDrivers, [summary]);
    assert.equal(input.verdict.summary, summary);
  });

  it('uses Net Cash in Conviction only when the canonical combined-cash fact is available', () => {
    const complete = report();
    complete.financial_statements!.income_statement.net_income = [180, 200];
    complete.intrinsic_value = { current_price: 100, summary: { base_case_fair_value: 120 } } as any;
    complete.comprehensive_analysis = { business_strengths: 'Recurring demand', scoring: { risk_level: { score: 5 } } } as any;
    const withoutInvestments = structuredClone(complete);
    delete withoutInvestments.financial_statements!.balance_sheet.short_term_investments;
    const a = calculateDeterministicConvictionScore(complete, 'EXAMPLE')!;
    const b = calculateDeterministicConvictionScore(withoutInvestments, 'EXAMPLE')!;
    assert.ok(a && b);
    assert.equal(a.conviction_score, b.conviction_score);
    assert.equal(a.conviction_breakdown.financial_health.score, b.conviction_breakdown.financial_health.score);
    assert.match(JSON.stringify(a.conviction_breakdown.financial_health), /สถานะเงินสดสุทธิ|Net Cash balance sheet/);
    assert.doesNotMatch(JSON.stringify(b.conviction_breakdown.financial_health), /Net Cash/);
    assert.match(JSON.stringify(b.conviction_breakdown.financial_health), /Cash & Cash Equivalents cover financial debt/);
  });

  it('labels Timeline capital structure by each period without changing the numerical bridge', () => {
    const makeReport = (netCashM: number, fairValue: number) => ({
      ticker: 'EXAMPLE', company_profile: { sector: 'Industrials' }, report_date: '2026-06-30',
      intrinsic_value: { dcf_model: {
        inputs: { startingRevenueM: 1000, sharesOutstandingM: 100, netCashM },
        assumptions: { wacc_pct: 9, terminal_growth_pct: 2, projection_years: 5 },
        scenarios: { base: { revenue_cagr_pct: 10, terminal_margin_pct: 20, fair_value_per_share: fairValue } },
      } },
    }) as any;
    const previous = makeReport(-6500, 100);
    const next = makeReport(34200, 200);
    const en = decomposeValuationDelta(next, previous, false);
    const th = decomposeValuationDelta(next, previous, true);
    assert.ok(en.isAvailable && th.isAvailable);
    const driver = en.drivers.find(item => item.key === 'capital_structure')!;
    assert.match(driver.explanation!, /Net Debt \$6,500M to Net Cash \$34,200M/);
    assert.match(th.drivers.find(item => item.key === 'capital_structure')!.explanation!, /หนี้สินสุทธิ.*สถานะเงินสดสุทธิ/);
    assert.equal(en.totalDeltaDollars, th.totalDeltaDollars);
    assert.deepEqual(en.drivers.map(item => item.dollarImpact), th.drivers.map(item => item.dollarImpact));
  });
});
