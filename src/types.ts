export interface IncomeStatementData {
  revenue: (number | null)[];
  cogs?: (number | null)[];
  gross_profit?: (number | null)[];
  gross_margin_pct?: (number | null)[];
  operating_expenses?: (number | null)[];
  operating_income?: (number | null)[];
  operating_margin_pct?: (number | null)[];
  other_income?: (number | null)[];
  income_before_tax?: (number | null)[];
  income_tax_expense?: (number | null)[];
  net_income: (number | null)[];
  net_margin_pct?: (number | null)[];
  eps_diluted?: (number | null)[];
  interest_expense?: (number | null)[];
  tax_rate?: (number | null)[];
  yoy_revenue_growth_pct?: (number | null)[];
  // Banking / FinTech specific fields
  net_interest_income?: (number | null)[];
  total_interest_income?: (number | null)[];
  total_interest_expense?: (number | null)[];
  non_interest_income?: (number | null)[];
  provision_for_credit_losses?: (number | null)[];
  net_interest_margin_pct?: (number | null)[];
  // Insurance specific fields
  net_premiums_earned?: (number | null)[];
  losses_and_loss_adjustment?: (number | null)[];
  underwriting_expenses?: (number | null)[];
  underwriting_profit?: (number | null)[];
  investment_income?: (number | null)[];
  combined_ratio_pct?: (number | null)[];
  // REITs specific fields
  rental_revenue?: (number | null)[];
  property_operating_expenses?: (number | null)[];
  noi?: (number | null)[]; // Net Operating Income
  ffo?: (number | null)[]; // Funds From Operations
  affo?: (number | null)[]; // Adjusted Funds From Operations
  commentary?: string;
}

export interface BalanceSheetData {
  cash_and_equivalents?: (number | null)[];
  short_term_investments?: (number | null)[];
  total_current_assets?: (number | null)[];
  receivables?: (number | null)[];
  accounts_receivable?: (number | null)[];
  inventory?: (number | null)[];
  total_non_current_assets?: (number | null)[];
  net_ppe?: (number | null)[];
  available_for_sale_securities?: (number | null)[];
  goodwill?: (number | null)[];
  total_assets?: (number | null)[];
  current_liabilities?: (number | null)[];
  total_current_liabilities?: (number | null)[];
  payables?: (number | null)[];
  accounts_payable?: (number | null)[];
  tax_payable?: (number | null)[];
  short_term_debt?: (number | null)[];
  current_deferred_liabilities?: (number | null)[];
  total_debt?: (number | null)[];
  total_liabilities?: (number | null)[];
  total_equity?: (number | null)[];
  capital_stock?: (number | null)[];
  common_stock?: (number | null)[];
  retained_earnings?: (number | null)[];
  aoci?: (number | null)[];
  current_ratio?: (number | null)[];
  quick_ratio?: (number | null)[];
  debt_to_equity?: (number | null)[];
  debt_to_ebitda?: (number | null)[];
  // Banking / FinTech specific fields
  deposits?: (number | null)[]; // Mandatory banking line: Interest-bearing + non-interest-bearing deposits
  interest_bearing_deposits?: (number | null)[];
  non_interest_bearing_deposits?: (number | null)[];
  loans_held_for_investment?: (number | null)[];
  loans_held_for_sale?: (number | null)[];
  allowance_for_loan_losses?: (number | null)[];
  investment_securities?: (number | null)[];
  tier1_capital_ratio?: (number | null)[];
  // Insurance specific fields
  unearned_premium_reserve?: (number | null)[];
  loss_reserve?: (number | null)[];
  reinsurance_recoverable?: (number | null)[];
  // REITs specific fields
  real_estate_properties?: (number | null)[];
  accumulated_depreciation_re?: (number | null)[];
  mortgage_debt?: (number | null)[];
  commentary?: string;
}

