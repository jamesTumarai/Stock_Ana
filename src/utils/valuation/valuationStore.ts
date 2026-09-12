import { IntrinsicValueData, ReportData, DDMModel, REITAFFOModel, CyclicalModel, RelativeOnlyModel } from '../../types';
import type { MarketSnapshot } from '../../domain/marketSnapshot';
import { detectValuationModel } from './modelSelector';
import { calculateRelativeOnlyModel } from './relativeEngine';
import { calculateDDMModel } from './ddmCalculator';
import { calculateREITModel } from './reitCalculator';
import { calculateCyclicalModel } from './cyclicalNormalizer';
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
      wacc_pct: dcf.assumptions.wacc_pct as number,
      terminal_growth_pct: dcf.assumptions.terminal_growth_pct as number,
      revenue_cagr_pct: base.revenue_cagr_pct as number,
      terminal_margin_pct: base.terminal_margin_pct as number,
    },
  };
  return currentAssumptions;
}

const hasCompleteSummary = (value?: IntrinsicValueData) => {
  const low = value?.summary?.fair_value_range_low;
  const base = value?.summary?.base_case_fair_value;
  const high = value?.summary?.fair_value_range_high;
  const margin = value?.summary?.margin_of_safety_pct;
  return Boolean(
    value
    && isFinitePositive(low)
    && isFinitePositive(base)
    && isFinitePositive(high)
    && isFiniteNumber(margin)
    && low < base
    && base < high
  );
};

/**
 * Builds a valuation only when every required input for the active model family is present.
 * Standard DCF requires operating-company FCFF inputs. DDM, REIT AFFO, Cyclical, and Relative
 * models validate against their own verified domain structures.
 * This function never manufactures statement values, peer data, multiples, or price targets.
 */
