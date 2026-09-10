import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverSource = fs.readFileSync(path.resolve(here, '../../server.ts'), 'utf8');

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



// The runtime dynamicSchema is authoritative. Legacy managed-agent configuration files
// must not be injected as environment sources where they can compete with that contract.
assert.match(serverSource, /legacyAgentRuntimeFiles = new Set/);
assert.match(serverSource, /'\/.agents\/AGENTS\.md'/);
assert.match(serverSource, /'\/.agents\/agent\.yaml'/);
assert.match(serverSource, /'\/.agents\/requirements\.txt'/);
assert.match(serverSource, /\.filter\(\(source\) => !legacyAgentRuntimeFiles\.has\(source\.target\)\)/);

console.log('Production prompt integrity checks passed');
