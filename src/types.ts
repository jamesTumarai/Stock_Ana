export interface AnalysisReport {
  generated_at: string;
  ticker: string;
  summary: string;
  quant_data?: any;
  fundamental_data?: any;
  insider_data?: any;
  downside_thesis?: any;
  financial_charts?: {
    stock_price_4m: { date: string; price: number }[];
    financial_performance_4q: { quarter: string; revenue?: number; net_income?: number; shares_outstanding?: number }[];
  };
  final_report?: string;
  chartImage?: string;
}

export interface RawAnalysisReport {
  generated_at?: string;
  ticker?: string;
  summary?: string;
  quant_data?: any;
  fundamental_data?: any;
  insider_data?: any;
  downside_thesis?: any;
  financial_charts?: {
    stock_price_4m: { date: string; price: number }[];
    financial_performance_4q: { quarter: string; revenue?: number; net_income?: number; shares_outstanding?: number }[];
  };
  final_report?: string;
  chartImage?: string;
}
