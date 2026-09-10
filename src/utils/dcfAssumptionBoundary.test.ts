import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

assert.match(serverSource, /app\.post\("\/api\/dcf-assumptions"/);
assert.match(serverSource, /validateDcfAssumptionModel\(parsed\)/);
assert.match(serverSource, /fair_value_per_share MUST be null/);
assert.match(appSource, /secVerification\?\.status === 'verified_eligible'/);
assert.match(appSource, /!hasValidDcfAssumptionModel\(reportForValidation\)/);
assert.match(appSource, /fetchDcfAssumptionProposal\(/);
assert.match(appSource, /attachDcfAssumptionModel\(reportForValidation, proposal\)/);

console.log('DCF assumption/fact boundary integration checks passed');
