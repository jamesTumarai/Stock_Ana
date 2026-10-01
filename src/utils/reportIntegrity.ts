import { detectStatementTemplate, validateFinancialStatements } from './statementValidator';
import { calculateVerifiedKeyIndicators } from '../domain/verifiedKeyIndicators';
import { adaptSecCanonicalToFinancialStatements } from '../services/sec/secLegacyAdapter';
import { reconcileVerifiedDataset } from '../domain/verifiedFinancialStatements';
import type { ReportData, ValuationRatioItem } from '../types';
import { buildMarketSnapshot, type MarketSnapshot } from '../domain/marketSnapshot';
import { buildCanonicalFinancialDataset, type CanonicalFinancialDataset } from '../domain/financialValue';
import { buildDataGapInventory } from '../domain/dataCompleteness/gapInventory';
import { buildRigorousDCFModel } from './valuation/dcfMathEngine';
import { calculateDeterministicConvictionScore } from './valuation/convictionScorer';
import { reconcileReportMultiples, isDcfOnlyCriticalIssue } from '../domain/valuation/valuationDependencies';
import { resolveAdaptiveFivePillars } from '../domain/valuation/fivePillarsResolver';
import { resolveFundamentalMetrics } from '../domain/valuation/metricRegistry';
import { discoverPeers } from '../domain/valuation/peerDiscoveryEngine';
import {
  buildCanonicalExecutiveSnapshot,
  reconcileExecutiveSummary,
  reconcileKeyTakeaways,
  reconcileCurrentValuationProse
} from '../domain/canonicalExecutiveSnapshot';
import { detectValuationModel } from './valuation/modelSelector';
import { resolveAdaptiveValuationRun } from '../domain/valuation/adaptiveValuationPolicy';
import { resolveReportCompletion } from '../domain/reportCompletion';
import { buildResearchIntegrity } from '../domain/reportResearchIntegrity';
import { auditTechnicalSnapshot } from '../domain/technicalSnapshotIntegrity';
import { resolveReportTtmFlow, TTM_FLOW_METRICS, type TtmFlowMetric, type TtmFlowReconciliation, type TtmProviderObservation } from '../domain/canonicalTtmFlow';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;

type ReportWithCanonicalData = ReportData & {
  market_snapshot?: MarketSnapshot;
  canonical_financials?: CanonicalFinancialDataset;
  ttm_flow_reconciliation?: Partial<Record<TtmFlowMetric, TtmFlowReconciliation>>;
};

const reportedTtmObservation = (report: ReportData, metric: TtmFlowMetric): TtmProviderObservation | null => {
  const metricName = metric.split('.')[1];
  const indicators = report.key_indicators as Record<string, any> | undefined;
  for (const group of [indicators, indicators?.growth, indicators?.profitability, indicators?.financial_health]) {
    for (const key of [`${metricName}_ttm`, `ttm_${metricName}`]) {
      const candidate = group?.[key];
      const value = typeof candidate === 'object' && candidate !== null ? candidate.value : candidate;
      if (finite(value)) return { value, source: candidate?.source || `Key Indicators (${key})` };
    }
  }
  return null;
};

/** Match fiscal labels, not adjacent array positions; incomplete history stays unavailable. */
export function periodChanges(values: (number | null | undefined)[], periods: string[], mode: string, reported?: (number | null)[]): (number | null)[] {
  return values.map((value, i) => {
    if (mode === 'hide' || !finite(value)) return null;
    const label = periods[i] || '';
    const year = label.match(/\b(20\d{2})\b/);
    const quarter = label.match(/Q([1-4])/i);
    let previous = -1;
    if (year && quarter) {
      const y = Number(year[1]); const q = Number(quarter[1]);
      const py = mode === 'yoy' ? y - 1 : q === 1 ? y - 1 : y;
      const pq = mode === 'yoy' ? q : q === 1 ? 4 : q - 1;
      previous = periods.findIndex(p => p.match(/\b(20\d{2})\b/)?.[1] === String(py) && p.match(/Q([1-4])/i)?.[1] === String(pq));
    }
    const baseline = values[previous];
    if (finite(baseline) && baseline !== 0) return rounded((value - baseline) / Math.abs(baseline) * 100);
    return mode === 'yoy' && finite(reported?.[i]) ? reported![i]! : null;
  });
}

