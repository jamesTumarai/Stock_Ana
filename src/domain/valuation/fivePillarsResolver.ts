import type {
  ReportData,
  FivePillarsData,
  FivePillarsGrowthData,
  FivePillarsResolvedMetric,
  FivePillarsProfitabilityData,
  FivePillarsBalanceSheetData,
  FivePillarsYieldsData,
} from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext';
import { DataGapState } from '../dataCompleteness/types';
import { findKeyIndicatorInSource } from '../metricLineage';
import { discoverPeers } from './peerDiscoveryEngine';
import { resolveFundamentalMetrics } from './metricRegistry';
import { getFivePillarMetricPolicy } from './fivePillarMetricPolicy';
import type { AdaptiveFivePillarsResult, AdaptivePillarMetric, AdaptivePillarSection } from './types';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

/**
 * Resolves verified canonical metrics for Five Pillars across all business archetypes.
 * Enforces:
 * 1. One Canonical Data Source (Key Indicators facts flow directly into Five Pillars)
 * 2. Adaptive Pillar structure and labels by Business Archetype
 * 3. Financial Sector Guard (FCF/Cash-Debt Fortress guarded for banks/lenders)
 * 4. Distinct N/A semantics (GUARDED_FOR_BUSINESS_MODEL, NOT_APPLICABLE, NOT_REPORTED)
 * 5. TTM vs Forward Earnings Yield identification
 * 6. Shareholder Yield (Dividend + Net Buyback) & FCF Quality (FCF Conversion)
 * 7. ROIC - WACC Value Creation Spread with conservative grounding
 * 8. Net Cash vs Net Debt solvency adaptation
 */
