import type { CandidateDefinition } from '../../src/domain/valuation/__fixtures__/peerUniverse.js';
import type { PeerCompanyItem } from '../../src/types.js';
import { calculateCanonicalRoic } from '../../src/domain/valuation/canonicalRoic.js';
import { validTrailingFourQuarterLabels } from '../../src/domain/valuation/canonicalQuarterWindow.js';
import {
  fetchSecVerifiedIntegrationPackage,
  type SecVerifiedIntegrationPackage,
} from '../../src/services/sec/secIntegration.js';
import {
  createSecEdgarClientFromEnv,
  type SecEdgarClient,
} from '../../src/services/sec/secClient.js';
import type { CanonicalFinancialValue } from '../../src/domain/financialValue.js';

export interface EnrichedPeerMetricObservation {
  value: number | null;
  unit: string;
  period: string;
  source: string;
  reportedOrDerived: 'REPORTED' | 'DERIVED';
  status: 'VERIFIED' | 'FOUND_UNVERIFIED' | 'NOT_REPORTED';
  asOfDate?: string;
  basis?: string;
  periodBasis?: 'TTM' | 'ANNUAL' | 'QUARTERLY';
  reason?: string;
  reasonTh?: string;
  conceptsUsed?: string[];
  inputsUsed?: Record<string, number>;
}

export interface PeerEnrichmentOptions {
  maxCandidates?: number;
  concurrency?: number;
  timeoutMs?: number;
  client?: SecEdgarClient;
  secPackageFetcher?: (ticker: string) => Promise<SecVerifiedIntegrationPackage>;
}

export interface PeerDataGapItem {
  ticker: string;
  metric: string;
  reason: string;
  attemptedSources: string[];
  periodNeeded?: string;
}

const enrichmentCache = new Map<string, { timestamp: number; candidate: CandidateDefinition }>();
const ENRICHMENT_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function clearPeerEnrichmentCache() {
  enrichmentCache.clear();
}

const rounded = (v: number) => Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Derives previous fiscal year's same-quarter label, e.g.:
 * 'Q2 2025' -> 'Q2 2024'
 * 'Q4 FY2025' -> 'Q4 FY2024'
 */
function findPriorYearQuarter(currentPeriod: string, availablePeriods: string[]): string | undefined {
  const match = currentPeriod.match(/^(Q[1-4])\s*(?:FY)?(\d{4})$/i);
  if (!match) return undefined;
  const quarter = match[1].toUpperCase();
  const year = parseInt(match[2], 10);
  const targetPrior = `${quarter} ${year - 1}`;
  const targetPriorFy = `${quarter} FY${year - 1}`;

  return availablePeriods.find(
    p => p.toUpperCase() === targetPrior || p.toUpperCase() === targetPriorFy
  );
}

/**
 * Enriches a single peer candidate with verified SEC EDGAR company facts.
 */
