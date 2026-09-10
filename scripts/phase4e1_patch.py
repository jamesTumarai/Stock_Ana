from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# 1) Add a pure helper for history visibility so old documents remain compatible:
# absence/null deletedAt => visible; a real deletedAt marker => hidden.
persistence_path = Path('src/utils/firestorePersistence.ts')
persistence = persistence_path.read_text()
append_helper = '''\n\n/**
 * Soft-deleted report snapshots remain in Firestore for recovery/auditability.
 * Legacy reports do not have deletedAt and therefore remain visible.
 */
export const isSoftDeletedReportRecord = (value: unknown): boolean => {
  if (!isPlainObject(value)) return false;
  return value.deletedAt !== undefined && value.deletedAt !== null;
};
'''
if 'isSoftDeletedReportRecord' in persistence:
    raise SystemExit('soft-delete helper already exists unexpectedly')
persistence_path.write_text(persistence.rstrip() + append_helper)

# 2) Change the client delete action into a metadata-only update and hide those
# snapshots from history without introducing a Firestore composite index.
app_path = Path('src/App.tsx')
app = app_path.read_text()
app = replace_once(
    app,
    "import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';",
    "import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, updateDoc, doc } from 'firebase/firestore';",
    'Firestore import',
)
app = replace_once(
    app,
    "import { sanitizeUndefinedForPersistence } from './utils/firestorePersistence';",
    "import { isSoftDeletedReportRecord, sanitizeUndefinedForPersistence } from './utils/firestorePersistence';",
    'persistence helper import',
)
app = replace_once(
    app,
    "      let reports = querySnapshot.docs.map(docSnap => {\n        const record = { id: docSnap.id, ...docSnap.data() } as any;\n        return { ...record, isLegacy: isLegacyHistoryReport(record) };\n      });",
    "      let reports = querySnapshot.docs\n        .map(docSnap => {\n          const record = { id: docSnap.id, ...docSnap.data() } as any;\n          return { ...record, isLegacy: isLegacyHistoryReport(record) };\n        })\n        .filter(record => !isSoftDeletedReportRecord(record));",
    'history visibility filter',
)
app = replace_once(
    app,
    "      for (const id of ids) {\n        await deleteDoc(doc(db, \"reports\", id));\n      }\n      console.log(\"Reports deleted successfully!\");",
    "      for (const id of ids) {\n        await updateDoc(doc(db, \"reports\", id), {\n          deletedAt: serverTimestamp(),\n          deletedByUserId: user.uid,\n          deletedByVersion: CURRENT_GENERATED_BY_VERSION,\n        });\n      }\n      console.log(\"Reports soft-deleted successfully!\");",
    'report deletion behavior',
)
app_path.write_text(app)

# 3) Make report snapshots immutable at the checked-in rules boundary. The only
# allowed client update is the additive/repeatable soft-delete metadata change.
rules_path = Path('firestore.rules')
rules = rules_path.read_text()
rules = replace_once(
    rules,
    "      allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;",
    "      allow read: if request.auth != null && resource.data.userId == request.auth.uid;\n      allow update: if request.auth != null\n        && resource.data.userId == request.auth.uid\n        && request.resource.data.userId == resource.data.userId\n        && request.resource.data.deletedByUserId == request.auth.uid\n        && request.resource.data.diff(resource.data).affectedKeys()\n          .hasOnly(['deletedAt', 'deletedByUserId', 'deletedByVersion']);\n      allow delete: if false;",
    'report immutable rules',
)
rules_path.write_text(rules)

# 4) Extend persistence tests and add a source/rules boundary regression.
test_path = Path('src/utils/firestorePersistence.test.ts')
test = test_path.read_text()
test = replace_once(
    test,
    "import { sanitizeUndefinedForPersistence } from './firestorePersistence';",
    "import { isSoftDeletedReportRecord, sanitizeUndefinedForPersistence } from './firestorePersistence';",
    'persistence test import',
)
test = replace_once(
    test,
    "console.log('firestorePersistence tests passed');",
    "{\n  assert.equal(isSoftDeletedReportRecord({ id: 'legacy' }), false);\n  assert.equal(isSoftDeletedReportRecord({ deletedAt: null }), false);\n  assert.equal(isSoftDeletedReportRecord({ deletedAt: { seconds: 1 } }), true);\n  assert.equal(isSoftDeletedReportRecord(null), false);\n}\n\nconsole.log('firestorePersistence tests passed');",
    'persistence test footer',
)
test_path.write_text(test)

Path('src/utils/firestoreDataSafetyBoundary.test.ts').write_text(r'''import assert from 'node:assert/strict';
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
''')
