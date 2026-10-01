import type { ReportData, ValuationRatioItem, ReportValidationIssue } from '../../types';
import type { CanonicalFinancialDataset } from '../financialValue';
import type { MarketSnapshot } from '../marketSnapshot';
import { reconcileCanonicalTtmFlow, type TtmFlowMetric } from '../canonicalTtmFlow';
import { validTrailingFourQuarterLabels } from './canonicalQuarterWindow';
import { resolveCurrentBalanceSheetSnapshot } from '../currentBalanceSheetSnapshot';

export const VALUATION_DEPENDENCIES = {
  'P/E': ['market.price + fourStandaloneCommonEPS OR market.marketCap + fourStandaloneCommonEarnings'],
  'Forward P/E': ['market.forwardPE:consensusEstimate'],
  PEG: ['positivePE','positiveCompatibleEarningsGrowth'],
  'EV/EBITDA': ['market.enterpriseValue','fourStandaloneOperatingIncome','fourStandaloneDA'],
  'EV/Sales': ['market.enterpriseValue','fourStandaloneRevenue'],
  'P/FCF': ['market.marketCap','fourStandaloneFCF'],
  'P/B': ['market.marketCap','sameInstantParentEquity'],
  DCF: ['methodSpecificRevenueFCFHistory','sameInstantCashInvestmentsDebt','currentCommonShares','scenarioAssumptions'],
  ROIC: ['fourStandaloneNOPAT','compatibleBeginningEndingInvestedCapital'],
  ROE: ['scopeCompatibleEarnings','compatibleBeginningEndingEquity'],
} as const;
export type MultipleStatus = 'CALCULATED' | 'REPORTED' | 'UNAVAILABLE' | 'VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON';
export interface CanonicalMultiple extends ValuationRatioItem {
  status: MultipleStatus; reason: string; source: string;
  dependencies: readonly string[]; rawValue?: number | null; periodsUsed?: string[];
}
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
export function isDcfOnlyCriticalIssue(issue: ReportValidationIssue): boolean {
  return issue.severity === 'critical' && issue.section === 'valuation'
    && (['TERMINAL_GROWTH_EXCEEDS_DISCOUNT_RATE','DCF_REVENUE_INPUT_CONFLICT','DCF_SHARE_COUNT_CONFLICT','DCF_SUMMARY_CONFLICT'].includes(issue.code)
      || Boolean(issue.path?.startsWith('intrinsic_value.dcf_model')));
}

/** All accounting denominators come from the same verified canonical dataset.
 * No valuation method consults an unrelated coverage gate or model-produced facts.
 * Market values are only accepted from the independently fetched quote envelope.
 */
