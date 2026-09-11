import type {
  FinancialStatementsData,
  IncomeStatementData,
  BalanceSheetData,
  CashFlowData,
} from '../types';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * factor) / factor;
};

export interface ParsedQuarterPeriod {
  raw: string;
  year: number;
  quarter: number;
  index: number;
}

export interface AggregationWindow {
  label: string;
  kind: 'annual_fy' | 'ltm';
  quarterIndices: number[]; // exactly 4 indices
  endingQuarterIndex: number;
  startingQuarterIndex: number;
}

/**
 * Parses period labels like 'Q1 2024', 'Q1-2024', '2024-Q1', 'Q1 24'
 */
export function parseQuarterPeriod(label: string, index: number): ParsedQuarterPeriod | null {
  if (!label || typeof label !== 'string') return null;
  const trimmed = label.trim();

  // Pattern: Q1 2024, Q1-2024, Q1'24, Q1 24
  const qFirst = trimmed.match(/^Q([1-4])[\s\-_'/]*(?:20)?(\d{2})$/i);
  if (qFirst) {
    const q = Number(qFirst[1]);
    const y = Number(qFirst[2].length === 2 ? `20${qFirst[2]}` : qFirst[2]);
    return { raw: label, year: y, quarter: q, index };
  }

  // Pattern: 2024 Q1, 2024-Q1
  const yFirst = trimmed.match(/^(?:20)?(\d{2})[\s\-_'/]*Q([1-4])$/i);
  if (yFirst) {
    const y = Number(yFirst[1].length === 2 ? `20${yFirst[1]}` : yFirst[1]);
    const q = Number(yFirst[2]);
    return { raw: label, year: y, quarter: q, index };
  }

  return null;
}

/**
 * Detects whether periods can be aggregated into Full Fiscal Years and/or LTM (Trailing 12 Months).
 */
export function findAggregationWindows(periods: string[]): AggregationWindow[] {
  if (!Array.isArray(periods) || periods.length < 4) return [];

  const parsed = periods
    .map((p, idx) => parseQuarterPeriod(p, idx))
    .filter((p): p is ParsedQuarterPeriod => p !== null);

  // If fewer than 4 periods parse successfully, check if exactly 4 periods exist in sequence
  if (parsed.length < 4) {
    if (periods.length === 4) {
      return [{
        label: 'Annual (LTM)',
        kind: 'ltm',
        quarterIndices: [0, 1, 2, 3],
        startingQuarterIndex: 0,
        endingQuarterIndex: 3,
      }];
    }
    return [];
  }

  const windows: AggregationWindow[] = [];

  // 1. Check for complete fiscal years (Q1, Q2, Q3, Q4 of same year)
  const years = Array.from(new Set(parsed.map(p => p.year))).sort((a, b) => a - b);
  for (const yr of years) {
    const quarters = parsed.filter(p => p.year === yr).sort((a, b) => a.quarter - b.quarter);
    if (quarters.length === 4 && quarters.map(q => q.quarter).join('') === '1234') {
      windows.push({
        label: `FY ${yr}`,
        kind: 'annual_fy',
        quarterIndices: quarters.map(q => q.index),
        startingQuarterIndex: quarters[0].index,
        endingQuarterIndex: quarters[3].index,
      });
    }
  }

  // 2. Trailing 12 Months (LTM): the 4 most recent consecutive quarters
  const lastFour = parsed.slice(-4);
  const isLastFourFY = windows.some(w =>
    w.kind === 'annual_fy' &&
    w.quarterIndices.join(',') === lastFour.map(p => p.index).join(',')
  );

  if (!isLastFourFY) {
    const firstP = lastFour[0];
    const lastP = lastFour[3];
    windows.push({
      label: `LTM (Q${firstP.quarter}'${String(firstP.year).slice(-2)} - Q${lastP.quarter}'${String(lastP.year).slice(-2)})`,
      kind: 'ltm',
      quarterIndices: lastFour.map(p => p.index),
      startingQuarterIndex: firstP.index,
      endingQuarterIndex: lastP.index,
    });
  }

  return windows;
}

/**
 * Sums a flow metric across the 4 quarter indices.
 * Strict fail-closed: If any quarter is null or undefined, returns null.
 */
export function sumFlowMetric(
  series: (number | null | undefined)[] | undefined,
  quarterIndices: number[],
): number | null {
  if (!series || !Array.isArray(series)) return null;
  let sum = 0;
  for (const idx of quarterIndices) {
    const val = series[idx];
    if (!finite(val)) return null; // Non-negotiable integrity: missing quarter = null
    sum += val;
  }
  return rounded(sum, 2);
}

/**
 * Takes the ending quarter balance for an instant metric.
 */
export function takeInstantMetric(
  series: (number | null | undefined)[] | undefined,
  endingQuarterIndex: number,
): number | null {
  if (!series || !Array.isArray(series)) return null;
  const val = series[endingQuarterIndex];
  return finite(val) ? val : null;
}

/**
 * Deterministically aggregates quarterly FinancialStatementsData into Annual/LTM data.
 * Adheres strictly to canonical accounting:
 * - Flows are summed over 4 quarters (if all 4 present; otherwise null).
 * - Balance sheet values reflect the period-ending quarter balance.
 * - Ratios are deterministically recomputed from aggregated fundamentals.
 */
export function aggregateQuarterlyToAnnual(data: FinancialStatementsData): FinancialStatementsData | null {
  if (!data?.periods || data.periods.length < 4) return null;

  const windows = findAggregationWindows(data.periods);
  if (windows.length === 0) return null;

  const annualPeriods = windows.map(w => w.label);
  const inc = data.income_statement;
  const bs = data.balance_sheet;
  const cf = data.cash_flow;

  // 1. Income Statement Aggregation
  const aggInc: IncomeStatementData = {
    revenue: windows.map(w => sumFlowMetric(inc?.revenue, w.quarterIndices)),
    cogs: windows.map(w => sumFlowMetric(inc?.cogs, w.quarterIndices)),
    gross_profit: windows.map(w => sumFlowMetric(inc?.gross_profit, w.quarterIndices)),
    operating_expenses: windows.map(w => sumFlowMetric(inc?.operating_expenses, w.quarterIndices)),
    operating_income: windows.map(w => sumFlowMetric(inc?.operating_income, w.quarterIndices)),
    other_income: windows.map(w => sumFlowMetric(inc?.other_income, w.quarterIndices)),
    interest_expense: windows.map(w => sumFlowMetric(inc?.interest_expense, w.quarterIndices)),
    income_before_tax: windows.map(w => sumFlowMetric(inc?.income_before_tax, w.quarterIndices)),
    income_tax_expense: windows.map(w => sumFlowMetric(inc?.income_tax_expense, w.quarterIndices)),
    net_income: windows.map(w => sumFlowMetric(inc?.net_income, w.quarterIndices)),
    eps_diluted: windows.map(w => sumFlowMetric(inc?.eps_diluted, w.quarterIndices)),

    // Banking lines
    net_interest_income: windows.map(w => sumFlowMetric(inc?.net_interest_income, w.quarterIndices)),
    non_interest_income: windows.map(w => sumFlowMetric(inc?.non_interest_income, w.quarterIndices)),
    provision_for_credit_losses: windows.map(w => sumFlowMetric(inc?.provision_for_credit_losses, w.quarterIndices)),

    // REIT lines
    rental_revenue: windows.map(w => sumFlowMetric(inc?.rental_revenue, w.quarterIndices)),
    property_operating_expenses: windows.map(w => sumFlowMetric(inc?.property_operating_expenses, w.quarterIndices)),
    noi: windows.map(w => sumFlowMetric(inc?.noi, w.quarterIndices)),
    ffo: windows.map(w => sumFlowMetric(inc?.ffo, w.quarterIndices)),
    affo: windows.map(w => sumFlowMetric(inc?.affo, w.quarterIndices)),

    commentary: inc?.commentary,
  };

  // Recompute income margins deterministically
  aggInc.gross_margin_pct = windows.map((_, i) => {
    const rev = aggInc.revenue?.[i];
    const gp = aggInc.gross_profit?.[i];
    return finite(rev) && rev > 0 && finite(gp) ? rounded((gp / rev) * 100) : null;
  });
  aggInc.operating_margin_pct = windows.map((_, i) => {
    const rev = aggInc.revenue?.[i];
    const op = aggInc.operating_income?.[i];
    return finite(rev) && rev > 0 && finite(op) ? rounded((op / rev) * 100) : null;
  });
  aggInc.net_margin_pct = windows.map((_, i) => {
    const rev = aggInc.revenue?.[i];
    const ni = aggInc.net_income?.[i];
    return finite(rev) && rev > 0 && finite(ni) ? rounded((ni / rev) * 100) : null;
  });

  // 2. Balance Sheet Aggregation (Ending Balance of each 4-quarter window)
  const aggBs: BalanceSheetData = {
    cash_and_equivalents: windows.map(w => takeInstantMetric(bs?.cash_and_equivalents, w.endingQuarterIndex)),
    short_term_investments: windows.map(w => takeInstantMetric(bs?.short_term_investments, w.endingQuarterIndex)),
    total_current_assets: windows.map(w => takeInstantMetric(bs?.total_current_assets, w.endingQuarterIndex)),
    receivables: windows.map(w => takeInstantMetric(bs?.receivables, w.endingQuarterIndex)),
    accounts_receivable: windows.map(w => takeInstantMetric(bs?.accounts_receivable, w.endingQuarterIndex)),
    inventory: windows.map(w => takeInstantMetric(bs?.inventory, w.endingQuarterIndex)),
    total_non_current_assets: windows.map(w => takeInstantMetric(bs?.total_non_current_assets, w.endingQuarterIndex)),
    net_ppe: windows.map(w => takeInstantMetric(bs?.net_ppe, w.endingQuarterIndex)),
    available_for_sale_securities: windows.map(w => takeInstantMetric(bs?.available_for_sale_securities, w.endingQuarterIndex)),
    goodwill: windows.map(w => takeInstantMetric(bs?.goodwill, w.endingQuarterIndex)),
    total_assets: windows.map(w => takeInstantMetric(bs?.total_assets, w.endingQuarterIndex)),
    current_liabilities: windows.map(w => takeInstantMetric(bs?.current_liabilities, w.endingQuarterIndex)),
    total_current_liabilities: windows.map(w => takeInstantMetric(bs?.total_current_liabilities, w.endingQuarterIndex)),
    payables: windows.map(w => takeInstantMetric(bs?.payables, w.endingQuarterIndex)),
    accounts_payable: windows.map(w => takeInstantMetric(bs?.accounts_payable, w.endingQuarterIndex)),
    tax_payable: windows.map(w => takeInstantMetric(bs?.tax_payable, w.endingQuarterIndex)),
    short_term_debt: windows.map(w => takeInstantMetric(bs?.short_term_debt, w.endingQuarterIndex)),
    current_deferred_liabilities: windows.map(w => takeInstantMetric(bs?.current_deferred_liabilities, w.endingQuarterIndex)),
    long_term_debt: windows.map(w => takeInstantMetric(bs?.long_term_debt, w.endingQuarterIndex)),
    total_debt: windows.map(w => takeInstantMetric(bs?.total_debt, w.endingQuarterIndex)),
    operating_lease_rou_assets: windows.map(w => takeInstantMetric(bs?.operating_lease_rou_assets, w.endingQuarterIndex)),
    operating_lease_liabilities_current: windows.map(w => takeInstantMetric(bs?.operating_lease_liabilities_current, w.endingQuarterIndex)),
    operating_lease_liabilities_non_current: windows.map(w => takeInstantMetric(bs?.operating_lease_liabilities_non_current, w.endingQuarterIndex)),
    operating_lease_liabilities: windows.map(w => takeInstantMetric(bs?.operating_lease_liabilities, w.endingQuarterIndex)),
    total_liabilities: windows.map(w => takeInstantMetric(bs?.total_liabilities, w.endingQuarterIndex)),
    total_equity: windows.map(w => takeInstantMetric(bs?.total_equity, w.endingQuarterIndex)),
    capital_stock: windows.map(w => takeInstantMetric(bs?.capital_stock, w.endingQuarterIndex)),
    common_stock: windows.map(w => takeInstantMetric(bs?.common_stock, w.endingQuarterIndex)),
    retained_earnings: windows.map(w => takeInstantMetric(bs?.retained_earnings, w.endingQuarterIndex)),
    aoci: windows.map(w => takeInstantMetric(bs?.aoci, w.endingQuarterIndex)),

    // Banking lines
    deposits: windows.map(w => takeInstantMetric(bs?.deposits, w.endingQuarterIndex)),
    interest_bearing_deposits: windows.map(w => takeInstantMetric(bs?.interest_bearing_deposits, w.endingQuarterIndex)),
    non_interest_bearing_deposits: windows.map(w => takeInstantMetric(bs?.non_interest_bearing_deposits, w.endingQuarterIndex)),
    loans_held_for_investment: windows.map(w => takeInstantMetric(bs?.loans_held_for_investment, w.endingQuarterIndex)),
    loans_held_for_sale: windows.map(w => takeInstantMetric(bs?.loans_held_for_sale, w.endingQuarterIndex)),
    investment_securities: windows.map(w => takeInstantMetric(bs?.investment_securities, w.endingQuarterIndex)),

    commentary: bs?.commentary,
  };

  // Balance sheet ratios
  aggBs.current_ratio = windows.map((_, i) => {
    const ca = aggBs.total_current_assets?.[i];
    const cl = aggBs.total_current_liabilities?.[i];
    return finite(ca) && finite(cl) && cl > 0 ? rounded(ca / cl) : null;
  });
  aggBs.debt_to_equity = windows.map((_, i) => {
    const debt = aggBs.total_debt?.[i];
    const eq = aggBs.total_equity?.[i];
    return finite(debt) && finite(eq) && eq > 0 ? rounded(debt / eq) : null;
  });

  // 3. Cash Flow Statement Aggregation
  const aggCf: CashFlowData = {
    operating_cash_flow: windows.map(w => sumFlowMetric(cf?.operating_cash_flow, w.quarterIndices)),
    depreciation: windows.map(w => sumFlowMetric(cf?.depreciation, w.quarterIndices)),
    stock_based_compensation: windows.map(w => sumFlowMetric(cf?.stock_based_compensation, w.quarterIndices)),
    non_cash_items: windows.map(w => sumFlowMetric(cf?.non_cash_items, w.quarterIndices)),
    change_working_capital: windows.map(w => sumFlowMetric(cf?.change_working_capital, w.quarterIndices)),
    change_receivables: windows.map(w => sumFlowMetric(cf?.change_receivables, w.quarterIndices)),
    change_inventory: windows.map(w => sumFlowMetric(cf?.change_inventory, w.quarterIndices)),
    change_payables: windows.map(w => sumFlowMetric(cf?.change_payables, w.quarterIndices)),
    investing_cash_flow: windows.map(w => sumFlowMetric(cf?.investing_cash_flow, w.quarterIndices)),
    capex: windows.map(w => sumFlowMetric(cf?.capex, w.quarterIndices)),
    investment_purchase: windows.map(w => sumFlowMetric(cf?.investment_purchase, w.quarterIndices)),
    other_investing: windows.map(w => sumFlowMetric(cf?.other_investing, w.quarterIndices)),
    financing_cash_flow: windows.map(w => sumFlowMetric(cf?.financing_cash_flow, w.quarterIndices)),
    debt_issuance_payments: windows.map(w => sumFlowMetric(cf?.debt_issuance_payments, w.quarterIndices)),
    stock_issuance_repurchase: windows.map(w => sumFlowMetric(cf?.stock_issuance_repurchase, w.quarterIndices)),
    dividends_paid: windows.map(w => sumFlowMetric(cf?.dividends_paid, w.quarterIndices)),
    other_financing: windows.map(w => sumFlowMetric(cf?.other_financing, w.quarterIndices)),
    free_cash_flow: windows.map(w => sumFlowMetric(cf?.free_cash_flow, w.quarterIndices)),

    // Banking cash flow
    change_in_deposits: windows.map(w => sumFlowMetric(cf?.change_in_deposits, w.quarterIndices)),
    change_in_loans: windows.map(w => sumFlowMetric(cf?.change_in_loans, w.quarterIndices)),
    change_in_loans_held_for_sale: windows.map(w => sumFlowMetric(cf?.change_in_loans_held_for_sale, w.quarterIndices)),

    // Cash reconciliations
    beginning_cash: windows.map(w => takeInstantMetric(cf?.beginning_cash, w.startingQuarterIndex)),
    ending_cash: windows.map(w => takeInstantMetric(cf?.ending_cash, w.endingQuarterIndex)),
    net_change_cash: windows.map(w => sumFlowMetric(cf?.net_change_cash, w.quarterIndices)),

    commentary: cf?.commentary,
  };

  // Recompute FCF if OCF and CapEx are present
  aggCf.free_cash_flow = windows.map((_, i) => {
    const directFcf = aggCf.free_cash_flow?.[i];
    if (finite(directFcf)) return directFcf;
    const ocf = aggCf.operating_cash_flow?.[i];
    const capex = aggCf.capex?.[i];
    if (finite(ocf) && finite(capex)) {
      return rounded(ocf - Math.abs(capex));
    }
    return null;
  });

  aggCf.fcf_margin_pct = windows.map((_, i) => {
    const rev = aggInc.revenue?.[i];
    const fcf = aggCf.free_cash_flow?.[i];
    return finite(rev) && rev > 0 && finite(fcf) ? rounded((fcf / rev) * 100) : null;
  });

  return {
    ...data,
    fiscal_period_type: 'annual',
    periods: annualPeriods,
    income_statement: aggInc,
    balance_sheet: aggBs,
    cash_flow: aggCf,
  };
}
