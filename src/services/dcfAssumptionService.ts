import type { DCFModel, ReportData } from '../types';
import type { SecVerificationEnvelope } from '../domain/secVerification';
import { validateDcfAssumptionModel } from '../utils/valuation/dcfAssumptionProposal';
import { authenticatedFetch } from './authenticatedFetch';

const text = (value: unknown, max = 1800) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

export async function fetchDcfAssumptionProposal(
  ticker: string,
  report: Partial<ReportData>,
  secVerification: SecVerificationEnvelope | null | undefined,
  signal?: AbortSignal,
): Promise<DCFModel | null> {
  const sec = secVerification?.dcf_financial_inputs;
  if (secVerification?.status !== 'verified_eligible' || !sec?.eligible) return null;

  const profile = report.company_profile as any;
  const comprehensive = report.comprehensive_analysis as any;
  const businessContext = [
    text(profile?.description),
    text(comprehensive?.business_overview),
    text(comprehensive?.revenue_model),
    text(comprehensive?.future_growth),
    text(comprehensive?.key_risks),
  ].filter(Boolean).join('\n\n').slice(0, 7000);

  try {
    const response = await authenticatedFetch('/api/dcf-assumptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticker: ticker.trim().toUpperCase(),
        companyName: text(profile?.company_name, 200) || text((report as any).company_name, 200) || ticker.trim().toUpperCase(),
        businessContext,
        verifiedFinancialContext: {
          sourcePeriod: sec.source_period,
          startingRevenueM: sec.starting_revenue_m,
          trailingFourFreeCashFlowM: sec.trailing_four_free_cash_flow_m,
          historicalFcfMarginPct: sec.historical_fcf_margin_pct,
        },
      }),
      signal,
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return validateDcfAssumptionModel(payload?.dcf_model);
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw error;
    console.warn('[dcf-assumptions] Assumption proposal unavailable; valuation will fail closed.', error);
    return null;
  }
}
