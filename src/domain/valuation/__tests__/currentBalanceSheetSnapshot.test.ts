import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../financialValue';
import { resolveCurrentBalanceSheetSnapshot } from '../../currentBalanceSheetSnapshot';
import { buildCanonicalExecutiveSnapshot, reconcileExecutiveSummary, reconcileKeyTakeaways, reconcileCurrentValuationProse } from '../../canonicalExecutiveSnapshot';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import { extractMemorySnapshot, compareMemorySnapshots } from '../../investmentMemory';
import { computeWhatChanged } from '../../whatChangedEngine';
import { buildDecisionContext } from '../../decisionContextEngine';
import { adaptSecCanonicalToFinancialStatements } from '../../../services/sec/secLegacyAdapter';
import { normalizeReport } from '../../../utils/reportIntegrity';
import { upgradeCanonicalTestFixture } from '../../__tests__/verifiedFixtureBuilder';

const periods = ['Q2 2025', 'Q2 2026'];
const ends = ['2025-06-30', '2026-06-30'];
const makeSeries = (metric: string, values: (number | null)[], overrides: Partial<CanonicalFinancialValue>[] = []): CanonicalFinancialValue[] =>
  periods.map((period, index) => ({
    metric, statement: 'balance_sheet', value: values[index], unit: 'USD_M',
    period, periodEnd: ends[index], fiscalYear: 2025 + index, fiscalQuarter: 2,
    periodType: 'instant', form: '10-Q', accession: `000000-${index}`,
    concept: metric, type: 'reported', verification: 'verified',
    source: { provider: 'SEC EDGAR XBRL', periodEnd: ends[index] },
    ...overrides[index],
  }));

const reportFor = (sector: string, industry?: string): Partial<ReportData> => {
  const dataset: CanonicalFinancialDataset = {
    schemaVersion: 1, generatedBy: 'sec-xbrl-test', ticker: 'EXAMPLE', periods,
    provenanceStatus: 'verified', provenanceWarnings: [],
    sourceCoverage: { sourceLinkedValues: 0, verifiedValues: 0, nonNullValues: 0, missingValues: 0, totalValues: 0 },
    values: {
      'balance_sheet.cash_and_equivalents': makeSeries('cash_and_equivalents', [15200, 15200]),
      'balance_sheet.short_term_investments': makeSeries('short_term_investments', [21600, 28300]),
      'balance_sheet.short_term_debt': makeSeries('short_term_debt', [1300, 1400]),
      'balance_sheet.long_term_debt': makeSeries('long_term_debt', [7500, 7900]),
      'balance_sheet.total_assets': makeSeries('total_assets', [80000, 86000]),
      'balance_sheet.total_equity': makeSeries('total_equity', [50000, 54000]),
      'balance_sheet.inventory': makeSeries('inventory', [2500, 2700]),
      'balance_sheet.deposits': makeSeries('deposits', [40000, 44000]),
      'balance_sheet.loans_held_for_investment': makeSeries('loans_held_for_investment', [20000, 22000]),
      'balance_sheet.cet1_ratio': makeSeries('cet1_ratio', [12, 12.5]),
      'balance_sheet.loss_reserve': makeSeries('loss_reserve', [1400, 1550]),
      'balance_sheet.mortgage_debt': makeSeries('mortgage_debt', [4000, 4200]),
    },
  };
  return {
    ticker: 'EXAMPLE', company_profile: { sector, industry } as any, canonical_financials: upgradeCanonicalTestFixture({ ...dataset, currency: 'USD' }),
    financial_statements: {
      periods, balance_sheet: { cash_and_equivalents: [15200, 15200], short_term_investments: [21600, 21600] },
      income_statement: {}, cash_flow: {}, source: { period_end: '2026-06-30' },
    } as any,
  };
};

