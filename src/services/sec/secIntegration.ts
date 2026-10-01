import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import type { FinancialStatementsData } from '../../types';
import { reconcileVerifiedDataset } from '../../domain/verifiedFinancialStatements';
import { attachDebtFromVerifiedFilingPresentation } from './secFilingPresentation';
import { createSecEdgarClientFromEnv, type SecEdgarClient } from './secClient';
import { buildSecCoverageDiagnostics, type SecCoverageDiagnostics } from './secCoverageDiagnostics';
import { attachVerifiedTotalDebtFromSec } from './secDebtResolver';
import { mapSecBundleToCanonicalFinancials, type SecCompanyBundleLike } from './secFinancialMapper';
import { attachVerifiedShortTermInvestmentsFromSec } from './secInvestmentResolver';
import { adaptSecCanonicalToFinancialStatements, assessSecDcfCoverage, type SecDcfCoverageAssessment } from './secLegacyAdapter';
import { buildSecShareSnapshot, type SecShareSnapshot } from './secShareSnapshot';
import { completeBundleFromInlineStatements, attachCompletionAudit, attachReportedEarningsTableFacts, attachExactCashFlowBalances, suppressCompletionConflicts, attachRedeemableNciPresentation } from './secStatementCompletion';
import { mapVerifiedForeignAnnualStatements } from './secForeignStatements';
import { calculateVerifiedKeyIndicators } from '../../domain/verifiedKeyIndicators';
import { validateFinancialStatements } from '../../utils/statementValidator';
import { finalizeResolutionAudit, unavailableResolutionAudit, type CanonicalResolutionAudit } from './canonicalResolutionAudit';
import { attachVerifiedOperatingSegments } from './secOperatingSegments';
import { attachSecResearchEvidence } from './secResearchEvidence';
import { attachCommonEquityFromVerifiedPresentation } from './secCommonEquityPresentation';

export interface SecVerifiedIntegrationPackage {
  resolutionAudit?: CanonicalResolutionAudit;
  ticker: string;
  canonicalFinancials: CanonicalFinancialDataset | null;
  financialStatements: FinancialStatementsData | null;
  shareSnapshot: SecShareSnapshot | null;
  dcfCoverage: SecDcfCoverageAssessment;
  coverageDiagnostics?: SecCoverageDiagnostics;
  retrievedAt?: string;
  sourceBundle?: SecCompanyBundleLike;
}

const unavailableCoverage = (code: string, message: string): SecDcfCoverageAssessment => ({
  eligible: false,
  periods: [],
  currentSharesOutstandingM: null,
  issues: [{ code, field: 'canonical_financials', message }],
});

/**
 * Pure composition step used by tests and by the future Analyze integration boundary.
 * No AI/report values are allowed into this package.
 */
