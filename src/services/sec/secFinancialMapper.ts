import { STATEMENT_MAPPING_VERSION, STATEMENT_NORMALIZATION_VERSION } from '../../domain/verifiedFinancialStatements';
import { workingCapitalCashEffect } from '../../domain/workingCapitalSemantics';
import { auditCanonicalResolution } from './canonicalResolutionAudit';
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
  filingDocuments?: Array<{ html: string; documentUrl: string; accession: string; form: string; filingDate?: string }>;
  completionAttempts?: Array<{documentUrl: string; status: 'retrieved' | 'unavailable'; reasonCode?: string}>;
  completionConflicts?: Array<{metric: string; period: string; documentUrl: string; canonicalValue: number; presentationValue: number}>;
}

import { METRIC_SPECS, type MetricSpec } from './canonicalMetricDefinitions';
export { METRIC_SPECS } from './canonicalMetricDefinitions';

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

const toMillions = (value: number, unit: string) => unit === 'USD' ? Math.round(value / 1_000_000 * 1e8) / 1e8 : value;

const getConcept = (facts: SecCompanyFactsResponse, conceptName: string): SecCompanyConcept | undefined => {
  if (!facts?.facts) return undefined;
  if (facts.facts['us-gaap']?.[conceptName]) return facts.facts['us-gaap'][conceptName];
  if (facts.facts['dei']?.[conceptName]) return facts.facts['dei'][conceptName];
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
  const rawFacts = concept?.units?.[spec.unit]
    || (spec.unit === 'USD/shares' ? concept?.units?.['USD/share'] : undefined)
    || (spec.unit === 'pure' ? concept?.units?.['pure'] : undefined);
  if (!Array.isArray(rawFacts)) return [];
  return spec.factKind === 'duration'
    ? normalizeDurationFactsToStandaloneQuarters(rawFacts, { additive: spec.canonicalUnit === 'USD_M' })
    : normalizeInstantFactsToFiscalQuarters(rawFacts);
};

