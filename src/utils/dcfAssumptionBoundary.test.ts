import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const dcfRouteSource = fs.readFileSync(path.join(root, 'server/routes/dcfRoutes.ts'), 'utf8');

assert.match(dcfRouteSource, /app\.post\("\/api\/dcf-assumptions"/);
assert.match(dcfRouteSource, /requireFirebaseAuth, dcfAssumptionRateLimit/);
assert.match(dcfRouteSource, /validateDcfAssumptionModel\(parsed\)/);
assert.match(dcfRouteSource, /fair_value_per_share MUST be null/);
assert.match(appSource, /secVerification\?\.status === 'verified_eligible'/);
assert.match(appSource, /!hasValidDcfAssumptionModel\(reportForValidation\)/);
assert.match(appSource, /fetchDcfAssumptionProposal\(/);
assert.match(appSource, /attachDcfAssumptionModel\(reportForValidation, proposal\)/);

console.log('DCF assumption/fact boundary integration checks passed');
