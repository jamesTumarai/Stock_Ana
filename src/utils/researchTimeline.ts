import { HistoricalReportDelta, ReportData } from '../types';

export interface TimelineEntry {
  id?: string;
  reportDate: string;
  timestamp?: number;
  ticker: string;
  analysisType?: string;
  marketPrice?: number | null;
  fairValue?: number | null;
  marginOfSafetyPct?: number | null;
  convictionScore?: number | null;
  keyDrivers?: string[];
  reportSnapshot?: ReportData;
}

export interface UnwrappedHistoryRecord {
  reportId: string;
  ticker: string;
  createdAt: string; // ISO date string
  createdTimestamp: number;
  data: ReportData;
  schemaVersion?: string;
  validationStatus?: string;
  isLegacy?: boolean;
}

/**
 * Canonical adapter to unwrap historical report records.
 * Supports Firestore wrappers ({ id, ticker, createdAt, data: report }),
 * legacy records, and direct ReportData objects.
 */
export function unwrapHistoryRecord(record: any): UnwrappedHistoryRecord | null {
  if (!record || typeof record !== 'object') return null;

  // 1. Resolve data payload
  const hasInnerData = record.data && typeof record.data === 'object' && (
    'intrinsic_value' in record.data ||
    'company_profile' in record.data ||
    'financial_statements' in record.data ||
    'verdict' in record.data ||
    'analysis_type' in record.data
  );
  const dataPayload: ReportData = hasInnerData ? record.data : record;

  // 2. Resolve ticker
  const rawTicker = record.ticker
    || record.data?.ticker
    || record.company_profile?.overview?.symbol
    || record.data?.company_profile?.overview?.symbol
    || record.symbol
    || '';
  const ticker = String(rawTicker).toUpperCase().trim();
  if (!ticker) return null;

  // 3. Resolve reportId
  const reportId = String(record.id || record.report_id || record.data?.id || record.data?.report_id || '');

  // 4. Resolve timestamp & ISO date
  let createdTimestamp = 0;
  if (record.createdAt?.seconds) {
    createdTimestamp = record.createdAt.seconds * 1000;
  } else if (typeof record.createdAt?.toMillis === 'function') {
    createdTimestamp = record.createdAt.toMillis();
  } else if (typeof record.createdAt?.toDate === 'function') {
    createdTimestamp = record.createdAt.toDate().getTime();
  } else if (record.created_at?.seconds) {
    createdTimestamp = record.created_at.seconds * 1000;
  } else if (typeof record.created_at?.toMillis === 'function') {
    createdTimestamp = record.created_at.toMillis();
  } else if (typeof record.created_at?.toDate === 'function') {
    createdTimestamp = record.created_at.toDate().getTime();
  } else if (typeof record.createdAt === 'number' && Number.isFinite(record.createdAt)) {
    createdTimestamp = record.createdAt;
  } else if (typeof record.created_at === 'number' && Number.isFinite(record.created_at)) {
    createdTimestamp = record.created_at;
  } else if (record.createdAt && typeof record.createdAt === 'string') {
    const parsed = Date.parse(record.createdAt);
    if (Number.isFinite(parsed)) createdTimestamp = parsed;
  } else if (record.created_at && typeof record.created_at === 'string') {
    const parsed = Date.parse(record.created_at);
    if (Number.isFinite(parsed)) createdTimestamp = parsed;
  } else if (dataPayload.generated_at) {
    const parsed = Date.parse(String(dataPayload.generated_at));
    if (Number.isFinite(parsed)) createdTimestamp = parsed;
  } else if (record.report_date) {
    const parsed = Date.parse(String(record.report_date));
    if (Number.isFinite(parsed)) createdTimestamp = parsed;
  } else if ((dataPayload as any).report_date) {
    const parsed = Date.parse(String((dataPayload as any).report_date));
    if (Number.isFinite(parsed)) createdTimestamp = parsed;
  }

  const createdAt = createdTimestamp > 0
    ? new Date(createdTimestamp).toISOString()
    : (record.report_date || (dataPayload as any).report_date || 'Unknown Date');

  return {
    reportId,
    ticker,
    createdAt,
    createdTimestamp,
    data: dataPayload,
    schemaVersion: record.schemaVersion || dataPayload.schema_version,
    validationStatus: record.validationStatus || dataPayload.validation?.status,
    isLegacy: Boolean(record.isLegacy)
  };
}

