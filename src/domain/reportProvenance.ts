export type ReportSourceKind =
  | 'ai_research'
  | 'report_snapshot'
  | 'sec_verified'
  | 'market_snapshot'
  | 'unavailable';

export type ReportSourceVerification =
  | 'independently_verified'
  | 'provider_snapshot'
  | 'not_independently_verified'
  | 'unavailable';

export type ReportRuntimeValidationStatus = 'valid' | 'warning' | 'invalid' | 'unknown';

export interface ReportProvenanceSection {
  source: ReportSourceKind;
  source_verification: ReportSourceVerification;
  runtime_validation_status?: ReportRuntimeValidationStatus;
  used_in_output: boolean;
  source_period?: string;
  as_of?: string;
  shares_as_of?: string;
  provider?: string;
  retrieved_at?: string;
  note: string;
}

export interface ReportSecCrossCheck {
  status: 'verified_eligible' | 'verified_partial' | 'unavailable' | 'not_run';
  filing_url?: string;
  filing_type?: string;
  filing_date?: string;
  period_end?: string;
  note: string;
}

export interface ReportProvenanceManifest {
  version: 1;
  generated_by: 'lumina-report-provenance-v1';
  generated_at: string;
  report_schema_version: number;
  report_generated_by_version: string;
  research_narrative: ReportProvenanceSection;
  financial_statements: ReportProvenanceSection;
  dcf_financial_inputs: ReportProvenanceSection;
  market_price: ReportProvenanceSection;
  sec_cross_check: ReportSecCrossCheck;
}
