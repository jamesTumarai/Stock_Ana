import assert from 'node:assert/strict';
import type { ReportData } from '../types';
import { buildCanonicalFinancialDataset } from './financialValue';

const report = {
  ticker: 'TEST',
  financial_statements: {
    currency: 'USD',
    as_of_date: '2026-06-30',
    periods: ['Q1 2026', 'Q2 2026'],
    income_statement: {
      revenue: [100, 120],
      net_income: [10, 12],
      eps_diluted: [0.1, 0.12],
      gross_margin_pct: [50, 52],
    },
    balance_sheet: {
      cash_and_equivalents: [20, 25],
    },
    cash_flow: {
      operating_cash_flow: [18, 22],
      capex: [-4, -5],
      free_cash_flow: [14, 17],
    },
    source: {
      document_url: 'https://www.sec.gov/Archives/edgar/data/123/test.htm',
      document_type: '10-Q',
      filing_date: '2026-08-01',
      period_end: '2026-06-30',
      units: 'USD millions',
    },
  },
} as unknown as ReportData;

const dataset = buildCanonicalFinancialDataset(report);
assert.ok(dataset);
assert.equal(dataset?.ticker, 'TEST');
assert.equal(dataset?.currency, 'USD');
assert.equal(dataset?.provenanceStatus, 'partially_source_linked');
assert.ok(dataset?.provenanceWarnings.some(item => item.code === 'FINANCIAL_SOURCE_LINKED_NOT_VERIFIED'));
assert.ok(dataset?.provenanceWarnings.some(item => item.code === 'FINANCIAL_PROVENANCE_PARTIAL'));

const revenue = dataset!.values['income_statement.revenue'];
assert.equal(revenue.length, 2);
assert.equal(revenue[0].verification, 'unverified');
assert.equal(revenue[0].source, undefined);
assert.equal(revenue[1].verification, 'source_linked');
assert.equal(revenue[1].source?.provider, 'SEC EDGAR');
assert.equal(revenue[1].source?.documentType, '10-Q');
assert.equal(revenue[1].periodEnd, '2026-06-30');
assert.equal(revenue[1].type, 'reported');
assert.equal(revenue[1].unit, 'USD_M');

const eps = dataset!.values['income_statement.eps_diluted'];
assert.equal(eps[1].unit, 'per_share');

const margin = dataset!.values['income_statement.gross_margin_pct'];
assert.equal(margin[1].type, 'derived');
assert.equal(margin[1].unit, 'percent');

const fcf = dataset!.values['cash_flow.free_cash_flow'];
assert.equal(fcf[1].type, 'derived');
assert.match(fcf[1].derivation || '', /operating cash flow/i);

assert.equal(dataset!.sourceCoverage.verifiedValues, 0, 'A linked SEC URL must not be treated as independently verified');
assert.ok(dataset!.sourceCoverage.sourceLinkedValues > 0);
assert.equal(dataset!.sourceCoverage.nonNullValues, dataset!.sourceCoverage.totalValues);

const withoutSource = structuredClone(report) as any;
delete withoutSource.financial_statements.source;
const unverified = buildCanonicalFinancialDataset(withoutSource)!;
assert.equal(unverified.sourceCoverage.sourceLinkedValues, 0);
assert.equal(unverified.sourceCoverage.verifiedValues, 0);
assert.equal(unverified.provenanceStatus, 'unverified');
assert.ok(unverified.provenanceWarnings.some(item => item.code === 'FINANCIAL_SOURCE_UNLINKED'));
assert.ok(Object.values(unverified.values).flat().every(item => item.verification === 'unverified'));

const withMissing = structuredClone(report) as any;
withMissing.financial_statements.income_statement.revenue[1] = null;
const missingDataset = buildCanonicalFinancialDataset(withMissing)!;
assert.equal(missingDataset.values['income_statement.revenue'][1].value, null);
assert.equal(missingDataset.values['income_statement.revenue'][1].verification, 'unverified');
assert.equal(missingDataset.values['income_statement.revenue'][1].source, undefined);
assert.equal(missingDataset.sourceCoverage.missingValues, 1);
assert.equal(missingDataset.sourceCoverage.sourceLinkedValues, dataset!.sourceCoverage.sourceLinkedValues - 1);

const badUrl = structuredClone(report) as any;
badUrl.financial_statements.source.document_url = 'not-a-url';
const badUrlDataset = buildCanonicalFinancialDataset(badUrl)!;
assert.equal(badUrlDataset.sourceCoverage.sourceLinkedValues, 0);
assert.equal(badUrlDataset.provenanceStatus, 'unverified');
assert.ok(badUrlDataset.provenanceWarnings.some(item => item.code === 'FINANCIAL_SOURCE_URL_INVALID'));

const dateConflict = structuredClone(report) as any;
dateConflict.financial_statements.as_of_date = '2026-03-31';
const conflictDataset = buildCanonicalFinancialDataset(dateConflict)!;
assert.ok(conflictDataset.provenanceWarnings.some(item => item.code === 'FINANCIAL_SOURCE_DATE_CONFLICT'));

assert.equal(buildCanonicalFinancialDataset({ ticker: 'TEST' } as ReportData), null);
console.log('Canonical financial provenance checks passed');
