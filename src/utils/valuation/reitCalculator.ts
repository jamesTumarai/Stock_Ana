import { REITAFFOModel, ReportData } from '../../types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Returns an AFFO model only when the report source supplied all core inputs. */
export function calculateREITModel(data?: Partial<ReportData>): REITAFFOModel | undefined {
  const model = data?.intrinsic_value?.reit_model;
  if (!model) return undefined;
  const values = [
    model.assumptions.current_ffo_per_share,
    model.assumptions.current_affo_per_share,
    model.assumptions.peer_median_affo_multiple,
    model.scenarios.bear.fair_value_per_share,
    model.scenarios.base.fair_value_per_share,
    model.scenarios.bull.fair_value_per_share,
  ];
  return values.every(finite) ? model : undefined;
}
