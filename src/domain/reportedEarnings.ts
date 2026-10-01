import type { FinancialStatementsData } from '../types';
import { buildVerifiedStatementPeriods } from './verifiedFinancialStatements';

export type EarningsScope = 'TOTAL' | 'PARENT' | 'COMMON';
const scopes = [
  { scope: 'TOTAL' as const, metric: 'net_income', label: 'Total net income', labelTh: 'กำไรสุทธิรวม' },
  { scope: 'PARENT' as const, metric: 'net_income_parent', label: 'Net income attributable to parent', labelTh: 'กำไรสุทธิของบริษัทใหญ่' },
  { scope: 'COMMON' as const, metric: 'net_income_common', label: 'Net income available to common stockholders', labelTh: 'กำไรสุทธิของผู้ถือหุ้นสามัญ' },
];
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/** Research profitability can use disclosed parent earnings without claiming that
 * they are total/common earnings. Select ONE scope for the series; never splice
 * attribution scopes between quarters. Scope-specific accounting ratios continue
 * to request their exact numerator and are not repaired by this reader. */
export function resolveReportedEarnings(data?: FinancialStatementsData) {
  if (!data?.periods?.length || data.quality_status === 'unavailable') return null;
  const snapshots = data.verified_dataset ? buildVerifiedStatementPeriods(data.verified_dataset) : null;
  const lastPeriod = data.periods.at(-1);
  for (const definition of scopes) {
    // Legacy direct consumers retain their previous total-income input only. This
    // does not promote unverified parent/common model arrays to accepted evidence.
    if (!snapshots && definition.scope !== 'TOTAL') continue;
    const values = !snapshots ? (data.income_statement?.net_income || []).map(v => finite(v) ? v : null) : data.periods.map(period => {
      const value = snapshots
        ? snapshots.find(s => s.label === period)?.observations[`income_statement.${definition.metric}`]?.value
        : undefined;
      return finite(value) ? value : null;
    });
    if (!finite(values.at(-1))) continue;
    return { ...definition, canonicalKey: `income_statement.${definition.metric}`, periods: data.periods,
      latestPeriod: lastPeriod!, values, verification: snapshots ? 'verified' as const : 'legacy' as const };
  }
  return null;
}
