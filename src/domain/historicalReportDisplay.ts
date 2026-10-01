import type { ReportData } from '../types';
import { buildCanonicalExecutiveSnapshot } from './canonicalExecutiveSnapshot';
import { buildResearchIntegrity } from './reportResearchIntegrity';

/** History is an immutable research snapshot, not an input to today's model.
 * Rebuild only omitted display metadata. Never rerun valuation, change prose,
 * refresh a quote, or recompute a historical conviction/thesis on read. */
export function prepareHistoricalReportDisplay(saved: ReportData): ReportData {
  const display = structuredClone(saved);
  display.canonical_executive_snapshot ??= buildCanonicalExecutiveSnapshot(display, display.ticker);
  display.research_integrity ??= buildResearchIntegrity(display);
  if (!display.intrinsic_value?.canonical_run) {
    display.validation = { ...display.validation,
      status: display.validation?.status === 'invalid' ? 'invalid' : 'warning',
      checked_at: display.validation?.checked_at ?? display.generated_at ?? '',
      schema_version: display.validation?.schema_version ?? display.schema_version ?? 0,
      issues: [...(display.validation?.issues ?? []).filter(i=>i.code!=='LEGACY_VALUATION_UNVERIFIED'),
        { code:'LEGACY_VALUATION_UNVERIFIED', severity:'warning', section:'history',
          message:'Historical valuation retained as originally saved; canonical model provenance is unavailable. Re-analysis creates a new version.' }],
    };
  }
  return display;
}
