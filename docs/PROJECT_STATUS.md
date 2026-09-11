# Lumina / Stock_Ana — Master Project Status

Last updated: 2026-09-11 (Asia/Bangkok)

This file is the durable engineering handoff for new ChatGPT/Codex sessions. Prefer live GitHub, CI, Vercel, Firebase, and issue evidence over old chat history whenever they disagree.

## How to interpret SHAs in this file

Do **not** treat this document as an authoritative record of the mutable `main` head SHA. A commit that edits this file changes `main` again, so embedding its own final head would become stale immediately.

Always query live `main` before starting work. SHAs below identify stable application-behavior baselines or historical acceptance points.

## Current state

- Current stage: **Phase 4.5 Production Stabilization complete; Phase 5 — Analysis Quality & Data Coverage actively underway**.
- Current working mode: **Phase 5 execution authorized by owner (advancing systematically across phases with rigorous institutional engineering)**.
- Primary end-to-end financial reference issuer: **MSFT** (operating tech), **SOFI** (fintech / banking / financial sector guard).
- Production URL: `https://stock-ana-ten.vercel.app`.
- Latest merged milestone: PR #55 (`0f67ed19e722b1763b946057353d528442835d9d`) — Financial Sector Guard UI and SEC diagnostic routes.
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

Do not weaken these controls casually. If visibility is changed back to private, re-check that the selected GitHub plan still enforces the same protection before relying on it.

## Architecture principle

**Verified Data → Deterministic Calculations → User Context / History → AI Interpretation**

Non-negotiable rules:

- AI must never invent financial facts. Missing or unverified facts remain null / unavailable.
- Deterministic code owns valuation math and canonical calculations.
- AI may propose valuation assumptions only when they are clearly separated from verified facts.
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
- No fabricated debt / investment taxonomy when a filing cannot prove it.

### Phase 4 — Core Platform Foundation ✅

Phase 4A–4E engineering and all production acceptance gates are complete.

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

Active ruleset `Protect main` (`22863655`) requires PRs and the strict `verify` status check. PR #48 demonstrated the protected merge flow in practice.

### Gate 3 — Authenticated production smoke ✅

Recorded production acceptance includes:

- Production Google sign-in succeeded with an authorized owner account.
- Unauthenticated `POST /api/analyze` returned `401`.
- Public `GET /api/live-quotes?symbols=MSFT` returned `200`.
- Authenticated MSFT Analyze completed and persisted a report.
- Firestore history updated and the saved MSFT report hydrated after reload.
- Owner soft-delete succeeded; the deleted report disappeared from visible history while remaining stored as a soft-deleted record.
- Cross-user reads and client hard deletes remain denied by active production rules and repository security-boundary tests.
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

- Public conviction score is recalculated by the deterministic 0–100 scorer instead of displaying arbitrary AI factor scores.
- Scoring fails closed when required inputs are missing.
- Exact ratios can be derived from disclosed same-period statement values when needed inputs are present.
- Stale DCF narrative is replaced when canonical DCF is recalculated.
- Empty / placeholder business and holder rows are filtered from rendering.
- Production prompt defines canonical repeating-array item fields and explicitly forbids placeholder rows.
- Managed-agent retry budget increased from 45 seconds to 120 seconds while remaining bounded.

Application-behavior baseline SHA: `73905f585ea8001c462aaf8a7014b3c7ff926b9a`.

### PR #52 — Master Long-Term Roadmap
- Introduced `docs/ROADMAP.md` covering Phase 4.5 through Phase 12.

### PR #53 — Report UX & Authentication Clarity
- Relocated data provenance & disclaimers to footer (`#section-provenance`) with navbar jump link.
- Retained Executive Stock Spotlight Hero at top of reports.
- Added landing view authentication banner with auto-Google popup when unauthenticated analyze is attempted.

### PR #54 — Financial Data Coverage & Timestamp Integrity
- Expanded financial statement prompt schemas with banking lines (NII, non-interest income, provision for credit losses, deposits, loans) and corporate balance sheet equity (goodwill, common stock, retained earnings, AOCI).
- Defaulted fresh report `generated_at` to ISO timestamp.
- Auto-cleared sign-in errors upon successful user authentication.

### PR #55 — Financial Sector Guard & SEC Diagnostic Routing
- Mounted `/api/sec-preview` and `/api/sec-compare` in Express server to ensure clean JSON responses.
- Added institutional Financial Sector Guard in `IntrinsicValueEngine.tsx` explaining why generic FCFF is disabled for depository/fintech institutions and displaying recommended sector methodology.

## Current production health

At the time of this handoff, production was re-verified after the docs-only PR #50 merge:

- Vercel production deployment for PR #50 merge SHA `a84bf181a4864e4342e0d7f54b677817168a64bf` reached `READY`.
- Push-to-main `Verify Lumina` for that docs-only merge passed all steps.
- Public MSFT live-quote smoke returned HTTP 200 with structured market data.

These checks establish deployment health but do not replace live verification in a future session.

Known runtime observations:

- Node `[DEP0169] url.parse()` deprecation warnings predate the latest application release and appear to originate from dependency/runtime behavior rather than repository source.
- Earlier Gemini free-tier quota errors (`too_many_requests`) occurred during production Analyze testing. PR #49 expanded the bounded retry window so provider-directed retry waits can be honored longer. Treat provider quota exhaustion as an operational limitation, never as permission to fabricate fallback analysis.

Do not launch an unrelated major dependency upgrade merely to silence the Node deprecation warning.

## Verification workflow for meaningful changes

1. Query live `main` and production state first.
2. Create a focused branch from current `main`.
3. Make the smallest safe change.
4. Add / update regression coverage where appropriate.
5. Run relevant tests.
6. Run `npm run lint`.
7. Run `npm run build`.
8. Run `git diff --check`.
9. Open a PR to `main`.
10. Require `Verify Lumina` to pass.
11. Merge through the protected PR path.
12. Confirm Vercel production reaches `READY` on the exact merged SHA.
13. Smoke the affected production behavior.

Firebase/security/backend changes also require their specific operational runbooks and production verification.

## Current review loop

The immediate workflow is intentionally **not** a feature-expansion phase yet:

1. Owner uses the production website normally.
2. Owner reports bugs, confusing output, data-quality problems, UI issues, or desired refinements.
3. Review live behavior and current source before changing code.
4. Fix the defect through a focused PR with regression coverage where practical.
5. Verify production again.
6. Repeat until the owner is satisfied with current product quality.
7. Only then define and begin the next Product Feature Expansion phase.

Do not treat aesthetic or output-quality feedback as a reason to relax financial-integrity rules.

## Handoff for a new ChatGPT / Codex session

Start with this instruction:

> Continue Lumina / Stock_Ana from `docs/PROJECT_STATUS.md`. Query live `main`, GitHub rules/CI, and Vercel before assuming mutable deployment state. Phase 4 is complete; do not redo Phases 1–4 unless a real regression is found. We are in post-Phase-4 stabilization: review production feedback, make focused fixes through protected PRs, preserve financial-integrity and Firebase safety rules, and do not begin Product Feature Expansion until the owner explicitly says the current result is satisfactory.

Update this file when the project phase, architecture contract, production acceptance, or major operational state changes. Do not update it merely because a docs-only commit changed the `main` SHA.