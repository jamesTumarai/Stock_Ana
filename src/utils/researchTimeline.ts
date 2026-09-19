import { HistoricalReportDelta, ReportData } from '../types';

export interface TimelineEntry {
  id?: string;
  reportDate: string;
  timestamp?: number;
  timeStr?: string;
  formattedDateTime?: string;
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
 * Formats a snapshot timestamp into date and time strings deterministically.
 * Preserves date and time (e.g. 19 Sep 2026 · 14:12) to distinguish same-day runs.
 */
export function formatSnapshotDateTime(
  timestamp: number | undefined,
  dateFallback: string,
  isThai = false
): {
  dateStr: string;
  timeStr: string;
  fullDisplay: string;
} {
  if (timestamp && Number.isFinite(timestamp) && timestamp > 0) {
    const d = new Date(timestamp);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const year = yyyy;

    const fullDisplay = isThai
      ? `${day} ${monthsTh[month]} ${year} · ${timeStr}`
      : `${day} ${monthsEn[month]} ${year} · ${timeStr}`;

    return { dateStr, timeStr, fullDisplay };
  }

  return {
    dateStr: dateFallback || 'Unknown Date',
    timeStr: '',
    fullDisplay: dateFallback || 'Unknown Date'
  };
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

    const dtInfo = formatSnapshotDateTime(item.createdTimestamp, dateStr, false);

    // Unique key avoids overwriting reports on the same day
    const uniqueKey = item.reportId
      ? `id_${item.reportId}`
      : `ts_${cleanTicker}_${item.createdTimestamp || dateStr}`;

    timelineMap.set(uniqueKey, {
      id: item.reportId || undefined,
      reportDate: dateStr,
      timestamp: item.createdTimestamp,
      timeStr: dtInfo.timeStr,
      formattedDateTime: dtInfo.fullDisplay,
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

    const activeDtInfo = formatSnapshotDateTime(timestamp, activeDate, false);

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
        timeStr: activeDtInfo.timeStr,
        formattedDateTime: activeDtInfo.fullDisplay,
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
 * Evaluates whether two research snapshots are materially equivalent for What Changed baseline purposes.
 * If two snapshots share identical conviction, valuation, key fundamentals, and thesis status,
 * the earlier duplicate is skipped so that What Changed compares against the nearest distinct state.
 */
export function isMateriallyEquivalentSnapshot(
  a: ReportData | any,
  b: ReportData | any
): boolean {
  if (!a || !b) return false;
  const reportA = unwrapHistoryRecord(a)?.data || a;
  const reportB = unwrapHistoryRecord(b)?.data || b;

  // 1. Conviction score
  const convA = extractReportConviction(reportA);
  const convB = extractReportConviction(reportB);
  if (convA !== convB) return false;

  // 2. Base fair value (within 0.5% or identical)
  const fvA = extractReportFairValue(reportA);
  const fvB = extractReportFairValue(reportB);
  if (fvA !== fvB) {
    if (fvA === null || fvB === null) return false;
    if (Math.abs(fvA - fvB) / Math.max(fvA, fvB) >= 0.005) return false;
  }

  // 3. Key financial metrics (Revenue, Operating Income / Net Income, FCF)
  const stmtsA = reportA.financial_statements;
  const stmtsB = reportB.financial_statements;
  const periodsA = stmtsA?.periods || [];
  const periodsB = stmtsB?.periods || [];
  const idxA = periodsA.length - 1;
  const idxB = periodsB.length - 1;

  if (periodsA[idxA] !== periodsB[idxB]) return false;

  const revA = stmtsA?.income_statement?.revenue?.[idxA];
  const revB = stmtsB?.income_statement?.revenue?.[idxB];
  if (revA !== revB && (revA !== undefined || revB !== undefined)) return false;

  const opIncA = stmtsA?.income_statement?.operating_income?.[idxA];
  const opIncB = stmtsB?.income_statement?.operating_income?.[idxB];
  if (opIncA !== opIncB && (opIncA !== undefined || opIncB !== undefined)) return false;

  const netIncA = stmtsA?.income_statement?.net_income?.[idxA];
  const netIncB = stmtsB?.income_statement?.net_income?.[idxB];
  if (netIncA !== netIncB && (netIncA !== undefined || netIncB !== undefined)) return false;

  const fcfA = stmtsA?.cash_flow?.free_cash_flow?.[idxA];
  const fcfB = stmtsB?.cash_flow?.free_cash_flow?.[idxB];
  if (fcfA !== fcfB && (fcfA !== undefined || fcfB !== undefined)) return false;

  // 4. Material evidence / SEC filing
  const accA = reportA.comprehensive_analysis?.sec_filing_evidence?.accession_number
    || reportA.evidence?.secAccession;
  const accB = reportB.comprehensive_analysis?.sec_filing_evidence?.accession_number
    || reportB.evidence?.secAccession;
  if (accA !== accB) return false;

  // 5. Thesis status
  const thesisA = reportA.thesis_record || reportA.investment_thesis;
  const thesisB = reportB.thesis_record || reportB.investment_thesis;
  if (thesisA?.status !== thesisB?.status) return false;

  // 6. Market price (intraday price noise < 2% with identical conviction/fundamentals is equivalent)
  const priceA = extractReportPrice(reportA);
  const priceB = extractReportPrice(reportB);
  if (priceA !== priceB) {
    if (priceA === null || priceB === null) return false;
    if (Math.abs(priceA - priceB) / Math.max(priceA, priceB) >= 0.02) return false;
  }

  return true;
}

/**
 * Selects the nearest prior distinct research snapshot for change detection.
 * Walks backward in time from current report, skipping duplicate or materially equivalent runs.
 * Returns null if no materially distinct prior snapshot exists.
 */
export function selectPreviousDistinctSnapshot(
  tickerOrReport: string | ReportData,
  allReports: any[] = [],
  currentReport?: ReportData | null
): ReportData | null {
  let cleanTicker = '';
  let curReport: ReportData | null = null;

  if (typeof tickerOrReport === 'string') {
    cleanTicker = tickerOrReport.toUpperCase().trim();
    curReport = currentReport || null;
  } else if (tickerOrReport && typeof tickerOrReport === 'object') {
    curReport = tickerOrReport;
    const unwrappedCur = unwrapHistoryRecord(curReport);
    cleanTicker = (unwrappedCur?.ticker || (curReport as any).ticker || '').toUpperCase().trim();
  }

  if (!cleanTicker || !Array.isArray(allReports) || allReports.length === 0) {
    return null;
  }

  const currentUnwrapped = curReport ? unwrapHistoryRecord(curReport) : null;
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

    // Candidate must be strictly earlier if timestamps exist
    if (currentTimestamp > 0 && unwrapped.createdTimestamp >= currentTimestamp) {
      continue;
    }

    // Skip if identical object reference
    if (curReport && (unwrapped.data === curReport || r === curReport)) {
      continue;
    }

    candidates.push(unwrapped);
  }

  if (candidates.length === 0) return null;

  // Sort strictly descending by createdTimestamp (newest first)
  candidates.sort((a, b) => b.createdTimestamp - a.createdTimestamp);

  // Walk backward: find the first snapshot that is materially distinct from curReport
  for (const candidate of candidates) {
    if (!curReport || !isMateriallyEquivalentSnapshot(curReport, candidate.data)) {
      return candidate.data;
    }
  }

  // All prior snapshots were materially equivalent
  return null;
}

/**
 * Returns the nearest prior distinct historical report strictly prior to currentReport for the specified ticker.
 * Handles Firestore wrappers, same-day multiple analyses, and skips materially equivalent duplicates.
 */
export function getPreviousReport(
  ticker: string,
  allReports: any[] = [],
  currentReport?: ReportData | null
): ReportData | null {
  return selectPreviousDistinctSnapshot(ticker, allReports, currentReport);
}

export function extractReportTimestamp(report: any): number {
  if (!report) return 0;
  const unwrapped = unwrapHistoryRecord(report);
  if (unwrapped && unwrapped.createdTimestamp > 0) {
    return unwrapped.createdTimestamp;
  }
  const r = report.data || report;
  const raw = report.createdAt || report.created_at || report.generated_at || r.createdAt || r.created_at || r.generated_at;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw?.seconds) return raw.seconds * 1000;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  if (typeof raw?.toDate === 'function') return raw.toDate().getTime();
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const dateStr = extractReportDate(report);
  const parsedDate = Date.parse(dateStr);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

export function computeHistoricalDelta(
  currentReport: ReportData | any,
  previousReport: ReportData | any,
  isThai = false
): HistoricalReportDelta | null {
  if (!currentReport || !previousReport) return null;

  const cur = unwrapHistoryRecord(currentReport)?.data || currentReport;
  const prev = unwrapHistoryRecord(previousReport)?.data || previousReport;

  const curTimestamp = extractReportTimestamp(currentReport);
  const prevTimestamp = extractReportTimestamp(previousReport);

  const currentDate = extractReportDate(currentReport);
  const prevDate = extractReportDate(previousReport);

  const curDt = formatSnapshotDateTime(curTimestamp, currentDate, isThai);
  const prevDt = formatSnapshotDateTime(prevTimestamp, prevDate, isThai);

  const diffMs = Math.abs(curTimestamp - prevTimestamp);
  const daysBetween = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  let elapsedTimeDisplay = '';
  if (diffMs < 1000 * 60 * 60 * 24 && diffMs > 0) {
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      elapsedTimeDisplay = isThai
        ? `${hours} ชม.${mins > 0 ? ` ${mins} นาที` : ''}`
        : `${hours}h${mins > 0 ? ` ${mins}m` : ''}`;
    } else {
      elapsedTimeDisplay = isThai ? `${mins} นาที` : `${mins}m`;
    }
  } else {
    elapsedTimeDisplay = isThai ? `${daysBetween} วัน` : `${daysBetween} days`;
  }

  const comparisonWindowLabel = isThai
    ? `เปรียบเทียบกับการวิเคราะห์ก่อนหน้า ${prevDt.fullDisplay} → ${curDt.fullDisplay}`
    : `Compared with prior analysis ${prevDt.fullDisplay} → ${curDt.fullDisplay}`;

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

  // 4. Fundamental metrics delta (Revenue YoY, Opm, FCF, Net Income, EPS)
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

  let netIncomeDelta = null;
  const curNetInc = curStmt?.income_statement?.net_income?.[curLatestIdx];
  const prevNetInc = prevStmt?.income_statement?.net_income?.[prevLatestIdx];
  if (typeof curNetInc === 'number' && typeof prevNetInc === 'number' && prevNetInc !== 0) {
    netIncomeDelta = {
      previous: prevNetInc,
      current: curNetInc,
      deltaPct: Number((((curNetInc - prevNetInc) / Math.abs(prevNetInc)) * 100).toFixed(2))
    };
  }

  let epsDelta = null;
  const curEps = curStmt?.income_statement?.eps_diluted?.[curLatestIdx] ?? curStmt?.income_statement?.eps?.[curLatestIdx];
  const prevEps = prevStmt?.income_statement?.eps_diluted?.[prevLatestIdx] ?? prevStmt?.income_statement?.eps?.[prevLatestIdx];
  if (typeof curEps === 'number' && typeof prevEps === 'number') {
    epsDelta = {
      previous: prevEps,
      current: curEps,
      delta: Number((curEps - prevEps).toFixed(2))
    };
  }

  return {
    previousReportDate: prevDate,
    currentReportDate: currentDate,
    previousTimestamp: prevTimestamp > 0 ? prevTimestamp : undefined,
    currentTimestamp: curTimestamp > 0 ? curTimestamp : undefined,
    previousDisplayDate: prevDt.fullDisplay,
    currentDisplayDate: curDt.fullDisplay,
    comparisonWindowLabel,
    elapsedTimeDisplay,
    daysBetween,
    priceDelta,
    fairValueDelta,
    convictionScoreDelta,
    revenueYoYDelta,
    operatingMarginDelta,
    freeCashFlowDelta,
    netIncomeDelta,
    epsDelta
  };
}
