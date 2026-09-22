import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import { resolveFundamentalMetrics } from '../metricRegistry';
import { calculatePeerSimilarity, discoverPeers, type CandidateDefinition } from '../peerDiscoveryEngine';
import type { PeerBusinessFingerprint } from '../types';
import { mapSecBundleToAnnualRevenueHistory, mapSecBundleToCanonicalFinancials } from '../../../services/sec/secFinancialMapper';

const operatingReport = (overrides: Partial<ReportData> = {}): Partial<ReportData> => ({
  ticker: 'TARGET',
  company_profile: { overview: { sector: 'Industrials', industry: 'Industrial Machinery' } as any },
  financial_statements: {
    currency: 'USD', periods: ['FY2026'],
    income_statement: { revenue: [10_000], operating_income: [1_000], income_before_tax: [900], income_tax_expense: [180], net_income: [720], interest_expense: [-100] } as any,
    balance_sheet: { total_equity: [4_000], total_debt: [2_000], cash_and_equivalents: [1_000] } as any,
  } as any,
  ...overrides,
});

describe('Five Pillars final data completeness', () => {
  it('derives 10x interest coverage with accounting-sign normalization', () => {
    const metric = resolveFundamentalMetrics(operatingReport(), 'TARGET').interestCoverage;
    assert.equal(metric.value, 10);
    assert.equal(metric.status, 'CALCULATED');
    assert.equal(metric.formula, 'Operating Income / |Interest Expense|');
  });

  it('uses verified SEC completion inputs when the report initially lacks interest expense', () => {
    const report = operatingReport();
    delete (report.financial_statements!.income_statement as any).interest_expense;
    (report as any).sec_verification = {
      sec_period_statements: [{ period: 'FY2026', form: '10-K', accession: '0001', operating_income: 1_000, interest_expense: 80 }],
    };
    const metric = resolveFundamentalMetrics(report, 'TARGET').interestCoverage;
    assert.equal(metric.value, 12.5);
    assert.match(metric.source || '', /SEC 10-K/);
  });

  it('returns precise missing and no-material-interest states instead of generic N/A', () => {
    const missing = operatingReport();
    delete (missing.financial_statements!.income_statement as any).interest_expense;
    const missingMetric = resolveFundamentalMetrics(missing, 'TARGET').interestCoverage;
    assert.equal(missingMetric.reason, 'MISSING_PERIOD_MATCHED_INTEREST_EXPENSE');
    assert.match(missingMetric.reasonTh || '', /ดอกเบี้ยจ่าย/);

    const zero = operatingReport();
    (zero.financial_statements!.income_statement as any).interest_expense = [0];
    const zeroMetric = resolveFundamentalMetrics(zero, 'TARGET').interestCoverage;
    assert.equal(zeroMetric.status, 'NO_MATERIAL_INTEREST');
    assert.match(zeroMetric.reasonTh || '', /ไม่มีภาระดอกเบี้ย/);
  });

  it('preserves the Financial Sector Guard for interest coverage', () => {
    const metric = resolveFundamentalMetrics({
      ticker: 'BANK', company_profile: { overview: { sector: 'Financial Services', industry: 'Banks' } as any },
      financial_statements: { periods: ['FY2026'], currency: 'USD', income_statement: { revenue: [100], net_income: [10], operating_income: [20], interest_expense: [5] } as any } as any,
    }, 'BANK').interestCoverage;
    assert.equal(metric.status, 'GUARDED');
    assert.equal(metric.isGuarded, true);
  });

  it('derives comparable peer ROIC from verified same-period source facts', () => {
    const peers = ['AAA', 'BBB', 'CCC'].map((ticker, index) => ({
      ticker, company_name: `${ticker} Machinery`, sector: 'Industrials', industry: 'Industrial Machinery',
      subIndustry: 'industrial_machinery', lifecycle: 'mature', profitabilityState: 'profitable', scaleTier: 'large',
      operating_income: 1_000 + index * 100, income_before_tax: 900 + index * 100, income_tax_expense: 180 + index * 20,
      total_debt: 2_000, total_equity: 4_000, cash_and_equivalents: 1_000, short_term_investments: 0,
      as_of_date: 'FY2026', financial_period: 'FY2026', financial_source: 'SEC Form 10-K',
    }));
    const result = discoverPeers({ ...operatingReport(), peer_comparison: { peers, industry_name: 'Industrial Machinery' } as any }, 'TARGET');
    assert.equal(result.metricSampleCounts.roic_pct, 3);
    const row = result.benchmarkRows.find(item => item.metric_name === 'ROIC');
    assert.ok(row);
    assert.equal(row.peer_coverage_status, 'SUFFICIENT');
    assert.notEqual(row.sector_median, 'N/A');
    assert.notEqual(row.direct_peer_value, 'N/A');
  });

  it('rejects unknown third-party ROIC and fails closed on weak coverage', () => {
    const candidate = (ticker: string, roic: number | null, source: string, derived: 'REPORTED' | 'DERIVED'): CandidateDefinition => ({
      ticker, companyName: ticker, archetype: 'industrial_manufacturing', sector: 'Industrials', industry: 'Industrial Machinery',
      subIndustry: 'industrial_machinery', revenueModels: ['product_sales'], majorBusinessLines: ['machinery'], geography: 'US',
      lifecycle: 'mature', profitabilityState: 'profitable', capitalIntensity: 'capital_intensive', scaleTier: 'large',
      metrics: { roic_pct: { value: roic, unit: '%', period: 'FY2026', source, reportedOrDerived: derived } },
    });
    const result = discoverPeers(operatingReport(), 'TARGET', {
      candidates: [
        candidate('AAA', 12, 'Unknown finance website', 'REPORTED'),
        candidate('BBB', 14, 'Unknown finance website', 'REPORTED'),
        candidate('CCC', 16, 'SEC Form 10-K', 'DERIVED'),
        candidate('DDD', null, 'SEC Form 10-K', 'DERIVED'),
        candidate('EEE', null, 'SEC Form 10-K', 'DERIVED'),
      ],
    });
    assert.equal(result.metricSampleCounts.roic_pct, 1);
    const row = result.benchmarkRows.find(item => item.metric_name === 'ROIC');
    assert.ok(row);
    assert.equal(row.peer_coverage_status, 'INSUFFICIENT');
    assert.equal(row.sector_median, 'Insufficient Comparable Peer Data');
  });

  it('downgrades same-market candidates with material lifecycle, profitability, and scale gaps', () => {
    const base: PeerBusinessFingerprint = {
      ticker: 'A', companyName: 'A', archetype: 'industrial_manufacturing', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers',
      subIndustry: 'automotive_manufacturing', revenueModels: ['vehicle_sales'], majorBusinessLines: ['vehicles'], geography: 'US',
      lifecycle: 'mature', profitabilityState: 'profitable', capitalIntensity: 'capital_intensive', scaleTier: 'mega', regulatoryType: 'standard',
    };
    const weak = { ...base, ticker: 'B', companyName: 'B', lifecycle: 'early_stage' as const, profitabilityState: 'pre_profit' as const, scaleTier: 'small' as const };
    const strong = { ...base, ticker: 'C', companyName: 'C' };
    assert.equal(calculatePeerSimilarity(base, weak).relationType, 'CLOSE_COMPARABLE');
    assert.equal(calculatePeerSimilarity(base, strong).relationType, 'DIRECT_PEER');
  });

  it('recovers SEC annual revenue history and calculates CAGR from actual fiscal endpoints', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'HISTORY',
      sec_verification: {
        historical_annual_facts: [
          { metric: 'revenue', fiscal_year: 2023, period: 'FY2023', period_end: '2023-12-31', value: 100, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
          { metric: 'revenue', fiscal_year: 2026, period: 'FY2026', period_end: '2026-12-31', value: 172.8, unit: 'USD_M', definition: 'Revenues', verification: 'verified' },
        ],
      } as any,
    }, 'HISTORY');
    assert.equal(metrics.revenueCagr3Y.value, 20);
    assert.match(metrics.revenueCagr3Y.source || '', /SEC annual history/);
    assert.match(metrics.revenueCagr3Y.basis || '', /elapsed fiscal years/);
  });

  it('fails closed when annual revenue endpoint definitions differ', () => {
    const metrics = resolveFundamentalMetrics({
      ticker: 'MISMATCH',
      data_completeness: { verifiedFacts: [
        { metricKey: 'revenue', value: 100, unit: 'USD_M', fiscalPeriod: 'FY2023', periodEnd: '2023-12-31', definition: 'Total Revenue', verificationStatus: 'VERIFIED', sourceDocument: '10-K' },
        { metricKey: 'revenue', value: 160, unit: 'USD_M', fiscalPeriod: 'FY2026', periodEnd: '2026-12-31', definition: 'Net Revenue', verificationStatus: 'VERIFIED', sourceDocument: '10-K' },
      ] } as any,
    }, 'MISMATCH');
    assert.equal(metrics.revenueCagr3Y.status, 'BASIS_MISMATCH');
    assert.equal(metrics.revenueCagr3Y.reason, 'REVENUE_DEFINITION_MISMATCH');
  });

  it('SEC mapper emits verified interest expense and annual 10-K revenue history', () => {
    const annual = (fy: number, val: number, accn: string) => ({ start: `${fy}-01-01`, end: `${fy}-12-31`, val, accn, fy, fp: 'FY', form: '10-K', filed: `${fy + 1}-02-01` });
    const bundle: any = {
      identity: { ticker: 'MAP', cik: '0000000001', title: 'Mapper Co' }, retrievedAt: '2027-02-01T00:00:00Z',
      submissions: { cik: '1', filings: { recent: { accessionNumber: ['a', 'b'], primaryDocument: ['a.htm', 'b.htm'], form: ['10-K', '10-K'], filingDate: ['2024-02-01', '2027-02-01'] } } },
      companyFacts: { cik: 1, facts: { 'us-gaap': {
        Revenues: { units: { USD: [annual(2023, 100_000_000, 'a'), annual(2026, 172_800_000, 'b')] } },
        OperatingIncomeLoss: { units: { USD: [{ start: '2026-01-01', end: '2026-03-31', val: 10_000_000, accn: 'b', fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01' }] } },
        InterestExpenseNonOperating: { units: { USD: [{ start: '2026-01-01', end: '2026-03-31', val: 1_000_000, accn: 'b', fy: 2026, fp: 'Q1', form: '10-Q', filed: '2026-05-01' }] } },
      } } },
    };
    const history = mapSecBundleToAnnualRevenueHistory(bundle);
    assert.deepEqual(history.map(item => item.value), [100, 172.8]);
    const canonical = mapSecBundleToCanonicalFinancials(bundle)!;
    assert.equal(canonical.values['income_statement.interest_expense'][0].value, 1);
  });
});
