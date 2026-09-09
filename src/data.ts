import { AnalysisReport, RawAnalysisReport } from './types';

export function transformReport(raw: RawAnalysisReport): AnalysisReport {
  return {
    generated_at: raw.generated_at || new Date().toISOString(),
    ticker: raw.ticker || 'UNKNOWN',
    summary: raw.summary || raw.verdict?.summary || '',
    as_of_date: raw.as_of_date || new Date().toISOString().split('T')[0],
    analysis_type: raw.analysis_type || 'combined',
    verdict: raw.verdict,
    comprehensive_analysis: raw.comprehensive_analysis,
    technical_analysis: raw.technical_analysis,
    financial_statements: raw.financial_statements,
    valuation_ratios: raw.valuation_ratios,
    valuation_percentile_chart: raw.valuation_percentile_chart,
    valuation_dashboard: raw.valuation_dashboard,
    intrinsic_value: raw.intrinsic_value,
    earnings_analysis: raw.earnings_analysis,
    forecast_dashboard: raw.forecast_dashboard,
    peer_comparison: raw.peer_comparison,
    catalysts_and_events: raw.catalysts_and_events,
    insider_activity: raw.insider_activity,
    smart_money: raw.smart_money,
    corporate_actions: raw.corporate_actions,
    company_profile: raw.company_profile,
    business_analysis: raw.business_analysis,
    five_pillars: raw.five_pillars,
    deep_insights: raw.deep_insights,
    findings: raw.findings,
    financial_charts: raw.financial_charts,
    final_report: raw.final_report,
    chartImage: raw.chartImage,
  };
}