describe('Current-period balance-sheet instant integrity', () => {
  it('current D/E prose consumes the verified ratio used by Five Pillars, including zero and unavailable inputs', () => {
    for (const [debt, equity, expected] of [[9300,53000,0.18],[0,53000,0],[9300,null,null],[9300,-10,null]] as const) {
      const base = reportFor('Industrials', 'Engineering');
      const canonical = base.canonical_financials!;
      canonical.values['balance_sheet.total_debt'] = makeSeries('total_debt', [8800,debt]);
      canonical.values['balance_sheet.short_term_debt'] = makeSeries('short_term_debt', [1300,debt === 0 ? 0 : 1400]);
      canonical.values['balance_sheet.long_term_debt'] = makeSeries('long_term_debt', [7500,debt === 0 ? 0 : 7900]);
      canonical.values['balance_sheet.stockholders_equity'] = makeSeries('stockholders_equity', [49000,equity]);
      const prepared = { ...base, financial_statements: adaptSecCanonicalToFinancialStatements(upgradeCanonicalTestFixture(canonical))! };
      const pillars = resolveAdaptiveFivePillars(prepared, 'EXAMPLE');
      const snapshot = buildCanonicalExecutiveSnapshot(prepared, 'EXAMPLE');
      assert.equal(snapshot.balanceSheet.debtToEquity, expected);
      assert.equal(pillars.fivePillarsData.balance_sheet.debt_to_equity ?? null, expected);
      const current = { comprehensive_analysis: { fundamentals_check: 'D/E 9x' } } as Partial<ReportData>;
      reconcileCurrentValuationProse(current as ReportData, snapshot);
      if (expected === null) assert.match(current.comprehensive_analysis!.fundamentals_check!, /verified canonical ratio unavailable/);
      else assert.match(current.comprehensive_analysis!.fundamentals_check!, new RegExp(`D/E ${expected} x`));
    }
  });
  const archetypes = [
    ['Bank', 'Financial Services', 'Banks - Diversified'],
    ['Lender', 'Financial Services', 'Consumer Lending'],
    ['Fintech', 'Financial Services', 'Financial Technology'],
    ['Insurer', 'Financial Services', 'Insurance - Diversified'],
    ['Asset manager', 'Financial Services', 'Asset Management'],
    ['Broker', 'Financial Services', 'Capital Markets'],
    ['SaaS', 'Technology', 'Software - Infrastructure'],
    ['Semiconductor', 'Technology', 'Semiconductors'],
    ['Hardware', 'Technology', 'Consumer Electronics'],
    ['Industrial', 'Industrials', 'Industrial Machinery'],
    ['Retail', 'Consumer Cyclical', 'Specialty Retail'],
    ['Marketplace', 'Consumer Cyclical', 'Internet Retail'],
    ['REIT', 'Real Estate', 'REIT - Residential'],
    ['Energy', 'Energy', 'Oil & Gas E&P'],
    ['Utility', 'Utilities', 'Utilities - Regulated Electric'],
    ['Telecom', 'Communication Services', 'Telecom Services'],
    ['Early stage', 'Healthcare', 'Biotechnology'],
    ['Automotive', 'Consumer Cyclical', 'Auto Manufacturers'],
    ['Healthcare', 'Healthcare', 'Medical Devices'],
    ['Biotech', 'Healthcare', 'Biotechnology'],
    ['General operating', 'Basic Materials', 'Specialty Chemicals'],
  ];
  for (const [archetype, sector, industry] of archetypes) {
    it(`${archetype}: shares one verified current instant across metrics`, () => {
      const report = reportFor(sector, industry);
      const snapshot = resolveCurrentBalanceSheetSnapshot(report);
      assert.equal(snapshot.periodEnd, '2026-06-30');
      assert.equal(snapshot.cashPlusShortTermInvestments, 43500);
      assert.equal(snapshot.totalDebt, 9300);
      assert.equal(snapshot.totalDebtBasis, 'CURRENT_PLUS_LONG_TERM');
      assert.equal(snapshot.netCash, 34200);
      for (const fact of Object.values(snapshot.facts)) {
        assert.equal(fact.periodEnd, '2026-06-30');
        assert.equal(fact.fiscalYear, 2026);
        assert.equal(fact.verification, 'verified');
      }
      const section1 = buildCanonicalExecutiveSnapshot(report);
      assert.equal(section1.balanceSheet.totalCashAndInvestments, 43500);
      assert.equal(section1.balanceSheet.totalDebt, 9300);
      assert.equal(section1.balanceSheetFacts.totalCashAndInvestments?.value, 43500);
    });
  }

  it('never mixes prior-year investments into current cash or fills missing SEC facts with legacy arrays', () => {
    const report = reportFor('Technology');
    const dataset = report.canonical_financials as CanonicalFinancialDataset;
    dataset.values['balance_sheet.short_term_investments'][1] = {
      ...dataset.values['balance_sheet.short_term_investments'][1], periodEnd: '2025-06-30',
    };
    const current = resolveCurrentBalanceSheetSnapshot(report);
    assert.equal(current.cashAndEquivalents, 15200);
    assert.equal(current.shortTermInvestments, null);
    assert.equal(current.cashPlusShortTermInvestments, null);
    assert.equal(current.netCash, null);
    const displayed = adaptSecCanonicalToFinancialStatements(dataset);
    assert.equal(displayed?.balance_sheet.short_term_investments?.[1], null);
  });

  it('does not let a stale report-level source date override verified current SEC instants', () => {
    const report = reportFor('Industrials');
    report.financial_statements!.source!.period_end = '2025-06-30';
    (report as any).sec_verification = { latest_statements_source: { period_end: '2025-06-30' } };
    const current = resolveCurrentBalanceSheetSnapshot(report);
    assert.equal(current.periodEnd, '2026-06-30');
    assert.equal(current.cashPlusShortTermInvestments, 43500);
  });

  it('refreshes a persisted Section 1 balance sheet without resurrecting an unverified cached valuation', () => {
    const report = reportFor('Technology');
    (report as any).canonical_executive_snapshot = {
      valuation: { fairValue: 100 }, canonicalValuation: { baseFairValue: 100 },
      balanceSheet: { totalCashAndInvestments: 36800 },
      facts: { totalCashAndInvestments: { value: 36800 } },
    };
    const normalized = normalizeReport(report as ReportData);
    assert.equal(normalized.canonical_executive_snapshot.balanceSheet.totalCashAndInvestments, 43500);
    assert.equal(normalized.canonical_executive_snapshot.facts.totalCashAndInvestments.value, 43500);
    assert.equal(normalized.canonical_executive_snapshot.canonicalValuation.baseFairValue, null);
    assert.equal(normalized.intrinsic_value?.summary?.base_case_fair_value, undefined);
  });

  it('rejects stale Section 1 liquidity numbers in summary and takeaways', () => {
    const section1 = buildCanonicalExecutiveSnapshot(reportFor('Technology'));
    const summary = reconcileExecutiveSummary('Cash and short-term investments were $36.8 billion.', section1, false);
    const takeaways = reconcileKeyTakeaways(['Cash and short-term investments were $36.8 billion.'], section1, false);
    assert.match(summary, /43\.5 billion/);
    assert.doesNotMatch(summary, /36\.8/);
    assert.match(takeaways[0], /43\.5 billion/);
    assert.match(reconcileExecutiveSummary('เงินสดและรายการเทียบเท่าเงินสดรวมเงินลงทุนระยะสั้น 36.8 พันล้านดอลลาร์', section1, true), /43\.5 พันล้าน/);
    assert.match(reconcileExecutiveSummary('Cash + Cash Equivalents + Short-Term Investments: $36.8B', section1, false), /43\.5 B/);
    const debt = reconcileExecutiveSummary('Total debt was $7.9 billion; long-term debt was $7.9 billion.', section1, false);
    assert.match(debt, /Total debt was \$9\.3 billion/);
    assert.match(debt, /long-term debt was \$7\.9 billion/);
  });

  it('mentions Terminal Margin only when WACC stays unchanged', () => {
    const base = reportFor('Technology');
    const previous = extractMemorySnapshot({
      ...base, as_of_date: '2026-07-01',
      intrinsic_value: { dcf_model: { assumptions: { wacc_pct: 9.2, terminal_growth_pct: 2, projection_years: 5 }, scenarios: { base: { revenue_cagr_pct: 10, terminal_margin_pct: 14.5, fair_value_per_share: 100 } } } } as any,
    })!;
    const current = extractMemorySnapshot({
      ...base, as_of_date: '2026-08-01',
      intrinsic_value: { dcf_model: { assumptions: { wacc_pct: 9.2, terminal_growth_pct: 2, projection_years: 5 }, scenarios: { base: { revenue_cagr_pct: 10, terminal_margin_pct: 13.5, fair_value_per_share: 90 } } } } as any,
    })!;
    const changes = computeWhatChanged(current, previous, []);
    assert.ok(changes.items.some(item => item.id === 'change_terminal_margin'));
    assert.ok(!changes.items.some(item => item.id === 'change_wacc'));
    const decision = buildDecisionContext(current, previous, null, changes, []);
    assert.match(decision.summaryNarrative, /Terminal Margin/);
    assert.doesNotMatch(decision.summaryNarrative, /WACC/i);
    assert.doesNotMatch(decision.summaryNarrativeTh, /WACC/i);
    assert.ok(compareMemorySnapshots(current, previous).valuationAssumptionsDelta.terminalMarginDeltaPoints !== null);
  });
});