export interface CashFlowData {
  operating_cash_flow?: (number | null)[];
  depreciation?: (number | null)[];
  non_cash_items?: (number | null)[];
  change_working_capital?: (number | null)[];
  change_receivables?: (number | null)[];
  change_inventory?: (number | null)[];
  change_payables?: (number | null)[];
  change_other_ca?: (number | null)[];
  change_other_cl?: (number | null)[];
  investing_cash_flow?: (number | null)[];
  capex?: (number | null)[];
  investment_purchase?: (number | null)[];
  other_investing?: (number | null)[];
  financing_cash_flow?: (number | null)[];
  debt_issuance_payments?: (number | null)[];
  stock_issuance_repurchase?: (number | null)[];
  dividends_paid?: (number | null)[];
  other_financing?: (number | null)[];
  beginning_cash?: (number | null)[];
  net_change_cash?: (number | null)[];
  ending_cash?: (number | null)[];
  free_cash_flow?: (number | null)[];
  fcf_margin_pct?: (number | null)[];
  fcf_vs_net_income_ratio?: (number | null)[];
  // Banking / FinTech specific fields
  change_in_deposits?: (number | null)[]; // Mandatory banking line: Customer deposits net flow
  change_in_loans?: (number | null)[];
  change_in_loans_held_for_sale?: (number | null)[]; // Crucial driver of lending operating cash flow (originations vs sales)
  provision_addback?: (number | null)[];
  // Insurance specific fields
  premiums_collected?: (number | null)[];
  claims_paid?: (number | null)[];
  // REITs specific fields
  ffo_starting_cash?: (number | null)[];
  commentary?: string;
}

export interface KeyIndicatorMetric {
  key: string;
  name: string;
  name_th?: string;
  category: 'profitability' | 'solvency' | 'operating_capacity' | string;
  unit: '%' | 'x' | 'D' | 'T' | string;
  values: (number | null)[];
  yoy_pcts?: (number | null)[];
}

export interface KeyIndicatorsCategory {
  category_key: 'profitability' | 'solvency' | 'operating_capacity' | string;
  category_title: string;
  category_title_th?: string;
  metrics: KeyIndicatorMetric[];
}

export interface KeyIndicatorsData {
  periods: string[];
  categories: KeyIndicatorsCategory[];
}

export type StatementTemplateType = 'standard' | 'banking' | 'insurance' | 'reit' | 'cyclical' | 'biotech';

export interface StatementValidationSummary {
  is_balanced: boolean; // Total Assets = Total Liabilities + Total Equity within tolerance
  discrepancy_pct?: (number | null)[];
  discrepancy_amount?: (number | null)[];
  impossible_guards_passed: boolean;
  failed_guards?: string[];
  passed_guards?: string[];
  flagged_metrics?: Record<string, string>; // E.g., { roe: "Raw Net Income or Equity unverified" }
  ratio_reliability_warning?: boolean; // When true, alerts that derived ratios might be deceptively normal
  filing_source?: string;
  filing_date?: string;
}

export interface FinancialStatementsData {
  currency?: string;
  fiscal_period_type?: 'quarterly' | 'annual' | string;
  as_of_date?: string;
  periods: string[];
  key_indicators?: KeyIndicatorsData;
  income_statement: IncomeStatementData;
  balance_sheet: BalanceSheetData;
  cash_flow: CashFlowData;
  /** Primary filing used for the latest reported balance-sheet date. */
  source?: {
    document_url?: string;
    document_type?: string;
    filing_date?: string;
    period_end?: string;
    units?: string;
  };
  statement_template?: StatementTemplateType;
  validation_summary?: StatementValidationSummary;
  red_flags?: string[];
}

export interface ValuationRatioItem {
  name: string;
  formula?: string;
  value: number | null;
  unit?: string;
  peer_avg?: number | null;
  own_5yr_percentile?: number | null;
  interpretation?: string;
  verdict?: 'very_cheap' | 'cheap' | 'fair' | 'expensive' | 'very_expensive' | string;
}

export interface ValuationPercentileChart {
  description?: string;
  min_5yr?: number;
  max_5yr?: number;
  current?: number;
  median_5yr?: number;
}

export interface ValuationData {
  valuation_ratios?: ValuationRatioItem[];
  valuation_percentile_chart?: ValuationPercentileChart;
}

export type ValuationModelType = 
  | 'dcf_standard'      // 3-Stage DCF for Growth/Tech
  | 'dcf_multistage'    // 4-Stage+ DCF for Super Growth / AI
  | 'dcf_gordon'        // 1-2 Stage Gordon DCF for Mature/Value
  | 'dcf_cyclical'      // Through-Cycle Normalized DCF for Cyclicals
  | 'ddm'               // Dividend Discount Model & Residual Income for Banks/Financials
  | 'fintech_pe'        // Forward P/E, PEG & Platform Residual Income for FinTech / Digital Banks
  | 'reit_affo'         // FFO/AFFO Multiple & DCF for REITs
  | 'relative_only';    // Relative Valuation fallback for Negative FCF / Pre-Revenue

export interface ModelSelectorResult {
  model_type: ValuationModelType;
  model_name_th: string;
  model_name_en: string;
  reason_th: string;
  reason_en: string;
  sector_category: string;
  alternative_models?: ValuationModelType[];
  disclaimer_note?: string;
}

