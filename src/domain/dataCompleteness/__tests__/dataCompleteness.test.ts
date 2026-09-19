import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DataGapState,
  normalizeFinancialUnit,
  resolveSecExtensionConcepts,
  buildDataGapInventory,
  reconcileMetricCandidates,
  mergeVerifiedFactsIntoReport,
  getDataGapExplanation,
  type VerifiedFact,
  type DataCandidate,
} from '../index.js';
import type { AnalysisReport } from '../../../types';

describe('Lumina Verified Data Completion Layer — Unit Tests', () => {
  // 1. Found on official source (SEC/IR) -> VERIFIED_AVAILABLE, exact provenance retained
  it('Test 1: Official source resolves gap to VERIFIED_AVAILABLE with exact provenance retained', () => {
    const candidate: DataCandidate = {
      metricKey: 'net_interest_margin_pct',
      value: 5.85,
      unit: 'percent',
      fiscalPeriod: '2024-Q3',
      sourceType: 'OFFICIAL_IR_PRESENTATION',
      sourceUrl: 'https://investors.sofi.com/q3-2024-presentation.pdf',
      sourceDocument: 'SoFi Q3 2024 Investor Presentation, Page 12',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      issuerIdentity: 'SOFI',
    };

    const reconciled = reconcileMetricCandidates('net_interest_margin_pct', [candidate], '2024-Q3');
    assert.ok(reconciled, 'Candidate should reconcile successfully');
    assert.equal(reconciled.verificationStatus, 'VERIFIED_AVAILABLE');
    assert.equal(reconciled.value, 5.85);
    assert.equal(reconciled.sourceType, 'OFFICIAL_IR_PRESENTATION');
    assert.equal(reconciled.sourceDocument, 'SoFi Q3 2024 Investor Presentation, Page 12');
    assert.notEqual(reconciled.sourceDocument, 'Gemini', 'Source document must not be AI model name');
  });

  // 2. AI extraction from official doc -> original document is source, not Gemini
  it('Test 2: AI extraction retains original official document as source authority, never Gemini', () => {
    const candidate: DataCandidate = {
      metricKey: 'deposits',
      value: 23500,
      unit: 'USD millions',
      fiscalPeriod: '2024-Q3',
      sourceType: 'SEC_FILING_MD_A',
      sourceUrl: 'https://www.sec.gov/edgar/data/1818874/000181887424000123.htm',
      sourceDocument: 'Form 10-Q for Period Ended Sept 30, 2024, MD&A Table 4',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      issuerIdentity: 'SOFI',
    };

    const reconciled = reconcileMetricCandidates('deposits', [candidate], '2024-Q3');
    assert.ok(reconciled);
    assert.equal(reconciled.sourceDocument, 'Form 10-Q for Period Ended Sept 30, 2024, MD&A Table 4');
    assert.equal(reconciled.extractionMethod, 'AI_STRUCTURED_EXTRACTION');
    assert.notEqual(reconciled.sourceDocument, 'Gemini');
    assert.notEqual(reconciled.sourceDocument, 'AI');
  });

  // 3. Period mismatch -> fails closed, does not fill target period with different period
  it('Test 3: Period mismatch fails closed (does not fill 2024-Q3 with FY2023 or 2024-Q2 data)', () => {
    const candidate: DataCandidate = {
      metricKey: 'net_interest_margin_pct',
      value: 6.02,
      unit: 'percent',
      fiscalPeriod: 'FY2023',
      sourceType: 'SEC_EDGAR_XBRL',
      sourceDocument: 'Form 10-K FY2023',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'DETERMINISTIC_EXTRACTION',
      issuerIdentity: 'SOFI',
    };

    const reconciled = reconcileMetricCandidates('net_interest_margin_pct', [candidate], '2024-Q3');
    assert.equal(reconciled, null, 'Candidate with mismatched period must be rejected (fail-closed)');
  });

  // 4. Unit mismatch -> normalizes USD billions/thousands to millions without error
  it('Test 4: Unit normalizer correctly scales units without 1000x silent errors', () => {
    // Billions to Millions
    const normalizedB = normalizeFinancialUnit(45.5, 'USD billions', 'USD millions');
    assert.ok(normalizedB);
    assert.equal(normalizedB.normalizedValue, 45500);
    assert.equal(normalizedB.normalizedUnit, 'USD millions');
    assert.equal(normalizedB.originalUnit, 'USD billions');

    // Thousands to Millions
    const normalizedK = normalizeFinancialUnit(125000, 'USD thousands', 'USD millions');
    assert.ok(normalizedK);
    assert.equal(normalizedK.normalizedValue, 125);

    // Raw USD to Millions
    const normalizedRaw = normalizeFinancialUnit(500000000, 'USD', 'USD millions');
    assert.ok(normalizedRaw);
    assert.equal(normalizedRaw.normalizedValue, 500);

    // Basis points to Percent
    const normalizedBps = normalizeFinancialUnit(585, 'basis points', 'percent');
    assert.ok(normalizedBps);
    assert.equal(normalizedBps.normalizedValue, 5.85);

    // Decimal ratio to Percent
    const normalizedRatio = normalizeFinancialUnit(0.145, 'ratio', 'percent');
    assert.ok(normalizedRatio);
    assert.equal(normalizedRatio.normalizedValue, 14.5);
  });

  // 5. Company-specific XBRL extension mapping from non-us-gaap namespace
  it('Test 5: Company-specific XBRL extension tags are resolved across namespaces', () => {
    const mockSecFacts = {
      cik: 1818874,
      entityName: 'SoFi Technologies, Inc.',
      facts: {
        'us-gaap': {
          Revenues: {
            units: {
              USD: [{ end: '2024-09-30', val: 689000000, fy: 2024, fp: 'Q3', form: '10-Q' }],
            },
          },
        },
        sofi: {
          NetInterestMargin: {
            units: {
              pure: [{ end: '2024-09-30', val: 0.0585, fy: 2024, fp: 'Q3', form: '10-Q' }],
            },
          },
          TotalDeposits: {
            units: {
              USD: [{ end: '2024-09-30', val: 23500000000, fy: 2024, fp: 'Q3', form: '10-Q' }],
            },
          },
        },
      },
    };

    const resolved = resolveSecExtensionConcepts(mockSecFacts, 'BANK_LENDER_FINTECH', '2024-09-30');
    assert.ok(resolved.net_interest_margin_pct, 'NIM from company extension must be resolved');
    assert.equal(resolved.net_interest_margin_pct.value, 5.85); // 0.0585 converted to 5.85%
    assert.equal(resolved.net_interest_margin_pct.sourceType, 'SEC_FILING_TABLE');

    assert.ok(resolved.deposits, 'Deposits from company extension must be resolved');
    assert.equal(resolved.deposits.value, 23500); // 23.5B converted to 23500M
  });

  // 6. Report-wide gap classification (all 9 states distinct, no generic N/A collapse)
  it('Test 6: All 9 data gap states are preserved and provide distinct explanations', () => {
    const states: (keyof typeof DataGapState)[] = [
      'VERIFIED_AVAILABLE',
      'VERIFIED_DERIVED',
      'NOT_REPORTED',
      'NOT_APPLICABLE',
      'NOT_FOUND_YET',
      'EXTRACTION_GAP',
      'FOUND_UNVERIFIED',
      'SOURCE_CONFLICT',
      'INSUFFICIENT_PERIOD_DATA',
    ];

    const thExplanations = new Set<string>();
    const enExplanations = new Set<string>();

    for (const state of states) {
      const exp = getDataGapExplanation(state);
      assert.ok(exp.th, `State ${state} must have Thai explanation`);
      assert.ok(exp.en, `State ${state} must have English explanation`);
      thExplanations.add(exp.th);
      enExplanations.add(exp.en);
    }

    assert.equal(thExplanations.size, 9, 'All 9 Thai explanations must be unique');
    assert.equal(enExplanations.size, 9, 'All 9 English explanations must be unique');
  });

  // 7. True not-reported test -> metric absent across all tiers is NOT_REPORTED
  it('Test 7: Metrics confirmed absent from all official tiers are classified as NOT_REPORTED', () => {
    const mockReport: Partial<AnalysisReport> = {
      ticker: 'JNJ',
      company_profile: {
        company_name: 'Johnson & Johnson',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [21400],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const inventory = buildDataGapInventory(mockReport as AnalysisReport, 'GENERAL_CORPORATE');
    const rpoGap = inventory.gaps.find((g) => g.fieldKey === 'rpo');
    assert.ok(rpoGap, 'RPO gap should be inventoried');
    assert.equal(rpoGap.currentStatus, DataGapState.NOT_REPORTED);
  });

  // 8. Not-applicable test -> Bank inventory is NOT_APPLICABLE without search
  it('Test 8: Bank/Fintech inventory is classified as NOT_APPLICABLE without searching', () => {
    const mockBankReport: Partial<AnalysisReport> = {
      ticker: 'SOFI',
      company_profile: {
        company_name: 'SoFi Technologies',
      } as any,
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [689],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
    };

    const inventory = buildDataGapInventory(mockBankReport as AnalysisReport, 'BANK_LENDER_FINTECH');
    const invGap = inventory.gaps.find((g) => g.fieldKey === 'inventory');
    assert.ok(invGap, 'Inventory gap should be inventoried for bank');
    assert.equal(invGap.currentStatus, DataGapState.NOT_APPLICABLE);
    assert.equal(invGap.businessRelevance, 'LOW');
  });

  // 9. Conflict test -> disagreeing sources produce SOURCE_CONFLICT
  it('Test 9: Conflicting values across equal authority sources produce SOURCE_CONFLICT', () => {
    const candidateA: DataCandidate = {
      metricKey: 'net_interest_margin_pct',
      value: 5.9,
      unit: 'percent',
      fiscalPeriod: '2024-Q3',
      sourceType: 'OFFICIAL_IR_PRESENTATION',
      sourceDocument: 'Presentation Deck Slide 14',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      issuerIdentity: 'XYZ',
    };

    const candidateB: DataCandidate = {
      metricKey: 'net_interest_margin_pct',
      value: 6.4,
      unit: 'percent',
      fiscalPeriod: '2024-Q3',
      sourceType: 'OFFICIAL_IR_PRESS_RELEASE',
      sourceDocument: 'Earnings Press Release Page 3',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      issuerIdentity: 'XYZ',
    };

    const reconciled = reconcileMetricCandidates('net_interest_margin_pct', [candidateA, candidateB], '2024-Q3');
    assert.ok(reconciled, 'Must return a reconciled record representing conflict');
    assert.equal(reconciled.verificationStatus, 'SOURCE_CONFLICT');
    assert.equal(reconciled.value, null, 'Value must be null when in conflict');
    assert.equal(reconciled.conflictDetails?.candidates.length, 2);
  });

  // 10. Derived data -> marked VERIFIED_DERIVED
  it('Test 10: Derived metrics from verified components are labeled VERIFIED_DERIVED', () => {
    const verifiedFacts: VerifiedFact[] = [
      {
        metricKey: 'revenue',
        value: 1000,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'SEC_EDGAR_XBRL',
        sourceDocument: '10-Q',
        extractionMethod: 'DETERMINISTIC_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 1.0,
        issuerIdentity: 'CORP',
      },
      {
        metricKey: 'gross_profit',
        value: 400,
        unit: 'USD_M',
        fiscalPeriod: '2024-Q3',
        periodEnd: '2024-09-30',
        periodType: 'DURATION_QUARTER',
        sourceType: 'SEC_EDGAR_XBRL',
        sourceDocument: '10-Q',
        extractionMethod: 'DETERMINISTIC_EXTRACTION',
        reportedOrDerived: 'REPORTED',
        verificationStatus: 'VERIFIED_AVAILABLE',
        confidence: 1.0,
        issuerIdentity: 'CORP',
      },
    ];

    const baseReport: Partial<AnalysisReport> = {
      ticker: 'CORP',
      financial_statements: {
        periods: ['2024-Q3'],
        income_statement: {
          revenue: [1000],
          gross_profit: [400],
        } as any,
        balance_sheet: {} as any,
        cash_flow: {} as any,
      },
      key_indicators: {
        financial_health: {
          current_ratio: 1.5,
        },
      } as any,
    };

    const merged = mergeVerifiedFactsIntoReport(baseReport as AnalysisReport, verifiedFacts, 'GENERAL_CORPORATE');
    const gmFact = merged.data_completeness?.verifiedFacts?.find((f) => f.metricKey === 'gross_margin_pct');
    assert.ok(gmFact, 'Gross margin should be derived');
    assert.equal(gmFact.reportedOrDerived, 'DERIVED');
    assert.equal(gmFact.verificationStatus, 'VERIFIED_DERIVED');
    assert.equal(gmFact.value, 40); // 400 / 1000 * 100
  });

  // 11. No AI numeric inference: unverified conjecture is rejected
  it('Test 11: Unverified AI numeric inference is rejected from verified facts', () => {
    const candidate: DataCandidate = {
      metricKey: 'net_interest_margin_pct',
      value: 6.0, // AI guessed ~6%
      unit: 'percent',
      fiscalPeriod: '2024-Q3',
      sourceType: 'EXTERNAL_CROSS_CHECK',
      sourceDocument: 'Management commentary conjecture',
      reportedOrDerived: 'REPORTED',
      extractionMethod: 'AI_STRUCTURED_EXTRACTION',
      issuerIdentity: 'UNKNOWN',
    };

    // External tier without corroboration or official identity fails verification
    const reconciled = reconcileMetricCandidates('net_interest_margin_pct', [candidate], '2024-Q3');
    assert.ok(reconciled);
    assert.equal(reconciled.verificationStatus, 'FOUND_UNVERIFIED');
    assert.equal(reconciled.value, null, 'Unverified AI conjecture must not populate value');
  });
});
