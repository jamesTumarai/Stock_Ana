import assert from 'node:assert/strict';
import { resolveFundamentalMetrics } from '../metricRegistry';
import { resolveAdaptiveFivePillars } from '../fivePillarsResolver';
import { METRIC_SPECS, mapSecBundleToCanonicalFinancials } from '../../../services/sec/secFinancialMapper';
import { SECTOR_EXTENSION_SPECS } from '../../dataCompleteness/secExtensionResolver';
import { METRIC_ALIASES } from '../../metricLineage';
import { evaluateExpectations, EXPECTATION_METRIC_REGISTRY } from '../../thesisExpectations';
import { aggregateQuarterlyToAnnual } from '../../../utils/statementAggregation';
import { DataGapState } from '../../dataCompleteness/types';
import type { ReportData, FinancialStatementsData } from '../../../types';

console.log('🚀 Running Universal System-Wide Integrity & Invariant Property Test Suite...');

// =========================================================================
// 1. INVARIANT — REGULATORY CAPITAL DISTINCTION (CET1 != Tier 1 Capital)
// =========================================================================
{
  console.log('➡️ Testing Invariant 1: Regulatory Capital Distinction (CET1 != Tier 1)...');

  // A. Check SEC Financial Mapper specs: CET1 and Tier 1 must be separate specs
  const tier1Spec = METRIC_SPECS.find(s => s.metric === 'tier1_capital_ratio');
  const cet1Spec = METRIC_SPECS.find(s => s.metric === 'cet1_ratio');

  assert.ok(tier1Spec, 'tier1_capital_ratio spec must exist in METRIC_SPECS');
  assert.ok(cet1Spec, 'cet1_ratio spec must exist in METRIC_SPECS');
  assert.ok(
    !tier1Spec.concepts.includes('CommonEquityTier1RiskBasedCapitalRatio'),
    'CommonEquityTier1RiskBasedCapitalRatio must NOT map to tier1_capital_ratio'
  );
  assert.ok(
    cet1Spec.concepts.includes('CommonEquityTier1RiskBasedCapitalRatio'),
    'CommonEquityTier1RiskBasedCapitalRatio must map to cet1_ratio'
  );

  // B. Check SEC Extension Resolver specs
  const extTier1 = SECTOR_EXTENSION_SPECS.find(s => s.metric === 'tier1_capital_ratio');
  const extCet1 = SECTOR_EXTENSION_SPECS.find(s => s.metric === 'cet1_ratio');
  assert.ok(extTier1 && extCet1, 'Both tier1_capital_ratio and cet1_ratio must exist in extension specs');
  assert.ok(
    !extTier1.concepts.includes('CommonEquityTier1RiskBasedCapitalRatio'),
    'Extension tier1_capital_ratio must not include CET1 concept'
  );

  // C. Check METRIC_ALIASES in metricLineage
  assert.ok(METRIC_ALIASES.tier1_capital_ratio, 'tier1_capital_ratio aliases must exist');
  assert.ok(METRIC_ALIASES.cet1_ratio, 'cet1_ratio aliases must exist');
  assert.ok(
    !METRIC_ALIASES.tier1_capital_ratio.includes('cet1_ratio'),
    'tier1_capital_ratio aliases must NOT include cet1_ratio'
  );
  assert.ok(
    !METRIC_ALIASES.tier1_capital_ratio.includes('common_equity_tier_1'),
    'tier1_capital_ratio aliases must NOT include common_equity_tier_1'
  );

  // D. Check EXPECTATION_METRIC_REGISTRY
  const expTier1 = EXPECTATION_METRIC_REGISTRY.find(m => m.id === 'tier_1_capital_ratio');
  const expCet1 = EXPECTATION_METRIC_REGISTRY.find(m => m.id === 'cet1_ratio');
  assert.ok(expTier1 && expCet1, 'Both tier_1_capital_ratio and cet1_ratio must be registered in thesis expectations');

  // E. Check banking resolution in MetricRegistry
  const bankReport: Partial<ReportData> = {
    ticker: 'JPM',
    company_profile: { sector: 'Financial Services', industry: 'Banks - Diversified' },
    financial_statements: {
      periods: ['Q3 2025'],
      balance_sheet: {
        total_assets: [4000000],
        total_liabilities: [3680000],
        total_equity: [320000],
        deposits: [2500000],
        cet1_ratio: [15.3],
        tier1_capital_ratio: [16.8],
      } as any,
      income_statement: {
        net_interest_income: [23000],
        non_interest_income: [19000],
        provision_for_credit_losses: [2000],
        net_income: [13000],
      } as any,
    } as any,
  };

  const resolved = resolveFundamentalMetrics(bankReport);
  assert.equal(resolved.cet1Ratio.value, 15.3, 'CET1 ratio must resolve accurately to 15.3%');
  assert.equal(resolved.tier1CapitalRatio.value, 16.8, 'Tier 1 Capital ratio must resolve accurately to 16.8%');
  assert.notEqual(resolved.cet1Ratio.value, resolved.tier1CapitalRatio.value, 'CET1 and Tier 1 Capital ratios must not be conflated');

  // F. Check Five Pillars Pillar 3 renders CET1 ratio
  const pillars = resolveAdaptiveFivePillars(bankReport);
  const p3 = pillars.pillars.solvency;
  const cet1Metric = p3.metrics.find(m => m.key === 'cet1_ratio');
  assert.ok(cet1Metric, 'Pillar 3 must render cet1_ratio for banks');
  assert.equal(cet1Metric?.value, 15.3, 'Pillar 3 CET1 metric value must be 15.3%');
  assert.equal(cet1Metric?.formattedValue, '15.3%', 'Pillar 3 CET1 formatted value must be 15.3%');
  assert.equal(cet1Metric?.status, DataGapState.VERIFIED_AVAILABLE, 'CET1 status must be VERIFIED_AVAILABLE');

  console.log('✅ Invariant 1 PASSED: CET1 and Tier 1 Capital ratios are strictly distinguished.');
}

