import { DDMModel, DDMScenario, ReportData } from '../../types';

const isFinitePositive = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

/**
 * Calculates a Dividend Discount Model (DDM) and Residual Income valuation deterministically.
 *
 * Mathematical Invariants:
 * 1. Gordon Growth formula: V = D_0 * (1 + g) / (r - g)
 * 2. Terminal Growth Rate (g) must be strictly less than Cost of Equity (r). If g >= r, Gordon growth diverges -> fail closed.
 * 3. Cost of Equity (r) must be positive.
 * 4. Dividend per share (D_0) must be positive.
 * 5. If Book Value Per Share (BVPS) and ROE are provided, Residual Income is calculated:
 *    V_residual = BVPS + (BVPS * (ROE - r)) / (r - g)
 */
export function calculateDDMModel(data?: Partial<ReportData>): DDMModel | undefined {
  const source = data?.intrinsic_value?.ddm_model;
  if (!source) return undefined;

  const assumptions = source.assumptions;
  if (!assumptions) return undefined;

  const rPct = assumptions.cost_of_equity_pct;
  const gPct = assumptions.terminal_growth_pct;
  let d0 = assumptions.current_dividend_per_share;
  const payoutPct = assumptions.current_payout_ratio_pct;
  const roePct = assumptions.current_roe_pct;
  const bvps = source.book_value_per_share;

  // Validate cost of equity
  if (!isFinitePositive(rPct)) return undefined;

  // Validate terminal growth (must be >= 0 and strictly less than cost of equity)
  if (!isFiniteNumber(gPct) || gPct < 0 || gPct >= rPct) return undefined;

  // If dividend is not positive, attempt derivation from BVPS * ROE * Payout
  if (!isFinitePositive(d0)) {
    if (isFinitePositive(bvps) && isFinitePositive(roePct) && isFinitePositive(payoutPct) && payoutPct <= 100) {
      d0 = Number((bvps * (roePct / 100) * (payoutPct / 100)).toFixed(2));
    }
  }

  if (!isFinitePositive(d0)) return undefined;

  const r = rPct / 100;
  const g = gPct / 100;

  // Deterministic Gordon Growth Base Fair Value:
  const baseFairValue = Number(((d0 * (1 + g)) / (r - g)).toFixed(2));
  if (!isFinitePositive(baseFairValue)) return undefined;

  // Build or validate Bear scenario
  const bearG_pct = isFiniteNumber(source.scenarios?.bear?.terminal_growth_pct)
    ? source.scenarios.bear.terminal_growth_pct
    : Math.max(0, gPct - 1.0);
  const bearR_pct = isFinitePositive(source.scenarios?.bear?.cost_of_equity_pct)
    ? source.scenarios.bear.cost_of_equity_pct
    : rPct + 1.0;

  if (bearG_pct >= bearR_pct) return undefined;
  const bearG = bearG_pct / 100;
  const bearR = bearR_pct / 100;
  const bearFairValue = Number(((d0 * (1 + bearG)) / (bearR - bearG)).toFixed(2));
  if (!isFinitePositive(bearFairValue)) return undefined;

  // Build or validate Bull scenario
  const bullG_pct = isFiniteNumber(source.scenarios?.bull?.terminal_growth_pct)
    ? source.scenarios.bull.terminal_growth_pct
    : gPct + 0.5;
  const bullR_pct = isFinitePositive(source.scenarios?.bull?.cost_of_equity_pct)
    ? source.scenarios.bull.cost_of_equity_pct
    : Math.max(bullG_pct + 0.5, rPct - 0.5);

  if (bullG_pct >= bullR_pct) return undefined;
  const bullG = bullG_pct / 100;
  const bullR = bullR_pct / 100;
  const bullFairValue = Number(((d0 * (1 + bullG)) / (bullR - bullG)).toFixed(2));
  if (!isFinitePositive(bullFairValue)) return undefined;

  // Residual Income Fair Value (if BVPS and ROE available)
  let residualIncomeFairValue: number | undefined = undefined;
  if (isFinitePositive(bvps) && isFinitePositive(roePct)) {
    const roe = roePct / 100;
    const residualIncome = (bvps * (roe - r)) / (r - g);
    const totalResidual = bvps + residualIncome;
    if (isFinitePositive(totalResidual)) {
      residualIncomeFairValue = Number(totalResidual.toFixed(2));
    }
  }

  const baseScenario: DDMScenario = {
    dividend_growth_rate_pct: gPct,
    cost_of_equity_pct: rPct,
    terminal_growth_pct: gPct,
    terminal_payout_ratio_pct: isFinitePositive(payoutPct) ? payoutPct : 50,
    fair_value_per_share: baseFairValue,
    key_assumption_note: source.scenarios?.base?.key_assumption_note || `Ke=${rPct}%, g=${gPct}%, D0=$${d0.toFixed(2)}`
  };

  const bearScenario: DDMScenario = {
    dividend_growth_rate_pct: bearG_pct,
    cost_of_equity_pct: bearR_pct,
    terminal_growth_pct: bearG_pct,
    terminal_payout_ratio_pct: isFinitePositive(source.scenarios?.bear?.terminal_payout_ratio_pct)
      ? source.scenarios.bear.terminal_payout_ratio_pct
      : Math.max(20, (isFinitePositive(payoutPct) ? payoutPct : 50) - 10),
    fair_value_per_share: bearFairValue,
    key_assumption_note: source.scenarios?.bear?.key_assumption_note || `Ke=${bearR_pct}%, g=${bearG_pct}%`
  };

  const bullScenario: DDMScenario = {
    dividend_growth_rate_pct: bullG_pct,
    cost_of_equity_pct: bullR_pct,
    terminal_growth_pct: bullG_pct,
    terminal_payout_ratio_pct: isFinitePositive(source.scenarios?.bull?.terminal_payout_ratio_pct)
      ? source.scenarios.bull.terminal_payout_ratio_pct
      : Math.min(90, (isFinitePositive(payoutPct) ? payoutPct : 50) + 10),
    fair_value_per_share: bullFairValue,
    key_assumption_note: source.scenarios?.bull?.key_assumption_note || `Ke=${bullR_pct}%, g=${bullG_pct}%`
  };

  return {
    assumptions: {
      cost_of_equity_pct: rPct,
      terminal_growth_pct: gPct,
      current_dividend_per_share: d0,
      current_payout_ratio_pct: isFinitePositive(payoutPct) ? payoutPct : 0,
      current_roe_pct: isFinitePositive(roePct) ? roePct : 0
    },
    scenarios: {
      bear: bearScenario,
      base: baseScenario,
      bull: bullScenario
    },
    residual_income_fair_value: residualIncomeFairValue,
    book_value_per_share: isFinitePositive(bvps) ? bvps : undefined
  };
}
