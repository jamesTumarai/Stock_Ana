# Firebase environment safety

Lumina currently has a production-compatibility Firebase fallback for the existing
`stock-analyze-a89d0` project. The fallback exists only to avoid breaking the live
production deployment while environment variables are rolled out. It is not the
recommended configuration for new environments.

## Environment contract

Production, Preview, and local development should each provide the complete Firebase
web configuration through the `VITE_FIREBASE_*` variables in `.env.example`, and the
server must use the same project through `FIREBASE_PROJECT_ID`.

If any client Firebase variable is supplied, all required client variables must be
supplied. Partial configuration fails closed instead of mixing values from different
projects. Local/Preview runs are blocked from authenticated data access when they would
otherwise resolve to the production Firebase project. Production domains currently in
Vercel remain compatible with the legacy fallback until production variables are set.

After production variables have been configured and auth/history have passed a live
smoke test, remove the legacy production fallback in a separate PR.

## Archived AI Studio scaffold

`firebase.legacy-ai-studio.json` and `firebase-applet-config.legacy.json` are archived
configuration from an older AI Studio project (`festive-state-gsjh2`) and named
Firestore database. They are intentionally not named `firebase.json` / active applet
config because the current web app initializes Firestore with `getFirestore(app)`,
which means the default database of its configured Firebase project.

Do not use the archived files for production rules deployment.

## Firestore rules deployment

The repository intentionally has no active `firebase.json` after this hardening step.
This makes a casual `firebase deploy` from the repository root fail closed. Before any
rules deployment:

1. Confirm the Firebase project and Firestore database that the running production app
   actually uses.
2. Export/back up the affected data and keep a rollback copy of the previous rules.
3. Create an explicit deployment config for that verified target; do not reuse the
   archived AI Studio config.
4. Validate rules against owner read/create, immutable report snapshots, and soft-delete
   metadata behavior.
5. Deploy to non-production first, then production only after auth/history smoke tests.

A Vercel application deployment does not deploy Firestore rules.
