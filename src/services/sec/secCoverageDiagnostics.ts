import type { SecCompanyConcept, SecCompanyFact } from './secClient';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import { normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from './xbrlNormalizer';

export type SecCoverageDiagnosticGroup = 'debt' | 'investments' | 'cash_flow';

export interface SecConceptCoverageDiagnostic {
  group: SecCoverageDiagnosticGroup;
  concept: string;
  present: boolean;
  label?: string;
  units: string[];
  rawFactCount: number;
  normalizedQuarterCount: number;
  latestEnd?: string;
  latestFiled?: string;
  latestForm?: string;
}

export interface SecCoverageDiagnostics {
  debt: SecConceptCoverageDiagnostic[];
  investments: SecConceptCoverageDiagnostic[];
  cash_flow: SecConceptCoverageDiagnostic[];
}

type Candidate = {
  group: SecCoverageDiagnosticGroup;
  concept: string;
  factKind: 'instant' | 'duration';
  preferredUnit: string;
};

/**
 * Whitelisted standard-taxonomy candidates used only to diagnose missing SEC coverage.
 * Presence here never authorizes a metric for valuation; resolver/mapper code still has to
 * explicitly define non-overlap and accounting semantics before a concept can be promoted.
 */
const CANDIDATES: Candidate[] = [
  // Debt aggregates/components. Some issuers use LongTermDebtCurrent instead of DebtCurrent.
  { group: 'debt', concept: 'DebtAndFinanceLeaseObligations', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtAndFinanceLeaseObligations', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtAndCapitalLeaseObligations', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtAndFinanceLeaseObligationsCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtAndFinanceLeaseObligationsNoncurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'DebtCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebtNoncurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'LongTermDebt', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'ShortTermBorrowings', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'CommercialPaper', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'FinanceLeaseLiabilityCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'FinanceLeaseLiabilityNoncurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'OperatingLeaseLiabilityCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'OperatingLeaseLiabilityNoncurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'OperatingLeaseLiability', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'debt', concept: 'OperatingLeaseRightOfUseAsset', factKind: 'instant', preferredUnit: 'USD' },

  // Liquid/marketable investments. Diagnostics only until accounting semantics are explicit.
  { group: 'investments', concept: 'ShortTermInvestments', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'MarketableSecuritiesCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'CashCashEquivalentsAndShortTermInvestments', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'AvailableForSaleSecuritiesDebtSecuritiesCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'AvailableForSaleSecuritiesDebtSecurities', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'DebtSecuritiesAvailableForSaleCurrent', factKind: 'instant', preferredUnit: 'USD' },
  { group: 'investments', concept: 'MarketableSecurities', factKind: 'instant', preferredUnit: 'USD' },

  // FCF prerequisites. Alternative capex concepts are diagnostic only until validated.
  { group: 'cash_flow', concept: 'NetCashProvidedByUsedInOperatingActivities', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'PaymentsToAcquirePropertyPlantAndEquipment', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'PaymentsToAcquireProductiveAssets', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'ShareBasedCompensation', factKind: 'duration', preferredUnit: 'USD' },
  { group: 'cash_flow', concept: 'AllocatedShareBasedCompensationExpense', factKind: 'duration', preferredUnit: 'USD' },
];

const dateRank = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : 0;
};

const latestFact = (facts: SecCompanyFact[]) => [...facts]
  .filter(fact => typeof fact?.val === 'number' && Number.isFinite(fact.val))
  .sort((a, b) => dateRank(b.end) - dateRank(a.end) || dateRank(b.filed) - dateRank(a.filed))[0];

const conceptFor = (bundle: SecCompanyBundleLike, concept: string): SecCompanyConcept | undefined =>
  bundle.companyFacts.facts?.['us-gaap']?.[concept];

const diagnosticFor = (bundle: SecCompanyBundleLike, candidate: Candidate): SecConceptCoverageDiagnostic => {
  const concept = conceptFor(bundle, candidate.concept);
  const units = concept?.units ? Object.keys(concept.units) : [];
  const facts = concept?.units?.[candidate.preferredUnit] ?? [];
  const normalized = candidate.factKind === 'instant'
    ? normalizeInstantFactsToFiscalQuarters(facts)
    : normalizeDurationFactsToStandaloneQuarters(facts);
  const latest = latestFact(facts);

  return {
    group: candidate.group,
    concept: candidate.concept,
    present: facts.length > 0,
    label: concept?.label,
    units,
    rawFactCount: facts.length,
    normalizedQuarterCount: normalized.length,
    latestEnd: latest?.end,
    latestFiled: latest?.filed,
    latestForm: latest?.form,
  };
};

export function buildSecCoverageDiagnostics(bundle: SecCompanyBundleLike): SecCoverageDiagnostics {
  const all = CANDIDATES.map(candidate => diagnosticFor(bundle, candidate));
  return {
    debt: all.filter(item => item.group === 'debt'),
    investments: all.filter(item => item.group === 'investments'),
    cash_flow: all.filter(item => item.group === 'cash_flow'),
  };
}
