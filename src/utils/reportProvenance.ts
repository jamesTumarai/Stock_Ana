import type { MarketSnapshot } from '../domain/marketSnapshot';
import type { ReportProvenanceManifest, ReportRuntimeValidationStatus } from '../domain/reportProvenance';
import type { ReportData } from '../types';

type ReportWithMarketSnapshot = ReportData & {
  market_snapshot?: MarketSnapshot;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const runtimeValidationStatus = (report: ReportData): ReportRuntimeValidationStatus =>
  report.validation?.status ?? 'unknown';

const sourcePeriodFromStatements = (report: ReportData): string | undefined => {
  const periods = report.financial_statements?.periods;
  if (!Array.isArray(periods) || periods.length === 0) return undefined;
  return periods.length === 1 ? periods[0] : `${periods[0]}–${periods[periods.length - 1]}`;
};

/**
 * Build a report-level source manifest without upgrading any section's verification status.
 * SEC Verified is granted only to the exact DCF financial input set when both the deterministic
 * DCF engine and the runtime-validated SEC envelope independently agree that the set is eligible.
 */
export function buildReportProvenanceManifest(
  report: ReportData,
  metadata: {
    generatedAt: string;
    schemaVersion: number;
    generatedByVersion: string;
  },
): ReportProvenanceManifest {
  const validationStatus = runtimeValidationStatus(report);
  const dcfInputs = report.intrinsic_value?.dcf_model?.inputs;
  const sec = report.sec_verification;
  const secFinancials = sec?.dcf_financial_inputs;
  const secEligible = sec?.status === 'verified_eligible'
    && secFinancials?.eligible === true
    && secFinancials.ticker === report.ticker;
  const claimsSecDcf = dcfInputs?.financialDataSource === 'sec_verified';
  const claimsReportDcf = dcfInputs?.financialDataSource === 'report_statements';

  let dcfSource: ReportProvenanceManifest['dcf_financial_inputs'];
  if (claimsSecDcf && secEligible) {
    dcfSource = {
      source: 'sec_verified',
      source_verification: 'independently_verified',
      runtime_validation_status: validationStatus,
      used_in_output: dcfInputs?.isValid === true,
      source_period: dcfInputs.sourcePeriod || secFinancials?.source_period || undefined,
      as_of: dcfInputs.financialDataAsOf || secFinancials?.latest_balance_sheet_period_end || undefined,
      shares_as_of: dcfInputs.sharesAsOf || secFinancials?.share_as_of || undefined,
      note: 'Only the deterministic DCF financial input set is labeled SEC verified; this does not certify the report narrative or statement snapshot.',
    };
  } else if (claimsReportDcf) {
    dcfSource = {
      source: 'report_snapshot',
      source_verification: 'not_independently_verified',
      runtime_validation_status: validationStatus,
      used_in_output: dcfInputs?.isValid === true,
      source_period: dcfInputs.sourcePeriod,
      as_of: dcfInputs.financialDataAsOf,
      shares_as_of: dcfInputs.sharesAsOf,
      note: 'DCF financial inputs come from the validated report snapshot and are not labeled SEC verified.',
    };
  } else {
    dcfSource = {
      source: 'unavailable',
      source_verification: 'unavailable',
      runtime_validation_status: validationStatus,
      used_in_output: false,
      note: claimsSecDcf
        ? 'The report claimed SEC DCF inputs but the SEC eligibility envelope did not validate, so provenance fails closed.'
        : 'No usable deterministic DCF financial input source is available.',
    };
  }

  const reportWithMarket = report as ReportWithMarketSnapshot;
  const marketSnapshot = reportWithMarket.market_snapshot;
  const snapshotPrice = report.intrinsic_value?.current_price ?? report.company_profile?.stock_price;
  const hasMarketSnapshot = Boolean(marketSnapshot && finite(marketSnapshot.price) && marketSnapshot.price > 0);
  const hasReportPrice = finite(snapshotPrice) && snapshotPrice > 0;

  const latestSource = sec?.latest_statements_source;
  const secStatus = sec?.status ?? 'not_run';

  return {
    version: 1,
    generated_by: 'lumina-report-provenance-v1',
    generated_at: metadata.generatedAt,
    report_schema_version: metadata.schemaVersion,
    report_generated_by_version: metadata.generatedByVersion,
    research_narrative: {
      source: 'ai_research',
      source_verification: 'not_independently_verified',
      runtime_validation_status: validationStatus,
      used_in_output: Boolean(report.summary || report.verdict || report.comprehensive_analysis || report.technical_analysis),
      note: 'Narrative research and interpretation are AI-generated synthesis; citations may support claims, but the narrative itself is not SEC certified.',
    },
    financial_statements: {
      source: report.financial_statements ? 'report_snapshot' : 'unavailable',
      source_verification: report.financial_statements ? 'not_independently_verified' : 'unavailable',
      runtime_validation_status: validationStatus,
      used_in_output: Boolean(report.financial_statements),
      source_period: sourcePeriodFromStatements(report),
      as_of: report.financial_statements?.source?.period_end || report.financial_statements?.as_of_date,
      note: report.financial_statements
        ? 'Displayed statement arrays are the report snapshot. Runtime consistency checks do not convert them into SEC-authoritative data.'
        : 'Financial statement snapshot is unavailable.',
    },
    dcf_financial_inputs: dcfSource,
    market_price: hasMarketSnapshot
      ? {
          source: 'market_snapshot',
          source_verification: 'provider_snapshot',
          runtime_validation_status: validationStatus,
          used_in_output: true,
          as_of: marketSnapshot?.asOf,
          provider: marketSnapshot?.provider,
          retrieved_at: marketSnapshot?.retrievedAt,
          note: 'Displayed market price comes from a provider snapshot and is not represented as guaranteed real-time data.',
        }
      : hasReportPrice
      ? {
          source: 'report_snapshot',
          source_verification: 'not_independently_verified',
          runtime_validation_status: validationStatus,
          used_in_output: true,
          as_of: report.as_of_date,
          note: 'Market price is the report snapshot price; refresh metadata is unavailable in the persisted report.',
        }
      : {
          source: 'unavailable',
          source_verification: 'unavailable',
          runtime_validation_status: validationStatus,
          used_in_output: false,
          note: 'No market price source is available.',
        },
    sec_cross_check: {
      status: secStatus,
      filing_url: latestSource?.document_url,
      filing_type: latestSource?.document_type,
      filing_date: latestSource?.filing_date,
      period_end: latestSource?.period_end,
      note: secStatus === 'verified_eligible'
        ? 'SEC verification is eligible for the guarded DCF input set only; it does not mark the full report as SEC verified.'
        : secStatus === 'verified_partial'
        ? 'SEC data was retrieved but did not satisfy every guarded DCF requirement.'
        : secStatus === 'unavailable'
        ? 'SEC verification was attempted but authoritative inputs were unavailable or incomplete.'
        : 'SEC verification was not run for this report path.',
    },
  };
}
