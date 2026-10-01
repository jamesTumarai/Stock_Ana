import { FinancialStatementsData, StatementValidationSummary, StatementTemplateType, ReportData, BalanceSheetData, IncomeStatementData, CashFlowData } from '../types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const tolerance = (scale: number) => Math.max(1, Math.abs(scale) * 0.00001); // disclosed USD-million rounding

/** Reconcile actual disclosed components. Missing inputs never count as passed checks. */
export function validateFinancialStatements(
  fs: FinancialStatementsData,
  template: StatementTemplateType = 'standard',
  report?: Partial<ReportData>,
  targetTicker?: string,
): StatementValidationSummary {
  const failed: string[] = [], passed: string[] = [];
  const discrepancy: (number | null)[] = [], percentages: (number | null)[] = [];
  const components: Record<string, number | null>[] = [];
  let complete = fs.periods.length > 0;
  const bs = fs.balance_sheet, cf = fs.cash_flow;
  fs.periods.forEach((period, i) => {
    const assets = bs.total_assets?.[i] ?? null, liabilities = bs.total_liabilities?.[i] ?? null;
    const totalEquity = bs.total_equity?.[i] ?? null, stockholdersEquity = bs.stockholders_equity?.[i] ?? null;
    const nci = bs.noncontrolling_interest?.[i] ?? null, redeemable = bs.redeemable_noncontrolling_interest?.[i] ?? null;
    // A combined equity fact already includes NCI. It must not be added twice.
    const equity = finite(totalEquity) ? totalEquity : finite(stockholdersEquity) && finite(nci) ? stockholdersEquity + nci : null;
    components.push({ assets, liabilities, totalEquity, stockholdersEquity, noncontrollingInterest: nci, redeemableNoncontrollingInterest: redeemable });
    if (finite(assets) && finite(liabilities) && finite(equity)) {
      // If mezzanine presentation is undisclosed, only test the reported equation and
      // retain partial status; no missing component is promoted to a disclosed zero.
      const presentation=fs.verified_dataset?.values['balance_sheet.redeemable_noncontrolling_interest']?.find(v=>v.period===period)?.balancePresentation?.classification;
      const reportedDelta=assets-liabilities-equity;
      const separateDelta=reportedDelta-(finite(redeemable)?redeemable:0);
      // A redeemable NCI fact need not be a separate mezzanine line. Some
      // issuers explicitly include it in NCI. Without primary scope evidence,
      // test the two disclosed equations but retain PARTIAL, never infer scope
      // or add the same balance twice merely because its tag is redeemable.
      const included=presentation==='INCLUDED_IN_NCI' || (!presentation && Math.abs(reportedDelta)<=tolerance(assets));
      const expected = liabilities + equity + (!included && finite(redeemable) ? redeemable : 0);
      const delta = assets - expected;
      discrepancy.push(delta); percentages.push(assets ? delta / assets * 100 : null);
      if (Math.abs(delta) > tolerance(assets)) failed.push(`BALANCE_SHEET_IMBALANCE: ${period} Assets - (Liabilities + Equity + disclosed Mezzanine) = ${delta}M`);
      else if (finite(redeemable) && !presentation) {
        passed.push(`REPORTED_BALANCE_EQUATION_COMPATIBLE_SCOPE_UNRESOLVED: ${period}`);
        components[i].redeemableScopeUnresolved=1;
        components[i].reportedEquationDelta=reportedDelta;
        components[i].separateMezzanineEquationDelta=separateDelta;
        complete=false;
      } else passed.push(`BALANCE_SHEET_IDENTITY_OK: ${period}`);
      if (!finite(redeemable)) complete = false;
    } else if (finite(assets) && finite(liabilities) && finite(stockholdersEquity)
      && !finite(nci) && Math.abs(assets - liabilities - stockholdersEquity) <= tolerance(assets)) {
      // Validate the disclosed parent-equity equation as its own scope. This
      // does not manufacture a zero NCI or a consolidated total-equity fact.
      discrepancy.push(assets - liabilities - stockholdersEquity);
      percentages.push(assets ? (assets - liabilities - stockholdersEquity) / assets * 100 : null);
      passed.push(`REPORTED_PARENT_BALANCE_EQUATION_OK_SCOPE_PARTIAL: ${period}`);
      complete = false;
    } else { discrepancy.push(null); percentages.push(null); complete = false; }
    const cash = bs.cash_and_equivalents?.[i], deposits = bs.deposits?.[i];
    if (finite(assets) && finite(cash) && cash > assets) failed.push(`IMPOSSIBLE_VALUE: ${period} Cash exceeds Assets`);
    if (template === 'banking' && finite(assets) && finite(deposits) && deposits > assets) failed.push(`CRITICAL_BANKING_GUARD_FAILED: ${period} Deposits exceed Assets`);
    else if (template === 'banking' && finite(assets) && finite(deposits)) passed.push(`BANKING_ASSETS_GE_DEPOSITS_OK: ${period}`);
    if (finite(bs.total_debt?.[i]) && finite(bs.short_term_debt?.[i]) && bs.total_debt![i]! < bs.short_term_debt![i]!) failed.push(`TOTAL_DEBT_UNDERSTATED: ${period}`);
    const common = bs.common_stock?.[i], apic = bs.additional_paid_in_capital?.[i], re = bs.retained_earnings?.[i], aoci = bs.aoci?.[i];
    // No forced equation when treasury stock/other equity classes are not mapped.
    // Components remain visible diagnostics; the disclosed Assets equation is primary.
    if ([common, apic, re, aoci, stockholdersEquity].every(finite)) {
      components[i].equityComponentDelta = stockholdersEquity! - common! - apic! - re! - aoci!;
    }
    const ocf = cf.operating_cash_flow?.[i], capex = cf.capex?.[i], fcf = cf.free_cash_flow?.[i];
    if ([ocf, capex, fcf].every(finite)) {
      if (Math.abs(fcf! - (ocf! - Math.abs(capex!))) > tolerance(fcf!)) failed.push(`FCF_IDENTITY_MISMATCH: ${period}`);
      else passed.push(`FCF_IDENTITY_OK: ${period}`);
    } else if (template !== 'banking' && template !== 'insurance') complete = false;
    const begin = cf.beginning_cash?.[i], change = cf.net_change_cash?.[i], end = cf.ending_cash?.[i];
    const investing = cf.investing_cash_flow?.[i], financing = cf.financing_cash_flow?.[i], fx = cf.exchange_rate_effect?.[i];
    if ([ocf, investing, financing, fx, change].every(finite)) {
      const delta = ocf! + investing! + financing! + fx! - change!;
      components[i].cashFlowActivityDelta = delta;
      if (Math.abs(delta) > tolerance(change!)) failed.push(`CASH_FLOW_ACTIVITY_RECONCILIATION_FAILED: ${period}`);
      else passed.push(`CASH_FLOW_ACTIVITY_RECONCILIATION_OK: ${period}`);
    } else complete = false;
    if ([begin, change, end].every(finite)) {
      if (Math.abs(begin! + change! - end!) > tolerance(end!)) failed.push(`CASH_RECONCILIATION_FAILED: ${period}`);
      else passed.push(`CASH_RECONCILIATION_OK: ${period}`);
    } else complete = false;
    const snapshot = fs.period_snapshots?.[i];
    if (snapshot && Object.keys(snapshot.rejected).length) complete = false;
  });
  const hasIdentity = passed.some(g => g.startsWith('BALANCE_SHEET_IDENTITY_OK') || g.startsWith('REPORTED_BALANCE_EQUATION_COMPATIBLE_SCOPE_UNRESOLVED') || g.startsWith('REPORTED_PARENT_BALANCE_EQUATION_OK_SCOPE_PARTIAL'));
  const coverage = fs.verified_dataset?.sourceCoverage;
  const sourceVerified = Boolean(coverage && coverage.verifiedValues > 0 && coverage.verifiedValues === coverage.nonNullValues);
  const status = failed.length ? 'failed' : !hasIdentity ? 'unavailable' : complete && sourceVerified ? 'passed' : 'partial';
  const flagged: Record<string, string> = {};
  if (failed.length) for (const key of ['roe', 'roa', 'roic']) flagged[key] = 'Accounting inputs failed reconciliation; return ratio suppressed.';
  return {
    is_balanced: hasIdentity && !failed.some(g => g.startsWith('BALANCE_SHEET_IMBALANCE')),
    is_reconciled: status === 'passed', reconciliation_status: status,
    source_reconciliation_status: sourceVerified ? 'verified' : fs.verified_dataset ? 'partial' : 'unavailable',
    reconciliation_components: components, discrepancy_amount: discrepancy, discrepancy_pct: percentages,
    impossible_guards_passed: status === 'passed', failed_guards: failed, passed_guards: passed,
    flagged_metrics: flagged, ratio_reliability_warning: status !== 'passed',
    filing_source: fs.source?.document_url ? [fs.source?.document_type, fs.source.document_url].filter(Boolean).join(' · ') : undefined, filing_date: fs.source?.filing_date,
  };
}

/**
 * Detects the appropriate Financial Statement template based on Sector, Industry, or Symbol.
 * Integrates directly with the Valuation Model Selector taxonomy.
 */
export function detectStatementTemplate(
  data?: Partial<ReportData>,
  ticker?: string
): StatementTemplateType {
  const profile = data?.company_profile;
  const description = [profile?.sector, profile?.industry, profile?.description,
    data?.comprehensive_analysis?.business_overview].filter(Boolean).join(' ').toLowerCase();
  if (/insurance|underwriting|property.and.casualty/.test(description)) return 'insurance';
  if (/real estate investment trust|\breit\b/.test(description)) return 'reit';
  if (/\bbank(?:ing|s)?\b|depository|consumer lending|loan origination|digital lender/.test(description)) return 'banking';
  if (/clinical.stage|pre.clinical|biotechnology/.test(description)) return 'biotech';
  if (/oil.and.gas|oil & gas|mining|airline|shipping|energy/.test(description)) return 'cyclical';
  return 'standard';
}
