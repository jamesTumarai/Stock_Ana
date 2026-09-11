# Firebase operational safety

This runbook is the production contract for Lumina Firebase configuration and Firestore Security Rules. It is intentionally conservative: production users and report history stay on the existing Firebase project unless a separate migration is explicitly designed, backed up, tested, and approved.

## Production identity

- Firebase project: `stock-analyze-a89d0`
- Firestore database: `(default)`
- Report collection: `reports`
- The web app uses the Firebase Web SDK and `getFirestore(app)`, so production history is expected in the project's default database.
- `firebase.json` must configure only `(default)` for the current rules deployment.
- `firebase-applet-config.json` and other AI Studio metadata are not the production runtime/deployment authority.

There is intentionally no automatic switch to a new Firebase project. Existing Authentication users and reports must continue to resolve against `stock-analyze-a89d0`.

## Environment contract

Production keeps a backward-compatible fallback: with no `VITE_FIREBASE_*` variables set, the client resolves to the historical production Firebase config. The fallback does not grant that project to arbitrary hosts.

When the client resolves to `stock-analyze-a89d0`, authenticated Firebase data access is allowed only on Lumina's known production hosts by default. `localhost` and preview hosts are blocked so development cannot silently read or write production Authentication/Firestore data. The emergency `VITE_FIREBASE_ALLOW_PRODUCTION_PROJECT=true` escape hatch exists only for deliberate, temporary operator use and must not be configured globally for preview/development.

For an isolated development or staging Firebase project, set all required client variables together:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

`VITE_FIREBASE_MEASUREMENT_ID` is optional. Partial client overrides are rejected by the app; never mix client fields from different Firebase projects.

Server Firebase Admin follows the same isolation boundary. Production may fall back to `stock-analyze-a89d0`. Preview/development must set `FIREBASE_PROJECT_ID` explicitly to an isolated project. The production Firebase project is blocked in known non-production environments unless the operator intentionally sets `FIREBASE_ALLOW_PRODUCTION_PROJECT_IN_NONPROD=true`. Keep server `FIREBASE_PROJECT_ID` aligned with the client's `VITE_FIREBASE_PROJECT_ID`.

## Before any production rules deploy

1. Start from a clean, reviewed `main` commit whose `Verify Lumina` PR gate passed.
2. Record the exact Git commit SHA and the current production ruleset timestamp/version from the Firebase console. This is the rollback point.
3. Authenticate the Firebase CLI with the intended operator account.
4. Confirm the target project and databases explicitly:

```bash
firebase projects:list
firebase firestore:databases:list --project stock-analyze-a89d0
firebase firestore:databases:get "(default)" --project stock-analyze-a89d0
```

Stop if `stock-analyze-a89d0` or `(default)` is not present as expected. Do not create a database as part of a rules deployment.

5. Run the repository deployment preflight with the production project named explicitly:

```bash
npm run firebase:rules:preflight -- --project stock-analyze-a89d0
```

This preflight is intentionally fail-closed. It rejects a missing or different project ID, requires `firebase.json` to target only `(default)`, rejects `databaseId`, requires `firestore.rules`, and checks that the rules file is non-empty Firestore Rules v2 source. It validates the repository deployment contract only; it does not replace the live Firebase CLI checks above and does not authenticate or deploy anything.

6. Inspect `firebase.json` and require exactly this Firestore target contract:

```json
{
  "firestore": {
    "database": "(default)",
    "rules": "firestore.rules"
  }
}
```

The repository may also include the Firebase JSON schema field. Do not deploy from a config that names a legacy AI Studio database.

7. Review the diff of `firestore.rules`. Rules deployment overwrites the rules currently active for the configured database, so console-only edits must be reconciled into Git before proceeding.

## Deploy production rules

Re-run the preflight immediately before deployment, then deploy rules only while naming the production project explicitly:

```bash
npm run firebase:rules:preflight -- --project stock-analyze-a89d0
firebase deploy --only firestore:rules --project stock-analyze-a89d0
```

Do not use an unscoped `firebase deploy` for this operation.

## Verify after deploy

1. In Firebase Console → Firestore Database → `(default)` → Rules, confirm the deployment timestamp and source match the reviewed `firestore.rules` change.
2. Re-run:

```bash
firebase firestore:databases:get "(default)" --project stock-analyze-a89d0
```

Confirm the database remains the expected production database; rules deployment must not create, rename, or change database edition/mode.
3. Production smoke-check with an existing authenticated Lumina account:
   - sign-in still succeeds;
   - existing, non-deleted report history loads;
   - a normal report save remains available to its owner;
   - reports from another user are not exposed;
   - the UI still uses soft delete rather than client hard delete.
4. Record the deployed Git SHA and verification result in the release/PR notes.

If any verification fails, stop further release work and use the rollback procedure below.

## Rollback rules

Preferred rollback: in Firebase Console's Firestore Rules history/timeline for `(default)`, restore or clone-and-publish the previously recorded known-good ruleset. Verify history access again after propagation.

Git-backed rollback is also possible, but keep the corrected current `firebase.json` target contract. Restore only `firestore.rules` from the known-good Git SHA, then deploy it explicitly to the production project:

```bash
cp firestore.rules firestore.rules.pre-rollback

git show <KNOWN_GOOD_SHA>:firestore.rules > firestore.rules
npm run firebase:rules:preflight -- --project stock-analyze-a89d0
firebase deploy --only firestore:rules --project stock-analyze-a89d0

mv firestore.rules.pre-rollback firestore.rules
```

After rollback, confirm the active rules in Firebase Console and repeat the production smoke checks. Do not roll back by switching Firebase projects or databases.

## Data migrations and backups

Rules deployment is not a data migration. It must not rewrite, delete, or bulk-update `reports`.

Any future data migration must be handled in a separate reviewed change with all of the following before production execution:

- a backup/export of affected data;
- a versioned migration script committed to the repository;
- dry-run or preview output with counts;
- explicit forward and rollback procedures;
- backward compatibility for legacy report snapshots;
- no casual “rewrite all reports” operation.

Client hard delete of reports remains prohibited. Report snapshots remain immutable except for the approved soft-delete metadata fields.

## Release discipline

`Verify Lumina` is the authoritative repository verification workflow. Its Node runtime must match production hosting (`24.x`) so CI does not certify a different major runtime than Vercel. The workflow also runs the Firebase rules deployment preflight so a bad repository target cannot pass CI unnoticed.

Checking the workflow into Git is not by itself an enforced PR gate. Repository administration must enable a `main` branch protection or ruleset that requires pull requests and the `Verify Lumina` status before merge; verify that protection is active before declaring the platform foundation complete.

Do not use `npm audit fix --force`, and do not put `[skip ci]`, `[ci skip]`, `skip-checks:true`, or similar CI-suppression directives into merge commit titles or messages. Security/backend/Firebase changes require a successful push-to-main verification plus a production deployment and smoke check before the phase is declared complete.
