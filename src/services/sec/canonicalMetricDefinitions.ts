import type { FinancialStatementSection, FinancialUnit, FinancialValueType } from '../../domain/financialValue';

export type MetricSpec = {
  statement: FinancialStatementSection;
  metric: string;
  concepts: string[];
  unit: string;
  canonicalUnit: FinancialUnit;
  factKind: 'duration' | 'instant';
  type?: FinancialValueType;
};

export type CanonicalMappingKind = 'STANDARD_EXACT' | 'STANDARD_ALIAS' | 'ISSUER_EXTENSION_VERIFIED' | 'DERIVED' | 'UNRESOLVED';
export interface CanonicalMetricDefinition extends MetricSpec {
  key: string;
  standardConceptFamilies: string[];
  acceptedAliases: string[];
  dimensionalPolicy: 'CONSOLIDATED_ONLY';
  periodPolicy: 'EXACT_INSTANT' | 'VERIFIED_STANDALONE_QUARTER';
  aggregationPolicy: 'NEVER_SUM' | 'FOUR_COMPATIBLE_QUARTERS' | 'NON_ADDITIVE';
  issuerExtensionPolicy: 'EXACT_PRIMARY_STATEMENT_ROW_WITH_ENTITY_UNIT_PERIOD_EVIDENCE';
  derivationPolicy: 'EXPLICIT_VERIFIED_COMPONENTS_ONLY';
  archetypeApplicability: readonly string[] | 'ALL';
}