export interface CostOfCapitalResult {
  region: string;
  currency: string;
  risk_free_rate_pct: number;
  risk_free_benchmark_label: string;
  beta: number;
  beta_benchmark_index: string;
  equity_risk_premium_pct: number;
  country_risk_premium_pct: number;
  cost_of_equity_pct: number;
  cost_of_debt_pct: number;
  effective_tax_rate_pct: number;
  weight_equity_pct: number;
  weight_debt_pct: number;
  wacc_pct: number;
  currency_risk_premium_pct?: number;
  is_foreign_currency_converted?: boolean;
  size_premium_pct?: number;
  distress_premium_pct?: number;
  size_category?: string;
  is_distressed_or_unprofitable?: boolean;
}

export interface DCFScenario {
  revenue_cagr_pct: number;
  terminal_margin_pct: number;
  fair_value_per_share: number;
  key_assumption_note: string;
  stage_growth_rates?: number[];
}

export interface DCFModel {
  model_type?: 'standard_3stage' | 'multistage_4stage' | 'gordon_growth' | 'cyclical_normalized';
  assumptions: {
    wacc_pct: number;
    terminal_growth_pct: number;
    projection_years: number;
    cost_of_equity_pct?: number;
    stages_count?: number;
  };
  inputs?: {
    ticker: string;
    currentPrice: number;
    startingRevenueM: number;
    sharesOutstandingM: number;
    netCashM: number;
    waccPct: number;
    terminalGrowthPct: number;
    projectionYears: number;
    /** True only when all inputs came from the four disclosed quarters in this report. */
    isValid?: boolean;
    sourcePeriod?: string;
    missingFields?: string[];
    derivedFields?: string[];
  };
  scenarios: {
    bear: DCFScenario;
    base: DCFScenario;
    bull: DCFScenario;
  };
}

export interface DDMScenario {
  dividend_growth_rate_pct: number;
  terminal_payout_ratio_pct: number;
  fair_value_per_share: number;
  key_assumption_note: string;
}

export interface DDMModel {
  assumptions: {
    cost_of_equity_pct: number;
    terminal_growth_pct: number;
    current_dividend_per_share: number;
    current_payout_ratio_pct: number;
    current_roe_pct: number;
  };
  scenarios: {
    bear: DDMScenario;
    base: DDMScenario;
    bull: DDMScenario;
  };
  residual_income_fair_value?: number;
  book_value_per_share?: number;
}

export interface REITAFFOScenario {
  affo_multiple: number;
  affo_growth_cagr_pct: number;
  fair_value_per_share: number;
  key_assumption_note: string;
}

export interface REITAFFOModel {
  sub_sector: 'Industrial' | 'Data Center' | 'Retail' | 'Residential' | 'Healthcare' | 'Office' | 'Diversified' | string;
  assumptions: {
    current_ffo_per_share: number;
    current_affo_per_share: number;
    peer_median_affo_multiple: number;
    cap_rate_pct?: number;
  };
  scenarios: {
    bear: REITAFFOScenario;
    base: REITAFFOScenario;
    bull: REITAFFOScenario;
  };
}

export interface CyclicalScenario {
  commodity_cycle_assumption: string;
  normalized_margin_pct: number;
  fair_value_per_share: number;
  key_assumption_note: string;
}

export interface CyclicalModel {
  cycle_length_years: number;
  historical_margins: {
    cycle_peak_margin_pct: number;
    cycle_trough_margin_pct: number;
    normalized_average_margin_pct: number;
    current_margin_pct: number;
  };
  scenarios: {
    bear: CyclicalScenario;
    base: CyclicalScenario;
    bull: CyclicalScenario;
  };
}

export interface RelativeValuationPeerItem {
  ticker: string;
  name: string;
  market_cap_b: number;
  growth_stage: string;
  ev_revenue_multiple: number;
  ev_gross_profit_multiple?: number;
}

export interface RelativeOnlyModel {
  primary_metric: 'EV/Revenue' | 'EV/Gross Profit' | 'EV/Users' | string;
  peer_median_multiple: number;
  applied_company_metric_value: number;
  implied_enterprise_value_b: number;
  implied_equity_value_b: number;
  fair_value_per_share: number;
  peers_evaluated: RelativeValuationPeerItem[];
  peer_selection_rationale: string;
  stage_confidence_score: 'Low' | 'Moderate' | 'High';
  pre_revenue_disclaimer: string;
}