// =========================================================================
// 2. INVARIANT — FFO SCALING SAFETY (FFO per share != total dollar FFO)
// =========================================================================
{
  console.log('➡️ Testing Invariant 2: FFO Scaling Safety...');

  const ffoSpec = METRIC_SPECS.find(s => s.metric === 'ffo');
  assert.ok(ffoSpec, 'ffo spec must exist');
  assert.ok(
    !ffoSpec.concepts.includes('FundsFromOperationsPerDilutedShare'),
    'Per-share FFO concept must NEVER be mapped to total dollar FFO (USD_M)'
  );

  const extFfoSpec = SECTOR_EXTENSION_SPECS.find(s => s.metric === 'ffo');
  assert.ok(extFfoSpec, 'extension ffo spec must exist');
  assert.ok(
    !extFfoSpec.concepts.includes('FundsFromOperationsPerDilutedShare'),
    'Extension FFO spec must not include per-share concept'
  );

  console.log('✅ Invariant 2 PASSED: Per-share FFO is strictly isolated from total dollar FFO.');
}

// =========================================================================
// 3. INVARIANT — DEBT VS TOTAL LIABILITIES (Debt != Total Liabilities)
// =========================================================================
{
  console.log('➡️ Testing Invariant 3: Debt vs Total Liabilities...');

  const reportWithDebtAndLiabilities: Partial<ReportData> = {
    ticker: 'CORP',
    financial_statements: {
      periods: ['Q3 2025'],
      balance_sheet: {
        total_assets: [100000],
        total_liabilities: [45000], // Liabilities = $45B
        short_term_debt: [2000],
        long_term_debt: [13000],    // Total Debt = 2000 + 13000 = $15B
        cash_and_equivalents: [8000],
        total_equity: [55000],
      } as any,
    } as any,
  };

  const resolved = resolveFundamentalMetrics(reportWithDebtAndLiabilities);
  // Net cash/debt is (8000 - 15000) / 1000 = -7B (Net Debt of $7B)
  assert.equal(resolved.netCashOrDebt.basis, 'Net Debt (Total Debt - Total Cash)', 'Basis must be Net Debt');
  assert.equal(resolved.netCashOrDebt.value, 7, 'Net debt amount must be 7 ($7B), NOT 37 ($45B liabilities - $8B cash)');

  // Missing total debt must NOT fall back to total liabilities
  const reportWithMissingDebt: Partial<ReportData> = {
    ticker: 'NODBT',
    financial_statements: {
      periods: ['Q3 2025'],
      balance_sheet: {
        total_assets: [100000],
        total_liabilities: [45000],
        cash_and_equivalents: [8000],
        total_equity: [55000],
      } as any,
    } as any,
  };

  const resolvedMissing = resolveFundamentalMetrics(reportWithMissingDebt);
  assert.equal(
    resolvedMissing.netCashOrDebt.status,
    'UNAVAILABLE',
    'Net Cash/Debt must fail closed to UNAVAILABLE when debt is missing; must NEVER use Total Liabilities'
  );

  console.log('✅ Invariant 3 PASSED: Debt cannot resolve or fall back to Total Liabilities.');
}

