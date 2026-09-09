import { CostOfCapitalResult, ReportData } from '../../types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Returns cost-of-capital data only when the report source supplied the complete
 * calculation. Market rates, beta, debt, equity, and tax rates are never guessed.
 */
export function calculateRegionAwareCostOfCapital(
  data?: Partial<ReportData>,
): CostOfCapitalResult | undefined {
  const result = data?.intrinsic_value?.cost_of_capital;
  if (!result) return undefined;
  const required = [
    result.risk_free_rate_pct,
    result.beta,
    result.equity_risk_premium_pct,
    result.country_risk_premium_pct,
    result.cost_of_equity_pct,
    result.cost_of_debt_pct,
    result.effective_tax_rate_pct,
    result.weight_equity_pct,
    result.weight_debt_pct,
    result.wacc_pct,
  ];
  return required.every(finite) ? result : undefined;
}