/** No ticker-specific overrides, fabricated history, forced balancing or synthetic forecasts. */
export function normalizeReport(input?: ReportData, ticker?: string, live?: Record<string, any>): ReportData {
  if (!input) return {} as ReportData;
  const result = structuredClone(input) as ReportWithCanonicalData;
  // Accounting authority is an independently ingested period package. Model arrays
  // and historical caches without accepted observations are never final numeric inputs.
  const canonicalFinancials = reconcileVerifiedDataset(result.canonical_financials);
  const statements = canonicalFinancials ? adaptSecCanonicalToFinancialStatements(canonicalFinancials) : null;
  if (canonicalFinancials && statements) {
    result.canonical_financials = canonicalFinancials;
    const profileTemplate = detectStatementTemplate(result, ticker);
    statements.statement_template = profileTemplate === 'standard' ? statements.statement_template : profileTemplate;
    statements.validation_summary = validateFinancialStatements(statements, statements.statement_template);
    statements.indicator_details = calculateVerifiedKeyIndicators(statements);
    result.financial_statements = statements;
  } else {
    delete result.canonical_financials;
    if (result.financial_statements) result.financial_statements = {
      periods: [], income_statement: { revenue: [], net_income: [] }, balance_sheet: {}, cash_flow: {},
      quality_status: 'unavailable', red_flags: ['Verified financial statement source package unavailable; model values suppressed.'],
    };
    if (result.sec_verification) result.sec_verification = {
      ...result.sec_verification, status: 'unavailable',
      dcf_financial_inputs: result.sec_verification.dcf_financial_inputs ? {
        ...result.sec_verification.dcf_financial_inputs, eligible: false,
      } : undefined,
    };
  }
  // Key Indicators are derived below from accepted observations; raw model ratios are not authority.
  const providerTtmObservations = Object.fromEntries(TTM_FLOW_METRICS.map(metric => [metric, reportedTtmObservation(result, metric)]));
  delete result.key_indicators;
  result.ttm_flow_reconciliation = Object.fromEntries(TTM_FLOW_METRICS.map(metric => [
    metric, resolveReportTtmFlow(result, metric, providerTtmObservations[metric]),
  ])) as Partial<Record<TtmFlowMetric, TtmFlowReconciliation>>;

  const completedFacts = result.data_completeness?.verifiedFacts;
  const gapInventory = buildDataGapInventory(result);
  result.data_completeness = {
    ...gapInventory.summary,
    verifiedFacts: completedFacts?.length ? completedFacts : gapInventory.summary.verifiedFacts,
  };

  // Integrate live Treasury quote if available from market provider
  const treasuryQuote = live?.['^TNX'] || live?.['TNX'];
  if (treasuryQuote && typeof treasuryQuote.price === 'number' && Number.isFinite(treasuryQuote.price) && treasuryQuote.price > 0) {
    if (!result.five_pillars) {
      result.five_pillars = {} as any;
    }
    if (!result.five_pillars.yields) {
      result.five_pillars.yields = {} as any;
    }
    result.five_pillars.yields.treasury_10yr_yield_pct = treasuryQuote.price;
    result.five_pillars.yields.treasury_as_of_date = treasuryQuote.asOf || new Date().toISOString().split('T')[0];
    result.five_pillars.yields.treasury_source = treasuryQuote.provider || 'CBOE 10-Year Treasury Note Yield (^TNX) via Yahoo Finance';
    result.five_pillars.yields.treasury_fetch_status = 'available';
  }

  // Recover the peer universe before resolving Five Pillars. Previously this ran
  // afterwards, leaving Pillar 5 permanently empty even when fallback discovery
  // successfully populated peer_comparison later in this function.
  if (result.financial_statements || result.peer_comparison) {
    if (!result.peer_comparison || !result.peer_comparison.peers || result.peer_comparison.peers.length === 0) {
      const peerDiscovery = discoverPeers(result, ticker || result.ticker);
      if (peerDiscovery.peerCompanyItems.length > 0) {
        result.peer_comparison = {
          as_of_date: result.as_of_date || new Date().toISOString().split('T')[0],
          industry_name: result.company_profile?.industry || 'Peer Universe',
          peers: peerDiscovery.peerCompanyItems,
          key_takeaway: peerDiscovery.isLimitedSample
            ? 'กลุ่มเปรียบเทียบคู่แข่งมีจำนวนจำกัด (2 บริษัท) ตามเกณฑ์ความน่าเชื่อถือของข้อมูล'
            : undefined,
        };
      }
    }
  }


  // Keep dated research intact. Explicit quote refresh updates only current market fields.
  // All current-price consumers use the same canonical snapshot so DCF cannot remain on a stale AI-supplied price.
  const symbol = (ticker || result.ticker || '').toUpperCase();
  const quote = live?.[symbol];
  const marketSnapshot = buildMarketSnapshot(symbol, quote);
  if (marketSnapshot) {
    result.market_snapshot = marketSnapshot;

    if (result.company_profile) {
      result.company_profile.stock_price = marketSnapshot.price;
      if (finite(marketSnapshot.change)) result.company_profile.price_change = marketSnapshot.change;
      if (finite(marketSnapshot.changePercent)) result.company_profile.price_change_pct = marketSnapshot.changePercent;
      if (typeof quote?.marketCap === 'string' && quote.marketCap.trim()) result.company_profile.market_cap = quote.marketCap;
      if (finite(marketSnapshot.fiftyTwoWeekHigh)) result.company_profile.fifty_two_week_high = marketSnapshot.fiftyTwoWeekHigh;
      if (finite(marketSnapshot.fiftyTwoWeekLow)) result.company_profile.fifty_two_week_low = marketSnapshot.fiftyTwoWeekLow;
    }

    if (result.intrinsic_value) result.intrinsic_value.current_price = marketSnapshot.price;
    // Technical levels belong to their dated OHLCV basis. Updating only price
    // would silently mix a new quote with old entry/targets and indicators.
    if (result.forecast_dashboard?.price_target) {
      result.forecast_dashboard.price_target.current_price = marketSnapshot.price;
      const mean = result.forecast_dashboard.price_target.mean;
      result.forecast_dashboard.price_target.implied_upside_pct = finite(mean)
        ? rounded((mean - marketSnapshot.price) / marketSnapshot.price * 100)
        : undefined;
    }
  }

  // Preserve deterministic validation_summary when it was produced by the production validator.
  // Its filing_source remains unset unless real source metadata exists.

  // Recalculate DCF from the disclosed four-quarter dataset for standard DCF operating companies.
  // Specialized models (DDM, REIT AFFO, Relative Only) retain their canonical model results.
  if (result.intrinsic_value) {
    const intrinsic = result.intrinsic_value;
    const sym = (ticker || result.ticker || 'STOCK').toUpperCase();
    const selectedModel = result.canonical_financials
      ? detectValuationModel(result, sym)
      : intrinsic.selected_model ?? detectValuationModel(result, sym);
    if (result.canonical_financials) intrinsic.selected_model = selectedModel;
    const modelTypeStr = String(selectedModel?.model_type || '');
    const isNonDcfModel = modelTypeStr === 'ddm'
      || modelTypeStr === 'reit_affo'
      || modelTypeStr === 'relative_only'
      || modelTypeStr === 'residual_income'
      || modelTypeStr === 'early_stage_scenario'
      || modelTypeStr === 'fintech_pe';

    if (!isNonDcfModel) {
      const validationBlocksValuation = result.validation?.issues?.some(issue =>
        issue.severity === 'critical'
        && ['financial_statements', 'valuation', 'cross_section', 'market_data'].includes(issue.section)
      ) ?? false;

      const { dcfModel, inputs } = buildRigorousDCFModel(result, sym);
      intrinsic.dcf_model = dcfModel;
      const base = dcfModel.scenarios.base.fair_value_per_share;
      const bear = dcfModel.scenarios.bear.fair_value_per_share;
      const bull = dcfModel.scenarios.bull.fair_value_per_share;

      if (!validationBlocksValuation
        && inputs.isValid
        && finite(base)
        && finite(bear)
        && finite(bull)
        && finite(inputs.currentPrice)
        && inputs.currentPrice > 0) {
        intrinsic.summary = {
          ...intrinsic.summary,
          fair_value_range_low: bear,
          fair_value_range_high: bull,
          base_case_fair_value: base,
          margin_of_safety_pct: rounded((base - inputs.currentPrice) / inputs.currentPrice * 100),
          verdict_text: 'Canonical DCF recalculated from the financial inputs disclosed in this report. Review the scenario assumptions and margin of safety shown above.',
        };
        intrinsic.validation_alerts = (intrinsic.validation_alerts || []).filter(alert =>
          alert.code !== 'VALUATION_INPUTS_INCOMPLETE' && alert.code !== 'REPORT_VALIDATION_BLOCK'
        );
      } else {
        intrinsic.summary = {
          ...intrinsic.summary,
          fair_value_range_low: null,
          fair_value_range_high: null,
          base_case_fair_value: null,
          margin_of_safety_pct: null,
          verdict_text: validationBlocksValuation
            ? 'Valuation unavailable because critical data-validation checks failed.'
            : 'Valuation unavailable until required filing inputs are supplied.',
        };
        // Missing DCF dependencies do not invalidate independently eligible
        // relative valuation. Structural/identity corruption still quarantines it.
        if (validationBlocksValuation && result.validation?.issues?.some(issue => issue.severity==='critical' && !isDcfOnlyCriticalIssue(issue))) {
          intrinsic.relative_valuation = undefined;
          intrinsic.relative_only_model = undefined;
        }
        intrinsic.validation_alerts = [
          ...(intrinsic.validation_alerts || []).filter(alert =>
            alert.code !== 'VALUATION_INPUTS_INCOMPLETE' && alert.code !== 'REPORT_VALIDATION_BLOCK'
          ),
          {
            type: 'error',
            code: validationBlocksValuation ? 'REPORT_VALIDATION_BLOCK' : 'VALUATION_INPUTS_INCOMPLETE',
            message_th: validationBlocksValuation
              ? 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูลไม่ผ่านการตรวจสอบความสอดคล้องที่สำคัญ'
              : 'ยังไม่แสดงมูลค่าหุ้น เพราะข้อมูล DCF จากงบยังไม่ครบหรือไม่อยู่ในงวดเดียวกัน',
            message_en: validationBlocksValuation
              ? 'Valuation is unavailable because critical report-validation checks failed.'
              : 'Valuation is unavailable because the required DCF inputs are missing or are not from the same reporting period.',
            detail: validationBlocksValuation
              ? result.validation?.issues?.filter(issue => issue.severity === 'critical').map(issue => issue.code).join('; ')
              : inputs.missingFields?.join('; '),
          },
        ];
      }
    }
  }

  // The report model may suggest qualitative factor scores on a 1-10 scale, but
  // the public conviction score is a separate 0-100 calculation. Never present
  // an arbitrary model-produced number as the deterministic conviction score.
  reconcileReportMultiples(result);
  if (result.intrinsic_value && result.canonical_financials) {
    const run = resolveAdaptiveValuationRun(result);
    result.intrinsic_value.canonical_run = run;
    // One method-local result feeds the summary, Section 1, History and every
    // presentation consumer. A DCF value cannot replace an unavailable bank,
    // platform, REIT or holding-company primary method.
    result.intrinsic_value.summary = {
      ...result.intrinsic_value.summary,
      fair_value_range_low: run.bearFairValue,
      base_case_fair_value: run.baseFairValue,
      fair_value_range_high: run.bullFairValue,
      margin_of_safety_pct: run.marginOfSafetyPct,
      verdict_text: run.status === 'AVAILABLE'
        ? `${run.primaryMethod} · deterministic valuation run ${run.valuationRunId}`
        : `Fair value unavailable: ${run.missingInputs.join(', ') || run.status}`,
    };
  }
  if (/sec-xbrl/i.test(result.canonical_financials?.generatedBy || '')) {
    // PEG must share the same period/earnings eligibility as Five Pillars and
    // Conviction. A positive AI PEG cannot bypass a canonical basis mismatch.
    const peg = resolveFundamentalMetrics(result, ticker || result.ticker).peg;
    const nm = peg.status === 'NOT_APPLICABLE' || peg.status === 'GUARDED'
      || /Negative or zero|Turnaround|negative/i.test(peg.reason || '');
    const item: ValuationRatioItem = {name:'PEG Ratio',value:peg.value ?? null,unit:'x',source:peg.source,
      status:peg.status==='CALCULATED'?'CALCULATED':nm?'VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON':'UNAVAILABLE',
      reason:peg.reason,interpretation:peg.reasonTh,verdict:nm?'not_meaningful':undefined};
    result.valuation_ratios = [...(result.valuation_ratios || []).filter(r=>!/^PEG(?: Ratio)?$/i.test(r.name)),item];
  }
  // Resolve after canonical quote and multiples, so Five Pillars/Conviction see
  // the same value in this pass (rather than waiting for a second normalization).
  if (result.financial_statements || result.five_pillars) {
    const adaptivePillars = resolveAdaptiveFivePillars(result, ticker || result.ticker);
    result.five_pillars = adaptivePillars.fivePillarsData;
  }
  if (result.analysis_type !== 'technical' && result.verdict) {
    const conviction = calculateDeterministicConvictionScore(result, ticker || result.ticker);
    result.verdict.conviction_score = conviction?.conviction_score ?? null;
    if (conviction) result.verdict.conviction_breakdown = conviction.conviction_breakdown;
    else delete result.verdict.conviction_breakdown;
  }

  // Section 1 Canonical Executive Snapshot & Post-Normalization Narrative Reconciliation
  // All numeric statements in Section 1 (Header, Executive Summary, Key Takeaways, Conviction)
  // must agree with the final canonical report state.
  // A persisted Section 1 snapshot may predate the current SEC filing. Rebuild from
  // the resolved report facts so stale cached liquidity cannot survive normalization.
  const refreshedSnapshot = buildCanonicalExecutiveSnapshot(result, ticker || result.ticker);
  // Never merge prior/model-produced valuation or recommendation fields over a
  // newly resolved run. This was a cross-section stale-value resurrection path.
  const executiveSnapshot = refreshedSnapshot;
  if (!refreshedSnapshot.facts.revenueTtm) delete executiveSnapshot.facts.revenueTtm;
  result.canonical_executive_snapshot = executiveSnapshot;

  if (result.verdict) {
    if (result.verdict.summary) {
      result.verdict.summary = reconcileExecutiveSummary(result.verdict.summary, executiveSnapshot);
    }
    if (Array.isArray(result.verdict.key_takeaways) && result.verdict.key_takeaways.length > 0) {
      result.verdict.key_takeaways = reconcileKeyTakeaways(result.verdict.key_takeaways, executiveSnapshot);
    }
  }

  reconcileCurrentValuationProse(result,executiveSnapshot);

  if (result.technical_analysis) result.technical_analysis.snapshot_audit = auditTechnicalSnapshot(result.technical_analysis);
  result.research_integrity = buildResearchIntegrity(result);
  const persistenceStatus = result.report_completion?.persistenceStatus ?? 'PENDING';
  result.report_completion = { ...resolveReportCompletion(result, result.validation ?? {
    status: 'warning', issues: [{ code: 'CURRENT_QUALITY_GATE_NOT_RUN', severity: 'warning',
      section: 'history', message: 'Display normalization is not a full report quality audit.', path: 'history' }],
    checked_at: result.generated_at || '', schema_version: result.schema_version ?? 0,
  }), persistenceStatus };
  return result;
}
