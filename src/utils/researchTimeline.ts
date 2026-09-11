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

export function extractReportDate(report: any): string {
  if (report?.report_date) return String(report.report_date);
  if (report?.created_at?.toDate) {
    return report.created_at.toDate().toISOString().split('T')[0];
  }
  if (report?.created_at && typeof report.created_at === 'string') {
    return report.created_at.split('T')[0];
  }
  if (report?.date) return String(report.date);
  return 'Unknown Date';
}

export function extractReportPrice(report: any): number | null {
  const p = report?.intrinsic_value?.current_price
    ?? report?.company_profile?.stock_price
    ?? report?.technical_analysis?.key_levels?.current_price;
  if (typeof p === 'number' && Number.isFinite(p) && p > 0) return p;
  if (typeof p === 'string') {
    const parsed = parseFloat(p.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function extractReportFairValue(report: any): number | null {
  const fv = report?.intrinsic_value?.summary?.base_case_fair_value
    ?? report?.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share;
  if (typeof fv === 'number' && Number.isFinite(fv) && fv > 0) return fv;
  if (typeof fv === 'string') {
    const parsed = parseFloat(fv.replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export function extractReportConviction(report: any): number | null {
  const c = report?.verdict?.conviction_score;
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

  // Filter reports matching this ticker
  const matching = allReports.filter(r => {
    const t = (r.ticker || r.company_profile?.overview?.symbol || '').toUpperCase().trim();
    return t === cleanTicker;
  });

  const timelineMap = new Map<string, TimelineEntry>();

  // Add past reports
  for (const r of matching) {
    const dateStr = extractReportDate(r);
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

    timelineMap.set(dateStr, {
      id: r.id,
      reportDate: dateStr,
      timestamp: r.created_at?.toMillis ? r.created_at.toMillis() : Date.parse(dateStr) || 0,
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

  // Ensure current active report is present in timeline
  if (activeReport) {
    const activeDate = extractReportDate(activeReport);
    const price = extractReportPrice(activeReport);
    const fv = extractReportFairValue(activeReport);
    const conviction = extractReportConviction(activeReport);
    const mos = (price && fv && price > 0)
      ? Number((((fv - price) / price) * 100).toFixed(1))
      : null;

    timelineMap.set(activeDate, {
      reportDate: activeDate,
      timestamp: Date.now(),
      ticker: cleanTicker,
      analysisType: activeReport.analysis_type || 'comprehensive',
      marketPrice: price,
      fairValue: fv,
      marginOfSafetyPct: mos,
      convictionScore: conviction,
      keyDrivers: [],
      reportSnapshot: activeReport
    });
  }

  // Sort descending by timestamp / date
  return Array.from(timelineMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export function computeHistoricalDelta(
  currentReport: ReportData,
  previousReport: ReportData
): HistoricalReportDelta | null {
  if (!currentReport || !previousReport) return null;

  const currentDate = extractReportDate(currentReport);
  const prevDate = extractReportDate(previousReport);

  const curTimestamp = Date.parse(currentDate) || Date.now();
  const prevTimestamp = Date.parse(prevDate) || 0;
  const daysBetween = Math.max(0, Math.round(Math.abs(curTimestamp - prevTimestamp) / (1000 * 60 * 60 * 24)));

  // 1. Price delta
  const curPrice = extractReportPrice(currentReport);
  const prevPrice = extractReportPrice(previousReport);
  const priceDelta = (curPrice && prevPrice && prevPrice > 0)
    ? {
        previous: prevPrice,
        current: curPrice,
        deltaPct: Number((((curPrice - prevPrice) / prevPrice) * 100).toFixed(2))
      }
    : null;

  // 2. Fair Value delta
  const curFv = extractReportFairValue(currentReport);
  const prevFv = extractReportFairValue(previousReport);
  const fairValueDelta = (curFv && prevFv && prevFv > 0)
    ? {
        previous: prevFv,
        current: curFv,
        deltaPct: Number((((curFv - prevFv) / prevFv) * 100).toFixed(2))
      }
    : null;

  // 3. Conviction Score delta
  const curScore = extractReportConviction(currentReport);
  const prevScore = extractReportConviction(previousReport);
  const convictionScoreDelta = (typeof curScore === 'number' && typeof prevScore === 'number')
    ? {
        previous: prevScore,
        current: curScore,
        deltaPoints: curScore - prevScore
      }
    : null;

  // 4. Fundamental metrics delta (Revenue YoY, Opm, FCF from latest quarter in statements)
  const curStmt = currentReport.financial_statements;
  const prevStmt = previousReport.financial_statements;

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
