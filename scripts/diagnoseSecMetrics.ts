/** Explicit local developer tool: npm exec tsx scripts/diagnoseSecMetrics.ts
 * -- <public SEC bundle.json> [output.json]. Never runs in the report API/UI.
 * Records source metadata and values only; no model context or credentials. */
import { readFileSync, writeFileSync } from 'node:fs';
import { METRIC_SPECS } from '../src/services/sec/secFinancialMapper';
import { buildSecVerifiedIntegrationPackage } from '../src/services/sec/secIntegration';
import { buildVerifiedStatementPeriods } from '../src/domain/verifiedFinancialStatements';
import { normalizeDurationFactsToStandaloneQuarters, normalizeInstantFactsToFiscalQuarters } from '../src/services/sec/xbrlNormalizer';

const filename = process.argv[2];
if (!filename) throw new Error('Provide a public SEC bundle JSON path.');
const bundle = JSON.parse(readFileSync(filename, 'utf8'));
const pkg = buildSecVerifiedIntegrationPackage(bundle), dataset = pkg.canonicalFinancials;
if (!dataset) throw new Error('No canonical dataset; inspect company identity and source package.');
const periods = buildVerifiedStatementPeriods(dataset).slice(-4);
const rows = periods.flatMap(period => METRIC_SPECS.map(spec => {
  const metric = `${spec.statement}.${spec.metric}`, selected = period.observations[metric];
  const candidates = spec.concepts.flatMap(concept => {
    const definition = bundle.companyFacts.facts?.['us-gaap']?.[concept];
    return Object.entries(definition?.units || {}).flatMap(([unit, raw]: [string, any]) => {
      const normalized = spec.factKind === 'instant' ? normalizeInstantFactsToFiscalQuarters(raw)
        : normalizeDurationFactsToStandaloneQuarters(raw, { additive: !spec.metric.includes('eps') });
      const relevant = normalized.filter(f => f.fiscalYear === period.fiscalYear && f.fiscalQuarter === period.fiscalQuarter);
      if (!relevant.length && raw.some((f: any) => f.end === period.endDate)) return [{ sourceConcept: `us-gaap:${concept}`,
        unit, reason: 'NO_COMPATIBLE_FISCAL_CONTEXT', rawContexts: raw.filter((f: any) => f.end === period.endDate)
          .map((f: any) => ({ start: f.start, end: f.end, form: f.form, accession: f.accn, fy: f.fy, fp: f.fp })) }];
      return relevant.map(f => ({ sourceConcept: `us-gaap:${concept}`, unit, start: f.start, end: f.end,
        derivation: f.derivation, accessions: f.accessionNumbers, rawContexts: f.sourceFacts,
        reason: unit !== spec.unit ? 'UNIT_MISMATCH' : f.end !== period.endDate ? 'PERIOD_MISMATCH'
          : selected?.sourceComponents?.some(c => c.concept === concept) || selected?.concept === concept
            || selected?.sourceConcept === `us-gaap:${concept}` ? 'SELECTED_OR_DERIVATION_COMPONENT'
            : selected ? 'COMPATIBLE_ALTERNATIVE_NOT_SELECTED' : period.rejected[metric] || 'NO_ACCEPTED_CANONICAL_OBSERVATION' }));
    });
  });
  const notApplicable = pkg.financialStatements?.statement_template === 'banking'
    && ['gross_profit', 'gross_margin_pct', 'cogs'].includes(spec.metric);
  return { ticker: bundle.identity.ticker, cik: bundle.identity.cik, metric, period: period.label,
    end: period.endDate, state: selected ? 'AVAILABLE' : notApplicable ? 'NOT_APPLICABLE'
      : period.rejected[metric] ? 'REJECTED' : candidates.length ? 'UNAVAILABLE' : 'NOT_DISCLOSED',
    selected: selected ? { value: selected.value, unit: selected.unit, sourceConcept: selected.sourceConcept || selected.concept,
      canonicalMetric: metric, mappingType: selected.mappingType, source: selected.source, derivation: selected.derivation } : null,
    rejection: period.rejected[metric] || null, candidates,
    attempts: dataset.completionAudit?.filter(a => a.metric === metric && a.period === period.label) };
}));
const output = JSON.stringify({ ticker: bundle.identity.ticker, mappingVersion: dataset.mappingVersion,
  normalizationVersion: dataset.normalizationVersion, rows }, null, 2);
if (process.argv[3]) writeFileSync(process.argv[3], output); else console.log(output);
