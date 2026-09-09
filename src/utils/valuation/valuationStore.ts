import { IntrinsicValueData, ReportData } from '../../types';
import { detectValuationModel } from './modelSelector';
import { calculateRelativeOnlyModel } from './relativeEngine';
import { validateValuationAssumptions } from './valuationValidator';
import { buildRigorousDCFModel } from './dcfMathEngine';

export interface ValuationAssumptionsStore {
  ticker: string;
  dcf: {
    wacc_pct: number;
    terminal_growth_pct: number;
    revenue_cagr_pct: number;
    terminal_margin_pct: number;
  };
}

let currentStoreTicker = '';
let currentAssumptions: ValuationAssumptionsStore | undefined;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isFinitePositive = (value: unknown): value is number => isFiniteNumber(value) && value > 0;

/** Initializes the editable store only from explicit DCF assumptions. */
export function initValuationStore(data?: Partial<ReportData>, ticker?: string): ValuationAssumptionsStore | undefined {
  const sym = (ticker || data?.ticker || '').toUpperCase();
  if (!sym) return undefined;
  if (currentAssumptions && currentStoreTicker === sym) return currentAssumptions;

  const dcf = data?.intrinsic_value?.dcf_model;
  const base = dcf?.scenarios?.base;
  if (!dcf || !base || ![
    dcf.assumptions.wacc_pct,
    dcf.assumptions.terminal_growth_pct,
    base.revenue_cagr_pct,
    base.terminal_margin_pct,
  ].every(isFiniteNumber)) {
    currentStoreTicker = sym;
    currentAssumptions = undefined;
    return undefined;
  }

  currentStoreTicker = sym;
  currentAssumptions = {
    ticker: sym,
    dcf: {
      wacc_pct: dcf.assumptions.wacc_pct,
      terminal_growth_pct: dcf.assumptions.terminal_growth_pct,
      revenue_cagr_pct: base.revenue_cagr_pct,
      terminal_margin_pct: base.terminal_margin_pct,
    },
  };
  return currentAssumptions;
}

const hasCompleteSummary = (value?: IntrinsicValueData) => Boolean(
  value
  && isFinitePositive(value.summary?.fair_value_range_low)
  && isFinitePositive(value.summary?.base_case_fair_value)
  && isFinitePositive(value.summary?.fair_value_range_high)
  && isFiniteNumber(value.summary?.margin_of_safety_pct)
  && value.summary.fair_value_range_low < value.summary.base_case_fair_value
  && value.summary.base_case_fair_value < value.summary.fair_value_range_high
);

/**
 * Builds a valuation only when every required input is present. This function
 * never manufactures statement values, peer data, multiples, or price targets.
 */
export function buildUniversalValuationData(data?: Partial<ReportData>, ticker?: string): IntrinsicValueData | undefined {
  const sym = (ticker || data?.ticker || '').toUpperCase();
  const source = data?.intrinsic_value;
  const modelSelector = source?.selected_model ?? detectValuationModel(data, sym);
  const { dcfModel, inputs } = buildRigorousDCFModel(data, sym);

  if (!inputs.isValid) return undefined;

  const standardDcf = ['dcf_standard', 'dcf_multistage', 'dcf_gordon'].includes(modelSelector.model_type);
  let summary: IntrinsicValueData['summary'];

  if (standardDcf) {
    const bear = dcfModel.scenarios.bear.fair_value_per_share;
    const base = dcfModel.scenarios.base.fair_value_per_share;
    const bull = dcfModel.scenarios.bull.fair_value_per_share;
    if (![bear, base, bull].every(isFinitePositive) || !isFinitePositive(inputs.currentPrice)) return undefined;
    const margin = Number((((base - inputs.currentPrice) / inputs.currentPrice) * 100).toFixed(1));
    summary = {
      fair_value_range_low: bear,
      fair_value_range_high: bull,
      base_case_fair_value: base,
      margin_of_safety_pct: margin,
      verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
    };
  } else {
    if (!source || !hasCompleteSummary(source)) return undefined;
    if (modelSelector.model_type === 'ddm' && !source.ddm_model) return undefined;
    if (modelSelector.model_type === 'reit_affo' && !source.reit_model) return undefined;
    if (modelSelector.model_type === 'dcf_cyclical' && !source.cyclical_model) return undefined;
    if (modelSelector.model_type === 'relative_only' && !calculateRelativeOnlyModel(data)) return undefined;
    if (modelSelector.model_type === 'fintech_pe' && !source.relative_valuation) return undefined;
    summary = { ...source.summary };
  }

  const relativeOnlyModel = calculateRelativeOnlyModel(data);
  const relativeValuation = source?.relative_valuation
    && isFinitePositive(source.relative_valuation.peer_multiple_used)
    && isFinitePositive(source.relative_valuation.fair_value_per_share)
    ? source.relative_valuation
    : undefined;

  const valuationPayload: IntrinsicValueData = {
    current_price: inputs.currentPrice,
    as_of_date: source?.as_of_date,
    selected_model: modelSelector,
    cost_of_capital: source?.cost_of_capital,
    dcf_model: dcfModel,
    ddm_model: source?.ddm_model,
    reit_model: source?.reit_model,
    cyclical_model: source?.cyclical_model,
    relative_only_model: relativeOnlyModel,
    relative_valuation: relativeValuation,
    summary,
    disclaimer: source?.disclaimer,
    philosophy_disclaimer: source?.philosophy_disclaimer,
  };

  valuationPayload.validation_alerts = validateValuationAssumptions(valuationPayload);
  return valuationPayload;
}
