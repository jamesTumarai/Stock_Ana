import type {
  SecDcfCoverageEnvelope,
  SecDcfFinancialInputsEnvelope,
  SecVerificationEnvelope,
  SecVerificationIssue,
} from '../domain/secVerification';

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const finiteOrNull = (value: unknown): number | null => finite(value) ? value : null;
const textOrNull = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

const issueArray = (value: unknown): SecVerificationIssue[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!isRecord(item)) return [];
    const code = typeof item.code === 'string' ? item.code : '';
    const field = typeof item.field === 'string' ? item.field : '';
    const message = typeof item.message === 'string' ? item.message : '';
    return code && message ? [{ code, field, message }] : [];
  });
};

const warningArray = (value: unknown): SecVerificationEnvelope['provenance_warnings'] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!isRecord(item)) return [];
    const code = typeof item.code === 'string' ? item.code : '';
    const severity = typeof item.severity === 'string' ? item.severity : 'info';
    const message = typeof item.message === 'string' ? item.message : '';
    return code && message ? [{ code, severity, message }] : [];
  });
};

const normalizeCoverage = (value: unknown): SecDcfCoverageEnvelope | null => {
  if (!isRecord(value)) return null;
  return {
    eligible: value.eligible === true,
    periods: Array.isArray(value.periods) ? value.periods.filter((item: unknown): item is string => typeof item === 'string') : [],
    current_shares_outstanding_m: finiteOrNull(value.currentSharesOutstandingM),
    issues: issueArray(value.issues),
  };
};

const roughlyEqual = (left: number, right: number) => {
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) <= scale * 1e-8;
};

const normalizeDcfInputs = (value: unknown, expectedTicker: string): SecDcfFinancialInputsEnvelope | null => {
  if (!isRecord(value)) return null;

  const issues = issueArray(value.issues);
  const ticker = typeof value.ticker === 'string' ? value.ticker.trim().toUpperCase() : '';
  const periods = Array.isArray(value.periods)
    ? value.periods.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  const clean: SecDcfFinancialInputsEnvelope = {
    version: finite(value.version) ? value.version : 0,
    generated_by: 'sec-verified-financial-inputs-v1',
    eligible: false,
    ticker,
    periods,
    source_period: textOrNull(value.sourcePeriod),
    latest_balance_sheet_period_end: textOrNull(value.latestBalanceSheetPeriodEnd),
    share_as_of: textOrNull(value.shareAsOf),
    starting_revenue_m: finiteOrNull(value.startingRevenueM),
    trailing_four_free_cash_flow_m: finiteOrNull(value.trailingFourFreeCashFlowM),
    historical_fcf_margin_pct: finiteOrNull(value.historicalFcfMarginPct),
    cash_and_equivalents_m: finiteOrNull(value.cashAndEquivalentsM),
    short_term_investments_m: finiteOrNull(value.shortTermInvestmentsM),
    total_debt_m: finiteOrNull(value.totalDebtM),
    net_cash_m: finiteOrNull(value.netCashM),
    current_shares_outstanding_m: finiteOrNull(value.currentSharesOutstandingM),
    issues,
  };

  const runtimeProblems: string[] = [];
  if (value.generatedBy !== 'sec-verified-financial-inputs-v1' || clean.version !== 1) {
    runtimeProblems.push('unsupported SEC DCF input generator/version');
  }
  if (!ticker || ticker !== expectedTicker) runtimeProblems.push('ticker mismatch');
  if (periods.length !== 4) runtimeProblems.push('four verified fiscal quarters required');
  if (clean.starting_revenue_m === null || clean.starting_revenue_m <= 0) runtimeProblems.push('starting revenue unavailable');
  if (clean.trailing_four_free_cash_flow_m === null) runtimeProblems.push('trailing-four-quarter FCF unavailable');
  if (clean.cash_and_equivalents_m === null) runtimeProblems.push('cash unavailable');
  if (clean.short_term_investments_m === null) runtimeProblems.push('short-term investments unavailable');
  if (clean.total_debt_m === null) runtimeProblems.push('total debt unavailable');
  if (clean.net_cash_m === null) runtimeProblems.push('net cash unavailable');
  if (clean.current_shares_outstanding_m === null || clean.current_shares_outstanding_m <= 0) runtimeProblems.push('current shares unavailable');
  if (!clean.latest_balance_sheet_period_end) runtimeProblems.push('balance-sheet period end unavailable');

  if (
    clean.cash_and_equivalents_m !== null
    && clean.short_term_investments_m !== null
    && clean.total_debt_m !== null
    && clean.net_cash_m !== null
    && !roughlyEqual(
      clean.cash_and_equivalents_m + clean.short_term_investments_m - clean.total_debt_m,
      clean.net_cash_m,
    )
  ) {
    runtimeProblems.push('net cash does not reconcile');
  }

  if (value.eligible === true && runtimeProblems.length > 0) {
    clean.issues.push({
      code: 'SEC_CLIENT_RUNTIME_VALIDATION_FAILED',
      field: 'dcfFinancialInputs',
      message: `SEC DCF input envelope failed client runtime validation: ${runtimeProblems.join('; ')}.`,
    });
  }

  clean.eligible = value.eligible === true && runtimeProblems.length === 0 && clean.issues.length === 0;
  return clean;
};

