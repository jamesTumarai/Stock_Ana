# Report save payload repair

The previous `saveReportToFirebase` sent the complete generated report in `reports/{id}.data` using one Firestore `addDoc`. The approximately 11.5MB object exceeded Firestore's request limit (10MiB) and its per-document limit (1MiB). Increasing Express's JSON limit cannot fix a direct Firebase SDK write. Limits: https://firebase.google.com/docs/firestore/quotas.

## Storage contract

- `reports/{id}`: allowlisted `ReportSummary`, owner ID, language, compact financial/status flags, versions/timestamps and save state. Hard JSON budget: 64KiB. No inline `data`, statement trees, source archives, comparison datasets or debug/model/UI context.
- `reports/{id}/sections/{sectionId}`: independently checksummed rendered section or an artifact reference. `sections/_manifest` identifies the version, sections, history/artifact IDs, deduplication aliases and recomputed fields.
- `reports/{id}/history/{snapshotId}`: extracted historical/comparison snapshots; not fetched to display the history list or current report.
- `reports/{id}/artifacts/{artifactId}`: versioned storage path, byte size, SHA-256 checksum and backend. Raw source bundles/companyfacts use artifacts rather than the main record. Prompts, raw model responses and debug/UI state are discarded.
- Large parts go to private Firebase Storage objects `reports/{uid}/{id}/{artifactId}.json`. No download URLs or access tokens are persisted. Upload **and authenticated read-back** must pass byte/checksum verification before the object reference is accepted.
- If the bucket, CORS or object access is unavailable, a per-save circuit breaker falls back to private Firestore artifact chunks. These are a compatibility bridge, not one large Firestore write. Production object storage avoids excessive chunk document reads/writes.

Section/manifest/document hard budget: 256KiB; warning threshold: 128KiB; fallback chunk budget: 128KiB including JSON escaping; whole sanitized report budget: 64MiB; chunk/part count is bounded. Every database call sends a single bounded part; no oversized multi-document batch. The existing global Express 1MiB limit and HTTP 413 handling remain secondary safeguards for unrelated API requests.

## Data preservation

`sanitizeReportForSave()` clones its input. It removes undefined/empty object properties and explicitly identified runtime/model/debug fields. **Financial nulls, zeros, signed values and array positions remain intact.** Summary-only prose is bounded; original rendered section prose is preserved. The main record takes current/selected sector valuation assumptions (DDM/REIT/relative/cyclical/DCF), not an industrial DCF substitute for every stock.

Identical accepted dataset copies become manifest aliases. Source-compatible period snapshots and indicator details are omitted only when they exactly match the central adapter/calculator and can be reconstructed; nonmatching historical disclosures remain stored. The canonical executive presentation snapshot is recomputed from saved inputs on load. Loading does not re-run report normalization, re-price a report, mutate its thesis or replace historical valuation assumptions.

`saving` establishes parent ownership. Child sections/artifacts are immutable and owner-only. The record transitions to `ready` only after every part and manifest were acknowledged. History excludes incomplete saves. Failed writes never masquerade as a complete report; staged records/blobs are retained for operational recovery rather than destructively cleaned up.

Legacy `{data: report}` snapshots are still readable, with no bulk migration. New history list records use a compact compatibility preview, then hydrate on opening. The latest complete report per ticker is hydrated for existing portfolio/alert research consumers. Older history entries remain summaries. Account changes and superseded history fetches discard delayed responses. Loading a report shows a busy state and disables concurrent history selections.

## Deployment prerequisites

The workspace includes owner-only Firestore child rules, immutable private Storage rules and index exemptions for JSON/chunk bodies. On 2026-09-28, after explicit user authorization, the Firestore rules and index exemptions were deployed to `stock-analyze-a89d0 / (default)`. The previous live Firestore rules matched the repository base exactly, and the project had no existing composite indexes or field overrides. The previous release source/ID and index specification were backed up under ignored `run_logs/firebase-report-release-backup/` before deployment. The project has **no Storage bucket**, so Storage rules were compiled but not deployed; the existing bounded Firestore chunk backend serves oversized parts.

```powershell
npm run firebase:rules:preflight -- --project stock-analyze-a89d0
# Run only as an authorized release, after confirming the target project/account:
firebase deploy --only firestore:rules,firestore:indexes --project stock-analyze-a89d0 --non-interactive
# Only if the existing configured bucket is provisioned and its live rules reviewed:
# firebase deploy --only storage --project stock-analyze-a89d0
```

