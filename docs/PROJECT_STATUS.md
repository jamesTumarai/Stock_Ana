# Lumina / Stock_Ana — Master Project Status

Last updated: 2026-09-11 (Asia/Bangkok)

This file is the durable engineering handoff for new ChatGPT/Codex sessions. Prefer live GitHub, CI, Vercel, Firebase, and issue evidence over old chat history whenever they disagree.

## How to interpret SHAs in this file

Do **not** treat this document as an authoritative record of the mutable `main` head SHA. A commit that edits this file changes `main` again, so embedding its own final head would become stale immediately.

Always query live `main` before starting work. SHAs below identify stable application-behavior baselines or historical acceptance points.

## Current state

- Current stage: **Post-Roadmap Integrity Hardening (Active 🔄; Feature expansion frozen until P0–P2 integrity hardening is accepted)**.
- Current working mode: **Systematic resolution of P0–P2 issues across focused protected PRs (PR A through PR I)**.
- Primary end-to-end financial reference issuer: **MSFT** (operating tech), **SOFI** (fintech / banking / financial sector guard).
- Production URL: `https://stock-ana-ten.vercel.app`.
- Latest merged milestone: PR #68 (`0e35cbe`) — Phase 9 Valuation Integrity Hardening & Elimination of Fabricated Defaults (PR B).
- Phase 4 operational acceptance issue: **#47 — closed as completed**.

## Canonical Phase Acceptance Matrix

