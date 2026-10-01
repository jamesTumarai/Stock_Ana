import type { CanonicalFinancialDataset, CanonicalFinancialValue } from '../../domain/financialValue';
import type { SecCompanyBundleLike } from './secFinancialMapper';

const attrs = (tag: string): Record<string, string> => Object.fromEntries(
  [...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/&#(?:160|xA0);|&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

/** Limited presentation contract: whole-entity instant USD facts from the balance sheet.
 * Ambiguous labels, dimensional contexts, unsupported formats and conflicting rows fail closed.
 * No model extraction, free-text number parsing, or issuer-specific tags are accepted.
 */
export function attachDebtFromVerifiedFilingPresentation(dataset: CanonicalFinancialDataset, bundle: SecCompanyBundleLike): CanonicalFinancialDataset {
  const next = structuredClone(dataset);
  const existing = next.values['balance_sheet.total_debt'] || [];
  const conflictingEnds = new Set<string>();
  for (const doc of bundle.filingDocuments || []) {
    if (!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(doc.documentUrl) || !doc.accession) continue;
    const contexts = new Map<string, string>();
    for (const m of doc.html.matchAll(/<xbrli:context\b([^>]*)>([\s\S]*?)<\/xbrli:context>/gi)) {
      if (/<(?:xbrldi:)?(?:explicitMember|typedMember)\b/i.test(m[2])) continue;
      const cik = m[2].match(/<xbrli:identifier\b[^>]*>(\d+)<\/xbrli:identifier>/i)?.[1];
      if (!cik || Number(cik) !== Number(bundle.identity.cik)) continue;
      const end = m[2].match(/<xbrli:instant>(\d{4}-\d{2}-\d{2})<\/xbrli:instant>/i)?.[1];
      if (end) contexts.set(attrs(m[1]).id, end);
    }
    const usdUnits = new Set<string>();
    for (const m of doc.html.matchAll(/<xbrli:unit\b([^>]*)>([\s\S]*?)<\/xbrli:unit>/gi)) {
      if (/<xbrli:measure>iso4217:USD<\/xbrli:measure>/i.test(m[2]) && !/<xbrli:divide/i.test(m[2])) usdUnits.add(attrs(m[1]).id);
    }
    for (const table of doc.html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const tableText = plain(table[1]);
      if (!/Total assets/i.test(tableText) || !/Total liabilities/i.test(tableText)) continue;
      const pairs = new Map<string, {current: CanonicalFinancialValue[]; noncurrent: CanonicalFinancialValue[]}>();
      for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const label = plain(row[1].split(/<ix:nonfraction\b/i)[0]);
        const current = /current (?:portion|maturities) of debt and (?:finance|capital) leases/i.test(label);
        const noncurrent = /debt and (?:finance|capital) leases,? (?:net of current (?:portion|maturities)|noncurrent)/i.test(label);
        if (!current && !noncurrent) continue;
        for (const fact of row[1].matchAll(/<ix:nonfraction\b([^>]*)>([\s\S]*?)<\/ix:nonfraction>/gi)) {
          const a = attrs(fact[1]), end = contexts.get(a.contextref);
          const anchor = Object.values(next.values).flat().find(v => v.periodEnd === end && v.fiscalYear && v.fiscalQuarter);
          if (!end || !anchor || !usdUnits.has(a.unitref) || a.nil === 'true'
            || (a.format && !/^(?:ixt|ixt-sec):(?:num-dot-decimal|numdotdecimal)$/.test(a.format))) continue;
          const raw = plain(fact[2]).replace(/,/g, '');
          if (!/^\d+(?:\.\d+)?$/.test(raw) || !/^-?\d+$/.test(a.scale || '0')) continue;
          const value = Number(raw) * 10 ** Number(a.scale || '0') * (a.sign === '-' ? -1 : 1) / 1_000_000;
          if (!Number.isFinite(value) || value < 0) continue;
          const observation: CanonicalFinancialValue = {
            metric: current ? 'current_debt_and_finance_leases' : 'noncurrent_debt_and_finance_leases',
            statement: 'balance_sheet', value, unit: 'USD_M', currency: 'USD',
            period: anchor.period, fiscalYear: anchor.fiscalYear, fiscalQuarter: anchor.fiscalQuarter,
            periodEnd: end, periodType: 'instant', type: 'reported', verification: 'verified',
            accession: doc.accession, concept: a.name, form: doc.form,
            source: { provider: 'SEC EDGAR inline XBRL balance-sheet presentation', authorityTier: 1,
              documentUrl: doc.documentUrl, documentType: doc.form, filingDate: doc.filingDate,
              accessionNumber: doc.accession, periodEnd: end, retrievedAt: bundle.retrievedAt },
            derivation: `Reported balance-sheet line: ${label}`,
          };
          const pair = pairs.get(end) || {current: [], noncurrent: []};
          pair[current ? 'current' : 'noncurrent'].push(observation); pairs.set(end, pair);
        }
      }
      for (const [end, pair] of pairs) {
        if (conflictingEnds.has(end)) continue;
        if (pair.current.length !== 1 || pair.noncurrent.length !== 1) continue;
        const a = pair.current[0], b = pair.noncurrent[0];
        const index = next.periods.indexOf(a.period);
        if (index < 0) continue;
        for (const observation of [a,b]) {
          const componentKey = `balance_sheet.${observation.metric}`;
          const series = next.values[componentKey] ||= next.periods.map(period => ({...observation,period,value:null,verification:'unverified'}));
          series[index] = observation;
        }
        const direct = existing[index];
        const value = a.value! + b.value!;
        if (direct?.value != null && direct.verification === 'verified') {
          if (Math.abs(direct.value - value) > 1) {
            conflictingEnds.add(end);
            next.provenanceWarnings.push({ code: 'DEBT_PRESENTATION_DISAGREEMENT', severity: 'warning', message: `Debt presentation disagrees with accepted source at ${end}: ${direct.value} vs ${value} USD_M.` });
            existing[index] = { ...direct, value: null, verification: 'unverified', derivation: 'Conflicting accepted debt presentations; source reconciliation required.' };
          }
          continue;
        }
        existing[index] = { ...a, metric: 'total_debt', value, type: 'derived', sourceComponents: [a,b],
          derivation: 'Canonical debt = same-instant current debt and finance leases + noncurrent debt and finance leases, explicitly presented on the consolidated balance sheet.' };
      }
    }
  }
  if (existing.length) next.values['balance_sheet.total_debt'] = existing;
  return next;
}
