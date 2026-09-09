import { DCFModel, ReportData } from '../../types';
import { calculateRegionAwareCostOfCapital } from './costOfCapital';
import {
  MACRO_TERMINAL_GROWTH_DEFAULT_PCT,
  MACRO_TERMINAL_GROWTH_MAX_CAP_PCT,
  MACRO_TERMINAL_GROWTH_MIN_PCT,
} from './constants';

export interface DCFEngineInputs {
  ticker: string;
  currentPrice: number;
  startingRevenueM: number;
  sharesOutstandingM: number;
  netCashM: number;
  waccPct: number;
  terminalGrowthPct: number;
  projectionYears: number;
  isValid: boolean;
  sourcePeriod?: string;
  missingFields?: string[];
  derivedFields?: string[];
}

const numberAt = (values: (number | null | undefined)[] | undefined, index: number) => {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const parseSharesToMillions = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 100_000 ? value / 1_000_000 : value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return undefined;
  if (/\bB\b/i.test(value)) return parsed * 1_000;
  if (/\bM\b/i.test(value)) return parsed;
  return parsed > 100_000 ? parsed / 1_000_000 : parsed;
};

/** Invalid inputs deliberately return NaN so missing data can never become a price target. */
export function calculateStrictDCFValue(
  startingRevenueM: number,
  sharesOutstandingM: number,
  netCashM: number,
  waccPct: number,
  terminalGrowthPct: number,
  cagrPct: number,
  fcfMarginPct: number,
  projectionYears = 5,
): number {
  const values = [startingRevenueM, sharesOutstandingM, netCashM, waccPct, terminalGrowthPct, cagrPct, fcfMarginPct, projectionYears];
  if (!values.every(Number.isFinite) || startingRevenueM <= 0 || sharesOutstandingM <= 0 || projectionYears < 1) return Number.NaN;

  const wacc = waccPct / 100;
  const terminalGrowth = terminalGrowthPct / 100;
  if (wacc <= 0 || terminalGrowth < 0 || terminalGrowth >= wacc || fcfMarginPct < -100 || fcfMarginPct > 100) return Number.NaN;

  let revenue = startingRevenueM;
  let pvOfFcf = 0;
  let finalYearFcf = 0;
  for (let year = 1; year <= projectionYears; year += 1) {
    revenue *= 1 + cagrPct / 100;
    finalYearFcf = revenue * (fcfMarginPct / 100);
    pvOfFcf += finalYearFcf / Math.pow(1 + wacc, year);
  }
  const terminalValue = (finalYearFcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const enterpriseValueM = pvOfFcf + terminalValue / Math.pow(1 + wacc, projectionYears);
  return Number(((enterpriseValueM + netCashM) / sharesOutstandingM).toFixed(2));
}

const unavailableScenario = (note: string) => ({
  revenue_cagr_pct: 0,
  terminal_margin_pct: 0,
  fair_value_per_share: 0,
  key_assumption_note: note,
});

/**
 * Builds a DCF only from four disclosed quarterly values in USD millions.
 * It never substitutes ticker-specific, price-derived, or market-cap-derived data.
 */
export function buildRigorousDCFModel(
  data?: Partial<ReportData>,
  ticker?: string,
  userWacc?: number,
  userGrowth?: number,
): { dcfModel: DCFModel; inputs: DCFEngineInputs } {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const original = data?.intrinsic_value?.dcf_model;
  const fs = data?.financial_statements;
  const periods = fs?.periods || [];
  const lastFourPeriods = periods.slice(-4);
  const latestIndex = periods.length - 1;
  const inc = fs?.income_statement;
  const bs = fs?.balance_sheet;
  const cf = fs?.cash_flow;
  const missing: string[] = [];

  const isQuarterly = lastFourPeriods.length === 4 && lastFourPeriods.every(period => /^Q[1-4]\s+(?:FY\s*)?(?:20)?\d{2}$/i.test(period.trim()));
  if (!isQuarterly) missing.push('four disclosed quarterly periods');
  const derivedFields: string[] = [];
  const revenues = isQuarterly ? (inc?.revenue || []).slice(-4) : [];
  if (revenues.length !== 4 || revenues.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) missing.push('quarterly revenue (USD millions)');
  let freeCashFlows = isQuarterly ? (cf?.free_cash_flow || []).slice(-4) : [];
  if (freeCashFlows.length !== 4 || freeCashFlows.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
    const operatingCashFlows = isQuarterly ? (cf?.operating_cash_flow || []).slice(-4) : [];
    const capex = isQuarterly ? (cf?.capex || []).slice(-4) : [];
    if (operatingCashFlows.length === 4 && capex.length === 4
      && operatingCashFlows.every(value => typeof value === 'number' && Number.isFinite(value))
      && capex.every(value => typeof value === 'number' && Number.isFinite(value))) {
      freeCashFlows = operatingCashFlows.map((operatingCashFlow, index) => {
        const investment = capex[index] as number;
        return (operatingCashFlow as number) + (investment < 0 ? investment : -investment);
      });
      derivedFields.push('free cash flow derived from operating cash flow and capex');
    }
  }
  if (freeCashFlows.length !== 4 || freeCashFlows.some(value => typeof value !== 'number' || !Number.isFinite(value))) missing.push('quarterly free cash flow (USD millions)');

  const cash = numberAt(bs?.cash_and_equivalents, latestIndex);
  const investments = numberAt(bs?.short_term_investments, latestIndex);
  const debt = numberAt(bs?.total_debt, latestIndex);
  if (cash === undefined || investments === undefined || debt === undefined) missing.push('cash, short-term investments, and total debt for the latest period');

  let sharesOutstandingM = parseSharesToMillions(data?.company_profile?.shares_outstanding);
  if (!sharesOutstandingM) {
    const netIncome = numberAt(inc?.net_income, latestIndex);
    const dilutedEps = numberAt(inc?.eps_diluted, latestIndex);
    if (netIncome !== undefined && dilutedEps !== undefined && dilutedEps > 0) {
      sharesOutstandingM = netIncome / dilutedEps;
      derivedFields.push('diluted shares derived from latest net income divided by diluted EPS');
    }
  }
  if (!sharesOutstandingM || sharesOutstandingM <= 0) missing.push('shares outstanding');
  const currentPrice = data?.intrinsic_value?.current_price ?? data?.company_profile?.stock_price ?? 0;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) missing.push('current share price');

  const coc = calculateRegionAwareCostOfCapital(data, sym);
  const waccPct = userWacc ?? original?.assumptions.wacc_pct ?? coc.wacc_pct;
  const terminalGrowthPct = Math.min(
    MACRO_TERMINAL_GROWTH_MAX_CAP_PCT,
    Math.max(MACRO_TERMINAL_GROWTH_MIN_PCT, userGrowth ?? original?.assumptions.terminal_growth_pct ?? MACRO_TERMINAL_GROWTH_DEFAULT_PCT),
  );
  if (!Number.isFinite(waccPct) || terminalGrowthPct >= waccPct) missing.push('discount rate greater than terminal growth');
  const projectionYears = original?.assumptions.projection_years ?? 5;
  const scenarios = original?.scenarios;
  if (!scenarios?.bear || !scenarios.base || !scenarios.bull) missing.push('bear, base, and bull DCF assumptions');
  const validScenarioInputs = scenarios && [scenarios.bear, scenarios.base, scenarios.bull].every(scenario =>
    Number.isFinite(scenario.revenue_cagr_pct)
    && Number.isFinite(scenario.terminal_margin_pct)
    && scenario.terminal_margin_pct >= -100
    && scenario.terminal_margin_pct <= 100,
  );
  if (!validScenarioInputs) missing.push('valid growth and free-cash-flow-margin assumptions');

  const inputs: DCFEngineInputs = {
    ticker: sym,
    currentPrice,
    startingRevenueM: revenues.reduce((sum, value) => sum + (typeof value === 'number' ? value : 0), 0),
    sharesOutstandingM: sharesOutstandingM || 0,
    netCashM: cash !== undefined && investments !== undefined && debt !== undefined ? cash + investments - debt : 0,
    waccPct,
    terminalGrowthPct,
    projectionYears,
    isValid: missing.length === 0,
    sourcePeriod: lastFourPeriods.length ? `${lastFourPeriods[0]}–${lastFourPeriods[3]}` : undefined,
    missingFields: missing,
    derivedFields,
  };

  if (!inputs.isValid) {
    const note = `Valuation unavailable: missing ${missing.join('; ')}.`;
    return {
      inputs,
      dcfModel: {
        assumptions: { wacc_pct: waccPct, terminal_growth_pct: terminalGrowthPct, projection_years: projectionYears },
        inputs,
        scenarios: { bear: unavailableScenario(note), base: unavailableScenario(note), bull: unavailableScenario(note) },
      },
    };
  }

  const scenarioWithValue = (scenario: NonNullable<typeof scenarios>['base']) => ({
    ...scenario,
    fair_value_per_share: calculateStrictDCFValue(
      inputs.startingRevenueM, inputs.sharesOutstandingM, inputs.netCashM,
      waccPct, terminalGrowthPct, scenario.revenue_cagr_pct, scenario.terminal_margin_pct, projectionYears,
    ),
  });
  const bear = scenarioWithValue(scenarios!.bear);
  const base = scenarioWithValue(scenarios!.base);
  const bull = scenarioWithValue(scenarios!.bull);

  return {
    inputs,
    dcfModel: {
      assumptions: { wacc_pct: waccPct, terminal_growth_pct: terminalGrowthPct, projection_years: projectionYears },
      inputs,
      scenarios: { bear, base, bull },
    },
  };
}
