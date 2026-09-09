import { CyclicalModel, ReportData } from '../../types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Returns a cyclical model only when historical margins and scenarios are complete. */
export function calculateCyclicalModel(data?: Partial<ReportData>): CyclicalModel | undefined {
  const model = data?.intrinsic_value?.cyclical_model;
  if (!model) return undefined;
  const values = [
    model.cycle_length_years,
    model.historical_margins.cycle_peak_margin_pct,
    model.historical_margins.cycle_trough_margin_pct,
    model.historical_margins.normalized_average_margin_pct,
    model.historical_margins.current_margin_pct,
    model.scenarios.bear.fair_value_per_share,
    model.scenarios.base.fair_value_per_share,
    model.scenarios.bull.fair_value_per_share,
  ];
  return values.every(finite) ? model : undefined;
}