const unavailableEnvelope = (ticker: string, code: string, message: string): SecVerificationEnvelope => ({
  status: 'unavailable',
  ticker,
  retrieved_at: null,
  provenance_status: null,
  provenance_warnings: [],
  dcf_coverage: null,
  dcf_financial_inputs: null,
  latest_statements_source: null,
  error: { code, message },
});

/**
 * Fetches the same-origin SEC diagnostics endpoint in parallel with AI research and stores only a
 * compact, runtime-validated verification envelope on the report. This function never fabricates
 * missing SEC data and never upgrades a partial server response to eligible on the client.
 */
export async function fetchSecVerificationEnvelope(
  ticker: string,
  parentSignal?: AbortSignal,
): Promise<SecVerificationEnvelope | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  const abortFromParent = () => controller.abort();
  parentSignal?.addEventListener('abort', abortFromParent, { once: true });

  try {
    const response = await fetch(`/api/sec-preview?ticker=${encodeURIComponent(normalizedTicker)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // handled below as unavailable
    }

    if (!response.ok || !isRecord(body)) {
      const code = isRecord(body) && typeof body.code === 'string' ? body.code : `SEC_HTTP_${response.status}`;
      const message = isRecord(body) && typeof body.error === 'string'
        ? body.error
        : 'SEC verification endpoint was unavailable for this analysis.';
      return unavailableEnvelope(normalizedTicker, code, message);
    }

    const responseTicker = typeof body.ticker === 'string' ? body.ticker.trim().toUpperCase() : '';
    if (responseTicker !== normalizedTicker) {
      return unavailableEnvelope(normalizedTicker, 'SEC_RESPONSE_TICKER_MISMATCH', 'SEC verification response ticker did not match the requested ticker.');
    }

    const dcfCoverage = normalizeCoverage(body.dcfCoverage);
    const dcfFinancialInputs = normalizeDcfInputs(body.dcfFinancialInputs, normalizedTicker);
    const latestSource = isRecord(body.latestStatementsSource) ? {
      document_url: typeof body.latestStatementsSource.document_url === 'string' ? body.latestStatementsSource.document_url : undefined,
      document_type: typeof body.latestStatementsSource.document_type === 'string' ? body.latestStatementsSource.document_type : undefined,
      filing_date: typeof body.latestStatementsSource.filing_date === 'string' ? body.latestStatementsSource.filing_date : undefined,
      period_end: typeof body.latestStatementsSource.period_end === 'string' ? body.latestStatementsSource.period_end : undefined,
      units: typeof body.latestStatementsSource.units === 'string' ? body.latestStatementsSource.units : undefined,
    } : null;

    const provenanceStatus = textOrNull(body.provenanceStatus);
    const eligible = Boolean(dcfCoverage?.eligible && dcfFinancialInputs?.eligible);
    const secPeriodStatements = Array.isArray(body.secPeriodStatements)
      ? (body.secPeriodStatements as any[])
      : undefined;
    const historicalAnnualFacts = Array.isArray(body.historicalAnnualFacts)
      ? body.historicalAnnualFacts.flatMap((item: unknown) => {
          if (!isRecord(item) || item.metric !== 'revenue' || item.verification !== 'verified') return [];
          if (!finite(item.fiscal_year) || !finite(item.value) || typeof item.period_end !== 'string' || typeof item.definition !== 'string') return [];
          return [{
            metric: 'revenue' as const,
            fiscal_year: item.fiscal_year,
            period: typeof item.period === 'string' ? item.period : `FY${item.fiscal_year}`,
            period_end: item.period_end,
            value: item.value,
            unit: 'USD_M' as const,
            definition: item.definition,
            source_document: typeof item.source_document === 'string' ? item.source_document : null,
            source_url: typeof item.source_url === 'string' ? item.source_url : null,
            accession: typeof item.accession === 'string' ? item.accession : null,
            filed_date: typeof item.filed_date === 'string' ? item.filed_date : null,
            verification: 'verified' as const,
          }];
        })
      : undefined;

    return {
      status: eligible ? 'verified_eligible' : provenanceStatus === 'verified' ? 'verified_partial' : 'unavailable',
      ticker: normalizedTicker,
      retrieved_at: textOrNull(body.retrievedAt),
      provenance_status: provenanceStatus,
      provenance_warnings: warningArray(body.provenanceWarnings),
      dcf_coverage: dcfCoverage,
      dcf_financial_inputs: dcfFinancialInputs,
      latest_statements_source: latestSource,
      sec_period_statements: secPeriodStatements,
      historical_annual_facts: historicalAnnualFacts,
    };
  } catch (error: any) {
    if (parentSignal?.aborted) return null;
    const code = error?.name === 'AbortError' ? 'SEC_VERIFICATION_TIMEOUT' : 'SEC_VERIFICATION_FETCH_FAILED';
    return unavailableEnvelope(normalizedTicker, code, error?.name === 'AbortError'
      ? 'SEC verification timed out; no SEC values were substituted.'
      : 'SEC verification request failed; no SEC values were substituted.');
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}
