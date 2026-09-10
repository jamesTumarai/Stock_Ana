import type { DCFModel, ReportData } from '../../types';

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
