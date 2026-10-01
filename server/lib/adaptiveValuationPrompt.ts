import type { CanonicalFinancialDataset } from '../../src/domain/financialValue';
import { reconcileCanonicalTtmFlow, TTM_FLOW_METRICS } from '../../src/domain/canonicalTtmFlow';

export const ADAPTIVE_VALUATION_INSTRUCTIONS = `
ADAPTIVE VALUATION CONTRACT (all issuers, no ticker rules):
Historical facts are independent inputs. You propose economically defensible assumptions; Lumina calculates all fair values.
Keep external Wall Street price targets and Morningstar values separate from intrinsic thesis cases. Never back-solve forecast assumptions to match those targets.
Operating businesses: FCFF DCF with WACC, growth, forecast margin and horizon.
Banks/lenders/insurers: residual income/equity valuation using explicit cost of equity and sustainable growth, never WACC or bank deposits as industrial net debt.
Fintech/brokerage/conglomerates: SOTP only when verified segment IDs and a single reconciled taxonomy are supplied. Bind each component to segmentId, financialMetric, inputBasis (TTM or INSTANT), valuationMultiple and valuationBasis (EQUITY or ENTERPRISE). Do not mix enterprise/equity parts or overlapping hierarchy levels. corporateAdjustments is an explicit forecast assumption, not invented historical cash. Otherwise propose residual income only where its verified equity and ROE inputs are meaningful.
For SOTP thesis cases, disclose bearValuationMultiple and bullValuationMultiple for EVERY component when economically supportable. Lumina computes each case from the same verified segment inputs and consolidated bridge. Omit unsupported case assumptions; never manufacture percentage discounts to an existing fair value.
REIT: independently disclosed AFFO and verified peer P/AFFO, or explicit source-supported NAV assumptions. Do not manufacture AFFO from net income.
Pre-profit: observed eligible peer EV/Sales with independently verified revenue and net cash; no invented peer median.
Cyclical: cycle_length_years is an explicit 2–5 year normalization horizon. Require verified full-cycle history; do not relabel peak margins as normalized.
Set historical book value, historical dividends, historical AFFO and all calculated output fields to null in AI JSON; source ingestion/calculation supplies them.
For financial issuers populate intrinsic_value.ddm_model.assumptions.cost_of_equity_pct and terminal_growth_pct when defensible, plus bear/bull costs and growth. Current ROE, book value and dividend inputs are source-derived, not invented model inputs.
Never output canonical_run, canonical_financials, report_completion or research_integrity; these are application-owned deterministic objects.
Events must distinguish actual event date, SEC filing date, press release date and expected date. Source-link candidates, but never claim issuer confirmation without document evidence. Headcount must specify POINT_IN_TIME, AVERAGE or PROVIDER_ESTIMATE, source and as-of. Do not present point headcount as average productivity.
Management guidance must distinguish fiscal period, metric, issued/publication date, source and ACTIVE/SUPERSEDED/WITHDRAWN status. Guidance is not an actual result or analyst consensus.
`;

/** Small historical context, not raw companyfacts or a model prompt replay. */
export function compactAdaptiveFinancialContext(dataset: CanonicalFinancialDataset | null | undefined) {
  if(!dataset)return {status:'VERIFIED_INPUTS_UNAVAILABLE'};
  return {ticker:dataset.ticker,currency:dataset.currency,periods:dataset.periods.slice(-5),
    canonicalTtm:Object.fromEntries(TTM_FLOW_METRICS.map(key=>{const r=reconcileCanonicalTtmFlow(dataset,key);return [key,{value:r.canonicalValue,status:r.status,periods:r.periodsUsed}];})),
    operatingSegments:dataset.operatingSegments?.map(segment=>({id:segment.id,name:segment.name,axis:segment.axis,
      metrics:Object.fromEntries(Object.entries(segment.values).map(([key,values])=>[key,
        values.slice(-5).map(f=>({value:f.value,period:f.period,periodType:f.periodType,unit:f.unit,source:f.source?.documentUrl}))]))}))??[]};
}