export async function enrichPeerCandidate(
  cand: CandidateDefinition | PeerCompanyItem,
  options: PeerEnrichmentOptions = {}
): Promise<{ candidate: CandidateDefinition; gaps: PeerDataGapItem[] }> {
  const ticker = (cand.ticker || (cand as any).symbol || '').toUpperCase().trim();
  const gaps: PeerDataGapItem[] = [];

  // Check cache
  const cached = enrichmentCache.get(ticker);
  if (cached && (Date.now() - cached.timestamp < ENRICHMENT_CACHE_TTL_MS)) {
    return { candidate: cached.candidate, gaps };
  }

  // Normalize base CandidateDefinition
  const baseCand: CandidateDefinition = 'metrics' in cand && typeof cand.metrics === 'object'
    ? { ...cand }
    : {
        ticker,
        companyName: (cand as PeerCompanyItem).company_name || ticker,
        archetype: (cand as any).archetype || 'general_operating',
        sector: (cand as any).sector || 'Unknown',
        industry: (cand as any).industry || 'Unknown',
        subIndustry: (cand as any).subIndustry || 'general',
        revenueModels: ['product_sales'],
        majorBusinessLines: [(cand as any).industry || 'General'],
        geography: 'US',
        lifecycle: (cand as any).lifecycle || 'mature',
        profitabilityState: (cand as any).profitabilityState || 'profitable',
        capitalIntensity: 'moderate',
        regulatoryType: 'standard',
        scaleTier: (cand as any).scaleTier || 'mid',
        metrics: {
          pe_trailing: {
            value: typeof (cand as PeerCompanyItem).pe_trailing === 'number' ? (cand as PeerCompanyItem).pe_trailing as number : null,
            unit: 'x',
            period: 'TTM',
            source: (cand as PeerCompanyItem).financial_source || 'Market Data',
            reportedOrDerived: 'REPORTED',
          },
        },
      };

  const metrics: Record<string, EnrichedPeerMetricObservation> = {};
  if (baseCand.metrics) {
    for (const [k, v] of Object.entries(baseCand.metrics)) {
      metrics[k] = {
        value: v.value,
        unit: v.unit || '',
        period: v.period || 'Latest',
        source: v.source || 'Market Data',
        reportedOrDerived: v.reportedOrDerived || 'REPORTED',
        status: (v as any).status || (v.value !== null ? 'VERIFIED' : 'NOT_REPORTED'),
        periodBasis: (v as any).periodBasis,
        basis: (v as any).basis,
        reason: (v as any).reason,
        reasonTh: (v as any).reasonTh,
      };
    }
  }
  // Discovery/AI candidate percentages have no accounting definition. Recompute
  // these two semantic fields from period-matched SEC facts or leave them absent.
  delete metrics.revenue_growth_yoy_pct;
  delete metrics.operating_margin_pct;

  const fetchPkg = options.secPackageFetcher || (async (t: string) => {
    const client = options.client || createSecEdgarClientFromEnv();
    return fetchSecVerifiedIntegrationPackage(t, client);
  });

  try {
    const timeoutMs = options.timeoutMs || 5000;
    const pkg = await Promise.race([
      fetchPkg(ticker),
      new Promise<SecVerifiedIntegrationPackage>((_, reject) =>
        setTimeout(() => reject(new Error(`SEC enrichment timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    if (!pkg?.canonicalFinancials || pkg.canonicalFinancials.provenanceStatus !== 'verified' || !/sec-xbrl/i.test(pkg.canonicalFinancials.generatedBy || '') || pkg.canonicalFinancials.periods.length === 0) {
      gaps.push({
        ticker,
        metric: 'canonical_financials',
        reason: 'SEC Company Facts unavailable or non-reporting issuer',
        attemptedSources: ['SEC EDGAR XBRL Company Facts'],
      });
      const finalCand: CandidateDefinition = { ...baseCand, metrics: metrics as any };
      enrichmentCache.set(ticker, { timestamp: Date.now(), candidate: finalCand });
      return { candidate: finalCand, gaps };
    }

    const { periods, values } = pkg.canonicalFinancials;
    const latestIndex = periods.length - 1;
    const latestPeriod = periods[latestIndex];

    const getVal = (key: string, idx = latestIndex): CanonicalFinancialValue | undefined => {
      const item = values[key]?.[idx];
      return item && (!item.period || item.period === periods[idx]) && item.verification !== 'unverified'
        ? item : undefined;
    };

    // Priority 1: Income Statement Fundamentals
    const revFact = getVal('income_statement.revenue');
    const opIncFact = getVal('income_statement.operating_income');
    const netIncFact = getVal('income_statement.net_income');
    const grossProfitFact = getVal('income_statement.gross_profit');
    const pretaxFact = getVal('income_statement.income_before_tax');
    const taxFact = getVal('income_statement.income_tax_expense');

    // Priority 2: Balance Sheet Fundamentals
    const debtFact = getVal('balance_sheet.total_debt');
    const equityFact = getVal('balance_sheet.total_equity');
    const cashFact = getVal('balance_sheet.cash_and_equivalents');
    const shortInvFact = getVal('balance_sheet.short_term_investments');

    const sourceDoc = revFact?.source?.documentType ? `SEC Form ${revFact.source.documentType}` : 'SEC EDGAR 10-Q';
    const conceptOf = (item?: CanonicalFinancialValue) =>
      String(item?.derivation || '').match(/us-gaap:([A-Za-z0-9]+)/)?.[1];

    // Store verified raw fundamental facts
    if (finite(revFact?.value)) {
      metrics.revenue = {
        value: revFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }
    if (finite(opIncFact?.value)) {
      metrics.operating_income = {
        value: opIncFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }
    if (finite(debtFact?.value)) {
      metrics.total_debt = {
        value: debtFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }
    if (finite(equityFact?.value)) {
      metrics.total_equity = {
        value: equityFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }
    if (finite(cashFact?.value)) {
      metrics.cash_and_equivalents = {
        value: cashFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }
    if (finite(shortInvFact?.value)) {
      metrics.short_term_investments = {
        value: shortInvFact.value,
        unit: 'USD_M',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
      };
    }

    // SECTION 8: Derive Peer Revenue Growth YoY (same-quarter prior year)
    const priorPeriod = findPriorYearQuarter(latestPeriod, periods);
    const priorIndex = priorPeriod ? periods.indexOf(priorPeriod) : -1;
    if (priorIndex !== -1 && finite(revFact?.value)) {
      const priorRevFact = getVal('income_statement.revenue', priorIndex);
      if (finite(priorRevFact?.value) && priorRevFact.value > 0
        && (!conceptOf(revFact) || !conceptOf(priorRevFact) || conceptOf(revFact) === conceptOf(priorRevFact))) {
        const growthYoY = rounded(((revFact.value - priorRevFact.value) / priorRevFact.value) * 100);
        metrics.revenue_growth_yoy_pct = {
          value: growthYoY,
          unit: '%',
          period: latestPeriod,
          periodBasis: 'QUARTERLY',
          basis: `${latestPeriod} vs ${priorPeriod}`,
          source: `${sourceDoc} (${latestPeriod} vs ${priorPeriod})`,
          reportedOrDerived: 'DERIVED',
          status: 'VERIFIED',
          conceptsUsed: [revFact.derivation || 'income_statement.revenue', priorRevFact.derivation || 'income_statement.revenue'],
          inputsUsed: { currentRevenue: revFact.value, priorYearRevenue: priorRevFact.value },
        };
      } else {
        gaps.push({
          ticker,
          metric: 'revenue_growth_yoy_pct',
          reason: conceptOf(revFact) && conceptOf(priorRevFact) && conceptOf(revFact) !== conceptOf(priorRevFact)
            ? 'Revenue concept differs from the prior-year comparable quarter'
            : 'Prior-year comparable quarter revenue is non-positive or unavailable',
          attemptedSources: ['SEC EDGAR XBRL'],
          periodNeeded: priorPeriod,
        });
      }
    } else {
      gaps.push({
        ticker,
        metric: 'revenue_growth_yoy_pct',
        reason: 'No exact prior-year comparable quarter in disclosed history',
        attemptedSources: ['SEC EDGAR XBRL'],
      });
    }

    // SECTION 9: Derive Peer Operating Margin (same standalone quarter)
    if (finite(opIncFact?.value) && finite(revFact?.value) && revFact.value > 0
      && (!opIncFact.periodEnd || !revFact.periodEnd || opIncFact.periodEnd === revFact.periodEnd)) {
      metrics.operating_margin_pct = {
        value: rounded((opIncFact.value / revFact.value) * 100),
        unit: '%',
        period: latestPeriod,
        periodBasis: 'QUARTERLY',
        basis: 'Quarterly Operating Income / Revenue',
        source: sourceDoc,
        reportedOrDerived: 'DERIVED',
        status: 'VERIFIED',
        conceptsUsed: [opIncFact.derivation || 'income_statement.operating_income', revFact.derivation || 'income_statement.revenue'],
        inputsUsed: { operatingIncome: opIncFact.value, revenue: revFact.value },
      };
    } else {
      gaps.push({
        ticker,
        metric: 'operating_margin_pct',
        reason: 'Operating Income or Revenue missing or non-positive revenue',
        attemptedSources: ['SEC EDGAR XBRL'],
        periodNeeded: latestPeriod,
      });
    }

    // SECTION 10: Derive Peer Gross Margin & Net Margin
    if (finite(grossProfitFact?.value) && finite(revFact?.value) && revFact.value > 0) {
      metrics.gross_margin_pct = {
        value: rounded((grossProfitFact.value / revFact.value) * 100),
        unit: '%',
        period: latestPeriod,
        periodBasis: 'QUARTERLY',
        source: sourceDoc,
        reportedOrDerived: 'DERIVED',
        status: 'VERIFIED',
      };
    }
    if (finite(netIncFact?.value) && finite(revFact?.value) && revFact.value > 0) {
      metrics.net_margin_pct = {
        value: rounded((netIncFact.value / revFact.value) * 100),
        unit: '%',
        period: latestPeriod,
        periodBasis: 'QUARTERLY',
        source: sourceDoc,
        reportedOrDerived: 'DERIVED',
        status: 'VERIFIED',
      };
    }

    // SECTION 11: Derive Peer ROIC (Canonical TTM NOPAT / Average Invested Capital)
    if (periods.length >= 4 && validTrailingFourQuarterLabels(periods.slice(-4))) {
      const qIndices = [latestIndex - 3, latestIndex - 2, latestIndex - 1, latestIndex];
      const opIncs = qIndices.map(i => getVal('income_statement.operating_income', i)?.value);
      const allOpIncsValid = opIncs.every(finite);

      if (allOpIncsValid) {
        const ttmOperatingIncome = opIncs.reduce((acc, v) => acc + (v as number), 0);
        const pretaxes = qIndices.map(i => getVal('income_statement.income_before_tax', i)?.value);
        const taxes = qIndices.map(i => getVal('income_statement.income_tax_expense', i)?.value);
        const ttmPretax = pretaxes.every(finite) ? pretaxes.reduce((a, b) => a + (b as number), 0) : undefined;
        const ttmTax = taxes.every(finite) ? taxes.reduce((a, b) => a + (b as number), 0) : undefined;

        // Invested capital ending
        const endEq = equityFact?.value;
        const endDbt = debtFact?.value;
        const endCsh = cashFact?.value;
        const endSti = shortInvFact?.value ?? 0;

        if (finite(endEq) && finite(endDbt) && finite(endCsh)) {
          const endingIC = endEq + endDbt - endCsh - endSti;

          // Invested capital beginning (prefer 4 quarters ago, or 3 quarters ago)
          let begIC: number | undefined;
          const begIdx = latestIndex >= 4 ? latestIndex - 4 : latestIndex - 3;
          const begEq = getVal('balance_sheet.total_equity', begIdx)?.value;
          const begDbt = getVal('balance_sheet.total_debt', begIdx)?.value;
          const begCsh = getVal('balance_sheet.cash_and_equivalents', begIdx)?.value;
          const begSti = getVal('balance_sheet.short_term_investments', begIdx)?.value ?? 0;

          if (finite(begEq) && finite(begDbt) && finite(begCsh)) {
            begIC = begEq + begDbt - begCsh - begSti;
          }

          const roicRes = calculateCanonicalRoic({
            operatingIncome: ttmOperatingIncome,
            incomeBeforeTax: ttmPretax,
            incomeTaxExpense: ttmTax,
            beginningInvestedCapital: begIC,
            endingInvestedCapital: endingIC,
            periodBasis: 'TTM',
            periodLabel: `TTM ending ${latestPeriod}`,
            source: 'SEC EDGAR 10-Q/10-K',
          });

          if (roicRes.status === 'CALCULATED' && finite(roicRes.value)) {
            metrics.roic_pct = {
              value: roicRes.value,
              unit: '%',
              period: `TTM ending ${latestPeriod}`,
              periodBasis: 'TTM',
              basis: roicRes.basis,
              source: 'SEC EDGAR 10-Q/10-K',
              reportedOrDerived: 'DERIVED',
              status: 'VERIFIED',
            };
          } else {
            gaps.push({
              ticker,
              metric: 'roic_pct',
              reason: roicRes.reason || 'Invested capital is non-positive',
              attemptedSources: ['SEC EDGAR XBRL'],
            });
          }
        } else {
          gaps.push({
            ticker,
            metric: 'roic_pct',
            reason: 'Incomplete balance sheet components for Invested Capital',
            attemptedSources: ['SEC EDGAR XBRL'],
          });
        }
      } else {
        gaps.push({
          ticker,
          metric: 'roic_pct',
          reason: 'Incomplete 4-quarter operating income history for TTM ROIC',
          attemptedSources: ['SEC EDGAR XBRL'],
        });
      }
    } else {
      gaps.push({
        ticker,
        metric: 'roic_pct',
        reason: 'Less than 4 quarters of verified SEC filings available',
        attemptedSources: ['SEC EDGAR XBRL'],
      });
    }

    // SECTION 30: P/E N/M Semantics when TTM Earnings are verified negative
    if (periods.length >= 4 && validTrailingFourQuarterLabels(periods.slice(-4))) {
      const qIndices = [latestIndex - 3, latestIndex - 2, latestIndex - 1, latestIndex];
      const netIncs = qIndices.map(i => getVal('income_statement.net_income', i)?.value);
      if (netIncs.every(finite)) {
        const ttmNetIncome = netIncs.reduce((a, b) => a + (b as number), 0);
        if (ttmNetIncome < 0) {
          baseCand.profitabilityState = 'pre_profit';
          metrics.pe_trailing = {
            value: null,
            unit: 'x',
            period: 'TTM',
            source: sourceDoc,
            reportedOrDerived: 'REPORTED',
            status: 'VERIFIED',
            reason: 'NEGATIVE_EARNINGS',
            reasonTh: 'ผลประกอบการขาดทุนสุทธิ (Not Meaningful)',
          };
        }
      }
    } else if (finite(netIncFact?.value) && netIncFact.value < 0) {
      baseCand.profitabilityState = 'pre_profit';
      metrics.pe_trailing = {
        value: null,
        unit: 'x',
        period: latestPeriod,
        source: sourceDoc,
        reportedOrDerived: 'REPORTED',
        status: 'VERIFIED',
        reason: 'NEGATIVE_EARNINGS',
        reasonTh: 'ผลประกอบการขาดทุนสุทธิ (Not Meaningful)',
      };
    }
  } catch (error: any) {
    gaps.push({
      ticker,
      metric: 'all_fundamentals',
      reason: error?.message || 'SEC enrichment error',
      attemptedSources: ['SEC EDGAR XBRL'],
    });
  }

  const finalCand: CandidateDefinition = {
    ...baseCand,
    metrics: metrics as any,
  };

  enrichmentCache.set(ticker, { timestamp: Date.now(), candidate: finalCand });
  return { candidate: finalCand, gaps };
}

/**
 * Enriches multiple peer candidates concurrently with bounded concurrency.
 */
export async function enrichPeerCandidates(
  candidates: (CandidateDefinition | PeerCompanyItem)[],
  options: PeerEnrichmentOptions = {}
): Promise<{ enrichedCandidates: CandidateDefinition[]; allGaps: PeerDataGapItem[] }> {
  const max = options.maxCandidates || 8;
  const bounded = candidates.slice(0, max);
  const concurrency = Math.max(1, options.concurrency || 3);

  const results: CandidateDefinition[] = [];
  const allGaps: PeerDataGapItem[] = [];

  for (let i = 0; i < bounded.length; i += concurrency) {
    const chunk = bounded.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(c => enrichPeerCandidate(c, options))
    );

    for (let j = 0; j < chunkResults.length; j++) {
      const res = chunkResults[j];
      if (res.status === 'fulfilled') {
        results.push(res.value.candidate);
        allGaps.push(...res.value.gaps);
      } else {
        // Failure isolation: keep original candidate without fundamentals
        const raw = chunk[j];
        const ticker = (raw.ticker || (raw as any).symbol || '').toUpperCase().trim();
        allGaps.push({
          ticker,
          metric: 'all',
          reason: res.reason?.message || 'Peer enrichment failed',
          attemptedSources: ['SEC EDGAR'],
        });
        if ('metrics' in raw && typeof raw.metrics === 'object') {
          results.push(raw as CandidateDefinition);
        } else {
          results.push({
            ticker,
            companyName: (raw as PeerCompanyItem).company_name || ticker,
            archetype: (raw as any).archetype || 'general_operating',
            sector: (raw as any).sector || 'Unknown',
            industry: (raw as any).industry || 'Unknown',
            subIndustry: (raw as any).subIndustry || 'general',
            revenueModels: ['product_sales'],
            majorBusinessLines: [(raw as any).industry || 'General'],
            geography: 'US',
            lifecycle: 'mature',
            profitabilityState: 'profitable',
            capitalIntensity: 'moderate',
            regulatoryType: 'standard',
            scaleTier: 'mid',
            metrics: {},
          });
        }
      }
    }
  }

  return { enrichedCandidates: results, allGaps };
}

/**
 * Converts an enriched CandidateDefinition into a PeerCompanyItem for UI and report persistence.
 */
export function candidateToPeerCompanyItem(cand: CandidateDefinition): PeerCompanyItem {
  const m = (cand.metrics || {}) as Record<string, EnrichedPeerMetricObservation>;
  return {
    ticker: cand.ticker,
    company_name: cand.companyName,
    pe_trailing: (m.pe_trailing?.reason === 'NEGATIVE_EARNINGS' || (m.pe_trailing?.value === null && cand.profitabilityState === 'pre_profit'))
      ? 'N/M'
      : (m.pe_trailing?.value !== undefined ? m.pe_trailing.value : null),
    pe_forward: m.pe_forward?.value !== undefined ? m.pe_forward.value : null,
    ev_ebitda: (m.ev_ebitda?.reason === 'NEGATIVE_EBITDA') ? 'N/M' : (m.ev_ebitda?.value !== undefined ? m.ev_ebitda.value : null),
    ev_sales: m.ev_sales?.value !== undefined ? m.ev_sales.value : null,
    revenue_growth_yoy_pct: m.revenue_growth_yoy_pct?.status === 'VERIFIED' && m.revenue_growth_yoy_pct.periodBasis === 'QUARTERLY' ? m.revenue_growth_yoy_pct.value : null,
    revenue_growth_yoy_pct_verified: m.revenue_growth_yoy_pct?.status === 'VERIFIED' && m.revenue_growth_yoy_pct.periodBasis === 'QUARTERLY',
    gross_margin_pct: m.gross_margin_pct?.value !== undefined ? m.gross_margin_pct.value : null,
    operating_margin_pct: m.operating_margin_pct?.status === 'VERIFIED' && m.operating_margin_pct.periodBasis === 'QUARTERLY' ? m.operating_margin_pct.value : null,
    operating_margin_pct_verified: m.operating_margin_pct?.status === 'VERIFIED' && m.operating_margin_pct.periodBasis === 'QUARTERLY',
    net_margin_pct: m.net_margin_pct?.value !== undefined ? m.net_margin_pct.value : null,
    roic_pct: m.roic_pct?.value !== undefined ? m.roic_pct.value : null,
    roic_verified: m.roic_pct?.status === 'VERIFIED',
    operating_income: m.operating_income?.value !== undefined ? m.operating_income.value : null,
    total_debt: m.total_debt?.value !== undefined ? m.total_debt.value : null,
    total_equity: m.total_equity?.value !== undefined ? m.total_equity.value : null,
    cash_and_equivalents: m.cash_and_equivalents?.value !== undefined ? m.cash_and_equivalents.value : null,
    short_term_investments: m.short_term_investments?.value !== undefined ? m.short_term_investments.value : null,
    financial_period: m.operating_margin_pct?.period || m.revenue_growth_yoy_pct?.period || m.roic_pct?.period || 'Latest',
    financial_source: m.operating_margin_pct?.source || m.revenue_growth_yoy_pct?.source || m.roic_pct?.source || 'Unverified source',
    status_label_en: cand.scaleTier ? `${cand.scaleTier} cap` : undefined,
    profitabilityState: cand.profitabilityState,
    lifecycle: cand.lifecycle,
    scaleTier: cand.scaleTier,
    // Explicit period basis retention
    revenue_growth_yoy_pct_period_basis: m.revenue_growth_yoy_pct?.periodBasis,
    revenue_growth_yoy_pct_basis: m.revenue_growth_yoy_pct?.basis,
    revenue_growth_yoy_pct_concepts_used: m.revenue_growth_yoy_pct?.conceptsUsed,
    revenue_growth_yoy_pct_inputs_used: m.revenue_growth_yoy_pct?.inputsUsed,
    operating_margin_pct_period_basis: m.operating_margin_pct?.periodBasis,
    operating_margin_pct_basis: m.operating_margin_pct?.basis,
    operating_margin_pct_concepts_used: m.operating_margin_pct?.conceptsUsed,
    operating_margin_pct_inputs_used: m.operating_margin_pct?.inputsUsed,
    roic_pct_period_basis: m.roic_pct?.periodBasis,
    roic_pct_basis: m.roic_pct?.basis,
  };
}