// =========================================================================
// 4. INVARIANT — CASH VS NET CASH IN THESIS EXPECTATIONS
// =========================================================================
{
  console.log('➡️ Testing Invariant 4: Cash vs Net Cash in Expectations...');

  const memorySnap: any = {
    snapshotDate: '2026-09-20',
    financials: {
      latestPeriod: 'Q3 2026',
      cashAndEquivalents: 25000, // Gross Cash $25B
      netCash: 12000,            // Net Cash $12B (after debt)
      periodHistory: [],
    },
  };

  const expectations: any[] = [
    {
      id: 'exp-cash',
      metricOrEvent: 'cash_and_equivalents',
      targetValue: 24000,
      targetPeriod: 'Q3 2026',
      condition: 'gte',
      status: 'PENDING',
    },
    {
      id: 'exp-net-cash',
      metricOrEvent: 'net_cash',
      targetValue: 15000,
      targetPeriod: 'Q3 2026',
      condition: 'gte',
      status: 'PENDING',
    },
  ];

  const evaluated = evaluateExpectations(expectations, memorySnap);
  const evalCash = evaluated.find(e => e.metricOrEvent === 'cash_and_equivalents');
  const evalNetCash = evaluated.find(e => e.metricOrEvent === 'net_cash');

  assert.equal(evalCash?.actualValue, 25000, 'Cash expectation must consume cashAndEquivalents (25000)');
  assert.equal(evalCash?.status, 'MET', 'Cash expectation 25000 >= 24000 must be MET');

  assert.equal(evalNetCash?.actualValue, 12000, 'Net cash expectation must consume netCash (12000)');
  assert.equal(evalNetCash?.status, 'MISSED', 'Net cash expectation 12000 >= 15000 must be MISSED');

  console.log('✅ Invariant 4 PASSED: Cash and Net Cash expectations are completely decoupled.');
}

// =========================================================================
// 5. INVARIANT — INSTANT VS FLOW AGGREGATION
// =========================================================================
{
  console.log('➡️ Testing Invariant 5: Instant vs Flow Aggregation...');

  const quarterlyFs: FinancialStatementsData = {
    periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
    fiscal_period_type: 'quarterly',
    income_statement: {
      revenue: [1000, 1100, 1200, 1300], // Flow metric: Sum = 4600
      gross_profit: [400, 440, 480, 520],
      operating_income: [200, 220, 240, 260],
      net_income: [150, 165, 180, 195],
    } as any,
    balance_sheet: {
      cash_and_equivalents: [5000, 5200, 5400, 5600], // Instant metric: Ending = 5600, NOT 21200!
      total_debt: [2000, 2000, 2000, 2000],           // Instant metric: Ending = 2000, NOT 8000!
      total_assets: [15000, 15500, 16000, 16500],
      total_liabilities: [6000, 6200, 6400, 6600],
      total_equity: [9000, 9300, 9600, 9900],
    } as any,
    cash_flow: {
      free_cash_flow: [200, 220, 240, 260],
    } as any,
  };

  const annualFs = aggregateQuarterlyToAnnual(quarterlyFs);
  assert.ok(annualFs, 'Annual aggregation must succeed for 4 consecutive quarters');
  assert.equal(annualFs.income_statement.revenue?.[0], 4600, 'Flow metric (Revenue) must be SUMMED across 4 quarters');
  assert.equal(annualFs.balance_sheet.cash_and_equivalents?.[0], 5600, 'Instant metric (Cash) must be the ENDING balance (5600), NOT summed');
  assert.equal(annualFs.balance_sheet.total_debt?.[0], 2000, 'Instant metric (Total Debt) must be the ENDING balance (2000), NOT summed');
  assert.notEqual(annualFs.balance_sheet.cash_and_equivalents?.[0], 21200, 'Instant metric must NEVER be summed');

  console.log('✅ Invariant 5 PASSED: Flow metrics are summed; instant metrics use period-end balances.');
}

