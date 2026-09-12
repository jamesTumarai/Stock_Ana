import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffSecFinancialStatements,
  adaptFinancialStatementsToSecPeriodStatements,
  type SecFilingPeriodDiff,
  type SecPeriodStatement,
} from '../secFilingDiffEngine';
import type { FinancialStatementsData, ReportData } from '../../types';
import type { SecCompanyFact, SecCompanyFactsResponse, SecSubmissionsResponse, SecTickerRecord } from '../../services/sec/secClient';
import { mapSecBundleToCanonicalFinancials } from '../../services/sec/secFinancialMapper';

describe('secFilingDiffEngine', () => {
  const mockAnnualStatements = [
    {
      period: 'FY2025',
      fiscal_year: 2025,
      revenue: 280000,
      operating_income: 130000,
      net_income: 100000,
      operating_cash_flow: 140000,
      capital_expenditure: -35000,
      total_debt: 75000,
      stockholders_equity: 220000,
      diluted_shares: 7400,
      accounts_receivable: 35000,
    },
    {
      period: 'FY2024',
      fiscal_year: 2024,
      revenue: 245000,
      operating_income: 109000,
      net_income: 88000,
      operating_cash_flow: 118000,
      capital_expenditure: -28000,
      total_debt: 80000,
      stockholders_equity: 200000,
      diluted_shares: 7450,
      accounts_receivable: 32000,
    },
  ];

  it('computes factual YoY deltas without hallucinating numbers', () => {
    const diff = diffSecFinancialStatements(mockAnnualStatements as any, false);
    assert.ok(diff, 'Diff must not be null');

    assert.equal(diff.currentPeriod, 'FY2025');
    assert.equal(diff.priorPeriod, 'FY2024');
    assert.equal(diff.comparisonType, 'annual_yoy');

    // Revenue YoY: (280000 - 245000) / 245000 = +14.29%
    assert.equal(diff.revenueYoYPct, 14.29);

    // Net Income YoY: (100000 - 88000) / 88000 = +13.64%
    assert.equal(diff.netIncomeYoYPct, 13.64);

    // OCF YoY: (140000 - 118000) / 118000 = +18.64%
    assert.equal(diff.ocfYoYPct, 18.64);

    // FCF = 140000 - 35000 = 105000 vs 118000 - 28000 = 90000: (105 - 90) / 90 = +16.67%
    assert.equal(diff.fcfYoYPct, 16.67);

    // Operating margin expansion: (130/280) - (109/245) = 46.43% - 44.49% = +194 bps
    assert.ok(diff.operatingMarginBpsDelta !== null && diff.operatingMarginBpsDelta > 180 && diff.operatingMarginBpsDelta < 210);

    // Shares reduction (buybacks): from 7450 to 7400 = -0.67%
    assert.equal(diff.shareCountDeltaPct, -0.67);
    assert.equal(diff.dilutionOrBuyback, 'buybacks');

    // Factual Cash Conversion Ratio: 140000 / 100000 = 1.40x
    assert.equal(diff.ocfToNetIncomeRatioCurrent, 1.4);
    assert.equal(diff.ocfToNetIncomeRatioPrior, 1.34);
    assert.equal(diff.cashConversionStatus, 'healthy');
    assert.ok(diff.cashConversionSummary.includes('1.4x'));
  });

  it('guarantees chronological ordering independence (ascending vs descending array input)', () => {
    // Pass statements in ascending order: FY2024 first, then FY2025
    const ascendingStatements = [mockAnnualStatements[1], mockAnnualStatements[0]];
    const diff = diffSecFinancialStatements(ascendingStatements as any, false);

    assert.ok(diff);
    assert.equal(diff.currentPeriod, 'FY2025');
    assert.equal(diff.priorPeriod, 'FY2024');
    assert.equal(diff.revenueYoYPct, 14.29); // Must be positive +14.29%, never inverted to negative
  });

  it('correctly matches same-quarter YoY pairs (Q3 2025 vs Q3 2024)', () => {
    const quarterlyStatements = [
      {
        period: 'Q3 2025',
        fiscal_year: 2025,
        revenue: 72000,
        operating_income: 34000,
        net_income: 26000,
        operating_cash_flow: 32000,
        capital_expenditure: -9000,
      },
      {
        period: 'Q3 2024',
        fiscal_year: 2024,
        revenue: 63000,
        operating_income: 28000,
        net_income: 21000,
        operating_cash_flow: 27000,
        capital_expenditure: -7500,
      },
    ];

    const diff = diffSecFinancialStatements(quarterlyStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.currentPeriod, 'Q3 2025');
    assert.equal(diff.priorPeriod, 'Q3 2024');
    assert.equal(diff.comparisonType, 'quarter_yoy');
    assert.equal(diff.revenueYoYPct, 14.29);
  });

  it('fails closed and returns null when periods are mixed and non-comparable', () => {
    // 1 quarter and 1 annual statement cannot be meaningfully compared
    const mixedStatements = [
      {
        period: 'Q3 2025',
        revenue: 72000,
      },
      {
        period: 'FY2024',
        revenue: 245000,
      },
    ];

    const diff = diffSecFinancialStatements(mixedStatements as any, false);
    assert.equal(diff, null, 'Mixed quarter and annual periods must return null');
  });

  it('detects cash conversion health anomaly if revenue grows but OCF drops', () => {
    const divergingStatements = [
      {
        ...mockAnnualStatements[0],
        operating_cash_flow: 90000, // Dropped while revenue increased!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(divergingStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.cashConversionStatus, 'warning');
    assert.ok(diff.cashConversionSummary.includes('Cash conversion divergence'));
  });

  it('detects severe divergence when net income is positive but OCF is negative', () => {
    const cashBurnStatements = [
      {
        ...mockAnnualStatements[0],
        net_income: 40000,
        operating_cash_flow: -15000, // Cash burn despite accounting profit!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(cashBurnStatements as any, false);
    assert.ok(diff);
    assert.equal(diff.cashConversionStatus, 'warning');
    assert.ok(diff.cashConversionSummary.includes('negative operating cash flow'));
  });

  it('identifies working capital expansion when accounts receivable outpaces revenue', () => {
    const arSpikeStatements = [
      {
        ...mockAnnualStatements[0],
        accounts_receivable: 55000, // +71.9% increase vs +14.29% revenue!
      },
      mockAnnualStatements[1],
    ];

    const diff = diffSecFinancialStatements(arSpikeStatements as any, false);
    assert.ok(diff);
    assert.ok(diff.workingCapitalNote?.includes('Accounts receivable expanded'));
  });

  it('handles bilingual Thai summary correctly', () => {
    const diffTh = diffSecFinancialStatements(mockAnnualStatements as any, true);
    assert.ok(diffTh);
    assert.ok(diffTh.cashConversionSummary.includes('คุณภาพกระแสเงินสด'));
  });

  it('returns null if fewer than 2 periods are available', () => {
    const single = [mockAnnualStatements[0]];
    const diff = diffSecFinancialStatements(single as any, false);
    assert.equal(diff, null);
  });

  it('rejects raw unverified FinancialStatementsData from becoming SecPeriodStatement array', () => {
    const fs: FinancialStatementsData = {
      periods: ['2023', '2024'],
      income_statement: {
        revenue: [1000, 1200],
        operating_income: [200, 250],
        net_income: [150, 190],
      },
      balance_sheet: {
        total_debt: [300, 280],
        total_equity: [500, 600],
        accounts_receivable: [80, 95],
        inventory: [40, 45],
        accounts_payable: [50, 55],
      },
      cash_flow: {
        operating_cash_flow: [220, 270],
        capex: [-50, -60],
      },
    };

    const statements = adaptFinancialStatementsToSecPeriodStatements(fs);
    assert.deepEqual(statements, [], 'Raw FinancialStatementsData without SEC provenance must return empty array');
    const diff = diffSecFinancialStatements(statements);
    assert.equal(diff, null, 'Unverified statements cannot produce SEC filing diff');
  });

  it('Proof 1: AI/report revenue differs from SEC revenue -> SEC Filing Diff MUST use SEC revenue', () => {
    const report: Partial<ReportData> = {
      ticker: 'AAPL',
      financial_statements: {
        periods: ['FY2023', 'FY2024'],
        income_statement: {
          revenue: [999999, 888888], // Fabricated AI values
          net_income: [100000, 100000],
        },
        balance_sheet: {},
        cash_flow: {},
      },
      canonical_financials: {
        schemaVersion: '1.0',
        ticker: 'AAPL',
        periods: ['FY2023', 'FY2024'],
        values: {
          'income_statement.revenue': [
            { period: 'FY2023', value: 383285, source: { form: '10-K', accession: '0000320193-23-000106' } },
            { period: 'FY2024', value: 391035, source: { form: '10-K', accession: '0000320193-24-000106' } },
          ],
        },
      },
    };

    const statements = adaptFinancialStatementsToSecPeriodStatements(report as ReportData);
    assert.equal(statements.length, 2);
    assert.equal(statements[0].revenue, 383285, 'Must use SEC revenue, not AI revenue');
    assert.equal(statements[1].revenue, 391035, 'Must use SEC revenue, not AI revenue');
    const diff = diffSecFinancialStatements(statements);
    assert.ok(diff);
    assert.equal(diff.revenueYoYPct, 2.02);
  });

  it('Proof 2: SEC verification eligible + arbitrary report financial statement values -> report values do NOT become SEC verified', () => {
    const reportWithEligibleEnvelopeOnly: Partial<ReportData> = {
      ticker: 'AAPL',
      financial_statements: {
        periods: ['FY2023', 'FY2024'],
        income_statement: {
          revenue: [999999, 999999],
          net_income: [100000, 100000],
        },
        balance_sheet: {},
        cash_flow: {},
      },
      sec_verification: {
        status: 'verified_eligible',
        ticker: 'AAPL',
        retrieved_at: '2025-01-01',
        provenance_status: 'verified',
        provenance_warnings: [],
        dcf_coverage: null,
        dcf_financial_inputs: {
          version: 1,
          generated_by: 'sec-verified-financial-inputs-v1',
          eligible: true,
          ticker: 'AAPL',
          periods: ['FY2023', 'FY2024'],
          source_period: 'FY2024',
          latest_balance_sheet_period_end: '2024-09-30',
          share_as_of: '2024-10-18',
          starting_revenue_m: 391035,
          trailing_four_free_cash_flow_m: 108807,
          historical_fcf_margin_pct: 27.8,
          cash_and_equivalents_m: 29942,
          short_term_investments_m: 35232,
          total_debt_m: 106629,
          net_cash_m: -41455,
          current_shares_outstanding_m: 15116,
          issues: [],
        },
        latest_statements_source: null,
      },
    };

    const statements = adaptFinancialStatementsToSecPeriodStatements(reportWithEligibleEnvelopeOnly as ReportData);
    assert.deepEqual(statements, [], 'Arbitrary report financial statements must not be adapted merely because sec_verification is eligible');
    const diff = diffSecFinancialStatements(statements);
    assert.equal(diff, null, 'SEC filing diff must be null when canonical facts are absent');
  });

  it('Proof 3: No canonical SEC comparable periods -> SEC Filing Diff unavailable', () => {
    const canonicalWithOnePeriod: Partial<ReportData> = {
      ticker: 'MSFT',
      canonical_financials: {
        schemaVersion: '1.0',
        ticker: 'MSFT',
        periods: ['FY2025'],
        values: {
          'income_statement.revenue': [{ period: 'FY2025', value: 245123 }],
        },
      },
    };

    const statements = adaptFinancialStatementsToSecPeriodStatements(canonicalWithOnePeriod as ReportData);
    assert.equal(statements.length, 1);
    const diff = diffSecFinancialStatements(statements);
    assert.equal(diff, null, 'Single period cannot produce comparable SEC filing diff');
  });

  it('Proof 6: SEC source metadata preserved on statements and diff payload', () => {
    const statements: SecPeriodStatement[] = [
      {
        ticker: 'AAPL',
        period: 'FY2025',
        form: '10-K',
        accession: '0000320193-25-000106',
        filed_date: '2025-10-31',
        period_end: '2025-09-30',
        units: 'USD',
        revenue: 400000,
        net_income: 100000,
        operating_cash_flow: 110000,
      },
      {
        ticker: 'AAPL',
        period: 'FY2024',
        form: '10-K',
        accession: '0000320193-24-000106',
        filed_date: '2024-10-31',
        period_end: '2024-09-30',
        units: 'USD',
        revenue: 390000,
        net_income: 93000,
        operating_cash_flow: 105000,
      },
    ];

    const diff = diffSecFinancialStatements(statements);
    assert.ok(diff);
    assert.equal(diff.ticker, 'AAPL');
    assert.equal(diff.currentFiling?.form, '10-K');
    assert.equal(diff.currentFiling?.accession, '0000320193-25-000106');
    assert.equal(diff.currentFiling?.filed_date, '2025-10-31');
    assert.equal(diff.priorFiling?.form, '10-K');
    assert.equal(diff.priorFiling?.accession, '0000320193-24-000106');
  });

  it('Cash conversion missing data semantics: missing OCF or NI returns unavailable, never healthy', () => {
    const statementsMissingOcf: SecPeriodStatement[] = [
      { period: 'FY2025', revenue: 1000, net_income: 200, operating_cash_flow: null },
      { period: 'FY2024', revenue: 900, net_income: 180, operating_cash_flow: 190 },
    ];
    const diff = diffSecFinancialStatements(statementsMissingOcf);
    assert.ok(diff);
    assert.equal(diff.cashConversionStatus, 'unavailable', 'Missing OCF must return unavailable status');
    assert.equal(diff.cashConversionSummary, 'Cash conversion unavailable — insufficient comparable OCF / Net Income data.');
  });

  it('Dilution missing data semantics: missing shares returns unavailable, near-zero returns stable', () => {
    const statementsMissingPriorShares: SecPeriodStatement[] = [
      { period: 'FY2025', revenue: 1000, diluted_shares: 500 },
      { period: 'FY2024', revenue: 900, diluted_shares: null },
    ];
    const diffMissing = diffSecFinancialStatements(statementsMissingPriorShares);
    assert.ok(diffMissing);
    assert.equal(diffMissing.dilutionOrBuyback, 'unavailable', 'Missing comparable shares must return unavailable');

    const statementsStableShares: SecPeriodStatement[] = [
      { period: 'FY2025', revenue: 1000, diluted_shares: 500 },
      { period: 'FY2024', revenue: 900, diluted_shares: 500 },
    ];
    const diffStable = diffSecFinancialStatements(statementsStableShares);
    assert.ok(diffStable);
    assert.equal(diffStable.dilutionOrBuyback, 'stable', 'Near-zero share change returns stable');
  });

  it('parses reverse quarterly period formats (2025-Q3 vs 2024-Q3)', () => {
    const reverseQuarterStatements = [
      {
        period: '2025-Q3',
        revenue: 80000,
      },
      {
        period: '2024-Q3',
        revenue: 70000,
      },
    ];

    const diff = diffSecFinancialStatements(reverseQuarterStatements as any);
    assert.ok(diff);
    assert.equal(diff.currentPeriod, '2025-Q3');
    assert.equal(diff.priorPeriod, '2024-Q3');
    assert.equal(diff.comparisonType, 'quarter_yoy');
    assert.equal(diff.revenueYoYPct, 14.29);
  });

  it('integration: diffSecFinancialStatements works end-to-end with real SEC mapper output', () => {
    const durationFacts = (values: number[], prefix: string, fy: number, year: number): SecCompanyFact[] => [
      { start: `${year}-01-01`, end: `${year}-03-31`, val: values[0], fy, fp: 'Q1', form: '10-Q', filed: `${year}-05-01`, accn: `${prefix}-${fy}-q1` },
      { start: `${year}-01-01`, end: `${year}-06-30`, val: values[0] + values[1], fy, fp: 'Q2', form: '10-Q', filed: `${year}-08-01`, accn: `${prefix}-${fy}-q2` },
      { start: `${year}-01-01`, end: `${year}-09-30`, val: values[0] + values[1] + values[2], fy, fp: 'Q3', form: '10-Q', filed: `${year}-11-01`, accn: `${prefix}-${fy}-q3` },
      { start: `${year}-01-01`, end: `${year}-12-31`, val: values.reduce((s, v) => s + v, 0), fy, fp: 'FY', form: '10-K', filed: `${year + 1}-02-15`, accn: `${prefix}-${fy}-fy` },
    ];

    const instantFacts = (values: number[], prefix: string, fy: number, year: number): SecCompanyFact[] => [
      { end: `${year}-03-31`, val: values[0], fy, fp: 'Q1', form: '10-Q', filed: `${year}-05-01`, accn: `${prefix}-${fy}-q1` },
      { end: `${year}-06-30`, val: values[1], fy, fp: 'Q2', form: '10-Q', filed: `${year}-08-01`, accn: `${prefix}-${fy}-q2` },
      { end: `${year}-09-30`, val: values[2], fy, fp: 'Q3', form: '10-Q', filed: `${year}-11-01`, accn: `${prefix}-${fy}-q3` },
      { end: `${year}-12-31`, val: values[3], fy, fp: 'FY', form: '10-K', filed: `${year + 1}-02-15`, accn: `${prefix}-${fy}-fy` },
    ];

    const usd = (facts: SecCompanyFact[]) => ({ label: 'usd', units: { USD: facts } });

    // 2 years of facts: FY2025 and FY2026
    const rev2025 = [100_000_000, 100_000_000, 100_000_000, 100_000_000];
    const rev2026 = [120_000_000, 120_000_000, 120_000_000, 130_000_000];

    const ni2025 = [10_000_000, 10_000_000, 10_000_000, 10_000_000];
    const ni2026 = [12_000_000, 12_000_000, 12_000_000, 15_000_000];

    const ocf2025 = [15_000_000, 15_000_000, 15_000_000, 20_000_000];
    const ocf2026 = [20_000_000, 20_000_000, 20_000_000, 26_000_000];

    const capex2025 = [5_000_000, 5_000_000, 5_000_000, 5_000_000];
    const capex2026 = [6_000_000, 6_000_000, 6_000_000, 6_000_000];

    const companyFacts: SecCompanyFactsResponse = {
      cik: 999999,
      entityName: 'Real SEC Test Corp',
      facts: {
        'us-gaap': {
          Revenues: usd([...durationFacts(rev2025, 'rev', 2025, 2025), ...durationFacts(rev2026, 'rev', 2026, 2026)]),
          NetIncomeLoss: usd([...durationFacts(ni2025, 'ni', 2025, 2025), ...durationFacts(ni2026, 'ni', 2026, 2026)]),
          NetCashProvidedByUsedInOperatingActivities: usd([...durationFacts(ocf2025, 'ocf', 2025, 2025), ...durationFacts(ocf2026, 'ocf', 2026, 2026)]),
          PaymentsToAcquirePropertyPlantAndEquipment: usd([...durationFacts(capex2025, 'capex', 2025, 2025), ...durationFacts(capex2026, 'capex', 2026, 2026)]),
          Assets: usd([...instantFacts([500e6, 500e6, 500e6, 500e6], 'ast', 2025, 2025), ...instantFacts([600e6, 600e6, 600e6, 600e6], 'ast', 2026, 2026)]),
          Liabilities: usd([...instantFacts([200e6, 200e6, 200e6, 200e6], 'liab', 2025, 2025), ...instantFacts([250e6, 250e6, 250e6, 250e6], 'liab', 2026, 2026)]),
          StockholdersEquity: usd([...instantFacts([300e6, 300e6, 300e6, 300e6], 'eq', 2025, 2025), ...instantFacts([350e6, 350e6, 350e6, 350e6], 'eq', 2026, 2026)]),
        },
      },
    };

    const identity: SecTickerRecord = { cik: '0000999999', ticker: 'SECTEST', title: 'Real SEC Test Corp' };
    const accns = ['rev-2025-fy', 'rev-2026-fy'];
    const submissions: SecSubmissionsResponse = {
      cik: identity.cik,
      filings: {
        recent: {
          accessionNumber: accns,
          primaryDocument: accns.map(a => `${a}.htm`),
          form: accns.map(() => '10-K'),
          filingDate: ['2026-02-15', '2027-02-15'],
        },
      },
    };

    // 1. Run real SEC mapper
    const canonicalDataset = mapSecBundleToCanonicalFinancials({
      identity,
      submissions,
      companyFacts,
      retrievedAt: '2027-02-16T00:00:00.000Z',
    });

    assert.ok(canonicalDataset, 'Canonical dataset must be successfully produced by SEC mapper');
    assert.equal(canonicalDataset.periods.length, 8);

    // 2. Adapt canonical dataset into SecPeriodStatement[]
    const statements = adaptFinancialStatementsToSecPeriodStatements(canonicalDataset);
    assert.equal(statements.length, 8);

    // 3. Diff statements
    const diff = diffSecFinancialStatements(statements);
    assert.ok(diff, 'Diff must not be null');
    assert.equal(diff.currentPeriod, 'Q4 2026');
    assert.equal(diff.priorPeriod, 'Q4 2025');
    assert.equal(diff.comparisonType, 'quarter_yoy');

    // Revenue: 130 vs 100 -> +30.0%
    assert.equal(diff.revenueYoYPct, 30);
    // Net Income: 15 vs 10 -> +50.0%
    assert.equal(diff.netIncomeYoYPct, 50);
    // OCF: 26 vs 20 -> +30.0%
    assert.equal(diff.ocfYoYPct, 30);
    // FCF: (26 - 6 = 20) vs (20 - 5 = 15) -> (20 - 15) / 15 = +33.33%
    assert.equal(diff.fcfYoYPct, 33.33);
  });

  describe('PR C — SEC Comparison Integrity & Provenance Guards', () => {
    it('immediate-prior-year matching: FY2025 + FY2023 returns unavailable (null)', () => {
      const gappedAnnuals = [
        { period: 'FY2025', revenue: 1000 },
        { period: 'FY2023', revenue: 800 },
      ];
      const diff = diffSecFinancialStatements(gappedAnnuals);
      assert.equal(diff, null, 'Gapped annual comparison (FY2025 vs FY2023) must return null');
    });

    it('immediate-prior-year matching: Q3 2025 + Q3 2023 returns unavailable (null)', () => {
      const gappedQuarters = [
        { period: 'Q3 2025', revenue: 500 },
        { period: 'Q3 2023', revenue: 400 },
      ];
      const diff = diffSecFinancialStatements(gappedQuarters);
      assert.equal(diff, null, 'Gapped quarter comparison (Q3 2025 vs Q3 2023) must return null');
    });

    it('immediate-prior-year matching: FY2025 + FY2024 is valid', () => {
      const validAnnuals = [
        { period: 'FY2025', revenue: 1100 },
        { period: 'FY2024', revenue: 1000 },
      ];
      const diff = diffSecFinancialStatements(validAnnuals);
      assert.ok(diff, 'Consecutive annuals (FY2025 vs FY2024) must evaluate successfully');
      assert.equal(diff.currentPeriod, 'FY2025');
      assert.equal(diff.priorPeriod, 'FY2024');
      assert.equal(diff.revenueYoYPct, 10);
    });

    it('immediate-prior-year matching: Q3 2025 + Q3 2024 is valid', () => {
      const validQuarters = [
        { period: 'Q3 2025', revenue: 550 },
        { period: 'Q3 2024', revenue: 500 },
      ];
      const diff = diffSecFinancialStatements(validQuarters);
      assert.ok(diff, 'Same-quarter YoY (Q3 2025 vs Q3 2024) must evaluate successfully');
      assert.equal(diff.currentPeriod, 'Q3 2025');
      assert.equal(diff.priorPeriod, 'Q3 2024');
      assert.equal(diff.revenueYoYPct, 10);
    });

    it('SEC provenance guard: unverified ReportData with valid statement shape must NOT become Verified SEC Filing Comparison', () => {
      const unverifiedReport: Partial<ReportData> = {
        ticker: 'TSLA',
        financial_statements: {
          periods: ['FY2024', 'FY2025'],
          income_statement: {
            revenue: [96773, 97690],
            net_income: [14997, 7084],
          },
          balance_sheet: {},
          cash_flow: {},
        },
        // sec_verification is completely absent / unverified
      };

      const statements = adaptFinancialStatementsToSecPeriodStatements(unverifiedReport as ReportData);
      assert.deepEqual(statements, [], 'Unverified ReportData must produce empty statements array');
      const diff = diffSecFinancialStatements(statements);
      assert.equal(diff, null, 'Unverified ReportData must NOT become Verified SEC Filing Comparison');
    });

    it('historical diluted shares: returns shareCountDeltaPct = null when prior comparable shares are unavailable', () => {
      const statementsWithOnlyLatestShares = [
        { period: 'FY2025', revenue: 1000, diluted_shares: 500 },
        { period: 'FY2024', revenue: 900, diluted_shares: null },
      ];
      const diff = diffSecFinancialStatements(statementsWithOnlyLatestShares);
      assert.ok(diff);
      assert.equal(diff.shareCountDeltaPct, null, 'Missing prior diluted shares must result in null shareCountDeltaPct');
      assert.equal(diff.dilutionOrBuyback, 'unavailable', 'Missing prior diluted shares must result in unavailable dilution status');
    });

    it('historical diluted shares: calculates correct shareCountDeltaPct when comparable historical diluted shares are available', () => {
      const statementsWithBothShares = [
        { period: 'FY2025', revenue: 1000, diluted_shares: 480 },
        { period: 'FY2024', revenue: 900, diluted_shares: 500 },
      ];
      const diff = diffSecFinancialStatements(statementsWithBothShares);
      assert.ok(diff);
      // (480 - 500) / 500 * 100 = -4.00%
      assert.equal(diff.shareCountDeltaPct, -4.0);
      assert.equal(diff.dilutionOrBuyback, 'buybacks');
    });
  });
});