export interface RelativeValuation {
  method: string;
  peer_multiple_used: number;
  metric_applied: string;
  fair_value_per_share: number;
}

export interface ValuationValidationAlert {
  type: 'error' | 'warning' | 'info';
  code: string;
  message_th: string;
  message_en: string;
  detail?: string;
}

export interface IntrinsicValueSummary {
  fair_value_range_low: number;
  fair_value_range_high: number;
  base_case_fair_value: number;
  current_price_position_pct?: number;
  margin_of_safety_pct: number;
  verdict_text: string;
}

export interface IntrinsicValueData {
  current_price: number;
  as_of_date?: string;
  selected_model?: ModelSelectorResult;
  cost_of_capital?: CostOfCapitalResult;
  dcf_model: DCFModel;
  ddm_model?: DDMModel;
  reit_model?: REITAFFOModel;
  cyclical_model?: CyclicalModel;
  relative_only_model?: RelativeOnlyModel;
  relative_valuation?: RelativeValuation;
  validation_alerts?: ValuationValidationAlert[];
  summary: IntrinsicValueSummary;
  disclaimer?: string;
  philosophy_disclaimer?: string;
}

export interface PastEarningsItem {
  period: string;
  report_date: string;
  eps_estimate: number;
  eps_actual: number;
  eps_surprise_pct?: number;
  revenue_estimate_musd?: number;
  revenue_actual_musd?: number;
  revenue_surprise_pct?: number;
  stock_reaction_1d_pct?: number;
  guidance_change?: 'raised' | 'lowered' | 'maintained' | string;
  beat_or_miss?: 'beat_both' | 'beat_eps' | 'beat_revenue' | 'miss_both' | string;
}

export interface EarningsBeatStreak {
  eps_beat_streak_quarters: number;
  revenue_beat_streak_quarters: number;
  commentary?: string;
}

export interface CurrentQuarterSetup {
  period: string;
  company_guidance_revenue_musd?: number[];
  consensus_estimate_revenue_musd?: number;
  consensus_estimate_eps?: number;
  whisper_vs_consensus?: string;
  key_things_to_watch?: string[];
}

export interface EstimateRevisionsTrend {
  description?: string;
  eps_estimate_90d_ago?: number;
  eps_estimate_current?: number;
  direction?: 'upward' | 'downward' | 'neutral' | string;
  num_analysts_raised?: number;
  num_analysts_lowered?: number;
  commentary?: string;
}

export interface FullYearGuidance {
  fiscal_year?: number;
  company_guidance_revenue_musd?: number[];
  implied_growth_pct?: number;
  consensus_vs_guidance?: string;
}

export interface AnalystConsensus {
  consensus_rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Underperform' | 'Sell' | string;
  total_analysts?: number;
  ratings_breakdown?: {
    buy_count: number;
    hold_count: number;
    sell_count: number;
  };
  price_target: {
    mean: number;
    high: number;
    low: number;
    median?: number;
    implied_upside_pct: number;
  };
  as_of_date?: string;
  commentary?: string;
}

export interface InstitutionalRatingItem {
  id?: string;
  name: string;
  logo_url?: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Overweight' | 'Underweight' | 'Neutral' | string;
  target_price_prev?: number;
  target_price_current: number;
  price_display?: string;
  change_type: 'Maintained' | 'Upgrade' | 'Downgrade' | 'New' | string;
  date: string;
}

export interface AnalystRatingItem {
  id?: string;
  name: string;
  star_rating: number; // 1 to 5
  firm_name?: string;
  rating: 'Buy' | 'Hold' | 'Sell' | 'Overweight' | 'Underweight' | 'Neutral' | string;
  target_price_prev?: number;
  target_price_current: number;
  price_display?: string;
  change_type: 'Maintained' | 'Upgrade' | 'Downgrade' | 'New' | string;
  date: string;
  has_report?: boolean;
}

export interface TargetPriceTrajectoryPoint {
  date: string;
  price?: number;
  is_forecast?: boolean;
  high_target?: number;
  avg_target?: number;
  low_target?: number;
}

export interface ForecastDashboardData {
  as_of_date?: string;
  updated_at?: string;
  total_analysts: number;
  consensus_rating: 'Buy' | 'Strong Buy' | 'Moderate Buy' | 'Hold' | 'Sell' | 'Strong Sell' | string;
  ratings_breakdown: {
    buy_count: number;
    buy_pct: number;
    hold_count: number;
    hold_pct: number;
    sell_count: number;
    sell_pct: number;
  };
  price_target: {
    high: number;
    mean: number;
    low: number;
    median?: number;
    current_price: number;
    implied_upside_pct?: number;
  };
  target_price_chart_data?: TargetPriceTrajectoryPoint[];
  institutions: InstitutionalRatingItem[];
  analysts: AnalystRatingItem[];
  disclaimer?: string;
}

