import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyFact } from './secClient';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import { normalizeInstantFactsToFiscalQuarters, type NormalizedSecQuarterFact } from './xbrlNormalizer';

const COMBINED_CONCEPT = 'CashCashEquivalentsAndShortTermInvestments';
const CASH_CONCEPT = 'CashAndCashEquivalentsAtCarryingValue';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const quarterKey = (fact: Pick<NormalizedSecQuarterFact, 'fiscalYear' | 'fiscalQuarter'>) => `${fact.fiscalYear}-Q${fact.fiscalQuarter}`;
const periodKey = (period: string) => {
  const match = period.match(/^Q([1-4])\s+(\d{4})$/i);
  return match ? `${match[2]}-Q${match[1]}` : null;
};
const round = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;

const conceptFacts = (bundle: SecCompanyBundleLike, concept: string): SecCompanyFact[] =>
  bundle.companyFacts.facts?.['us-gaap']?.[concept]?.units?.USD ?? [];

const normalizedMap = (bundle: SecCompanyBundleLike, concept: string, dataset: CanonicalFinancialDataset) => {
  const map = new Map<string, NormalizedSecQuarterFact>();
  const identities = new Map(Object.values(dataset.values).flat().filter(v=>v.periodEnd&&v.fiscalYear&&v.fiscalQuarter)
    .map(v=>[v.periodEnd,{fy:v.fiscalYear!,fp:v.fiscalQuarter===4?'FY':`Q${v.fiscalQuarter}`}]));
  const cohorts = new Map((dataset.values['balance_sheet.total_assets']||[]).filter(v=>v.periodEnd&&v.accession).map(v=>[v.periodEnd,v.accession]));
  const facts=conceptFacts(bundle,concept).filter(f=>!cohorts.has(f.end)||f.accn===cohorts.get(f.end)).map(f=>({...f,...identities.get(f.end)}));
  for (const fact of normalizeInstantFactsToFiscalQuarters(facts)) {
    map.set(quarterKey(fact), fact);
  }
  return map;
};

const submissionDocumentMap = (bundle: SecCompanyBundleLike) => {
  const recent = bundle.submissions.filings?.recent;
  const accessions = recent?.accessionNumber;
  const primaryDocuments = recent?.primaryDocument;
  const forms = recent?.form;
  const filingDates = recent?.filingDate;
  const map = new Map<string, { documentUrl?: string; form?: string; filingDate?: string }>();
  if (!Array.isArray(accessions)) return map;

  const cikNoLeadingZeros = String(Number(bundle.identity.cik));
  accessions.forEach((rawAccession, index) => {
    if (typeof rawAccession !== 'string' || !rawAccession) return;
    const primaryDocument = Array.isArray(primaryDocuments) && typeof primaryDocuments[index] === 'string'
      ? primaryDocuments[index] as string
      : undefined;
    map.set(rawAccession, {
      documentUrl: primaryDocument
        ? `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${rawAccession.replace(/-/g, '')}/${primaryDocument}`
        : undefined,
      form: Array.isArray(forms) && typeof forms[index] === 'string' ? forms[index] as string : undefined,
      filingDate: Array.isArray(filingDates) && typeof filingDates[index] === 'string' ? filingDates[index] as string : undefined,
    });
  });
  return map;
};

const sourceFor = (bundle: SecCompanyBundleLike, fact: NormalizedSecQuarterFact) => {
  const accession = fact.accessionNumbers[0];
  const filing = accession ? submissionDocumentMap(bundle).get(accession) : undefined;
  return {
    provider: 'SEC EDGAR XBRL',
    documentUrl: filing?.documentUrl,
    documentType: filing?.form ?? fact.form,
    filingDate: filing?.filingDate ?? fact.filed,
    periodEnd: fact.end,
    accessionNumber: accession,
    retrievedAt: bundle.retrievedAt,
    entityCik: bundle.identity.cik,
  } as any;
};

const recalculateCoverage = (dataset: CanonicalFinancialDataset) => {
  const flattened = Object.values(dataset.values).flat();
  const nonNullValues = flattened.filter(item => item.value !== null).length;
  const verifiedValues = flattened.filter(item => item.value !== null && item.verification === 'verified').length;
  const sourceLinkedValues = flattened.filter(item => item.value !== null && item.verification === 'source_linked').length;
  dataset.sourceCoverage = {
    ...dataset.sourceCoverage,
    totalValues: flattened.length,
    nonNullValues,
    missingValues: flattened.length - nonNullValues,
    verifiedValues,
    sourceLinkedValues,
  };
};

/**
 * Fill missing short-term investments only when SEC reports the exact standard aggregate
 * `CashCashEquivalentsAndShortTermInvestments` and cash/equivalents for the same fiscal instant.
 *
 * short-term investments = combined liquidity aggregate - cash and equivalents
 *
 * The derivation fails closed when periods differ, inputs are unavailable, or the combined
 * aggregate is below cash. Existing directly reported short-term-investment values always win.
 */
export function attachVerifiedShortTermInvestmentsFromSec(
  dataset: CanonicalFinancialDataset,
  bundle: SecCompanyBundleLike,
): CanonicalFinancialDataset {
  const next = structuredClone(dataset) as CanonicalFinancialDataset;
  const combined = normalizedMap(bundle, COMBINED_CONCEPT, dataset);
  const cash = normalizedMap(bundle, CASH_CONCEPT, dataset);
  if (combined.size === 0 || cash.size === 0) return next;

  const existing = next.values['balance_sheet.short_term_investments'];
  const series: CanonicalFinancialValue[] = next.periods.map((period, index) => {
    const direct = existing?.[index];
    if (direct?.value !== null && direct?.value !== undefined && direct.verification === 'verified') return direct;

    const key = periodKey(period);
    const totalFact = key ? combined.get(key) : undefined;
    const cashFact = key ? cash.get(key) : undefined;
    if (!totalFact || !cashFact || !finite(totalFact.value) || !finite(cashFact.value)
      || totalFact.end !== cashFact.end || totalFact.value < cashFact.value) {
      return direct ?? {
        metric: 'short_term_investments',
        statement: 'balance_sheet',
        value: null,
        unit: 'USD_M',
        period,
        type: 'derived',
        verification: 'unverified',
        derivation: 'Requires same-period verified SEC cash plus combined cash/equivalents/short-term-investments aggregate.',
      };
    }

    return {
      metric: 'short_term_investments',
      statement: 'balance_sheet',
      value: round((totalFact.value - cashFact.value) / 1_000_000),
      unit: 'USD_M',
      period,
      periodEnd: totalFact.end,
      periodType: 'instant',
      fiscalYear: cashFact.fiscalYear,
      fiscalQuarter: cashFact.fiscalQuarter as 1 | 2 | 3 | 4,
      form: cashFact.form,
      accession: cashFact.accessionNumbers[0],
      concept: COMBINED_CONCEPT,
      type: 'derived',
      verification: 'verified',
      source: sourceFor(bundle, totalFact),
      derivation: `Deterministic SEC short-term investments = us-gaap:${COMBINED_CONCEPT} - us-gaap:${CASH_CONCEPT} for the same fiscal instant.`,
    };
  });

  if (series.some(item => item.value !== null)) next.values['balance_sheet.short_term_investments'] = series;
  recalculateCoverage(next);
  return next;
}
