import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyFact } from './secClient';
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

const RECONCILED_COMMERCIAL_PAPER_FAMILY = {
  longTermCurrent: 'LongTermDebtCurrent',
  longTermNoncurrent: 'LongTermDebtNoncurrent',
  longTermAggregate: 'LongTermDebt',
  commercialPaper: 'CommercialPaper',
} as const;

const EXCLUSION_CONCEPTS = {
  shortTermBorrowings: 'ShortTermBorrowings',
  financeLeaseCurrent: 'FinanceLeaseLiabilityCurrent',
  financeLeaseNoncurrent: 'FinanceLeaseLiabilityNoncurrent',
} as const;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const round = (value: number) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
const quarterKey = (fact: Pick<NormalizedSecQuarterFact, 'fiscalYear' | 'fiscalQuarter'>) => `${fact.fiscalYear}-Q${fact.fiscalQuarter}`;
const periodKey = (period: string) => {
  const match = period.match(/^Q([1-4])\s+(\d{4})$/i);
  return match ? `${match[2]}-Q${match[1]}` : null;
};

const samePeriodEnd = (...facts: Array<NormalizedSecQuarterFact | undefined>) => {
  const present = facts.filter((fact): fact is NormalizedSecQuarterFact => Boolean(fact));
  if (present.length === 0) return false;
  const end = present[0].end;
  return present.every(fact => fact.end === end);
};

const approximatelyEqual = (left: number, right: number) => {
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) <= scale * 1e-6;
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
 * 2. `DebtCurrent + LongTermDebtNoncurrent` only when both are present for the exact same instant.
 * 3. A reconciled long-term debt family when `LongTermDebtCurrent + LongTermDebtNoncurrent`
 *    exactly reconciles to `LongTermDebt` for the same instant. If same-period `CommercialPaper` is
 *    separately reported, it is added once; stale historical commercial-paper facts are never carried forward.
 *    A same-period `ShortTermBorrowings` fact or finance-lease liability keeps the family fail-closed because
 *    it could make the borrowing-only total incomplete or overlapping.
 *
 * Missing facts are never converted to zero, stale debt is never carried into a newer balance sheet, and
 * overlapping aliases are never summed. If a current-period family is internally inconsistent, total debt stays null.
 */