export interface MorningstarAnalystNote {
  headline?: string;
  headline_th?: string;
  analyst_byline?: string;
  date?: string;
  content_paragraphs?: string[];
  content_paragraphs_th?: string[];
}

export interface MorningstarValuationThesis {
  analyst_byline?: string;
  date?: string;
  implied_pe?: number;
  implied_ev_revenue?: number;
  implied_fcf_yield_pct?: number;
  projected_revenue_cagr_5yr?: number;
  projected_gross_margin_terminal?: number;
  projected_operating_margin_terminal?: number;
  content_paragraphs?: string[];
  content_paragraphs_th?: string[];
}

export interface MorningstarResearchData {
  as_of_date?: string;
  has_coverage: boolean;
  status_note?: string;
  status_note_th?: string;
  analyst_name?: string;
  analyst_title?: string;
  analyst_title_th?: string;
  rating_stars?: number; // 1 to 5
  rating_date?: string;
  economic_moat?: 'Wide' | 'Narrow' | 'None' | string;
  economic_moat_th?: string;
  uncertainty?: 'Low' | 'Medium' | 'High' | 'Very High' | string;
  uncertainty_th?: string;
  capital_allocation?: 'Exemplary' | 'Standard' | 'Poor' | string;
  capital_allocation_th?: string;
  fair_value_estimate?: number;
  fair_value_date?: string;
  discount_premium_pct?: number;
  ai_analysis_summary?: string;
  ai_analysis_summary_th?: string;
  bulls_say?: string[];
  bulls_say_th?: string[];
  bears_say?: string[];
  bears_say_th?: string[];
  analyst_note?: MorningstarAnalystNote;
  business_strategy?: MorningstarDetailSection;
  valuation_thesis?: MorningstarValuationThesis;
  economic_moat_details?: MorningstarDetailSection;
  uncertainty_details?: MorningstarDetailSection;
  capital_allocation_details?: MorningstarDetailSection;
  financial_health?: MorningstarDetailSection;
  disclaimer?: string;
  disclaimer_th?: string;
}

export interface MorningstarDetailSection {
  title?: string;
  title_th?: string;
  analyst_byline?: string;
  date?: string;
  badge?: string;
  badge_th?: string;
  content_paragraphs?: string[];
  content_paragraphs_th?: string[];
}

export interface EarningsAnalysisData {
  as_of_date?: string;
  next_earnings_date?: string;
  next_earnings_date_confirmed?: boolean;
  days_until_next_earnings?: number;
  past_earnings_history: PastEarningsItem[];
  beat_streak?: EarningsBeatStreak;
  average_earnings_day_move_pct?: number;
  current_quarter_setup?: CurrentQuarterSetup;
  estimate_revisions_trend?: EstimateRevisionsTrend;
  full_year_guidance?: FullYearGuidance;
  analyst_consensus?: AnalystConsensus;
  summary_verdict?: string;
}

export interface PeerCompanyItem {
  ticker: string;
  company_name: string;
  name?: string;
  market_cap?: string | number;
  pe_trailing?: number | null;
  pe_forward?: number | null;
  revenue_growth_yoy_pct?: number | null;
  gross_margin_pct?: number | null;
  net_margin_pct?: number | null;
  ev_ebitda?: number | null;
  status_label_th?: string;
  status_label_en?: string;
}

export interface PeerComparisonData {
  as_of_date?: string;
  industry_name?: string;
  peers: PeerCompanyItem[];
  key_takeaway?: string;
}

export interface CatalystItem {
  title: string;
  date?: string;
  expected_impact?: 'high' | 'medium' | 'low' | string;
  description: string;
  category?: 'earnings' | 'product_event' | 'regulatory' | 'macro' | string;
}

export interface CatalystsData {
  as_of_date?: string;
  items: CatalystItem[];
}

export interface InsiderTransaction {
  date: string;
  insider_name: string;
  title?: string;
  transaction_type: 'buy' | 'sell' | 'option_exercise' | string;
  shares_count?: number;
  price_per_share?: number;
  total_value_usd?: number;
  security_type?: string;
}

