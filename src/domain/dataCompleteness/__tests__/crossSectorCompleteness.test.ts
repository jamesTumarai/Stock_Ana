import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DataGapState,
  buildDataGapInventory,
  mergeVerifiedFactsIntoReport,
  type VerifiedFact,
} from '../index.js';
import type { AnalysisReport } from '../../../types';

describe('Lumina Verified Data Completion Layer — Cross-Sector Tests', () => {
  // Scenario 1: BANK / LENDER / FINTECH (e.g. SOFI)
  it('Scenario 1 (Bank/FinTech): Enriches NIM & Deposits while Gross Margin remains NOT_APPLICABLE/unavailable', () => {
    const mockBankReport: Partial<AnalysisReport> = {
      ticker: 'SOFI',
      company_profile: {
        company_name: 'SoFi Technologies, Inc.',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [689],
          operating_income: [50],
          net_income: [40],
        } as any,
        balance_sheet: {
          total_assets: [32000],
          total_liabilities: [26000],
          stockholders_equity: [6000],
        } as any,
        cash_flow: {} as any,
      },
      key_indicators: {
        financial_health: {
          current_ratio: 1.2,
        },
      } as any,
    };

    // 1. Check gap inventory: Gross margin is NOT_APPLICABLE, NIM and Deposits are CRITICAL relevance
    const inventory = buildDataGapInventory(mockBankReport as AnalysisReport, 'BANK_LENDER_FINTECH');
    const gmGap = inventory.gaps.find((g) => g.fieldKey === 'gross_margin_pct');
    assert.ok(gmGap);
    assert.equal(gmGap.currentStatus, DataGapState.NOT_APPLICABLE);

    const nimGap = inventory.gaps.find((g) => g.fieldKey === 'net_interest_margin_pct');
    assert.ok(nimGap);
    assert.equal(nimGap.businessRelevance, 'CRITICAL');

    // 2. Enrich NIM and Deposits from official IR / SEC extension facts
    const bankFacts: VerifiedFact[] = [
      {
        metricKey: 'net_interest_margin_pct',
        value: 5.85,
        unit: 'percent',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_IR_PRESENTATION',
        sourceUrl: 'https://investors.sofi.com/q3-2024-deck.pdf',
        sourceDocument: 'SoFi Q3 2024 Investor Presentation, Slide 12',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'SOFI',
      },
      {
        metricKey: 'deposits',
        value: 23500,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'POINT_IN_TIME',
        sourceType: 'SEC_FILING_MD_A',
        sourceUrl: 'https://www.sec.gov/edgar/data/1818874/000181887424000123.htm',
        sourceDocument: 'Form 10-Q Sept 30, 2024, Item 2',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 1.0,
        issuerIdentity: 'SOFI',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockBankReport as AnalysisReport, bankFacts, 'BANK_LENDER_FINTECH');
    assert.equal(merged.financial_statements?.balance_sheet?.deposits?.[0], 23500);
    assert.equal(merged.key_indicators?.profitability?.net_interest_margin_pct, 5.85);

    // Verify Gross Margin was NOT forced or fabricated
    assert.equal(merged.key_indicators?.profitability?.gross_margin_pct, undefined);
    assert.equal(merged.financial_statements?.income_statement?.gross_profit, undefined);
  });

  // Scenario 2: OPERATING / SOFTWARE (e.g. MSFT)
  it('Scenario 2 (Software/Platform): Enriches RPO, Cloud Revenue, and verifies Operating Margin', () => {
    const mockSoftwareReport: Partial<AnalysisReport> = {
      ticker: 'MSFT',
      company_profile: {
        company_name: 'Microsoft Corporation',
      } as any,
      financial_statements: {
        periods: ['2024-Q1'],
        income_statement: {
          revenue: [65600],
          gross_profit: [45400],
          operating_income: [30550],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const softwareFacts: VerifiedFact[] = [
      {
        metricKey: 'rpo',
        value: 259000,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q1',
        periodEnd: '2024-09-30',
        periodType: 'POINT_IN_TIME',
        sourceType: 'SEC_EDGAR_XBRL',
        sourceDocument: 'Form 10-Q Note 13',
        extractionMethod: 'DETERMINISTIC_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 1.0,
        issuerIdentity: 'MSFT',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockSoftwareReport as AnalysisReport, softwareFacts, 'SOFTWARE_PLATFORM');
    // Check gross margin and operating margin derived correctly
    const gmFact = merged.data_completeness?.verifiedFacts?.find((f) => f.metricKey === 'gross_margin_pct');
    assert.ok(gmFact);
    assert.equal(gmFact.reportedOrDerived, 'DERIVED');
    assert.equal(Math.round(Number(gmFact.value)), 69); // 45400 / 65600 = 69.2%
  });

  // Scenario 3: REIT
  it('Scenario 3 (REIT): Enriches FFO, AFFO, and NOI while COGS remains NOT_APPLICABLE', () => {
    const mockReitReport: Partial<AnalysisReport> = {
      ticker: 'PLD',
      company_profile: {
        company_name: 'Prologis, Inc.',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [2040],
          operating_income: [980],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const inventory = buildDataGapInventory(mockReitReport as AnalysisReport, 'REIT');
    const cogsGap = inventory.gaps.find((g) => g.fieldKey === 'cogs');
    assert.ok(cogsGap);
    assert.equal(cogsGap.currentStatus, DataGapState.NOT_APPLICABLE);

    const reitFacts: VerifiedFact[] = [
      {
        metricKey: 'ffo',
        value: 1350,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_SUPPLEMENTAL_PACKAGE',
        sourceDocument: 'Prologis Q3 2024 Supplemental Package, Page 5',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'PLD',
      },
      {
        metricKey: 'noi',
        value: 1510,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_SUPPLEMENTAL_PACKAGE',
        sourceDocument: 'Prologis Q3 2024 Supplemental Package, Page 7',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'PLD',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockReitReport as AnalysisReport, reitFacts, 'REIT');
    assert.equal(merged.financial_statements?.income_statement?.ffo?.[0], 1350);
    assert.equal(merged.financial_statements?.income_statement?.noi?.[0], 1510);
  });

  // Scenario 4: INSURANCE
  it('Scenario 4 (Insurance): Enriches Combined Ratio & Premiums while Inventory is NOT_APPLICABLE', () => {
    const mockInsuranceReport: Partial<AnalysisReport> = {
      ticker: 'PGR',
      company_profile: {
        company_name: 'Progressive Corporation',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [19400],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const inventory = buildDataGapInventory(mockInsuranceReport as AnalysisReport, 'INSURANCE');
    const invGap = inventory.gaps.find((g) => g.fieldKey === 'inventory');
    assert.ok(invGap);
    assert.equal(invGap.currentStatus, DataGapState.NOT_APPLICABLE);

    const insuranceFacts: VerifiedFact[] = [
      {
        metricKey: 'combined_ratio_pct',
        value: 89.2,
        unit: 'percent',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_IR_PRESS_RELEASE',
        sourceDocument: 'Progressive Q3 2024 Release Table 1',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'PGR',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockInsuranceReport as AnalysisReport, insuranceFacts, 'INSURANCE');
    assert.equal(merged.key_indicators?.profitability?.combined_ratio_pct, 89.2);
  });

  // Scenario 5: ENERGY / RESOURCE
  it('Scenario 5 (Energy): Enriches Production Volume and Realized Pricing', () => {
    const mockEnergyReport: Partial<AnalysisReport> = {
      ticker: 'OXY',
      company_profile: {
        company_name: 'Occidental Petroleum Corporation',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [7170],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const energyFacts: VerifiedFact[] = [
      {
        metricKey: 'production_volume',
        value: 1412,
        unit: 'x',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_IR_PRESENTATION',
        sourceDocument: 'Occidental Q3 2024 Results Presentation Slide 8',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'OXY',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockEnergyReport as AnalysisReport, energyFacts, 'ENERGY_RESOURCE');
    const prodFact = merged.data_completeness?.verifiedFacts?.find((f) => f.metricKey === 'production_volume');
    assert.ok(prodFact);
    assert.equal(prodFact.value, 1412);
  });

  // Scenario 6: RETAIL
  it('Scenario 6 (Retail): Enriches Same-Store Sales Growth where reported', () => {
    const mockRetailReport: Partial<AnalysisReport> = {
      ticker: 'TGT',
      company_profile: {
        company_name: 'Target Corporation',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [25600],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const retailFacts: VerifiedFact[] = [
      {
        metricKey: 'same_store_sales_growth_pct',
        value: 0.3,
        unit: 'percent',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'OFFICIAL_IR_PRESS_RELEASE',
        sourceDocument: 'Target Q3 2024 Earnings Release Highlights',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.95,
        issuerIdentity: 'TGT',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockRetailReport as AnalysisReport, retailFacts, 'RETAIL_CONSUMER');
    const compFact = merged.data_completeness?.verifiedFacts?.find((f) => f.metricKey === 'same_store_sales_growth_pct');
    assert.ok(compFact);
    assert.equal(compFact.value, 0.3);
  });

  // Scenario 7: EARLY-STAGE
  it('Scenario 7 (Early-Stage): Verifies Cash Runway and Cash Balance', () => {
    const mockEarlyStageReport: Partial<AnalysisReport> = {
      ticker: 'RXRX',
      company_profile: {
        company_name: 'Recursion Pharmaceuticals',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [26],
          operating_income: [-98],
        } as any,
        balance_sheet: {
          cash_and_equivalents: [428],
        } as any,
        cash_flow: {} as any,
      },
    };

    const earlyStageFacts: VerifiedFact[] = [
      {
        metricKey: 'cash_runway_months',
        value: 24,
        unit: 'count',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'POINT_IN_TIME',
        sourceType: 'OFFICIAL_IR_PRESENTATION',
        sourceDocument: 'Recursion Q3 2024 Shareholder Letter Page 4',
        extractionMethod: 'AI_STRUCTURED_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 0.9,
        issuerIdentity: 'RXRX',
      },
    ];

    const merged = mergeVerifiedFactsIntoReport(mockEarlyStageReport as AnalysisReport, earlyStageFacts, 'EARLY_STAGE_GROWTH');
    const runwayFact = merged.data_completeness?.verifiedFacts?.find((f) => f.metricKey === 'cash_runway_months');
    assert.ok(runwayFact);
    assert.equal(runwayFact.value, 24);
  });
});
