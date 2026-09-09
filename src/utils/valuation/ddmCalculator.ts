import { DDMModel, ReportData } from '../../types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Returns a DDM only when a complete model was supplied by the report source. */
export function calculateDDMModel(data?: Partial<ReportData>): DDMModel | undefined {
  const model = data?.intrinsic_value?.ddm_model;
  if (!model) return undefined;
  const values = [
    model.assumptions.cost_of_equity_pct,
    model.assumptions.terminal_growth_pct,
    model.assumptions.current_dividend_per_share,
    model.assumptions.current_payout_ratio_pct,
    model.assumptions.current_roe_pct,
    model.scenarios.bear.fair_value_per_share,
    model.scenarios.base.fair_value_per_share,
    model.scenarios.bull.fair_value_per_share,
  ];
  if (!values.every(finite) || model.assumptions.terminal_growth_pct >= model.assumptions.cost_of_equity_pct) return undefined;
  return model;
}