// =========================================================================
// 6. INVARIANT — LOSS-MAKING COMPANY P/E, PEG, & EARNINGS YIELD
// =========================================================================
{
  console.log('➡️ Testing Invariant 6: Loss-Making Company Valuation Guards...');

  const lossMakingReport: Partial<ReportData> = {
    ticker: 'UNPROFITABLE',
    valuation_ratios: [
      { name: 'Trailing P/E', value: 35.5 }, // Provider gave a bogus positive trailing P/E
    ],
    key_indicators: {
      valuation: { pe_trailing: 35.5 },
    } as any,
    financial_statements: {
      periods: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
      income_statement: {
        revenue: [500, 600, 700, 800],
        operating_income: [-100, -80, -60, -40],
        net_income: [-120, -95, -75, -50], // Verified Net Loss in every quarter; TTM Net Income = -340
      } as any,
    } as any,
  };

  const resolved = resolveFundamentalMetrics(lossMakingReport);
  assert.equal(
    resolved.peTrailing.status,
    'NOT_APPLICABLE',
    'Trailing P/E must be NOT_APPLICABLE (N/M) for a company with verified net losses'
  );
  assert.equal(resolved.peTrailing.value, undefined, 'Trailing P/E value must be undefined (not 35.5)');
  assert.equal(resolved.peTrailing.reason, 'Negative Earnings (N/M)', 'Reason must state Negative Earnings');

  assert.equal(resolved.peg.status, 'NOT_APPLICABLE', 'PEG must be NOT_APPLICABLE for loss-making company');
  assert.equal(resolved.earningsYield.status, 'UNAVAILABLE', 'Trailing Earnings Yield must not claim positive return on net losses');

  console.log('✅ Invariant 6 PASSED: Loss-making company trailing P/E, PEG, and earnings yield fail closed.');
}

// =========================================================================
// 7. INVARIANT — FINANCIAL SECTOR GUARD COMPLETENESS
// =========================================================================
{
  console.log('➡️ Testing Invariant 7: Financial Sector Guard Completeness...');

  const archetypes: ('bank' | 'lender' | 'fintech' | 'insurer')[] = ['bank', 'lender', 'fintech', 'insurer'];

  for (const arch of archetypes) {
    const report: Partial<ReportData> = {
      ticker: `TEST_${arch.toUpperCase()}`,
      company_profile: {
        sector: 'Financial Services',
        industry: arch === 'bank' ? 'Banks - Regional' : arch === 'insurer' ? 'Insurance - Property & Casualty' : arch === 'lender' ? 'Credit Services' : 'Financial Technology',
      },
      financial_statements: {
        periods: ['Q3 2025'],
        balance_sheet: {
          total_assets: [100000],
          total_liabilities: [85000],
          total_equity: [15000],
          deposits: [70000],
          cash_and_equivalents: [12000],
        } as any,
        income_statement: {
          net_interest_income: [1500],
          non_interest_income: [800],
          net_income: [600],
        } as any,
      } as any,
    };

    const resolved = resolveFundamentalMetrics(report);
    assert.equal(resolved.fcfYield.status, 'GUARDED', `FCF Yield must be GUARDED for ${arch}`);
    assert.equal(resolved.roic.status, 'GUARDED', `ROIC must be GUARDED for ${arch}`);
    assert.equal(resolved.wacc.status, 'GUARDED', `WACC must be GUARDED for ${arch}`);
    assert.equal(resolved.roicWaccSpread.status, 'GUARDED', `ROIC-WACC Spread must be GUARDED for ${arch}`);
    assert.equal(resolved.netDebtToEbitda.status, 'GUARDED', `Net Debt / EBITDA must be GUARDED for ${arch}`);
    assert.equal(resolved.currentRatio.status, 'GUARDED', `Current Ratio must be GUARDED for ${arch}`);
    assert.equal(resolved.quickRatio.status, 'GUARDED', `Quick Ratio must be GUARDED for ${arch}`);
    assert.equal(resolved.interestCoverage.status, 'GUARDED', `Interest Coverage must be GUARDED for ${arch}`);
  }

  console.log('✅ Invariant 7 PASSED: Corporate metrics are unconditionally guarded across all financial archetypes.');
}

