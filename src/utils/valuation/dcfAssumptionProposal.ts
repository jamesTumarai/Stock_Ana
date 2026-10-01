import type { DCFModel, ReportData } from '../../types';
import type { SecVerificationEnvelope } from '../../domain/secVerification';
import { reconcileCanonicalTtmFlow } from '../../domain/canonicalTtmFlow';
import { sameShareClassTicker } from '../../domain/tickerIdentity';

export interface DcfAssumptionFinancialContext {
  sourcePeriod: string;
  startingRevenueM: number;
  trailingFourFreeCashFlowM: number;
  historicalFcfMarginPct: number;
}

/**
 * This input must be the independently fetched SEC envelope, never model context.
 * Optional statement coverage does not govern whether verified TTM flows can inform
 * forward assumptions. Shares/debt and all final valuation dependencies are still
 * validated separately by the deterministic engine.
 */
export function resolveDcfAssumptionFinancialContext(
  envelope: SecVerificationEnvelope | null | undefined,
  requestedTicker: string,
): DcfAssumptionFinancialContext | null {
  if (!envelope || envelope.status === 'unavailable' || !sameShareClassTicker(envelope.ticker, requestedTicker)) return null;
  const dataset = envelope.canonical_financials;
  if (dataset) {
    if (!sameShareClassTicker(dataset.ticker || '', requestedTicker)
      || !/sec[-_]?xbrl/i.test(dataset.generatedBy || '') || dataset.currency !== 'USD') return null;
    const revenue = reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue');
    const fcf = reconcileCanonicalTtmFlow(dataset, 'cash_flow.free_cash_flow');
    if (revenue.status !== 'verified' || fcf.status !== 'verified'
      || revenue.canonicalValue === null || revenue.canonicalValue <= 0 || fcf.canonicalValue === null
      || revenue.periodsUsed.join('|') !== fcf.periodsUsed.join('|')) return null;
    for (const metric of ['income_statement.revenue', 'cash_flow.free_cash_flow']) {
      const used = dataset.values[metric].filter(fact => revenue.periodsUsed.includes(fact.period));
      if (used.some(fact => fact.currency && fact.currency !== 'USD')) return null;
    }
    const margin = fcf.canonicalValue / revenue.canonicalValue * 100;
    if (!Number.isFinite(margin)) return null;
    return {
      sourcePeriod: revenue.periodsUsed[3],
      startingRevenueM: revenue.canonicalValue,
      trailingFourFreeCashFlowM: fcf.canonicalValue,
      historicalFcfMarginPct: margin,
    };
  }
  // Compatibility for older independently verified envelopes. A present but
  // invalid canonical dataset must never be bypassed with legacy/provider values.
  const legacy = envelope.dcf_financial_inputs;
  if (envelope.status !== 'verified_eligible' || !legacy?.eligible
    || legacy.generated_by !== 'sec-verified-financial-inputs-v1'
    || !sameShareClassTicker(legacy.ticker, requestedTicker)
    || !legacy.source_period || !Number.isFinite(legacy.starting_revenue_m) || legacy.starting_revenue_m! <= 0
    || !Number.isFinite(legacy.trailing_four_free_cash_flow_m) || !Number.isFinite(legacy.historical_fcf_margin_pct)) return null;
  return {
    sourcePeriod: legacy.source_period,
    startingRevenueM: legacy.starting_revenue_m!,
    trailingFourFreeCashFlowM: legacy.trailing_four_free_cash_flow_m!,
    historicalFcfMarginPct: legacy.historical_fcf_margin_pct!,
  };
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const validScenario = (value: unknown) => {
  if (!isRecord(value)) return null;
  if (!finiteInRange(value.revenue_cagr_pct, -30, 50)) return null;
  if (!finiteInRange(value.terminal_margin_pct, -50, 80)) return null;
  if (typeof value.key_assumption_note !== 'string' || !value.key_assumption_note.trim()) return null;
  return {
    revenue_cagr_pct: value.revenue_cagr_pct,
    terminal_margin_pct: value.terminal_margin_pct,
    fair_value_per_share: null,
    key_assumption_note: value.key_assumption_note.trim(),
  };
};

/**
 * Accept only a small, explicitly forward-looking assumption surface from AI.
 * Financial statement facts and fair values are deliberately excluded here.
 */
export function validateDcfAssumptionModel(value: unknown): DCFModel | null {
  if (!isRecord(value) || !isRecord(value.assumptions) || !isRecord(value.scenarios)) return null;

  const { wacc_pct: waccPct, terminal_growth_pct: terminalGrowthPct, projection_years: projectionYears } = value.assumptions;
  if (!finiteInRange(waccPct, 5, 30)) return null;
  if (!finiteInRange(terminalGrowthPct, 0, 5)) return null;
  if (terminalGrowthPct >= waccPct) return null;
  if (typeof projectionYears !== 'number' || !Number.isInteger(projectionYears) || projectionYears < 3 || projectionYears > 10) return null;

  const bear = validScenario(value.scenarios.bear);
  const base = validScenario(value.scenarios.base);
  const bull = validScenario(value.scenarios.bull);
  if (!bear || !base || !bull) return null;

  if (!(bear.revenue_cagr_pct <= base.revenue_cagr_pct && base.revenue_cagr_pct <= bull.revenue_cagr_pct)) return null;
  if (!(bear.terminal_margin_pct <= base.terminal_margin_pct && base.terminal_margin_pct <= bull.terminal_margin_pct)) return null;
  if (bear.revenue_cagr_pct === base.revenue_cagr_pct && bear.terminal_margin_pct === base.terminal_margin_pct) return null;
  if (base.revenue_cagr_pct === bull.revenue_cagr_pct && base.terminal_margin_pct === bull.terminal_margin_pct) return null;

  return {
    assumptions: {
      wacc_pct: waccPct,
      terminal_growth_pct: terminalGrowthPct,
      projection_years: projectionYears,
    },
    scenarios: { bear, base, bull },
  };
}

export function hasValidDcfAssumptionModel(report: Partial<ReportData> | null | undefined): boolean {
  return Boolean(validateDcfAssumptionModel(report?.intrinsic_value?.dcf_model));
}

export function attachDcfAssumptionModel<T extends Partial<ReportData>>(report: T, model: DCFModel): T & ReportData {
  const intrinsic = isRecord(report.intrinsic_value) ? report.intrinsic_value : {};
  return {
    ...report,
    intrinsic_value: {
      ...intrinsic,
      dcf_model: model,
    },
  } as T & ReportData;
}
