import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyConcept, SecCompanyFact } from './secClient';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import { normalizeInstantFactsToFiscalQuarters, type NormalizedSecQuarterFact } from './xbrlNormalizer';

const DIRECT_TOTAL_DEBT_CONCEPTS = [
  'DebtAndFinanceLeaseObligations',
  'LongTermDebtAndFinanceLeaseObligations',
  'LongTermDebtAndCapitalLeaseObligations',
] as const;

const SAFE_COMPONENT_FAMILY = {
  current: 'DebtCurrent',
  noncurrent: 'LongTermDebtNoncurrent',
} as const;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
const quarterKey = (fact: Pick<NormalizedSecQuarterFact, 'fiscalYear' | 'fiscalQuarter'>) => `${fact.fiscalYear}-Q${fact.fiscalQuarter}`;
const periodKey = (period: string) => {
  const match = period.match(/^Q([1-4])\s+(\d{4})$/i);
  return match ? `${match[2]}-Q${match[1]}` : null;
};

const conceptFacts = (bundle: SecCompanyBundleLike, concept: string): SecCompanyFact[] =>
  bundle.companyFacts.facts?.['us-gaap']?.[concept]?.units?.USD ?? [];

const normalizedConceptMap = (bundle: SecCompanyBundleLike, concept: string) => {
  const map = new Map<string, NormalizedSecQuarterFact>();
  for (const fact of normalizeInstantFactsToFiscalQuarters(conceptFacts(bundle, concept))) {
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

const sourceForFact = (bundle: SecCompanyBundleLike, fact: NormalizedSecQuarterFact, concept: string) => {
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
    taxonomy: 'us-gaap',
    concept,
  } as any;
};

const directTotalDebtSeries = (bundle: SecCompanyBundleLike) => {
  for (const concept of DIRECT_TOTAL_DEBT_CONCEPTS) {
    const map = normalizedConceptMap(bundle, concept);
    if (map.size > 0) return { concept, map };
  }
  return null;
};

/**
 * Attach canonical total debt without summing overlapping aliases.
 *
 * Priority:
 * 1. A single SEC aggregate debt concept, if disclosed.
 * 2. `DebtCurrent + LongTermDebtNoncurrent` only when both are present for the same quarter.
 *
 * We deliberately do not add `ShortTermBorrowings` to `DebtCurrent`, or mix finance-lease/current
 * aliases, because those concepts can overlap. If the safe family is incomplete, total debt stays null.
 */
export function attachVerifiedTotalDebtFromSec(
  dataset: CanonicalFinancialDataset,
  bundle: SecCompanyBundleLike,
): CanonicalFinancialDataset {
  const next = structuredClone(dataset) as CanonicalFinancialDataset;
  const direct = directTotalDebtSeries(bundle);
  const debtCurrent = normalizedConceptMap(bundle, SAFE_COMPONENT_FAMILY.current);
  const debtNoncurrent = normalizedConceptMap(bundle, SAFE_COMPONENT_FAMILY.noncurrent);

  const series: CanonicalFinancialValue[] = next.periods.map(period => {
    const key = periodKey(period);
    if (!key) {
      return {
        metric: 'total_debt', statement: 'balance_sheet', value: null, unit: 'USD_M', period,
        type: 'derived', verification: 'unverified', derivation: 'Unrecognized fiscal-period label.',
      };
    }

    const directFact = direct?.map.get(key);
    if (direct && directFact && finite(directFact.value)) {
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: round(directFact.value / 1_000_000),
        unit: 'USD_M',
        period,
        periodEnd: directFact.end,
        type: 'reported',
        verification: 'verified',
        source: sourceForFact(bundle, directFact, direct.concept),
        derivation: `Direct SEC us-gaap:${direct.concept} instant aggregate; no debt components were added to it.`,
      };
    }

    const current = debtCurrent.get(key);
    const noncurrent = debtNoncurrent.get(key);
    if (current && noncurrent && finite(current.value) && finite(noncurrent.value)) {
      const accessions = Array.from(new Set([...current.accessionNumbers, ...noncurrent.accessionNumbers]));
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: round((current.value + noncurrent.value) / 1_000_000),
        unit: 'USD_M',
        period,
        periodEnd: current.end === noncurrent.end ? current.end : undefined,
        type: 'derived',
        verification: 'verified',
        source: sourceForFact(bundle, current, SAFE_COMPONENT_FAMILY.current),
        derivation: `Deterministic SEC total debt = us-gaap:${SAFE_COMPONENT_FAMILY.current} + us-gaap:${SAFE_COMPONENT_FAMILY.noncurrent}; accessions: ${accessions.join(', ')}. No short-term borrowing alias was added separately.`,
      };
    }

    return {
      metric: 'total_debt',
      statement: 'balance_sheet',
      value: null,
      unit: 'USD_M',
      period,
      type: 'derived',
      verification: 'unverified',
      derivation: 'No non-overlapping SEC total-debt aggregate or complete DebtCurrent + LongTermDebtNoncurrent pair was available for this quarter.',
    };
  });

  if (series.some(item => item.value !== null)) next.values['balance_sheet.total_debt'] = series;

  const flattened = Object.values(next.values).flat();
  const nonNullValues = flattened.filter(item => item.value !== null).length;
  const verifiedValues = flattened.filter(item => item.value !== null && item.verification === 'verified').length;
  const sourceLinkedValues = flattened.filter(item => item.value !== null && item.verification === 'source_linked').length;
  next.sourceCoverage = {
    ...next.sourceCoverage,
    totalValues: flattened.length,
    nonNullValues,
    missingValues: flattened.length - nonNullValues,
    verifiedValues,
    sourceLinkedValues,
  };
  return next;
}