export function buildSecVerifiedIntegrationPackage(
  bundle: SecCompanyBundleLike | null | undefined,
): SecVerifiedIntegrationPackage {
  if (!bundle) {
    return {
      resolutionAudit: unavailableResolutionAudit('SOURCE_FETCH_FAILED'),
      ticker: '',
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: unavailableCoverage('SEC_COMPANY_BUNDLE_UNAVAILABLE', 'SEC company bundle is unavailable.'),
    };
  }

  const coverageDiagnostics = buildSecCoverageDiagnostics(bundle);
  const initialMapped = mapSecBundleToCanonicalFinancials(bundle) || mapVerifiedForeignAnnualStatements(bundle);
  bundle = initialMapped?.currency==='USD' && bundle.filingDocuments?.length ? completeBundleFromInlineStatements(bundle,initialMapped) : bundle;
  const mapped = bundle.filingDocuments?.length ? mapSecBundleToCanonicalFinancials(bundle) || mapVerifiedForeignAnnualStatements(bundle) : initialMapped;
  if (!mapped) {
    return {
      resolutionAudit: unavailableResolutionAudit(Object.keys(bundle.companyFacts.facts?.['us-gaap'] || {}).length ? 'PERIOD_NOT_RESOLVED' : 'NO_SEMANTIC_MAPPING'),
      ticker: bundle.identity.ticker,
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: buildSecShareSnapshot(bundle.identity, bundle.submissions, bundle.companyFacts, bundle.retrievedAt),
      dcfCoverage: unavailableCoverage('SEC_CANONICAL_MAPPING_UNAVAILABLE', 'SEC company facts could not be mapped into canonical financials.'),
      coverageDiagnostics,
      retrievedAt: bundle.retrievedAt,
      sourceBundle: bundle,
    };
  }

  const withInvestments = attachVerifiedShortTermInvestmentsFromSec(attachCommonEquityFromVerifiedPresentation(mapped,bundle), bundle);
  const reconciled = reconcileVerifiedDataset(suppressCompletionConflicts(attachReportedEarningsTableFacts(attachDebtFromVerifiedFilingPresentation(attachVerifiedTotalDebtFromSec(withInvestments, bundle), bundle),bundle),bundle));
  const canonicalFinancials = reconciled ? attachSecResearchEvidence(attachVerifiedOperatingSegments(attachCompletionAudit(attachExactCashFlowBalances(attachRedeemableNciPresentation(reconciled,bundle),bundle),bundle),bundle),bundle) : null;
  const shareSnapshot = buildSecShareSnapshot(bundle.identity, bundle.submissions, bundle.companyFacts, bundle.retrievedAt);
  if(canonicalFinancials)canonicalFinancials.commonShareObservations=shareSnapshot.historicalCommonSharesOutstanding;
  const financialStatements = adaptSecCanonicalToFinancialStatements(canonicalFinancials);
  // SEC industrial classification supplies a source-backed template when standard facts lack custom sector KPIs.
  const sic=Number(bundle.submissions.sic);
  if(financialStatements&&sic===6798) {
    financialStatements.statement_template='reit';
    financialStatements.validation_summary=validateFinancialStatements(financialStatements,'reit');
    financialStatements.indicator_details=calculateVerifiedKeyIndicators(financialStatements);
  }

  // Independent source packages cannot mix a ticker's filing identity with a
  // different CIK's company facts, including a stale cache from another issuer.
  const expectedCik = Number(bundle.identity.cik);
  if ((bundle.companyFacts.cik != null && Number(bundle.companyFacts.cik) !== expectedCik)
    || (bundle.submissions.cik != null && Number(bundle.submissions.cik) !== expectedCik)) {
    return { ticker: bundle.identity.ticker, canonicalFinancials: null, financialStatements: null, shareSnapshot: null,
      dcfCoverage: unavailableCoverage('SEC_COMPANY_IDENTITY_MISMATCH', 'Source CIK differs from the resolved company identity.'),
      retrievedAt: bundle.retrievedAt };
  }
  const dcfCoverage = assessSecDcfCoverage(canonicalFinancials, shareSnapshot);
  if (canonicalFinancials) finalizeResolutionAudit(canonicalFinancials, financialStatements?.statement_template || 'unclassified');
  if (canonicalFinancials?.resolutionAudit) canonicalFinancials.resolutionAudit.sourceFailureCount=bundle.completionAttempts?.filter(a=>a.status==='unavailable').length || 0;

  return {
    resolutionAudit: canonicalFinancials?.resolutionAudit,
    ticker: bundle.identity.ticker,
    canonicalFinancials,
    financialStatements,
    shareSnapshot,
    dcfCoverage,
    coverageDiagnostics,
    retrievedAt: bundle.retrievedAt,
    sourceBundle: bundle,
  };
}

/**
 * Live server-side SEC fetch. SEC client errors intentionally propagate so callers can surface
 * `unavailable` rather than silently falling back to fabricated or AI-derived filing values.
 */
