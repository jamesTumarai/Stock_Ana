import type { FinancialSourceMetadata } from '../../domain/financialValue';
import type {
  SecCompanyFact,
  SecCompanyFactsResponse,
  SecSubmissionsResponse,
  SecTickerRecord,
} from './secClient';

export interface SecReportedShareValue {
  sharesM: number;
  start?: string;
  end: string;
  filed?: string;
  fiscalYear?: number;
  fiscalPeriod?: string;
  source: FinancialSourceMetadata;
}

export interface SecShareSnapshot {
  ticker: string;
  currentCommonSharesOutstanding: SecReportedShareValue | null;
  latestDilutedWeightedAverageShares: SecReportedShareValue | null;
  /**
   * Fully diluted/current economic shares require option, RSU, convertible and treasury-stock
   * treatment. SEC companyfacts alone is not sufficient, so Lumina must not synthesize it.
   */
  fullyDilutedSharesM: null;
  verification: 'verified' | 'partial' | 'unavailable';
  caveats: string[];
  retrievedAt: string;
}

const VALID_FORMS = new Set(['10-Q', '10-Q/A', '10-K', '10-K/A']);
const finitePositive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const dateRank = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
};

const validShareFact = (fact: SecCompanyFact) =>
  finitePositive(fact.val)
  && typeof fact.end === 'string'
  && (!fact.form || VALID_FORMS.has(fact.form));

const latestByAsOfThenFiled = (facts: SecCompanyFact[]) => [...facts]
  .filter(validShareFact)
  .sort((a, b) => dateRank(b.end) - dateRank(a.end) || dateRank(b.filed) - dateRank(a.filed))[0];

const latestDurationByEndThenFiled = (facts: SecCompanyFact[]) => [...facts]
  .filter(fact => validShareFact(fact) && typeof fact.start === 'string')
  .sort((a, b) => dateRank(b.end) - dateRank(a.end) || dateRank(b.filed) - dateRank(a.filed))[0];

const submissionDocumentMap = (identity: SecTickerRecord, submissions: SecSubmissionsResponse) => {
  const recent = submissions.filings?.recent;
  const accessions = recent?.accessionNumber;
  const primaryDocuments = recent?.primaryDocument;
  const forms = recent?.form;
  const filingDates = recent?.filingDate;
  const map = new Map<string, { documentUrl?: string; form?: string; filingDate?: string }>();
  if (!Array.isArray(accessions)) return map;

  const cikNoLeadingZeros = String(Number(identity.cik));
  accessions.forEach((rawAccession, index) => {
    if (typeof rawAccession !== 'string' || !rawAccession) return;
    const accessionNoDashes = rawAccession.replace(/-/g, '');
    const primaryDocument = Array.isArray(primaryDocuments) && typeof primaryDocuments[index] === 'string'
      ? primaryDocuments[index] as string
      : undefined;
    map.set(rawAccession, {
      documentUrl: primaryDocument
        ? `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${primaryDocument}`
        : undefined,
      form: Array.isArray(forms) && typeof forms[index] === 'string' ? forms[index] as string : undefined,
      filingDate: Array.isArray(filingDates) && typeof filingDates[index] === 'string' ? filingDates[index] as string : undefined,
    });
  });
  return map;
};

const toReportedShareValue = (
  fact: SecCompanyFact | undefined,
  identity: SecTickerRecord,
  submissions: SecSubmissionsResponse,
  retrievedAt: string,
  taxonomy: 'dei' | 'us-gaap',
  concept: string,
): SecReportedShareValue | null => {
  if (!fact || !finitePositive(fact.val) || !fact.end) return null;
  const filings = submissionDocumentMap(identity, submissions);
  const filing = fact.accn ? filings.get(fact.accn) : undefined;
  return {
    sharesM: fact.val / 1_000_000,
    start: fact.start,
    end: fact.end,
    filed: filing?.filingDate ?? fact.filed,
    fiscalYear: fact.fy,
    fiscalPeriod: fact.fp,
    source: {
      provider: 'SEC EDGAR XBRL',
      documentUrl: filing?.documentUrl,
      documentType: filing?.form ?? fact.form,
      filingDate: filing?.filingDate ?? fact.filed,
      periodEnd: fact.end,
      accessionNumber: fact.accn,
      retrievedAt,
      taxonomy,
      concept,
    } as FinancialSourceMetadata,
  };
};

/**
 * Extracts share counts without conflating three different concepts:
 * - current common shares outstanding: point-in-time DEI cover-page fact
 * - diluted weighted-average shares: income-statement denominator over a disclosed duration
 * - fully diluted current shares: intentionally unavailable until award/convertible dilution is modeled
 */
export function buildSecShareSnapshot(
  identity: SecTickerRecord,
  submissions: SecSubmissionsResponse,
  companyFacts: SecCompanyFactsResponse,
  retrievedAt: string,
): SecShareSnapshot {
  const currentFacts = companyFacts.facts?.dei?.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  const dilutedFacts = companyFacts.facts?.['us-gaap']?.WeightedAverageNumberOfDilutedSharesOutstanding?.units?.shares ?? [];

  const current = toReportedShareValue(
    latestByAsOfThenFiled(currentFacts),
    identity,
    submissions,
    retrievedAt,
    'dei',
    'EntityCommonStockSharesOutstanding',
  );
  const diluted = toReportedShareValue(
    latestDurationByEndThenFiled(dilutedFacts),
    identity,
    submissions,
    retrievedAt,
    'us-gaap',
    'WeightedAverageNumberOfDilutedSharesOutstanding',
  );

  const verification: SecShareSnapshot['verification'] = current && diluted
    ? 'verified'
    : current || diluted
      ? 'partial'
      : 'unavailable';

  return {
    ticker: identity.ticker,
    currentCommonSharesOutstanding: current,
    latestDilutedWeightedAverageShares: diluted,
    fullyDilutedSharesM: null,
    verification,
    caveats: [
      'Current common shares outstanding is a point-in-time DEI cover-page fact and may be dated after the financial statement period end.',
      'Diluted weighted-average shares is a period denominator and must not be treated as current shares outstanding.',
      'Fully diluted current shares are unavailable until options, RSUs, convertibles and treasury-stock effects are modeled from authoritative disclosures.',
    ],
    retrievedAt,
  };
}