export function buildUniversalValuationData(
  data?: Partial<ReportData> & { market_snapshot?: MarketSnapshot },
  ticker?: string,
): IntrinsicValueData | undefined {
  const sym = (ticker || data?.ticker || '').toUpperCase();
  const source = data?.intrinsic_value;
  const modelSelector = source?.selected_model ?? detectValuationModel(data, sym);
  const { dcfModel, inputs } = buildRigorousDCFModel(data, sym);

  const snapshotPrice = data?.market_snapshot?.price;
  const intrinsicPrice = data?.intrinsic_value?.current_price;
  const profilePrice = data?.company_profile?.stock_price;
  const rawCurrentPrice = snapshotPrice ?? intrinsicPrice ?? profilePrice ?? inputs.currentPrice;
  const currentPrice = typeof rawCurrentPrice === 'number' && Number.isFinite(rawCurrentPrice) && rawCurrentPrice > 0
    ? rawCurrentPrice
    : undefined;

  if (!currentPrice) return undefined;

  const standardDcf = ['dcf_standard', 'dcf_multistage', 'dcf_gordon'].includes(modelSelector.model_type);
  let summary: IntrinsicValueData['summary'];
  const ddmModel = calculateDDMModel(data);
  const reitModel = calculateREITModel(data);
  const cyclicalModel = calculateCyclicalModel(data);
  let relativeOnlyModel = calculateRelativeOnlyModel(data);

  if (standardDcf) {
    if (!inputs.isValid) return undefined;
    const bear = dcfModel.scenarios.bear.fair_value_per_share;
    const base = dcfModel.scenarios.base.fair_value_per_share;
    const bull = dcfModel.scenarios.bull.fair_value_per_share;
    if (!isFinitePositive(bear) || !isFinitePositive(base) || !isFinitePositive(bull)) return undefined;
    const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
    summary = {
      fair_value_range_low: bear,
      fair_value_range_high: bull,
      base_case_fair_value: base,
      margin_of_safety_pct: margin,
      verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
    };
  } else if (modelSelector.model_type === 'ddm') {
    if (!ddmModel) return undefined;
    const bear = ddmModel.scenarios.bear.fair_value_per_share;
    const base = ddmModel.scenarios.base.fair_value_per_share;
    const bull = ddmModel.scenarios.bull.fair_value_per_share;
    if (!isFinitePositive(bear) || !isFinitePositive(base) || !isFinitePositive(bull)) return undefined;
    const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
    summary = {
      fair_value_range_low: Math.min(bear, base),
      fair_value_range_high: Math.max(bull, base),
      base_case_fair_value: base,
      margin_of_safety_pct: margin,
      verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
    };
  } else if (modelSelector.model_type === 'reit_affo') {
    if (!reitModel) return undefined;
    const bear = reitModel.scenarios.bear.fair_value_per_share;
    const base = reitModel.scenarios.base.fair_value_per_share;
    const bull = reitModel.scenarios.bull.fair_value_per_share;
    if (!isFinitePositive(bear) || !isFinitePositive(base) || !isFinitePositive(bull)) return undefined;
    const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
    summary = {
      fair_value_range_low: Math.min(bear, base),
      fair_value_range_high: Math.max(bull, base),
      base_case_fair_value: base,
      margin_of_safety_pct: margin,
      verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
    };
  } else if (modelSelector.model_type === 'dcf_cyclical') {
    if (!cyclicalModel) return undefined;
    const bear = cyclicalModel.scenarios.bear.fair_value_per_share;
    const base = cyclicalModel.scenarios.base.fair_value_per_share;
    const bull = cyclicalModel.scenarios.bull.fair_value_per_share;
    if (!isFinitePositive(bear) || !isFinitePositive(base) || !isFinitePositive(bull)) return undefined;
    const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
    summary = {
      fair_value_range_low: Math.min(bear, base),
      fair_value_range_high: Math.max(bull, base),
      base_case_fair_value: base,
      margin_of_safety_pct: margin,
      verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
    };
  } else if (modelSelector.model_type === 'relative_only') {
    if (!relativeOnlyModel) return undefined;
    if (source && hasCompleteSummary(source)) {
      summary = { ...source.summary };
    } else {
      const base = relativeOnlyModel.fair_value_per_share;
      if (!isFinitePositive(base)) return undefined;
      const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
      summary = {
        fair_value_range_low: Number((base * 0.85).toFixed(2)),
        fair_value_range_high: Number((base * 1.15).toFixed(2)),
        base_case_fair_value: base,
        margin_of_safety_pct: margin,
        verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
      };
    }
  } else if (modelSelector.model_type === 'fintech_pe') {
    const relVal = source?.relative_valuation;
    const validRelVal = relVal && isFinitePositive(relVal.peer_multiple_used) && isFinitePositive(relVal.fair_value_per_share);
    if (!validRelVal && !relativeOnlyModel && !hasCompleteSummary(source)) return undefined;

    if (source && hasCompleteSummary(source)) {
      summary = { ...source.summary };
    } else {
      const base = validRelVal ? relVal.fair_value_per_share : relativeOnlyModel?.fair_value_per_share;
      if (!isFinitePositive(base)) return undefined;
      const margin = Number((((base - currentPrice) / currentPrice) * 100).toFixed(1));
      summary = {
        fair_value_range_low: Number((base * 0.85).toFixed(2)),
        fair_value_range_high: Number((base * 1.15).toFixed(2)),
        base_case_fair_value: base,
        margin_of_safety_pct: margin,
        verdict_text: margin >= 15 ? 'Undervalued' : margin <= -15 ? 'Overvalued' : 'Fairly Valued',
      };
    }
  } else {
    if (!source || !hasCompleteSummary(source)) return undefined;
    summary = { ...source.summary };
  }

  const relativeValuation = source?.relative_valuation
    && isFinitePositive(source.relative_valuation.peer_multiple_used)
    && isFinitePositive(source.relative_valuation.fair_value_per_share)
    ? source.relative_valuation
    : undefined;

  const valuationPayload: IntrinsicValueData = {
    current_price: currentPrice,
    as_of_date: source?.as_of_date,
    selected_model: modelSelector,
    cost_of_capital: source?.cost_of_capital,
    dcf_model: dcfModel,
    ddm_model: ddmModel ?? source?.ddm_model,
    reit_model: reitModel ?? source?.reit_model,
    cyclical_model: cyclicalModel ?? source?.cyclical_model,
    relative_only_model: relativeOnlyModel,
    relative_valuation: relativeValuation,
    summary,
    disclaimer: source?.disclaimer,
    philosophy_disclaimer: source?.philosophy_disclaimer,
  };

  valuationPayload.validation_alerts = validateValuationAssumptions(valuationPayload);
  return valuationPayload;
}
