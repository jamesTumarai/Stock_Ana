import type { ReportData } from '../types';
import { normalizeReport } from './reportIntegrity';

// Preserve the public API; report rendering must never invent financial data.
export const harmonizeReportData = (data?: ReportData, ticker?: string, liveOverrides?: Record<string, any>): ReportData => normalizeReport(data, ticker, liveOverrides);
export const harmonizeReportMetrics = (data?: ReportData, ticker?: string) => data ? normalizeReport(data, ticker) : undefined;
export const harmonizeReportMetricsInternal = (data?: ReportData, ticker?: string, liveOverrides?: Record<string, any>) => data ? normalizeReport(data, ticker, liveOverrides) : undefined;

export function extractCleanRsi(text?: string): { value: number; statusTh: string; statusEn: string } | null {
  if (!text) return null;

  // 1. Remove period patterns: "14 days", "(14)", "14-day", "14 วัน", "period 14", "14-period"
  const clean = text
    .replace(/RSI\s*\(\s*14\s*(?:days?|วัน|d)?\s*\)/gi, 'RSI')
    .replace(/RSI\s*(?:period\s*)?14\s*(?:days?|วัน|d|-day)?/gi, 'RSI')
    .replace(/\b14\s*(?:days?|วัน|d|-day)\b/gi, '')
    .replace(/\b(?:period|ช่วงเวลา|คาบ)\s*14\b/gi, '');

  // 2. Look for explicit value match after RSI keywords
  let match = clean.match(/RSI\s*(?:is|at|=|:|อยู่ที่|คือ|เท่ากับ|ระดับ|มีค่า)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) {
    match = clean.match(/\b([0-9]{1,2}(?:\.[0-9]+)?)\b/);
  }

  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const isOverbought = val >= 70;
      const isOversold = val <= 30;
      const statusTh = isOverbought ? 'ซื้อมากเกินไป (Overbought)' : isOversold ? 'ขายมากเกินไป (Oversold)' : 'โซนปกติ (Neutral)';
      const statusEn = isOverbought ? 'Overbought' : isOversold ? 'Oversold' : 'Neutral';
      return { value: Math.round(val * 10) / 10, statusTh, statusEn };
    }
  }

  return null;
}

