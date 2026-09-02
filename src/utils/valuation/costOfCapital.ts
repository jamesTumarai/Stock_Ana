import { CostOfCapitalResult, ReportData } from '../../types';

export interface RegionBenchmark {
  region: string;
  currency: string;
  riskFreeRate: number;
  riskFreeLabel: string;
  benchmarkIndex: string;
  equityRiskPremium: number;
  countryRiskPremium: number;
}

const REGION_BENCHMARKS: Record<string, RegionBenchmark> = {
  TH: {
    region: 'Thailand',
    currency: 'THB',
    riskFreeRate: 2.65,
    riskFreeLabel: 'พันธบัตรรัฐบาลไทย 10 ปี (Thai 10Y Govt Bond)',
    benchmarkIndex: 'SET Index',
    equityRiskPremium: 6.20,
    countryRiskPremium: 1.45
  },
  US: {
    region: 'United States',
    currency: 'USD',
    riskFreeRate: 4.25,
    riskFreeLabel: 'US 10Y Treasury Yield',
    benchmarkIndex: 'S&P 500',
    equityRiskPremium: 4.75,
    countryRiskPremium: 0.00
  },
  HK: {
    region: 'Hong Kong / China',
    currency: 'HKD',
    riskFreeRate: 3.10,
    riskFreeLabel: 'Hong Kong 10Y Exchange Fund Note',
    benchmarkIndex: 'Hang Seng Index (HSI)',
    equityRiskPremium: 5.80,
    countryRiskPremium: 0.85
  },
  CN: {
    region: 'China',
    currency: 'CNY',
    riskFreeRate: 2.20,
    riskFreeLabel: 'China 10Y Govt Bond',
    benchmarkIndex: 'CSI 300 Index',
    equityRiskPremium: 5.90,
    countryRiskPremium: 1.10
  },
  JP: {
    region: 'Japan',
    currency: 'JPY',
    riskFreeRate: 1.05,
    riskFreeLabel: 'Japan 10Y JGB',
    benchmarkIndex: 'TOPIX / Nikkei 225',
    equityRiskPremium: 5.00,
    countryRiskPremium: 0.00
  },
  EU: {
    region: 'Europe',
    currency: 'EUR',
    riskFreeRate: 2.35,
    riskFreeLabel: 'German 10Y Bund',
    benchmarkIndex: 'Euro Stoxx 50',
    equityRiskPremium: 5.20,
    countryRiskPremium: 0.20
  },
  UK: {
    region: 'United Kingdom',
    currency: 'GBP',
    riskFreeRate: 4.10,
    riskFreeLabel: 'UK 10Y Gilt',
    benchmarkIndex: 'FTSE 100',
    equityRiskPremium: 5.10,
    countryRiskPremium: 0.00
  }
};

/**
 * Detects the home market region and currency of a stock ticker.
 */
export function detectRegion(ticker?: string, profileRegion?: string): RegionBenchmark {
  const sym = (ticker || '').toUpperCase();
  const regionUpper = (profileRegion || '').toUpperCase();

  if (sym.endsWith('.BK') || sym.endsWith('.TH') || ['BBL', 'KBANK', 'SCB', 'PTT', 'PTTEP', 'AOT', 'CPALL', 'DELTA'].includes(sym) && !profileRegion) {
    return REGION_BENCHMARKS.TH;
  }
  if (sym.endsWith('.HK') || ['9988', '0700', '3690', '1810', '9866'].includes(sym)) {
    return REGION_BENCHMARKS.HK;
  }
  if (sym.endsWith('.SS') || sym.endsWith('.SZ') || regionUpper.includes('CHINA')) {
    return REGION_BENCHMARKS.CN;
  }
  if (sym.endsWith('.T') || ['7203', '6758', '9984'].includes(sym) || regionUpper.includes('JAPAN')) {
    return REGION_BENCHMARKS.JP;
  }
  if (sym.endsWith('.L') || regionUpper.includes('UK') || regionUpper.includes('BRITAIN')) {
    return REGION_BENCHMARKS.UK;
  }
  if (sym.endsWith('.DE') || sym.endsWith('.PA') || regionUpper.includes('GERMANY') || regionUpper.includes('FRANCE')) {
    return REGION_BENCHMARKS.EU;
  }

  // Default to US Market
  return REGION_BENCHMARKS.US;
}

/**
 * Computes region-aware and currency-aware Cost of Equity and WACC.
 */