const mergeConceptAliases = (facts: SecCompanyFactsResponse, spec: MetricSpec, expectedEnds?: Map<string,string>) => {
  const merged = new Map<string, { fact: NormalizedSecQuarterFact; concept: string }>();
  // Priority order is intentional. Earlier standard concepts win when two concepts disclose
  // the same fiscal quarter; lower-priority aliases fill only missing periods.
  for (const conceptName of spec.concepts) {
    for (const fact of normalizeConcept(getConcept(facts, conceptName), spec)) {
      const key = quarterKey(fact);
      if (expectedEnds?.has(key) && expectedEnds.get(key) !== fact.end) continue;
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
  const presentation = fact.sourceFacts.find(f => typeof f.presentationDocumentUrl === 'string');
  return {
    provider: 'SEC EDGAR XBRL',
    accountingStandard: 'US_GAAP' as const, authorityTier: 1 as const,
    documentUrl: (presentation?.presentationDocumentUrl as string) || filing?.documentUrl || (primaryAccession ? `https://www.sec.gov/Archives/edgar/data/${Number(identity.cik)}/${primaryAccession.replace(/-/g, '')}/${primaryAccession}-index.html` : undefined),
    documentType: presentation?.presentationForm as string || filing?.form || fact.form,
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
  const primaryAccession = fact.accessionNumbers[0];
  const filing = primaryAccession ? submissionMap.get(primaryAccession) : undefined;
  const source = sourceForFact(identity, fact, submissionMap, retrievedAt);
  const sourceAccessions = fact.accessionNumbers.join(', ');
  const isWorkingCapital = spec.statement === 'cash_flow' && ['change_receivables','change_inventory','change_payables'].includes(spec.metric);
  const semantics = new Set(fact.sourceFacts.map(source => source.valueSemantic || 'BALANCE_CHANGE'));
  const cashEffect = isWorkingCapital && semantics.size === 1
    ? workingCapitalCashEffect(concept, fact.value, fact.sourceFacts[0]?.valueSemantic) : null;
  // Gross cost lines may be presented as positive expenses in one filing and
  // negative income-statement contributions in another. Subtracting those raw
  // conventions does not establish a standalone cost. Never repair this with
  // abs(): a reported credit, tax benefit, loss or cash outflow may be legitimate.
  const grossCost = spec.statement === 'income_statement' && [
    'cogs', 'operating_expenses', 'research_and_development',
    'research_and_development_excluding_acquired', 'selling_general_administrative',
  ].includes(spec.metric);
  const derivedCostSignConflict = grossCost && fact.derivation.startsWith('derived_')
    && fact.sourceFacts.some(source => typeof source.val === 'number' && source.val < 0)
    && fact.sourceFacts.some(source => typeof source.val === 'number' && source.val > 0);
  const derivation = fact.derivation === 'reported_instant'
    ? `SEC us-gaap:${concept} instant fact.`
    : fact.derivation === 'reported_standalone'
      ? `SEC us-gaap:${concept} reported standalone fiscal quarter.`
    : fact.derivation === 'reported_ytd'
      ? `SEC us-gaap:${concept} Q1 duration fact.`
      : fact.derivation === 'derived_ytd_difference'
        ? `Q${fact.fiscalQuarter} standalone = ${fact.fiscalQuarter * 3}M cumulative - ${(fact.fiscalQuarter - 1) * 3}M cumulative; compatible cumulative SEC us-gaap:${concept} facts; accessions: ${sourceAccessions}.`
        : `Fiscal Q4 deterministically derived as FY minus Q3 YTD from SEC us-gaap:${concept}; accessions: ${sourceAccessions}.`;

  return {
    metric: spec.metric,
    statement: spec.statement,
    value: derivedCostSignConflict || (isWorkingCapital && !cashEffect) ? null : spec.canonicalUnit === 'USD_M' ? toMillions(cashEffect?.value ?? fact.value, spec.unit) : spec.canonicalUnit === 'percent' && spec.unit === 'pure' ? fact.value * 100 : fact.value,
    ...(derivedCostSignConflict ? { sourceComponents: fact.sourceFacts.map(raw => ({
      metric: spec.metric, statement: spec.statement, value: toMillions(raw.val as number, spec.unit),
      unit: spec.canonicalUnit, sourceUnit: spec.unit, currency: 'USD', type: 'reported' as const,
      verification: 'verified' as const, period: raw.fp === 'FY' ? `FY ${raw.fy}` : `YTD ${raw.fp} ${raw.fy}`,
      periodType: raw.fp === 'FY' ? 'annual' : 'ytd', periodStart: raw.start, periodEnd: raw.end,
      sourceConcept: `us-gaap:${concept}`, derivation: 'Raw reported signed cost retained for source-convention reconciliation; not a standalone quarter.',
      source: sourceForFact(identity, {...fact,start:raw.start,end:raw.end!,filed:raw.filed,form:raw.form,
        accessionNumbers: raw.accn ? [raw.accn] : [], sourceFacts:[raw]},submissionMap,retrievedAt),
    })) } : {}),
    ...(isWorkingCapital ? { valueSemantic: 'CASH_FLOW_EFFECT' as const,
      signNormalization: cashEffect ? { sourceSemantic: cashEffect.sourceSemantic, sourceValue: fact.value, multiplier: cashEffect.multiplier, concept } : undefined } : {}),
    sourceUnit: spec.unit,
    unit: spec.canonicalUnit,
    period,
    periodStart: fact.start,
    durationDays: fact.durationDays, currency: 'USD',
    periodEnd: fact.end,
    fiscalYear: fact.fiscalYear,
    fiscalQuarter: fact.fiscalQuarter,
    periodType: fact.periodType,
    form: filing?.form ?? fact.form,
    accession: primaryAccession,
    concept: String(fact.sourceFacts[0]?.presentationConcept || concept),
    sourceConcept: String(fact.sourceFacts[0]?.presentationConcept || `us-gaap:${concept}`),
    canonicalMetric: `${spec.statement}.${spec.metric}`,
    mappingEvidence: fact.sourceFacts[0]?.semanticEvidence as CanonicalFinancialValue['mappingEvidence'],
    mappingType: fact.sourceFacts[0]?.presentationConcept && !String(fact.sourceFacts[0].presentationConcept).startsWith('us-gaap:')
      ? 'ISSUER_EXTENSION' : spec.concepts.indexOf(concept) > 0
        || (fact.sourceFacts[0]?.presentationConcept && fact.sourceFacts[0].presentationConcept !== `us-gaap:${spec.concepts[0]}`) ? 'ALIAS' : 'STANDARD',
    type: fact.derivation === 'reported_instant' || fact.derivation === 'reported_ytd' || fact.derivation === 'reported_standalone' ? (spec.type ?? 'reported') : 'derived',
    verification: derivedCostSignConflict || (isWorkingCapital && !cashEffect) ? 'unverified' : 'verified',
    source,
    derivation: `${derivation}${derivedCostSignConflict ? ' COST_SIGN_CONVENTION_MISMATCH: cumulative expense observations use opposite signs; standalone cost remains unavailable pending primary-statement sign reconciliation.' : ''}${fact.sourceFacts[0]?.compatibleInstantNote ? ' Exact-date authoritative note retained with identical assets/liabilities/equity anchors in the newer comparative filing; no period carry-forward.' : ''}${isWorkingCapital ? cashEffect ? ` CASH_FLOW_EFFECT = ${cashEffect.sourceSemantic} × ${cashEffect.multiplier}; normalized once after compatible standalone subtraction, never in UI/AI.` : ' Incompatible or unknown working-capital source semantics; unavailable.' : ''}`,
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
    if (ocf?.value === null || ocf?.value === undefined || investment?.value === null || investment?.value === undefined
      || ocf.period !== period || investment.period !== period
      || ocf.periodType !== 'standalone_quarter' || investment.periodType !== 'standalone_quarter'
      || (ocf.periodStart && investment.periodStart && ocf.periodStart !== investment.periodStart)
      || (ocf.periodEnd && investment.periodEnd && ocf.periodEnd !== investment.periodEnd)) {
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
      periodStart: ocf.periodStart ?? investment.periodStart,
      periodEnd: ocf.periodEnd ?? investment.periodEnd,
      fiscalYear: ocf.fiscalYear ?? investment.fiscalYear,
      fiscalQuarter: ocf.fiscalQuarter ?? investment.fiscalQuarter,
      periodType: ocf.periodType ?? investment.periodType,
      type: 'derived',
      verification: ocf.verification === 'verified' && investment.verification === 'verified' ? 'verified' : 'unverified',
      source: ocf.source, sourceComponents: [ocf, investment],
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
    if (hasStd && hasLtd && std?.concept === 'DebtCurrent' && ltd?.concept === 'LongTermDebtNoncurrent' && std?.periodEnd && std.periodEnd === ltd?.periodEnd
      && std.periodType === 'instant' && ltd?.periodType === 'instant') {
      const stdVal = std.value as number;
      const ltdVal = ltd.value as number;
      const isVerified = std.verification === 'verified' && ltd.verification === 'verified';
      return {
        metric: 'total_debt',
        statement: 'balance_sheet',
        value: stdVal + ltdVal,
        unit: 'USD_M',
        period,
        periodStart: std?.periodStart ?? ltd?.periodStart,
        periodEnd: std?.periodEnd ?? ltd?.periodEnd,
        fiscalYear: std?.fiscalYear ?? ltd?.fiscalYear,
        fiscalQuarter: std?.fiscalQuarter ?? ltd?.fiscalQuarter,
        periodType: std?.periodType ?? ltd?.periodType,
        form: std?.form ?? ltd?.form,
        accession: std?.accession ?? ltd?.accession,
        concept: 'DebtCurrent + LongTermDebtNoncurrent',
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
    if (hasCur && hasNonCur && cur?.periodEnd === nonCur?.periodEnd) {
      const curVal = hasCur ? (cur?.value as number) : 0;
      const nonCurVal = hasNonCur ? (nonCur?.value as number) : 0;
      const isVerified = (!hasCur || cur?.verification === 'verified') && (!hasNonCur || nonCur?.verification === 'verified');
      return {
        metric: 'operating_lease_liabilities',
        statement: 'balance_sheet',
        value: curVal + nonCurVal,
        unit: 'USD_M',
        period,
        periodStart: cur?.periodStart ?? nonCur?.periodStart,
        periodEnd: cur?.periodEnd ?? nonCur?.periodEnd,
        fiscalYear: cur?.fiscalYear ?? nonCur?.fiscalYear,
        fiscalQuarter: cur?.fiscalQuarter ?? nonCur?.fiscalQuarter,
        periodType: cur?.periodType ?? nonCur?.periodType,
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

  const accessionAnchors = new Map<string, SecCompanyFact>();
  const anchorConcepts = new Set(METRIC_SPECS.filter(s => ['revenue', 'total_assets'].includes(s.metric)).flatMap(s => s.concepts));
  for (const concepts of Object.values(bundle.companyFacts.facts || {})) for (const [name, concept] of Object.entries(concepts)) {
    if (!anchorConcepts.has(name)) continue;
    for (const facts of Object.values(concept.units || {})) for (const fact of facts) {
      if (!fact.accn || !fact.end || (fact.filed && fact.end > fact.filed) || !fact.fy || !['Q1', 'Q2', 'Q3', 'FY'].includes(fact.fp || '')
        || !['10-Q', '10-Q/A', '10-K', '10-K/A'].includes(fact.form || '')) continue;
      const prior = accessionAnchors.get(fact.accn);
      if (!prior?.end || fact.end > prior.end) accessionAnchors.set(fact.accn, fact);
    }
  }
  const calendar = new Map<string, SecCompanyFact>();
  for (const fact of accessionAnchors.values()) {
    const old = calendar.get(fact.end!);
    // Earliest current-period filing wins calendar identity; subsequent amendments
    // can restate values, but cannot turn its comparison into a new fiscal quarter.
    if (!old || String(fact.filed || '') < String(old.filed || '')) calendar.set(fact.end!, {...fact});
  }
  // Some issuers label an annual companyfacts fy with the calendar start year,
  // while their interim filings use the fiscal ending year. Resolve from the exact
  // common fiscal start shared by that annual duration and independently filed YTDs.
  const starts = new Map<string, Set<number>>();
  const annuals: SecCompanyFact[] = [];
  for (const concepts of Object.values(bundle.companyFacts.facts || {})) for (const concept of Object.values(concepts)) {
    for (const facts of Object.values(concept.units || {})) for (const fact of facts) {
      if (!fact.start || !fact.end) continue;
      const anchor = fact.accn ? accessionAnchors.get(fact.accn) : undefined;
      if (!anchor || anchor.end !== fact.end) continue;
      const duration = (Date.parse(fact.end) - Date.parse(fact.start)) / 86400000 + 1;
      if (fact.form?.startsWith('10-Q') && duration >= 60 && duration <= 300 && anchor.fy) {
        const years = starts.get(fact.start) || new Set<number>(); years.add(anchor.fy); starts.set(fact.start, years);
      } else if (fact.form?.startsWith('10-K') && duration >= 300 && duration <= 400) annuals.push(fact);
    }
  }
  for (const annual of annuals) {
    const years = starts.get(annual.start!);
    const anchor = calendar.get(annual.end!);
    if (years?.size === 1 && anchor) anchor.fy = [...years][0];
  }
  // A filing's fy can change convention at a new fiscal year. Use independently
  // filed FY endpoints to anchor the *ending* fiscal year of intervening quarters.
  // This also prevents Q1 after FY from colliding with the previous year's Q1.
  const yearEnds = [...calendar.values()].filter(f => f.fp === 'FY')
    .sort((a,b) => a.end!.localeCompare(b.end!));
  for (const anchor of calendar.values()) {
    if (anchor.fp === 'FY') continue;
    const previous = [...yearEnds].reverse().find(f => f.end! < anchor.end!);
    if (!previous?.fy) continue;
    const days = (Date.parse(anchor.end!) - Date.parse(previous.end!)) / 86400000;
    const range = anchor.fp === 'Q1' ? [60,110] : anchor.fp === 'Q2' ? [150,205] : [235,300];
    if (days >= range[0] && days <= range[1]) anchor.fy = previous.fy + 1;
  }
  const correctedFacts = structuredClone(bundle.companyFacts);
  for (const [namespace, concepts] of Object.entries(correctedFacts.facts || {})) for (const [conceptName, concept] of Object.entries(concepts)) {
    for (const [unit, facts] of Object.entries(concept.units || {})) for (const fact of facts) {
      const anchor = fact.end ? calendar.get(fact.end) : undefined;
      if (anchor) { fact.fy = anchor.fy; fact.fp = anchor.fp; }
      fact.sourceConcept = `${namespace}:${conceptName}`; fact.sourceUnit = unit;
      fact.accountingStandard = namespace === 'ifrs-full' ? 'IFRS' : 'US_GAAP';
    }
  }
  // A restated comparison is a filing cohort, not an independent override of one
  // balance-sheet line. Select the newest accession disclosing the accounting
  // anchors together, before normalizing any instant metric. Missing lines in
  // that accession remain missing; older values cannot fill the restated snapshot.
  const cohorts = new Map<string, Map<string, { filed: string; anchors: Set<string> }>>();
  for (const name of ['Assets', 'Liabilities', 'StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']) {
    for (const fact of correctedFacts.facts['us-gaap']?.[name]?.units?.USD || []) {
      if (fact.start || !fact.accn || !fact.end || !['10-Q','10-Q/A','10-K','10-K/A'].includes(fact.form || '')) continue;
      const byAccession = cohorts.get(fact.end) || new Map();
      const cohort = byAccession.get(fact.accn) || { filed: fact.filed || '', anchors: new Set<string>() };
      cohort.anchors.add(name); byAccession.set(fact.accn, cohort); cohorts.set(fact.end, byAccession);
    }
  }
  const chosenCohorts = new Map<string, string>();
  for (const [end, candidates] of cohorts) {
    const compatible = [...candidates].filter(([,c]) => c.anchors.has('Assets') && c.anchors.has('Liabilities')
      && (c.anchors.has('StockholdersEquity') || c.anchors.has('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest')))
      .sort(([a,x],[b,y]) => y.filed.localeCompare(x.filed) || b.localeCompare(a));
    if (compatible.length) chosenCohorts.set(end, compatible[0][0]);
  }
  const balanceFacts = structuredClone(correctedFacts);
  const sameExactInstantAnchors = (end: string, earlier: string, latest: string): boolean => {
    const pair = (name: string) => {
      const facts = correctedFacts.facts['us-gaap']?.[name]?.units?.USD?.filter(f => !f.start && f.end === end) || [];
      const a = [...new Set(facts.filter(f=>f.accn===earlier).map(f=>f.val))], b = [...new Set(facts.filter(f=>f.accn===latest).map(f=>f.val))];
      return a.length===1 && b.length===1 && typeof a[0]==='number' && a[0]===b[0];
    };
    return pair('Assets') && pair('Liabilities') && (pair('StockholdersEquity') || pair('StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'));
  };
  for (const [name,concept] of Object.entries(balanceFacts.facts['us-gaap'] || {})) for (const unit of Object.keys(concept.units || {})) {
    concept.units[unit] = concept.units[unit].filter(f => {
      if(f.start || !chosenCohorts.has(f.end) || f.accn===chosenCohorts.get(f.end)) return true;
      // Retain a separately tagged exact-date note only with identical accounting
      // anchors. Restated totals or a different instant never allow a fill.
      const compatible=name==='Goodwill' && unit==='USD' && !!f.end && !!f.accn
        && sameExactInstantAnchors(f.end,f.accn,chosenCohorts.get(f.end)!);
      if(compatible) f.compatibleInstantNote=true;
      return compatible;
    });
  }
  const metricMaps = new Map<string, Map<string, { fact: NormalizedSecQuarterFact; concept: string }>>();
  const expectedEnds = new Map([...calendar.values()].map(f => [`${f.fy}-Q${f.fp === 'FY' ? 4 : f.fp!.slice(1)}`,f.end!]));
  const quarterKeys = new Set<string>();
  for (const spec of METRIC_SPECS) {
    const mapped = mergeConceptAliases(spec.factKind === 'instant' ? balanceFacts : correctedFacts, spec, expectedEnds);
    metricMaps.set(`${spec.statement}.${spec.metric}`, mapped);
    for (const key of mapped.keys()) quarterKeys.add(key);
  }

  // Preferred distributions/redemption allocations distinguish parent earnings
  // from income available to common shareholders. Use the explicitly disclosed
  // common allocation for those issuers, never the unadjusted parent fact.
  const preferredSpecs = ['DividendsPreferredStock', 'PreferredStockDividends', 'PreferredStockRedemptionPremium'];
  const preferredPeriods = new Set<string>();
  for (const name of preferredSpecs) for (const [key, item] of mergeConceptAliases(correctedFacts,
    {statement:'income_statement',metric:'preferred_allocation',concepts:[name],unit:'USD',canonicalUnit:'USD_M',factKind:'duration'})) {
    if (item.fact.value !== 0) preferredPeriods.add(key);
  }
  const commonAllocation = mergeConceptAliases(correctedFacts,
    {statement:'income_statement',metric:'net_income_common',concepts:['NetIncomeLossAvailableToCommonStockholdersBasic'],unit:'USD',canonicalUnit:'USD_M',factKind:'duration'});
  const common = metricMaps.get('income_statement.net_income_common')!;
  const parent = metricMaps.get('income_statement.net_income_parent')!;
  const preferred = metricMaps.get('balance_sheet.preferred_equity')!;
  const commonFromParent = new Set<string>();
  for (const [key, entry] of parent) {
    const preferredFact = preferred.get(key)?.fact;
    // A disclosed zero is evidence; absence of a preferred-equity concept is not.
    // Keep EPS/basic allocations separate when a preferred distribution exists.
    if (preferredFact?.value === 0 && preferredFact.end === entry.fact.end && !preferredPeriods.has(key)) {
      common.set(key, entry); commonFromParent.add(key);
    }
  }
  for (const key of preferredPeriods) {
    if (commonAllocation.has(key)) common.set(key, commonAllocation.get(key)!);
    else common.delete(key); // Parent earnings are not a substitute for a missing common allocation.
  }

  const maxQuarters = Math.max(4, Math.min(20, options.maxQuarters ?? 12));
  const anchorMap = new Map<string, {fact: NormalizedSecQuarterFact; concept: string}>();
  // Preserve known fiscal columns even when a revenue quarter is missing. Assets
  // supply the actual quarter end; the absent duration cell stays null.
  for (const metric of ['income_statement.revenue','balance_sheet.total_assets','income_statement.operating_income','cash_flow.operating_cash_flow','income_statement.net_income','income_statement.net_income_common']) {
    for (const [key, entry] of metricMaps.get(metric) || []) if (!anchorMap.has(key)) anchorMap.set(key,entry);
  }
  if (!anchorMap.size) for (const mapped of metricMaps.values()) for (const [key,entry] of mapped) if (!anchorMap.has(key)) anchorMap.set(key,entry);
  const selectedKeys = Array.from(anchorMap?.keys() || []).sort(normalizedSort).slice(-maxQuarters);
  if (selectedKeys.length === 0) return null;
  const periods = selectedKeys.map(periodLabel);
  const submissionMap = submissionDocumentMap(bundle.identity, bundle.submissions);
  const values: Record<string, CanonicalFinancialValue[]> = {};

  for (const spec of METRIC_SPECS) {
    const key = `${spec.statement}.${spec.metric}`;
    const mapped = metricMaps.get(key) ?? new Map();
    const series = selectedKeys.map((quarter, index) => {
      const value = buildCanonicalValue(bundle.identity, spec, periods[index], mapped.get(quarter)?.fact.end === anchorMap.get(quarter)?.fact.end ? mapped.get(quarter) : undefined, submissionMap, bundle.retrievedAt);
      if (spec.metric === 'net_income_common' && commonFromParent.has(quarter) && value.value !== null) {
        const preferredSpec = METRIC_SPECS.find(s=>s.metric==='preferred_equity')!;
        const preferredValue = buildCanonicalValue(bundle.identity,preferredSpec,periods[index],preferred.get(quarter),submissionMap,bundle.retrievedAt);
        value.type = 'derived'; value.sourceComponents = [{...value,metric:'net_income_parent'},preferredValue];
        value.derivation = 'Common net income equals reported parent net income with explicitly reported zero preferred equity at this instant and no disclosed preferred allocation for this quarter.';
      }
      return value;
    });
    if (series.some(item => item.value !== null)) values[key] = series;
  }

  const fcf = deriveFreeCashFlow(periods, values);
  if (fcf?.some(item => item.value !== null)) values['cash_flow.free_cash_flow'] = fcf;

  // Some issuers disclose selling/marketing and administration separately.
  // Derive the combined expense only from two exact, verified durations. An
  // absent component is never zero and a directly reported total wins.
  const selling = values['income_statement.selling_and_marketing'];
  const administration = values['income_statement.general_and_administrative'];
  if (selling && administration) {
    const reported = values['income_statement.selling_general_administrative'];
    values['income_statement.selling_general_administrative'] = periods.map((period, i) => {
      if (reported?.[i]?.value != null) return reported[i];
      const a = selling[i], b = administration[i];
      const compatible = a?.verification === 'verified' && b?.verification === 'verified'
        && a.value != null && b.value != null && a.periodStart === b.periodStart
        && a.periodEnd === b.periodEnd && a.periodType === 'standalone_quarter'
        && b.periodType === 'standalone_quarter' && a.unit === b.unit;
      return { ...a, metric: 'selling_general_administrative', period,
        value: compatible ? a.value! + b.value! : null, type: 'derived',
        verification: compatible ? 'verified' : 'unverified',
        sourceComponents: compatible ? [a, b] : undefined,
        derivation: 'SG&A = same-period disclosed Selling and Marketing + General and Administrative; neither component is imputed.' };
    });
  }

  const parentEquity = values['balance_sheet.stockholders_equity'];
  const preferredEquity = values['balance_sheet.preferred_equity'];
  if (parentEquity && preferredEquity) values['balance_sheet.common_equity'] = periods.map((period,i)=>{
    const parent=parentEquity[i], preferred=preferredEquity[i];
    const compatible=parent?.value!=null&&preferred?.value!=null&&parent.periodEnd===preferred.periodEnd;
    return {...parent,metric:'common_equity',period,value:compatible?parent.value!-preferred.value!:null,
      type:'derived',verification:compatible?'verified':'unverified',sourceComponents:compatible?[parent,preferred]:undefined,
      derivation:'Common stockholders equity = same-instant parent stockholders equity - explicitly reported preferred equity; an undisclosed preferred component is not assumed zero.'};
  });

  const derivedDebt = deriveTotalDebt(periods, values);
  if (derivedDebt?.some(item => item.value !== null)) values['balance_sheet.total_debt'] = derivedDebt;

  const derivedLeases = deriveTotalOperatingLeases(periods, values);
  if (derivedLeases?.some(item => item.value !== null)) values['balance_sheet.operating_lease_liabilities'] = derivedLeases;

  const flattened = Object.values(values).flat();
  const nonNullValues = flattened.filter(item => item.value !== null).length;
  const verifiedValues = flattened.filter(item => item.value !== null && item.verification === 'verified').length;
  const missingValues = flattened.length - nonNullValues;

  const dataset: CanonicalFinancialDataset = {
    schemaVersion: CANONICAL_FINANCIAL_SCHEMA_VERSION,
    mappingVersion: STATEMENT_MAPPING_VERSION, normalizationVersion: STATEMENT_NORMALIZATION_VERSION,
    generatedBy: `${CANONICAL_FINANCIAL_GENERATOR}+sec-xbrl-v2`,
    ticker: bundle.identity.ticker,
    currency: 'USD',
    periods,
    values,
    provenanceStatus: verifiedValues > 0 && verifiedValues === nonNullValues ? 'verified' : 'unverified',
    provenanceWarnings: [
      ...(flattened.some(value => value.derivation?.includes('COST_SIGN_CONVENTION_MISMATCH')) ? [{
        code: 'COST_SIGN_CONVENTION_MISMATCH', severity: 'warning' as const,
        message: 'Some derived cost quarters have incompatible cumulative source signs. Raw observations are retained; those quarters are not certified or converted with absolute values.',
      }] : []),
      {
        code: 'SEC_XBRL_STANDARD_TAXONOMY_SCOPE',
        severity: 'info',
        message: 'Entity-wide SEC standard families and independently verified primary-statement extensions; scoped earnings and cash concepts remain separate.',
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
  for (const value of Object.values(values).flat()) value.mappingKind = value.value == null ? 'UNRESOLVED'
    : value.type === 'derived' ? 'DERIVED' : value.mappingType === 'ISSUER_EXTENSION' ? 'ISSUER_EXTENSION_VERIFIED'
    : value.mappingType === 'ALIAS' ? 'STANDARD_ALIAS' : 'STANDARD_EXACT';
  dataset.resolutionAudit = auditCanonicalResolution(correctedFacts,dataset,'unclassified',balanceFacts);
  if (dataset.resolutionAudit.health !== 'OK') dataset.provenanceWarnings.push({code:'CORE_SOURCE_COVERAGE_ANOMALY',severity:'warning',message:'Canonical core source coverage requires engineering review; inspect resolutionAudit first failing boundaries.'});
  return dataset;
}