export interface InsiderActivityData {
  as_of_date?: string;
  insider_ownership_pct?: number;
  institutional_ownership_pct?: number;
  institutional_qoq_change_pct?: number;
  recent_transactions?: InsiderTransaction[];
  commentary?: string;
}

export interface MajorHolderItem {
  name: string;
  shares_held: string | number;
  pct_owned: number;
  change_shares?: string | number;
  change_pct?: number;
  holder_type?: string;
  filing_date?: string;
  disclosure?: string;
}

export interface ShareholderActivityItem {
  holder_name: string;
  change_type: 'increase' | 'decrease' | 'new' | 'sold_out' | string;
  change_shares: string | number;
  change_amount_usd?: string | number;
  total_pct_held?: number;
  holder_type?: string;
  date?: string;
}

export interface InstitutionOverview {
  total_institutions_count: number;
  institutions_count_change_qoq?: number;
  total_shares_held?: string | number;
  shares_held_change_qoq?: string | number;
  pct_owned: number;
  pct_owned_change_qoq?: number;
}

export interface QuarterlyInstitutionalRecord {
  date: string;
  no_of_institutions: number;
  shares_held: string | number;
  pct_owned: number;
  change_shares?: string;
  stock_price?: number;
}

export interface SmartMoneyData {
  as_of_date?: string;
  institution_overview?: InstitutionOverview;
  holder_type_breakdown?: { type: string; pct: number }[];
  quarterly_history?: QuarterlyInstitutionalRecord[];
  major_holders?: MajorHolderItem[];
  shareholder_activity?: ShareholderActivityItem[];
  insiders_overview?: {
    insider_ownership_pct: number;
    bullish_insiders_count?: number;
    bearish_insiders_count?: number;
    key_insiders?: { name: string; title: string; shares_held: string | number; pct_owned?: number }[];
  };
  recent_transactions?: InsiderTransaction[];
  commentary?: string;
}

export interface DividendItem {
  announced_date?: string;
  allocation_plan?: string;
  amount_usd: number;
  record_date?: string;
  ex_date: string;
  pay_date?: string;
}

export interface DividendSummary {
  has_dividend: boolean;
  dividend_yield_pct?: number;
  annual_payout_usd?: number;
  payout_ratio_pct?: number;
  growth_streak_years?: number;
  frequency?: 'Quarterly' | 'Monthly' | 'Semi-Annual' | 'Annual' | string;
  policy_note?: string;
}

export interface StockSplitItem {
  announced_date?: string;
  effective_date: string;
  split_type: 'Split' | 'Reverse Split' | string;
  ratio: string;
}

export interface ShareBuybackData {
  authorized_amount_musd?: number;
  remaining_amount_musd?: number;
  shares_repurchased_last_12m?: number;
  net_share_reduction_pct?: number;
  commentary?: string;
}

export interface CorporateActionsData {
  as_of_date?: string;
  dividends?: {
    summary: DividendSummary;
    history?: DividendItem[];
  };
  stock_splits?: StockSplitItem[];
  buybacks?: ShareBuybackData;
}

export interface CompanyOverviewData {
  company_name: string;
  symbol: string;
  listing_date?: string;
  issue_price?: number | string;
  isin?: string;
  founded_year?: number | string;
  ceo?: string;
  exchange?: string;
  employees_count?: number | string;
  fiscal_year_end?: string;
  address?: string;
  city?: string;
  province_state?: string;
  country?: string;
  zip_code?: string;
  phone?: string;
  website_url?: string;
  description?: string;
}

export interface ExecutiveMember {
  name: string;
  title: string;
  salary_usd?: number | string;
  age?: number;
  gender?: string;
  bio?: string;
  updated_date?: string;
}

export interface CompanyProfileData {
  as_of_date?: string;
  overview?: CompanyOverviewData;
  executives?: ExecutiveMember[];
  country?: string;
  sector?: string;
  industry?: string;
  description?: string;
  beta?: number;
  stock_price?: number;
  price_change?: number;
  price_change_pct?: number;
  market_cap?: string;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  shares_outstanding?: number | string;
  currency?: string;
}

export interface RevenueSegmentItem {
  name: string;
  revenue_usd: string | number;
  ratio_pct: number;
  growth_yoy_pct?: number;
}

export interface RevenueBreakdownData {
  period?: string;
  by_business?: RevenueSegmentItem[];
  by_region?: RevenueSegmentItem[];
}