export async function fetchSecVerifiedIntegrationPackage(
  ticker: string,
  client: SecEdgarClient = createSecEdgarClientFromEnv(),
): Promise<SecVerifiedIntegrationPackage> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) {
    return {
      ticker: '',
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: unavailableCoverage('SEC_TICKER_REQUIRED', 'Ticker is required for SEC retrieval.'),
    };
  }
  const bundle = await client.fetchCompanyBundle(normalizedTicker);
  if (!bundle) {
    return {
      ticker: normalizedTicker,
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: unavailableCoverage('SEC_TICKER_NOT_FOUND', `SEC ticker mapping was not found for ${normalizedTicker}.`),
    };
  }
  const initial = buildSecVerifiedIntegrationPackage(bundle);
  const dataset = initial.canonicalFinancials;
  if (!dataset) return initial;
  const documents: NonNullable<SecCompanyBundleLike['filingDocuments']> = [];
  const attempts: NonNullable<SecCompanyBundleLike['completionAttempts']> = [];
  const recent = bundle.submissions.filings?.recent;
  const relevantEnds = new Set(Object.values(dataset.values).flat().map(v => v.periodEnd));
  const sources = new Map<string, {documentUrl:string;accession:string;form:string;filingDate?:string}>();
  // A sparse companyfacts package cannot enumerate its missing quarters. Retrieve
  // bounded recent primary filings too, so standalone/YTD predecessors can be
  // resolved from their own DEI focus rather than only already-mapped cells.
  const recentPrimary=(recent?.accessionNumber||[]).map((acc,i)=>({acc,i})).filter(({i})=>['10-Q','10-Q/A','10-K','10-K/A'].includes(String(recent?.form?.[i]))).slice(0,8);
  for (const {acc,i} of recentPrimary) {
    const name=String(recent?.primaryDocument?.[i]||'');
    if(!/^[a-zA-Z0-9_.-]+\.html?$/i.test(name)||!/^\d{10}-\d{2}-\d{6}$/.test(String(acc))) continue;
    const url=`https://www.sec.gov/Archives/edgar/data/${Number(bundle.identity.cik)}/${String(acc).replace(/-/g,'')}/${name}`;
    sources.set(url,{documentUrl:url,accession:String(acc),form:String(recent?.form?.[i]),filingDate:String(recent?.filingDate?.[i])});
  }
  // Retrieve each relevant filing cohort, rather than only the latest missing debt cell.
  for (const v of Object.values(dataset.values).flat()) {
    if (!relevantEnds.has(v.periodEnd) || !v.source?.documentUrl || !v.accession || !v.form?.match(/^(10-K|10-Q|20-F|6-K)/)) continue;
    sources.set(v.source.documentUrl,{documentUrl:v.source.documentUrl,accession:v.accession,form:v.form,filingDate:v.source.filingDate});
  }
  for (const source of [...sources.values()].sort((a,b)=>(b.filingDate||'').localeCompare(a.filingDate||'')).slice(0,20)) {
    if (documents.some(d => d.documentUrl === source.documentUrl)) continue;
    try {
      let documentUrl=source.documentUrl;
      if(/-index\.html?$/.test(documentUrl)) {
        const base=documentUrl.slice(0,documentUrl.lastIndexOf('/')+1),indexUrl=base+'index.json';
        const index=await client.fetchJson<{directory?:{item?:Array<{name?:string}>}}>(indexUrl);
        attempts.push({documentUrl:indexUrl,status:'retrieved'});
        const primary=(index.directory?.item||[]).map(i=>i.name||'').filter(n=>/^[a-zA-Z0-9_.-]+\.html?$/i.test(n)&&!/(?:index|exhibit|ex[-_]?(?:10|21|23|31|32|99))/i.test(n));
        if(primary.length!==1) {attempts.push({documentUrl:indexUrl,status:'unavailable',reasonCode:'PRIMARY_DOCUMENT_NOT_UNAMBIGUOUS'});continue;}
        documentUrl=base+primary[0];
      }
      const html = await client.fetchFilingText(documentUrl);
      documents.push({...source,documentUrl,html}); attempts.push({documentUrl,status:'retrieved'});
    } catch { attempts.push({documentUrl:source.documentUrl,status:'unavailable',reasonCode:'SEC_PRIMARY_FETCH_FAILED'}); }
  }
  // EPS is non-additive. Earnings exhibits also supply disclosures missing from recent primary statements.
  const missingQ4 = dataset.periods.slice(-8).filter(p => /^Q4/.test(p) && dataset.values['income_statement.eps_diluted']?.find(v=>v.period===p)?.value == null);
  const recentGaps=dataset.periods.slice(-4).filter(p=>['income_statement.eps_diluted','balance_sheet.net_ppe','cash_flow.depreciation'].some(k=>dataset.values[k]?.find(v=>v.period===p)?.value==null));
  const searchedAccessions=new Set<string>();
  for (const period of [...new Set([...recentGaps,...missingQ4])]) {
    const end = Object.values(dataset.values).flat().find(v=>v.period===period&&v.periodEnd)?.periodEnd;
    if (!end || !recent) continue;
    const candidates = (recent.accessionNumber || []).map((acc,i)=>({acc,i})).filter(({i})=>
      ['8-K','6-K'].includes(String(recent.form?.[i])) && (String(recent.items?.[i]||'').includes('2.02') || recent.form?.[i]==='6-K') &&
      Date.parse(String(recent.filingDate?.[i]))>Date.parse(end) && Date.parse(String(recent.filingDate?.[i]))-Date.parse(end)<=75*86400000).slice(0,2);
    for(const {acc,i} of candidates) {
      if(searchedAccessions.has(String(acc))) continue;
      searchedAccessions.add(String(acc));
      const base=`https://www.sec.gov/Archives/edgar/data/${Number(bundle.identity.cik)}/${String(acc).replace(/-/g,'')}/`;
      const indexUrl=base+'index.json';
      try {
        const index=await client.fetchJson<{directory?:{item?:Array<{name?:string}>}}>(indexUrl);
        attempts.push({documentUrl:indexUrl,status:'retrieved'});
        const names=(index.directory?.item||[]).map(v=>v.name||'').filter(name=>/^[a-zA-Z0-9_.-]+\.html?$/i.test(name)&&/(?:ex(?:hibit)?[-_]?(?:99|991)|99[-_.]?1|earnings|results)/i.test(name)).slice(0,3);
        for(const name of names) {
          const documentUrl=base+name;
          try { const html=await client.fetchFilingText(documentUrl);documents.push({html,documentUrl,accession:String(acc),form:String(recent.form?.[i]),filingDate:String(recent.filingDate?.[i])});attempts.push({documentUrl,status:'retrieved'}); }
          catch {attempts.push({documentUrl,status:'unavailable',reasonCode:'SEC_EARNINGS_EXHIBIT_FETCH_FAILED'});}
        }
        if(!names.length) attempts.push({documentUrl:indexUrl,status:'unavailable',reasonCode:'EARNINGS_EXHIBIT_NOT_IDENTIFIED'});
      } catch {attempts.push({documentUrl:indexUrl,status:'unavailable',reasonCode:'SEC_EARNINGS_INDEX_FETCH_FAILED'});}
    }
  }
  return buildSecVerifiedIntegrationPackage({...bundle,filingDocuments:documents,completionAttempts:attempts});
}