export const METRIC_SPECS: MetricSpec[] = [
  { statement: 'balance_sheet', metric: 'cash_and_restricted_cash', concepts: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'cash_and_restricted_cash_including_disposal_group', concepts: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'income_statement', metric: 'net_income_common', concepts: ['NetIncomeLossAvailableToCommonStockholdersBasic'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_income_parent', concepts: ['NetIncomeLoss'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'cogs', concepts: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'research_and_development', concepts: ['ResearchAndDevelopmentExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  // A scoped expense is disclosed separately; it cannot silently become total R&D.
  { statement: 'income_statement', metric: 'research_and_development_excluding_acquired', concepts: ['ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost', 'ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'selling_and_marketing', concepts: ['SellingAndMarketingExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'general_and_administrative', concepts: ['GeneralAndAdministrativeExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'selling_general_administrative', concepts: ['SellingGeneralAndAdministrativeExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'operating_expenses', concepts: ['OperatingExpenses'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'interest_income', concepts: ['InterestIncomeNonoperating', 'InvestmentIncomeInterest'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'other_income', concepts: ['OtherNonoperatingIncomeExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'balance_sheet', metric: 'stockholders_equity', concepts: ['StockholdersEquity'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'preferred_equity', concepts: ['PreferredStockValueOutstanding', 'PreferredStockIncludingAdditionalPaidInCapitalNetOfDiscount', 'PreferredStockValue'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'noncontrolling_interest', concepts: ['MinorityInterest'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'redeemable_noncontrolling_interest', concepts: ['RedeemableNoncontrollingInterestEquityCarryingAmount'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'additional_paid_in_capital', concepts: ['AdditionalPaidInCapital', 'AdditionalPaidInCapitalCommonStock'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'aoci', concepts: ['AccumulatedOtherComprehensiveIncomeLossNetOfTax'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'prepaid_and_other_current_assets', concepts: ['PrepaidExpenseAndOtherAssetsCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'accrued_and_other_current_liabilities', concepts: ['AccruedLiabilitiesCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'current_deferred_liabilities', concepts: ['DeferredRevenueCurrent', 'ContractWithCustomerLiabilityCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'cash_flow', metric: 'investing_cash_flow', concepts: ['NetCashProvidedByUsedInInvestingActivities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'financing_cash_flow', concepts: ['NetCashProvidedByUsedInFinancingActivities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'option_exercise_proceeds', concepts: ['ProceedsFromStockOptionsExercised'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'exchange_rate_effect', concepts: ['EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'net_change_cash', concepts: ['CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'change_receivables', concepts: ['IncreaseDecreaseInAccountsReceivable'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'change_inventory', concepts: ['IncreaseDecreaseInInventories'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'change_payables', concepts: ['IncreaseDecreaseInAccountsPayable'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  // Total revenue can include insurance/investment income outside customer
  // contracts. A contract-revenue subtotal must not outrank a reported total.
  { statement: 'income_statement', metric: 'revenue', concepts: ['RevenuesNetOfInterestExpense', 'Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'gross_profit', concepts: ['GrossProfit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'operating_income', concepts: ['OperatingIncomeLoss'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'interest_expense', concepts: ['InterestExpense', 'InterestExpenseNonoperating', 'InterestExpenseDebt', 'InterestExpenseDebtExcludingAmortization', 'InterestAndDebtExpense'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'income_before_tax', concepts: ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'income_tax_expense', concepts: ['IncomeTaxExpenseBenefit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_income', concepts: ['ProfitLoss'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'eps_diluted', concepts: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'], unit: 'USD/shares', canonicalUnit: 'per_share', factKind: 'duration' },

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
  { statement: 'balance_sheet', metric: 'short_term_debt', concepts: ['DebtCurrent', 'ShortTermBorrowings', 'CommercialPaper', 'LongTermDebtCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'long_term_debt', concepts: ['LongTermDebtNoncurrent', 'LongTermDebt'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'finance_lease_liabilities_current', concepts: ['FinanceLeaseLiabilityCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'finance_lease_liabilities_non_current', concepts: ['FinanceLeaseLiabilityNoncurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_debt', concepts: ['DebtAndFinanceLeaseObligations'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'long_term_debt_and_finance_leases', concepts: ['LongTermDebtAndCapitalLeaseObligations', 'LongTermDebtAndFinanceLeaseObligations'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_rou_assets', concepts: ['OperatingLeaseRightOfUseAsset'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities_current', concepts: ['OperatingLeaseLiabilityCurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities_non_current', concepts: ['OperatingLeaseLiabilityNoncurrent'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'operating_lease_liabilities', concepts: ['OperatingLeaseLiability'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'total_equity', concepts: ['StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'common_stock', concepts: ['CommonStockValue'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'retained_earnings', concepts: ['RetainedEarningsAccumulatedDeficit'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },

  { statement: 'cash_flow', metric: 'operating_cash_flow', concepts: ['NetCashProvidedByUsedInOperatingActivities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'depreciation', concepts: ['DepreciationDepletionAndAmortization', 'DepreciationAndAmortization'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'depreciation_amortization_and_accretion', concepts: ['DepreciationAmortizationAndAccretionNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'depreciation_amortization_and_impairment', concepts: ['DepreciationAmortizationAndImpairment'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'depreciation_expense', concepts: ['Depreciation'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'amortization_of_intangibles', concepts: ['AmortizationOfIntangibleAssets'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'stock_based_compensation', concepts: ['AllocatedShareBasedCompensationExpense', 'ShareBasedCompensation'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  // PaymentsToAcquireProductiveAssets is an SEC standard-taxonomy capex concept that includes
  // purchases/capital improvements of PPE, software and other productive intangible assets.
  // It is a fallback only for fiscal periods where the narrower PPE concept is unavailable.
  { statement: 'cash_flow', metric: 'capex', concepts: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'dividends_paid', concepts: ['PaymentsOfDividends', 'PaymentsOfDividendsCommonStock'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'dividends_common', concepts: ['PaymentsOfDividendsCommonStock'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'acquisitions', concepts: ['PaymentsToAcquireBusinessesNetOfCashAcquired'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'repurchase_of_common_stock', concepts: ['PaymentsForRepurchaseOfCommonStock', 'PaymentsForRepurchaseOfEquity', 'PaymentsForRepurchaseOfInitialPublicOfferingShares'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'issuance_of_common_stock', concepts: ['ProceedsFromIssuanceOfCommonStock'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'equity_issuance_proceeds', concepts: ['ProceedsFromIssuanceOrSaleOfEquity', 'ProceedsFromStockIssuance', 'ProceedsFromIssuanceOfShares'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'debt_issuance', concepts: ['ProceedsFromIssuanceOfDebt', 'ProceedsFromIssuanceOfLongTermDebt'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'debt_repayments', concepts: ['RepaymentsOfDebt', 'RepaymentsOfLongTermDebt'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'finance_lease_payments', concepts: ['FinanceLeasePrincipalPayments', 'PaymentsOfCapitalLeaseObligations'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'equity_compensation_and_option_proceeds', concepts: ['ProceedsFromIssuanceOfSharesUnderIncentiveAndShareBasedCompensationPlansIncludingStockOptions'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'distributions_to_noncontrolling_interests', concepts: ['PaymentsToMinorityShareholders'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'dividends_to_noncontrolling_interests', concepts: ['PaymentsOfDividendsMinorityInterest'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'distributions_to_noncontrolling_and_redeemable_interests', concepts: ['PaymentsToNoncontrollingAndRedeemableInterests'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'cash_flow', metric: 'other_financing', concepts: ['ProceedsFromPaymentsForOtherFinancingActivities'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },

  // Banking / FinTech
  { statement: 'income_statement', metric: 'net_interest_income', concepts: ['NetInterestIncome', 'InterestIncomeExpenseNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'non_interest_income', concepts: ['NoninterestIncome', 'FeesAndCommissionsOtherThanFromSecuritiesTransactions'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'provision_for_credit_losses', concepts: ['ProvisionForLoanLeaseAndOtherLosses', 'ProvisionForCreditLosses'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_interest_margin_pct', concepts: ['NetInterestMargin', 'NetInterestMarginAnnualized'], unit: 'pure', canonicalUnit: 'percent', factKind: 'duration' },
  { statement: 'balance_sheet', metric: 'deposits', concepts: ['Deposits'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'loans_held_for_investment', concepts: ['LoansAndLeasesReceivableNetReported', 'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss', 'LoansHeldForInvestment'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'tier1_capital_ratio', concepts: ['Tier1CapitalRatio', 'CapitalRatioTier1'], unit: 'pure', canonicalUnit: 'percent', factKind: 'instant' },
  { statement: 'balance_sheet', metric: 'cet1_ratio', concepts: ['CommonEquityTier1RiskBasedCapitalRatio'], unit: 'pure', canonicalUnit: 'percent', factKind: 'instant' },

  // REITs
  { statement: 'income_statement', metric: 'ffo', concepts: ['FundsFromOperations'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'noi', concepts: ['NetOperatingIncome'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'income_statement', metric: 'rental_revenue', concepts: ['OperatingLeasesIncomeStatementLeaseRevenue', 'RentalIncome'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },

  // Insurance
  { statement: 'income_statement', metric: 'combined_ratio_pct', concepts: ['CombinedRatio', 'CombinedRatioPropertyAndCasualty'], unit: 'pure', canonicalUnit: 'percent', factKind: 'duration' },
  { statement: 'income_statement', metric: 'net_premiums_earned', concepts: ['PremiumsEarnedNet'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'duration' },
  { statement: 'balance_sheet', metric: 'loss_reserve', concepts: ['LiabilityForClaimsAndClaimsAdjustmentExpense', 'LossAndLossAdjustmentExpenseReserve'], unit: 'USD', canonicalUnit: 'USD_M', factKind: 'instant' },
];

/** One controlled semantic registry, shared by candidate mapping and diagnostics.
 * Family membership is reviewed here; a label substring never adds membership.
 * Parent/common/total earnings, restricted cash, debt and leases stay separate.
 */
export const CANONICAL_METRIC_DEFINITIONS: CanonicalMetricDefinition[] = METRIC_SPECS.map(spec => ({
  ...spec, key: `${spec.statement}.${spec.metric}`,
  standardConceptFamilies: spec.concepts.slice(0,1), acceptedAliases: spec.concepts.slice(1),
  dimensionalPolicy: 'CONSOLIDATED_ONLY',
  periodPolicy: spec.factKind === 'instant' ? 'EXACT_INSTANT' : 'VERIFIED_STANDALONE_QUARTER',
  aggregationPolicy: spec.factKind === 'instant' ? 'NEVER_SUM' : spec.canonicalUnit === 'USD_M' ? 'FOUR_COMPATIBLE_QUARTERS' : 'NON_ADDITIVE',
  issuerExtensionPolicy: 'EXACT_PRIMARY_STATEMENT_ROW_WITH_ENTITY_UNIT_PERIOD_EVIDENCE',
  derivationPolicy: 'EXPLICIT_VERIFIED_COMPONENTS_ONLY',
  archetypeApplicability: ['net_interest_income','non_interest_income','net_interest_margin_pct','deposits','loans_held_for_investment','tier1_capital_ratio','cet1_ratio','provision_for_credit_losses'].includes(spec.metric)
    ? ['banking','bank','lender','fintech'] : ['ffo','noi','rental_revenue'].includes(spec.metric)
      ? ['reit'] : ['combined_ratio_pct','net_premiums_earned','loss_reserve'].includes(spec.metric) ? ['insurance','insurer'] : 'ALL',
}));


/** Exact reviewed row definitions for generic primary-statement extensions. */
export const PRIMARY_STATEMENT_LABELS: Array<{metric:string; pattern:RegExp}> = [
  {metric:'revenue',pattern:/^(?:Total revenues|Revenues|Net revenues|Net sales)$/i},
  {metric:'cogs',pattern:/^(?:Cost of revenues|Cost of revenue|Cost of goods sold|Cost of sales)$/i},
  {metric:'gross_profit',pattern:/^Gross profit$/i},
  {metric:'operating_income',pattern:/^(?:Operating income|Income from operations|Operating (?:income \(loss\)|loss))$/i},
  {metric:'income_before_tax',pattern:/^Income (?:before income taxes|before provision for income taxes)$/i},
  {metric:'income_tax_expense',pattern:/^(?:Provision for income taxes|Income tax expense)$/i},
  {metric:'cash_and_equivalents',pattern:/^Cash and cash equivalents$/i},
  {metric:'short_term_investments',pattern:/^(?:Short.term investments|Marketable securities|Marketable debt securities)$/i},
  {metric:'total_assets',pattern:/^Total assets$/i},
  {metric:'total_liabilities',pattern:/^Total liabilities$/i},
  // Consolidated total deficit is the negative total-equity presentation. It
  // may include other disclosed equity components besides parent equity/NCI.
  {metric:'total_equity',pattern:/^Total (?:equity|deficit|shareholders[’']? equity and non.controlling interests|stockholders[’']? equity including non.controlling interests)$/i},
  {metric:'stockholders_equity',pattern:/^Total (?:stockholders|shareholders)[’']? equity$/i},
  {metric:'operating_cash_flow',pattern:/^Net cash (?:provided by|used in) operating activities$/i},
  {metric:'capex',pattern:/^(?:Purchases of|Payments to acquire) property(?:,? plant)? and equipment$/i},
  {metric:'net_ppe',pattern:/^(?:Property,? plant (?:and|&) equipment|Property and equipment),? net$/i},
  {metric:'depreciation',pattern:/^Depreciation,? (?:depletion,? )?(?:and|&) amortization(?: expense)?$/i},
  {metric:'depreciation_amortization_and_impairment',pattern:/^Depreciation,? amortization and impairment$/i},
  {metric:'depreciation_amortization_and_accretion',pattern:/^Depreciation,? amortization and accretion(?:,? net)?$/i},
  {metric:'debt_issuance',pattern:/^Proceeds from (?:issuance of )?(?:long.term )?debt$/i},
  {metric:'debt_repayments',pattern:/^(?:Repayments|Payments) of (?:long.term )?debt$/i},
  {metric:'finance_lease_payments',pattern:/^(?:Repayments|Payments) of (?:finance|capital) leases?(?: (?:obligations|principal))?$/i},
  {metric:'issuance_of_common_stock',pattern:/^Proceeds from (?:the )?(?:issuance|sale) of common stock$/i},
  {metric:'distributions_to_noncontrolling_interests',pattern:/^(?:Distributions|Payments) to noncontrolling interests$/i},
  {metric:'distributions_to_noncontrolling_and_redeemable_interests',pattern:/^(?:Distributions|Payments) to noncontrolling interests and redeemable noncontrolling interests$/i},
  {metric:'other_financing',pattern:/^Other (?:financing activities|financing),? net$/i},
];
