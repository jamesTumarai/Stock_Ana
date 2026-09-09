import { fetchSecVerifiedIntegrationPackage } from '../src/services/sec/secIntegration';
import { compareSecCanonicalToReport } from '../src/services/sec/secReportComparison';
import { SecDataError } from '../src/services/sec/secClient';

const normalizeTicker = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : '';
const validTicker = (ticker: string) => /^[A-Z0-9.-]{1,12}$/.test(ticker);

const requireSecConfiguration = (res: any) => {
  if (process.env.SEC_USER_AGENT?.trim()) return true;
  res.status(503).json({
    error: 'SEC_USER_AGENT is not configured on the server.',
    code: 'SEC_USER_AGENT_MISSING',
    secConfigured: false,
  });
  return false;
};

const secErrorResponse = (res: any, error: unknown, route: string) => {
  if (error instanceof SecDataError) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 503;
    return res.status(status).json({
      error: error.message,
      code: error.code,
      secConfigured: true,
    });
  }
  console.error(`[${route}] Unexpected error:`, error);
  return res.status(500).json({ error: 'Unexpected SEC diagnostics error.', code: 'SEC_PREVIEW_ERROR' });
};

export async function handleSecPreview(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireSecConfiguration(res)) return;

  const url = new URL(req.url || '/api/sec-preview', 'http://localhost');
  const ticker = normalizeTicker(url.searchParams.get('ticker') || url.searchParams.get('symbol'));
  if (!ticker || !validTicker(ticker)) {
    return res.status(400).json({ error: 'Missing or invalid ticker.', code: 'INVALID_TICKER' });
  }

  try {
    const pkg = await fetchSecVerifiedIntegrationPackage(ticker);
    return res.status(200).json({
      ok: true,
      ticker: pkg.ticker,
      retrievedAt: pkg.retrievedAt,
      secConfigured: true,
      periods: pkg.canonicalFinancials?.periods ?? [],
      sourceCoverage: pkg.canonicalFinancials?.sourceCoverage ?? null,
      provenanceStatus: pkg.canonicalFinancials?.provenanceStatus ?? null,
      provenanceWarnings: pkg.canonicalFinancials?.provenanceWarnings ?? [],
      dcfCoverage: pkg.dcfCoverage,
      shareSnapshot: pkg.shareSnapshot ? {
        currentCommonSharesOutstandingM: pkg.shareSnapshot.currentCommonSharesOutstanding?.sharesM ?? null,
        currentSharesAsOf: pkg.shareSnapshot.currentCommonSharesOutstanding?.end ?? null,
        dilutedWeightedAverageSharesM: pkg.shareSnapshot.latestDilutedWeightedAverageShares?.sharesM ?? null,
        dilutedSharesPeriodEnd: pkg.shareSnapshot.latestDilutedWeightedAverageShares?.end ?? null,
        fullyDilutedSharesM: pkg.shareSnapshot.fullyDilutedSharesM,
        verification: pkg.shareSnapshot.verification,
        caveats: pkg.shareSnapshot.caveats,
      } : null,
      latestStatementsSource: pkg.financialStatements?.source ?? null,
    });
  } catch (error) {
    return secErrorResponse(res, error, '/api/sec-preview');
  }
}

const parseBody = (body: unknown) => {
  if (typeof body !== 'string') return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

/**
 * Compares an already-generated report's legacy financial statement arrays against independently
 * retrieved SEC canonical values. Diagnostic only: this endpoint never mutates or replaces report
 * values and never accepts AI-supplied provenance as SEC verification.
 */
export async function handleSecCompare(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireSecConfiguration(res)) return;

  const body = parseBody(req.body);
  const ticker = normalizeTicker(body.ticker);
  const financialStatements = body.financial_statements;
  if (!ticker || !validTicker(ticker)) {
    return res.status(400).json({ error: 'Missing or invalid ticker.', code: 'INVALID_TICKER' });
  }
  if (!financialStatements || typeof financialStatements !== 'object' || !Array.isArray((financialStatements as any).periods)) {
    return res.status(400).json({
      error: 'financial_statements with a periods array is required.',
      code: 'INVALID_FINANCIAL_STATEMENTS',
    });
  }

  try {
    const pkg = await fetchSecVerifiedIntegrationPackage(ticker);
    const comparison = compareSecCanonicalToReport(pkg.canonicalFinancials, {
      ticker,
      financial_statements: financialStatements as any,
    });

    return res.status(200).json({
      ok: true,
      ticker: pkg.ticker,
      retrievedAt: pkg.retrievedAt,
      secConfigured: true,
      comparison,
      dcfCoverage: pkg.dcfCoverage,
      provenanceStatus: pkg.canonicalFinancials?.provenanceStatus ?? null,
      provenanceWarnings: pkg.canonicalFinancials?.provenanceWarnings ?? [],
      latestStatementsSource: pkg.financialStatements?.source ?? null,
      mutationApplied: false,
    });
  } catch (error) {
    return secErrorResponse(res, error, '/api/sec-compare');
  }
}
