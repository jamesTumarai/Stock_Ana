import type { FinancialSourceMetadata } from '../../domain/financialValue';
import { hasDimensionalContext } from './xbrlNormalizer';
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
  historicalCommonSharesOutstanding?: SecReportedShareValue[];
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
  && !hasDimensionalContext(fact)
  && typeof fact.end === 'string'
  && (!fact.form || VALID_FORMS.has(fact.form));

const latestByAsOfThenFiled = (facts: SecCompanyFact[]) => {
  const ranked = [...facts].filter(validShareFact)
    .sort((a,b) => dateRank(b.end)-dateRank(a.end) || dateRank(b.filed)-dateRank(a.filed));
  const first = ranked[0];
  if (!first) return undefined;
  // Ambiguous class counts without dimensions must not become aggregate shares.
  // A later filed restatement is eligible; conflicting equally ranked facts are not.
  return ranked.some(f => f.end === first.end && f.filed === first.filed && f.val !== first.val) ? undefined : first;
};

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

  const coverFact = latestByAsOfThenFiled(currentFacts.filter(f => !f.start));
  // The standard dimensionless instant represents aggregate common shares;
  // it never substitutes a diluted weighted-average duration or class-only count.
  const balanceFact = latestByAsOfThenFiled((companyFacts.facts?.['us-gaap']?.CommonStockSharesOutstanding?.units?.shares ?? []).filter(f => !f.start));
  const useCover = !!coverFact && (!balanceFact || coverFact.end! >= balanceFact.end!);
  const candidate = toReportedShareValue(
    useCover ? coverFact : balanceFact,
    identity,
    submissions,
    retrievedAt,
    useCover ? 'dei' : 'us-gaap',
    useCover ? 'EntityCommonStockSharesOutstanding' : 'CommonStockSharesOutstanding',
  );
  const retrievedTime=Date.parse(retrievedAt);
  const recent=submissions.filings?.recent;
  const latestPeriodicEnd=(recent?.reportDate??[]).filter((date,index)=>
    typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)
    && ['10-Q','10-K','20-F','40-F'].includes(String(recent?.form?.[index]??''))
    && Date.parse(date)<=retrievedTime).sort().at(-1) as string|undefined;
  const asOf=candidate?Date.parse(candidate.end):NaN;
  // Old dimensionless counts (e.g. before class-specific reporting) remain
  // historical observations; they cannot become a current valuation denominator.
  const current=candidate&&Number.isFinite(retrievedTime)&&asOf<=retrievedTime+86_400_000
    && retrievedTime-asOf<=400*86_400_000
    && (!latestPeriodicEnd||asOf>=Date.parse(latestPeriodicEnd)-100*86_400_000)?candidate:null;
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
    historicalCommonSharesOutstanding: [...new Set(currentFacts.filter(f=>!f.start&&validShareFact(f)).map(f=>f.end!))].sort().flatMap(end=>{
      const value=toReportedShareValue(latestByAsOfThenFiled(currentFacts.filter(f=>!f.start&&f.end===end)),identity,submissions,retrievedAt,'dei','EntityCommonStockSharesOutstanding');
      return value?.source.documentUrl?[value]:[];
    }),
    currentCommonSharesOutstanding: current,
    latestDilutedWeightedAverageShares: diluted,
    fullyDilutedSharesM: null,
    verification,
    caveats: [
      'Current common shares outstanding uses a dimensionless DEI cover-page or standard CommonStockSharesOutstanding instant; cover dates may follow the statement end. Conflicting equally ranked counts are unavailable.',
      'A count older than the latest periodic statement by more than one quarter, older than 400 days at retrieval, or future-dated is not current. Historical counts are retained separately.',
      'Diluted weighted-average shares is a period denominator and must not be treated as current shares outstanding.',
      'Fully diluted current shares are unavailable until options, RSUs, convertibles and treasury-stock effects are modeled from authoritative disclosures.',
    ],
    retrievedAt,
  };
}
