import { DCFModel, ReportData } from '../../types';
import type { MarketSnapshot } from '../../domain/marketSnapshot';
import type { ReportWithSecVerification, SecDcfFinancialInputsEnvelope } from '../../domain/secVerification';
import {
  MACRO_TERMINAL_GROWTH_MAX_CAP_PCT,
  MACRO_TERMINAL_GROWTH_MIN_PCT,
} from './constants';

export interface DCFEngineInputs {
  ticker: string;
  currentPrice: number | null;
  startingRevenueM: number | null;
  sharesOutstandingM: number | null;
  netCashM: number | null;
  waccPct: number | null;
  terminalGrowthPct: number | null;
  projectionYears: number | null;
  isValid: boolean;
  sourcePeriod?: string;
  missingFields?: string[];
  derivedFields?: string[];
  priceSource?: 'market_snapshot' | 'intrinsic_value' | 'company_profile';
  financialDataSource?: 'sec_verified' | 'report_statements';
  financialDataAsOf?: string;
  sharesAsOf?: string;
}

type ReportWithMarketSnapshot = Partial<ReportData> & { market_snapshot?: MarketSnapshot } & ReportWithSecVerification;

const numberAt = (values: (number | null | undefined)[] | undefined, index: number) => {
  const value = values?.[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseSharesToMillions = (value: number | string | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value > 100_000 ? value / 1_000_000 : value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) return undefined;
  if (/\bB\b/i.test(value)) return parsed * 1_000;
  if (/\bM\b/i.test(value)) return parsed;
  return parsed > 100_000 ? parsed / 1_000_000 : parsed;
};

const roughlyEqual = (left: number, right: number) => {
  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) <= scale * 1e-8;
};

const validSecFinancialInputs = (
  sec: SecDcfFinancialInputsEnvelope | null | undefined,
  ticker: string,
) => Boolean(
  sec
  && sec.version === 1
  && sec.generated_by === 'sec-verified-financial-inputs-v1'
  && sec.eligible === true
  && sec.ticker === ticker
  && sec.periods.length === 4
  && typeof sec.source_period === 'string'
  && sec.source_period.length > 0
  && typeof sec.latest_balance_sheet_period_end === 'string'
  && sec.latest_balance_sheet_period_end.length > 0
  && finite(sec.starting_revenue_m)
  && sec.starting_revenue_m > 0
  && finite(sec.trailing_four_free_cash_flow_m)
  && finite(sec.cash_and_equivalents_m)
  && finite(sec.short_term_investments_m)
  && finite(sec.total_debt_m)
  && finite(sec.net_cash_m)
  && finite(sec.current_shares_outstanding_m)
  && sec.current_shares_outstanding_m > 0
  && sec.issues.length === 0
  && roughlyEqual(
    sec.cash_and_equivalents_m + sec.short_term_investments_m - sec.total_debt_m,
    sec.net_cash_m,
  )
);

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
  revenue_cagr_pct: null,
  terminal_margin_pct: null,
  fair_value_per_share: null,
  key_assumption_note: note,
});

/**
 * Builds a DCF from one complete financial source at a time.
 *
 * If a same-origin SEC verification envelope is explicitly `verified_eligible`, every financial
 * input (revenue, net cash and current shares) comes from that envelope. A malformed eligible
 * envelope fails closed rather than silently falling back to AI/report statement values.
 *
 * If SEC coverage is partial/unavailable, the legacy validated report-statement path remains the
 * all-or-nothing fallback. The two financial sources are never mixed within one DCF calculation.
 */
