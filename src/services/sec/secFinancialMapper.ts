import {
  CANONICAL_FINANCIAL_GENERATOR,
  CANONICAL_FINANCIAL_SCHEMA_VERSION,
  type CanonicalFinancialDataset,
  type CanonicalFinancialValue,
  type FinancialStatementSection,
  type FinancialUnit,
  type FinancialValueType,
} from '../../domain/financialValue';
import type {
  SecCompanyConcept,
  SecCompanyFact,
  SecCompanyFactsResponse,
  SecSubmissionsResponse,
  SecTickerRecord,
} from './secClient';
import {
  normalizeDurationFactsToStandaloneQuarters,
  normalizeInstantFactsToFiscalQuarters,
  type NormalizedSecQuarterFact,
} from './xbrlNormalizer';

export interface SecCompanyBundleLike {
  identity: SecTickerRecord;
  submissions: SecSubmissionsResponse;
  companyFacts: SecCompanyFactsResponse;
  retrievedAt: string;
}

type MetricSpec = {
  statement: FinancialStatementSection;
  metric: string;
  concepts: string[];
  unit: string;
  canonicalUnit: FinancialUnit;
  factKind: 'duration' | 'instant';
  type?: FinancialValueType;
};

const METRIC_SPECS: MetricSpec[] = [
  { statement: 'income_statement', metric: 'revenue', concepts: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'gross_profit', concepts: ['GrossProfit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'operating_income', concepts: ['OperatingIncomeLoss'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'interest_expense', concepts: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestExpenseDebtExcludingAmortization', 'InterestAndDebtExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'income_before_tax', concepts: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'income_tax_expense', concepts: ['IncomeTaxExpenseBenefit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_income', concepts: ['NetIncomeLoss', 'ProfitLoss'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'eps_diluted', concepts: ['EarningsPerShareDiluted'], unit: 'USD/shares', canonicalUnit: 'per_share', factKind: 'duration' },

  // Restricted cash is not interchangeable with cash available for valuation/net-cash calculations.
  { statement: 'balance_sheet', metric: 'cash_and_equivalents', concepts: ['CashAndCashEquivalentsAtCarryingValue'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'short_term_investments', concepts: ['ShortTermInvestments', 'MarketableSecuritiesCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_current_assets', concepts: ['AssetsCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'accounts_receivable', concepts: ['AccountsReceivableNetCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'inventory', concepts: ['InventoryNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'net_ppe', concepts: ['PropertyPlantAndEquipmentNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'goodwill', concepts: ['Goodwill'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_assets', concepts: ['Assets'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_current_liabilities', concepts: ['LiabilitiesCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'accounts_payable', concepts: ['AccountsPayableCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_liabilities', concepts: ['Liabilities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'short_term_debt', concepts: ['DebtCurrent', 'ShortTermBorrowings', 'CommercialPaper', 'LongTermDebtCurrent', 'FinanceLeaseLiabilityCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'long_term_debt', concepts: ['LongTermDebtNoncurrent', 'LongTermDebt', 'FinanceLeaseLiabilityNoncurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_debt', concepts: ['DebtAndFinanceLeaseObligations', 'LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtAndFinanceLeaseObligations', 'DebtInstrumentCarryingAmount'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_rou_assets', concepts: ['OperatingLeaseRightOfUseAsset'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities_current', concepts: ['OperatingLeaseLiabilityCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities_non_current', concepts: ['OperatingLeaseLiabilityNoncurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities', concepts: ['OperatingLeaseLiability'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_equity', concepts: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'common_stock', concepts: ['CommonStockValue', 'CommonStocksIncludingAdditionalPaidInCapital'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'retained_earnings', concepts: ['RetainedEarningsAccumulatedDeficit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },

  { statement: 'cash_flow', metric: 'operating_cash_flow', concepts: ['NetCashProvidedByUsedInOperatingActivities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'depreciation', concepts: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'stock_based_compensation', concepts: ['AllocatedShareBasedCompensationExpense', 'ShareBasedCompensation'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  // PaymentsToAcquireProductiveAssets is an SEC standard-taxonomy capex concept that includes
  // purchases/capital improvements of PPE, software and other productive intangible assets.
  // It is a fallback only for fiscal periods where the narrower PPE concept is unavailable.
  { statement: 'cash_flow', metric: 'capex', concepts: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'dividends_paid', concepts: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'repurchase_of_common_stock', concepts: ['PaymentsForRepurchaseOfCommonStock', 'PaymentsForRepurchaseOfEquity', 'PaymentsForRepurchaseOfInitialPublicOfferingShares'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'issuance_of_common_stock', concepts: ['ProceedsFromIssuanceOfCommonStock', 'ProceedsFromStockOptionsExercised', 'ProceedsFromIssuanceOrSaleOfEquity', 'ProceedsFromStockIssuance', 'ProceedsFromIssuanceOfShares'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },

  // Banking / FinTech
  { statement: 'income_statement', metric: 'net_interest_income', concepts: ['NetInterestIncome', 'InterestIncomeExpenseNet', 'InterestAndDividendIncomeOperating'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'non_interest_income', concepts: ['NoninterestIncome', 'FeesAndCommissionsOtherThanFromSecuritiesTransactions'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'provision_for_credit_losses', concepts: ['ProvisionForLoanLeaseAndOtherLosses', 'ProvisionForCreditLosses'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_interest_margin_pct', concepts: ['NetInterestMargin', 'NetInterestMarginAnnualized'], unit: 'pure', canonicalUnit: 'percent', factKind: 'duration' },
  { statement: 'balance_sheet', metric: 'deposits', concepts: ['Deposits', 'InterestBearingDepositLiabilities', 'DepositsDomestic'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'loans_held_for_investment', concepts: ['LoansAndLeasesReceivableNetReported', 'LoansAndLeasesReceivableGrossReported', 'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss', 'LoansHeldForInvestment'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'tier1_capital_ratio', concepts: ['Tier1CapitalRatio', 'CommonEquityTier1RiskBasedCapitalRatio'], unit: 'pure', canonicalUnit: 'percent', factKind: 'instant' },

  // REITs
  { statement: 'income_statement', metric: 'ffo', concepts: ['FundsFromOperations', 'FundsFromOperationsPerDilutedShare'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'noi', concepts: ['NetOperatingIncome'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'rental_revenue', concepts: ['OperatingLeasesIncomeStatementLeaseRevenue', 'RentalIncome'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },

  // Insurance
  { statement: 'income_statement', metric: 'combined_ratio_pct', concepts: ['CombinedRatio', 'CombinedRatioPropertyAndCasualty'], unit: 'pure', canonicalUnit: 'percent', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_premiums_earned', concepts: ['PremiumsEarnedNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'balance_sheet', metric: 'loss_reserve', concepts: ['LiabilityForClaimsAndClaimsAdjustmentExpense', 'LossAndLossAdjustmentExpenseReserve'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
];

const quarterKey = (fact: Pick<NormalizedSecQuarterFact, 'fiscalYear' | 'fiscalQuarter'>) => `${fact.fiscalYear}-Q${fact.fiscalQuarter}`;
const periodLabel = (key: string) => {
  const match = key.match(/^(\d{4})-Q([1-4])$/);
  return match ? `Q${match[2]} ${match[1]}` : key;
};

const normalizedSort = (a: string, b: string) => {
  const parse = (key: string) => {
    const match = key.match(/^(\d{4})-Q([1-4])$/);
    return match ? Number(match[1]) * 10 + Number(match[2]) : 0;
  };
  return parse(a) - parse(b);
};

const toMillions = (value: number, unit: string) => unit === 'USD' ? value / 1_000_000 : value;

const getConcept = (facts: SecCompanyFactsResponse, conceptName: string): SecCompanyConcept | undefined => {
  if (!facts?.facts) return undefined;
  if (facts.facts['us-gaap']?.[conceptName]) return facts.facts['us-gaap'][conceptName];
  if (facts.facts['dei']?.[conceptName]) return facts.facts['dei'][conceptName];
  for (const [ns, concepts] of Object.entries(facts.facts)) {
    if (ns !== 'us-gaap' && ns !== 'dei' && concepts?.[conceptName]) {
      return concepts[conceptName];
    }
  }
  return undefined;
};

export interface SecAnnualRevenueFact {
  metric: 'revenue';
  fiscal_year: number;
  period: string;
  period_end: string;
  value: number;
  unit: 'USD_M';
  definition: string;
  source_document?: string | null;
  source_url?: string | null;
  accession?: string | null;
  filed_date?: string | null;
  verification: 'verified';
}

/**
 * Extracts source-verified annual revenue endpoints from SEC Company Facts.
 * These values are kept separate from standalone quarters so downstream CAGR
 * logic never mistakes array length for elapsed fiscal years.
 */
export function mapSecBundleToAnnualRevenueHistory(bundle: SecCompanyBundleLike): SecAnnualRevenueFact[] {
  const submissionMap = submissionDocumentMap(bundle.identity, bundle.submissions);
  const revenueConcepts = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'];
  let bestHistory: SecAnnualRevenueFact[] = [];

  for (const definition of revenueConcepts) {
    // Company Facts repeats comparative annual values in later filings. `fy`
    // identifies the filing's fiscal year, so all three comparative rows in a
    // 10-K can share the same value. The fact's duration end is the identity of
    // the reported annual period and must drive both de-duplication and labels.
    const byPeriodEnd = new Map<string, SecAnnualRevenueFact>();
    const concept = getConcept(bundle.companyFacts, definition);
    const facts = concept?.units?.USD;
    if (!Array.isArray(facts)) continue;
    for (const fact of facts) {
      if (!Number.isFinite(fact.val) || !fact.start || !fact.end || !Number.isFinite(fact.fy)) continue;
      if (!['10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A'].includes(String(fact.form || ''))) continue;
      if (String(fact.fp || '').toUpperCase() !== 'FY') continue;
      const durationDays = (Date.parse(fact.end) - Date.parse(fact.start)) / 86_400_000;
      if (!Number.isFinite(durationDays) || durationDays < 300 || durationDays > 400) continue;

      const fiscalYear = Number(fact.end.slice(0, 4));
      if (!Number.isFinite(fiscalYear)) continue;
      const filing = fact.accn ? submissionMap.get(fact.accn) : undefined;
      const candidate: SecAnnualRevenueFact = {
        metric: 'revenue', fiscal_year: fiscalYear, period: `FY${fiscalYear}`,
        period_end: fact.end, value: fact.val! / 1_000_000, unit: 'USD_M', definition,
        source_document: filing?.form || fact.form || null,
        source_url: filing?.documentUrl || null,
        accession: fact.accn || null,
        filed_date: filing?.filingDate || fact.filed || null,
        verification: 'verified',
      };
      const existing = byPeriodEnd.get(fact.end);
      // Prefer the newest filing for the same annual period so restatements and
      // later comparative disclosures supersede the originally filed value.
      if (!existing || String(candidate.filed_date || '') > String(existing.filed_date || '')) {
        byPeriodEnd.set(fact.end, candidate);
      }
    }
    const history = [...byPeriodEnd.values()].sort((a, b) => a.period_end.localeCompare(b.period_end));
    if (history.length > bestHistory.length) bestHistory = history;
    // Do not mix definitions. The highest-priority concept wins once it covers a true 3Y endpoint.
    if (history.some((end, index) => history.slice(0, index).some(start => end.fiscal_year - start.fiscal_year === 3))) return history;
  }
  return bestHistory;
}

const normalizeConcept = (concept: SecCompanyConcept | undefined, spec: MetricSpec): NormalizedSecQuarterFact[] => {
  const rawFacts = concept?.units?.[spec.unit] || (spec.unit === 'pure' ? concept?.units?.['pure'] : undefined);
  if (!Array.isArray(rawFacts)) return [];
  return spec.factKind === 'duration'
    ? normalizeDurationFactsToStandaloneQuarters(rawFacts)
    : normalizeInstantFactsToFiscalQuarters(rawFacts);
};

const mergeConceptAliases = (facts: SecCompanyFactsResponse, spec: MetricSpec) => {
  const merged = new Map<string, { fact: NormalizedSecQuarterFact; concept: string }>();
  // Priority order is intentional. Earlier standard concepts win when two concepts disclose
  // the same fiscal quarter; lower-priority aliases fill only missing periods.
  for (const conceptName of spec.concepts) {
    for (const fact of normalizeConcept(getConcept(facts, conceptName), spec)) {
      const key = quarterKey(fact);
      if (!merged.has(key)) merged.set(key, { fact, concept: conceptName });
    }
  }
  return merged;
};

const submissionDocumentMap = (identity: SecTickerRecord, submissions: SecSubmissionsResponse) => {
  const recent = submissions.filings?.recent;
  const accessions = recent?.accessionNumber;
  const primaryDocuments = recent?.primaryDocument;
  const forms = recent?.form;
  const filingDates = recent?.filingDate;
  if (!Array.isArray(accessions)) return new Map<string, { documentUrl?: string; form?: string; filingDate?: string }>();

  const cikNoLeadingZeros = String(Number(identity.cik));
  const map = new Map<string, { documentUrl?: string; form?: string; filingDate?: string }>();
  accessions.forEach((rawAccession, index) => {
    if (typeof rawAccession !== 'string' || !rawAccession) return;
    const accessionNoDashes = rawAccession.replace(/-/g, '');
    const primaryDocument = Array.isArray(primaryDocuments) && typeof primaryDocuments[index] === 'string'
      ? primaryDocuments[index] as string
      : undefined;
    map.set(rawAccession, {
      documentUrl: primaryDocument
        ? `https://www.sec.gov/Archives/edgar/data/${cikNoLeadingZeros}/${accessionNoDashes}/${primaryDocument}`
        : undefined,
      form: Array.isArray(forms) && typeof forms[index] === 'string' ? forms[index] as string : undefined,
      filingDate: Array.isArray(filingDates) && typeof filingDates[index] === 'string' ? filingDates[index] as string : undefined,
    });
  });
  return map;
};

const sourceForFact = (
  identity: SecTickerRecord,
  fact: NormalizedSecQuarterFact,
  submissionMap: Map<string, { documentUrl?: string; form?: string; filingDate?: string }>,
  retrievedAt: string,
) => {
  const primaryAccession = fact.accessionNumbers[0];
  const filing = primaryAccession ? submissionMap.get(primaryAccession) : undefined;
  return {
    provider: 'SEC EDGAR XBRL',
    documentUrl: filing?.documentUrl,
    documentType: filing?.form ?? fact.form,
    filingDate: filing?.filingDate ?? fact.filed,
    periodEnd: fact.end,
    accessionNumber: primaryAccession,
    retrievedAt,
    entityCik: identity.cik,
  };
};

const buildCanonicalValue = (
  identity: SecTickerRecord,
  spec: MetricSpec,
  period: string,
  entry: { fact: NormalizedSecQuarterFact; concept: string } | undefined,
  submissionMap: Map<string, { documentUrl?: string; form?: string; filingDate?: string }>,
  retrievedAt: string,
): CanonicalFinancialValue => {
  if (!entry) {
    return {
      metric: spec.metric,
      statement: spec.statement,
      value: null,
      unit: spec.canonicalUnit,
      period,
      type: spec.type ?? 'reported',
      verification: 'unverified',
    };
  }

  const { fact, concept } = entry;
  const source = sourceForFact(identity, fact, submissionMap, retrievedAt);
  const sourceAccessions = fact.accessionNumbers.join(', ');
  const derivation = fact.derivation === 'reported_instant'
    ? `SEC us-gaap:${concept} instant fact.`
    : fact.derivation === 'reported_standalone'
      ? `SEC us-gaap:${concept} reported standalone fiscal quarter.`
    : fact.derivation === 'reported_ytd'
      ? `SEC us-gaap:${concept} Q1 duration fact.`
      : fact.derivation === 'derived_ytd_difference'
        ? `Standalone quarter deterministically derived from cumulative SEC us-gaap:${concept} facts; accessions: ${sourceAccessions}.`
        : `Fiscal Q4 deterministically derived as FY minus Q3 YTD from SEC us-gaap:${concept}; accessions: ${sourceAccessions}.`;

  return {
    metric: spec.metric,
    statement: spec.statement,
    value: spec.canonicalUnit === 'USD_M' ? toMillions(fact.value, spec.unit) : fact.value,
    unit: spec.canonicalUnit,
    period,
    periodEnd: fact.end,
    type: fact.derivation === 'reported_instant' || fact.derivation === 'reported_ytd' || fact.derivation === 'reported_standalone' ? (spec.type ?? 'reported') : 'derived',
    verification: 'verified',
    source,
    derivation,
  };
};

const deriveFreeCashFlow = (
  periods: string[],
  values: Record<string, CanonicalFinancialValue[]>,
): CanonicalFinancialValue[] | null => {
  const operating = values['cash_flow.operating_cash_flow'];
  const capex = values['cash_flow.capex'];
  if (!operating || !capex) return null;

  return periods.map((period, index) => {
    const ocf = operating[index];
    const investment = capex[index];
    if (ocf?.value === null || ocf?.value === undefined || investment?.value === null || investment?.value === undefined) {
      return {
        metric: 'free_cash_flow',
        statement: 'cash_flow',
        value: null,
        unit: 'USD_M',
        period,
        type: 'derived',
        verification: 'unverified',
        derivation: 'Requires verified operating cash flow and capital expenditures for the same fiscal quarter.',
      };
    }
    const capexOutflow = Math.abs(investment.value);
    return {
      metric: 'free_cash_flow',
      statement: 'cash_flow',
      value: ocf.value - capexOutflow,
      unit: 'USD_M',
      period,
      periodEnd: ocf.periodEnd ?? investment.periodEnd,
      type: 'derived',
      verification: ocf.verification === 'verified' && investment.verification === 'verified' ? 'verified' : 'unverified',
      source: ocf.source,
      derivation: 'Lumina deterministic FCF = SEC operating cash flow - absolute SEC capital expenditures for the same standalone fiscal quarter.',
    };
  });
};

const deriveTotalDebt = (
  periods: string[],
  values: Record<string, CanonicalFinancialValue[]>,
): CanonicalFinancialValue[] | null => {
  const directTotal = values['balance_sheet.total_debt'];
  const shortDebt = values['balance_sheet.short_term_debt'];
  const longDebt = values['balance_sheet.long_term_debt'];

  if (!directTotal && !shortDebt && !longDebt) return null;

  return periods.map((period, index) => {
    const direct = directTotal?.[index];
    if (direct && direct.value !== null && direct.verification === 'verified') {
      return direct;
    }
    const std = shortDebt?.[index];
    const ltd = longDebt?.[index];
    const hasStd = std?.value !== null && std?.value !== undefined;
    const hasLtd = ltd?.value !== null && ltd?.value !== undefined;
    if (hasStd || hasLtd) {
      const stdVal = hasStd ? (std?.value as number) : 0;
      const ltdVal = hasLtd ? (ltd?.value as number) : 0;
      const isVerified = (!hasStd || std?.verification === 'verified') && (!hasLtd || ltd?.verification === 'verified');
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: stdVal + ltdVal,
        unit: 'USD_M',
        period,
        periodEnd: std?.periodEnd ?? ltd?.periodEnd,
        type: 'derived',
        verification: isVerified ? 'verified' : 'unverified',
        source: std?.source ?? ltd?.source,
        derivation: 'Lumina deterministic total debt = verified SEC short-term debt + verified SEC long-term debt.',
      };
    }
    return direct ?? {
      metric: 'total_debt',
      statement: 'balance_sheet',
      value: null,
      unit: 'USD_M',
      period,
      type: 'derived',
      verification: 'unverified',
      derivation: 'No verified debt facts disclosed for this quarter.',
    };
  });
};

const deriveTotalOperatingLeases = (
  periods: string[],
  values: Record<string, CanonicalFinancialValue[]>,
): CanonicalFinancialValue[] | null => {
  const directTotal = values['balance_sheet.operating_lease_liabilities'];
  const currentLease = values['balance_sheet.operating_lease_liabilities_current'];
  const nonCurrentLease = values['balance_sheet.operating_lease_liabilities_non_current'];

  if (!directTotal && !currentLease && !nonCurrentLease) return null;

  return periods.map((period, index) => {
    const direct = directTotal?.[index];
    if (direct && direct.value !== null && direct.verification === 'verified') {
      return direct;
    }
    const cur = currentLease?.[index];
    const nonCur = nonCurrentLease?.[index];
    const hasCur = cur?.value !== null && cur?.value !== undefined;
    const hasNonCur = nonCur?.value !== null && nonCur?.value !== undefined;
    if (hasCur || hasNonCur) {
      const curVal = hasCur ? (cur?.value as number) : 0;
      const nonCurVal = hasNonCur ? (nonCur?.value as number) : 0;
      const isVerified = (!hasCur || cur?.verification === 'verified') && (!hasNonCur || nonCur?.verification === 'verified');
      return {
        metric: 'operating_lease_liabilities',
        statement: 'balance_sheet',
        value: curVal + nonCurVal,
        unit: 'USD_M',
        period,
        periodEnd: cur?.periodEnd ?? nonCur?.periodEnd,
        type: 'derived',
        verification: isVerified ? 'verified' : 'unverified',
        source: cur?.source ?? nonCur?.source,
        derivation: 'Lumina deterministic total operating lease liabilities = verified current + non-current operating lease liabilities.',
      };
    }
    return direct ?? {
      metric: 'operating_lease_liabilities',
      statement: 'balance_sheet',
      value: null,
      unit: 'USD_M',
      period,
      type: 'derived',
      verification: 'unverified',
      derivation: 'No verified lease liability facts disclosed for this quarter.',
    };
  });
};

/**
 * Maps SEC Company Facts into Lumina's canonical financial model.
 * Values are marked `verified` only because they were independently retrieved from SEC XBRL
 * (or deterministically derived from verified SEC facts), never because an AI supplied a URL.
 */
export function mapSecBundleToCanonicalFinancials(
  bundle: SecCompanyBundleLike,
  options: { maxQuarters?: number } = {},
): CanonicalFinancialDataset | null {
  const namespace = bundle.companyFacts.facts?.['us-gaap'];
  if (!namespace) return null;

  const metricMaps = new Map<string, Map<string, { fact: NormalizedSecQuarterFact; concept: string }>>();
  const quarterKeys = new Set<string>();
  for (const spec of METRIC_SPECS) {
    const mapped = mergeConceptAliases(bundle.companyFacts, spec);
    metricMaps.set(`${spec.statement}.${spec.metric}`, mapped);
    for (const key of mapped.keys()) quarterKeys.add(key);
  }

  const maxQuarters = Math.max(4, Math.min(20, options.maxQuarters ?? 12));
  const selectedKeys = Array.from(quarterKeys).sort(normalizedSort).slice(-maxQuarters);
  if (selectedKeys.length === 0) return null;
  const periods = selectedKeys.map(periodLabel);
  const submissionMap = submissionDocumentMap(bundle.identity, bundle.submissions);
  const values: Record<string, CanonicalFinancialValue[]> = {};

  for (const spec of METRIC_SPECS) {
    const key = `${spec.statement}.${spec.metric}`;
    const mapped = metricMaps.get(key) ?? new Map();
    const series = selectedKeys.map((quarter, index) =>
      buildCanonicalValue(bundle.identity, spec, periods[index], mapped.get(quarter), submissionMap, bundle.retrievedAt));
    if (series.some(item => item.value !== null)) values[key] = series;
  }

  const fcf = deriveFreeCashFlow(periods, values);
  if (fcf?.some(item => item.value !== null)) values['cash_flow.free_cash_flow'] = fcf;

  const derivedDebt = deriveTotalDebt(periods, values);
  if (derivedDebt?.some(item => item.value !== null)) values['balance_sheet.total_debt'] = derivedDebt;

  const derivedLeases = deriveTotalOperatingLeases(periods, values);
  if (derivedLeases?.some(item => item.value !== null)) values['balance_sheet.operating_lease_liabilities'] = derivedLeases;

  const flattened = Object.values(values).flat();
  const nonNullValues = flattened.filter(item => item.value !== null).length;
  const verifiedValues = flattened.filter(item => item.value !== null && item.verification === 'verified').length;
  const missingValues = flattened.length - nonNullValues;

  return {
    schemaVersion: CANONICAL_FINANCIAL_SCHEMA_VERSION,
    generatedBy: `${CANONICAL_FINANCIAL_GENERATOR}+sec-xbrl-v1`,
    ticker: bundle.identity.ticker,
    currency: 'USD',
    periods,
    values,
    provenanceStatus: verifiedValues > 0 && verifiedValues === nonNullValues ? 'verified' : 'unverified',
    provenanceWarnings: [
      {
        code: 'SEC_XBRL_STANDARD_TAXONOMY_SCOPE',
        severity: 'info',
        message: 'Verified values come from SEC companyfacts standard us-gaap entity-wide XBRL facts; custom taxonomy facts are outside this mapper.',
      },
      ...(missingValues > 0 ? [{
        code: 'SEC_METRIC_COVERAGE_PARTIAL',
        severity: 'info' as const,
        message: `${missingValues} canonical period/metric cells are unavailable and remain null.`,
      }] : []),
    ],
    sourceCoverage: {
      sourceLinkedValues: 0,
      verifiedValues,
      nonNullValues,
      missingValues,
      totalValues: flattened.length,
    },
  };
}
