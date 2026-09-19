import type { SecCompanyConcept, SecCompanyFactsResponse } from '../../services/sec/secClient.js';
import {
  normalizeDurationFactsToStandaloneQuarters,
  normalizeInstantFactsToFiscalQuarters,
  type NormalizedSecQuarterFact,
} from '../../services/sec/xbrlNormalizer.js';
import type { FinancialStatementSection, FinancialUnit } from '../financialValue.js';
import {
  DataGapState,
  SourceAuthorityTier,
  type VerifiedFact,
} from './types.js';

export interface ExtensionMetricSpec {
  statement: FinancialStatementSection;
  metric: string;
  concepts: string[];
  unit: string;
  canonicalUnit: FinancialUnit;
  factKind: 'duration' | 'instant';
  sector?: 'banking' | 'reit' | 'insurance' | 'all';
}

export const SECTOR_EXTENSION_SPECS: ExtensionMetricSpec[] = [
  // Banking / FinTech
  {
    statement: 'income_statement',
    metric: 'net_interest_income',
    concepts: ['NetInterestIncome', 'InterestIncomeExpenseNet', 'InterestAndDividendIncomeOperating'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'banking',
  },
  {
    statement: 'income_statement',
    metric: 'non_interest_income',
    concepts: ['NoninterestIncome', 'FeesAndCommissionsOtherThanFromSecuritiesTransactions'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'banking',
  },
  {
    statement: 'income_statement',
    metric: 'provision_for_credit_losses',
    concepts: ['ProvisionForLoanLeaseAndOtherLosses', 'ProvisionForCreditLosses'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'banking',
  },
  {
    statement: 'income_statement',
    metric: 'net_interest_margin_pct',
    concepts: ['NetInterestMargin', 'NetInterestMarginAnnualized', 'NetInterestMarginTaxEquivalent'],
    unit: 'pure',
    canonicalUnit: 'percent',
    factKind: 'duration',
    sector: 'banking',
  },
  {
    statement: 'balance_sheet',
    metric: 'deposits',
    concepts: ['Deposits', 'InterestBearingDepositLiabilities', 'DepositsDomestic', 'TotalDeposits'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'instant',
    sector: 'banking',
  },
  {
    statement: 'balance_sheet',
    metric: 'loans_held_for_investment',
    concepts: [
      'LoansAndLeasesReceivableNetReported',
      'LoansAndLeasesReceivableGrossReported',
      'FinancingReceivableExcludingAccruedInterestAfterAllowanceForCreditLoss',
      'LoansHeldForInvestment',
    ],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'instant',
    sector: 'banking',
  },
  {
    statement: 'balance_sheet',
    metric: 'tier1_capital_ratio',
    concepts: ['Tier1CapitalRatio', 'CommonEquityTier1RiskBasedCapitalRatio', 'CapitalRatioTier1'],
    unit: 'pure',
    canonicalUnit: 'percent',
    factKind: 'instant',
    sector: 'banking',
  },

  // REITs
  {
    statement: 'income_statement',
    metric: 'ffo',
    concepts: ['FundsFromOperations', 'FundsFromOperationsPerDilutedShare'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'reit',
  },
  {
    statement: 'income_statement',
    metric: 'noi',
    concepts: ['NetOperatingIncome'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'reit',
  },
  {
    statement: 'income_statement',
    metric: 'rental_revenue',
    concepts: ['OperatingLeasesIncomeStatementLeaseRevenue', 'RentalIncome'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'reit',
  },

  // Insurance
  {
    statement: 'income_statement',
    metric: 'combined_ratio_pct',
    concepts: ['CombinedRatio', 'CombinedRatioPropertyAndCasualty'],
    unit: 'pure',
    canonicalUnit: 'percent',
    factKind: 'duration',
    sector: 'insurance',
  },
  {
    statement: 'income_statement',
    metric: 'net_premiums_earned',
    concepts: ['PremiumsEarnedNet'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'duration',
    sector: 'insurance',
  },
  {
    statement: 'balance_sheet',
    metric: 'loss_reserve',
    concepts: ['LiabilityForClaimsAndClaimsAdjustmentExpense', 'LossAndLossAdjustmentExpenseReserve'],
    unit: 'USD',
    canonicalUnit: 'USD_M',
    factKind: 'instant',
    sector: 'insurance',
  },
];

/**
 * Searches across all taxonomies (both 'us-gaap' and custom/company-specific extension taxonomies)
 * for a concept by name.
 */
export function findConceptInAllNamespaces(
  facts: SecCompanyFactsResponse,
  conceptName: string
): { concept: SecCompanyConcept; namespace: string } | undefined {
  if (!facts?.facts) return undefined;

  // 1. Check us-gaap first
  if (facts.facts['us-gaap']?.[conceptName]) {
    return { concept: facts.facts['us-gaap'][conceptName], namespace: 'us-gaap' };
  }

  // 2. Check dei
  if (facts.facts['dei']?.[conceptName]) {
    return { concept: facts.facts['dei'][conceptName], namespace: 'dei' };
  }

  // 3. Check custom company taxonomy namespaces (e.g. 'sofi', 'msft', 'aapl')
  for (const [namespace, concepts] of Object.entries(facts.facts)) {
    if (namespace === 'us-gaap' || namespace === 'dei') continue;
    if (concepts?.[conceptName]) {
      return { concept: concepts[conceptName], namespace };
    }
  }

  return undefined;
}

/**
 * Resolves facts from SEC companyfacts across standard and company-specific extension taxonomies.
 */
export function resolveSecExtensionFacts(
  facts: SecCompanyFactsResponse,
  ticker: string,
  specs: ExtensionMetricSpec[] = SECTOR_EXTENSION_SPECS
): Record<string, NormalizedSecQuarterFact[]> {
  const results: Record<string, NormalizedSecQuarterFact[]> = {};

  for (const spec of specs) {
    const key = `${spec.statement}.${spec.metric}`;
    for (const conceptName of spec.concepts) {
      const match = findConceptInAllNamespaces(facts, conceptName);
      if (!match) continue;

      const rawFacts = match.concept.units?.[spec.unit] || match.concept.units?.['pure'] || match.concept.units?.['USD'];
      if (!Array.isArray(rawFacts) || rawFacts.length === 0) continue;

      const normalized = spec.factKind === 'duration'
        ? normalizeDurationFactsToStandaloneQuarters(rawFacts)
        : normalizeInstantFactsToFiscalQuarters(rawFacts);

      if (normalized.length > 0) {
        results[key] = normalized;
        break;
      }
    }
  }

  return results;
}

/**
 * Resolves company-specific and sector-specific XBRL extension concepts directly into VerifiedFacts.
 */
export function resolveSecExtensionConcepts(
  facts: SecCompanyFactsResponse | any,
  archetypeOrSector: string,
  targetDateOrPeriod?: string
): Record<string, VerifiedFact> {
  const results: Record<string, VerifiedFact> = {};
  if (!facts?.facts) return results;

  for (const spec of SECTOR_EXTENSION_SPECS) {
    for (const conceptName of spec.concepts) {
      const match = findConceptInAllNamespaces(facts, conceptName);
      if (!match) continue;

      const units = match.concept.units;
      if (!units) continue;

      const unitKey = Object.keys(units)[0];
      const items = units[unitKey];
      if (!Array.isArray(items) || items.length === 0) continue;

      const item = targetDateOrPeriod
        ? items.find((i: any) => i.end === targetDateOrPeriod || i.fp === targetDateOrPeriod) || items[items.length - 1]
        : items[items.length - 1];

      if (item && typeof item.val === 'number') {
        let val = item.val;
        let unit: string = spec.canonicalUnit;

        if (spec.canonicalUnit === 'USD_M' && (unitKey === 'USD' || val > 1_000_000)) {
          val = val / 1_000_000;
        } else if (spec.canonicalUnit === 'percent' && (unitKey === 'pure' || val < 1)) {
          val = Math.round(val * 10000) / 100;
        }

        results[spec.metric] = {
          metricKey: spec.metric,
          value: val,
          unit,
          fiscalPeriod: item.fp ? `${item.fy || ''}-${item.fp}` : targetDateOrPeriod || 'Latest',
          periodEnd: item.end,
          periodType: spec.factKind === 'instant' ? 'POINT_IN_TIME' : 'DURATION_QUARTER',
          sourceType: 'SEC_FILING_TABLE',
          sourceTier: SourceAuthorityTier.TIER_1_SEC_REGULATOR,
          sourceDocument: `SEC XBRL Concept: ${match.namespace}:${conceptName}`,
          extractionMethod: 'XBRL_EXTENSION',
          reportedOrDerived: 'REPORTED',
          verificationStatus: DataGapState.VERIFIED_AVAILABLE,
          confidence: 1.0,
          issuerIdentity: String(facts.cik || facts.entityName || 'SEC_ISSUER'),
        };
        break;
      }
    }
  }

  return results;
}
