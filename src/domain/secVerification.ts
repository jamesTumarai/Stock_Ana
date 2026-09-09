export interface SecVerificationIssue {
  code: string;
  field: string;
  message: string;
}

export interface SecDcfFinancialInputsEnvelope {
  version: number;
  generated_by: 'sec-verified-financial-inputs-v1';
  eligible: boolean;
  ticker: string;
  periods: string[];
  source_period: string | null;
  latest_balance_sheet_period_end: string | null;
  share_as_of: string | null;
  starting_revenue_m: number | null;
  trailing_four_free_cash_flow_m: number | null;
  historical_fcf_margin_pct: number | null;
  cash_and_equivalents_m: number | null;
  short_term_investments_m: number | null;
  total_debt_m: number | null;
  net_cash_m: number | null;
  current_shares_outstanding_m: number | null;
  issues: SecVerificationIssue[];
}

export interface SecDcfCoverageEnvelope {
  eligible: boolean;
  periods: string[];
  current_shares_outstanding_m: number | null;
  issues: SecVerificationIssue[];
}

export interface SecVerificationEnvelope {
  status: 'verified_eligible' | 'verified_partial' | 'unavailable';
  ticker: string;
  retrieved_at: string | null;
  provenance_status: string | null;
  provenance_warnings: Array<{ code: string; severity: string; message: string }>;
  dcf_coverage: SecDcfCoverageEnvelope | null;
  dcf_financial_inputs: SecDcfFinancialInputsEnvelope | null;
  latest_statements_source: {
    document_url?: string;
    document_type?: string;
    filing_date?: string;
    period_end?: string;
    units?: string;
  } | null;
  error?: {
    code: string;
    message: string;
  };
}

export type ReportWithSecVerification = {
  sec_verification?: SecVerificationEnvelope;
};
