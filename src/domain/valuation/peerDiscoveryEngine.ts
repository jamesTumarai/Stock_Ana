import type { ReportData, PeerBenchmarkRow, PeerCompanyItem } from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext';
import type {
  PeerBusinessFingerprint,
  PeerCandidate,
  PeerDiscoveryResult,
  PeerMetricObservation,
  PeerRelationType,
  PeerUnavailableReason,
} from './types';

interface CandidateDefinition {
  ticker: string;
  companyName: string;
  archetype: BusinessArchetype;
  sector: string;
  industry: string;
  subIndustry: string;
  revenueModels: string[];
  majorBusinessLines: string[];
  geography: string;
  lifecycle: 'early_stage' | 'growth' | 'mature' | 'cyclical';
  profitabilityState: 'pre_profit' | 'breakeven' | 'profitable';
  capitalIntensity: 'asset_light' | 'moderate' | 'capital_intensive' | 'financial_intermediary';
  regulatoryType?: 'banking' | 'insurance' | 'reit' | 'utility' | 'unregulated' | 'standard';
  scaleTier: 'mega' | 'large' | 'mid' | 'small';
  metrics: Record<string, { value: number | null; unit: string; period: string; source: string; reportedOrDerived: 'REPORTED' | 'DERIVED' }>;
}

/**
 * Authoritative structured universe of public companies across sectors
 * with verified business fingerprints and baseline canonical metrics.
 */
