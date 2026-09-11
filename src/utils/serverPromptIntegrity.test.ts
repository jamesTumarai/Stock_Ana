import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.resolve(here, '../../server.ts'), 'utf8');
const retrySource = fs.readFileSync(path.resolve(here, '../../server/lib/agentRetry.ts'), 'utf8');

const forbiddenCurrentFactPatterns = [
  /TSLA[^\n]*(?:NTM EPS|Forward P\/E|EV\/EBITDA|PEG)[^\n]*(?:\$|~|\d+x)/i,
  /(?:TSLA|RKLB|ASTS|AMD|EOSE|HOOD|AFRM|SOFI|AVGO|TSM)[^\n]*(?:Market Cap|stock price)[^\n]*(?:\$\d|~\d)/i,
  /Apple[^\n]*(?:iPhone|Services|Mac)[^\n]*\$\d/i,
  /SpaceX[^\n]*(?:market cap|valuation)[^\n]*(?:\$|~)/i,
  /SEC EDGAR XBRL Verified/i,
  /reconstruct and include all 4 completed quarters/i,
  /ticker\s*=\s*['"]TSLA['"]/i,
  /companyName\s*=\s*['"]Tesla, Inc\.?['"]/i,
  /for Tesla:\s*AI training clusters/i
];

for (const pattern of forbiddenCurrentFactPatterns) {
  assert.doesNotMatch(serverSource, pattern, `Production prompt contains forbidden anchored fact: ${pattern}`);
}

assert.match(serverSource, /Never extrapolate or reconstruct a quarter from trends/);
assert.match(serverSource, /leave its observations null\/unavailable, flag the history as incomplete/);

// Schema examples in production prompts must describe shape without anchoring the model
// to plausible-looking financial values or subjective scores.
assert.doesNotMatch(
  serverSource,
  /"score"\s*:\s*[1-9]\d*(?:\.\d+)?\s*,\s*"reason"\s*:\s*"\.\.\."/,
  'Production prompt schema contains an anchored numeric score example'
);
assert.doesNotMatch(
  serverSource,
  /"stock_price_history"\s*:\s*\[\s*\{\s*"date"\s*:\s*"[^"]+"\s*,\s*"price"\s*:\s*\d/,
  'Production prompt schema contains an anchored numeric stock-price example'
);

// Fundamental/Combined output must expose the complete DCF assumption/scenario contract.
// Numeric schema placeholders remain null so the prompt cannot seed plausible-looking defaults.
assert.match(serverSource, /"intrinsic_value"\s*:\s*\{/);
assert.match(serverSource, /"dcf_model"\s*:\s*\{/);
assert.match(serverSource, /"assumptions"\s*:\s*\{/);
assert.match(serverSource, /"wacc_pct"\s*:\s*null/);
assert.match(serverSource, /"terminal_growth_pct"\s*:\s*null/);
assert.match(serverSource, /"projection_years"\s*:\s*null/);
assert.match(serverSource, /DCF OUTPUT CONTRACT \(MANDATORY\)/);
assert.match(serverSource, /DCF FACT\/ASSUMPTION SEPARATION/);
assert.doesNotMatch(serverSource, /"wacc_pct"\s*:\s*\d/);
assert.doesNotMatch(serverSource, /"terminal_growth_pct"\s*:\s*\d/);
assert.doesNotMatch(serverSource, /"projection_years"\s*:\s*\d/);

// Repeating report sections must expose the canonical renderer keys without
// encouraging empty placeholder rows.
for (const field of [
  'holder_type_breakdown',
  'shares_held',
  'pct_owned',
  'revenue_usd',
  'ratio_pct',
  'revenue_per_employee_k_usd',
  'operating_profit_per_employee_k_usd',
  'net_income_per_employee_k_usd',
]) {
  assert.match(serverSource, new RegExp(`"${field}"\\s*:`), `Production schema is missing canonical field ${field}`);
}
assert.match(serverSource, /Never emit an empty placeholder row/);
assert.match(serverSource, /use \[\] when the entire collection is unavailable/);

// The runtime dynamicSchema is authoritative. Legacy managed-agent configuration files
// must not be injected as environment sources where they can compete with that contract.
assert.match(serverSource, /legacyAgentRuntimeFiles = new Set/);
assert.match(serverSource, /'\/.agents\/AGENTS\.md'/);
assert.match(serverSource, /'\/.agents\/agent\.yaml'/);
assert.match(serverSource, /'\/.agents\/requirements\.txt'/);
assert.match(serverSource, /\.filter\(\(source\) => !legacyAgentRuntimeFiles\.has\(source\.target\)\)/);

// Managed-agent prose is research output, not a machine contract. Fundamental/Combined
// requests must have a structured-assumption bridge before deterministic DCF preparation.
assert.match(serverSource, /extractStructuredValuationAssumptions/);
assert.match(serverSource, /appendCanonicalValuationIfNeeded/);
assert.match(serverSource, /mergeStructuredValuationAssumptions/);
assert.match(retrySource, /retryBudgetMs = 120_000/);
assert.match(retrySource, /fallbackModel = 'gemini-3\.7-flash'/);
assert.match(serverSource, /process\.env\.VERCEL !== '1'/);

console.log('Production prompt integrity checks passed');
