# Lumina / Stock_Ana — Master Project Status

Last updated: 2026-09-11 (Asia/Bangkok)

This file is the engineering handoff source of truth for new ChatGPT/Codex sessions. Prefer live GitHub, CI, Vercel, Firebase, and issue evidence over old chat history when they disagree.

## Current state

- Current stage: **Phase 4 / Core Platform Foundation complete**.
- Current working mode: **post-Phase-4 stabilization and product-quality review**.
- Product Feature Expansion: **not started**. Continue reviewing the production website and fixing defects until the owner is satisfied, then begin expansion deliberately.
- Primary reference issuer for end-to-end financial validation: **MSFT**.
- Production URL: `https://stock-ana-ten.vercel.app`.
- Current `main`: `73905f585ea8001c462aaf8a7014b3c7ff926b9a`.
- Latest merged PR: **#49 — `fix: harden report scoring, missing data, and retries`**.
- Latest production Vercel deployment: `dpl_BkwDHyEPAHD4tsYBY3pMx4a1jVBm`, `READY`, production, Git SHA `73905f585ea8001c462aaf8a7014b3c7ff926b9a`, commit verification `verified`.
- Push-to-main `Verify Lumina` run for current main: `34580429437`, `completed / success`.
- Phase 4 operational acceptance issue: **#47 — closed as completed**.

## Repository protection

Repository visibility is currently **public by owner decision made during Phase 4 operational acceptance**.

Active repository ruleset:

- Name: `Protect main`
- Ruleset ID: `22863655`
- Target: `refs/heads/main`
- Enforcement: `active`
- No bypass actors
- Pull request required before merge
- Strict required status check: `verify` (`Verify Lumina`)
- Non-fast-forward updates blocked
- Branch deletion restricted

Do not weaken these controls casually. If repository visibility is changed back to private, re-check that the selected GitHub plan still enforces the same `main` protection before relying on it.

## Architecture principle

**Verified Data → Deterministic Calculations → User Context / History → AI Interpretation**

Non-negotiable rules:

- AI must never invent financial facts. Missing or unverified facts remain null / unavailable.
- Deterministic code owns valuation math and other canonical calculations.
- AI may propose assumptions such as WACC, terminal growth, or scenario growth only when clearly separated from verified facts.
- Generic FCFF DCF must not be forced onto banks, lenders, or other financial institutions.
- Financial statement periods, units, provenance, and source URLs must stay explicit.
- Never use fake financial fallback numbers to make UI sections look complete.
- Do not perform destructive Firebase history operations, bulk rewrites, or casual data migrations.
- Client hard delete of reports remains prohibited; report deletion is soft-delete metadata only.
- Avoid large refactors of the authoritative `/api/analyze` flow unless a real defect requires one.
- Do not use `npm audit fix --force`.

## Completed phases

### Phase 1 — Financial integrity cleanup ✅

Established financial-data integrity rules, removed unsafe fabricated fallbacks, and hardened report consistency expectations.

### Phase 2 — Runtime / deterministic validation ✅

Validated runtime behavior, deterministic calculation paths, and production Analyze API behavior.

### Phase 3 — Verified data + deterministic valuation core ✅

Implemented SEC-verified financial data integration and deterministic valuation behavior.

Acceptance behavior includes:

- SEC `verified_eligible` gating before deterministic generic DCF.
- `financialDataSource=sec_verified` and `priceSource=market_snapshot` provenance.
- History serialization / hydration preserves SEC and valuation provenance.
- Technical-only mode skips SEC / DCF work.
- Financial-sector guard prevents generic FCFF DCF misuse.
- No fabricated debt / investment taxonomy when the filing cannot prove it.

### Phase 4 — Core Platform Foundation ✅

Phase 4A–4E repository engineering and all production acceptance gates are complete.

Key platform protections:

- Firebase server-side authentication boundary on protected APIs.
- UID rate limiting and one concurrent Analyze per user.
- 1 MB JSON limit, input validation, path safety, and bounded transient logging.
- Backend route/support modularization without replacing the authoritative Analyze handler.
- `Verify Lumina` CI on PRs and pushes to `main`.
- Node 24 CI alignment with production hosting.
- Production dependency critical-vulnerability gate.
- Firebase non-production isolation and fail-closed production rules deploy preflight.
- Firestore report history soft delete with immutable report snapshots except approved delete metadata.

## Phase 4 production acceptance evidence

### Gate 1 — Firestore Rules ✅

Production target remains exactly:

- Firebase project: `stock-analyze-a89d0`
- Firestore database: `(default)`
- rules source: `firestore.rules`

Operational acceptance recorded:

- Previous rollback point recorded before deployment.
- Firebase operator identity and `(default)` database verified.
- Repository Firebase preflight passed immediately before deployment.
- Rules-only deployment succeeded.
- Active Console rules timestamp after deployment: **2026-09-11 09:38 Asia/Bangkok**.
- Deployed source matches reviewed Git rules.
- `/users/{userId}` access is owner-only.
- Report create/read is owner-only.
- Report updates are restricted to `deletedAt`, `deletedByUserId`, and `deletedByVersion` for the owner.
- Client hard delete is denied.

