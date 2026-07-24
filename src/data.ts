import { AnalysisReport, RawAnalysisReport } from './types';

export function transformReport(raw: RawAnalysisReport): AnalysisReport {
  return {
    generated_at: raw.generated_at || new Date().toISOString(),
    ticker: raw.ticker || 'UNKNOWN',
    summary: raw.summary || '',
    quant_data: raw.quant_data,
    fundamental_data: raw.fundamental_data,
    insider_data: raw.insider_data,
    downside_thesis: raw.downside_thesis,
    final_report: raw.final_report,
    chartImage: raw.chartImage,
  };
}