export function resolveCanonicalMultiples(report: Partial<ReportData>): CanonicalMultiple[] {
  const ds = report.canonical_financials as CanonicalFinancialDataset | undefined;
  const market = report.market_snapshot as MarketSnapshot | undefined;
  const quote = market?.dataKind === 'market_quote' && !!market.provider
    && market.ticker?.toUpperCase() === report.ticker?.toUpperCase() ? market : undefined;
  const cap = finite(quote?.marketCapRaw) && quote.marketCapRaw! > 0 ? quote.marketCapRaw! / 1e6 : null;
  const ev = finite(quote?.enterpriseValueRaw) ? quote.enterpriseValueRaw! / 1e6 : null;
  const flow = (metric: TtmFlowMetric) => reconcileCanonicalTtmFlow(ds,metric);
  const revenue = flow('income_statement.revenue'), fcf = flow('cash_flow.free_cash_flow');
  const op = flow('income_statement.operating_income'), da = flow('cash_flow.depreciation');
  const ebitda = finite(op.canonicalValue) && finite(da.canonicalValue) && JSON.stringify(op.periodsUsed) === JSON.stringify(da.periodsUsed)
    ? op.canonicalValue + da.canonicalValue : null;
  const periods = ds?.periods?.slice(-4) || [];
  const epsFacts = periods.map(p => ds?.values?.['income_statement.eps_diluted']?.find(v => v.period === p));
  const eps = validTrailingFourQuarterLabels(periods) && epsFacts.every(v => v?.verification === 'verified' && v.periodType === 'standalone_quarter' && v.unit === 'per_share' && finite(v.value))
    ? epsFacts.reduce((sum,v) => sum+v!.value!,0) : null;
  const snapshot = resolveCurrentBalanceSheetSnapshot(report);
  const equity = snapshot.facts.stockholders_equity?.value ?? null;
  const multiple = (name: keyof typeof VALUATION_DEPENDENCIES, numerator: number | null | undefined, denominator: number | null | undefined, periodsUsed?: string[]): CanonicalMultiple => {
    const available = finite(numerator) && finite(denominator);
    const knownNonPositive = (finite(denominator) && denominator <= 0) || (finite(numerator) && numerator <= 0);
    const meaningful = available && !knownNonPositive;
    const rawValue = available && denominator !== 0 ? numerator / denominator : null;
    return {name,unit:'x',value:meaningful?Math.round(rawValue!*100)/100:null,rawValue,periodsUsed,
      status:meaningful?'CALCULATED':knownNonPositive?'VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON':'UNAVAILABLE',
      reason:meaningful?'Verified metric-local dependencies':knownNonPositive?'Non-positive denominator/numerator; positive-multiple comparisons are not meaningful':'Missing: '+VALUATION_DEPENDENCIES[name].join(', '),
      source: 'Canonical verified filings + '+(quote?.provider || 'market quote unavailable'),dependencies:VALUATION_DEPENDENCIES[name],
      verdict:knownNonPositive?'not_meaningful':undefined,
      interpretation:knownNonPositive?'N/M — ไม่เหมาะกับการเปรียบเทียบเมื่อกำไร/FCF/ฐานคำนวณไม่เป็นบวก':undefined};
  };
  const forward = multiple('Forward P/E',quote?.forwardPE,1);
  if (finite(quote?.forwardPE) && quote.forwardPE! > 0) {forward.status='REPORTED';forward.source=quote!.provider!+' consensus forward estimate';}
  const commonEarnings = flow('income_statement.net_income_common');
  // Common earnings are an alternate disclosed denominator, never parent/total
  // earnings spliced into a common-share EPS series. A known loss remains N/M.
  const trailing = finite(eps) ? multiple('P/E',quote?.price,eps,periods)
    : finite(commonEarnings.canonicalValue) ? multiple('P/E',cap,commonEarnings.canonicalValue,commonEarnings.periodsUsed)
    : multiple('P/E',quote?.price,null,periods);
  if (trailing.status === 'UNAVAILABLE' && finite(quote?.trailingPE)) {
    Object.assign(trailing,multiple('P/E',quote.trailingPE,1));
    if (quote.trailingPE > 0) trailing.status='REPORTED';
    trailing.source=quote.provider+' reported trailing P/E';
    trailing.reason='Provider trailing basis; canonical standalone EPS history incomplete. Never inferred from AI or weighted-average share counts.';
  }
  const reportedFallback = (result: CanonicalMultiple, value: unknown, denominator: number | null) => {
    // A directly reported provider ratio is independently usable when the exact
    // canonical denominator is absent. A known non-positive denominator always
    // wins; it can never be hidden by a positive provider or model multiple.
    if (result.status !== 'UNAVAILABLE' || (finite(denominator) && denominator <= 0) || !finite(value)) return result;
    const reported = multiple(result.name as keyof typeof VALUATION_DEPENDENCIES, value, 1);
    return {...reported, status: value > 0 ? 'REPORTED' as const : reported.status,
      source: quote!.provider+' reported '+result.name,
      reason:'Provider-reported ratio on its own trailing/instant basis; canonical denominator unavailable. Not a canonical-derived value.'};
  };
  return [trailing,forward,reportedFallback(multiple('EV/EBITDA',ev,ebitda,op.periodsUsed),quote?.enterpriseToEbitda,ebitda),
    reportedFallback(multiple('EV/Sales',ev,revenue.canonicalValue,revenue.periodsUsed),quote?.enterpriseToRevenue,revenue.canonicalValue),
    multiple('P/FCF',cap,fcf.canonicalValue,fcf.periodsUsed),reportedFallback(multiple('P/B',cap,equity),quote?.priceToBook,equity)];
}

const canonicalMultipleName = (name: string): string => {
  const token=name.trim().toLowerCase().replace(/\s+/g,'');
  return ({'trailingp/e':'P/E','trailingpe':'P/E','pe':'P/E','p/e':'P/E','forwardpe':'Forward P/E','forwardp/e':'Forward P/E',
    'ev/revenue':'EV/Sales','ev/sales':'EV/Sales','price/fcf':'P/FCF','p/fcf':'P/FCF','price/book':'P/B','p/b':'P/B',
    'ev/ebitda':'EV/EBITDA','peg':'PEG Ratio','pegratio':'PEG Ratio'} as Record<string,string>)[token] || name;
};

/** Negative observed multiples retain diagnostics but never keep cheap/expensive
 * badges, positive percentile ranks, or a numeric value eligible for peer scoring.
 */
export function sanitizeMultipleSemantics(item: ValuationRatioItem): ValuationRatioItem {
  item={...item,name:canonicalMultipleName(item.name)};
  if (!/^(?:P\/E|Forward P\/E|PEG(?: Ratio)?|EV\/EBITDA|EV\/Sales|P\/FCF|P\/B)(?:\s|$)/i.test(item.name) || !finite(item.value) || item.value > 0) return item;
  return {...item,value:null,rawValue:item.value,status:'VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON',
    verdict:'not_meaningful',peer_avg:null,own_5yr_percentile:null,interpretation:'N/M — ฐานคำนวณไม่เป็นบวก ไม่เหมาะกับการเปรียบเทียบถูก/แพง'} as CanonicalMultiple;
}

export function reconcileReportMultiples(report: Partial<ReportData>): void {
  const existing = [...new Map((report.valuation_ratios || []).map(sanitizeMultipleSemantics).map(item=>[item.name.toLowerCase(),item])).values()];
  for (const resolved of resolveCanonicalMultiples(report)) {
    const index = existing.findIndex(item => item.name.toLowerCase() === resolved.name.toLowerCase());
    // Verified canonical observations supersede private AI multiples. A missing
    // canonical dependency does not erase a separately sourced provider multiple.
    if (resolved.status !== 'UNAVAILABLE' || /sec-xbrl/i.test(report.canonical_financials?.generatedBy || '')) {
      if (index < 0) existing.push(resolved); else existing[index] = resolved;
    }
  }
  if (existing.length) report.valuation_ratios = existing;
}