export function buildRigorousDCFModel(
  data?: ReportWithMarketSnapshot,
  ticker?: string,
  userWacc?: number,
  userGrowth?: number,
): { dcfModel: DCFModel; inputs: DCFEngineInputs } {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const original = data?.intrinsic_value?.dcf_model;
  const missing: string[] = [];
  const derivedFields: string[] = [];

  let startingRevenueM: number | null = null;
  let sharesOutstandingM: number | null = null;
  let netCashM: number | null = null;
  let sourcePeriod: string | undefined;
  let financialDataSource: DCFEngineInputs['financialDataSource'] = 'report_statements';
  let financialDataAsOf: string | undefined;
  let sharesAsOf: string | undefined;

  const secEnvelope = data?.sec_verification;
  const secInputs = secEnvelope?.dcf_financial_inputs;
  const secClaimsEligibility = secEnvelope?.status === 'verified_eligible' || secInputs?.eligible === true;
  const useSecFinancials = secEnvelope?.status === 'verified_eligible'
    && secInputs?.eligible === true
    && validSecFinancialInputs(secInputs, sym);

  if (secClaimsEligibility) {
    if (!useSecFinancials || !secInputs) {
      // An envelope that claims eligibility is a trusted-source invariant violation. Do not hide it
      // by falling back to report/AI financials for this valuation.
      missing.push('runtime-valid SEC verified DCF financial inputs');
      financialDataSource = 'sec_verified';
    } else {
      startingRevenueM = secInputs.starting_revenue_m;
      sharesOutstandingM = secInputs.current_shares_outstanding_m;
      netCashM = secInputs.net_cash_m;
      sourcePeriod = secInputs.source_period ?? undefined;
      financialDataAsOf = secInputs.latest_balance_sheet_period_end ?? undefined;
      sharesAsOf = secInputs.share_as_of ?? undefined;
      financialDataSource = 'sec_verified';
    }
  } else {
    const fs = data?.financial_statements;
    const periods = fs?.periods || [];
    const lastFourPeriods = periods.slice(-4);
    const latestIndex = periods.length - 1;
    const inc = fs?.income_statement;
    const bs = fs?.balance_sheet;
    const cf = fs?.cash_flow;

    const isQuarterly = lastFourPeriods.length === 4 && lastFourPeriods.every(period => /^Q[1-4]\s+(?:FY\s*)?(?:20)?\d{2}$/i.test(period.trim()));
    if (!isQuarterly) missing.push('four disclosed quarterly periods');
    const revenues = isQuarterly ? (inc?.revenue || []).slice(-4) : [];
    if (revenues.length !== 4 || revenues.some(value => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
      missing.push('quarterly revenue (USD millions)');
    } else {
      startingRevenueM = revenues.reduce((sum, value) => sum + (value as number), 0);
    }

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
    if (freeCashFlows.length !== 4 || freeCashFlows.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
      missing.push('quarterly free cash flow (USD millions)');
    }

    const cash = numberAt(bs?.cash_and_equivalents, latestIndex);
    const investments = numberAt(bs?.short_term_investments, latestIndex);
    const debt = numberAt(bs?.total_debt, latestIndex);
    if (cash === undefined || investments === undefined || debt === undefined) {
      missing.push('cash, short-term investments, and total debt for the latest period');
    } else {
      netCashM = cash + investments - debt;
    }

    let reportSharesOutstandingM = parseSharesToMillions(data?.company_profile?.shares_outstanding);
    if (!reportSharesOutstandingM) {
      const netIncome = numberAt(inc?.net_income, latestIndex);
      const dilutedEps = numberAt(inc?.eps_diluted, latestIndex);
      if (netIncome !== undefined && dilutedEps !== undefined && dilutedEps > 0) {
        reportSharesOutstandingM = netIncome / dilutedEps;
        derivedFields.push('diluted shares (weighted-average) derived from latest net income divided by diluted EPS; not current shares outstanding');
      }
    }
    if (!reportSharesOutstandingM || reportSharesOutstandingM <= 0) {
      missing.push('shares outstanding');
    } else {
      sharesOutstandingM = reportSharesOutstandingM;
    }

    sourcePeriod = lastFourPeriods.length ? `${lastFourPeriods[0]}–${lastFourPeriods[3]}` : undefined;
  }

  const snapshotPrice = data?.market_snapshot?.price;
  const intrinsicPrice = data?.intrinsic_value?.current_price;
  const profilePrice = data?.company_profile?.stock_price;
  const rawCurrentPrice = snapshotPrice ?? intrinsicPrice ?? profilePrice;
  const currentPrice = typeof rawCurrentPrice === 'number' && Number.isFinite(rawCurrentPrice) && rawCurrentPrice > 0
    ? rawCurrentPrice
    : null;
  const priceSource: DCFEngineInputs['priceSource'] = currentPrice === null
    ? undefined
    : snapshotPrice === currentPrice
      ? 'market_snapshot'
      : intrinsicPrice === currentPrice
        ? 'intrinsic_value'
        : 'company_profile';
  if (currentPrice === null) missing.push('current share price');

  const rawWacc = userWacc ?? original?.assumptions.wacc_pct;
  const rawTerminalGrowth = userGrowth ?? original?.assumptions.terminal_growth_pct;
  if (!Number.isFinite(rawWacc)) missing.push('discount rate (WACC)');
  if (!Number.isFinite(rawTerminalGrowth)) missing.push('terminal growth rate');
  const waccPct = Number.isFinite(rawWacc) ? rawWacc as number : null;
  const terminalGrowthPct = Number.isFinite(rawTerminalGrowth)
    ? Math.min(MACRO_TERMINAL_GROWTH_MAX_CAP_PCT, Math.max(MACRO_TERMINAL_GROWTH_MIN_PCT, rawTerminalGrowth as number))
    : null;
  if (waccPct === null || terminalGrowthPct === null || terminalGrowthPct >= waccPct) {
    missing.push('discount rate greater than terminal growth');
  }
  const rawProjectionYears = original?.assumptions.projection_years;
  const projectionYears = typeof rawProjectionYears === 'number' && Number.isInteger(rawProjectionYears) && rawProjectionYears >= 1
    ? rawProjectionYears
    : null;
  if (projectionYears === null) missing.push('projection years');
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
    startingRevenueM,
    sharesOutstandingM,
    netCashM,
    waccPct,
    terminalGrowthPct,
    projectionYears,
    isValid: missing.length === 0,
    sourcePeriod,
    missingFields: missing,
    derivedFields,
    priceSource,
    financialDataSource,
    financialDataAsOf,
    sharesAsOf,
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

  const validStartingRevenueM = inputs.startingRevenueM as number;
  const validSharesOutstandingM = inputs.sharesOutstandingM as number;
  const validNetCashM = inputs.netCashM as number;
  const validWaccPct = waccPct as number;
  const validTerminalGrowthPct = terminalGrowthPct as number;
  const validProjectionYears = projectionYears as number;

  const scenarioWithValue = (scenario: NonNullable<typeof scenarios>['base']) => {
    const revenueCagrPct = scenario.revenue_cagr_pct as number;
    const terminalMarginPct = scenario.terminal_margin_pct as number;
    return {
      ...scenario,
      fair_value_per_share: calculateStrictDCFValue(
        validStartingRevenueM, validSharesOutstandingM, validNetCashM,
        validWaccPct, validTerminalGrowthPct, revenueCagrPct, terminalMarginPct, validProjectionYears,
      ),
    };
  };
  const bear = scenarioWithValue(scenarios!.bear);
  const base = scenarioWithValue(scenarios!.base);
  const bull = scenarioWithValue(scenarios!.bull);

  return {
    inputs,
    dcfModel: {
      assumptions: { wacc_pct: waccPct, terminal_growth_pct: validTerminalGrowthPct, projection_years: validProjectionYears },
      inputs,
      scenarios: { bear, base, bull },
    },
  };
}
