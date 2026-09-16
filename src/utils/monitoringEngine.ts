/**
 * On-Open Research Monitoring Engine
 * Evaluates valuation anomalies, conviction score shifts, SEC filing changes, and portfolio
 * concentration risks when research reports are loaded or viewed in Lumina.
 * Operates client-side on active report state (does not claim continuous background daemon polling).
 */
import {
  MonitoringAlert,
  MonitoringPreferences,
  MultiPortfolioAllocationSummary,
  PortfolioSummary,
  ReportData,
  DocumentFinding,
  MaterialCompanyEvent,
  MaterialEventPortfolioContext
} from '../types';
import {
  extractReportDate,
  extractReportPrice,
  extractReportFairValue,
  extractReportConviction,
  getPreviousReport
} from './researchTimeline';

export const DEFAULT_MONITORING_PREFERENCES: MonitoringPreferences = {
  enableMosAlerts: true,
  mosThresholdPct: 20,
  enableOvervaluedAlerts: true,
  enableConvictionAlerts: true,
  convictionThresholdPoints: 10,
  enableFilingAlerts: true,
  enableConcentrationAlerts: true,
  concentrationThresholdPct: 30,
  enableNewsAlerts: true
};

export const ALERTS_PREFS_KEY = 'lumina_monitoring_prefs';
export const ALERTS_READ_KEY = 'lumina_read_alert_ids';
export const LAST_SEEN_FILING_KEY = 'lumina_last_seen_filing';
export const MONITORING_UPDATED_EVENT = 'lumina:monitoring-updated';

const formatLimitKey = (value: number): string => String(Number(value.toFixed(4))).replace('.', '_');