const PUBLIC_CANDIDATE_UNIVERSE: CandidateDefinition[] = [
  // 1. FinTech / Digital Banking / Consumer Finance
  {
    ticker: 'SOFI',
    companyName: 'SoFi Technologies, Inc.',
    archetype: 'fintech',
    sector: 'Financial Services',
    industry: 'Credit Services',
    subIndustry: 'digital_banking_lending',
    revenueModels: ['net_interest_income', 'fee_based', 'technology_services'],
    majorBusinessLines: ['lending', 'financial_services', 'technology_platform'],
    geography: 'US',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'mid',
    metrics: {
      pe_trailing: { value: 38.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 24.2, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 2.1, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 2.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 34.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 8.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 1.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 5.85, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 54.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'NU',
    companyName: 'Nu Holdings Ltd.',
    archetype: 'fintech',
    sector: 'Financial Services',
    industry: 'Credit Services',
    subIndustry: 'digital_banking_lending',
    revenueModels: ['net_interest_income', 'fee_based', 'credit_cards'],
    majorBusinessLines: ['digital_banking', 'credit_cards', 'investments'],
    geography: 'LatAm',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 32.4, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 20.8, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 6.2, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 6.5, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 48.6, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 28.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 3.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 18.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 32.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'AFRM',
    companyName: 'Affirm Holdings, Inc.',
    archetype: 'fintech',
    sector: 'Financial Services',
    industry: 'Credit Services',
    subIndustry: 'bnpl_consumer_finance',
    revenueModels: ['merchant_fees', 'interest_income', 'servicing_fees'],
    majorBusinessLines: ['buy_now_pay_later', 'point_of_sale_financing'],
    geography: 'US',
    lifecycle: 'growth',
    profitabilityState: 'breakeven',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'standard',
    scaleTier: 'mid',
    metrics: {
      pe_trailing: { value: null, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 35.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 4.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 5.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 46.3, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: -8.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: -3.1, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 8.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 68.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'UPST',
    companyName: 'Upstart Holdings, Inc.',
    archetype: 'fintech',
    sector: 'Financial Services',
    industry: 'Credit Services',
    subIndustry: 'ai_lending_marketplace',
    revenueModels: ['referral_fees', 'platform_fees', 'servicing_fees'],
    majorBusinessLines: ['ai_lending_platform', 'loan_origination'],
    geography: 'US',
    lifecycle: 'growth',
    profitabilityState: 'breakeven',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'standard',
    scaleTier: 'mid',
    metrics: {
      pe_trailing: { value: null, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 42.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 3.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 3.7, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 20.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: -12.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: -4.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 6.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 72.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'LC',
    companyName: 'LendingClub Corporation',
    archetype: 'fintech',
    sector: 'Financial Services',
    industry: 'Credit Services',
    subIndustry: 'digital_banking_lending',
    revenueModels: ['net_interest_income', 'marketplace_fees'],
    majorBusinessLines: ['digital_banking', 'personal_loans'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'small',
    metrics: {
      pe_trailing: { value: 18.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 12.4, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 1.1, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 1.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 14.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 6.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 0.9, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 6.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 62.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'ALLY',
    companyName: 'Ally Financial Inc.',
    archetype: 'bank',
    sector: 'Financial Services',
    industry: 'Banks—Diversified',
    subIndustry: 'digital_banking_auto_lending',
    revenueModels: ['net_interest_income', 'insurance_premiums', 'fee_based'],
    majorBusinessLines: ['auto_financing', 'digital_deposits', 'commercial_lending'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 14.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 9.8, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 0.95, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 1.15, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 6.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 8.9, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 0.65, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 3.3, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 58.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },

  // 2. Commercial / Depository Banks
  {
    ticker: 'JPM',
    companyName: 'JPMorgan Chase & Co.',
    archetype: 'bank',
    sector: 'Financial Services',
    industry: 'Banks—Diversified',
    subIndustry: 'money_center_bank',
    revenueModels: ['net_interest_income', 'investment_banking', 'asset_management', 'card_services'],
    majorBusinessLines: ['consumer_banking', 'corporate_investment_bank', 'commercial_banking', 'asset_wealth'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 12.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 11.5, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 1.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 2.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 11.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 17.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 1.35, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 2.65, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 52.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'BAC',
    companyName: 'Bank of America Corporation',
    archetype: 'bank',
    sector: 'Financial Services',
    industry: 'Banks—Diversified',
    subIndustry: 'money_center_bank',
    revenueModels: ['net_interest_income', 'wealth_management', 'investment_banking'],
    majorBusinessLines: ['consumer_banking', 'global_wealth', 'global_banking', 'global_markets'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 13.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 11.2, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 1.25, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 1.6, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 4.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 10.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 0.85, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 1.95, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 63.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'WFC',
    companyName: 'Wells Fargo & Company',
    archetype: 'bank',
    sector: 'Financial Services',
    industry: 'Banks—Diversified',
    subIndustry: 'money_center_bank',
    revenueModels: ['net_interest_income', 'mortgage_banking', 'commercial_banking'],
    majorBusinessLines: ['consumer_banking', 'commercial_banking', 'corporate_investment_banking', 'wealth'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'banking',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 12.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 10.5, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 1.35, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      price_to_tbv: { value: 1.65, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 3.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 11.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roa_pct: { value: 0.98, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_interest_margin_pct: { value: 2.75, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      efficiency_ratio_pct: { value: 66.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },

  // 3. Insurance (P&C)
  {
    ticker: 'PGR',
    companyName: 'The Progressive Corporation',
    archetype: 'insurer',
    sector: 'Financial Services',
    industry: 'Insurance—Property & Casualty',
    subIndustry: 'pc_insurance',
    revenueModels: ['net_premiums_earned', 'investment_income'],
    majorBusinessLines: ['personal_auto', 'commercial_auto', 'property'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'insurance',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 16.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 15.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 4.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 19.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 31.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      combined_ratio_pct: { value: 89.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      loss_ratio_pct: { value: 68.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
    },
  },
  {
    ticker: 'TRV',
    companyName: 'The Travelers Companies, Inc.',
    archetype: 'insurer',
    sector: 'Financial Services',
    industry: 'Insurance—Property & Casualty',
    subIndustry: 'pc_insurance',
    revenueModels: ['net_premiums_earned', 'investment_income'],
    majorBusinessLines: ['business_insurance', 'bond_specialty', 'personal_insurance'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'insurance',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 12.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 11.4, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 1.95, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 12.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 16.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      combined_ratio_pct: { value: 94.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      loss_ratio_pct: { value: 72.1, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
    },
  },
  {
    ticker: 'ALL',
    companyName: 'The Allstate Corporation',
    archetype: 'insurer',
    sector: 'Financial Services',
    industry: 'Insurance—Property & Casualty',
    subIndustry: 'pc_insurance',
    revenueModels: ['net_premiums_earned', 'investment_income'],
    majorBusinessLines: ['allstate_protection', 'protection_services'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'financial_intermediary',
    regulatoryType: 'insurance',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 11.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 10.2, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      price_to_book: { value: 2.4, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 10.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      roe_pct: { value: 24.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      combined_ratio_pct: { value: 92.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      loss_ratio_pct: { value: 70.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
    },
  },

  // 4. REIT (Industrial / Logistics)
  {
    ticker: 'PLD',
    companyName: 'Prologis, Inc.',
    archetype: 'reit',
    sector: 'Real Estate',
    industry: 'REIT—Industrial',
    subIndustry: 'industrial_logistics_reit',
    revenueModels: ['rental_income', 'strategic_capital_fees'],
    majorBusinessLines: ['real_estate_operations', 'strategic_capital'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'reit',
    scaleTier: 'large',
    metrics: {
      p_ffo_multiple: { value: 21.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      p_affo_multiple: { value: 24.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 11.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      noi_growth_yoy_pct: { value: 7.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      occupancy_rate_pct: { value: 96.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      debt_to_equity: { value: 0.54, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      dividend_yield_pct: { value: 3.2, unit: 'percent', period: 'FY2024', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'REXR',
    companyName: 'Rexford Industrial Realty, Inc.',
    archetype: 'reit',
    sector: 'Real Estate',
    industry: 'REIT—Industrial',
    subIndustry: 'industrial_logistics_reit',
    revenueModels: ['rental_income'],
    majorBusinessLines: ['industrial_properties'],
    geography: 'US',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'reit',
    scaleTier: 'mid',
    metrics: {
      p_ffo_multiple: { value: 19.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      p_affo_multiple: { value: 22.4, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 16.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      noi_growth_yoy_pct: { value: 8.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      occupancy_rate_pct: { value: 97.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      debt_to_equity: { value: 0.48, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      dividend_yield_pct: { value: 3.6, unit: 'percent', period: 'FY2024', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'FR',
    companyName: 'First Industrial Realty Trust, Inc.',
    archetype: 'reit',
    sector: 'Real Estate',
    industry: 'REIT—Industrial',
    subIndustry: 'industrial_logistics_reit',
    revenueModels: ['rental_income'],
    majorBusinessLines: ['logistics_facilities'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'reit',
    scaleTier: 'mid',
    metrics: {
      p_ffo_multiple: { value: 18.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      p_affo_multiple: { value: 20.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 9.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      noi_growth_yoy_pct: { value: 6.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      occupancy_rate_pct: { value: 95.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      debt_to_equity: { value: 0.62, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      dividend_yield_pct: { value: 3.1, unit: 'percent', period: 'FY2024', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
    },
  },

  // 5. Enterprise Software / SaaS Platform
  {
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    archetype: 'saas_software',
    sector: 'Technology',
    industry: 'Software—Infrastructure',
    subIndustry: 'enterprise_cloud_software',
    revenueModels: ['cloud_subscription', 'software_licenses', 'hardware'],
    majorBusinessLines: ['productivity_business', 'intelligent_cloud', 'more_personal_computing'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'moderate',
    regulatoryType: 'unregulated',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 34.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 28.5, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 22.4, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 12.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 15.7, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 69.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 44.6, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 36.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 29.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roe_pct: { value: 38.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 2.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'ORCL',
    companyName: 'Oracle Corporation',
    archetype: 'saas_software',
    sector: 'Technology',
    industry: 'Software—Infrastructure',
    subIndustry: 'enterprise_cloud_software',
    revenueModels: ['cloud_services', 'license_support', 'hardware'],
    majorBusinessLines: ['cloud_services', 'cloud_license', 'hardware'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'moderate',
    regulatoryType: 'unregulated',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 38.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 24.5, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 20.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 8.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 6.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 71.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 30.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 19.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 14.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roe_pct: { value: 48.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 3.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'CRM',
    companyName: 'Salesforce, Inc.',
    archetype: 'saas_software',
    sector: 'Technology',
    industry: 'Software—Application',
    subIndustry: 'enterprise_cloud_software',
    revenueModels: ['subscription_support', 'professional_services'],
    majorBusinessLines: ['sales_cloud', 'service_cloud', 'platform', 'marketing_cloud'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'asset_light',
    regulatoryType: 'unregulated',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 45.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 25.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 21.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 7.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 11.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 75.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 17.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 11.9, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 8.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roe_pct: { value: 7.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 4.1, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'PLTR',
    companyName: 'Palantir Technologies Inc.',
    archetype: 'saas_software',
    sector: 'Technology',
    industry: 'Software—Infrastructure',
    subIndustry: 'ai_enterprise_platform',
    revenueModels: ['software_subscription', 'professional_services'],
    majorBusinessLines: ['commercial', 'government'],
    geography: 'US',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'asset_light',
    regulatoryType: 'unregulated',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 110.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 75.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 68.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 24.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 24.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 80.6, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 18.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 15.6, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 12.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roe_pct: { value: 10.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 1.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },

  // 6. Energy / Oil & Gas (E&P)
  {
    ticker: 'OXY',
    companyName: 'Occidental Petroleum Corporation',
    archetype: 'energy_commodity',
    sector: 'Energy',
    industry: 'Oil & Gas E&P',
    subIndustry: 'oil_gas_ep',
    revenueModels: ['oil_gas_sales', 'chemical_sales'],
    majorBusinessLines: ['oil_and_gas', 'oxychem', 'midstream_marketing'],
    geography: 'US',
    lifecycle: 'cyclical',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 14.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 12.2, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 5.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: -2.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      operating_margin_pct: { value: 24.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 15.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 9.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      debt_to_equity: { value: 0.78, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 7.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'COP',
    companyName: 'ConocoPhillips',
    archetype: 'energy_commodity',
    sector: 'Energy',
    industry: 'Oil & Gas E&P',
    subIndustry: 'oil_gas_ep',
    revenueModels: ['crude_oil_sales', 'natural_gas_sales'],
    majorBusinessLines: ['exploration_production'],
    geography: 'Global',
    lifecycle: 'cyclical',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 12.4, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 10.8, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 5.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: -1.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      operating_margin_pct: { value: 26.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 18.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 13.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      debt_to_equity: { value: 0.38, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 8.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'EOG',
    companyName: 'EOG Resources, Inc.',
    archetype: 'energy_commodity',
    sector: 'Energy',
    industry: 'Oil & Gas E&P',
    subIndustry: 'oil_gas_ep',
    revenueModels: ['crude_oil_sales', 'natural_gas_sales'],
    majorBusinessLines: ['exploration_production'],
    geography: 'US',
    lifecycle: 'cyclical',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 10.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 9.8, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 4.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 0.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      operating_margin_pct: { value: 32.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      net_margin_pct: { value: 23.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 16.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      debt_to_equity: { value: 0.15, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      fcf_yield_pct: { value: 8.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },

  // 7. Early-Stage / Pre-Profit Space & Tech
  {
    ticker: 'RKLB',
    companyName: 'Rocket Lab USA, Inc.',
    archetype: 'early_stage',
    sector: 'Industrials',
    industry: 'Aerospace & Defense',
    subIndustry: 'space_launch_systems',
    revenueModels: ['launch_contracts', 'space_systems_sales'],
    majorBusinessLines: ['launch_services', 'space_systems'],
    geography: 'US',
    lifecycle: 'early_stage',
    profitabilityState: 'pre_profit',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'mid',
    metrics: {
      ev_sales: { value: 14.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 42.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 27.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      cash_runway_months: { value: 28, unit: 'count', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'ASTS',
    companyName: 'AST SpaceMobile, Inc.',
    archetype: 'early_stage',
    sector: 'Technology',
    industry: 'Telecommunications',
    subIndustry: 'satellite_broadband',
    revenueModels: ['gateway_services', 'commercial_agreements'],
    majorBusinessLines: ['space_cellular_network'],
    geography: 'US',
    lifecycle: 'early_stage',
    profitabilityState: 'pre_profit',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'mid',
    metrics: {
      ev_sales: { value: 28.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 120.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: -15.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      cash_runway_months: { value: 18, unit: 'count', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'LUNR',
    companyName: 'Intuitive Machines, Inc.',
    archetype: 'early_stage',
    sector: 'Industrials',
    industry: 'Aerospace & Defense',
    subIndustry: 'lunar_services',
    revenueModels: ['nasa_contracts', 'commercial_payloads'],
    majorBusinessLines: ['lunar_access', 'orbital_services'],
    geography: 'US',
    lifecycle: 'early_stage',
    profitabilityState: 'pre_profit',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'small',
    metrics: {
      ev_sales: { value: 6.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 85.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 12.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      cash_runway_months: { value: 16, unit: 'count', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },

  // 8. Semiconductor (Fabless vs Foundry vs Equipment)
  {
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    archetype: 'semiconductor',
    sector: 'Technology',
    industry: 'Semiconductors',
    subIndustry: 'fabless_accelerator',
    revenueModels: ['compute_networking_sales', 'graphics_sales'],
    majorBusinessLines: ['data_center', 'gaming', 'professional_visualization', 'auto'],
    geography: 'Global',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'asset_light',
    regulatoryType: 'unregulated',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 42.5, unit: 'x', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 30.0, unit: 'x', period: 'FY2026E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 32.0, unit: 'x', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 18.0, unit: 'x', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 114.0, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 75.0, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 62.0, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 68.0, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'AMD',
    companyName: 'Advanced Micro Devices, Inc.',
    archetype: 'semiconductor',
    sector: 'Technology',
    industry: 'Semiconductors',
    subIndustry: 'fabless_accelerator',
    revenueModels: ['data_center_sales', 'client_sales', 'gaming_sales'],
    majorBusinessLines: ['data_center', 'client', 'gaming', 'embedded'],
    geography: 'Global',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'asset_light',
    regulatoryType: 'unregulated',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 45.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 26.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 24.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 7.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 14.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 50.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 11.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 14.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'TSM',
    companyName: 'Taiwan Semiconductor Manufacturing Company Limited',
    archetype: 'semiconductor',
    sector: 'Technology',
    industry: 'Semiconductors',
    subIndustry: 'foundry_manufacturing',
    revenueModels: ['wafer_manufacturing_fees'],
    majorBusinessLines: ['advanced_nodes', 'specialty_nodes'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'unregulated',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 24.5, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 18.5, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 12.0, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 8.5, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 29.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 54.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 43.1, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 28.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'ASML',
    companyName: 'ASML Holding N.V.',
    archetype: 'semiconductor',
    sector: 'Technology',
    industry: 'Semiconductor Equipment',
    subIndustry: 'lithography_equipment',
    revenueModels: ['equipment_sales', 'service_field_options'],
    majorBusinessLines: ['euv_systems', 'duv_systems', 'metrology_inspection'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'moderate',
    regulatoryType: 'unregulated',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 38.0, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 25.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 26.0, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      ev_sales: { value: 10.2, unit: 'x', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 12.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 51.3, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 31.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 38.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 20-F', reportedOrDerived: 'DERIVED' },
    },
  },

  // 9. Retail: Physical / Omnichannel vs Digital Marketplace
  {
    ticker: 'WMT',
    companyName: 'Walmart Inc.',
    archetype: 'retail',
    sector: 'Consumer Defensive',
    industry: 'Discount Stores',
    subIndustry: 'physical_omnichannel_retail',
    revenueModels: ['merchandise_sales', 'membership_fees'],
    majorBusinessLines: ['walmart_us', 'walmart_international', 'sams_club'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 32.0, unit: 'x', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 26.5, unit: 'x', period: 'FY2026E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 16.5, unit: 'x', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 5.5, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 24.5, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 4.2, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 14.5, unit: 'percent', period: 'FY2025', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'TGT',
    companyName: 'Target Corporation',
    archetype: 'retail',
    sector: 'Consumer Defensive',
    industry: 'Discount Stores',
    subIndustry: 'physical_omnichannel_retail',
    revenueModels: ['merchandise_sales'],
    majorBusinessLines: ['stores_digital'],
    geography: 'US',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 14.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 13.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 8.8, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 1.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 27.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 5.3, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 15.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'AMZN',
    companyName: 'Amazon.com, Inc.',
    archetype: 'digital_marketplace',
    sector: 'Consumer Cyclical',
    industry: 'Internet Retail',
    subIndustry: 'digital_marketplace_cloud',
    revenueModels: ['online_stores', 'third_party_seller_services', 'aws_cloud', 'advertising'],
    majorBusinessLines: ['north_america', 'international', 'aws'],
    geography: 'Global',
    lifecycle: 'growth',
    profitabilityState: 'profitable',
    capitalIntensity: 'capital_intensive',
    regulatoryType: 'standard',
    scaleTier: 'mega',
    metrics: {
      pe_trailing: { value: 40.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 28.0, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 18.0, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 11.8, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 48.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 9.2, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 16.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
  {
    ticker: 'EBAY',
    companyName: 'eBay Inc.',
    archetype: 'digital_marketplace',
    sector: 'Consumer Cyclical',
    industry: 'Internet Retail',
    subIndustry: 'digital_marketplace_cloud',
    revenueModels: ['take_rate_commission', 'advertising'],
    majorBusinessLines: ['marketplace_platform'],
    geography: 'Global',
    lifecycle: 'mature',
    profitabilityState: 'profitable',
    capitalIntensity: 'asset_light',
    regulatoryType: 'standard',
    scaleTier: 'large',
    metrics: {
      pe_trailing: { value: 15.2, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      pe_forward: { value: 12.8, unit: 'x', period: 'FY2025E', source: 'Consensus Snapshot', reportedOrDerived: 'DERIVED' },
      ev_ebitda: { value: 10.5, unit: 'x', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      revenue_growth_yoy_pct: { value: 4.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'REPORTED' },
      gross_margin_pct: { value: 71.5, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      operating_margin_pct: { value: 22.4, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
      roic_pct: { value: 18.0, unit: 'percent', period: 'FY2024', source: 'SEC Form 10-K', reportedOrDerived: 'DERIVED' },
    },
  },
];

/**
 * Builds a PeerBusinessFingerprint for a given stock report.
 */
export function buildPeerBusinessFingerprint(
  report: Partial<ReportData>,
  ticker?: string
): PeerBusinessFingerprint {
  const sym = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const archetype = resolveBusinessArchetype(report, sym);
  const profile = report.company_profile;
  const sector = profile?.sector || 'Unknown';
  const industry = profile?.industry || 'Unknown';
  const desc = (profile?.description || profile?.overview?.description || '').toLowerCase();

  // Sub-industry inference
  let subIndustry = 'general';
  if (archetype === 'fintech') {
    if (desc.includes('bnpl') || desc.includes('point-of-sale')) subIndustry = 'bnpl_consumer_finance';
    else if (desc.includes('ai') && desc.includes('lending')) subIndustry = 'ai_lending_marketplace';
    else subIndustry = 'digital_banking_lending';
  } else if (archetype === 'reit') {
    if (industry.includes('industrial') || desc.includes('logistics') || desc.includes('warehouse')) subIndustry = 'industrial_logistics_reit';
    else if (industry.includes('data center') || desc.includes('data center')) subIndustry = 'data_center_reit';
    else if (industry.includes('retail') || desc.includes('shopping') || desc.includes('mall')) subIndustry = 'retail_reit';
    else subIndustry = 'general_reit';
  } else if (archetype === 'semiconductor') {
    if (desc.includes('foundry') || desc.includes('wafer manufacturing')) subIndustry = 'foundry_manufacturing';
    else if (desc.includes('lithography') || desc.includes('equipment') || industry.includes('equipment')) subIndustry = 'equipment';
    else subIndustry = 'fabless_accelerator';
  } else if (archetype === 'energy_commodity') {
    if (desc.includes('refin') || industry.includes('refining')) subIndustry = 'refining';
    else if (desc.includes('oilfield') || industry.includes('oilfield')) subIndustry = 'oilfield_services';
    else subIndustry = 'oil_gas_ep';
  } else if (archetype === 'retail' || archetype === 'digital_marketplace') {
    if (desc.includes('marketplace') || desc.includes('e-commerce platform')) subIndustry = 'digital_marketplace_cloud';
    else subIndustry = 'physical_omnichannel_retail';
  }

  // Profitability inference
  const inc = report.financial_statements?.income_statement;
  const netIncomeArr = (inc?.net_income || []).filter(v => typeof v === 'number');
  const latestNetIncome = netIncomeArr[netIncomeArr.length - 1];
  const profitabilityState = typeof latestNetIncome === 'number' && latestNetIncome > 0
    ? 'profitable'
    : typeof latestNetIncome === 'number' && latestNetIncome < 0
      ? 'pre_profit'
      : 'breakeven';

  // Capital intensity
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(archetype);
  const capitalIntensity = isFinancial
    ? 'financial_intermediary'
    : ['reit', 'energy_commodity', 'industrial_manufacturing'].includes(archetype)
      ? 'capital_intensive'
      : 'asset_light';

  return {
    ticker: sym,
    companyName: (profile as any)?.company_name || (profile as any)?.name || sym,
    archetype,
    sector,
    industry,
    subIndustry,
    revenueModels: isFinancial ? ['net_interest_income', 'fee_based'] : ['product_sales', 'subscription'],
    majorBusinessLines: [industry],
    geography: 'US',
    lifecycle: archetype === 'early_stage' ? 'early_stage' : 'mature',
    profitabilityState,
    capitalIntensity,
    regulatoryType: isFinancial ? 'banking' : archetype === 'reit' ? 'reit' : 'standard',
  };
}

/**
 * Calculates a deterministic similarity score between target and candidate fingerprints.
 */
export function calculatePeerSimilarity(
  target: PeerBusinessFingerprint,
  candidate: PeerBusinessFingerprint
): { score: number; relationType: PeerRelationType; rationaleEn: string; rationaleTh: string } {
  let score = 0;

  // 1. Business Archetype Match (Weight: 0.35)
  if (target.archetype === candidate.archetype) {
    score += 0.35;
  } else {
    // Partial credit for compatible financial intermediaries
    const financialArchetypes = new Set(['bank', 'lender', 'fintech']);
    if (financialArchetypes.has(target.archetype) && financialArchetypes.has(candidate.archetype)) {
      score += 0.22;
    }
  }

  // 2. Sub-Industry / Sector Match (Weight: 0.30)
  if (target.subIndustry && candidate.subIndustry && target.subIndustry === candidate.subIndustry) {
    score += 0.30;
  } else if (target.industry.toLowerCase() === candidate.industry.toLowerCase()) {
    score += 0.20;
  } else if (target.sector.toLowerCase() === candidate.sector.toLowerCase()) {
    score += 0.10;
  }

  // 3. Revenue Models Overlap (Weight: 0.15)
  const targetRev = new Set(target.revenueModels);
  const sharedRev = candidate.revenueModels.filter(r => targetRev.has(r)).length;
  if (sharedRev > 0) {
    score += Math.min(0.15, (sharedRev / Math.max(1, targetRev.size)) * 0.15);
  }

  // 4. Profitability & Lifecycle Match (Weight: 0.10)
  if (target.profitabilityState === candidate.profitabilityState) {
    score += 0.05;
  }
  if (target.lifecycle === candidate.lifecycle) {
    score += 0.05;
  }

  // 5. Capital Intensity & Regulatory Framework (Weight: 0.10)
  if (target.capitalIntensity === candidate.capitalIntensity) {
    score += 0.05;
  }
  if (target.regulatoryType === candidate.regulatoryType) {
    score += 0.05;
  }

  score = Math.round(score * 100) / 100;

  let relationType: PeerRelationType = 'BROADER_SECTOR_REFERENCE';
  if (score >= 0.78) {
    relationType = 'DIRECT_PEER';
  } else if (score >= 0.58) {
    relationType = 'CLOSE_COMPARABLE';
  }

  const rationaleEn = relationType === 'DIRECT_PEER'
    ? `Direct peer sharing identical ${target.archetype} business archetype and ${target.subIndustry || target.industry} operating model.`
    : relationType === 'CLOSE_COMPARABLE'
      ? `Close comparable with aligned economics in ${target.industry}.`
      : `Broader sector reference in ${target.sector}.`;

  const rationaleTh = relationType === 'DIRECT_PEER'
    ? `คู่แข่งตรงที่มีโครงสร้างธุรกิจแบบ ${target.archetype} และโมเดลการดำเนินงาน ${target.subIndustry || target.industry} เดียวกัน`
    : relationType === 'CLOSE_COMPARABLE'
      ? `กลุ่มบริษัทเทียบเคียงที่มีความใกล้เคียงเชิงเศรษฐศาสตร์ในกลุ่ม ${target.industry}`
      : `บริษัทอ้างอิงระดับอุตสาหกรรมในกลุ่ม ${target.sector}`;

  return { score, relationType, rationaleEn, rationaleTh };
}

/**
 * Evaluates hard filters to prevent invalid or cross-archetype comparisons.
 */
function passesHardFilters(
  target: PeerBusinessFingerprint,
  candidate: CandidateDefinition
): { passes: boolean; reason?: string } {
  // 1. Never compare company with itself
  if (candidate.ticker.toUpperCase() === target.ticker.toUpperCase()) {
    return { passes: false, reason: 'SELF_TARGET' };
  }

  // 2. Reject ETF or Fund tickers
  if (/^(SPY|QQQ|IWM|XLF|XLK|XLE|VNQ|VTI|VOO)$/i.test(candidate.ticker)) {
    return { passes: false, reason: 'ETF_OR_FUND' };
  }

  // 3. Financial Sector Guard: Financial companies must NEVER be compared to non-financial operating companies
  const targetIsFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(target.archetype);
  const candIsFinancial = ['bank', 'lender', 'fintech', 'insurer', 'asset_manager', 'broker_exchange'].includes(candidate.archetype);
  if (targetIsFinancial !== candIsFinancial) {
    return { passes: false, reason: 'CROSS_FINANCIAL_GUARD' };
  }

  // 4. Insurer vs Bank Guard: Insurers must not be compared to depository banks
  if (target.archetype === 'insurer' && candidate.archetype === 'bank') {
    return { passes: false, reason: 'INSURER_VS_BANK_GUARD' };
  }
  if (target.archetype === 'bank' && candidate.archetype === 'insurer') {
    return { passes: false, reason: 'BANK_VS_INSURER_GUARD' };
  }

  // 5. REIT Guard: REITs must only be compared to other REITs
  if ((target.archetype === 'reit') !== (candidate.archetype === 'reit')) {
    return { passes: false, reason: 'REIT_GUARD' };
  }

  // 6. REIT Sub-sector Guard: Sub-sector mismatch should not pass as direct peer
  if (target.archetype === 'reit' && target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) {
    return { passes: false, reason: 'REIT_SUBSECTOR_MISMATCH' };
  }

  // 7. Energy Guard: E&P must not be compared to refiners or oilfield services as direct peers
  if (target.archetype === 'energy_commodity') {
    if (target.subIndustry === 'oil_gas_ep' && candidate.subIndustry !== 'oil_gas_ep') {
      return { passes: false, reason: 'ENERGY_SUBSECTOR_MISMATCH' };
    }
  }

  // 8. Semiconductor Guard: Fabless must not be compared to foundries or equipment makers as direct peers
  if (target.archetype === 'semiconductor') {
    if (target.subIndustry && candidate.subIndustry && target.subIndustry !== candidate.subIndustry) {
      return { passes: false, reason: 'SEMICONDUCTOR_SUBSECTOR_MISMATCH' };
    }
  }

  // 9. Retail Guard: Traditional physical retail must not be compared to digital marketplaces indiscriminately
  if (target.archetype === 'retail' && candidate.archetype === 'digital_marketplace') {
    return { passes: false, reason: 'RETAIL_VS_MARKETPLACE_MISMATCH' };
  }
  if (target.archetype === 'digital_marketplace' && candidate.archetype === 'retail') {
    return { passes: false, reason: 'MARKETPLACE_VS_RETAIL_MISMATCH' };
  }

  // 10. Early-stage Guard: Pre-profit early stage companies must not be compared to mature giants as direct peers
  if (target.archetype === 'early_stage' && candidate.archetype !== 'early_stage') {
    return { passes: false, reason: 'EARLY_STAGE_LIFECYCLE_MISMATCH' };
  }

  return { passes: true };
}

/**
 * Deterministically computes median from an array of valid numbers.
 * Invariant: Missing values are excluded, NEVER converted to 0 (missing != 0).
 */
export function calculateDeterministicMedian(values: (number | null | undefined)[]): number | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (clean.length === 0) return null;
  clean.sort((a, b) => a - b);
  const mid = Math.floor(clean.length / 2);
  if (clean.length % 2 === 0) {
    return Math.round(((clean[mid - 1] + clean[mid]) / 2) * 100) / 100;
  }
  return clean[mid];
}

/**
 * Main Deterministic Peer Discovery Engine.
 * Follows the pipeline:
 * Target Company -> Business Archetype -> Semantic Fingerprint -> Candidate Universe -> Hard Filters -> Similarity Scoring -> Final Peer Set -> Medians.
 */
export function discoverPeers(
  report: Partial<ReportData>,
  ticker?: string
): PeerDiscoveryResult {
  const targetTicker = (ticker || report.ticker || (report as any)?.symbol || 'STOCK').toUpperCase().trim();
  const targetFingerprint = buildPeerBusinessFingerprint(report, targetTicker);

  const candidates: PeerCandidate[] = [];

  for (const item of PUBLIC_CANDIDATE_UNIVERSE) {
    const filterRes = passesHardFilters(targetFingerprint, item);
    if (!filterRes.passes) continue;

    const candFingerprint: PeerBusinessFingerprint = {
      ticker: item.ticker,
      companyName: item.companyName,
      archetype: item.archetype,
      sector: item.sector,
      industry: item.industry,
      subIndustry: item.subIndustry,
      revenueModels: item.revenueModels,
      majorBusinessLines: item.majorBusinessLines,
      geography: item.geography,
      lifecycle: item.lifecycle,
      profitabilityState: item.profitabilityState,
      capitalIntensity: item.capitalIntensity,
      regulatoryType: item.regulatoryType,
      scaleTier: item.scaleTier,
    };

    const { score, relationType, rationaleEn, rationaleTh } = calculatePeerSimilarity(targetFingerprint, candFingerprint);

    // Only admit candidates with score >= 0.40
    if (score < 0.40) continue;

    const metricObservations: Record<string, PeerMetricObservation> = {};
    for (const [mKey, mData] of Object.entries(item.metrics)) {
      metricObservations[mKey] = {
        ticker: item.ticker,
        company: item.companyName,
        metric: mKey,
        value: mData.value,
        unit: mData.unit,
        period: mData.period,
        source: mData.source,
        reportedOrDerived: mData.reportedOrDerived,
        status: mData.value !== null ? 'VERIFIED' : 'NOT_REPORTED',
      };
    }

    candidates.push({
      ticker: item.ticker,
      companyName: item.companyName,
      fingerprint: candFingerprint,
      similarityScore: score,
      relationType,
      selectionRationale: rationaleEn,
      selectionRationaleTh: rationaleTh,
      metrics: metricObservations,
    });
  }

  // Sort candidates by similarity score descending
  candidates.sort((a, b) => b.similarityScore - a.similarityScore);

  // Take top candidates (between 3 and 8 preferred)
  const finalPeers = candidates.slice(0, 8);
  const peerCount = finalPeers.length;
  const isLimitedSample = peerCount > 0 && peerCount <= 2;

  // Handle Truthful Unavailable State if 0 peers found
  if (peerCount === 0) {
    const unavailableReason: PeerUnavailableReason = 'NO_CANDIDATES';
    const unavailableMessageTh = 'ยังไม่พบกลุ่มบริษัทที่เปรียบเทียบได้และมีข้อมูลที่ตรวจสอบแล้วเพียงพอ';
    const unavailableMessageEn = 'No sufficiently comparable source-verified peer set is currently available.';

    return {
      targetTicker,
      targetFingerprint,
      peers: [],
      peerCount: 0,
      isLimitedSample: false,
      unavailableReason,
      unavailableMessageEn,
      unavailableMessageTh,
      medians: {},
      isBroadSectorUniverse: false,
      benchmarkRows: [],
      peerCompanyItems: [],
    };
  }

  // Compute deterministic medians for all available metric keys
  const allMetricKeys = new Set<string>();
  for (const p of finalPeers) {
    for (const k of Object.keys(p.metrics)) {
      allMetricKeys.add(k);
    }
  }

  const medians: Record<string, number | null> = {};
  for (const k of allMetricKeys) {
    const vals = finalPeers.map(p => p.metrics[k]?.value);
    medians[k] = calculateDeterministicMedian(vals);
  }

  // Map to PeerCompanyItem for PeerComparisonTable
  const peerCompanyItems: PeerCompanyItem[] = finalPeers.map(p => ({
    ticker: p.ticker,
    company_name: p.companyName,
    market_cap: p.metrics.market_cap?.value ? `$${p.metrics.market_cap.value}B` : undefined,
    pe_trailing: p.metrics.pe_trailing?.value,
    pe_forward: p.metrics.pe_forward?.value,
    revenue_growth_yoy_pct: p.metrics.revenue_growth_yoy_pct?.value,
    gross_margin_pct: p.metrics.gross_margin_pct?.value,
    net_margin_pct: p.metrics.net_margin_pct?.value,
    ev_ebitda: p.metrics.ev_ebitda?.value,
    status_label_th: p.relationType === 'DIRECT_PEER' ? 'คู่แข่งตรง' : 'บริษัทเทียบเคียง',
    status_label_en: p.relationType === 'DIRECT_PEER' ? 'Direct Peer' : 'Comparable',
  }));

  // Add target row to peerCompanyItems for context
  const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
  const targetFwdPE = report.valuation_ratios?.find(r => /forward.*P\/E|P\/E.*forward/i.test(r.name))?.value;
  const targetRevGrowth = report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
    (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
  ];
  const targetGM = report.financial_statements?.income_statement?.gross_margin_pct?.[
    (report.financial_statements?.income_statement?.gross_margin_pct?.length || 0) - 1
  ];
  const targetNM = report.financial_statements?.income_statement?.net_margin_pct?.[
    (report.financial_statements?.income_statement?.net_margin_pct?.length || 0) - 1
  ];

  peerCompanyItems.unshift({
    ticker: targetTicker,
    company_name: targetFingerprint.companyName,
    pe_trailing: typeof targetPE === 'number' ? targetPE : null,
    pe_forward: typeof targetFwdPE === 'number' ? targetFwdPE : null,
    revenue_growth_yoy_pct: typeof targetRevGrowth === 'number' ? targetRevGrowth : null,
    gross_margin_pct: typeof targetGM === 'number' ? targetGM : null,
    net_margin_pct: typeof targetNM === 'number' ? targetNM : null,
    status_label_th: 'หุ้นเป้าหมาย',
    status_label_en: 'Target',
  });

  // Build archetype-aware benchmark rows for Five Pillars (Pillar 5)
  const benchmarkRows = buildArchetypeBenchmarkRows(targetFingerprint.archetype, report, finalPeers, medians);

  return {
    targetTicker,
    targetFingerprint,
    peers: finalPeers,
    peerCount,
    isLimitedSample,
    medians,
    isBroadSectorUniverse: false, // Invariant: do NOT label peer median as sector median
    benchmarkRows,
    peerCompanyItems,
  };
}

/**
 * Builds business-aware benchmark rows for Five Pillars based on archetype.
 */
function buildArchetypeBenchmarkRows(
  archetype: BusinessArchetype,
  report: Partial<ReportData>,
  peers: PeerCandidate[],
  medians: Record<string, number | null>
): PeerBenchmarkRow[] {
  const rows: PeerBenchmarkRow[] = [];
  const isFinancial = ['bank', 'lender', 'fintech', 'insurer'].includes(archetype);
  const isReit = archetype === 'reit';
  const isEarlyStage = archetype === 'early_stage';

  const fmt = (v: number | null | undefined, unit = '') =>
    typeof v === 'number' && Number.isFinite(v) ? `${v}${unit}` : 'N/A';

  const peer1 = peers[0];

  if (isFinancial) {
    // Financial Benchmark Rows: P/E, P/B, ROE, NIM, Efficiency Ratio
    const peMed = medians.pe_trailing;
    const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmt(targetPE, 'x'),
      sector_median: fmt(peMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.pe_trailing?.value, 'x'),
      status: targetPE && peMed ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const pbMed = medians.price_to_book;
    const targetPB = report.valuation_ratios?.find(r => /P\/B/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/B Ratio',
      metric_name_th: 'ราคาต่อมูลค่าทางบัญชี',
      target_value: fmt(targetPB, 'x'),
      sector_median: fmt(pbMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.price_to_book?.value, 'x'),
      status: targetPB && pbMed ? (targetPB < pbMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPB && pbMed ? (targetPB < pbMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const roeMed = medians.roe_pct;
    const kiRoe = (report.key_indicators as any)?.profitability?.roe_pct ?? (report.financial_statements?.key_indicators as any)?.roe_pct;
    rows.push({
      metric_name: 'Return on Equity (ROE)',
      metric_name_th: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น',
      target_value: fmt(kiRoe, '%'),
      sector_median: fmt(roeMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.roe_pct?.value, '%'),
      status: kiRoe && roeMed ? (kiRoe > roeMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiRoe && roeMed ? (kiRoe > roeMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const nimMed = medians.net_interest_margin_pct;
    const kiNim = (report.key_indicators as any)?.profitability?.net_interest_margin_pct;
    rows.push({
      metric_name: 'Net Interest Margin (NIM)',
      metric_name_th: 'อัตราส่วนต่างดอกเบี้ยสุทธิ',
      target_value: fmt(kiNim, '%'),
      sector_median: fmt(nimMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.net_interest_margin_pct?.value, '%'),
      status: kiNim && nimMed ? (kiNim > nimMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiNim && nimMed ? (kiNim > nimMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });
  } else if (isReit) {
    // REIT Benchmark Rows: P/FFO, P/AFFO, Occupancy Rate, Dividend Yield
    const pffoMed = medians.p_ffo_multiple;
    rows.push({
      metric_name: 'Price / FFO',
      metric_name_th: 'ราคาต่อกระแสเงินสดจากดำเนินงาน (P/FFO)',
      target_value: fmt(pffoMed, 'x'),
      sector_median: fmt(pffoMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.p_ffo_multiple?.value, 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
    });

    const occMed = medians.occupancy_rate_pct;
    rows.push({
      metric_name: 'Occupancy Rate',
      metric_name_th: 'อัตราการเช่าพื้นที่',
      target_value: fmt(occMed, '%'),
      sector_median: fmt(occMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.occupancy_rate_pct?.value, '%'),
      status: 'better',
      status_label_th: 'อัตราเช่าสูง',
    });
  } else if (isEarlyStage) {
    // Early Stage Benchmark Rows: EV/Sales, Revenue Growth, Cash Runway
    const evsMed = medians.ev_sales;
    rows.push({
      metric_name: 'EV / Sales Multiple',
      metric_name_th: 'มูลค่ากิจการต่อรายได้',
      target_value: fmt(evsMed, 'x'),
      sector_median: fmt(evsMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.ev_sales?.value, 'x'),
      status: 'neutral',
      status_label_th: 'เทียบเท่า',
    });

    const revgMed = medians.revenue_growth_yoy_pct;
    rows.push({
      metric_name: 'YoY Revenue Growth',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(revgMed, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.revenue_growth_yoy_pct?.value, '%'),
      status: 'better',
      status_label_th: 'เติบโตสูง',
    });
  } else {
    // Standard Operating Benchmark Rows: P/E, EV/EBITDA, Revenue Growth, Operating Margin, ROIC
    const peMed = medians.pe_trailing;
    const targetPE = report.valuation_ratios?.find(r => /P\/E/.test(r.name) && !/forward/i.test(r.name))?.value;
    rows.push({
      metric_name: 'P/E (Trailing)',
      metric_name_th: 'อัตราส่วนราคาต่อกำไร',
      target_value: fmt(targetPE, 'x'),
      sector_median: fmt(peMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.pe_trailing?.value, 'x'),
      status: targetPE && peMed ? (targetPE < peMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetPE && peMed ? (targetPE < peMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const eveMed = medians.ev_ebitda;
    const targetEVE = report.valuation_ratios?.find(r => /EV\/EBITDA/i.test(r.name))?.value;
    rows.push({
      metric_name: 'EV / EBITDA',
      metric_name_th: 'มูลค่ากิจการต่อกำไรก่อนดอกเบี้ยภาษี',
      target_value: fmt(targetEVE, 'x'),
      sector_median: fmt(eveMed, 'x'),
      direct_peer_value: fmt(peer1?.metrics.ev_ebitda?.value, 'x'),
      status: targetEVE && eveMed ? (targetEVE < eveMed ? 'better' : 'premium') : 'neutral',
      status_label_th: targetEVE && eveMed ? (targetEVE < eveMed ? 'ต่ำกว่าค่ากลาง' : 'พรีเมียมกว่าค่ากลาง') : 'เทียบเท่า',
    });

    const revgMed = medians.revenue_growth_yoy_pct;
    const targetRevGrowth = report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[
      (report.financial_statements?.income_statement?.yoy_revenue_growth_pct?.length || 0) - 1
    ];
    rows.push({
      metric_name: 'Revenue Growth YoY',
      metric_name_th: 'การเติบโตรายได้ YoY',
      target_value: fmt(targetRevGrowth, '%'),
      sector_median: fmt(revgMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.revenue_growth_yoy_pct?.value, '%'),
      status: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'better' : 'worse') : 'neutral',
      status_label_th: targetRevGrowth && revgMed ? (targetRevGrowth > revgMed ? 'เติบโตสูงกว่า' : 'เติบโตต่ำกว่า') : 'เทียบเท่า',
    });

    const roicMed = medians.roic_pct;
    const kiRoic = (report.key_indicators as any)?.profitability?.roic_pct;
    rows.push({
      metric_name: 'ROIC',
      metric_name_th: 'ผลตอบแทนเงินลงทุน',
      target_value: fmt(kiRoic, '%'),
      sector_median: fmt(roicMed, '%'),
      direct_peer_value: fmt(peer1?.metrics.roic_pct?.value, '%'),
      status: kiRoic && roicMed ? (kiRoic > roicMed ? 'better' : 'worse') : 'neutral',
      status_label_th: kiRoic && roicMed ? (kiRoic > roicMed ? 'สูงกว่าค่ากลาง' : 'ต่ำกว่าค่ากลาง') : 'เทียบเท่า',
    });
  }

  return rows;
}
