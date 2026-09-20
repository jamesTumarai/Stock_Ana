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
 */
export function resolveAdaptiveFivePillars(
  report: Partial<ReportData>,
  ticker?: string
): AdaptiveFivePillarsResult {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
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
  const totalDebt = at(bs?.total_debt);
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
  } else if (typeof resolvedMetrics.roic.value === 'number') {
    const roicVal = resolvedMetrics.roic.value;
    capitalEfficiencyVerdict = roicVal > 15
      ? `ROIC ${roicVal}% สะท้อนความสามารถในการจัดสรรเงินทุนที่ยอดเยี่ยม (High Capital Efficiency)`
      : roicVal > 8
        ? `ROIC ${roicVal}% สร้างผลตอบแทนเงินลงทุนในระดับมาตรฐานอุตสาหกรรม`
        : `ROIC ${roicVal}% อัตราผลตอบแทนเงินลงทุนต่ำกว่าเกณฑ์เฉลี่ย`;
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
    roa_pct: typeof resolvedMetrics.roa.value === 'number' ? resolvedMetrics.roa.value : undefined,
    net_interest_margin_pct: isFinancial ? nim : undefined,
    efficiency_ratio_pct: isFinancial ? efficiencyRatio : undefined,
    capital_efficiency_verdict: capitalEfficiencyVerdict,
  };

  // 5. Resolve Pillar 3: Balance Sheet / Financial Health
  let balanceSheetTitle = isFinancial ? 'Capital & Funding' : 'Financial Strength';
  let balanceSheetSummary = '';
  if (isFinancial) {
    balanceSheetTitle = archetype === 'bank' ? 'Capital & Deposits' : 'Capital & Funding';
    balanceSheetSummary = 'สถาบันการเงินใช้เงินฝากและวงเงินสินเชื่อเป็นสินค้าคงคลังในการดำเนินงาน (Operating Inventory) โครงสร้างเงินทุนจึงวัดด้วยความเพียงพอของเงินกองทุนและการจัดหาทุน';
  }

  const debtToEquity = at(bs?.debt_to_equity) ?? getKi('debt_to_equity') ?? (totalDebt !== undefined && totalEquity !== undefined && totalEquity > 0 ? rounded(totalDebt / totalEquity) : undefined);
  const interestCoverage = getKi('interest_coverage');
  const cashRunway = getKi('cash_runway_months');

  let solvencyScoreLabel = 'ฐานะการเงินระดับมาตรฐาน';
  if (isFinancial) {
    solvencyScoreLabel = 'โครงสร้างเงินทุนสถาบันการเงิน: เงินฝากและพอร์ตสินเชื่อเป็นวัตถุดิบดำเนินงาน (Financial Sector Guard บังคับใช้)';
  } else if (archetype === 'early_stage' && cashRunway !== undefined) {
    solvencyScoreLabel = `ระยะเวลากระแสเงินสดคงเหลือประมาณ ${cashRunway} เดือน`;
  } else if (!isFinancial) {
    if (netCashOrDebt !== undefined && netCashOrDebt > 0) {
      solvencyScoreLabel = `สถานะเงินสดสุทธิ (Net Cash +$${netCashOrDebt}B) มีความมั่นคงทางการเงินสูง`;
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
    net_cash_or_debt_b: isFinancial ? undefined : netCashOrDebt !== undefined ? Math.abs(netCashOrDebt) : undefined,
    is_net_cash: isFinancial ? undefined : netCashOrDebt !== undefined ? netCashOrDebt >= 0 : undefined,
    debt_to_equity: debtToEquity,
    interest_coverage: isFinancial ? undefined : interestCoverage,
    solvency_score_label: solvencyScoreLabel,
  };

  // 6. Resolve Pillar 4: Yields Perspective
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

  let yieldInterpretation = 'N/A';
  if (isFinancial) {
    if (earningsYield !== undefined) {
      yieldInterpretation = treasury10Yr !== undefined
        ? `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% เทียบกับผลตอบแทนพันธบัตร 10 ปี (${treasury10Yr}%) สำหรับสถาบันการเงิน`
        : `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% สำหรับสถาบันการเงิน (ข้อมูลพันธบัตร 10 ปีไม่พร้อมใช้งาน)`;
    } else {
      yieldInterpretation = 'การประเมินผลตอบแทนสถาบันการเงินอิงตาม P/E, P/B และผลตอบแทนจากกำไร';
    }
  } else if (fcfYield !== undefined) {
    if (treasury10Yr !== undefined) {
      const spread = rounded(fcfYield - treasury10Yr);
      yieldInterpretation = spread > 0
        ? `FCF Yield ${fcfYield}% สูงกว่าพันธบัตรสหรัฐฯ 10 ปี (+${spread}% Spread) สะท้อนผลตอบแทนเงินสดที่ดี`
        : `FCF Yield ${fcfYield}% ต่ำกว่าพันธบัตรสหรัฐฯ 10 ปี (${spread}% Spread) ตลาดสะท้อนการเติบโตในอนาคต`;
    } else {
      yieldInterpretation = `FCF Yield ${fcfYield}% สะท้อนผลตอบแทนกระแสเงินสดอิสระ (ข้อมูลพันธบัตร 10 ปีไม่พร้อมใช้งาน)`;
    }
  } else if (earningsYield !== undefined) {
    if (treasury10Yr !== undefined) {
      const spread = rounded(earningsYield - treasury10Yr);
      yieldInterpretation = `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% เทียบกับพันธบัตรสหรัฐฯ (${spread}% Spread)`;
    } else {
      yieldInterpretation = `Earnings Yield (${earningsYieldBasis}) ${earningsYield}% (ข้อมูลพันธบัตร 10 ปีไม่พร้อมใช้งาน)`;
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
    is_fcf_guarded: isFcfGuarded ? true : undefined,
    fcf_guard_reason: isFcfGuarded ? fcfGuardReason : undefined,
    treasury_10yr_yield_pct: treasury10Yr,
    treasury_as_of_date: treasuryAsOf,
    treasury_source: treasurySource,
    yield_spread_vs_treasury: yieldSpread,
    yield_interpretation: yieldInterpretation,
  };

  // 7. Resolve Pillar 5: Peer Discovery & Benchmark Matrix
  const peerDiscovery = discoverPeers(report, sym, { targetMetrics: resolvedMetrics });
  const peerMatrix = peerDiscovery.benchmarkRows;

  // Build missing reason mapping for user-facing precision
  const unavailableReasons: Record<string, string> = {};
  if (growthData.eps_growth_yoy_pct === undefined) {
    unavailableReasons.eps_growth = resolvedMetrics.epsGrowthYoY.reason || 'Insufficient comparable EPS history';
  }
  if (profitabilityData.roic_pct === undefined && !isFinancial) {
    unavailableReasons.roic = resolvedMetrics.roic.reason || 'Insufficient verified invested-capital inputs';
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
    growth: growthData,
    profitability: profitabilityData,
    balance_sheet: balanceSheetData,
    yields: yieldsData,
    peer_matrix: peerMatrix,
    unavailable_reasons: unavailableReasons,
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

  // Pillar 2: Profitability
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

  const profitMetrics: AdaptivePillarMetric[] = [
    {
      key: 'roic',
      labelEn: isFinancial ? 'ROIC (Corporate Lens):' : 'Return on Invested Capital (ROIC):',
      labelTh: isFinancial ? 'ROIC (ไม่ใช้หลักสำหรับธนาคาร):' : 'ผลตอบแทนจากเงินลงทุน (ROIC):',
      value: isFinancial ? null : fmt(p.roic_pct, '%').val,
      formattedValue: isFinancial ? 'ไม่เหมาะกับธุรกิจสถาบันการเงิน' : fmt(p.roic_pct, '%').fmt,
      status: isFinancial ? DataGapState.NOT_APPLICABLE : fmt(p.roic_pct).status,
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
      labelEn: isFinancial ? 'Gross Margin (Not Reported):' : 'Gross Margin:',
      labelTh: isFinancial ? 'Gross Margin (ไม่มีต้นทุนขายแบบสินค้า):' : 'อัตรากำไรขั้นต้น (Gross Margin):',
      value: isFinancial ? null : fmt(p.gross_margin_pct, '%').val,
      formattedValue: isFinancial ? 'บริษัทไม่ได้รายงาน (ไม่มี COGS)' : fmt(p.gross_margin_pct, '%').fmt,
      status: isFinancial ? DataGapState.NOT_APPLICABLE : fmt(p.gross_margin_pct).status,
    },
    {
      key: 'net_margin',
      labelEn: 'Net Margin:',
      labelTh: 'อัตรากำไรสุทธิ (Net Margin):',
      value: fmt(p.net_margin_pct, '%').val,
      formattedValue: fmt(p.net_margin_pct, '%').fmt,
      status: fmt(p.net_margin_pct).status,
    },
  ];

  // Pillar 3: Balance Sheet
  const p3TitleTh = isFinancial
    ? '3. ความแข็งแกร่งของเงินกองทุน & แหล่งเงินฝาก (Capital & Funding)'
    : '3. ความแข็งแกร่งงบดุล (Balance Sheet Fortress)';

  const p3TitleEn = isFinancial
    ? '3. Capital, Funding & Balance Sheet'
    : '3. Balance Sheet & Solvency';

  const solvencyMetrics: AdaptivePillarMetric[] = [
    {
      key: 'cash',
      labelEn: isFinancial ? 'Cash & Liquid Reserves:' : 'Total Cash & ST Investments:',
      labelTh: isFinancial ? 'เงินสดและสินทรัพย์สภาพคล่องสูง:' : 'เงินสด & เงินลงทุนระยะสั้น:',
      value: fmt(b.total_cash_and_investments_b, 'B', '$').val,
      formattedValue: fmt(b.total_cash_and_investments_b, 'B', '$').fmt,
      status: fmt(b.total_cash_and_investments_b).status,
    },
    {
      key: 'debt',
      labelEn: isFinancial ? 'Borrowings & Senior Notes:' : 'Total Interest-Bearing Debt:',
      labelTh: isFinancial ? 'เงินกู้ยืมและตราสารหนี้:' : 'หนี้สินที่มีภาระดอกเบี้ย (Total Debt):',
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
      labelEn: isFinancial ? 'Capital Structure Context:' : 'Interest Coverage Ratio:',
      labelTh: isFinancial ? 'โครงสร้างเงินทุน:' : 'ความสามารถจ่ายดอกเบี้ย (Interest Coverage):',
      value: isFinancial ? null : fmt(b.interest_coverage, 'x').val,
      formattedValue: isFinancial ? 'รองรับโดยเงินกองทุนและเงินฝาก' : fmt(b.interest_coverage, 'x').fmt,
      status: isFinancial ? DataGapState.NOT_APPLICABLE : fmt(b.interest_coverage).status,
    },
  ];

  // Pillar 4: Yields
  const p4TitleTh = isFinancial
    ? '4. มิติมูลค่าหุ้นสถาบันการเงิน (Equity Valuation & Multiples)'
    : '4. มิติผลตอบแทนเงินสด (Yield Perspective)';

  const p4TitleEn = isFinancial
    ? '4. Equity Valuation & Multiples'
    : '4. Yield Perspective';

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
      key: 'treasury_10yr',
      labelEn: '10Y US Treasury Benchmark:',
      labelTh: 'ผลตอบแทนพันธบัตรสหรัฐฯ 10 ปี (10Y US Treasury):',
      value: fmt(y.treasury_10yr_yield_pct, '%').val,
      formattedValue: fmt(y.treasury_10yr_yield_pct, '%').fmt,
      status: fmt(y.treasury_10yr_yield_pct).status,
    },
    {
      key: 'pfcf_multiple',
      labelEn: isFinancial ? 'Price / Book Multiple:' : 'Price / Free Cash Flow Multiple:',
      labelTh: isFinancial ? 'อัตราส่วนราคาต่อมูลค่าทางบัญชี (P/B):' : 'Price / Free Cash Flow Multiple:',
      value: isFinancial ? null : fmt(y.pfcf_multiple, 'x').val,
      formattedValue: isFinancial ? 'P/B ประเมินในตารางเปรียบเทียบ' : fmt(y.pfcf_multiple, 'x').fmt,
      status: isFinancial ? DataGapState.NOT_APPLICABLE : fmt(y.pfcf_multiple).status,
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
      badgeLabel: isFinancial ? 'Earnings Yield' : 'FCF Yield',
      badgeValue: isFinancial ? fmt(y.earnings_yield_pct, '%').fmt : fmt(y.fcf_yield_pct, '%').fmt,
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
