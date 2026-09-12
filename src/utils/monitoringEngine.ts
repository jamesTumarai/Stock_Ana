import {
  MonitoringAlert,
  MonitoringPreferences,
  PortfolioSummary,
  ReportData,
  DocumentFinding
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
  concentrationThresholdPct: 30
};

export const ALERTS_PREFS_KEY = 'lumina_monitoring_prefs';
export const ALERTS_READ_KEY = 'lumina_read_alert_ids';
export const LAST_SEEN_FILING_KEY = 'lumina_last_seen_filing';

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

export function saveMonitoringPreferences(prefs: MonitoringPreferences, userId?: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${ALERTS_PREFS_KEY}_${userId}` : ALERTS_PREFS_KEY;
    storage.setItem(key, JSON.stringify(prefs));
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

export function saveReadAlertIds(readIds: Set<string>, userId?: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${ALERTS_READ_KEY}_${userId}` : ALERTS_READ_KEY;
    storage.setItem(key, JSON.stringify(Array.from(readIds)));
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

export function setLastSeenAccession(ticker: string, accession: string, userId?: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;
  try {
    const key = userId ? `${LAST_SEEN_FILING_KEY}_${userId}` : LAST_SEEN_FILING_KEY;
    const raw = storage.getItem(key);
    const map = raw ? JSON.parse(raw) : {};
    map[ticker.toUpperCase().trim()] = accession;
    storage.setItem(key, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save last seen accession:', e);
  }
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
  preferences: MonitoringPreferences = DEFAULT_MONITORING_PREFERENCES
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

        // Suppress alert if previousReport already incorporated this exact filing
        let isAlreadyCitedInPrevious = false;
        if (previousReport?.findings && previousReport.findings.length > 0) {
          isAlreadyCitedInPrevious = previousReport.findings.some(pf => {
            const pId = extractFilingIdentifier(pf);
            return pId === filingIdentifier;
          });
        }

        if (!isAlreadyCitedInPrevious) {
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

export function evaluateAllAlerts(
  monitoredTickers: string[],
  latestReports: Record<string, ReportData> = {},
  quotes: Record<string, number | { price?: number } | undefined> = {},
  historicalReports: any[] = [],
  portfolioSummary?: PortfolioSummary,
  preferences: MonitoringPreferences = DEFAULT_MONITORING_PREFERENCES,
  readIds: Set<string> = new Set()
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
      preferences
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