export interface OperationalEfficiencyItem {
  period: string;
  headcount: number | string;
  headcount_yoy_pct?: number;
  revenue_per_employee_k_usd: number;
  revenue_per_employee_yoy_pct?: number;
  operating_profit_per_employee_k_usd: number;
  operating_profit_per_employee_yoy_pct?: number;
  op_profit_per_employee_yoy_pct?: number;
  net_income_per_employee_k_usd: number;
  net_income_per_employee_yoy_pct?: number;
}

export interface FivePillarsGrowthData {
  revenue_growth_yoy_pct?: number;
  revenue_cagr_3yr_pct?: number;
  revenue_cagr_5yr_pct?: number;
  eps_growth_yoy_pct?: number;
  eps_cagr_3yr_pct?: number;
  fcf_growth_yoy_pct?: number;
  peg_ratio?: number;
  peg_interpretation?: string;
}

export interface FivePillarsProfitabilityData {
  roic_pct?: number;
  roe_pct?: number;
  gross_margin_pct?: number;
  operating_margin_pct?: number;
  net_margin_pct?: number;
  fcf_margin_pct?: number;
  capital_efficiency_verdict?: string;
}

export interface FivePillarsBalanceSheetData {
  total_cash_and_investments_b?: number;
  total_debt_b?: number;
  net_cash_or_debt_b?: number;
  is_net_cash?: boolean;
  debt_to_equity?: number;
  net_debt_to_ebitda?: number;
  interest_coverage?: number;
  solvency_score_label?: string;
}

export interface FivePillarsYieldsData {
  pe_multiple?: number;
  earnings_yield_pct?: number;
  pfcf_multiple?: number;
  fcf_yield_pct?: number;
  dividend_yield_pct?: number;
  treasury_10yr_yield_pct?: number;
  yield_spread_vs_treasury?: number;
  yield_interpretation?: string;
}

export interface PeerBenchmarkRow {
  metric_name: string;
  metric_name_th?: string;
  target_value: string | number;
  sector_median: string | number;
  direct_peer_value: string | number;
  industry_leader_value?: string | number;
  status: 'better' | 'worse' | 'neutral' | 'premium' | 'discount';
  status_label_th?: string;
}

export interface FivePillarsData {
  as_of_date?: string;
  growth: FivePillarsGrowthData;
  profitability: FivePillarsProfitabilityData;
  balance_sheet: FivePillarsBalanceSheetData;
  yields: FivePillarsYieldsData;
  peer_matrix: PeerBenchmarkRow[];
  analyst_takeaway?: string;
}

export interface BusinessAnalysisData {
  as_of_date?: string;
  revenue_breakdown?: RevenueBreakdownData;
  operational_efficiency?: OperationalEfficiencyItem[];
  key_takeaways?: string;
}

export interface ValuationBandPoint {
  date: string;
  ratio_value: number;
  historical_avg: number;
  band_lower: number;
  band_upper: number;
  industry_avg?: number;
  benchmark_index?: number;
}

export interface EarningsGrowthPoint {
  period: string;
  net_income_multiple: number;
  market_cap_multiple: number;
}

export interface IndustryDistributionItem {
  symbol: string;
  name: string;
  ratio_value: number | string;
  market_cap_b: number;
  forward_ratio?: number | string;
  percentile_5y?: number;
  is_target?: boolean;
}

export interface MarketDistributionBucket {
  range_label: string;
  count: number;
  ratio_pct: number;
}

export interface RatioValuationDetail {
  current_value: number;
  forward_value?: number;
  percentile_5y: number;
  historical_avg: number;
  reasonable_range_low: number;
  reasonable_range_high: number;
  industry_avg: number;
  industry_ranking: string;
  market_ranking: string;
  market_avg: number;
  market_median: number;
  band_chart_data: ValuationBandPoint[];
  industry_distribution: IndustryDistributionItem[];
  market_distribution: MarketDistributionBucket[];
  peer_comparison_list: IndustryDistributionItem[];
}

export interface ValuationDashboardData {
  as_of_date?: string;
  updated_at?: string;
  pe_ratio?: RatioValuationDetail;
  pb_ratio?: RatioValuationDetail;
  ps_ratio?: RatioValuationDetail;
  earnings_growth?: {
    net_income_5y_growth: string;
    market_cap_5y_growth: string;
    insight_note: string;
    chart_data: EarningsGrowthPoint[];
  };
  revenue_growth?: {
    revenue_5y_growth: string;
    market_cap_5y_growth: string;
    insight_note: string;
    chart_data: { period: string; revenue_multiple: number; market_cap_multiple: number }[];
  };
}

