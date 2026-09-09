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

console.log('Production prompt integrity checks passed');