export function resolveAdaptiveFivePillars(
  report: Partial<ReportData>,
  ticker?: string
): AdaptiveFivePillarsResult {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
  const subIndustry = (report.company_profile as any)?.sub_industry || report.company_profile?.industry;
  const policy = getFivePillarMetricPolicy(archetype, subIndustry);

  const fs = report.financial_statements;
  const periods = fs?.periods || [];
  const lastIndex = Math.max(0, periods.length - 1);
  const latestPeriod = periods[lastIndex] || 'Latest';

  const at = (arr?: (number | null)[]) => (finite(arr?.[lastIndex]) ? arr![lastIndex]! : undefined);

  // 1. Helper to retrieve verified key indicators from report
  const getKi = (key: string): number | undefined => {
    // Check root key_indicators first
    const rootKi = report.key_indicators as any;
    if (rootKi?.[key] !== undefined && finite(rootKi[key])) {
      return rootKi[key];
    }
    // Also check rootKi sub-objects e.g. rootKi.growth?.[key], rootKi.profitability?.[key]
    for (const subKey of ['growth', 'profitability', 'valuation', 'financial_health', 'per_share']) {
      if (rootKi?.[subKey]?.[key] !== undefined && finite(rootKi[subKey][key])) {
        return rootKi[subKey][key];
      }
    }

    // Check financial_statements.key_indicators
    const found = findKeyIndicatorInSource(fs?.key_indicators, key) || findKeyIndicatorInSource(rootKi, key);
    if (found && found.values.length > 0) {
      const val = found.values[found.values.length - 1];
      if (finite(val)) return val;
    }
    return undefined;
  };

  // 2. Extract canonical income statement, balance sheet, cash flow
  const inc = fs?.income_statement;
  const bs = fs?.balance_sheet;
  const cf = fs?.cash_flow;

  const rev = at(inc?.revenue);
  const netInc = at(inc?.net_income);
  const opInc = at(inc?.operating_income);
  const grossProfit = at(inc?.gross_profit);

  const cash = at(bs?.cash_and_equivalents);
  const stInvestments = at(bs?.short_term_investments);
  const totalDebt = at(bs?.total_debt) ?? (
    at(bs?.short_term_debt) !== undefined && at(bs?.long_term_debt) !== undefined
      ? (at(bs?.short_term_debt) as number) + (at(bs?.long_term_debt) as number)
      : undefined
  );
  const totalEquity = at(bs?.total_equity);

  const totalCash = cash !== undefined
    ? cash + (stInvestments ?? 0)
    : undefined;

  const netCashOrDebt = totalCash !== undefined && totalDebt !== undefined
    ? rounded((totalCash - totalDebt) / 1000)
    : undefined;

  // 3. Resolve canonical fundamental metrics from single domain registry
  const resolvedMetrics = resolveFundamentalMetrics(report, sym);
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);

  // Discover peers early so that Pillar 2 & 5 benchmark comparisons cross-reference actual coverage
  const peerDiscovery = discoverPeers(report, sym, { targetMetrics: resolvedMetrics });
  const peerMatrix = peerDiscovery.benchmarkRows;

  const growthData: FivePillarsGrowthData = {
    revenue_growth_yoy_pct: typeof resolvedMetrics.revenueGrowthYoY.value === 'number' ? resolvedMetrics.revenueGrowthYoY.value : undefined,
    eps_growth_yoy_pct: typeof resolvedMetrics.epsGrowthYoY.value === 'number' ? resolvedMetrics.epsGrowthYoY.value : undefined,
    eps_growth_basis: resolvedMetrics.epsGrowthYoY.reason || (typeof resolvedMetrics.epsGrowthYoY.value === 'number' ? `SEC Diluted EPS YoY (${resolvedMetrics.epsGrowthYoY.basis || 'TTM'})` : undefined),
    fcf_growth_yoy_pct: isFinancial ? undefined : (typeof resolvedMetrics.fcfGrowthYoY.value === 'number' ? resolvedMetrics.fcfGrowthYoY.value : undefined),
    fcf_growth_status: resolvedMetrics.fcfGrowthYoY.status,
    fcf_growth_basis: resolvedMetrics.fcfGrowthYoY.reason || resolvedMetrics.fcfGrowthYoY.reasonTh,
    revenue_cagr_3yr_pct: typeof resolvedMetrics.revenueCagr3Y.value === 'number' ? resolvedMetrics.revenueCagr3Y.value : undefined,
    revenue_cagr_status: resolvedMetrics.revenueCagr3Y.status,
    revenue_cagr_basis: resolvedMetrics.revenueCagr3Y.reason || resolvedMetrics.revenueCagr3Y.reasonTh,
    peg_ratio: typeof resolvedMetrics.peg.value === 'number' ? resolvedMetrics.peg.value : undefined,
    peg_interpretation: resolvedMetrics.peg.reasonTh || resolvedMetrics.peg.reason || 'N/A',
    peg_status: resolvedMetrics.peg.status,
    peg_basis: resolvedMetrics.peg.basis,
    resolved_metrics: {
      eps_growth_yoy: resolvedMetrics.epsGrowthYoY,
      fcf_growth_yoy: resolvedMetrics.fcfGrowthYoY,
      revenue_cagr_3y: resolvedMetrics.revenueCagr3Y,
      pe_trailing: resolvedMetrics.peTrailing,
      peg: resolvedMetrics.peg,
    },
  };

  // 4. Resolve Pillar 2: Profitability & Returns
  const nim = getKi('nim') ?? getKi('net_interest_margin_pct');
  const efficiencyRatio = getKi('efficiency_ratio') ?? getKi('efficiency_ratio_pct');

  let capitalEfficiencyVerdict = 'N/A';
  if (isFinancial) {
    capitalEfficiencyVerdict = typeof resolvedMetrics.roe.value === 'number'
      ? `ROE ${resolvedMetrics.roe.value}% สะท้อนอัตราผลตอบแทนต่อส่วนผู้ถือหุ้นของสถาบันการเงิน${nim !== undefined ? ` พร้อม NIM ${nim}%` : ''}`
      : 'วิเคราะห์ผลตอบแทนสถาบันการเงินผ่าน ROE, ROA และ NIM';
  } else if (typeof resolvedMetrics.roicWaccSpread.value === 'number') {
    const spread = resolvedMetrics.roicWaccSpread.value;
    const roic = resolvedMetrics.roic.value;
    const wacc = resolvedMetrics.wacc.value;
    capitalEfficiencyVerdict = spread > 0
      ? `ROIC (${roic}%) สูงกว่า WACC (${wacc}%) อยู่ +${spread}% Spread ยืนยันการสร้างมูลค่าเพิ่มทางเศรษฐกิจ (EVA > 0)`
      : `ROIC (${roic}%) ต่ำกว่า WACC (${wacc}%) อยู่ ${spread}% Spread สะท้อนผลตอบแทนเงินลงทุนยังไม่ครอบคลุมต้นทุนเงินทุน`;
  } else if (typeof resolvedMetrics.roic.value === 'number') {
    const roicVal = resolvedMetrics.roic.value;
    const roicRow = peerMatrix.find(r => r.metric_name === 'ROIC' || r.metric_key === 'roic_pct');
    const hasValidPeerRoic = Boolean(
      roicRow &&
      roicRow.peer_coverage_status !== 'INSUFFICIENT' &&
      typeof peerDiscovery.medians.roic_pct === 'number'
    );
    if (hasValidPeerRoic) {
      const roicMed = peerDiscovery.medians.roic_pct as number;
      const isLimited = roicRow?.peer_coverage_status === 'LIMITED';
      const limitedSuffix = isLimited ? ' (กลุ่มตัวอย่างจำกัด)' : '';
      capitalEfficiencyVerdict = roicVal > roicMed
        ? `ROIC ${roicVal}% สูงกว่าค่ากลางกลุ่มคู่แข่ง (${roicMed}%)${limitedSuffix}`
        : roicVal < roicMed
          ? `ROIC ${roicVal}% ต่ำกว่าค่ากลางกลุ่มคู่แข่ง (${roicMed}%)${limitedSuffix}`
          : `ROIC ${roicVal}% ใกล้เคียงค่ากลางกลุ่มคู่แข่ง (${roicMed}%)${limitedSuffix}`;
    } else {
      // Neutral target-only canonical narrative without false peer-median comparisons
      capitalEfficiencyVerdict = roicVal > 15
        ? `ROIC ${roicVal}% ตามฐาน TTM NOPAT / Average Invested Capital สะท้อนประสิทธิภาพการจัดสรรเงินทุนระดับสูง`
        : roicVal > 8
          ? `ROIC ${roicVal}% ตามฐาน TTM NOPAT / Average Invested Capital อยู่ในระดับมาตรฐาน`
          : `ROIC ${roicVal}% ตามฐาน TTM NOPAT / Average Invested Capital อยู่ในเกณฑ์ชะลอตัว`;
    }
  } else if (typeof resolvedMetrics.roe.value === 'number') {
    capitalEfficiencyVerdict = `ROE ${resolvedMetrics.roe.value}% สะท้อนผลตอบแทนต่อส่วนของผู้ถือหุ้น`;
  }

  const profitabilityData: FivePillarsProfitabilityData = {
    net_margin_pct: typeof resolvedMetrics.netMargin.value === 'number' ? resolvedMetrics.netMargin.value : undefined,
    operating_margin_pct: typeof resolvedMetrics.operatingMargin.value === 'number' ? resolvedMetrics.operatingMargin.value : undefined,
    gross_margin_pct: isFinancial ? undefined : (typeof resolvedMetrics.grossMargin.value === 'number' ? resolvedMetrics.grossMargin.value : undefined),
    roe_pct: typeof resolvedMetrics.roe.value === 'number' ? resolvedMetrics.roe.value : undefined,
    roic_pct: isFinancial ? undefined : (typeof resolvedMetrics.roic.value === 'number' ? resolvedMetrics.roic.value : undefined),
    roic_basis: resolvedMetrics.roic.basis,
    roic_formula: resolvedMetrics.roic.formula,
    roe_basis: resolvedMetrics.roe.basis,
    roa_basis: resolvedMetrics.roa.basis,
    gross_margin_basis: resolvedMetrics.grossMargin.basis,
    operating_margin_basis: resolvedMetrics.operatingMargin.basis,
    net_margin_basis: resolvedMetrics.netMargin.basis,
    roa_pct: typeof resolvedMetrics.roa.value === 'number' ? resolvedMetrics.roa.value : undefined,
    net_interest_margin_pct: isFinancial ? nim : undefined,
    efficiency_ratio_pct: isFinancial ? efficiencyRatio : undefined,
    fcf_margin_pct: isFinancial ? undefined : (typeof resolvedMetrics.fcfMargin.value === 'number' ? resolvedMetrics.fcfMargin.value : undefined),
    fcf_margin_basis: isFinancial ? undefined : resolvedMetrics.fcfMargin.basis,
    wacc_pct: isFinancial ? undefined : (typeof resolvedMetrics.wacc.value === 'number' ? resolvedMetrics.wacc.value : undefined),
    roic_wacc_spread_pct: isFinancial ? undefined : (typeof resolvedMetrics.roicWaccSpread.value === 'number' ? resolvedMetrics.roicWaccSpread.value : undefined),
    roic_wacc_status: resolvedMetrics.roicWaccSpread.status,
    roic_wacc_verdict: capitalEfficiencyVerdict,
    combined_ratio_pct: typeof resolvedMetrics.combinedRatio.value === 'number' ? resolvedMetrics.combinedRatio.value : undefined,
    underwriting_margin_pct: typeof resolvedMetrics.combinedRatio.value === 'number' ? rounded(100 - resolvedMetrics.combinedRatio.value) : undefined,
    capital_efficiency_verdict: capitalEfficiencyVerdict,
    resolved_metrics: {
      roic: resolvedMetrics.roic,
      roe: resolvedMetrics.roe,
      roa: resolvedMetrics.roa,
      gross_margin: resolvedMetrics.grossMargin,
      operating_margin: resolvedMetrics.operatingMargin,
      net_margin: resolvedMetrics.netMargin,
    },
  };

  // 5. Resolve Pillar 3: Balance Sheet / Financial Health
  let balanceSheetTitle = isFinancial ? 'Capital & Funding' : 'Financial Strength';
  let balanceSheetSummary = '';
  if (isFinancial) {
    balanceSheetTitle = archetype === 'bank' ? 'Capital & Deposits' : 'Capital & Funding';
    balanceSheetSummary = 'สถาบันการเงินใช้เงินฝากและวงเงินสินเชื่อเป็นสินค้าคงคลังในการดำเนินงาน (Operating Inventory) โครงสร้างเงินทุนจึงวัดด้วยความเพียงพอของเงินกองทุนและการจัดหาทุน';
  }

  const debtToEquity = at(bs?.debt_to_equity) ?? getKi('debt_to_equity') ?? (totalDebt !== undefined && totalEquity !== undefined && totalEquity > 0 ? rounded(totalDebt / totalEquity) : undefined);
  const interestCoverageMetric = resolvedMetrics.interestCoverage;
  const interestCoverage = typeof interestCoverageMetric.value === 'number' ? interestCoverageMetric.value : undefined;
  const cashRunway = resolvedMetrics.cashRunwayMonths.value ?? getKi('cash_runway_months');

  let solvencyScoreLabel = 'ฐานะการเงินระดับมาตรฐาน';
  if (isFinancial) {
    solvencyScoreLabel = 'โครงสร้างเงินทุนสถาบันการเงิน: เงินฝากและพอร์ตสินเชื่อเป็นวัตถุดิบดำเนินงาน (Financial Sector Guard บังคับใช้)';
  } else if (archetype === 'early_stage' && cashRunway !== undefined) {
    solvencyScoreLabel = `ระยะเวลากระแสเงินสดคงเหลือประมาณ ${cashRunway} เดือน`;
  } else if (!isFinancial) {
    if (netCashOrDebt !== undefined && netCashOrDebt > 0) {
      const mcapPctSuffix = resolvedMetrics.netCashToMarketCap.value !== null && resolvedMetrics.netCashToMarketCap.value !== undefined
        ? ` คิดเป็น ${resolvedMetrics.netCashToMarketCap.value}% ของมูลค่าตลาด`
        : '';
      solvencyScoreLabel = `สถานะเงินสดสุทธิ (Net Cash +$${netCashOrDebt}B${mcapPctSuffix}) มีความมั่นคงทางการเงินสูง`;
    } else if (resolvedMetrics.netDebtToEbitda.status === 'CALCULATED' && typeof resolvedMetrics.netDebtToEbitda.value === 'number') {
      solvencyScoreLabel = `ภาระหนี้สินสุทธิต่อ EBITDA ${resolvedMetrics.netDebtToEbitda.value}x อยู่ในเกณฑ์บริหารจัดการได้ (D/E ${debtToEquity ?? 'N/A'}x)`;
    } else if (debtToEquity !== undefined && debtToEquity <= 1.0) {
      solvencyScoreLabel = `ภาระหนี้สินอยู่ในเกณฑ์บริหารจัดการได้ (D/E ${debtToEquity}x)`;
    } else if (debtToEquity !== undefined && debtToEquity > 2.0) {
      solvencyScoreLabel = `ภาระหนี้สินค่อนข้างสูง (D/E ${debtToEquity}x) ควรติดตามกระแสเงินสดดำเนินงาน`;
    } else if (netCashOrDebt !== undefined) {
      solvencyScoreLabel = netCashOrDebt >= 0
        ? `เงินสดสุทธิ (Net Cash) $${Math.abs(netCashOrDebt)}B สะท้อนฐานะการเงินที่มั่นคง`
        : `หนี้สินสุทธิ (Net Debt) $${Math.abs(netCashOrDebt)}B มีภาระหนี้สินสุทธิที่ต้องบริหารจัดการ`;
    }
  }

  const balanceSheetData: FivePillarsBalanceSheetData = {
    total_cash_and_investments_b: totalCash !== undefined ? rounded(totalCash / 1000) : undefined,
    total_debt_b: totalDebt !== undefined ? rounded(totalDebt / 1000) : undefined,
    net_cash_or_debt_b: isFinancial ? undefined : (netCashOrDebt !== undefined ? Math.abs(netCashOrDebt) : undefined),
    is_net_cash: isFinancial ? undefined : (netCashOrDebt !== undefined ? netCashOrDebt >= 0 : undefined),
    debt_to_equity: debtToEquity,
    interest_coverage: isFinancial ? undefined : interestCoverage,
    interest_coverage_status: interestCoverageMetric.status,
    interest_coverage_reason: interestCoverageMetric.reasonTh || interestCoverageMetric.reason,
    interest_coverage_basis: interestCoverageMetric.basis,
    interest_coverage_formula: interestCoverageMetric.formula,
    interest_coverage_source: interestCoverageMetric.source,
    net_cash_to_market_cap_pct: isFinancial ? undefined : (typeof resolvedMetrics.netCashToMarketCap.value === 'number' ? resolvedMetrics.netCashToMarketCap.value : undefined),
    net_debt_to_ebitda: isFinancial ? undefined : (typeof resolvedMetrics.netDebtToEbitda.value === 'number' ? resolvedMetrics.netDebtToEbitda.value : undefined),
    net_debt_to_ebitda_status: resolvedMetrics.netDebtToEbitda.status,
    net_debt_to_ebitda_reason: resolvedMetrics.netDebtToEbitda.reasonTh || resolvedMetrics.netDebtToEbitda.reason,
    current_ratio: isFinancial ? undefined : (typeof resolvedMetrics.currentRatio.value === 'number' ? resolvedMetrics.currentRatio.value : undefined),
    quick_ratio: isFinancial ? undefined : (typeof resolvedMetrics.quickRatio.value === 'number' ? resolvedMetrics.quickRatio.value : undefined),
    cash_runway_months: typeof resolvedMetrics.cashRunwayMonths.value === 'number' ? resolvedMetrics.cashRunwayMonths.value : undefined,
    cash_burn_annual_b: typeof resolvedMetrics.cashBurnRate.value === 'number' ? resolvedMetrics.cashBurnRate.value : undefined,
    solvency_score_label: solvencyScoreLabel,
  };

  // 6. Resolve Pillar 4: Yields Perspective & Shareholder Return
  // Treasury 10Y Benchmark: strictly from verified source, NEVER fall back to hardcoded constant
  const treasury10Yr = report.five_pillars?.yields?.treasury_10yr_yield_pct;
  const treasuryAsOf = report.five_pillars?.yields?.treasury_as_of_date;
  const treasurySource = report.five_pillars?.yields?.treasury_source;

  const pfcfRatio = report.valuation_ratios?.find(r => /P\/FCF/i.test(r.name))?.value;
  const earningsYield = resolvedMetrics.earningsYield.value;
  const earningsYieldBasis = resolvedMetrics.earningsYield.basis;
  const fcfYield = resolvedMetrics.fcfYield.value;
  let isFcfGuarded = false;
  let fcfGuardReason: string | undefined;

  if (isFinancial) {
    isFcfGuarded = true;
    fcfGuardReason = 'Not used — Financial Sector Guard';
  }

  const divYieldVal = typeof resolvedMetrics.dividendYield.value === 'number' ? resolvedMetrics.dividendYield.value : undefined;
  const netBuybackVal = typeof resolvedMetrics.netBuybackYield.value === 'number' ? resolvedMetrics.netBuybackYield.value : undefined;
  const shareholderYieldVal = typeof resolvedMetrics.shareholderYield.value === 'number' ? resolvedMetrics.shareholderYield.value : undefined;
  const fcfConversionVal = typeof resolvedMetrics.fcfConversion.value === 'number' ? resolvedMetrics.fcfConversion.value : undefined;

  let yieldInterpretation = 'N/A';
  if (isFinancial) {
    if (shareholderYieldVal !== undefined) {
      yieldInterpretation = `Shareholder Yield ${shareholderYieldVal}% สำหรับสถาบันการเงิน (ปันผล ${divYieldVal ?? 0}% + ซื้อหุ้นคืน ${netBuybackVal ?? 0}%)`;
    } else if (earningsYield !== undefined) {
      yieldInterpretation = `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% สะท้อนผลตอบแทนจากกำไรสุทธิสถาบันการเงิน`;
    } else {
      yieldInterpretation = 'การประเมินผลตอบแทนสถาบันการเงินอิงตาม P/E, P/B และผลตอบแทนจากกำไร';
    }
  } else {
    const shText = shareholderYieldVal !== undefined ? `Shareholder Yield ${shareholderYieldVal}%` : undefined;
    const fcfConvText = fcfConversionVal !== undefined ? `FCF Conversion ${fcfConversionVal}%` : undefined;
    const fcfYieldText = fcfYield !== undefined ? `FCF Yield ${fcfYield}%` : undefined;

    if (shText && fcfConvText) {
      yieldInterpretation = `${shText} พร้อม ${fcfConvText} สะท้อนคุณภาพกำไรและการจัดสรรเงินสดคืนสู่ผู้ถือหุ้นจริง`;
    } else if (shText) {
      yieldInterpretation = `${shText} สะท้อนผลตอบแทนเงินสดรวมสู่ผู้ถือหุ้นผ่านเงินปันผลและการซื้อหุ้นคืนสุทธิ`;
    } else if (fcfYieldText) {
      yieldInterpretation = `${fcfYieldText} สะท้อนผลตอบแทนกระแสเงินสดอิสระต่อมูลค่าตลาด`;
    } else if (earningsYield !== undefined) {
      yieldInterpretation = `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% สะท้อนผลตอบแทนจากกำไรสุทธิ`;
    }
  }

  let yieldSpread: number | undefined;
  if (treasury10Yr !== undefined) {
    if (fcfYield !== undefined) {
      yieldSpread = rounded(fcfYield - treasury10Yr);
    } else if (earningsYield !== undefined) {
      yieldSpread = rounded(earningsYield - treasury10Yr);
    }
  }

  const yieldsData: FivePillarsYieldsData = {
    pe_multiple: resolvedMetrics.peTrailing.value,
    earnings_yield_pct: earningsYield,
    earnings_yield_basis: earningsYieldBasis,
    pfcf_multiple: isFinancial ? undefined : pfcfRatio,
    fcf_yield_pct: isFinancial ? undefined : fcfYield,
    fcf_yield_quarters_used: isFinancial ? undefined : resolvedMetrics.fcfYield.quartersUsed,
    fcf_yield_inputs_used: isFinancial ? undefined : resolvedMetrics.fcfYield.inputsUsed,
    is_fcf_guarded: isFcfGuarded ? true : undefined,
    fcf_guard_reason: isFcfGuarded ? fcfGuardReason : undefined,
    dividend_yield_pct: divYieldVal,
    net_buyback_yield_pct: netBuybackVal,
    shareholder_yield_pct: shareholderYieldVal,
    fcf_conversion_pct: fcfConversionVal,
    fcf_conversion_quarters_used: resolvedMetrics.fcfConversion.quartersUsed,
    fcf_conversion_inputs_used: resolvedMetrics.fcfConversion.inputsUsed,
    fcf_conversion_basis: resolvedMetrics.fcfConversion.basis,
    fcf_conversion_status: resolvedMetrics.fcfConversion.status,
    fcf_conversion_reason: resolvedMetrics.fcfConversion.reason,
    fcf_conversion_reason_th: resolvedMetrics.fcfConversion.reasonTh,
    treasury_10yr_yield_pct: treasury10Yr,
    treasury_as_of_date: treasuryAsOf,
    treasury_source: treasurySource,
    yield_spread_vs_treasury: yieldSpread,
    yield_interpretation: yieldInterpretation,
  };

  // 7. Resolve Pillar 5: Peer Discovery & Growth vs Profitability classification
  const targetRevGrowth = typeof resolvedMetrics.revenueGrowthYoY.value === 'number' ? resolvedMetrics.revenueGrowthYoY.value : undefined;
  const peerMedRevGrowth = typeof peerDiscovery.medians.revenue_growth_yoy_pct === 'number' ? peerDiscovery.medians.revenue_growth_yoy_pct : undefined;
  const targetMargin = typeof resolvedMetrics.operatingMargin.value === 'number'
    ? resolvedMetrics.operatingMargin.value
    : typeof resolvedMetrics.netMargin.value === 'number'
      ? resolvedMetrics.netMargin.value
      : undefined;
  const marginMetricKey = typeof resolvedMetrics.operatingMargin.value === 'number' ? 'operating_margin_pct' : 'net_margin_pct';
  const peerMedMargin = typeof peerDiscovery.medians[marginMetricKey] === 'number' ? peerDiscovery.medians[marginMetricKey] : undefined;

  let growthVsProfitability = 'INSUFFICIENT_PEER_SAMPLE';
  let growthVsProfitabilityTh = 'ข้อมูลเทียบเคียงคู่แข่งไม่เพียงพอ';
  if (peerDiscovery.peerCount >= 2 && targetRevGrowth !== undefined && peerMedRevGrowth !== undefined && targetMargin !== undefined && peerMedMargin !== undefined) {
    const revDiff = targetRevGrowth - peerMedRevGrowth;
    const marginDiff = targetMargin - peerMedMargin;
    if (revDiff > 1 && marginDiff > 1) {
      growthVsProfitability = 'Growth Premium / Margin Premium';
      growthVsProfitabilityTh = 'พรีเมียมทั้งการเติบโตและอัตรากำไร (สูงกว่าค่ากลางกลุ่ม)';
    } else if (revDiff > 1 && marginDiff < -1) {
      growthVsProfitability = 'Growth Premium / Margin Discount';
      growthVsProfitabilityTh = 'การเติบโตสูงกว่าค่ากลาง แต่อัตรากำไรต่ำกว่าค่ากลาง';
    } else if (revDiff < -1 && marginDiff > 1) {
      growthVsProfitability = 'Margin Leader / Mature Growth';
      growthVsProfitabilityTh = 'ผู้นำอัตรากำไร / การเติบโตแบบธุรกิจมั่นคง';
    } else if (revDiff < -1 && marginDiff < -1) {
      growthVsProfitability = 'Underperformer / Turnaround';
      growthVsProfitabilityTh = 'ต่ำกว่าค่ากลางทั้งการเติบโตและอัตรากำไร (อยู่ในช่วงฟื้นตัว)';
    } else {
      growthVsProfitability = 'In Line / Neutral';
      growthVsProfitabilityTh = 'สอดคล้องกับค่ากลางกลุ่มอุตสาหกรรม';
    }
  }

  // Build missing reason mapping for user-facing precision
  const unavailableReasons: Record<string, string> = {};
  if (growthData.eps_growth_yoy_pct === undefined) {
    unavailableReasons.eps_growth = resolvedMetrics.epsGrowthYoY.reason || 'Insufficient comparable EPS history';
  }
  if (profitabilityData.roic_pct === undefined && !isFinancial) {
    unavailableReasons.roic = resolvedMetrics.roic.reason || 'Insufficient verified invested-capital inputs';
  }
  if (balanceSheetData.interest_coverage === undefined && !isFinancial) {
    unavailableReasons.interest_coverage = interestCoverageMetric.reason || 'Missing period-matched interest expense';
  }
  if (peerMatrix.length === 0) {
    unavailableReasons.peer = 'No verified comparable candidates';
  }
  if (yieldsData.treasury_10yr_yield_pct === undefined) {
    unavailableReasons.treasury = 'Current official observation unavailable';
  }

  // Build the FivePillarsData object
  const fivePillarsData: FivePillarsData = {
    as_of_date: report.as_of_date || new Date().toISOString().split('T')[0],
    archetype,
    pillar_titles: {
      growth: policy.pillar1.titleTh,
      profitability: policy.pillar2.titleTh,
      balance_sheet: policy.pillar3.titleTh,
      yields: policy.pillar4.titleTh,
      peer_matrix: policy.pillar5.titleTh,
    },
    growth: growthData,
    profitability: profitabilityData,
    balance_sheet: balanceSheetData,
    yields: yieldsData,
    peer_matrix: peerMatrix,
    unavailable_reasons: unavailableReasons,
    growth_vs_profitability: growthVsProfitability,
    growth_vs_profitability_th: growthVsProfitabilityTh,
    growth_vs_profitability_details: {
      target_rev_growth: targetRevGrowth,
      peer_median_rev_growth: peerMedRevGrowth,
      target_margin: targetMargin,
      peer_median_margin: peerMedMargin,
      margin_metric: marginMetricKey,
    },
    shareholder_return_summary: {
      dividend_yield: divYieldVal,
      net_buyback_yield: netBuybackVal,
      shareholder_yield: shareholderYieldVal,
      summary_en: shareholderYieldVal !== undefined
        ? netBuybackVal !== undefined && netBuybackVal < 0
          ? `Shareholder Yield ${shareholderYieldVal}% reflects dividend yield of ${divYieldVal ?? 0}% offset by ${Math.abs(netBuybackVal)}% net share dilution.`
          : `Shareholder Yield ${shareholderYieldVal}% consists of ${divYieldVal ?? 0}% dividend yield and ${netBuybackVal ?? 0}% net buyback yield.`
        : divYieldVal !== undefined
          ? `Dividend yield of ${divYieldVal}% with net share repurchases unavailable.`
          : 'Shareholder return data unavailable.',
      summary_th: shareholderYieldVal !== undefined
        ? netBuybackVal !== undefined && netBuybackVal < 0
          ? `Shareholder Yield ${shareholderYieldVal}% ประกอบด้วยปันผล ${divYieldVal ?? 0}% หักลบด้วยการเจือจางหุ้นจากการออกหุ้นเพิ่มทุน ${Math.abs(netBuybackVal)}%`
          : `Shareholder Yield ${shareholderYieldVal}% ประกอบด้วยเงินปันผล ${divYieldVal ?? 0}% และอัตราการซื้อหุ้นคืนสุทธิ ${netBuybackVal ?? 0}%`
        : divYieldVal !== undefined
          ? `อัตราผลตอบแทนเงินปันผล ${divYieldVal}% (ยังไม่รวมข้อมูลการซื้อหุ้นคืน)`
          : 'ข้อมูลผลตอบแทนผู้ถือหุ้นไม่เพียงพอ',
    },
    value_creation_summary: {
      roic: typeof resolvedMetrics.roic.value === 'number' ? resolvedMetrics.roic.value : undefined,
      wacc: typeof resolvedMetrics.wacc.value === 'number' ? resolvedMetrics.wacc.value : undefined,
      spread: typeof resolvedMetrics.roicWaccSpread.value === 'number' ? resolvedMetrics.roicWaccSpread.value : undefined,
      summary_en: isFinancial
        ? 'Financial institutions evaluate capital efficiency through ROE, ROA, and regulatory capital returns.'
        : typeof resolvedMetrics.roicWaccSpread.value === 'number'
          ? resolvedMetrics.roicWaccSpread.value > 0
            ? `ROIC (${resolvedMetrics.roic.value}%) exceeds estimated WACC (${resolvedMetrics.wacc.value}%) by +${resolvedMetrics.roicWaccSpread.value}% spread, confirming positive economic value creation (EVA > 0).`
            : `ROIC (${resolvedMetrics.roic.value}%) trails estimated WACC (${resolvedMetrics.wacc.value}%) by ${resolvedMetrics.roicWaccSpread.value}% spread, indicating economic returns below cost of capital.`
          : typeof resolvedMetrics.roic.value === 'number'
            ? `ROIC of ${resolvedMetrics.roic.value}% reflects operating capital efficiency (independent WACC benchmark unavailable).`
            : 'Insufficient inputs for ROIC - WACC spread derivation.',
      summary_th: isFinancial
        ? 'สถาบันการเงินประเมินประสิทธิภาพเงินทุนผ่าน ROE, ROA และอัตราผลตอบแทนต่อเงินกองทุนตามเกณฑ์กำกับดูแล'
        : typeof resolvedMetrics.roicWaccSpread.value === 'number'
          ? resolvedMetrics.roicWaccSpread.value > 0
            ? `ROIC (${resolvedMetrics.roic.value}%) สูงกว่าต้นทุนเงินทุน WACC (${resolvedMetrics.wacc.value}%) อยู่ +${resolvedMetrics.roicWaccSpread.value}% Spread ยืนยันการสร้างมูลค่าเพิ่มทางเศรษฐกิจ (EVA > 0)`
            : `ROIC (${resolvedMetrics.roic.value}%) ต่ำกว่าต้นทุนเงินทุน WACC (${resolvedMetrics.wacc.value}%) อยู่ ${resolvedMetrics.roicWaccSpread.value}% Spread สะท้อนผลตอบแทนเงินลงทุนยังไม่ครอบคลุมต้นทุนเงินทุน`
          : typeof resolvedMetrics.roic.value === 'number'
            ? `ROIC ${resolvedMetrics.roic.value}% สะท้อนผลตอบแทนเงินลงทุน (ข้อมูล WACC ที่ตรวจสอบได้ไม่พร้อมใช้งาน)`
            : 'ข้อมูลไม่เพียงพอสำหรับคำนวณส่วนต่าง ROIC - WACC',
    },
    analyst_takeaway: report.five_pillars?.analyst_takeaway || (
      isFinancial
        ? 'วิเคราะห์ตามเกณฑ์สถาบันการเงิน (Financial Sector Guard บังคับใช้): เน้น ROE, NIM, คุณภาพสินเชื่อ และ Equity Multiples แทน FCF'
        : 'ข้อมูล 5 เสาหลักพื้นฐานประมวลผลจากงบการเงินและสถิติเปรียบเทียบคู่แข่งที่ตรวจสอบได้'
    ),
  };

  // 8. Build Adaptive Sections for UI rendering
  const pillars = buildAdaptivePillarSections(archetype, fivePillarsData, peerDiscovery, isFinancial, isFcfGuarded, fcfGuardReason, earningsYieldBasis);

  return {
    asOfDate: fivePillarsData.as_of_date,
    archetype,
    pillars,
    fivePillarsData,
    keyTakeawayEn: isFinancial
      ? 'Adapted for financial institution economics: prioritized ROE, NIM, Tier 1 Capital, and P/B multiples over corporate FCF.'
      : '5 Fundamental Pillars adapted to corporate business model with source-verified peer benchmarks.',
    keyTakeawayTh: isFinancial
      ? 'ปรับการวิเคราะห์ตามลักษณะสถาบันการเงิน (Financial Sector Guard): ให้ความสำคัญกับ ROE, NIM, ฐานเงินทุน และ P/B แทน FCF ทั่วไป'
      : 'วิเคราะห์ 5 เสาหลักพื้นฐานตามลักษณะธุรกิจจริง พร้อมตารางเปรียบเทียบคู่แข่งที่ตรวจสอบแหล่งที่มาได้',
  };
}