export interface DocumentFinding {
  documentType?: string;
  document_type?: string;
  keyInsights?: string[];
  key_insights?: string[];
  date?: string;
  sourceUrl?: string;
  source_url?: string;
  is_latest_quarter?: boolean;
  quarter_period?: string;
}

export interface DeepInsight {
  category: string;
  title: string;
  description: string;
  impact_score: number;
}

export interface ComprehensiveAnalysis {
  business_overview: string;
  target_customers: string;
  revenue_model: string;
  financial_overview: string;
  fundamentals_check: string;
  business_strengths: string;
  future_growth: string;
  key_risks: string;
  management: string;
  beginner_summary: {
    business_type_simple: string;
    top_3_strengths: string[];
    top_3_risks: string[];
    suitable_investor_type: string;
    further_reading: string;
  };
  scoring: {
    understandability: { score: number; reason: string };
    revenue_quality: { score: number; reason: string };
    financial_strength: { score: number; reason: string };
    growth_potential: { score: number; reason: string };
    risk_level: { score: number; reason: string };
    overall_attractiveness: { score: number; reason: string };
  };
  final_verdict_summary: {
    worth_further_study: string;
    strong_fundamentals: string;
    what_to_look_for: string;
  };
}

export interface TechnicalAnalysis {
  signal_summary: {
    status: string;
    trend_weekly: string;
    trend_daily: string;
    trend_4h: string;
    confluence_score: string;
  };
  key_levels: {
    current_price?: number;
    support: string[];
    resistance: string[];
  };
  trade_plan: {
    entry_zone: string;
    stop_loss: string;
    target_1: string;
    target_2: string;
    risk_reward_ratio: string;
  };
  overall_trend: string;
  price_structure: string;
  volume_analysis: string;
  trend_indicators: string;
  momentum_indicators: string;
  volatility_indicators: string;
  chart_patterns: string;
  relative_strength: string;
  technical_risks: string;
  beginner_summary: {
    technical_overview: string;
    top_3_points: string[];
    top_3_cautions: string[];
    suitable_trade_style: string;
  };
  scoring: {
    trend_clarity: { score: number; reason: string };
    momentum_strength: { score: number; reason: string };
    risk_reward: { score: number; reason: string };
    signal_confluence: { score: number; reason: string };
    false_signal_risk: { score: number; reason: string };
    overall_attractiveness: { score: number; reason: string };
  };
  final_verdict_summary: {
    is_good_timing: string;
    what_to_wait_for: string;
    trade_plan: string;
  };
}

export interface ConvictionPillarScore {
  score: number;
  maxScore: number;
  pct: number;
  reasonTh: string;
  reasonEn: string;
}

export interface ConvictionBreakdown {
  growth: ConvictionPillarScore;
  financial_health: ConvictionPillarScore;
  valuation: ConvictionPillarScore;
  moat_and_risk: ConvictionPillarScore;
  total_score: number;
}

export interface AnalysisReport {
  generated_at: string;
  ticker: string;
  summary: string;
  as_of_date?: string;
  analysis_type?: 'fundamental' | 'technical' | 'combined';
  verdict?: {
    summary: string;
    conviction_score: number;
    key_takeaways: string[];
    conviction_breakdown?: ConvictionBreakdown;
  };
  comprehensive_analysis?: ComprehensiveAnalysis;
  technical_analysis?: TechnicalAnalysis;
  financial_statements?: FinancialStatementsData;
  key_indicators?: any;
  valuation_ratios?: ValuationRatioItem[];
  valuation_percentile_chart?: ValuationPercentileChart;
  valuation_dashboard?: ValuationDashboardData;
  intrinsic_value?: IntrinsicValueData;
  earnings_analysis?: EarningsAnalysisData;
  forecast_dashboard?: ForecastDashboardData;
  morningstar_research?: MorningstarResearchData;
  peer_comparison?: PeerComparisonData;
  catalysts_and_events?: CatalystsData;
  insider_activity?: InsiderActivityData;
  smart_money?: SmartMoneyData;
  corporate_actions?: CorporateActionsData;
  company_profile?: CompanyProfileData;
  business_analysis?: BusinessAnalysisData;
  five_pillars?: FivePillarsData;
  deep_insights?: DeepInsight[];
  findings?: DocumentFinding[];
  financial_charts?: {
    stock_price_history: { date: string; price: number }[];
    financial_performance_4q: { quarter: string; revenue?: number; net_income?: number; distributions?: number }[];
  };
  final_report?: string;
  chartImage?: string;
}

export interface RawAnalysisReport extends Partial<AnalysisReport> {}

export type ReportData = AnalysisReport;