Provision the configured private Storage bucket if using blobs. SDK `getBytes` requires bucket CORS for the approved application/localhost origins; see https://firebase.google.com/docs/storage/web/download-files#cors_configuration. The upload/read-back probe falls back to bounded chunks when this configuration is absent, but the owner-only Firestore child rules are required for both backends. The code does not create a bucket, change billing, switch Firebase projects, widen public access or deploy rules automatically.

## Verification

Regression coverage includes a synthetic **11.5MB** rendered section, UTF-8/Thai/emoji/control-character round trips, financial null/zero preservation, actual SEC accounting/source identity after deduplication, object refs, read-back/corruption/missing-chunk rejection, partial save failure, total-size rejection before any write, legacy compatibility and sector-specific assumptions. Captured standard/SaaS/semiconductor/bank/insurance/REIT/pre-profit/foreign-IFRS observations round-trip without changing periods/currency/balances.

The injected-store tests exercise the real splitter/writer/reader; they do not certify deployed Firebase rules, bucket CORS or an authenticated production save.

Final verification (2026-09-28): **123/123 test files, 805 passed, 0 failed, 0 skipped**; TypeScript lint and production build passed; diff whitespace check passed; Firebase repository-target preflight passed. The existing large frontend chunk warning remains (~3.3MB before gzip). The report persistence suite contains 11 meaningful cases, including unavailable canonical-summary values that must not resurrect stale fallback valuations.

Browser verification used a clearly labelled in-memory store with the production save/read functions and `HistoryModal`. Input: **11,500,181 bytes**; main record: **584 bytes**; largest database write: **65,574 bytes**. Opening the saved history showed `Loading…`, then read back the complete **11,500,000-character** section. No Firebase data was written during this check. Screenshot: `run_logs/report-save-browser-proof.png` (ignored).

A browser check caught eager Storage initialization breaking the development page after dependency optimization. Storage now loads only during a blob operation, and a missing provider/bucket cannot block application startup; the restarted homepage returned HTTP 200 and rendered normally. The temporary verification tab was closed. The owned server is running on localhost:3002 with the latest code.

**Authorized cloud rules deployment (2026-09-28):** Firebase CLI 15.30.0 used the existing authenticated operator account. The Firebase Rules API compiled Firestore and Storage source successfully; all **26** Firestore policy tests passed (owner access, cross-account/anonymous denial, immutable sections/history/artifacts, staged publication requiring a manifest, historical soft delete, hard-delete denial). The CLI deployed only `firestore:rules,firestore:indexes`; no bucket, database, billing setting or public permissions were created. Active rules were read back and matched the local source exactly. Active ruleset: `3a5b78c2-f2b2-45e9-b1a6-c0d489445aa7`, release timestamp `2026-09-28T15:07:58.668628Z`. Database UID remained `33dd71b2-7f20-499b-aee3-ed5270e8e0b3`, native mode, `asia-southeast3`. All three JSON/body index exemptions were verified active.

No Java emulator was used. Deployment evidence is in ignored `run_logs/firebase-report-release-verified.json`; Rules API test results are in `run_logs/firebase-report-rules-test.json`. Code remains uncommitted/unpushed alongside earlier user changes; the cloud rules update is compatible with legacy clients and reports. It does not certify a frontend production release or a new CI/main verification run.

**Signed-in live verification:** the restarted localhost app successfully signed in to the existing Lumina account, loaded 13 legacy TSLA analyses, and opened the latest legacy report. An ignored temporary verification page then used the unmodified production `saveReportSnapshot()` / `loadReportSnapshot()` and Firebase Web SDK against the deployed owner-only rules. The clearly labelled synthetic `LUMINA_SAVE_TEST` report contained **11,500,315 bytes**; its ready main record was **757 bytes**, with **176** bounded Firestore artifact chunks. The entire **11,500,000-character** section and original summary read back exactly. Screenshot: `run_logs/report-save-live-proof.png`. The missing Storage bucket triggered the designed chunk fallback. Firebase transiently returned a write-stream `resource-exhausted` warning; its SDK backoff recovered and the save/read completed. This is an operational limitation of the compatibility chunk backend; private object storage remains the preferred large-artifact backend once provisioned. No AI generation, user financial values, historical snapshots or thesis revisions were changed by the synthetic check.

A fresh reload of the actual app fetched the new compact history entry alongside all 13 legacy analyses. `HistoryModal` displayed its loading/disabled state while hydrating the synthetic section, then opened the report successfully. Cleanup soft-deleted only synthetic test ID `Ll5KsVWUVm26mX7COPg5` with the existing three metadata fields using an update-time precondition and server timestamp. Its main record and all chunks remain recoverable; no original report was modified and no hard delete occurred. The temporary verification tab was closed and the user's tab returned to the homepage.
