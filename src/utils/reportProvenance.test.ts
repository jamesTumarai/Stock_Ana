import assert from 'node:assert/strict';
import type { ReportData } from '../types';
import { buildReportProvenanceManifest } from './reportProvenance';

const metadata = {
  generatedAt: '2026-09-10T00:00:00.000Z',
  schemaVersion: 2,
  generatedByVersion: 'lumina-phase3-provenance-v1',
};

const baseReport = (): ReportData => ({
  generated_at: '2026-09-10T00:00:00.000Z',
  ticker: 'TEST',
  summary: 'AI research snapshot',
  validation: {
    status: 'valid',
    issues: [],
    checked_at: '2026-09-10T00:00:00.000Z',
    schema_version: 2,
  },
  financial_statements: {
    periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
    income_statement: { revenue: [100, 110, 120, 130], net_income: [10, 11, 12, 13] },
    balance_sheet: {},
    cash_flow: {},
  },
  intrinsic_value: {
    current_price: 50,
    dcf_model: {
      assumptions: { wacc_pct: 10, terminal_growth_pct: 3, projection_years: 5 },
      inputs: {
        ticker: 'TEST',
        currentPrice: 50,
        startingRevenueM: 460,
        sharesOutstandingM: 100,
        netCashM: 20,
        waccPct: 10,
        terminalGrowthPct: 3,
        projectionYears: 5,
        isValid: true,
        sourcePeriod: 'Q1 2026–Q4 2026',
        financialDataSource: 'report_statements',
      },
      scenarios: {
        bear: { revenue_cagr_pct: 3, terminal_margin_pct: 10, fair_value_per_share: 40, key_assumption_note: '' },
        base: { revenue_cagr_pct: 6, terminal_margin_pct: 12, fair_value_per_share: 50, key_assumption_note: '' },
        bull: { revenue_cagr_pct: 9, terminal_margin_pct: 14, fair_value_per_share: 60, key_assumption_note: '' },
      },
    },
    summary: {
      fair_value_range_low: 40,
      fair_value_range_high: 60,
      base_case_fair_value: 50,
      margin_of_safety_pct: 0,
      verdict_text: '',
    },
  },
});

{
  const manifest = buildReportProvenanceManifest(baseReport(), metadata);
  assert.equal(manifest.version, 1);
  assert.equal(manifest.research_narrative.source, 'ai_research');
  assert.equal(manifest.research_narrative.source_verification, 'not_independently_verified');
  assert.equal(manifest.financial_statements.source, 'report_snapshot');
  assert.equal(manifest.financial_statements.source_verification, 'not_independently_verified');
  assert.equal(manifest.dcf_financial_inputs.source, 'report_snapshot');
  assert.equal(manifest.dcf_financial_inputs.used_in_output, true);
  assert.equal(manifest.sec_cross_check.status, 'not_run');
}

{
  const report = baseReport();
  report.intrinsic_value!.dcf_model.inputs = {
    ...report.intrinsic_value!.dcf_model.inputs!,
    financialDataSource: 'sec_verified',
    financialDataAsOf: '2026-06-30',
    sharesAsOf: '2026-07-20',
  };
  report.sec_verification = {
    status: 'verified_eligible',
    ticker: 'TEST',
    retrieved_at: '2026-09-10T00:00:00.000Z',
    provenance_status: 'verified',
    provenance_warnings: [],
    dcf_coverage: { eligible: true, periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'], current_shares_outstanding_m: 100, issues: [] },
    dcf_financial_inputs: {
      version: 1,
      generated_by: 'sec-verified-financial-inputs-v1',
      eligible: true,
      ticker: 'TEST',
      periods: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'],
      source_period: 'Q1 2026–Q4 2026',
      latest_balance_sheet_period_end: '2026-06-30',
      share_as_of: '2026-07-20',
      starting_revenue_m: 460,
      trailing_four_free_cash_flow_m: 50,
      historical_fcf_margin_pct: 10.86,
      cash_and_equivalents_m: 30,
      short_term_investments_m: 10,
      total_debt_m: 20,
      net_cash_m: 20,
      current_shares_outstanding_m: 100,
      issues: [],
    },
    latest_statements_source: {
      document_url: 'https://www.sec.gov/Archives/test.htm',
      document_type: '10-Q',
      filing_date: '2026-08-01',
      period_end: '2026-06-30',
      units: 'USD millions',
    },
  };

  const manifest = buildReportProvenanceManifest(report, metadata);
  assert.equal(manifest.dcf_financial_inputs.source, 'sec_verified');
  assert.equal(manifest.dcf_financial_inputs.source_verification, 'independently_verified');
  assert.equal(manifest.financial_statements.source, 'report_snapshot', 'SEC DCF eligibility must not relabel displayed statements');
  assert.equal(manifest.sec_cross_check.status, 'verified_eligible');
  assert.equal(manifest.sec_cross_check.filing_type, '10-Q');
}

{
  const report = baseReport();
  report.intrinsic_value!.dcf_model.inputs = {
    ...report.intrinsic_value!.dcf_model.inputs!,
    financialDataSource: 'sec_verified',
  };
  report.sec_verification = {
    status: 'verified_partial',
    ticker: 'TEST',
    retrieved_at: null,
    provenance_status: 'partial',
    provenance_warnings: [],
    dcf_coverage: null,
    dcf_financial_inputs: null,
    latest_statements_source: null,
  };

  const manifest = buildReportProvenanceManifest(report, metadata);
  assert.equal(manifest.dcf_financial_inputs.source, 'unavailable');
  assert.equal(manifest.dcf_financial_inputs.used_in_output, false);
  assert.match(manifest.dcf_financial_inputs.note, /fails closed/i);
}

{
  const report = baseReport() as ReportData & { market_snapshot?: any };
  report.market_snapshot = {
    ticker: 'TEST',
    price: 51,
    provider: 'Yahoo Finance',
    asOf: '2026-09-09T20:00:00.000Z',
    retrievedAt: '2026-09-09T20:00:10.000Z',
    dataKind: 'market_quote',
    isRealtime: false,
  };
  const manifest = buildReportProvenanceManifest(report, metadata);
  assert.equal(manifest.market_price.source, 'market_snapshot');
  assert.equal(manifest.market_price.source_verification, 'provider_snapshot');
  assert.equal(manifest.market_price.provider, 'Yahoo Finance');
}

console.log('Report provenance manifest checks passed');