export function calculateRegionAwareCostOfCapital(
  data?: Partial<ReportData>,
  ticker?: string,
  userBeta?: number
): CostOfCapitalResult {
  const benchmark = detectRegion(ticker, data?.company_profile?.country);
  const bs = data?.financial_statements?.balance_sheet;
  const inc = data?.financial_statements?.income_statement;

  // Extract Debt and Equity
  const totalDebtM = (bs?.total_debt && bs.total_debt.length > 0) 
    ? (bs.total_debt[bs.total_debt.length - 1] || 0) 
    : 0;
  const totalEquityM = (bs?.total_equity && bs.total_equity.length > 0) 
    ? (bs.total_equity[bs.total_equity.length - 1] || 1000) 
    : 1000;
  const totalCap = Math.max(1, totalDebtM + totalEquityM);
  const weightDebt = totalDebtM / totalCap;
  const weightEquity = totalEquityM / totalCap;

  // Beta: extract from profile, user override, or default to verified stock/sector beta
  let detectedBeta = userBeta ?? (data?.company_profile?.beta || (data?.key_indicators?.beta as number));
  if (!detectedBeta) {
    const symUpper = (ticker || data?.ticker || '').toUpperCase();
    if (symUpper === 'TSLA') detectedBeta = 1.83;
    else if (symUpper === 'NVDA') detectedBeta = 1.75;
    else if (symUpper === 'PLTR') detectedBeta = 1.65;
    else if (symUpper === 'COIN') detectedBeta = 2.40;
    else if (symUpper === 'RIVN') detectedBeta = 2.10;
    else if (symUpper === 'SOFI') detectedBeta = 1.95;
    else if (symUpper === 'AMD') detectedBeta = 1.68;
    else detectedBeta = 1.20;
  }
  const beta = detectedBeta;

  // Cost of Equity: Ke = Rf + Beta * ERP + CRP
  const costOfEquity = Number((
    benchmark.riskFreeRate + 
    (beta * benchmark.equityRiskPremium) + 
    benchmark.countryRiskPremium
  ).toFixed(2));

  // Effective Cost of Debt: Interest Expense / Total Debt
  const interestExp = (inc?.interest_expense && inc.interest_expense.length > 0)
    ? Math.abs(Number(inc.interest_expense[inc.interest_expense.length - 1] || 0))
    : 0;
  const rawKd = totalDebtM > 0 && interestExp > 0 ? (interestExp / totalDebtM) * 100 : (benchmark.riskFreeRate + 1.2);
  const costOfDebt = Number(Math.max(benchmark.riskFreeRate, Math.min(12.0, rawKd)).toFixed(2));

  // Effective Tax Rate
  const effectiveTaxRate = (inc?.tax_rate && inc.tax_rate.length > 0)
    ? Math.max(0, Math.min(35, Number(inc.tax_rate[inc.tax_rate.length - 1] || 15)))
    : 15.0;

  // WACC = (E/V) * Ke + (D/V) * Kd * (1 - TaxRate)
  const afterTaxKd = costOfDebt * (1 - (effectiveTaxRate / 100));
  const rawWacc = (weightEquity * costOfEquity) + (weightDebt * afterTaxKd);
  
  // Rule: WACC should not fall below Local Rf + 1.5%
  const wacc = Number(Math.max(benchmark.riskFreeRate + 1.5, rawWacc).toFixed(2));

  // Check currency mismatch for ADRs (e.g. BABA, TSM, BYDDF)
  const isForeignConverted = (data?.company_profile?.currency && data.company_profile.currency !== benchmark.currency) || false;
  const currencyRiskPremium = isForeignConverted ? 0.75 : 0.00;

  return {
    region: benchmark.region,
    currency: benchmark.currency,
    risk_free_rate_pct: benchmark.riskFreeRate,
    risk_free_benchmark_label: benchmark.riskFreeLabel,
    beta: Number(beta.toFixed(2)),
    beta_benchmark_index: benchmark.benchmarkIndex,
    equity_risk_premium_pct: benchmark.equityRiskPremium,
    country_risk_premium_pct: benchmark.countryRiskPremium,
    cost_of_equity_pct: costOfEquity,
    cost_of_debt_pct: costOfDebt,
    effective_tax_rate_pct: effectiveTaxRate,
    weight_equity_pct: Number((weightEquity * 100).toFixed(1)),
    weight_debt_pct: Number((weightDebt * 100).toFixed(1)),
    wacc_pct: wacc,
    currency_risk_premium_pct: currencyRiskPremium,
    is_foreign_currency_converted: isForeignConverted
  };
}