export function attachVerifiedTotalDebtFromSec(
  dataset: CanonicalFinancialDataset,
  bundle: SecCompanyBundleLike,
): CanonicalFinancialDataset {
  const next = structuredClone(dataset) as CanonicalFinancialDataset;
  const direct = directTotalDebtSeries(bundle);
  const debtCurrent = normalizedConceptMap(bundle, SAFE_COMPONENT_FAMILY.current);
  const debtNoncurrent = normalizedConceptMap(bundle, SAFE_COMPONENT_FAMILY.noncurrent);

  const longTermCurrent = normalizedConceptMap(bundle, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermCurrent);
  const longTermNoncurrent = normalizedConceptMap(bundle, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermNoncurrent);
  const longTermAggregate = normalizedConceptMap(bundle, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate);
  const commercialPaper = normalizedConceptMap(bundle, RECONCILED_COMMERCIAL_PAPER_FAMILY.commercialPaper);
  const shortTermBorrowings = normalizedConceptMap(bundle, EXCLUSION_CONCEPTS.shortTermBorrowings);
  const financeLeaseCurrent = normalizedConceptMap(bundle, EXCLUSION_CONCEPTS.financeLeaseCurrent);
  const financeLeaseNoncurrent = normalizedConceptMap(bundle, EXCLUSION_CONCEPTS.financeLeaseNoncurrent);

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
    if (
      current
      && noncurrent
      && finite(current.value)
      && finite(noncurrent.value)
      && samePeriodEnd(current, noncurrent)
    ) {
      const accessions = Array.from(new Set([...current.accessionNumbers, ...noncurrent.accessionNumbers]));
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: round((current.value + noncurrent.value) / 1_000_000),
        unit: 'USD_M',
        period,
        periodEnd: current.end,
        type: 'derived',
        verification: 'verified',
        source: sourceForFact(bundle, current, SAFE_COMPONENT_FAMILY.current),
        derivation: `Deterministic SEC total debt = us-gaap:${SAFE_COMPONENT_FAMILY.current} + us-gaap:${SAFE_COMPONENT_FAMILY.noncurrent}; accessions: ${accessions.join(', ')}. No short-term borrowing alias was added separately.`,
      };
    }

    const ltCurrent = longTermCurrent.get(key);
    const ltNoncurrent = longTermNoncurrent.get(key);
    const ltAggregate = longTermAggregate.get(key);
    const paper = commercialPaper.get(key);
    const overlappingShortTerm = shortTermBorrowings.get(key);
    const separateLeaseCurrent = financeLeaseCurrent.get(key);
    const separateLeaseNoncurrent = financeLeaseNoncurrent.get(key);

    const reconciledLongTermDebt = ltCurrent
      && ltNoncurrent
      && ltAggregate
      && finite(ltCurrent.value)
      && finite(ltNoncurrent.value)
      && finite(ltAggregate.value)
      && samePeriodEnd(ltCurrent, ltNoncurrent, ltAggregate)
      && approximatelyEqual(ltCurrent.value + ltNoncurrent.value, ltAggregate.value);

    const familyEnd = ltAggregate?.end;
    const samePeriodShortTerm = Boolean(
      familyEnd
      && overlappingShortTerm
      && finite(overlappingShortTerm.value)
      && overlappingShortTerm.end === familyEnd
    );
    const samePeriodLease = Boolean(
      familyEnd
      && ((separateLeaseCurrent && finite(separateLeaseCurrent.value) && separateLeaseCurrent.end === familyEnd)
        || (separateLeaseNoncurrent && finite(separateLeaseNoncurrent.value) && separateLeaseNoncurrent.end === familyEnd))
    );
    const samePeriodPaper = Boolean(
      reconciledLongTermDebt
      && ltAggregate
      && paper
      && finite(paper.value)
      && samePeriodEnd(ltCurrent, ltNoncurrent, ltAggregate, paper)
    );
    const mismatchedPaperForFiscalQuarter = Boolean(
      reconciledLongTermDebt
      && paper
      && finite(paper.value)
      && ltAggregate
      && paper.end !== ltAggregate.end
    );

    // A reconciled current/non-current long-term debt family is already a complete authoritative
    // long-term borrowing amount for the instant. Commercial paper is added only when SEC reports
    // it for that exact same instant. Historical paper is not carried forward and is not treated as zero.
    if (
      reconciledLongTermDebt
      && ltAggregate
      && ltCurrent
      && ltNoncurrent
      && !samePeriodShortTerm
      && !samePeriodLease
      && !mismatchedPaperForFiscalQuarter
    ) {
      const paperFact = samePeriodPaper && paper ? paper : undefined;
      const accessions = Array.from(new Set([
        ...ltCurrent.accessionNumbers,
        ...ltNoncurrent.accessionNumbers,
        ...ltAggregate.accessionNumbers,
        ...(paperFact?.accessionNumbers ?? []),
      ]));
      const totalValue = ltAggregate.value + (paperFact?.value ?? 0);
      const paperNote = paperFact
        ? ` + separately reported us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.commercialPaper}`
        : '';
      const absenceNote = paperFact
        ? 'CommercialPaper was reported for the same instant and added exactly once.'
        : 'No CommercialPaper fact was reported for this fiscal-quarter instant; no stale short-term debt was carried forward.';
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: round(totalValue / 1_000_000),
        unit: 'USD_M',
        period,
        periodEnd: ltAggregate.end,
        type: 'derived',
        verification: 'verified',
        source: sourceForFact(bundle, ltAggregate, RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate),
        derivation: `Deterministic SEC total debt = reconciled us-gaap:${RECONCILED_COMMERCIAL_PAPER_FAMILY.longTermAggregate}${paperNote}. LongTermDebt was verified to equal LongTermDebtCurrent + LongTermDebtNoncurrent for the same instant; accessions: ${accessions.join(', ')}. ${absenceNote} No same-period ShortTermBorrowings or finance-lease liability fact was present.`,
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
      derivation: 'No non-overlapping SEC total-debt aggregate or complete reconciled debt family was available for this quarter.',
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
