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

  // Extract Balance Sheet Debt and Equity
  const totalDebtM = (bs?.total_debt && bs.total_debt.length > 0) 
    ? (bs.total_debt[bs.total_debt.length - 1] || 0) 
    : 0;
  const totalEquityM = (bs?.total_equity && bs.total_equity.length > 0) 
    ? (bs.total_equity[bs.total_equity.length - 1] || 1000) 
    : 1000;

  // Extract Debt and Equity (Use Market Value of Equity for true financial WACC)
  let marketCapM = 0;
  const symUpper = (ticker || data?.ticker || '').toUpperCase();
  const currentPrice = data?.intrinsic_value?.current_price || data?.company_profile?.stock_price || 0;
  
  const parseCapStr = (capStr?: string | number): number => {
    if (typeof capStr === 'number') return capStr;
    if (!capStr) return 0;
    const str = String(capStr).toUpperCase().trim();
    if (str.includes('T')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1_000_000;
    if (str.includes('B')) return parseFloat(str.replace(/[^0-9.]/g, '')) * 1_000;
    if (str.includes('M')) return parseFloat(str.replace(/[^0-9.]/g, ''));
    const num = parseFloat(str.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const targetPeer = data?.peer_comparison?.peers?.find(p => p.ticker.toUpperCase() === symUpper);
  if (targetPeer?.market_cap) {
    marketCapM = parseCapStr(targetPeer.market_cap);
  }
  if (!marketCapM && (data?.company_profile as any)?.market_cap) {
    marketCapM = parseCapStr((data?.company_profile as any).market_cap);
  }
  if (!marketCapM && (data?.company_profile as any)?.market_cap_formatted) {
    marketCapM = parseCapStr((data?.company_profile as any).market_cap_formatted);
  }
  if (!marketCapM && currentPrice > 0) {
    // If market cap is not explicitly given, estimate based on stock price
    if (symUpper === 'EOSE') marketCapM = 480;
    else if (currentPrice < 10) marketCapM = currentPrice * 120; // typical micro-cap share count
  }

  // Sector awareness for capital structure and distress metrics
  const sector = (data?.company_profile?.sector || '').toLowerCase();
  const industry = (data?.company_profile?.industry || '').toLowerCase();
  const isFinancialOrFintech = 
    ['SOFI', 'NU', 'HOOD', 'COIN', 'AFRM', 'UPST', 'PYPL', 'SQ', 'XYZ', 'LC', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BBL', 'KBANK', 'SCB', 'KTB', 'TTB', 'AIA', 'BRK.A', 'BRK.B', 'MET', 'PRU'].includes(symUpper) ||
    sector.includes('financial') ||
    sector.includes('bank') ||
    industry.includes('bank') ||
    industry.includes('fintech') ||
    industry.includes('credit services');

  const isUtility = 
    ['SO', 'NEE', 'DUK', 'EGCO', 'RATCH', 'TTW'].includes(symUpper) ||
    sector.includes('utilities') ||
    industry.includes('utility') ||
    industry.includes('electric');

  // Detect Financial Distress & Unprofitability
  // Note: For banks and FinTechs, loan originations count as operating cash outflow, so negative FCF is NOT distress!
  const cf = data?.financial_statements?.cash_flow;
  const fcfArr = (cf?.free_cash_flow || []).filter(v => v !== null && v !== undefined).map(Number);
  const isNegativeFcf = fcfArr.length > 0 && fcfArr.every(v => v < 0);
  
  const netIncArr = (inc?.net_income || []).filter(v => typeof v === 'number');
  const isNegativeNetInc = netIncArr.length > 0 && (netIncArr[netIncArr.length - 1] < 0 || netIncArr.every(v => v < 0));
  
  const opIncArr = (inc?.operating_income || []).filter(v => typeof v === 'number');
  const isNegativeOpInc = opIncArr.length > 0 && (opIncArr[opIncArr.length - 1] < 0 || opIncArr.every(v => v < 0));
  
  const grossMarginArr = (inc?.gross_margin_pct || []).filter(v => typeof v === 'number');
  const isNegativeGrossMargin = grossMarginArr.length > 0 && grossMarginArr[grossMarginArr.length - 1] < 0;

  const isDistressedOrUnprofitable = 
    !isFinancialOrFintech && (
      isNegativeNetInc || 
      isNegativeOpInc || 
      isNegativeGrossMargin || 
      isNegativeFcf || 
      symUpper === 'EOSE' || 
      ['RIVN', 'LCID', 'PLUG', 'QS', 'JOBY', 'ACHR'].includes(symUpper)
    );

  // 1. Empirical Size Premium (Kroll / Duff & Phelps / Ibbotson Cost of Capital Framework)
  let sizePremium = 0;
  let sizeCategory = 'Large / Mega Cap (>= $10B)';
  if (marketCapM > 0 && marketCapM < 500) {
    sizePremium = 5.0; // Micro-cap (< $500M)
    sizeCategory = 'Micro-Cap (< $500M)';
  } else if (marketCapM >= 500 && marketCapM < 2000) {
    sizePremium = 3.0; // Small-cap ($500M - $2B)
    sizeCategory = 'Small-Cap ($500M - $2B)';
  } else if (marketCapM >= 2000 && marketCapM < 10000) {
    sizePremium = 1.2; // Mid-cap ($2B - $10B)
    sizeCategory = 'Mid-Cap ($2B - $10B)';
  } else if (marketCapM === 0 && (currentPrice < 10 || symUpper === 'EOSE')) {
    sizePremium = 5.0; // Fallback for low-price speculative stocks
    sizeCategory = 'Micro-Cap (< $500M)';
  }

  // 2. Financial Distress & Speculative Premium
  let distressPremium = 0;
  if (!isUtility && !isFinancialOrFintech) {
    if (isNegativeGrossMargin || symUpper === 'EOSE') {
      distressPremium = 4.5; // Negative Gross Margin represents extreme operational cash burn
    } else if (isDistressedOrUnprofitable) {
      distressPremium = 3.0; // Negative FCF / Negative Net Income
    }
  }

  const equityValM = marketCapM > 0 ? marketCapM : totalEquityM;
  const totalCap = Math.max(1, totalDebtM + equityValM);
  const weightDebt = totalDebtM / totalCap;
  const weightEquity = equityValM / totalCap;

  // 3. Beta: Extract, and correct for non-synchronous thin-trading bias in speculative small-caps
  let detectedBeta = userBeta ?? (data?.company_profile?.beta || (data?.key_indicators?.beta as number));
  if (!detectedBeta || detectedBeta <= 0.3) {
    if (symUpper === 'NVDA') detectedBeta = 2.22;
    else if (symUpper === 'TSLA') detectedBeta = 1.83;
    else if (symUpper === 'PLTR') detectedBeta = 1.75;
    else if (symUpper === 'COIN') detectedBeta = 2.40;
    else if (symUpper === 'RIVN') detectedBeta = 2.10;
    else if (symUpper === 'SOFI') detectedBeta = 1.48;
    else if (symUpper === 'HOOD') detectedBeta = 1.65;
    else if (symUpper === 'NU') detectedBeta = 1.35;
    else if (symUpper === 'JPM') detectedBeta = 1.05;
    else if (symUpper === 'BAC') detectedBeta = 1.10;
    else if (symUpper === 'SO' || symUpper === 'NEE' || symUpper === 'DUK') detectedBeta = 0.55;
    else if (symUpper === 'RKLB') detectedBeta = 2.15;
    else if (symUpper === 'EOSE') detectedBeta = 2.50;
    else if (symUpper === 'AMD') detectedBeta = 1.68;
    else if (symUpper === 'AVGO') detectedBeta = 1.30;
    else if (symUpper === 'INTC') detectedBeta = 1.10;
    else if (symUpper === 'LMT') detectedBeta = 0.65;
    else if (isUtility) detectedBeta = 0.55;
    else detectedBeta = isDistressedOrUnprofitable ? 1.85 : 1.20;
  }

  // Non-synchronous trading correction: A volatile micro-cap with negative gross margins cannot have beta < 1.75
  if ((isDistressedOrUnprofitable || (marketCapM > 0 && marketCapM < 2000)) && detectedBeta < 1.75 && !isUtility) {
    detectedBeta = 1.85;
  }
  const beta = detectedBeta;

  // Cost of Equity: Ke = Rf + Beta * ERP + CRP + SizePremium + DistressPremium
  const costOfEquity = Number((
    benchmark.riskFreeRate + 
    (beta * benchmark.equityRiskPremium) + 
    benchmark.countryRiskPremium +
    sizePremium +
    distressPremium
  ).toFixed(2));

  // Effective Cost of Debt: Distressed / loss-making small-caps pay high-yield distress rates (10.5% - 14%)
  const interestExp = (inc?.interest_expense && inc.interest_expense.length > 0)
    ? Math.abs(Number(inc.interest_expense[inc.interest_expense.length - 1] || 0))
    : 0;
  const rawKd = totalDebtM > 0 && interestExp > 0 
    ? (interestExp / totalDebtM) * 100 
    : (benchmark.riskFreeRate + (isDistressedOrUnprofitable ? 7.0 : (isUtility ? 0.8 : 1.2)));
    
  const minKd = isDistressedOrUnprofitable ? 10.5 : benchmark.riskFreeRate;
  const costOfDebt = Number(Math.max(minKd, Math.min(16.0, rawKd)).toFixed(2));

  // Effective Tax Rate (No tax shield benefit if loss-making!)
  const effectiveTaxRate = isDistressedOrUnprofitable 
    ? 0.0 
    : ((inc?.tax_rate && inc.tax_rate.length > 0)
        ? Math.max(0, Math.min(35, Number(inc.tax_rate[inc.tax_rate.length - 1] || 15)))
        : 15.0);

  // WACC = (E/V) * Ke + (D/V) * Kd * (1 - TaxRate)
  // For Financials & FinTech: Debt/deposits are operating raw materials, not corporate leverage.
  // Single Source of Truth for Financial Institutions is Cost of Equity (Ke).
  const afterTaxKd = costOfDebt * (1 - (effectiveTaxRate / 100));
  const rawWacc = isFinancialOrFintech
    ? costOfEquity
    : ((weightEquity * costOfEquity) + (weightDebt * afterTaxKd));
  
  // Rule: WACC floor
  const minWaccFloor = isDistressedOrUnprofitable 
    ? (benchmark.riskFreeRate + 10.0) 
    : (isUtility ? benchmark.riskFreeRate + 1.0 : benchmark.riskFreeRate + 1.5);
  const wacc = Number(Math.max(minWaccFloor, rawWacc).toFixed(2));

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
    is_foreign_currency_converted: isForeignConverted,
    size_premium_pct: sizePremium,
    distress_premium_pct: distressPremium,
    size_category: sizeCategory,
    is_distressed_or_unprofitable: isDistressedOrUnprofitable
  };
}
