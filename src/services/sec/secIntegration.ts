import type { CanonicalFinancialDataset } from '../../domain/financialValue';
import type { FinancialStatementsData } from '../../types';
import { createSecEdgarClientFromEnv, type SecEdgarClient } from './secClient';
import { attachVerifiedTotalDebtFromSec } from './secDebtResolver';
import { mapSecBundleToCanonicalFinancials, type SecCompanyBundleLike } from './secFinancialMapper';
import { adaptSecCanonicalToFinancialStatements, assessSecDcfCoverage, type SecDcfCoverageAssessment } from './secLegacyAdapter';
import { buildSecShareSnapshot, type SecShareSnapshot } from './secShareSnapshot';

export interface SecVerifiedIntegrationPackage {
  ticker: string;
  canonicalFinancials: CanonicalFinancialDataset | null;
  financialStatements: FinancialStatementsData | null;
  shareSnapshot: SecShareSnapshot | null;
  dcfCoverage: SecDcfCoverageAssessment;
  retrievedAt?: string;
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
      ticker: '',
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: null,
      dcfCoverage: unavailableCoverage('SEC_COMPANY_BUNDLE_UNAVAILABLE', 'SEC company bundle is unavailable.'),
    };
  }

  const mapped = mapSecBundleToCanonicalFinancials(bundle);
  if (!mapped) {
    return {
      ticker: bundle.identity.ticker,
      canonicalFinancials: null,
      financialStatements: null,
      shareSnapshot: buildSecShareSnapshot(bundle.identity, bundle.submissions, bundle.companyFacts, bundle.retrievedAt),
      dcfCoverage: unavailableCoverage('SEC_CANONICAL_MAPPING_UNAVAILABLE', 'SEC company facts could not be mapped into canonical financials.'),
      retrievedAt: bundle.retrievedAt,
    };
  }

  const canonicalFinancials = attachVerifiedTotalDebtFromSec(mapped, bundle);
  const shareSnapshot = buildSecShareSnapshot(bundle.identity, bundle.submissions, bundle.companyFacts, bundle.retrievedAt);
  const financialStatements = adaptSecCanonicalToFinancialStatements(canonicalFinancials);
  const dcfCoverage = assessSecDcfCoverage(canonicalFinancials, shareSnapshot);

  return {
    ticker: bundle.identity.ticker,
    canonicalFinancials,
    financialStatements,
    shareSnapshot,
    dcfCoverage,
    retrievedAt: bundle.retrievedAt,
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
  return buildSecVerifiedIntegrationPackage(bundle);
}