// =========================================================================
// 8. INVARIANT — REIT METRIC PURITY & ISOLATION
// =========================================================================
{
  console.log('➡️ Testing Invariant 8: REIT Metric Purity...');

  const reitReport: Partial<ReportData> = {
    ticker: 'PLD_TEST',
    company_profile: { sector: 'Real Estate', industry: 'REIT - Industrial' },
    financial_statements: {
      periods: ['Q3 2025'],
      income_statement: {
        rental_revenue: [2100],
        noi: [1500],
        ffo: [1200],
        affo: [1050],
        net_income: [650], // Accounting net income distorted by high real estate depreciation
      } as any,
      balance_sheet: {
        total_assets: [85000],
        total_debt: [28000],
        total_equity: [48000],
      } as any,
    } as any,
  };

  const resolved = resolveFundamentalMetrics(reitReport);
  assert.equal(resolved.archetype, 'reit', 'Archetype must resolve to reit');
  assert.equal(resolved.peg.status, 'NOT_APPLICABLE', 'PEG must be NOT_APPLICABLE for REITs (GAAP EPS is distorted)');
  assert.equal(resolved.fcfConversion.status, 'GUARDED', 'FCF Conversion must be GUARDED for REITs (prefer AFFO)');

  console.log('✅ Invariant 8 PASSED: REIT metrics strictly adhere to real estate cash flow semantics.');
}

