import type { FinancialStatementsData, ReportData } from '../types';
import type { CanonicalFinancialDataset } from '../domain/financialValue';
import type { SecShareSnapshot } from '../services/sec/secShareSnapshot';

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
  accounts_receivable?: number | null;
  inventory?: number | null;
  accounts_payable?: number | null;
}

export interface SecFilingPeriodDiff {
  currentPeriod: string;
  priorPeriod: string;
  comparisonType: 'annual_yoy' | 'quarter_yoy';
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
  ocfToNetIncomeRatioCurrent: number | null;
  ocfToNetIncomeRatioPrior: number | null;
  cashConversionStatus: 'healthy' | 'warning' | 'neutral';
  cashConversionSummary: string;
  workingCapitalNote?: string;
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
 * Adapts FinancialStatementsData, CanonicalFinancialDataset, or ReportData into typed SecPeriodStatement[]
 * for period-over-period diffing and SEC filing audit.
 * Replaces synthetic or legacy shapes with Lumina's canonical model.
 */
export function adaptFinancialStatementsToSecPeriodStatements(
  input?: FinancialStatementsData | CanonicalFinancialDataset | ReportData | null,
  shareSnapshot?: SecShareSnapshot | null
): SecPeriodStatement[] {
  if (!input) return [];

  // Case 1: ReportData wrapper
  if ('ticker' in input && ('financial_statements' in input || 'sec_verification' in input)) {
    const report = input as ReportData;
    const fs = report.financial_statements;
    if (!fs || !Array.isArray(fs.periods) || fs.periods.length === 0) return [];

    // SEC Provenance Guard:
    // ReportData must be verified by SEC EDGAR before entering Verified SEC Filing Comparison.
    const secVerification = report.sec_verification;
    const isSecVerified = Boolean(
      secVerification
      && secVerification.status === 'verified_eligible'
      && (secVerification.provenance_status === 'verified' || secVerification.dcf_financial_inputs?.eligible === true)
    );
    if (!isSecVerified) {
      return [];
    }

    return fs.periods.map((period, i) => {
      const isLatest = i === fs.periods.length - 1;
      // Map comparable Diluted Weighted Average Shares.
      // Important: Current Common Shares Outstanding != Diluted Weighted Average Shares.
      // Never mix them to manufacture dilution comparison.
      let dilutedShares: number | null = null;
      if (isLatest && shareSnapshot?.latestDilutedWeightedAverageShares?.sharesM) {
        dilutedShares = shareSnapshot.latestDilutedWeightedAverageShares.sharesM;
      } else {
        const netInc = parseNum(fs.income_statement?.net_income?.[i]);
        const epsDil = parseNum(fs.income_statement?.eps_diluted?.[i]);
        if (netInc !== null && epsDil !== null && epsDil > 0) {
          dilutedShares = Number((netInc / epsDil).toFixed(2));
        }
      }

      return {
        period,
        revenue: parseNum(fs.income_statement?.revenue?.[i]),
        operating_income: parseNum(fs.income_statement?.operating_income?.[i]),
        net_income: parseNum(fs.income_statement?.net_income?.[i]),
        operating_cash_flow: parseNum(fs.cash_flow?.operating_cash_flow?.[i]),
        capital_expenditure: parseNum(fs.cash_flow?.capex?.[i]),
        total_debt: parseNum(fs.balance_sheet?.total_debt?.[i]),
        stockholders_equity: parseNum(fs.balance_sheet?.total_equity?.[i]),
        accounts_receivable: parseNum(fs.balance_sheet?.accounts_receivable?.[i]),
        inventory: parseNum(fs.balance_sheet?.inventory?.[i]),
        accounts_payable: parseNum(fs.balance_sheet?.accounts_payable?.[i]),
        diluted_shares: dilutedShares,
      };
    });
  }

  // Case 2: CanonicalFinancialDataset
  if ('schemaVersion' in input && 'values' in input && Array.isArray(input.periods)) {
    const dataset = input as CanonicalFinancialDataset;
    if (dataset.periods.length === 0) return [];

    const getVal = (metricKey: string, period: string, index: number): number | null => {
      const series = dataset.values[metricKey];
      if (!Array.isArray(series)) return null;
      const item = series.find((v) => v.period === period) ?? series[index];
      return (item && typeof item.value === 'number' && Number.isFinite(item.value)) ? item.value : null;
    };

    return dataset.periods.map((period, i) => {
      const isLatest = i === dataset.periods.length - 1;
      return {
        period,
        revenue: getVal('income_statement.revenue', period, i),
        operating_income: getVal('income_statement.operating_income', period, i),
        net_income: getVal('income_statement.net_income', period, i),
        operating_cash_flow: getVal('cash_flow.operating_cash_flow', period, i),
        capital_expenditure: getVal('cash_flow.capex', period, i),
        total_debt: getVal('balance_sheet.total_debt', period, i),
        stockholders_equity: getVal('balance_sheet.total_equity', period, i),
        accounts_receivable: getVal('balance_sheet.accounts_receivable', period, i),
        inventory: getVal('balance_sheet.inventory', period, i),
        accounts_payable: getVal('balance_sheet.accounts_payable', period, i),
        diluted_shares: isLatest
          ? (shareSnapshot?.latestDilutedWeightedAverageShares?.sharesM ?? null)
          : null,
      };
    });
  }

  // Case 3: FinancialStatementsData
  if ('periods' in input && Array.isArray(input.periods)) {
    const fs = input as FinancialStatementsData;
    if (fs.periods.length === 0) return [];

    return fs.periods.map((period, i) => {
      const isLatest = i === fs.periods.length - 1;
      let dilutedShares: number | null = null;
      if (isLatest && shareSnapshot?.latestDilutedWeightedAverageShares?.sharesM) {
        dilutedShares = shareSnapshot.latestDilutedWeightedAverageShares.sharesM;
      } else {
        const netInc = parseNum(fs.income_statement?.net_income?.[i]);
        const epsDil = parseNum(fs.income_statement?.eps_diluted?.[i]);
        if (netInc !== null && epsDil !== null && epsDil > 0) {
          dilutedShares = Number((netInc / epsDil).toFixed(2));
        }
      }

      return {
        period,
        revenue: parseNum(fs.income_statement?.revenue?.[i]),
        operating_income: parseNum(fs.income_statement?.operating_income?.[i]),
        net_income: parseNum(fs.income_statement?.net_income?.[i]),
        operating_cash_flow: parseNum(fs.cash_flow?.operating_cash_flow?.[i]),
        capital_expenditure: parseNum(fs.cash_flow?.capex?.[i]),
        total_debt: parseNum(fs.balance_sheet?.total_debt?.[i]),
        stockholders_equity: parseNum(fs.balance_sheet?.total_equity?.[i]),
        accounts_receivable: parseNum(fs.balance_sheet?.accounts_receivable?.[i]),
        inventory: parseNum(fs.balance_sheet?.inventory?.[i]),
        accounts_payable: parseNum(fs.balance_sheet?.accounts_payable?.[i]),
        diluted_shares: dilutedShares,
      };
    });
  }

  return [];
}

interface ParsedPeriodDescriptor {
  statement: SecPeriodStatement;
  isAnnual: boolean;
  isQuarterly: boolean;
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4 | null;
  sortKey: number;
}

/**
 * Parses and normalizes a period descriptor from statement string or fiscal_year.
 */
function parsePeriodDescriptor(statement: SecPeriodStatement): ParsedPeriodDescriptor | null {
  const raw = String(statement.period || '').trim();

  // 1. Check Quarterly: e.g. "Q3 2025", "Q1 FY24", "Q4 2023"
  const qMatch = raw.match(/^Q([1-4])\s*(?:FY\s*)?(\d{2,4})$/i);
  if (qMatch) {
    const q = parseInt(qMatch[1], 10) as 1 | 2 | 3 | 4;
    let yr = parseInt(qMatch[2], 10);
    if (yr < 100) yr += 2000;
    return {
      statement,
      isAnnual: false,
      isQuarterly: true,
      fiscalYear: yr,
      quarter: q,
      sortKey: yr * 10 + q,
    };
  }

  // 1b. Check Quarterly reverse/delimited format: e.g. "2025-Q3", "2025 Q3", "2025/Q3", "FY2025-Q3"
  const qMatchRev = raw.match(/^(?:FY\s*)?(\d{2,4})[-/\s]+Q([1-4])$/i);
  if (qMatchRev) {
    let yr = parseInt(qMatchRev[1], 10);
    if (yr < 100) yr += 2000;
    const q = parseInt(qMatchRev[2], 10) as 1 | 2 | 3 | 4;
    return {
      statement,
      isAnnual: false,
      isQuarterly: true,
      fiscalYear: yr,
      quarter: q,
      sortKey: yr * 10 + q,
    };
  }

  // 1c. Check Quarter-only if explicit fiscal_year is provided: e.g. "Q3" with fiscal_year: 2025
  const qOnlyMatch = raw.match(/^Q([1-4])$/i);
  if (qOnlyMatch && typeof statement.fiscal_year === 'number' && statement.fiscal_year > 1900) {
    const q = parseInt(qOnlyMatch[1], 10) as 1 | 2 | 3 | 4;
    return {
      statement,
      isAnnual: false,
      isQuarterly: true,
      fiscalYear: statement.fiscal_year,
      quarter: q,
      sortKey: statement.fiscal_year * 10 + q,
    };
  }

  // 2. Check Annual: e.g. "FY2025", "FY 2025", "FY25", "2024"
  const aMatch = raw.match(/^(?:FY\s*)?(\d{2,4})$/i);
  if (aMatch) {
    let yr = parseInt(aMatch[1], 10);
    if (yr < 100) yr += 2000;
    return {
      statement,
      isAnnual: true,
      isQuarterly: false,
      fiscalYear: yr,
      quarter: null,
      sortKey: yr * 10,
    };
  }

  // 3. Fallback: statement.fiscal_year if explicit
  if (typeof statement.fiscal_year === 'number' && statement.fiscal_year > 1900) {
    return {
      statement,
      isAnnual: true,
      isQuarterly: false,
      fiscalYear: statement.fiscal_year,
      quarter: null,
      sortKey: statement.fiscal_year * 10,
    };
  }

  return null;
}

/**
 * Pure deterministic period-over-period diffing for SEC verified financial statements.
 * Strict financial invariants:
 * 1. Comparable Period Matching (P1-1):
 *    - Only compares Annual vs Annual (e.g. FY2025 vs FY2024) or Same-Quarter YoY (e.g. Q3 2025 vs Q3 2024).
 *    - Rejects mixing a quarterly period with an annual period.
 *    - Enforces chronological ordering (newer vs older) regardless of array input order.
 * 2. Fact-Grounded Cash Conversion Analysis (P1-2):
 *    - Evaluates factual OCF-to-Net Income ratio and working capital deltas without speculative qualitative guessing.
 */
export function diffSecFinancialStatements(
  statements: SecPeriodStatement[],
  isThai = false
): SecFilingPeriodDiff | null {
  if (!Array.isArray(statements) || statements.length < 2) {
    return null;
  }

  // 1. Parse and validate period descriptors
  const parsedDescriptors: ParsedPeriodDescriptor[] = [];
  for (const s of statements) {
    const desc = parsePeriodDescriptor(s);
    if (desc) parsedDescriptors.push(desc);
  }

  if (parsedDescriptors.length < 2) {
    return null;
  }

  // 2. Match comparable period pairs
  let curDesc: ParsedPeriodDescriptor | null = null;
  let priorDesc: ParsedPeriodDescriptor | null = null;
  let comparisonType: 'annual_yoy' | 'quarter_yoy' = 'annual_yoy';

  // Strategy A: Annual vs Annual comparison
  const annuals = parsedDescriptors
    .filter((d) => d.isAnnual)
    .sort((a, b) => b.sortKey - a.sortKey);

  if (annuals.length >= 2) {
    curDesc = annuals[0];
    // Find the immediately preceding annual period (strictly fiscalYear - 1)
    const matchedPrior = annuals.find((d) => d.fiscalYear === curDesc!.fiscalYear - 1);
    if (matchedPrior) {
      priorDesc = matchedPrior;
      comparisonType = 'annual_yoy';
    }
  }

  // Strategy B: Same-Quarter YoY comparison (e.g. Q3 2025 vs Q3 2024)
  if (!curDesc || !priorDesc) {
    const quarterlies = parsedDescriptors
      .filter((d) => d.isQuarterly)
      .sort((a, b) => b.sortKey - a.sortKey);

    if (quarterlies.length >= 2) {
      const candidateCur = quarterlies[0];
      // Find matching prior year quarter (strictly same quarter, immediately preceding fiscalYear - 1)
      const matchedPriorQuarter = quarterlies.find(
        (d) => d.quarter === candidateCur.quarter && d.fiscalYear === candidateCur.fiscalYear - 1
      );

      if (matchedPriorQuarter) {
        curDesc = candidateCur;
        priorDesc = matchedPriorQuarter;
        comparisonType = 'quarter_yoy';
      }
    }
  }

  // If no comparable period pair can be verified, fail closed
  if (!curDesc || !priorDesc) {
    return null;
  }

  const cur = curDesc.statement;
  const prior = priorDesc.statement;

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

  // YoY Calculations with zero-division protection
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

  // Operating Margins
  const curOpMargin = (curOpInc !== null && curRev !== null && curRev > 0)
    ? (curOpInc / curRev) * 100
    : null;
  const priorOpMargin = (priorOpInc !== null && priorRev !== null && priorRev > 0)
    ? (priorOpInc / priorRev) * 100
    : null;

  const operatingMarginBpsDelta = (curOpMargin !== null && priorOpMargin !== null)
    ? Number(((curOpMargin - priorOpMargin) * 100).toFixed(0))
    : null;

  // Shares & Dilution Pace
  let shareCountDeltaPct: number | null = null;
  let dilutionOrBuyback: 'buybacks' | 'dilution' | 'stable' = 'stable';
  if (curShares !== null && priorShares !== null && priorShares > 0) {
    shareCountDeltaPct = Number((((curShares - priorShares) / priorShares) * 100).toFixed(2));
    if (shareCountDeltaPct < -0.1) dilutionOrBuyback = 'buybacks';
    else if (shareCountDeltaPct > 0.1) dilutionOrBuyback = 'dilution';
  }

  // Cash Conversion Quality (P1-2):
  // Grounded in factual OCF-to-Net Income ratio
  const ocfToNetIncomeRatioCurrent = (curNetInc !== null && curNetInc !== 0 && curOcf !== null)
    ? Number((curOcf / curNetInc).toFixed(2))
    : null;

  const ocfToNetIncomeRatioPrior = (priorNetInc !== null && priorNetInc !== 0 && priorOcf !== null)
    ? Number((priorOcf / priorNetInc).toFixed(2))
    : null;

  // Factual working capital check (Accounts Receivable YoY vs Revenue YoY)
  const curAr = parseNum(cur.accounts_receivable);
  const priorAr = parseNum(prior.accounts_receivable);
  let workingCapitalNote: string | undefined;

  if (curAr !== null && priorAr !== null && priorAr > 0 && revenueYoYPct !== null) {
    const arDeltaPct = Number((((curAr - priorAr) / priorAr) * 100).toFixed(1));
    if (arDeltaPct > revenueYoYPct + 10) {
      workingCapitalNote = isThai
        ? `ลูกหนี้การค้าขยายตัว (+${arDeltaPct}%) เร็วกว่าอัตราการเติบโตของรายได้ (+${revenueYoYPct.toFixed(1)}%)`
        : `Accounts receivable expanded (+${arDeltaPct}%) faster than revenue growth (+${revenueYoYPct.toFixed(1)}%).`;
    }
  }

  // Fact-based Cash Conversion Status
  let cashConversionStatus: 'healthy' | 'warning' | 'neutral' = 'neutral';
  let cashConversionSummary: string;

  if (curNetInc !== null && curNetInc > 0 && curOcf !== null && curOcf < 0) {
    // Severe divergence: profitable on accrual basis, burning cash on operations
    cashConversionStatus = 'warning';
    cashConversionSummary = isThai
      ? `ระวัง: กำไรสุทธิเป็นบวก ($${curNetInc.toLocaleString()}M) แต่กระแสเงินสดจากการดำเนินงานกลับติดลบ ($${curOcf.toLocaleString()}M)`
      : `Divergence Alert: Positive net income ($${curNetInc.toLocaleString()}M) accompanied by negative operating cash flow ($${curOcf.toLocaleString()}M).`;
  } else if (revenueYoYPct !== null && ocfYoYPct !== null && revenueYoYPct > 0 && ocfYoYPct < 0) {
    // Topline expansion with cash contraction
    cashConversionStatus = 'warning';
    cashConversionSummary = isThai
      ? `ความต่างของกระแสเงินสด: รายได้ขยายตัว (+${revenueYoYPct.toFixed(1)}%) แต่ OCF ลดลง (${ocfYoYPct.toFixed(1)}%) อัตราส่วน OCF/NI อยู่ที่ ${ocfToNetIncomeRatioCurrent !== null ? ocfToNetIncomeRatioCurrent + 'x' : 'N/A'}`
      : `Cash conversion divergence: Revenue grew (+${revenueYoYPct.toFixed(1)}%) while Operating Cash Flow contracted (${ocfYoYPct.toFixed(1)}%). Current OCF/NI: ${ocfToNetIncomeRatioCurrent !== null ? ocfToNetIncomeRatioCurrent + 'x' : 'N/A'}.`;
  } else if (ocfToNetIncomeRatioCurrent !== null && ocfToNetIncomeRatioCurrent >= 1.0) {
    // High earnings quality: OCF fully covers Net Income
    cashConversionStatus = 'healthy';
    cashConversionSummary = isThai
      ? `คุณภาพกระแสเงินสดแข็งแกร่ง: อัตราส่วน OCF ต่อกำไรสุทธิอยู่ที่ ${ocfToNetIncomeRatioCurrent}x (กำไรได้รับการสนับสนุนด้วยเงินสดจริงเต็มจำนวน)`
      : `High earnings quality: OCF-to-Net Income ratio of ${ocfToNetIncomeRatioCurrent}x confirms robust cash-backed accounting profits.`;
  } else if (ocfToNetIncomeRatioCurrent !== null && ocfToNetIncomeRatioCurrent < 0.70 && curNetInc !== null && curNetInc > 0) {
    // Below benchmark conversion
    cashConversionStatus = 'warning';
    cashConversionSummary = isThai
      ? `อัตราการแปลงกำไรเป็นเงินสดต่ำ: OCF คิดเป็นเพียง ${ocfToNetIncomeRatioCurrent}x ของกำไรสุทธิ (ต่ำกว่าเกณฑ์สถาบัน 1.0x)`
      : `Subdued cash conversion: OCF is ${ocfToNetIncomeRatioCurrent}x of net income (below the 1.0x institutional benchmark).`;
  } else {
    cashConversionStatus = 'healthy';
    cashConversionSummary = isThai
      ? `กระแสเงินสดจากการดำเนินงานสอดคล้องกับผลการดำเนินงาน (อัตราส่วน OCF/NI: ${ocfToNetIncomeRatioCurrent !== null ? ocfToNetIncomeRatioCurrent + 'x' : 'N/A'})`
      : `Operating cash flow aligns with reported earnings (OCF/NI: ${ocfToNetIncomeRatioCurrent !== null ? ocfToNetIncomeRatioCurrent + 'x' : 'N/A'}).`;
  }

  return {
    currentPeriod: cur.period,
    priorPeriod: prior.period,
    comparisonType,
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
    ocfToNetIncomeRatioCurrent,
    ocfToNetIncomeRatioPrior,
    cashConversionStatus,
    cashConversionSummary,
    workingCapitalNote,
  };
}