### Gate 2 — `main` protection ✅

Active ruleset `Protect main` (`22863655`) requires PRs and the strict `verify` status check. PR #48 demonstrated that protected merge flow in practice.

### Gate 3 — Authenticated production smoke ✅

Recorded production acceptance includes:

- Production Google sign-in succeeded with an authorized owner account.
- Unauthenticated `POST /api/analyze` returned `401`.
- Public `GET /api/live-quotes?symbols=MSFT` returned `200`.
- Authenticated MSFT Analyze completed and persisted a report.
- Firestore history updated and the saved MSFT report hydrated after reload.
- Owner soft-delete succeeded; the deleted report disappeared from visible history while remaining a soft-deleted stored record.
- Cross-user reads and client hard deletes remain denied by active production rules and are also covered by repository security-boundary tests.
- Browser reload after the soft-delete smoke showed no application warning/error entries.

Phase 4 acceptance uncovered a real partial-report rendering crash; that defect was fixed before continuing.

## Post-Phase-4 stabilization changes

### PR #48 — partial report rendering

`fix: render partial reports without crashing`

- Production smoke revealed that a valid partial report could omit `comprehensive_analysis`.
- `ReportTemplate` previously dereferenced missing nested fields and crashed.
- Missing comprehensive fields now fail closed to `Data unavailable`.
- Added regression coverage for partial report rendering.

Merge SHA: `a8e88a0af819b94959abe70cf54f74b4a280e593`.

### PR #49 — scoring, missing data, schema, retries

`fix: harden report scoring, missing data, and retries`

- Public conviction score is now recalculated by the deterministic 0–100 scorer instead of displaying arbitrary AI factor scores.
- Scoring fails closed when required inputs are missing.
- Exact ratios can be derived from disclosed statement values when the needed inputs are present.
- Stale DCF narrative is replaced when canonical DCF is recalculated.
- Empty / placeholder business and holder rows are filtered from rendering.
- Production prompt defines canonical repeating-array item fields and explicitly forbids placeholder rows.
- Managed-agent retry budget increased from 45 seconds to 120 seconds while remaining bounded.

Merge SHA: `73905f585ea8001c462aaf8a7014b3c7ff926b9a`.

## Current production health

Latest known production release is `READY` on current `main`.

Public MSFT live-quote smoke on 2026-09-11 returned HTTP 200 with structured market data.

Known runtime observations:

- Node `[DEP0169] url.parse()` deprecation warnings predate the latest release and appear to originate from dependency/runtime behavior rather than repository source.
- Earlier Gemini free-tier quota errors (`too_many_requests`) were observed during production Analyze testing. PR #49 expanded the bounded retry window so provider-directed retry waits can be honored longer. Treat provider quota exhaustion as an operational limitation, not permission to fabricate fallback analysis.

Do not launch an unrelated major dependency upgrade merely to silence the Node deprecation warning.

## Verification workflow for meaningful changes

Use this release discipline:

1. Create a focused branch from current `main`.
2. Make the smallest safe change.
3. Add / update regression coverage where appropriate.
4. Run relevant tests.
5. Run `npm run lint`.
6. Run `npm run build`.
7. Run `git diff --check`.
8. Open a PR to `main`.
9. Require `Verify Lumina` to pass.
10. Merge through the protected PR path.
11. Confirm Vercel production reaches `READY` on the exact merged SHA.
12. Smoke the affected production behavior.

Firebase/security/backend changes also require their specific operational runbooks and production verification.

## Current review loop

The immediate workflow is intentionally **not** a feature-expansion phase yet:

1. Owner uses the production website normally.
2. Owner reports bugs, confusing output, data-quality problems, UI issues, or desired refinements.
3. Review the live behavior and current source before changing code.
4. Fix the defect through a focused PR with regression coverage where practical.
5. Verify production again.
6. Repeat until the owner is satisfied with current product quality.
7. Only then define and begin the next Product Feature Expansion phase.

Do not treat aesthetic or output-quality feedback as a reason to relax financial-integrity rules.

## Handoff for a new ChatGPT / Codex session

Start with this instruction:

> Continue Lumina / Stock_Ana from `docs/PROJECT_STATUS.md` and current `main`. Verify live GitHub/Vercel state before assuming SHAs are still current. Phase 4 is complete; do not redo Phases 1–4 unless a real regression is found. We are in post-Phase-4 stabilization: review production feedback, make focused fixes through protected PRs, preserve financial-integrity and Firebase safety rules, and do not begin Product Feature Expansion until the owner explicitly says the current result is satisfactory.

When this file becomes stale, update it in the same PR that changes the project phase or major operational state.