/**
 * Builds the 5 adaptive UI sections with localized labels and meaningful N/A states.
 */
function buildAdaptivePillarSections(
  archetype: BusinessArchetype,
  data: FivePillarsData,
  peerRes: ReturnType<typeof discoverPeers>,
  isFinancial: boolean,
  isFcfGuarded: boolean,
  fcfGuardReason?: string,
  earningsYieldBasis?: string
): AdaptiveFivePillarsResult['pillars'] {
  const g = data.growth;
  const p = data.profitability;
  const b = data.balance_sheet;
  const y = data.yields;

  const fmt = (val: number | undefined, unit = '', prefix = ''): { val: number | null; fmt: string; status: DataGapState } => {
    if (finite(val)) return { val, fmt: `${prefix}${val}${unit}`, status: DataGapState.VERIFIED_AVAILABLE };
    return { val: null, fmt: 'N/A', status: DataGapState.NOT_REPORTED };
  };
  const resolvedFmt = (metric: FivePillarsResolvedMetric | undefined, fallback?: number, unit = '%', prefix = '+') => {
    const value = typeof metric?.value === 'number' ? metric.value : fallback;
    if (finite(value)) return { val: value, fmt: `${value > 0 ? prefix : ''}${value}${unit}`, status: DataGapState.VERIFIED_AVAILABLE };
    const status = metric?.status;
    const gapStatus = status === 'GUARDED' ? DataGapState.GUARDED_FOR_BUSINESS_MODEL
      : status === 'NOT_APPLICABLE' ? DataGapState.NOT_APPLICABLE
        : status === 'INSUFFICIENT_HISTORY' ? DataGapState.INSUFFICIENT_PERIOD_DATA
          : DataGapState.NOT_REPORTED;
    return { val: null, fmt: metric?.reasonTh || metric?.reason || 'N/A', status: gapStatus };
  };

  // Pillar 1: Growth
  const p1TitleTh = isFinancial
    ? '1. การเติบโต & ขยายฐานธุรกิจ (Growth & Franchise)'
    : archetype === 'reit'
      ? '1. การเติบโตของรายได้ค่าเช่า & ทรัพย์สิน (Property & NOI Growth)'
      : '1. เครื่องยนต์การเติบโต (Growth Engine)';

  const p1TitleEn = isFinancial
    ? '1. Growth & Franchise Expansion'
    : archetype === 'reit'
      ? '1. Property & NOI Growth'
      : '1. Growth Engine';

  const growthMetrics: AdaptivePillarMetric[] = [
    {
      key: 'revenue_growth',
      labelEn: 'Revenue YoY Growth:',
      labelTh: 'รายได้เติบโต YoY (Revenue Growth):',
      value: fmt(g.revenue_growth_yoy_pct, '%', '+').val,
      formattedValue: fmt(g.revenue_growth_yoy_pct, '%', '+').fmt,
      status: fmt(g.revenue_growth_yoy_pct).status,
    },
    {
      key: 'eps_growth',
      labelEn: 'EPS YoY Growth:',
      labelTh: 'กำไร EPS เติบโต YoY (EPS Growth):',
      value: resolvedFmt(g.resolved_metrics?.eps_growth_yoy, g.eps_growth_yoy_pct).val,
      formattedValue: resolvedFmt(g.resolved_metrics?.eps_growth_yoy, g.eps_growth_yoy_pct).fmt,
      status: resolvedFmt(g.resolved_metrics?.eps_growth_yoy, g.eps_growth_yoy_pct).status,
    },
    {
      key: 'fcf_growth',
      labelEn: isFinancial ? 'FCF Growth (Guarded):' : 'FCF YoY Growth:',
      labelTh: isFinancial ? 'FCF Growth (ไม่ใช้กับธนาคาร):' : 'กระแสเงินสด FCF เติบโต YoY:',
      value: resolvedFmt(g.resolved_metrics?.fcf_growth_yoy, g.fcf_growth_yoy_pct).val,
      formattedValue: resolvedFmt(g.resolved_metrics?.fcf_growth_yoy, g.fcf_growth_yoy_pct).fmt,
      status: resolvedFmt(g.resolved_metrics?.fcf_growth_yoy, g.fcf_growth_yoy_pct).status,
      isGuarded: isFinancial,
    },
    {
      key: 'rev_cagr_3yr',
      labelEn: '3Y Revenue CAGR:',
      labelTh: 'การเติบโตเฉลี่ย 3 ปี (3Y Rev CAGR):',
      value: resolvedFmt(g.resolved_metrics?.revenue_cagr_3y, g.revenue_cagr_3yr_pct).val,
      formattedValue: resolvedFmt(g.resolved_metrics?.revenue_cagr_3y, g.revenue_cagr_3yr_pct).fmt,
      status: resolvedFmt(g.resolved_metrics?.revenue_cagr_3y, g.revenue_cagr_3yr_pct).status,
    },
  ];

  // Pillar 2: Profitability & Returns
  const p2TitleTh = isFinancial
    ? '2. คุณภาพกำไร & ผลตอบแทนผู้ถือหุ้น (ROE / ROA)'
    : archetype === 'reit'
      ? '2. คุณภาพกระแสเงินสด FFO / AFFO'
      : '2. คุณภาพกำไร & ผลตอบแทนเงินทุน (ROIC / ROE)';

  const p2TitleEn = isFinancial
    ? '2. Profitability & Equity Returns (ROE / ROA)'
    : archetype === 'reit'
      ? '2. FFO / AFFO Quality'
      : '2. ROIC & Capital Efficiency';

  const profitMetrics: AdaptivePillarMetric[] = [];
  if (archetype === 'insurer') {
    profitMetrics.push(
      {
        key: 'roe',
        labelEn: 'Return on Equity (ROE):',
        labelTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):',
        value: fmt(p.roe_pct, '%').val,
        formattedValue: fmt(p.roe_pct, '%').fmt,
        status: fmt(p.roe_pct).status,
      },
      {
        key: 'combined_ratio',
        labelEn: 'Combined Ratio:',
        labelTh: 'อัตราส่วนรวมธุรกิจประกัน (Combined Ratio):',
        value: fmt(p.combined_ratio_pct, '%').val,
        formattedValue: fmt(p.combined_ratio_pct, '%').fmt,
        status: fmt(p.combined_ratio_pct).status,
      },
      {
        key: 'underwriting_margin',
        labelEn: 'Underwriting Margin:',
        labelTh: 'อัตรากำไรจากการรับประกัน:',
        value: fmt(p.underwriting_margin_pct, '%', '+').val,
        formattedValue: fmt(p.underwriting_margin_pct, '%', '+').fmt,
        status: fmt(p.underwriting_margin_pct).status,
      },
      {
        key: 'net_margin',
        labelEn: 'Net Margin:',
        labelTh: 'อัตรากำไรสุทธิ (Net Margin):',
        value: fmt(p.net_margin_pct, '%').val,
        formattedValue: fmt(p.net_margin_pct, '%').fmt,
        status: fmt(p.net_margin_pct).status,
      }
    );
  } else if (isFinancial) {
    profitMetrics.push(
      {
        key: 'roic',
        labelEn: 'ROIC (Corporate Lens):',
        labelTh: 'ROIC (ไม่ใช้หลักสำหรับธนาคาร):',
        value: null,
        formattedValue: 'ไม่เหมาะกับธุรกิจสถาบันการเงิน',
        status: DataGapState.NOT_APPLICABLE,
        isGuarded: true,
      },
      {
        key: 'roe',
        labelEn: 'Return on Equity (ROE):',
        labelTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):',
        value: fmt(p.roe_pct, '%').val,
        formattedValue: fmt(p.roe_pct, '%').fmt,
        status: fmt(p.roe_pct).status,
      },
      {
        key: 'gross_margin',
        labelEn: 'Gross Margin (Not Reported):',
        labelTh: 'Gross Margin (ไม่มีต้นทุนขายแบบสินค้า):',
        value: null,
        formattedValue: 'บริษัทไม่ได้รายงาน (ไม่มี COGS)',
        status: DataGapState.NOT_APPLICABLE,
        isGuarded: true,
      },
      {
        key: 'net_margin',
        labelEn: 'Net Margin:',
        labelTh: 'อัตรากำไรสุทธิ (Net Margin):',
        value: fmt(p.net_margin_pct, '%').val,
        formattedValue: fmt(p.net_margin_pct, '%').fmt,
        status: fmt(p.net_margin_pct).status,
      }
    );
  } else if (archetype === 'reit') {
    profitMetrics.push(
      {
        key: 'roe',
        labelEn: 'Return on Equity (ROE):',
        labelTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):',
        value: fmt(p.roe_pct, '%').val,
        formattedValue: fmt(p.roe_pct, '%').fmt,
        status: fmt(p.roe_pct).status,
      },
      {
        key: 'operating_margin',
        labelEn: 'NOI / Operating Margin:',
        labelTh: 'อัตรากำไรจากการดำเนินงาน (NOI Margin):',
        value: fmt(p.operating_margin_pct, '%').val,
        formattedValue: fmt(p.operating_margin_pct, '%').fmt,
        status: fmt(p.operating_margin_pct).status,
      },
      {
        key: 'net_margin',
        labelEn: 'Net Margin:',
        labelTh: 'อัตรากำไรสุทธิ (Net Margin):',
        value: fmt(p.net_margin_pct, '%').val,
        formattedValue: fmt(p.net_margin_pct, '%').fmt,
        status: fmt(p.net_margin_pct).status,
      },
      {
        key: 'roa',
        labelEn: 'Return on Assets (ROA):',
        labelTh: 'ผลตอบแทนต่อสินทรัพย์รวม (ROA):',
        value: fmt(p.roa_pct, '%').val,
        formattedValue: fmt(p.roa_pct, '%').fmt,
        status: fmt(p.roa_pct).status,
      }
    );
  } else {
    // Standard corporate operating company
    const hasGroundedSpread = typeof p.roic_wacc_spread_pct === 'number';
    profitMetrics.push(
      {
        key: 'roic',
        labelEn: 'Return on Invested Capital (ROIC):',
        labelTh: 'ผลตอบแทนจากเงินลงทุน (ROIC):',
        value: fmt(p.roic_pct, '%').val,
        formattedValue: fmt(p.roic_pct, '%').fmt,
        status: fmt(p.roic_pct).status,
      },
      hasGroundedSpread ? {
        key: 'roic_wacc_spread',
        labelEn: 'ROIC - WACC Spread:',
        labelTh: 'ส่วนต่างผลตอบแทนต่อต้นทุนเงินทุน (ROIC - WACC):',
        value: fmt(p.roic_wacc_spread_pct, '%', '+').val,
        formattedValue: fmt(p.roic_wacc_spread_pct, '%', '+').fmt,
        status: DataGapState.VERIFIED_AVAILABLE,
      } : {
        key: 'roe',
        labelEn: 'Return on Equity (ROE):',
        labelTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):',
        value: fmt(p.roe_pct, '%').val,
        formattedValue: fmt(p.roe_pct, '%').fmt,
        status: fmt(p.roe_pct).status,
      },
      hasGroundedSpread && typeof p.operating_margin_pct === 'number' ? {
        key: 'operating_margin',
        labelEn: 'Operating Margin:',
        labelTh: 'อัตรากำไรจากการดำเนินงาน (Operating Margin):',
        value: fmt(p.operating_margin_pct, '%').val,
        formattedValue: fmt(p.operating_margin_pct, '%').fmt,
        status: fmt(p.operating_margin_pct).status,
      } : {
        key: 'gross_margin',
        labelEn: 'Gross Margin:',
        labelTh: 'อัตรากำไรขั้นต้น (Gross Margin):',
        value: fmt(p.gross_margin_pct, '%').val,
        formattedValue: fmt(p.gross_margin_pct, '%').fmt,
        status: fmt(p.gross_margin_pct).status,
      },
      typeof p.fcf_margin_pct === 'number' ? {
        key: 'fcf_margin',
        labelEn: 'Free Cash Flow Margin:',
        labelTh: 'อัตรากระแสเงินสดอิสระ (FCF Margin):',
        value: fmt(p.fcf_margin_pct, '%').val,
        formattedValue: fmt(p.fcf_margin_pct, '%').fmt,
        status: DataGapState.VERIFIED_AVAILABLE,
      } : {
        key: 'net_margin',
        labelEn: 'Net Margin:',
        labelTh: 'อัตรากำไรสุทธิ (Net Margin):',
        value: fmt(p.net_margin_pct, '%').val,
        formattedValue: fmt(p.net_margin_pct, '%').fmt,
        status: fmt(p.net_margin_pct).status,
      }
    );
  }

  // Pillar 3: Balance Sheet & Solvency
  const p3TitleTh = isFinancial
    ? '3. ความแข็งแกร่งของเงินกองทุน & แหล่งเงินฝาก (Capital & Funding)'
    : '3. ความแข็งแกร่งงบดุล (Balance Sheet Fortress)';

  const p3TitleEn = isFinancial
    ? '3. Capital, Funding & Balance Sheet'
    : '3. Balance Sheet & Solvency';

  const solvencyMetrics: AdaptivePillarMetric[] = [];
  if (isFinancial) {
    solvencyMetrics.push(
      {
        key: 'cash',
        labelEn: 'Cash & Liquid Reserves:',
        labelTh: 'เงินสดและสินทรัพย์สภาพคล่องสูง:',
        value: fmt(b.total_cash_and_investments_b, 'B', '$').val,
        formattedValue: fmt(b.total_cash_and_investments_b, 'B', '$').fmt,
        status: fmt(b.total_cash_and_investments_b).status,
      },
      {
        key: 'debt',
        labelEn: 'Borrowings & Senior Notes:',
        labelTh: 'เงินกู้ยืมและตราสารหนี้:',
        value: fmt(b.total_debt_b, 'B', '$').val,
        formattedValue: fmt(b.total_debt_b, 'B', '$').fmt,
        status: fmt(b.total_debt_b).status,
      },
      {
        key: 'debt_to_equity',
        labelEn: 'Debt / Equity Ratio:',
        labelTh: 'อัตราส่วนหนี้สินต่อทุน (Debt / Equity):',
        value: fmt(b.debt_to_equity, 'x').val,
        formattedValue: fmt(b.debt_to_equity, 'x').fmt,
        status: fmt(b.debt_to_equity).status,
      },
      {
        key: 'coverage',
        labelEn: 'Capital Structure Context:',
        labelTh: 'โครงสร้างเงินทุน:',
        value: null,
        formattedValue: 'รองรับโดยเงินกองทุนและเงินฝาก',
        status: DataGapState.NOT_APPLICABLE,
      }
    );
  } else if (archetype === 'early_stage' && typeof b.cash_runway_months === 'number') {
    solvencyMetrics.push(
      {
        key: 'cash',
        labelEn: 'Total Cash & ST Investments:',
        labelTh: 'เงินสด & เงินลงทุนระยะสั้น:',
        value: fmt(b.total_cash_and_investments_b, 'B', '$').val,
        formattedValue: fmt(b.total_cash_and_investments_b, 'B', '$').fmt,
        status: fmt(b.total_cash_and_investments_b).status,
      },
      {
        key: 'cash_runway',
        labelEn: 'Cash Runway:',
        labelTh: 'ระยะเวลากระแสเงินสดคงเหลือ (Cash Runway):',
        value: b.cash_runway_months,
        formattedValue: `${b.cash_runway_months} เดือน`,
        status: DataGapState.VERIFIED_AVAILABLE,
      },
      {
        key: 'cash_burn',
        labelEn: 'Annual Cash Burn Rate:',
        labelTh: 'อัตราการใช้เงินสดต่อปี (Annual Burn):',
        value: fmt(b.cash_burn_annual_b, 'B', '$').val,
        formattedValue: fmt(b.cash_burn_annual_b, 'B', '$').fmt,
        status: fmt(b.cash_burn_annual_b).status,
      },
      {
        key: 'debt',
        labelEn: 'Total Debt:',
        labelTh: 'หนี้สินที่มีภาระดอกเบี้ย (Total Debt):',
        value: fmt(b.total_debt_b, 'B', '$').val,
        formattedValue: fmt(b.total_debt_b, 'B', '$').fmt,
        status: fmt(b.total_debt_b).status,
      }
    );
  } else if (b.is_net_cash === true) {
    solvencyMetrics.push(
      {
        key: 'cash',
        labelEn: 'Total Cash & ST Investments:',
        labelTh: 'เงินสด & เงินลงทุนระยะสั้น:',
        value: fmt(b.total_cash_and_investments_b, 'B', '$').val,
        formattedValue: fmt(b.total_cash_and_investments_b, 'B', '$').fmt,
        status: fmt(b.total_cash_and_investments_b).status,
      },
      {
        key: 'net_cash',
        labelEn: 'Net Cash Position:',
        labelTh: 'สถานะเงินสดสุทธิ (Net Cash):',
        value: fmt(b.net_cash_or_debt_b, 'B', '+$').val,
        formattedValue: fmt(b.net_cash_or_debt_b, 'B', '+$').fmt,
        status: DataGapState.VERIFIED_AVAILABLE,
      },
      {
        key: 'net_cash_to_mcap',
        labelEn: 'Net Cash / Market Cap:',
        labelTh: 'สัดส่วนเงินสดสุทธิต่อมูลค่าตลาด (Net Cash / MCap):',
        value: fmt(b.net_cash_to_market_cap_pct, '%').val,
        formattedValue: fmt(b.net_cash_to_market_cap_pct, '%').fmt,
        status: fmt(b.net_cash_to_market_cap_pct).status,
      },
      {
        key: 'coverage',
        labelEn: 'Interest Coverage Ratio:',
        labelTh: 'ความสามารถจ่ายดอกเบี้ย (Interest Coverage):',
        value: fmt(b.interest_coverage, 'x').val,
        formattedValue: finite(b.interest_coverage)
          ? fmt(b.interest_coverage, 'x').fmt
          : b.interest_coverage_reason || 'ไม่พบข้อมูลช่วงเวลาที่เทียบกันได้',
        status: b.interest_coverage_status === 'NO_MATERIAL_INTEREST'
          ? DataGapState.VERIFIED_DERIVED
          : fmt(b.interest_coverage).status,
        sourcePeriod: b.interest_coverage_basis,
      }
    );
  } else {
    // Net debt or unclassified company
    solvencyMetrics.push(
      {
        key: 'cash',
        labelEn: 'Total Cash & ST Investments:',
        labelTh: 'เงินสด & เงินลงทุนระยะสั้น:',
        value: fmt(b.total_cash_and_investments_b, 'B', '$').val,
        formattedValue: fmt(b.total_cash_and_investments_b, 'B', '$').fmt,
        status: fmt(b.total_cash_and_investments_b).status,
      },
      {
        key: 'debt',
        labelEn: 'Total Interest-Bearing Debt:',
        labelTh: 'หนี้สินที่มีภาระดอกเบี้ย (Total Debt):',
        value: fmt(b.total_debt_b, 'B', '$').val,
        formattedValue: fmt(b.total_debt_b, 'B', '$').fmt,
        status: fmt(b.total_debt_b).status,
      },
      typeof b.net_debt_to_ebitda === 'number' && b.net_debt_to_ebitda_status === 'CALCULATED' ? {
        key: 'net_debt_to_ebitda',
        labelEn: 'Net Debt / EBITDA Ratio:',
        labelTh: 'หนี้สินสุทธิต่อ EBITDA (Net Debt / EBITDA):',
        value: fmt(b.net_debt_to_ebitda, 'x').val,
        formattedValue: fmt(b.net_debt_to_ebitda, 'x').fmt,
        status: DataGapState.VERIFIED_AVAILABLE,
      } : {
        key: 'debt_to_equity',
        labelEn: 'Debt / Equity Ratio:',
        labelTh: 'อัตราส่วนหนี้สินต่อทุน (Debt / Equity):',
        value: fmt(b.debt_to_equity, 'x').val,
        formattedValue: fmt(b.debt_to_equity, 'x').fmt,
        status: fmt(b.debt_to_equity).status,
      },
      {
        key: 'coverage',
        labelEn: 'Interest Coverage Ratio:',
        labelTh: 'ความสามารถจ่ายดอกเบี้ย (Interest Coverage):',
        value: fmt(b.interest_coverage, 'x').val,
        formattedValue: finite(b.interest_coverage)
          ? fmt(b.interest_coverage, 'x').fmt
          : b.interest_coverage_reason || 'ไม่พบข้อมูลช่วงเวลาที่เทียบกันได้',
        status: b.interest_coverage_status === 'NO_MATERIAL_INTEREST'
          ? DataGapState.VERIFIED_DERIVED
          : fmt(b.interest_coverage).status,
        sourcePeriod: b.interest_coverage_basis,
      }
    );
  }

  // Pillar 4: Shareholder Return & Cash Quality
  const p4TitleTh = '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)';
  const p4TitleEn = '4. Shareholder Return & Cash Quality';

  const yieldMetrics: AdaptivePillarMetric[] = [
    {
      key: 'fcf_yield',
      labelEn: isFinancial ? 'FCF Yield (Guarded):' : 'FCF Yield (FCF / MCap):',
      labelTh: isFinancial ? 'FCF Yield (ไม่ใช้กับสถาบันการเงิน):' : 'ผลตอบแทนกระแสเงินสดอิสระ (FCF Yield):',
      value: isFinancial ? null : fmt(y.fcf_yield_pct, '%').val,
      formattedValue: isFinancial ? 'Not used — Financial Sector Guard' : fmt(y.fcf_yield_pct, '%').fmt,
      status: isFinancial ? DataGapState.GUARDED_FOR_BUSINESS_MODEL : fmt(y.fcf_yield_pct).status,
      isGuarded: isFinancial,
    },
    {
      key: 'earnings_yield',
      labelEn: `Earnings Yield (1 / ${earningsYieldBasis || 'PE'}):`,
      labelTh: `ผลตอบแทนจากกำไร (Earnings Yield = 1/${earningsYieldBasis || 'PE'}):`,
      value: fmt(y.earnings_yield_pct, '%').val,
      formattedValue: fmt(y.earnings_yield_pct, '%').fmt,
      status: fmt(y.earnings_yield_pct).status,
    },
    {
      key: 'shareholder_yield',
      labelEn: 'Shareholder Yield (Div + Buyback):',
      labelTh: 'ผลตอบแทนรวมสู่ผู้ถือหุ้น (Shareholder Yield):',
      value: fmt(y.shareholder_yield_pct, '%', '+').val,
      formattedValue: fmt(y.shareholder_yield_pct, '%', '+').fmt,
      status: fmt(y.shareholder_yield_pct).status,
    },
    {
      key: 'fcf_conversion',
      labelEn: isFinancial ? 'Price / Book Multiple:' : 'FCF Conversion (FCF / Net Income):',
      labelTh: isFinancial ? 'อัตราส่วนราคาต่อมูลค่าทางบัญชี (P/B):' : 'อัตราการแปลงกำไรเป็นกระแสเงินสด (FCF Conversion):',
      value: isFinancial ? null : fmt(y.fcf_conversion_pct, '%').val,
      formattedValue: isFinancial
        ? 'P/B ประเมินในตารางเปรียบเทียบ'
        : y.fcf_conversion_status === 'UNAVAILABLE' && y.fcf_conversion_reason?.includes('non-positive')
          ? 'N/M (ขาดทุนสุทธิ)'
          : fmt(y.fcf_conversion_pct, '%').fmt,
      status: isFinancial
        ? DataGapState.NOT_APPLICABLE
        : y.fcf_conversion_status === 'UNAVAILABLE'
          ? DataGapState.NOT_APPLICABLE
          : fmt(y.fcf_conversion_pct).status,
      notes: y.fcf_conversion_reason_th || y.fcf_conversion_reason,
    },
  ];

  // Pillar 5: Peer Matrix
  const p5TitleTh = isFinancial
    ? '5. ตารางเปรียบเทียบกับคู่แข่งสถาบันการเงิน (Financial Peer Benchmark)'
    : '5. ตารางเปรียบเทียบเชิงลึกกับค่ากลางกลุ่มคู่แข่ง (Peer Benchmark Matrix)';

  const p5TitleEn = isFinancial
    ? '5. Financial Peer Benchmark'
    : '5. Peer Benchmark Matrix';

  return {
    growth: {
      id: 'growth',
      titleEn: p1TitleEn,
      titleTh: p1TitleTh,
      badgeLabel: isFinancial ? 'Rev YoY' : 'PEG',
      badgeValue: isFinancial
        ? fmt(g.revenue_growth_yoy_pct, '%', '+').fmt
        : finite(g.resolved_metrics?.peg.value)
          ? `PEG ${g.resolved_metrics!.peg.value}x`
          : g.resolved_metrics?.peg.status === 'TURNAROUND'
            ? 'PEG N/M · Turnaround'
            : g.resolved_metrics?.peg.status === 'BASIS_MISMATCH'
              ? 'PEG N/A · Basis mismatch'
              : g.resolved_metrics?.peg.status === 'GUARDED' || g.resolved_metrics?.peg.status === 'NOT_APPLICABLE'
                ? 'PEG not applicable'
                : 'PEG N/A',
      metrics: growthMetrics,
      interpretationEn: g.peg_interpretation,
      interpretationTh: g.peg_interpretation,
    },
    profitability: {
      id: 'profitability',
      titleEn: p2TitleEn,
      titleTh: p2TitleTh,
      badgeLabel: isFinancial ? 'ROE' : 'ROIC',
      badgeValue: isFinancial ? fmt(p.roe_pct, '%').fmt : fmt(p.roic_pct, '%').fmt,
      metrics: profitMetrics,
      interpretationEn: p.capital_efficiency_verdict,
      interpretationTh: p.capital_efficiency_verdict,
      isGuarded: isFinancial,
    },
    solvency: {
      id: 'solvency',
      titleEn: p3TitleEn,
      titleTh: p3TitleTh,
      badgeLabel: isFinancial ? 'D/E' : b.is_net_cash ? 'Net Cash' : 'Net Debt',
      badgeValue: isFinancial
        ? fmt(b.debt_to_equity, 'x').fmt
        : b.is_net_cash === undefined
          ? 'N/A'
          : `${b.is_net_cash ? '+' : ''}${fmt(b.net_cash_or_debt_b, 'B', '$').fmt}`,
      metrics: solvencyMetrics,
      interpretationEn: b.solvency_score_label,
      interpretationTh: b.solvency_score_label,
    },
    yields: {
      id: 'yields',
      titleEn: p4TitleEn,
      titleTh: p4TitleTh,
      badgeLabel: isFinancial
        ? 'Earnings Yield'
        : typeof y.shareholder_yield_pct === 'number'
          ? 'Shareholder Yield'
          : 'FCF Yield',
      badgeValue: isFinancial
        ? fmt(y.earnings_yield_pct, '%').fmt
        : typeof y.shareholder_yield_pct === 'number'
          ? fmt(y.shareholder_yield_pct, '%', '+').fmt
          : fmt(y.fcf_yield_pct, '%').fmt,
      metrics: yieldMetrics,
      interpretationEn: y.yield_interpretation,
      interpretationTh: y.yield_interpretation,
      isGuarded: isFcfGuarded,
    },
    peers: {
      id: 'peers',
      titleEn: p5TitleEn,
      titleTh: p5TitleTh,
      metrics: [],
      interpretationEn: peerRes.isLimitedSample
        ? 'Limited peer sample available meeting strict verification criteria.'
        : undefined,
      interpretationTh: peerRes.isLimitedSample
        ? 'พบกลุ่มคู่แข่งที่ผ่านเกณฑ์ตรวจสอบจำนวนจำกัด (2 บริษัท)'
        : undefined,
    },
  };
}