| Phase | Description | Planned | Implemented | CI Verified | Production Verified | Owner Accepted | Current Status | Evidence / PR |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | Financial Integrity Cleanup | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **2** | Runtime / Deterministic Validation | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **3** | Verified Data + Valuation Core | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **4** | Core Platform Foundation | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #47, #48, #49 |
| **4.5** | Post-Roadmap Integrity Stabilization | ✅ | 🔄 | 🔄 | 🔄 | ⏳ | `Re-opened` | PR A – PR I Hardening |
| **5** | Analysis Quality & Data Coverage | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Implemented partially` | PR #56–#58 (revalidation required) |
| **6** | Report Experience & UI Polish | ✅ | ✅ | ✅ | ⚠️ | ⏳ | `Implemented` | PR #59, #60 (production UX pending) |
| **7** | Portfolio & User Intelligence | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Partial` | PR #61 (persistence & history hardening) |
| **8** | Monitoring & Alerts | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Prototype` | PR #62 (client on-open prototype) |
| **9** | Comparison & Decision Tools | ✅ | ✅ | ✅ | ✅ | ⏳ | `Implemented (Hardened)` | PR #63, PR #68 (canonical DCF unification) |
| **10** | Performance, Cost & Reliability | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Partial` | PR #64 (observability & cache semantics) |
| **11** | Productization / Subscription | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Prototype` | PR #65 (client entitlement prototype) |
| **12** | Advanced Investment Intelligence | ✅ | ⚠️ | ✅ | ⚠️ | ⏳ | `Experimental` | PR #66 (rebuilding against canonical DCF) |

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

### PR #56 — SEC XBRL Canonical Financial Mapper Expansion
- Expanded SEC XBRL Canonical Financial Mapper (`secFinancialMapper.ts`) with explicit mapping for `stock_based_compensation`, `depreciation`, `common_stock`, and `retained_earnings`.
- Added `stock_based_compensation` to `CashFlowData` in `src/types.ts` and prompt schemas in `server.ts`.
- Updated comparison rules in `secReportComparison.ts` and diagnostics in `secCoverageDiagnostics.ts`.

### PR #57 — SBC Statement Rendering & Financial Sector Conviction Scorer
- Rendered `stock_based_compensation` (SBC) as an explicit non-cash add-back row in both banking and standard templates of `FinancialStatementsTable.tsx`, synchronized with interactive chart.
- Upgraded `convictionScorer.ts` with financial sector awareness (`fintech`, `banking`, `fintech_pe`, `ddm`) allowing depository institutions with Financial Sector Guard to evaluate gracefully in Pillar 3 via Multiples & Solvency.

### Phase 5 — Leases, Debt Normalization & Deterministic LTM Aggregation
- Mapped ASC 842 lease liabilities (`OperatingLeaseLiabilityCurrent`, `OperatingLeaseLiabilityNoncurrent`, `OperatingLeaseLiability`, `OperatingLeaseRightOfUseAsset`), `short_term_debt`, `long_term_debt`, and `total_debt` in SEC XBRL mapper.
- Implemented deterministic derivations for total debt and total operating lease liabilities from verified components when aggregate concepts are omitted.
- Built `src/utils/statementAggregation.ts` for deterministic 4-quarter Annual & LTM aggregation strictly obeying GAAP flow vs stock rules with fail-closed null handling.
- Integrated Annual / LTM toggle in `FinancialStatementsTable.tsx` with institutional provenance status banner.

### Phase 7 — Portfolio & User Intelligence ✅
- Built `portfolioEngine.ts` and `researchTimeline.ts` for institutional portfolio management.
- Holdings tracking with live valuation, P/L, concentration risk warnings (weight >= 30%), and portfolio-weighted Margin of Safety.
- Delivered factual mathematical deltas for "What Changed" since prior analysis without AI narrative invention.

### Phase 8 — Monitoring & Alerts ✅
- Built `monitoringEngine.ts` with configurable materiality thresholds.
- Alerts for valuation breaches, overvalued warnings, conviction score shifts (>= 10 pts), new SEC filings (10-K, 10-Q, 8-K), and portfolio concentration risk.
- Interactive `AlertsModal.tsx` with filter tabs, unread indicators, and threshold controls.

### Phase 9 — Comparison & Decision Tools ✅
- Built `decisionEngine.ts` featuring Reverse DCF back-solving for market-implied growth hurdles.
- 2D Sensitivity Matrix (5x5 grid WACC vs Terminal Growth) and deterministic 3-stage scenarios (Bear, Base, Bull).
- Normalized peer comparison extractor enforcing strict factual integrity.

### Phase 10 — Performance, Cost & Reliability ✅
- Built `SecTtlCache` (`secCache.ts`): Bounded in-memory TTL cache with LRU eviction for SEC EDGAR company facts, submissions, and packages, eliminating redundant multi-megabyte downloads.
- Built `costEstimator.ts`: Transparent AI token pricing models (Flash and Pro tiers), prompt/completion cost derivation, and USD/THB currency calculations.
- Upgraded `ReportTemplate.tsx` with 5-column executive summary metrics grid displaying Docs, Time, Runs, Tokens, and live AI Cost with localized tooltips and USD/THB FX conversion.
- Mounted structured `/api/health` diagnostics endpoint across Express and Vercel functions reporting memory usage, uptime, service configuration, and SEC cache telemetry.
- Built `LatencyTracker` (`latencyTracker.ts`): Stage-level latency tracking for market snapshots, Gemini stream, and valuation assumption bridge, emitted in SSE `final_stats` events.
- 62 regression test suites passing with 100% success.

### Phase 11 — Productization / Subscription Readiness ✅
- Built 3 institutional subscription tiers (`subscriptionTiers.ts`): Explorer / Free, Pro Analyst, Institutional Desk, specifying feature gates, monthly quotas, model access, and SLA indicators.
- Implemented pure deterministic `entitlementEngine.ts`: Feature entitlement evaluation, monthly analysis quota enforcement, and portfolio holdings limitation. Strict architectural invariant: entitlements operate strictly at the access boundary; canonical DCF formulas, SEC filings integrity, and mathematical calculations are never altered or degraded by tier.
- Client subscription service (`subscriptionService.ts`): Local storage and Node-safe tracking of billing cycles (YYYY-MM), monthly analysis counts, and token consumption.
- Interactive `SubscriptionModal.tsx`: Plan comparison matrix, live monthly quota consumption progress bar, upgrade actions, and financial integrity guarantee.
- UI integration (`LandingView.tsx`, `App.tsx`): Crown tier badge pill in desktop & mobile headers, pre-analysis quota checks, and usage recording upon report generation.
- Full unit test coverage across all tier definitions, entitlement checks, and usage services.

### Phase 12 — Advanced Investment Intelligence ✅
- Built `valuationDecompositionEngine.ts`: Pure deterministic marginal attribution of Fair Value deltas across historical reports ($\Delta$ Cash Flow Growth, $\Delta$ WACC / Discount Rate, $\Delta$ Terminal Growth, $\Delta$ Capital Structure & Dilution) with zero qualitative hallucination.
- Implemented Investment Thesis Health Classification (`upgraded`, `intact`, `under_pressure`, `macro_driven`) linking financial statement evolution with conviction scores.
- Built `macroStressEngine.ts`: Institutional stress sandbox evaluating 5 macroeconomic shock scenarios (Base Case, Stagflation Shock, Recessionary Demand Contraction, Higher-for-Longer Rates, AI Productivity Wave) with real-time Stressed Fair Value and Margin of Safety recalculation.
- Built `secFilingDiffEngine.ts`: Deterministic YoY topline/bottomline growth, operating margin expansion/compression (bps), diluted share count shifts, and working capital cash conversion divergence alerts.
- Built `ValuationDecompositionModal.tsx`: 3-tab institutional analysis suite integrated into Section 3 (Valuation & DCF) of `ReportTemplate.tsx`.
- 95 test suites passing with 100% success rate.

### Post-Roadmap Integrity Hardening PRs

#### PR #67 — Security Boundary: Cross-User JSONL Isolation & Scoped Artifact Ownership (PR A, P0-4) ✅
- Disabled raw JSONL download endpoint (`/api/download_jsonl`) in production unless explicitly enabled via server environment variable.
- Enforced strict caller authentication and user-scoped verification for log downloads (`run_log_<uid>_<runId>.jsonl`).
- Replaced ticker-based log retrieval with caller-owned opaque `runId` validation.
- Scoped artifact uploads to authenticated UID directory (`workspace/artifacts/<uid>/<fileName>`), eliminating cross-user data leakage and collisions.
- Added 5 automated security tests verifying unauthenticated blocking, cross-user denial (403), and artifact scoping.
- Merge SHA: `c2233a1`.

#### PR #68 — Valuation Integrity: Elimination of Fabricated Defaults & Canonical DCF Unification (PR B, P0-1) ✅
- Removed all fabricated valuation defaults (`9.0`, `2.5`, `10`, `$100`, `FCF 10`, and reverse-derived FCF formula `fv * ((wacc - tg) / 100) / 1.10`) from Phase 9 Scenario Analysis, Sensitivity Matrix, and Reverse DCF.
- Built `src/utils/valuationSandboxAdapter.ts`:
  - Enforces Financial Sector Guard (fail-closed for banks, lenders, insurers, FinTech platforms routing to non-FCFF models).
  - Validates verified canonical inputs (price, revenue, shares, net cash, WACC, terminal growth, base CAGR, base FCF margin).
  - Fails closed with explicit institutional notices (`Unavailable / Insufficient verified valuation inputs`) when inputs are missing.
- Refactored `src/utils/decisionEngine.ts` to unify calculations with canonical `calculateStrictDCFValue` from `dcfMathEngine.ts`.
- Rewrote Reverse DCF assessments to be descriptive and neutral rather than claiming speculative outperformance probabilities.
- Replaced sliders in `ScenarioAnalysisModal.tsx` to recalculate strictly through `recalculateSandboxFairValue` and clearly labeled them as "User Assumptions".
- Added 11 regression tests in `valuationSandboxAdapter.test.ts` and updated 13 tests in `decisionEngine.test.ts`. All 74 regression test files in `src/` passing.
- Merge SHA: `0e35cbe`.

#### PR #69 — Phase 12 Deterministic Revaluation Bridge & Macro Stress Engine (PR C, P0-2, P0-3, P1-12) 🔄
- Replaced heuristic valuation sensitivity approximations (`-0.10 * prevFv`, `0.06 * prevFv`, etc.) and arbitrary 60/40 residual splits with a true Sequential Valuation Revaluation Bridge:
  - Step 0: Previous baseline model valuation $V_0$.
  - Step 1: Base Operating Revenue Fact update $V_1$.
  - Step 2: Growth Assumption Revision $V_2$.
  - Step 3: Margin Assumption Revision $V_3$.
  - Step 4: Cost of Capital (WACC Shift) $V_4$.
  - Step 5: Long-Term Terminal Growth $V_5$.
  - Step 6: Capital Structure & Net Cash / Debt $V_6$.
  - Step 7: Share Count & Dilution / Horizon $V_7$.
  - Exact telescoping sum invariant: $\sum_{k=1}^7 \Delta V_k = V_7 - V_0$. Any difference with published report fair value is explicitly presented as `Unattributed / Model Interaction`.
- Enforced strict financial sector guard (fail-closed for banks, lenders, insurance, and FinTech non-FCFF models) and ticker mismatch guard.
- Removed fabricated conviction fallback default (`?? 70`); missing conviction shifts fail gracefully (`convictionShift = null`).
- Replaced arbitrary fixed dollar threshold (`$15`) with relative percentage thresholds ($\pm 10\%$) for investment thesis health classification.
- Rebuilt Macro Stress Sandbox (`macroStressEngine.ts`) to recalculate stressed valuations strictly via `calculateStrictDCFValue` instead of multiplying by handcrafted sensitivity heuristics.
- Added explicit institutional labels: "System-defined illustrative stress assumptions".
- Fixed scenario null-check crash in `dcfMathEngine.ts`.
- Added 8 regression tests in `valuationDecompositionEngine.test.ts` and 6 tests in `macroStressEngine.test.ts`. All unit test suites passing (100%).

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