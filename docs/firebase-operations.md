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

With no `VITE_FIREBASE_*` variables set, the client preserves the historical production Firebase config. This is the backward-compatible path used by the current production deployment.

For an isolated development or staging Firebase project, set all required client variables together:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

`VITE_FIREBASE_MEASUREMENT_ID` is optional. Set server `FIREBASE_PROJECT_ID` to the same project ID used by the client. Partial client overrides are rejected by the app; never mix client fields from different Firebase projects.

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

5. Inspect `firebase.json` and require exactly this Firestore target contract:

```json
{
  "firestore": {
    "database": "(default)",
    "rules": "firestore.rules"
  }
}
```

The repository may also include the Firebase JSON schema field. Do not deploy from a config that names a legacy AI Studio database.

6. Review the diff of `firestore.rules`. Rules deployment overwrites the rules currently active for the configured database, so console-only edits must be reconciled into Git before proceeding.

## Deploy production rules

Deploy rules only, always naming the production project explicitly:

```bash
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

`Verify Lumina` is the authoritative PR gate for repository changes. Do not use `npm audit fix --force`, and do not put `[skip ci]`, `[ci skip]`, `skip-checks:true`, or similar CI-suppression directives into merge commit titles or messages. Security/backend/Firebase changes require a production smoke check after merge/deploy before the phase is declared complete.