export function evaluateMultiPortfolioAlerts(
  summary: MultiPortfolioAllocationSummary,
  readIds: Set<string> = new Set(),
  timestamp = Date.now()
): MonitoringAlert[] {
  if (!summary.is_fully_priced) return [];
  const dateStr = new Date(timestamp).toISOString().split('T')[0];
  const alerts: MonitoringAlert[] = [];

  for (const item of summary.portfolios) {
    if (!item.portfolio || item.status !== 'ABOVE_MAX' || item.actual_pct_of_total === null || item.max_pct_of_total === null) continue;
    const id = `alert_portfolio_${item.portfolio.id}_ALLOCATION_LIMIT_${formatLimitKey(item.max_pct_of_total)}`;
    alerts.push({
      id,
      ticker: 'PORTFOLIO',
      type: 'PORTFOLIO_ALLOCATION_LIMIT',
      severity: 'warning',
      title: `${item.name} is above its portfolio maximum`,
      titleTh: `${item.name} เกินสัดส่วนสูงสุดของพอร์ต`,
      message: `${item.name} is ${item.actual_pct_of_total.toFixed(1)}% of total invested value. Configured maximum: ${item.max_pct_of_total.toFixed(1)}%. Excess: +${item.excess_pct_points?.toFixed(1)} pp.`,
      messageTh: `${item.name} มีสัดส่วน ${item.actual_pct_of_total.toFixed(1)}% ของมูลค่าเงินลงทุนรวม ขีดจำกัดที่ตั้งไว้ ${item.max_pct_of_total.toFixed(1)}% เกินมา +${item.excess_pct_points?.toFixed(1)} จุดเปอร์เซ็นต์`,
      timestamp,
      dateStr,
      isRead: readIds.has(id),
      evidence: {
        metricName: 'Portfolio Overall Allocation',
        currentValue: `${item.actual_pct_of_total.toFixed(1)}%`,
        thresholdValue: `${item.max_pct_of_total.toFixed(1)}%`
      }
    });
  }

  for (const position of summary.positions) {
    if (position.status !== 'ABOVE_MAX' || position.pct_within_portfolio === null || position.max_pct_within_portfolio === null) continue;
    const stablePositionKey = position.holding.id || `${position.portfolio_id || 'unassigned'}_${position.holding.ticker}`;
    const id = `alert_position_${stablePositionKey}_POSITION_LIMIT_${formatLimitKey(position.max_pct_within_portfolio)}`;
    alerts.push({
      id,
      ticker: position.holding.ticker.toUpperCase(),
      type: 'POSITION_PORTFOLIO_LIMIT',
      severity: 'warning',
      title: `${position.holding.ticker.toUpperCase()} is above its limit in ${position.portfolio_name}`,
      titleTh: `${position.holding.ticker.toUpperCase()} เกินสัดส่วนสูงสุดใน ${position.portfolio_name}`,
      message: `${position.holding.ticker.toUpperCase()} is ${position.pct_within_portfolio.toFixed(1)}% of ${position.portfolio_name}. Configured maximum: ${position.max_pct_within_portfolio.toFixed(1)}%. Excess: +${position.excess_pct_points?.toFixed(1)} pp.`,
      messageTh: `${position.holding.ticker.toUpperCase()} มีสัดส่วน ${position.pct_within_portfolio.toFixed(1)}% ใน ${position.portfolio_name} ขีดจำกัด ${position.max_pct_within_portfolio.toFixed(1)}% เกินมา +${position.excess_pct_points?.toFixed(1)} จุดเปอร์เซ็นต์`,
      timestamp,
      dateStr,
      isRead: readIds.has(id),
      evidence: {
        metricName: 'Position Weight Within Portfolio',
        currentValue: `${position.pct_within_portfolio.toFixed(1)}%`,
        thresholdValue: `${position.max_pct_within_portfolio.toFixed(1)}%`
      }
    });
  }

  for (const aggregate of summary.aggregate_tickers) {
    if (aggregate.status !== 'ABOVE_MAX' || aggregate.total_pct_of_total === null || aggregate.overall_max_pct === null) continue;
    const id = `alert_${aggregate.ticker}_OVERALL_EXPOSURE_LIMIT_${formatLimitKey(aggregate.overall_max_pct)}`;
    alerts.push({
      id,
      ticker: aggregate.ticker,
      type: 'OVERALL_TICKER_EXPOSURE_LIMIT',
      severity: 'warning',
      title: `${aggregate.ticker} is above its overall exposure maximum`,
      titleTh: `${aggregate.ticker} เกินสัดส่วนรวมสูงสุดทุกพอร์ต`,
      message: `${aggregate.ticker} represents ${aggregate.total_pct_of_total.toFixed(1)}% across ${aggregate.portfolios.length} portfolio(s). Configured overall maximum: ${aggregate.overall_max_pct.toFixed(1)}%. Excess: +${aggregate.excess_pct_points?.toFixed(1)} pp.`,
      messageTh: `${aggregate.ticker} มีสัดส่วนรวม ${aggregate.total_pct_of_total.toFixed(1)}% ใน ${aggregate.portfolios.length} พอร์ต ขีดจำกัดรวม ${aggregate.overall_max_pct.toFixed(1)}% เกินมา +${aggregate.excess_pct_points?.toFixed(1)} จุดเปอร์เซ็นต์`,
      timestamp,
      dateStr,
      isRead: readIds.has(id),
      evidence: {
        metricName: 'Aggregate Ticker Exposure',
        currentValue: `${aggregate.total_pct_of_total.toFixed(1)}%`,
        thresholdValue: `${aggregate.overall_max_pct.toFixed(1)}%`
      }
    });
  }

  return alerts;
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function emitMonitoringUpdate(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MONITORING_UPDATED_EVENT));
  }
}

export function loadMonitoringPreferences(userId?: string): MonitoringPreferences {
  const storage = getSafeLocalStorage();
  if (!storage) return { ...DEFAULT_MONITORING_PREFERENCES };
  try {
    const key = userId ? `${ALERTS_PREFS_KEY}_${userId}` : ALERTS_PREFS_KEY;
    const raw = storage.getItem(key);
    if (!raw) return { ...DEFAULT_MONITORING_PREFERENCES };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_MONITORING_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_MONITORING_PREFERENCES };
  }
}

export function saveMonitoringPreferences(prefs: MonitoringPreferences, userId?: string, notify = true): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${ALERTS_PREFS_KEY}_${userId}` : ALERTS_PREFS_KEY;
    storage.setItem(key, JSON.stringify(prefs));
    if (notify) emitMonitoringUpdate();
  } catch (e) {
    console.warn('Failed to save monitoring preferences:', e);
  }
}

export function loadReadAlertIds(userId?: string): Set<string> {
  const storage = getSafeLocalStorage();
  if (!storage) return new Set<string>();
  try {
    const key = userId ? `${ALERTS_READ_KEY}_${userId}` : ALERTS_READ_KEY;
    const raw = storage.getItem(key);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function saveReadAlertIds(readIds: Set<string>, userId?: string, notify = true): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${ALERTS_READ_KEY}_${userId}` : ALERTS_READ_KEY;
    storage.setItem(key, JSON.stringify(Array.from(readIds)));
    if (notify) emitMonitoringUpdate();
  } catch (e) {
    console.warn('Failed to save read alerts:', e);
  }
}