// =========================================================================
// 9. TABLE-DRIVEN MULTI-ARCHETYPE INTEGRITY FIXTURES (Section W)
// =========================================================================
{
  console.log('➡️ Testing Multi-Archetype Table-Driven Invariants across Sectors...');

  interface ArchetypeFixture {
    archetype: string;
    sector: string;
    industry: string;
    expectedFcfAllowed: boolean;
    expectedRoicAllowed: boolean;
    expectedNimAllowed: boolean;
  }

  const fixtures: ArchetypeFixture[] = [
    { archetype: 'saas_software', sector: 'Technology', industry: 'Software - Infrastructure', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'semiconductor', sector: 'Technology', industry: 'Semiconductors', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'industrial_manufacturing', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'bank', sector: 'Financial Services', industry: 'Banks - Diversified', expectedFcfAllowed: false, expectedRoicAllowed: false, expectedNimAllowed: true },
    { archetype: 'lender', sector: 'Financial Services', industry: 'Consumer Lending', expectedFcfAllowed: false, expectedRoicAllowed: false, expectedNimAllowed: true },
    { archetype: 'fintech', sector: 'Financial Services', industry: 'Credit Services', expectedFcfAllowed: false, expectedRoicAllowed: false, expectedNimAllowed: true },
    { archetype: 'insurer', sector: 'Financial Services', industry: 'Insurance - Diversified', expectedFcfAllowed: false, expectedRoicAllowed: false, expectedNimAllowed: false },
    { archetype: 'reit', sector: 'Real Estate', industry: 'REIT - Residential', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'energy_commodity', sector: 'Energy', industry: 'Oil & Gas E&P', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'utility', sector: 'Utilities', industry: 'Utilities - Regulated Electric', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
    { archetype: 'early_stage', sector: 'Technology', industry: 'Software - Application', expectedFcfAllowed: true, expectedRoicAllowed: true, expectedNimAllowed: false },
  ];

  for (const fix of fixtures) {
    const isEarlyStage = fix.archetype === 'early_stage';
    const report: Partial<ReportData> = {
      ticker: `TEST_${fix.archetype.toUpperCase()}`,
      company_profile: { sector: fix.sector, industry: fix.industry },
      financial_statements: {
        periods: ['Q3 2025'],
        balance_sheet: { total_assets: [10000], total_debt: [2000], total_equity: [5000], cash_and_equivalents: [1000] } as any,
        income_statement: {
          revenue: [isEarlyStage ? 50 : 2000],
          operating_income: [isEarlyStage ? -150 : 300],
          net_income: [isEarlyStage ? -180 : 200],
          gross_margin_pct: isEarlyStage ? [-25] : [45],
        } as any,
        cash_flow: isEarlyStage ? { free_cash_flow: [-100, -120] } as any : undefined,
      } as any,
    };

    const resolved = resolveFundamentalMetrics(report);
    assert.equal(resolved.archetype, fix.archetype, `Archetype must resolve to ${fix.archetype}`);

    if (!fix.expectedFcfAllowed) {
      assert.equal(resolved.fcfYield.status, 'GUARDED', `${fix.archetype} must guard corporate FCF`);
      assert.equal(resolved.fcfConversion.status, 'GUARDED', `${fix.archetype} must guard FCF conversion`);
    }

    if (!fix.expectedRoicAllowed) {
      assert.equal(resolved.roic.status, 'GUARDED', `${fix.archetype} must guard corporate ROIC`);
      assert.equal(resolved.wacc.status, 'GUARDED', `${fix.archetype} must guard WACC`);
    }

    if (!fix.expectedNimAllowed) {
      assert.equal(resolved.nim.status, 'NOT_APPLICABLE', `${fix.archetype} must mark NIM as NOT_APPLICABLE`);
    }
  }

  console.log('✅ Table-Driven Multi-Archetype Invariants PASSED across 10 sectors/archetypes.');
}

// =========================================================================
// 10. INVARIANT — PROVENANCE IMMUTABILITY & ANTI-OVERWRITE
// =========================================================================
{
  console.log('➡️ Testing Invariant 9 & 10: Provenance Immutability & Anti-Overwrite...');

  // A. Verified SEC value cannot be overwritten by unverified AI key indicators draft
  const reportWithVerifiedAndAiDraft: Partial<ReportData> = {
    ticker: 'AAPL',
    company_profile: { sector: 'Technology', industry: 'Consumer Electronics' },
    financial_statements: {
      periods: ['Q3 2025'],
      income_statement: {
        revenue: [28000], // AI draft number
      } as any,
    } as any,
    key_indicators: {
      growth: { revenue_growth_yoy_pct: 19.5 }, // AI hallucinated draft growth
    } as any,
    canonical_financials: {
      generatedBy: 'sec-xbrl-v1',
      ticker: 'AAPL',
      periods: ['Q3 2025'],
      currency: 'USD',
      provenanceStatus: 'verified',
      values: {
        'income_statement.revenue': [
          {
            period: 'Q3 2025',
            metric: 'revenue',
            statement: 'income_statement',
            value: 25182, // Official SEC XBRL verified fact
            verification: 'verified',
            source: 'SEC 10-Q (0000320193-25-000078)',
            unit: 'USD_M',
            type: 'reported',
          },
        ],
      },
    } as any,
  };

  const resolved = resolveFundamentalMetrics(reportWithVerifiedAndAiDraft);
  // Revenue growth calculation must prioritize verified canonical fact
  assert.ok(
    resolved.revenueGrowthYoY.source?.includes('SEC'),
    'Verified SEC source must win over unverified AI draft'
  );
  assert.notEqual(
    resolved.revenueGrowthYoY.source,
    'Key Indicators',
    'AI draft Key Indicators must NOT overwrite SEC verified source'
  );

  // B. Provider metric cannot become SEC_VERIFIED
  const unverifiedProviderData = {
    identity: { ticker: 'UNVERIFIED', cik: '0001234567' },
    companyFacts: { facts: {} }, // Empty SEC facts
    retrievedAt: new Date().toISOString(),
  };

  const canonicalResult = mapSecBundleToCanonicalFinancials(unverifiedProviderData as any);
  assert.equal(canonicalResult, null, 'Provider data without verified SEC namespace facts cannot produce canonical verified dataset');

  console.log('✅ Invariant 9 & 10 PASSED: Verified facts cannot be overwritten; provider metrics cannot become SEC_VERIFIED.');
}

console.log('🎉 ALL UNIVERSAL SYSTEM-WIDE INTEGRITY INVARIANTS PASSED SUCCESSFULLY!');