export function extractReportDate(report: any): string {
  const unwrapped = unwrapHistoryRecord(report);
  if (unwrapped && unwrapped.createdAt && unwrapped.createdAt !== 'Unknown Date') {
    return unwrapped.createdAt.split('T')[0];
  }
  if (report?.report_date) return String(report.report_date);
  if (report?.date) return String(report.date);
  return 'Unknown Date';
}

export function extractReportPrice(report: any): number | null {
  const r = report?.data || report;
  const p = r?.intrinsic_value?.current_price
    ?? r?.company_profile?.stock_price
    ?? r?.technical_analysis?.key_levels?.current_price;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) return p;
  if (typeof p === 'string') {
    const parsed = parseFloat(p.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function extractReportFairValue(report: any): number | null {
  const r = report?.data || report;
  const fv = r?.intrinsic_value?.summary?.base_case_fair_value
    ?? r?.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share;
  if (typeof fv === 'number' && Number.isFinite(fv) && fv > 0) return fv;
  if (typeof fv === 'string') {
    const parsed = parseFloat(fv.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function extractReportConviction(report: any): number | null {
  const r = report?.data || report;
  const c = r?.verdict?.conviction_score;
  if (typeof c === 'number' && Number.isFinite(c)) return c;
  if (typeof c === 'string') {
    const parsed = parseInt(c, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function buildResearchTimeline(
  ticker: string,
  allReports: any[] = [],
  activeReport?: ReportData
): TimelineEntry[] {
  const cleanTicker = ticker.toUpperCase().trim();

  // 1. Unwrap all historical reports matching ticker
  const unwrappedList: UnwrappedHistoryRecord[] = [];
  for (const r of allReports) {
    const unwrapped = unwrapHistoryRecord(r);
    if (unwrapped && unwrapped.ticker === cleanTicker) {
      unwrappedList.push(unwrapped);
    }
  }

  // 2. Sort descending by createdTimestamp
  unwrappedList.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  const timelineMap = new Map<string, TimelineEntry>();

  // Add past reports with unique key (retaining same-day multiple analyses)
  for (const item of unwrappedList) {
    const r = item.data;
    const dateStr = item.createdAt.includes('T') ? item.createdAt.split('T')[0] : item.createdAt;
    const price = extractReportPrice(r);
    const fv = extractReportFairValue(r);
    const conviction = extractReportConviction(r);
    const mos = (price && fv && price > 0)
      ? Number((((fv - price) / price) * 100).toFixed(1))
      : null;

    const drivers: string[] = [];
    if (r.comprehensive_analysis?.business_strengths) {
      drivers.push(String(r.comprehensive_analysis.business_strengths).slice(0, 120));
    }

    // Unique key avoids overwriting reports on the same day
    const uniqueKey = item.reportId
      ? `id_${item.reportId}`
      : `ts_${cleanTicker}_${item.createdTimestamp || dateStr}`;

    timelineMap.set(uniqueKey, {
      id: item.reportId || undefined,
      reportDate: dateStr,
      timestamp: item.createdTimestamp,
      ticker: cleanTicker,
      analysisType: r.analysis_type || 'comprehensive',
      marketPrice: price,
      fairValue: fv,
      marginOfSafetyPct: mos,
      convictionScore: conviction,
      keyDrivers: drivers,
      reportSnapshot: r
    });
  }

  // 3. Ensure current active report is present in timeline
  if (activeReport) {
    const activeUnwrapped = unwrapHistoryRecord(activeReport);
    const r = activeUnwrapped?.data || activeReport;
    const activeDate = activeUnwrapped?.createdAt && activeUnwrapped.createdAt.includes('T')
      ? activeUnwrapped.createdAt.split('T')[0]
      : extractReportDate(r);
    const price = extractReportPrice(r);
    const fv = extractReportFairValue(r);
    const conviction = extractReportConviction(r);
    const mos = (price && fv && price > 0)
      ? Number((((fv - price) / price) * 100).toFixed(1))
      : null;
    const timestamp = activeUnwrapped?.createdTimestamp && activeUnwrapped.createdTimestamp > 0
      ? activeUnwrapped.createdTimestamp
      : Date.now();

    const activeId = activeUnwrapped?.reportId || 'active';
    const activeKey = activeId !== 'active' ? `id_${activeId}` : `active_${cleanTicker}_${timestamp}`;

    // Check if duplicate of an existing record
    const alreadyExists = Array.from(timelineMap.values()).some(e =>
      (activeId !== 'active' && e.id && e.id === activeId) ||
      (Math.abs((e.timestamp || 0) - timestamp) < 1000 && e.marketPrice === price && e.fairValue === fv)
    );

    if (!alreadyExists) {
      timelineMap.set(activeKey, {
        id: activeId !== 'active' ? activeId : undefined,
        reportDate: activeDate,
        timestamp,
        ticker: cleanTicker,
        analysisType: r.analysis_type || 'comprehensive',
        marketPrice: price,
        fairValue: fv,
        marginOfSafetyPct: mos,
        convictionScore: conviction,
        keyDrivers: [],
        reportSnapshot: r
      });
    }
  }

  // 4. Sort descending strictly by timestamp
  return Array.from(timelineMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

/**
 * Returns the latest historical report strictly prior to currentReport for the specified ticker.
 * Handles Firestore wrappers, same-day multiple analyses, and arbitrary input sort order.
 */
export function getPreviousReport(
  ticker: string,
  allReports: any[] = [],
  currentReport?: ReportData | null
): ReportData | null {
  const cleanTicker = ticker.toUpperCase().trim();
  if (!cleanTicker || !Array.isArray(allReports) || allReports.length === 0) return null;

  const currentUnwrapped = currentReport ? unwrapHistoryRecord(currentReport) : null;
  const currentTimestamp = currentUnwrapped?.createdTimestamp || 0;
  const currentId = currentUnwrapped?.reportId;

  const candidates: UnwrappedHistoryRecord[] = [];

  for (const r of allReports) {
    const unwrapped = unwrapHistoryRecord(r);
    if (!unwrapped || unwrapped.ticker !== cleanTicker) continue;

    // Skip if same report ID
    if (currentId && unwrapped.reportId && unwrapped.reportId === currentId) {
      continue;
    }

    // If current report has a timestamp, candidate must be strictly earlier
    if (currentTimestamp > 0 && unwrapped.createdTimestamp >= currentTimestamp) {
      continue;
    }

    // Skip if identical object reference
    if (currentReport && (unwrapped.data === currentReport || (r === currentReport))) {
      continue;
    }

    candidates.push(unwrapped);
  }

  if (candidates.length === 0) return null;

  // Sort candidates strictly descending by createdTimestamp
  candidates.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  return candidates[0].data;
}

export function computeHistoricalDelta(
  currentReport: ReportData | any,
  previousReport: ReportData | any
): HistoricalReportDelta | null {
  if (!currentReport || !previousReport) return null;

  const cur = unwrapHistoryRecord(currentReport)?.data || currentReport;
  const prev = unwrapHistoryRecord(previousReport)?.data || previousReport;

  const currentDate = extractReportDate(currentReport);
  const prevDate = extractReportDate(previousReport);

  const curTimestamp = Date.parse(currentDate) || Date.now();
  const prevTimestamp = Date.parse(prevDate) || 0;
  const daysBetween = Math.max(0, Math.round(Math.abs(curTimestamp - prevTimestamp) / (1000 * 60 * 60 * 24)));

  // 1. Price delta
  const curPrice = extractReportPrice(cur);
  const prevPrice = extractReportPrice(prev);
  const priceDelta = (curPrice && prevPrice && prevPrice > 0)
    ? {
        previous: prevPrice,
        current: curPrice,
        deltaPct: Number((((curPrice - prevPrice) / prevPrice) * 100).toFixed(2))
      }
    : null;

  // 2. Fair Value delta
  const curFv = extractReportFairValue(cur);
  const prevFv = extractReportFairValue(prev);
  const fairValueDelta = (curFv && prevFv && prevFv > 0)
    ? {
        previous: prevFv,
        current: curFv,
        deltaPct: Number((((curFv - prevFv) / prevFv) * 100).toFixed(2))
      }
    : null;

  // 3. Conviction Score delta
  const curScore = extractReportConviction(cur);
  const prevScore = extractReportConviction(prev);
  const convictionScoreDelta = (typeof curScore === 'number' && typeof prevScore === 'number')
    ? {
        previous: prevScore,
        current: curScore,
        deltaPoints: curScore - prevScore
      }
    : null;

  // 4. Fundamental metrics delta (Revenue YoY, Opm, FCF from latest quarter in statements)
  const curStmt = cur.financial_statements;
  const prevStmt = prev.financial_statements;

  const curPeriods = curStmt?.periods || [];
  const prevPeriods = prevStmt?.periods || [];

  const curLatestIdx = curPeriods.length - 1;
  const prevLatestIdx = prevPeriods.length - 1;

  let revenueYoYDelta = null;
  const curRevGrowth = curStmt?.income_statement?.yoy_revenue_growth_pct?.[curLatestIdx];
  const prevRevGrowth = prevStmt?.income_statement?.yoy_revenue_growth_pct?.[prevLatestIdx];
  if (typeof curRevGrowth === 'number' && typeof prevRevGrowth === 'number') {
    revenueYoYDelta = {
      previous: prevRevGrowth,
      current: curRevGrowth,
      deltaPctPoints: Number((curRevGrowth - prevRevGrowth).toFixed(2))
    };
  }

  let operatingMarginDelta = null;
  const curOpm = curStmt?.income_statement?.operating_income?.[curLatestIdx] && curStmt?.income_statement?.revenue?.[curLatestIdx]
    ? (curStmt.income_statement.operating_income[curLatestIdx]! / curStmt.income_statement.revenue[curLatestIdx]!) * 100
    : null;
  const prevOpm = prevStmt?.income_statement?.operating_income?.[prevLatestIdx] && prevStmt?.income_statement?.revenue?.[prevLatestIdx]
    ? (prevStmt.income_statement.operating_income[prevLatestIdx]! / prevStmt.income_statement.revenue[prevLatestIdx]!) * 100
    : null;
  if (typeof curOpm === 'number' && typeof prevOpm === 'number') {
    operatingMarginDelta = {
      previous: Number(prevOpm.toFixed(2)),
      current: Number(curOpm.toFixed(2)),
      deltaPctPoints: Number((curOpm - prevOpm).toFixed(2))
    };
  }

  let freeCashFlowDelta = null;
  const curFcf = curStmt?.cash_flow?.free_cash_flow?.[curLatestIdx];
  const prevFcf = prevStmt?.cash_flow?.free_cash_flow?.[prevLatestIdx];
  if (typeof curFcf === 'number' && typeof prevFcf === 'number' && prevFcf !== 0) {
    freeCashFlowDelta = {
      previous: prevFcf,
      current: curFcf,
      deltaPct: Number((((curFcf - prevFcf) / Math.abs(prevFcf)) * 100).toFixed(2))
    };
  }

  return {
    previousReportDate: prevDate,
    currentReportDate: currentDate,
    daysBetween,
    priceDelta,
    fairValueDelta,
    convictionScoreDelta,
    revenueYoYDelta,
    operatingMarginDelta,
    freeCashFlowDelta
  };
}