export function getLastSeenAccession(ticker: string, userId?: string): string | null {
  const storage = getSafeLocalStorage();
  if (!storage) return null;
  try {
    const key = userId ? `${LAST_SEEN_FILING_KEY}_${userId}` : LAST_SEEN_FILING_KEY;
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed[ticker.toUpperCase().trim()] || null;
  } catch {
    return null;
  }
}

export function loadLastSeenAccessions(userId?: string): Record<string, string> {
  const storage = getSafeLocalStorage();
  if (!storage) return {};
  try {
    const key = userId ? `${LAST_SEEN_FILING_KEY}_${userId}` : LAST_SEEN_FILING_KEY;
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>((result, [ticker, accession]) => {
      const cleanTicker = ticker.toUpperCase().trim();
      if (cleanTicker && typeof accession === 'string' && accession.trim()) result[cleanTicker] = accession.trim();
      return result;
    }, {});
  } catch {
    return {};
  }
}

export function saveLastSeenAccessions(accessions: Record<string, string>, userId?: string, notify = true): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${LAST_SEEN_FILING_KEY}_${userId}` : LAST_SEEN_FILING_KEY;
    storage.setItem(key, JSON.stringify(accessions));
    if (notify) emitMonitoringUpdate();
  } catch (e) {
    console.warn('Failed to save last seen accessions:', e);
  }
}

export function setLastSeenAccession(ticker: string, accession: string, userId?: string): void {
  if (!ticker || !accession) return;
  const current = loadLastSeenAccessions(userId);
  current[ticker.toUpperCase().trim()] = accession;
  saveLastSeenAccessions(current, userId);
}

/**
 * Extracts a normalized, reliable filing identifier (accession number or docType + period) from a DocumentFinding.
 */
export function extractFilingIdentifier(finding: DocumentFinding): string {
  const directAcc = (finding as any).accession_number || (finding as any).accessionNumber;
  if (typeof directAcc === 'string' && directAcc.trim()) {
    return directAcc.trim();
  }

  const url = finding.source_url || finding.sourceUrl || '';
  if (url) {
    const matchHyphen = url.match(/\b\d{10}-\d{2}-\d{6}\b/);
    if (matchHyphen) return matchHyphen[0];
    const matchEdgar = url.match(/data\/\d+\/([0-9a-zA-Z-]+)/);
    if (matchEdgar && matchEdgar[1]) return matchEdgar[1];
  }

  const docType = (finding.document_type || finding.documentType || 'SEC').replace(/[^a-zA-Z0-9]/g, '');
  const period = (finding.quarter_period || finding.date || (finding as any).period || '').replace(/[^a-zA-Z0-9]/g, '');
  return `${docType}_${period || 'UNKNOWN'}`;
}

export function evaluateTickerAlerts(
  ticker: string,
  latestReport?: ReportData,
  currentPrice?: number | null,
  previousReport?: ReportData,
  portfolioSummary?: PortfolioSummary,
  preferences: MonitoringPreferences = DEFAULT_MONITORING_PREFERENCES,
  userId?: string
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const cleanTicker = ticker.toUpperCase().trim();
  const todayDate = new Date().toISOString().split('T')[0];

  if (!cleanTicker) return alerts;

  // 1. Valuation & Margin of Safety Alerts
  if (latestReport) {
    const repDate = extractReportDate(latestReport) || todayDate;
    const price = typeof currentPrice === 'number' && currentPrice > 0
      ? currentPrice
      : extractReportPrice(latestReport);
    const fairValue = extractReportFairValue(latestReport);

    if (price && fairValue && price > 0 && fairValue > 0) {
      const mosPct = Number((((fairValue - price) / price) * 100).toFixed(1));

      // Margin of Safety Threshold Breach
      if (preferences.enableMosAlerts && mosPct >= preferences.mosThresholdPct) {
        const isDeepDiscount = mosPct >= 35;
        const alertId = `alert_${cleanTicker}_VALUATION_MOS_${Math.round(price)}_${Math.round(fairValue)}`;
        alerts.push({
          id: alertId,
          ticker: cleanTicker,
          type: 'VALUATION_MOS_BREACH',
          severity: isDeepDiscount ? 'critical' : 'info',
          title: `${cleanTicker} Deep Value Alert: +${mosPct}% Margin of Safety`,
          titleTh: `สัญญาณ Deep Value: ${cleanTicker} มี Margin of Safety สูงถึง +${mosPct}%`,
          message: `Current market price ($${price.toFixed(2)}) trades significantly below DCF Base Fair Value ($${fairValue.toFixed(2)}).`,
          messageTh: `ราคาตลาดปัจจุบัน ($${price.toFixed(2)}) ต่ำกว่ามูลค่าแท้จริง DCF ($${fairValue.toFixed(2)}) เกินเกณฑ์ปลอดภัยที่ตั้งไว้`,
          timestamp: Date.now(),
          dateStr: repDate,
          isRead: false,
          evidence: {
            metricName: 'Margin of Safety',
            currentValue: `${mosPct}%`,
            thresholdValue: `${preferences.mosThresholdPct}%`,
            filingDate: repDate
          },
          linkSection: 'section-valuation'
        });
      }

      // Overvalued / Premium Alert
      if (preferences.enableOvervaluedAlerts && price > fairValue * 1.15) {
        const premiumPct = Number((((price - fairValue) / fairValue) * 100).toFixed(1));
        const alertId = `alert_${cleanTicker}_VALUATION_OVERVALUED_${Math.round(price)}_${Math.round(fairValue)}`;
        alerts.push({
          id: alertId,
          ticker: cleanTicker,
          type: 'VALUATION_OVERVALUED',
          severity: 'warning',
          title: `${cleanTicker} Valuation Warning: Trading at +${premiumPct}% Premium`,
          titleTh: `แจ้งเตือน Valuation สูง: ${cleanTicker} ซื้อขายสูงกว่ามูลค่าแท้จริง +${premiumPct}%`,
          message: `Current market price ($${price.toFixed(2)}) is well above DCF intrinsic fair value ($${fairValue.toFixed(2)}).`,
          messageTh: `ราคาตลาดปัจจุบัน ($${price.toFixed(2)}) สูงกว่ามูลค่าพื้นฐาน DCF ($${fairValue.toFixed(2)}) ที่ประเมินได้`,
          timestamp: Date.now(),
          dateStr: repDate,
          isRead: false,
          evidence: {
            metricName: 'Price Premium over Fair Value',
            currentValue: `+${premiumPct}%`,
            thresholdValue: '+15%'
          },
          linkSection: 'section-valuation'
        });
      }
    }

    // 2. Conviction Score Shift Alert
    if (preferences.enableConvictionAlerts && previousReport) {
      const curConviction = extractReportConviction(latestReport);
      const prevConviction = extractReportConviction(previousReport);

      if (typeof curConviction === 'number' && typeof prevConviction === 'number') {
        const pointsDiff = curConviction - prevConviction;
        if (Math.abs(pointsDiff) >= preferences.convictionThresholdPoints) {
          const isUpgrade = pointsDiff > 0;
          const alertId = `alert_${cleanTicker}_CONVICTION_${prevConviction}_TO_${curConviction}`;
          alerts.push({
            id: alertId,
            ticker: cleanTicker,
            type: 'CONVICTION_SHIFT',
            severity: isUpgrade ? 'info' : 'warning',
            title: `${cleanTicker} Conviction Score ${isUpgrade ? 'Upgraded' : 'Downgraded'} (${pointsDiff > 0 ? '+' : ''}${pointsDiff} pts)`,
            titleTh: `คะแนนความเชื่อมั่น ${cleanTicker} มีการเปลี่ยนแปลง (${pointsDiff > 0 ? '+' : ''}${pointsDiff} คะแนน)`,
            message: `Conviction moved from ${prevConviction} to ${curConviction} points based on updated financial statements and catalysts.`,
            messageTh: `คะแนนปรับจาก ${prevConviction} เป็น ${curConviction} คะแนน อิงตามข้อมูลผลประกอบการและปัจจัยขับเคลื่อนล่าสุด`,
            timestamp: Date.now(),
            dateStr: repDate,
            isRead: false,
            evidence: {
              metricName: 'Conviction Score Delta',
              currentValue: curConviction,
              previousValue: prevConviction,
              thresholdValue: `${preferences.convictionThresholdPoints} pts`
            },
            linkSection: 'section-summary'
          });
        }
      }
    }

    // 3. SEC Filing Alerts (Accession & period verified; suppresses duplicate static citations)
    if (preferences.enableFilingAlerts && latestReport.findings && latestReport.findings.length > 0) {
      const majorFilingFinding = latestReport.findings.find(f => {
        const doc = (f.document_type || f.documentType || '').toUpperCase();
        return doc.includes('10-K') || doc.includes('10-Q') || doc.includes('8-K');
      });

      if (majorFilingFinding) {
        const docType = majorFilingFinding.document_type || majorFilingFinding.documentType || 'SEC Filing';
        const is8K = docType.toUpperCase().includes('8-K');
        const filingDate = majorFilingFinding.quarter_period || majorFilingFinding.date || (majorFilingFinding as any).period || repDate;
        const filingIdentifier = extractFilingIdentifier(majorFilingFinding);

        // Suppress alert if previousReport or local cache already incorporated this exact filing
        let isAlreadyCitedInPrevious = false;
        if (previousReport?.findings && previousReport.findings.length > 0) {
          isAlreadyCitedInPrevious = previousReport.findings.some(pf => {
            const pId = extractFilingIdentifier(pf);
            return pId === filingIdentifier;
          });
        }

        const lastSeen = getLastSeenAccession(cleanTicker, userId);
        if (lastSeen && lastSeen === filingIdentifier) {
          isAlreadyCitedInPrevious = true;
        }

        if (!isAlreadyCitedInPrevious) {
          setLastSeenAccession(cleanTicker, filingIdentifier, userId);
          const msg = majorFilingFinding.key_insights?.[0] ||
            majorFilingFinding.keyInsights?.[0] ||
            (majorFilingFinding as any).finding ||
            `Verified SEC ${docType} filing incorporated into research model.`;
          const cleanFilingKey = filingIdentifier.replace(/[^a-zA-Z0-9_-]/g, '_');
          const alertId = `alert_${cleanTicker}_SEC_${cleanFilingKey}`;

          alerts.push({
            id: alertId,
            ticker: cleanTicker,
            type: is8K ? 'FILING_MATERIAL_8K' : 'FILING_NEW_10K_10Q',
            severity: is8K ? 'warning' : 'info',
            title: `New SEC Filing: ${cleanTicker} ${docType}`,
            titleTh: `เอกสาร SEC ใหม่: ${cleanTicker} รายงาน ${docType}`,
            message: msg,
            messageTh: msg,
            timestamp: Date.now(),
            dateStr: repDate,
            isRead: false,
            evidence: {
              metricName: 'SEC Filing Citation',
              currentValue: docType,
              filingType: docType,
              filingDate: filingDate,
              sourceUrl: majorFilingFinding.source_url || majorFilingFinding.sourceUrl
            },
            linkSection: 'section-citations'
          });
        }
      }
    }
  }

  // 4. Portfolio Concentration Risk Alert
  if (preferences.enableConcentrationAlerts && portfolioSummary) {
    const holding = portfolioSummary.computed_holdings.find(h => h.ticker.toUpperCase() === cleanTicker);
    if (holding && holding.allocation_pct >= preferences.concentrationThresholdPct) {
      const alertId = `alert_${cleanTicker}_CONCENTRATION_${Math.round(holding.allocation_pct)}`;
      alerts.push({
        id: alertId,
        ticker: cleanTicker,
        type: 'PORTFOLIO_CONCENTRATION',
        severity: 'warning',
        title: `Portfolio Concentration Risk: ${cleanTicker} at ${holding.allocation_pct}%`,
        titleTh: `แจ้งเตือนความเสี่ยงการกระจุกตัว: ${cleanTicker} มีสัดส่วน ${holding.allocation_pct}% ของพอร์ต`,
        message: `Holding weight exceeds your institutional risk threshold (${preferences.concentrationThresholdPct}%).`,
        messageTh: `สัดส่วนการลงทุนเกินเกณฑ์ความปลอดภัยที่กำหนดไว้ (${preferences.concentrationThresholdPct}%) แนะนำพิจารณาปรับสมดุล`,
        timestamp: Date.now(),
        dateStr: todayDate,
        isRead: false,
        evidence: {
          metricName: 'Portfolio Allocation Weight',
          currentValue: `${holding.allocation_pct}%`,
          thresholdValue: `${preferences.concentrationThresholdPct}%`
        }
      });
    }
  }

  return alerts;
}

/**
 * Derives the tracked symbols eligible for Material News/Event checks.
 * Scope:
 * - A: Watchlist tickers
 * - B: All holdings across ALL user-created Portfolios
 * - C: Legacy Unassigned holdings
 * - D: Active research ticker (if selected)
 * Historical report tickers are explicitly EXCLUDED.
 * Deduplicates symbols.
 */
export function deriveTrackedNewsSymbols(
  watchlist: string[] = [],
  portfolioHoldings: Array<{ ticker: string }> = [],
  activeResearchTicker?: string | null
): string[] {
  const allSymbols = [
    ...watchlist,
    ...portfolioHoldings.map(h => h.ticker),
    ...(activeResearchTicker ? [activeResearchTicker] : [])
  ];

  const seen = new Set<string>();
  const deduplicated: string[] = [];

  for (const s of allSymbols) {
    if (typeof s !== 'string') continue;
    const clean = s.toUpperCase().trim();
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      deduplicated.push(clean);
    }
  }

  return deduplicated;
}

/**
 * Extracts deterministic Multi-Portfolio allocation context for a ticker.
 */
export function deriveMultiPortfolioContextForTicker(
  ticker: string,
  multiPortfolioSummary?: MultiPortfolioAllocationSummary
): MaterialEventPortfolioContext {
  const normTicker = ticker.toUpperCase().trim();
  if (!multiPortfolioSummary) {
    return {
      held: false,
      heldPortfolioCount: 0,
      portfolioContexts: [],
      aggregateOverallExposurePct: null,
      overallTickerMaxPct: null,
      pricingCoverage: 'UNAVAILABLE'
    };
  }

  const aggregate = multiPortfolioSummary.aggregate_tickers.find(
    a => a.ticker.toUpperCase().trim() === normTicker
  );

  const matchingPositions = multiPortfolioSummary.positions.filter(
    p => p.holding.ticker.toUpperCase().trim() === normTicker
  );

  if (!aggregate && matchingPositions.length === 0) {
    return {
      held: false,
      heldPortfolioCount: 0,
      portfolioContexts: [],
      aggregateOverallExposurePct: null,
      overallTickerMaxPct: null,
      pricingCoverage: multiPortfolioSummary.is_fully_priced ? 'FULL' : 'PARTIAL'
    };
  }

  const portfolioContexts = matchingPositions.map(p => ({
    portfolioId: p.portfolio_id,
    portfolioName: p.portfolio_name,
    pctWithinPortfolio: p.pct_within_portfolio,
    pctOfTotal: p.pct_of_total
  }));

  const uniquePortfolios = new Set(matchingPositions.map(p => p.portfolio_id || 'unassigned'));

  return {
    held: true,
    heldPortfolioCount: uniquePortfolios.size,
    portfolioContexts,
    aggregateOverallExposurePct: aggregate?.total_pct_of_total ?? null,
    overallTickerMaxPct: aggregate?.overall_max_pct ?? null,
    pricingCoverage: multiPortfolioSummary.is_fully_priced ? 'FULL' : 'PARTIAL'
  };
}

/**
 * Evaluates thesis and expectation relevance for an event without mutating thesis state or claiming invalidation without proof.
 */
export function evaluateEventThesisRelevance(
  event: MaterialCompanyEvent,
  thesis?: {
    keyDrivers?: string[];
    keyRisks?: string[];
    catalysts?: string[];
    summary?: string;
  } | null,
  expectations?: Array<{
    metricOrEvent: string;
    metricLabel: string;
    targetValue: number | string;
    targetPeriod: string;
  }>
): {
  relatedThesisDrivers: string[];
  relatedRisks: string[];
  relatedCatalysts: string[];
  relatedExpectations: string[];
  userRelevance: 'HIGH' | 'MEDIUM' | 'LOW';
} {
  const drivers: string[] = [];
  const risks: string[] = [];
  const catalysts: string[] = [];
  const expectationLinks: string[] = [];

  const headlineLower = event.headline.toLowerCase();

  if (thesis) {
    // Check Catalysts
    for (const c of (thesis.catalysts || [])) {
      const words = c.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => headlineLower.includes(w))) {
        catalysts.push(c);
      }
    }

    // Check Risks
    for (const r of (thesis.keyRisks || [])) {
      const words = r.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => headlineLower.includes(w))) {
        risks.push(r);
      }
    }

    // Check Drivers
    for (const d of (thesis.keyDrivers || [])) {
      const words = d.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      if (words.some(w => headlineLower.includes(w))) {
        drivers.push(d);
      }
    }
  }

  if (expectations && expectations.length > 0) {
    if (event.category === 'EARNINGS' || event.category === 'GUIDANCE') {
      for (const exp of expectations) {
        const metricLower = exp.metricOrEvent.toLowerCase();
        if (metricLower.includes('revenue') && (headlineLower.includes('revenue') || headlineLower.includes('sales'))) {
          expectationLinks.push(`${exp.metricLabel} (${exp.targetPeriod}): Target ${exp.targetValue}`);
        } else if (metricLower.includes('margin') && headlineLower.includes('margin')) {
          expectationLinks.push(`${exp.metricLabel} (${exp.targetPeriod}): Target ${exp.targetValue}`);
        } else if (metricLower.includes('cash') && headlineLower.includes('fcf')) {
          expectationLinks.push(`${exp.metricLabel} (${exp.targetPeriod}): Target ${exp.targetValue}`);
        }
      }
    }
  }

  let userRelevance: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (catalysts.length > 0 || risks.length > 0 || expectationLinks.length > 0) {
    userRelevance = 'HIGH';
  } else if (drivers.length > 0) {
    userRelevance = 'MEDIUM';
  }

  return {
    relatedThesisDrivers: drivers.slice(0, 2),
    relatedRisks: risks.slice(0, 2),
    relatedCatalysts: catalysts.slice(0, 2),
    relatedExpectations: expectationLinks.slice(0, 2),
    userRelevance
  };
}

/**
 * Converts MaterialCompanyEvents to MonitoringAlerts with deterministic portfolio context and thesis connections.
 */
export function convertMaterialEventsToAlerts(
  events: MaterialCompanyEvent[],
  multiPortfolioSummary?: MultiPortfolioAllocationSummary,
  thesesByTicker: Record<string, any> = {},
  expectationsByTicker: Record<string, any[]> = {},
  readIds: Set<string> = new Set(),
  existingAlerts: MonitoringAlert[] = []
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  // Build a set of existing SEC filing accessions and dates to suppress exact duplicates
  const existingSecFilings = new Set<string>();
  for (const a of existingAlerts) {
    if (a.type === 'FILING_MATERIAL_8K' || a.type === 'FILING_NEW_10K_10Q') {
      const filingKey = a.evidence?.filingDate || a.dateStr;
      if (filingKey) existingSecFilings.add(`${a.ticker}_${filingKey}`);
      if (a.evidence?.sourceUrl) existingSecFilings.add(a.evidence.sourceUrl);
    }
  }

  for (const event of events) {
    const cleanTicker = event.ticker.toUpperCase().trim();

    // SEC Duplicate Suppression: if this event is an SEC filing that matches an existing filing alert exactly
    if (event.sourceType === 'SEC_EDGAR') {
      const dateKey = event.publishedAt ? event.publishedAt.split('T')[0] : '';
      if (dateKey && existingSecFilings.has(`${cleanTicker}_${dateKey}`)) {
        continue; // Suppress duplicate filing alert
      }
      if (event.sourceUrl && existingSecFilings.has(event.sourceUrl)) {
        continue;
      }
    }

    // Portfolio Context
    const portfolioContext = deriveMultiPortfolioContextForTicker(cleanTicker, multiPortfolioSummary);

    // Thesis Relevance
    const userThesis = thesesByTicker[cleanTicker] || null;
    const expectations = expectationsByTicker[cleanTicker] || [];
    const thesisRel = evaluateEventThesisRelevance(event, userThesis, expectations);

    // Combine user relevance: elevated to HIGH if heavily held
    let finalUserRelevance = thesisRel.userRelevance;
    if (portfolioContext.held && portfolioContext.aggregateOverallExposurePct !== null && portfolioContext.aggregateOverallExposurePct >= 10) {
      finalUserRelevance = 'HIGH';
    } else if (portfolioContext.held && finalUserRelevance === 'LOW') {
      finalUserRelevance = 'MEDIUM';
    }

    // Materiality threshold rule:
    // HIGH -> Alert
    // MEDIUM -> Alert only if held or active thesis or relevance >= MEDIUM
    // LOW -> Suppress
    if (event.materiality === 'LOW') continue;
    if (event.materiality === 'MEDIUM' && !portfolioContext.held && !userThesis && finalUserRelevance === 'LOW') {
      continue;
    }

    const stableAlertId = `alert_${cleanTicker}_NEWS_${event.eventId}`;
    const isRead = readIds.has(stableAlertId);

    const alertDate = event.publishedAt ? event.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0];
    const timestamp = event.publishedAt ? new Date(event.publishedAt).getTime() : Date.now();

    const severity = event.materiality === 'HIGH'
      ? (finalUserRelevance === 'HIGH' ? 'critical' : 'warning')
      : 'info';

    alerts.push({
      id: stableAlertId,
      ticker: cleanTicker,
      type: 'NEWS_MATERIAL_EVENT',
      severity,
      title: event.headline,
      titleTh: event.headline,
      message: event.factualSummary,
      messageTh: event.factualSummary,
      timestamp,
      dateStr: alertDate,
      isRead,
      evidence: {
        metricName: 'Corporate Event Source',
        currentValue: event.sourceName,
        filingType: event.category,
        filingDate: event.publishedAt || undefined,
        sourceUrl: event.sourceUrl
      },
      linkSection: 'section-summary',
      newsEvent: event,
      eventCategory: event.category,
      eventMateriality: event.materiality,
      userRelevance: finalUserRelevance,
      portfolioContext,
      whyItMatters: event.whyItMatters,
      whyItMattersTh: event.whyItMattersTh,
      relatedThesisDrivers: thesisRel.relatedThesisDrivers,
      relatedRisks: thesisRel.relatedRisks,
      relatedCatalysts: thesisRel.relatedCatalysts,
      relatedExpectations: thesisRel.relatedExpectations,
      supportingSources: event.supportingSources,
      sourceAuthority: event.sourceAuthority,
      sourceType: event.sourceType
    });
  }

  return alerts;
}

export function evaluateAllAlerts(
  monitoredTickers: string[],
  latestReports: Record<string, ReportData> = {},
  quotes: Record<string, number | { price?: number } | undefined> = {},
  historicalReports: any[] = [],
  portfolioSummary?: PortfolioSummary,
  preferences: MonitoringPreferences = DEFAULT_MONITORING_PREFERENCES,
  readIds: Set<string> = new Set(),
  multiPortfolioSummary?: MultiPortfolioAllocationSummary,
  userId?: string,
  newsEvents: MaterialCompanyEvent[] = [],
  thesesByTicker: Record<string, any> = {},
  expectationsByTicker: Record<string, any[]> = {}
): MonitoringAlert[] {
  const alertMap = new Map<string, MonitoringAlert>();

  const cleanTickers = Array.from(new Set(monitoredTickers.map(t => t.toUpperCase().trim()).filter(Boolean)));

  for (const ticker of cleanTickers) {
    const report = latestReports[ticker];
    const rawQuote = quotes[ticker];
    const price = typeof rawQuote === 'number'
      ? rawQuote
      : (typeof rawQuote === 'object' && rawQuote !== null && typeof rawQuote.price === 'number')
        ? rawQuote.price
        : null;

    // Use canonical getPreviousReport from researchTimeline
    const prevReport = getPreviousReport(ticker, historicalReports, report) || undefined;

    const tickerAlerts = evaluateTickerAlerts(
      ticker,
      report,
      price,
      prevReport,
      portfolioSummary,
      preferences,
      userId
    );

    for (const alert of tickerAlerts) {
      if (!alertMap.has(alert.id)) {
        alertMap.set(alert.id, {
          ...alert,
          isRead: readIds.has(alert.id)
        });
      }
    }
  }

  if (multiPortfolioSummary) {
    for (const alert of evaluateMultiPortfolioAlerts(multiPortfolioSummary, readIds)) {
      if (!alertMap.has(alert.id)) alertMap.set(alert.id, alert);
    }
  }

  // Convert and merge Material News Events (if enabled)
  if (preferences.enableNewsAlerts !== false && newsEvents && newsEvents.length > 0) {
    const existingAlerts = Array.from(alertMap.values());
    const newsAlerts = convertMaterialEventsToAlerts(
      newsEvents,
      multiPortfolioSummary,
      thesesByTicker,
      expectationsByTicker,
      readIds,
      existingAlerts
    );

    for (const alert of newsAlerts) {
      if (!alertMap.has(alert.id)) {
        alertMap.set(alert.id, {
          ...alert,
          isRead: readIds.has(alert.id)
        });
      }
    }
  }

  // Sort: unread first, then critical > warning > info, then newest timestamp
  const severityRank: Record<string, number> = { critical: 3, warning: 2, info: 1 };

  return Array.from(alertMap.values()).sort((a, b) => {
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    const sevDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
    if (sevDiff !== 0) return sevDiff;
    return b.timestamp - a.timestamp;
  });
}
