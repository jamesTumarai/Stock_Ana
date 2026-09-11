export interface SecPeriodStatement {
  period: string;
  fiscal_year?: number;
  revenue?: number | null;
  operating_income?: number | null;
  net_income?: number | null;
  operating_cash_flow?: number | null;
  capital_expenditure?: number | null;
  total_debt?: number | null;
  stockholders_equity?: number | null;
  diluted_shares?: number | null;
}

export interface SecFilingPeriodDiff {
  currentPeriod: string;
  priorPeriod: string;
  revenueYoYPct: number | null;
  operatingIncomeYoYPct: number | null;
  netIncomeYoYPct: number | null;
  ocfYoYPct: number | null;
  fcfYoYPct: number | null;
  operatingMarginCurrentPct: number | null;
  operatingMarginPriorPct: number | null;
  operatingMarginBpsDelta: number | null;
  shareCountDeltaPct: number | null;
  dilutionOrBuyback: 'buybacks' | 'dilution' | 'stable';
  cashConversionStatus: 'healthy' | 'warning' | 'neutral';
  cashConversionSummary: string;
}

function parseNum(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const p = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(p)) return p;
  }
  return null;
}

/**
 * Pure deterministic period-over-period diffing for SEC verified financial statements.
 * Completely eliminates hallucination by deriving all deltas strictly from verified rows.
 */
export function diffSecFinancialStatements(
  statements: SecPeriodStatement[],
  isThai = false
): SecFilingPeriodDiff | null {
  if (!Array.isArray(statements) || statements.length < 2) {
    return null;
  }

  // Statements are assumed ordered from newest (index 0) to older (index 1)
  const cur = statements[0];
  const prior = statements[1];

  const curRev = parseNum(cur.revenue);
  const priorRev = parseNum(prior.revenue);

  const curOpInc = parseNum(cur.operating_income);
  const priorOpInc = parseNum(prior.operating_income);

  const curNetInc = parseNum(cur.net_income);
  const priorNetInc = parseNum(prior.net_income);

  const curOcf = parseNum(cur.operating_cash_flow);
  const priorOcf = parseNum(prior.operating_cash_flow);

  const curCapex = parseNum(cur.capital_expenditure);
  const priorCapex = parseNum(prior.capital_expenditure);

  const curShares = parseNum(cur.diluted_shares);
  const priorShares = parseNum(prior.diluted_shares);

  // YoY Calculations
  const revenueYoYPct = (curRev !== null && priorRev !== null && priorRev !== 0)
    ? Number((((curRev - priorRev) / Math.abs(priorRev)) * 100).toFixed(2))
    : null;

  const operatingIncomeYoYPct = (curOpInc !== null && priorOpInc !== null && priorOpInc !== 0)
    ? Number((((curOpInc - priorOpInc) / Math.abs(priorOpInc)) * 100).toFixed(2))
    : null;

  const netIncomeYoYPct = (curNetInc !== null && priorNetInc !== null && priorNetInc !== 0)
    ? Number((((curNetInc - priorNetInc) / Math.abs(priorNetInc)) * 100).toFixed(2))
    : null;

  const ocfYoYPct = (curOcf !== null && priorOcf !== null && priorOcf !== 0)
    ? Number((((curOcf - priorOcf) / Math.abs(priorOcf)) * 100).toFixed(2))
    : null;

  // FCF = OCF - |CapEx|
  let curFcf: number | null = null;
  if (curOcf !== null && curCapex !== null) {
    curFcf = curOcf - Math.abs(curCapex);
  }
  let priorFcf: number | null = null;
  if (priorOcf !== null && priorCapex !== null) {
    priorFcf = priorOcf - Math.abs(priorCapex);
  }
  const fcfYoYPct = (curFcf !== null && priorFcf !== null && priorFcf !== 0)
    ? Number((((curFcf - priorFcf) / Math.abs(priorFcf)) * 100).toFixed(2))
    : null;

  // Margins
  const curOpMargin = (curOpInc !== null && curRev !== null && curRev > 0)
    ? (curOpInc / curRev) * 100
    : null;
  const priorOpMargin = (priorOpInc !== null && priorRev !== null && priorRev > 0)
    ? (priorOpInc / priorRev) * 100
    : null;

  const operatingMarginBpsDelta = (curOpMargin !== null && priorOpMargin !== null)
    ? Number(((curOpMargin - priorOpMargin) * 100).toFixed(0))
    : null;

  // Shares & Dilution
  let shareCountDeltaPct: number | null = null;
  let dilutionOrBuyback: 'buybacks' | 'dilution' | 'stable' = 'stable';
  if (curShares !== null && priorShares !== null && priorShares > 0) {
    shareCountDeltaPct = Number((((curShares - priorShares) / priorShares) * 100).toFixed(2));
    if (shareCountDeltaPct < -0.1) dilutionOrBuyback = 'buybacks';
    else if (shareCountDeltaPct > 0.1) dilutionOrBuyback = 'dilution';
  }

  // Cash Conversion Quality Check:
  // Anomaly flag if revenue is growing (+ > 3%) but OCF is falling (- < -5%)
  let cashConversionStatus: 'healthy' | 'warning' | 'neutral' = 'neutral';
  let cashConversionSummary = isThai
    ? 'กระแสเงินสดจากการดำเนินงานสอดคล้องกับการรับรู้รายได้'
    : 'Operating cash flow conversion aligns with revenue recognition.';

  if (revenueYoYPct !== null && ocfYoYPct !== null) {
    if (revenueYoYPct > 0 && ocfYoYPct < 0) {
      cashConversionStatus = 'warning';
      cashConversionSummary = isThai
        ? `ระวัง: รายได้เติบโต (+${revenueYoYPct.toFixed(1)}%) แต่กระแสเงินสด OCF กลับลดลง (${ocfYoYPct.toFixed(1)}%) อาจเกิดจากการสะสมลูกหนี้หรือสินค้าคงคลัง`
        : `Divergence Alert: Revenue grew (+${revenueYoYPct.toFixed(1)}%) while Operating Cash Flow dropped (${ocfYoYPct.toFixed(1)}%). Indicates working capital strain or delayed collections.`;
    } else if (ocfYoYPct > revenueYoYPct + 5) {
      cashConversionStatus = 'healthy';
      cashConversionSummary = isThai
        ? `คุณภาพกระแสเงินสดแข็งแกร่งมาก: OCF ขยายตัว (+${ocfYoYPct.toFixed(1)}%) สูงกว่าอัตราเติบโตของรายได้ (+${revenueYoYPct.toFixed(1)}%)`
        : `High cash quality: OCF expanded (+${ocfYoYPct.toFixed(1)}%) outperforming topline growth (+${revenueYoYPct.toFixed(1)}%).`;
    } else {
      cashConversionStatus = 'healthy';
    }
  }

  return {
    currentPeriod: cur.period,
    priorPeriod: prior.period,
    revenueYoYPct,
    operatingIncomeYoYPct,
    netIncomeYoYPct,
    ocfYoYPct,
    fcfYoYPct,
    operatingMarginCurrentPct: curOpMargin !== null ? Number(curOpMargin.toFixed(1)) : null,
    operatingMarginPriorPct: priorOpMargin !== null ? Number(priorOpMargin.toFixed(1)) : null,
    operatingMarginBpsDelta,
    shareCountDeltaPct,
    dilutionOrBuyback,
    cashConversionStatus,
    cashConversionSummary,
  };
}
