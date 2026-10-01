import type { FinancialStatementsData } from '../types';
import { calculateVerifiedKeyIndicators } from './verifiedKeyIndicators';
import { aggregateQuarterlyToAnnual } from '../utils/statementAggregation';

/** LTM labels include quarter names; they still request an annual-duration view. */
export function selectVerifiedSynthesisPeriodView(data: FinancialStatementsData, periods: string[]): FinancialStatementsData | null {
  const view = data.fiscal_period_type==='annual' ? data : periods.some(period => /^(?:FY|LTM|TTM)\b/.test(period)) ? aggregateQuarterlyToAnnual(data) : data;
  return view && periods.every(period => view.periods.includes(period)) ? view : null;
}

const aliases: Record<string, string> = { eps: 'eps_diluted', opex: 'operating_expenses', cash: 'cash_and_equivalents',
  current_assets: 'total_current_assets', current_liabilities: 'total_current_liabilities', net_income_cont: 'net_income',
  sbc: 'stock_based_compensation', da: 'depreciation',
  ocf: 'operating_cash_flow', icf: 'investing_cash_flow', fcf_financing: 'financing_cash_flow', receivables: 'accounts_receivable', payables: 'accounts_payable' };

/** Restrict model input to accepted cells/calculations and the requested actual periods. */
export function verifiedMetricSeries(data: FinancialStatementsData, key: string, periods: string[]): (number | null)[] {
  if(!data.verified_dataset||!data.period_snapshots?.length||data.quality_status==='unavailable') return periods.map(()=>null);
  const indicators = calculateVerifiedKeyIndicators(data);
  if (indicators[key]) return periods.map(p => indicators[key][data.periods.indexOf(p)]?.value ?? null);
  if (key === 'cash_and_investments') return periods.map(p => {
    const a=verifiedMetricSeries(data,'cash', [p])[0], b=verifiedMetricSeries(data,'short_term_investments',[p])[0];
    return typeof a === 'number' && typeof b === 'number' ? a + b : null;
  });
  const derived: Record<string,[string,string,'add'|'subtract']> = {
    ebitda:['operating_income','depreciation','add'], non_current_assets:['total_assets','total_current_assets','subtract'],
    non_current_liabilities:['total_liabilities','total_current_liabilities','subtract'],
  };
  if (derived[key]) {
    const [a,b,op]=derived[key], left=verifiedMetricSeries(data,a,periods),right=verifiedMetricSeries(data,b,periods);
    return left.map((v,i)=>v!==null&&right[i]!==null?op==='add'?v+right[i]!:v-right[i]!:null);
  }
  if(key==='debt_issuance_payments') {
    const issuance=verifiedMetricSeries(data,'debt_issuance',periods),repayments=verifiedMetricSeries(data,'debt_repayments',periods);
    return issuance.map((v,i)=>v!==null&&repayments[i]!==null?v-Math.abs(repayments[i]!):null);
  }
  if(key==='beginning_cash'||key==='ending_cash') return periods.map(p=>{
    const snapshot=data.period_snapshots!.find(s=>s.label===p),balances=data.verified_dataset!.cashFlowCashBalances||[];
    const first=balances.find(b=>b.startDate===snapshot?.startDate),last=balances.find(b=>b.endDate===snapshot?.endDate);
    if(first&&last&&first.basis===last.basis) return key==='beginning_cash'?first.beginning:last.ending;
    const basis=snapshot?.observations['balance_sheet.cash_and_restricted_cash']?'balance_sheet.cash_and_restricted_cash':'balance_sheet.cash_and_restricted_cash_including_disposal_group';
    const source=key==='ending_cash'?snapshot:data.period_snapshots!.find(s=>snapshot?.startDate&&Date.parse(snapshot.startDate)-Date.parse(s.endDate)===86400000);
    return source?.observations[basis]?.value??null;
  });
  const metric = aliases[key] || key;
  // Accepted snapshot observations own reported values. A model/legacy array cannot replace them.
  return periods.map(p=>{
    const observation=Object.values(data.period_snapshots!.find(s=>s.label===p)?.observations||{}).find(o=>o.metric===metric&&o.verification==='verified');
    if(observation?.statement==='cash_flow'&&['change_receivables','change_inventory','change_payables'].includes(metric)
      &&observation.valueSemantic!=='CASH_FLOW_EFFECT') return null;
    const value=observation?.value;
    if(typeof value!=='number'||!Number.isFinite(value)) return null;
    return observation.statement==='cash_flow'&&['capex','dividends_paid','repurchase_of_common_stock','debt_repayments','finance_lease_payments','dividends_to_noncontrolling_interests','distributions_to_noncontrolling_interests','distributions_to_noncontrolling_and_redeemable_interests'].includes(metric)?-Math.abs(value):value;
  });
}

/** Unknown numeric claims fail closed; model prose can never add an accounting fact. */
export function financialSynthesisHasUnsupportedNumbers(insight: unknown, acceptedNumbers: number[]): boolean {
  const allowed = new Set(acceptedNumbers.filter(Number.isFinite).flatMap(n => [
    n, n / 1000, n * 1000,
  ]).flatMap(n => [0, 1, 2, 3].map(d => Number(n.toFixed(d)))));
  const visit = (value: unknown): boolean => {
    if (typeof value === 'number') return !allowed.has(value);
    if (Array.isArray(value)) return value.some(visit);
    if (value && typeof value === 'object') return Object.entries(value).some(([key, v]) => key !== 'model' && visit(v));
    if (typeof value !== 'string') return false;
    return [...value.matchAll(/(?<![A-Za-z0-9])[-+]?\d[\d,]*(?:\.\d+)?/g)]
      .some(match => !allowed.has(Number(match[0].replace(/,/g, ''))));
  };
  return visit(insight);
}
