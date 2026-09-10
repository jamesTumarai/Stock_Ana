import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const workflow = fs.readFileSync('.github/workflows/verify.yml', 'utf8');

assert.doesNotMatch(app, /deleteDoc\(doc\(db, ["']reports["']/, 'history UI must not hard-delete report snapshots');
assert.match(app, /updateDoc\(doc\(db, ["']reports["'], id\), \{/);
assert.match(app, /deletedAt: serverTimestamp\(\)/);
assert.match(app, /deletedByUserId: user\.uid/);
assert.match(app, /deletedByVersion: CURRENT_GENERATED_BY_VERSION/);
assert.match(app, /filter\(record => !isSoftDeletedReportRecord\(record\)\)/);

assert.match(rules, /allow delete: if false;/, 'checked-in Firestore rules must reject client hard delete');
assert.match(rules, /request\.resource\.data\.userId == resource\.data\.userId/);
assert.match(rules, /deletedByUserId == request\.auth\.uid/);
assert.match(rules, /hasOnly\(\['deletedAt', 'deletedByUserId', 'deletedByVersion'\]\)/);

assert.match(workflow, /name: Verify Lumina/);
assert.match(workflow, /npm audit --omit=dev --audit-level=critical/);
assert.match(workflow, /cancel-in-progress: true/);
assert.doesNotMatch(workflow, /phase2-runtime-validation/);

console.log('Firestore data-safety and CI boundary checks passed');
