import { fetchSecVerifiedIntegrationPackage } from '../src/services/sec/secIntegration';
import { SecDataError } from '../src/services/sec/secClient';

const normalizeTicker = (value: unknown) => typeof value === 'string' ? value.trim().toUpperCase() : '';
const validTicker = (ticker: string) => /^[A-Z0-9.-]{1,12}$/.test(ticker);

export async function handleSecPreview(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.SEC_USER_AGENT?.trim()) {
    return res.status(503).json({
      error: 'SEC_USER_AGENT is not configured on the server.',
      code: 'SEC_USER_AGENT_MISSING',
      secConfigured: false,
    });
  }

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
    if (error instanceof SecDataError) {
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 503;
      return res.status(status).json({
        error: error.message,
        code: error.code,
        secConfigured: true,
      });
    }
    console.error('[/api/sec-preview] Unexpected error:', error);
    return res.status(500).json({ error: 'Unexpected SEC diagnostics error.', code: 'SEC_PREVIEW_ERROR' });
  }
}
