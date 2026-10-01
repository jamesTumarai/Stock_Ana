import type { DCFModel, ReportData } from '../types';
import type { SecVerificationEnvelope } from '../domain/secVerification';
import { resolveDcfAssumptionFinancialContext, validateDcfAssumptionModel } from '../utils/valuation/dcfAssumptionProposal';
import { authenticatedFetch } from './authenticatedFetch';
import { resolveBusinessArchetype } from '../domain/financialMetricContext';
import { valuationMethodPolicy } from '../domain/valuation/adaptiveValuationPolicy';

const text = (value: unknown, max = 1800) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;

export async function fetchDcfAssumptionProposal(
  ticker: string,
  report: Partial<ReportData>,
  secVerification: SecVerificationEnvelope | null | undefined,
  signal?: AbortSignal,
): Promise<DCFModel | null> {
  // A missing financial-sector model is never repaired with industrial FCFF.
  if (!valuationMethodPolicy(resolveBusinessArchetype(report)).includes('FCFF_DCF')) return null;
  const verifiedFinancialContext = resolveDcfAssumptionFinancialContext(secVerification, ticker);
  if (!verifiedFinancialContext) return null;

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
        verifiedFinancialContext,
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
