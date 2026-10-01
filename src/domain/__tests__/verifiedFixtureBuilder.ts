import type { FinancialStatementsData } from '../../types';
import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../financialValue';
import { STATEMENT_MAPPING_VERSION, STATEMENT_NORMALIZATION_VERSION } from '../verifiedFinancialStatements';
import { parseQuarterPeriod } from '../../utils/statementAggregation';

/** Synthetic SEC test double, never imported by production or claimed as a real filing. */
export function verifiedFixtureFromStatements(fs: FinancialStatementsData): CanonicalFinancialDataset {
  // Explicit synthetic fixture convention: parent equity supplied without a
  // preferred component represents common equity in these test doubles only.
  // This convention never runs on source ingestion or user/model accounting data.
  fs = structuredClone(fs);
  if (fs.balance_sheet.stockholders_equity && !(fs.balance_sheet as any).common_equity) (fs.balance_sheet as any).common_equity = fs.balance_sheet.stockholders_equity;
  const values: CanonicalFinancialDataset['values'] = {};
  for (const section of ['income_statement', 'balance_sheet', 'cash_flow'] as const) {
    for (const [metric, series] of Object.entries(fs[section])) {
      if (!Array.isArray(series)) continue;
      values[`${section}.${metric}`] = fs.periods.map((label, i) => {
        const identity = parseQuarterPeriod(label, i)!;
        const month = identity.quarter * 3;
        const end = new Date(Date.UTC(identity.year, month, 0)).toISOString().slice(0, 10);
        const start = new Date(Date.UTC(identity.year, month - 3, 1)).toISOString().slice(0, 10);
        return {
          metric, statement: section, value: series[i] ?? null,
          unit: metric.includes('eps') ? 'per_share' : metric.endsWith('_pct') ? 'percent' : 'USD_M',
          period: `Q${identity.quarter} ${identity.year}`, fiscalYear: identity.year,
          fiscalQuarter: identity.quarter as 1 | 2 | 3 | 4,
          periodStart: section === 'balance_sheet' ? undefined : start, periodEnd: end,
          periodType: section === 'balance_sheet' ? 'instant' : 'standalone_quarter',
          type: 'reported', verification: series[i] === null ? 'unverified' : 'verified',
          source: { provider: 'SEC EDGAR XBRL test double', documentUrl: 'https://www.sec.gov/Archives/edgar/data/1/test-double/test.htm',
            accessionNumber: 'test-double', documentType: '10-Q', periodEnd: end },
        } as CanonicalFinancialValue;
      });
    }
  }
  const all = Object.values(values).flat(), count = all.filter(i => i.value !== null).length;
  return { schemaVersion: 2, generatedBy: 'test-double+sec-xbrl-v2',
    mappingVersion: STATEMENT_MAPPING_VERSION, normalizationVersion: STATEMENT_NORMALIZATION_VERSION,
    currency: 'USD', periods: fs.periods, values, provenanceStatus: 'verified', provenanceWarnings: [],
    sourceCoverage: { totalValues: all.length, nonNullValues: count, missingValues: all.length - count, verifiedValues: count, sourceLinkedValues: count } };
}

/** Upgrade an explicitly synthetic test double; never used at an application boundary. */
export function upgradeCanonicalTestFixture(input: CanonicalFinancialDataset): CanonicalFinancialDataset {
  const result = structuredClone(input);
  result.schemaVersion = 2;
  result.mappingVersion = STATEMENT_MAPPING_VERSION;
  result.normalizationVersion = STATEMENT_NORMALIZATION_VERSION;
  result.generatedBy = 'test-double+sec-xbrl-v2';
  for (const series of Object.values(result.values)) for (const item of series) {
    item.type ||= 'reported';
    const identity = parseQuarterPeriod(item.period, 0);
    if (!identity) continue;
    const end = item.periodEnd || new Date(Date.UTC(identity.year, identity.quarter * 3, 0)).toISOString().slice(0, 10);
    item.fiscalYear = identity.year;
    item.fiscalQuarter = identity.quarter as 1 | 2 | 3 | 4;
    item.periodEnd = end;
    item.currency = result.currency || 'USD';
    if (item.statement !== 'balance_sheet') item.periodStart ||= new Date(Date.UTC(identity.year, identity.quarter * 3 - 3, 1)).toISOString().slice(0, 10);
    item.source = { provider: 'SEC EDGAR XBRL test double', documentUrl: 'https://www.sec.gov/Archives/edgar/data/1/test-double/test.htm',
      accessionNumber: 'test-double', ...item.source, periodEnd: end };
  }
  return result;
}
