# Lumina / Stock_Ana — Master Project Status

Last updated: 2026-09-14 (Asia/Bangkok)

This file is the durable engineering handoff for new ChatGPT/Codex sessions. Prefer live GitHub, CI, Vercel, Firebase, and issue evidence over old chat history whenever they disagree.

## How to interpret SHAs in this file

Do **not** treat this document as an authoritative record of the mutable `main` head SHA. A commit that edits this file changes `main` again, so embedding its own final head would become stale immediately.

Always query live `main` before starting work. SHAs below identify stable application-behavior baselines or historical acceptance points.

## Current state

- Current stage: **LUMINA V1 — TECHNICALLY COMPLETE**.
- Current working mode: **V1 closure complete. Pending expectation creation, production application gates, regression gates, and final production Firestore rules proof pass.**
- Primary end-to-end financial reference issuer: **MSFT** (operating tech), **SOFI** (fintech / banking / financial sector guard).
- Production URL: `https://stock-ana-ten.vercel.app`.
- Historical Accepted Integrity Baseline SHA: `d2315f069379dfe946dee0952231005cc6ba9746` (Phase 4.5 Owner Accepted).
- Latest verified behavior-changing production SHA: `2293430b8a642a8da6b0f4f05bbdf24270c557a6` (PR #120; Vercel deployment `dpl_s2QQzm7SjYKyXXTazvCbfMHS8oqi`). Subsequent documentation-only main SHAs do not change this application baseline.
- Latest merged application milestone: PR #120 (Persist new PENDING expectations before evaluation).
- Regression gate: 82 test files (79 src + 3 server), 254 passing cases, 0 failed, 0 skipped. Case counts follow the repository runner convention: standalone assertion files without node:test summaries count as one case.

## Canonical Phase Acceptance Matrix

| Phase / Workstream | Description | Planned | Implemented | CI Verified | Production Verified | Owner Accepted | Current Status | Evidence / PR |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | Financial Integrity Cleanup | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **2** | Runtime / Deterministic Validation | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **3** | Verified Data + Valuation Core | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | Baseline |
| **4** | Core Platform Foundation | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #47, #48, #49 |
| **4.5** | Post-Roadmap Integrity Stabilization | ✅ | ✅ | ✅ | ✅ | ✅ | `Owner Accepted` | PR #67–#76, #78–#85, #87–#101 |
| **5** | Analysis Quality & Data Coverage | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #56–#58, PR #70 |
| **6** | Report Experience & UI Polish | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #59, #60, #109 |
| **7** | Portfolio & User Intelligence | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #61, PR #71, PR #108, #109 |
| **8** | Monitoring & Alerts | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #62, PR #72, PR #85, PR #107 |
| **9** | Comparison & Decision Tools | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #63, PR #68, PR #80, PR #81, PR #106 |
| **10** | Performance, Cost & Reliability | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #64, PR #75, PR #85 |
| **11** | Productization / Subscription | ✅ | ❌ | ✅ | ✅ | ✅ | `Removed per owner directive` | Unlimited Platform Access |
| **12** | Advanced Investment Intelligence | ✅ | ✅ | ✅ | ✅ | ✅ | `Complete` | PR #66, PR #69, PR #70, PR #73, PR #83, PR #104–#109 |
| **V2-A** | Investment Memory Foundation | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #104, #111, #115 |
| **V2-B** | Structured Thesis & Expectations Engine | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #105, #111, #112, #113, #116 |
| **V2-C** | What Changed Intelligence Engine | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #106, #113, #117 |
| **V2-D** | Actionable Decision Context Engine | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #107, #113, #116 |
| **V2-E** | Thesis-Aware Watchlist Intelligence | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #108, #113, #116 |
| **V2-F** | Report Integration & Evidence UX | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #109, #113, #116 |
| **V2-G** | Final Verification & Acceptance Dossier | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #110, #114, #118 |
| **Repair A** | Memory SEC Authority & UID Cache Isolation | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #111 |
| **Repair B** | Thesis Revisions & Explicit Hardened Rules | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #112 |
| **Repair C** | Canonical Expectation Eval & Watchlist Integration | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #113 |
| **Repair D** | Final Technical Completion Evidence Reconciliation | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #114 |
| **PR E** | Comparable-Period & Share/Provenance Semantics | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #115 |
| **PR F** | Historical Thesis & Durable Expectations Integration | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #116 |
| **PR G** | Uncertainty Propagation in Decision Intelligence | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #117 |
| **PR H** | True Final Technical Closure Documentation | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #118 |
| **PR I** | Durable Expectation Evaluation Outcome Persistence | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #119 |
| **Closure patch** | Pending Expectation Creation Persistence | ✅ | ✅ | ✅ | ✅ | — | `Technically Complete` | PR #120 |

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

Final production rules proof was completed on 2026-09-14 using Firebase CLI 15.30.0 and the Firebase Rules API.

- Deployed source Git SHA: `f45dbac06a199baf167e2b6de4f8c3d38a82428c`; `firestore.rules` was last changed in `0a1c97249d6bc8e69e404dd9f07af421aef2a19b`.
- Target verified before and after deployment: project `stock-analyze-a89d0`, database `(default)`, source `firestore.rules`.
- Repository rules preflight passed immediately before deployment.
- `firebase deploy --only firestore:rules --project stock-analyze-a89d0` compiled and released the rules successfully. No data migration or unrelated Firebase service was deployed.
- Active release: `projects/stock-analyze-a89d0/releases/cloud.firestore`, updated `2026-09-14T13:23:22.751261Z` (20:23:22 Asia/Bangkok).
- Active ruleset: `projects/stock-analyze-a89d0/rulesets/c67847f0-ea61-44cb-bb77-fb97ffa192b0`, created `2026-09-14T13:23:21.322191Z`.
- Firebase Rules API source and reviewed local `firestore.rules` have the same normalized SHA-256: `d59727b005bdcff6f60290f70678eb7ee4001767f414683064ffff657b344553`.
- Authenticated application history/save and cross-user isolation smokes were not repeated during this rules-only operation; existing rule regression coverage remains the evidence for those behaviors.

Production target remains exactly:

- Firebase project: `stock-analyze-a89d0`
- Firestore database: `(default)`
- rules source: `firestore.rules`

Operational acceptance recorded:

- Previous rollback point: ruleset `fdb9672a-8ffb-455e-a23a-49be85620a42`, active release timestamp `2026-09-11T02:38:05.665867Z`.
- Firebase operator identity and `(default)` database verified.
- Repository Firebase preflight passed immediately before deployment.
- Rules-only deployment succeeded.
- Active Firebase Rules API release timestamp after deployment: **2026-09-14 20:23:22 Asia/Bangkok**.
- Deployed source matches reviewed Git rules, verified by normalized source hash.
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

### Phase 8 — On-Open Research Checks & Alerts (Monitoring Engine) ✅
- Built `monitoringEngine.ts` with configurable materiality thresholds and stable event fingerprinting (`alert_${ticker}_${type}_${metric}`).
- Client-evaluated on application open and watchlist/portfolio state changes with real market quotes (`liveQuotes`) and dynamically derived `portfolioSummary`.
- Alerts for valuation breaches, overvalued warnings, conviction score shifts (>= 10 pts using canonical `getPreviousReport`), new SEC filings (accession-verified, duplicate citations suppressed), and portfolio concentration risk.
- Interactive `AlertsModal.tsx` with filter tabs, unread indicators, and threshold controls.

### Phase 9 — Comparison & Decision Tools ✅
- Built `decisionEngine.ts` featuring Reverse DCF back-solving for market-implied Revenue CAGR hurdle.
- 2D Sensitivity Matrix (5x5 grid WACC vs Terminal Growth) and deterministic 3-stage scenarios (Bear, Base, Bull).
- Normalized peer comparison extractor enforcing strict factual integrity.

### Phase 10 — Performance, Cost & Reliability ✅
- Built `SecTtlCache` (`secCache.ts`): Bounded in-memory TTL cache with LRU eviction for SEC EDGAR company facts, submissions, and packages, eliminating redundant multi-megabyte downloads.
- Built `costEstimator.ts`: Transparent AI token pricing models (Flash and Pro tiers), prompt/completion cost derivation, and USD/THB currency calculations.
- Upgraded `ReportTemplate.tsx` with 5-column executive summary metrics grid displaying Docs, Time, Runs, Tokens, and Estimated AI Cost with localized tooltips and USD/THB FX conversion.
- Mounted structured `/api/health` diagnostics endpoint across Express and Vercel functions returning minimal public telemetry and protected detailed internal diagnostics.
- Built `LatencyTracker` (`latencyTracker.ts`): Stage-level latency tracking for market snapshots, Gemini stream, and valuation assumption bridge, emitted in SSE `final_stats` events.
- 74 regression test files across `src/` and `server/` passing with 100% success (171 test cases).

### Phase 11 — Productization / Subscription Readiness (Removed per owner directive)
- **Status**: The entire subscription, tier gating, and quota system has been removed per owner directive (2026-09-12).
- Lumina provides full, unrestricted, unlimited access to all AI models (including Pro), Deep Think features, and financial valuation tools for all authenticated users without subscription badges or paywalls.

### Phase 12 — Advanced Investment Intelligence ✅
- Built `valuationDecompositionEngine.ts`: Pure deterministic marginal attribution of Fair Value deltas across historical reports ($\Delta$ Cash Flow Growth, $\Delta$ WACC / Discount Rate, $\Delta$ Terminal Growth, $\Delta$ Capital Structure & Dilution) with zero qualitative hallucination.
- Implemented Investment Thesis Health Classification (`upgraded`, `intact`, `under_pressure`, `macro_driven`) linking financial statement evolution with conviction scores.
- Built `macroStressEngine.ts`: Institutional stress sandbox evaluating 5 macroeconomic shock scenarios (Base Case, Stagflation Shock, Recessionary Demand Contraction, Higher-for-Longer Rates, AI Productivity Wave) with real-time Stressed Fair Value and Margin of Safety recalculation.
- Built `secFilingDiffEngine.ts`: Deterministic YoY topline/bottomline growth, operating margin expansion/compression (bps), diluted share count shifts, and working capital cash conversion divergence alerts.
- Built `ValuationDecompositionModal.tsx`: 3-tab institutional analysis suite integrated into Section 3 (Valuation & DCF) of `ReportTemplate.tsx`.
- Historical Phase 12 validation: 95 test suites passing with 100% success rate (historical suite count; see Final Integrity Test Gate for current authoritative metrics).

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

#### PR #69 — Phase 12 Deterministic Revaluation Bridge & Macro Stress Engine (PR C, P0-2, P0-3, P1-12) ✅
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
- Merge SHA: `b430e0d`.

#### PR #70 — SEC Filing Diff & Comparable-Period Matching (PR D, P1-1, P1-2) ✅
- Enforced strict Comparable Period Matching in `src/utils/secFilingDiffEngine.ts`:
  - Parses period descriptors and normalizes statements.
  - Matches either consecutive annuals (Annual YoY: FY2025 vs FY2024) or same quarters across consecutive fiscal years (Same-Quarter YoY: Q3 2025 vs Q3 2024).
  - Rejects mixed comparisons (e.g. Q3 vs FY2024) and fails closed (`null`).
  - Chronological sorting independence: correctly compares the two latest periods regardless of whether inputs are sorted ascending or descending.
- Grounded Cash Conversion Analysis in empirical accounting metrics:
  - Cash Conversion Ratio = Operating Cash Flow / Net Income ($OCF / NI$).
  - Evaluates conversion quality ($\ge 1.0$x healthy, $< 0.70$x warning, negative OCF with positive Net Income flagged as severe divergence).
  - Removed speculative qualitative guessing ("อาจเกิดจากการสะสมลูกหนี้หรือสินค้าคงคลัง").
  - Factual Working Capital expansion check: only flags accounts receivable if A/R growth expanded $> 10\%$ faster than revenue growth based on verified balance sheet items.
- Enhanced Tab 3 in `ValuationDecompositionModal.tsx`:
  - Added Comparison Type badge (`Annual YoY` vs `Same-Quarter YoY`).
  - Added FCF YoY, Cash Conversion Ratio ($OCF/NI$), Operating Margin bps delta, and Share count dilution/buyback badges.
  - Added display for factual working capital divergence alerts.
- Added 9 unit tests in `src/utils/__tests__/secFilingDiffEngine.test.ts`. All unit tests passing.
- Merge SHA: `d2a1804`.

#### PR #71 — Portfolio & History Record Hydration (PR E, P1-3, P1-4, P1-5) ✅
- **Research Timeline & Firestore Record Adapter (P1-3)**:
  - Built canonical `unwrapHistoryRecord` in `src/utils/researchTimeline.ts` seamlessly extracting report payload from Firestore wrappers (`{ id, ticker, createdAt, data: report }`), legacy records, and direct reports.
  - Fixed same-day multiple analysis collision: replaced fragile date-only Map keys with composite keys (`reportId` + `createdTimestamp`), ensuring multiple same-day analyses for the same ticker are retained in chronological order.
  - Implemented `getPreviousReport` helper to strictly locate the latest previous analysis strictly prior to the active report.
  - Refactored `ResearchTimelineCard.tsx` and `ReportTemplate.tsx` to use canonical `getPreviousReport`.
- **Portfolio Missing Quote Integrity (P1-4)**:
  - Eliminated dangerous fallback that substituted cost basis as market value when quotes were missing in `calculatePortfolioSummary`.
  - Added quote coverage metrics: `priced_holdings_count`, `unpriced_holdings_count`, `pricing_coverage_pct`, `priced_market_value`, and `unpriced_cost_basis`.
  - Strictly sets `total_market_value = null` and `total_unrealized_pnl = null` when any holding lacks a live quote, preventing the illusion of verified aggregate market value.
  - Updated `PortfolioModal.tsx` to clearly display coverage percentages and missing price alerts.
- **Starter Watchlist Disaggregation (P1-5)**:
  - Disaggregated starter ticker suggestions (`SUGGESTED_WATCHLIST_TICKERS = ['MSFT', 'AAPL', 'NVDA', 'SOFI']`) from user's explicit watchlist.
  - `loadLocalWatchlist` returns empty array `[]` when storage is empty, without falsely masquerading starter tickers as saved user holdings.
  - Added opt-in suggested ticker pill buttons with one-click addition in `PortfolioModal.tsx`.
- Merge SHA: `2c698db`.

#### PR #72 — Monitoring Semantics & Alert Correctness (PR F, P1-8) ✅
- **Honest On-Open Semantics**:
  - Eliminated misleading background worker/daemon claims; clearly documented client-side on-open evaluation semantics in `AlertsModal.tsx` and navbar badge tooltips.
- **Stable Fingerprinting**:
  - Replaced non-deterministic random IDs with deterministic fingerprints (`alert_${ticker}_${type}_${metric}`), preserving read state across sessions and application restarts.
- **Live Market Evaluation & Dynamic Derived State**:
  - Wired live quotes (`liveQuotes`) into `runMonitoringChecks(reports, watchlist, config, liveQuotes)` in `App.tsx` for real-time breach detection.
  - Replaced stale report snapshot valuation with live market quotes.
  - Dynamically recalculated `portfolioSummary` and concentration risk on-the-fly.
  - Added real-time threshold customization slider controls with instant reactive trigger recalculation.
- Merge SHA: `571fd1a`.

#### PR #73 — Sector Valuation Architecture & Deterministic DDM (PR G, P0-6) ✅
- **Decoupled Model Validation Architecture**:
  - Refactored `src/domain/valuationStore.ts` to enforce sector-specific valuation prerequisites: standard DCF strictly requires operating-company FCFF inputs, while Dividend Discount Model (DDM), REIT AFFO, FinTech P/E, and Relative models validate against their respective sector inputs.
- **Deterministic Closed-Form DDM Calculations**:
  - Implemented Gordon Growth Model and Residual Income valuation engine in `src/utils/valuation/ddmCalculator.ts`.
  - Added deterministic sensitivity analysis and fail-closed handling when dividend inputs or required returns are unavailable.
- **Sector Valuation Architecture Card**:
  - Upgraded `ReportTemplate.tsx` with dedicated non-FCFF sector valuation card presenting institutional DDM/AFFO metrics with methodology badges and mathematical clarity.
- Merge SHA: `b6c6238`.

#### PR #74 — Server-Side Entitlement Authority & Tier Quotas (PR H, P0-5) [Superseded / Removed]
- *(Note: Built during Phase 4.5 baseline but subsequently superseded and deleted in PR #76 per explicit owner directive).*
- Ingested custom subscription claims in `server/auth/firebaseAuth.ts`.
- Built `server/middleware/entitlementAuthority.ts` (`enforceAnalyzeEntitlements`).
- Integrated HTTP 403/429 status handling in `src/App.tsx`.
- Merge SHA: `004a9e4`.

#### PR #75 — Observability & Documentation Reconciliation (PR I, P1-10, P2) ✅
- **Health & Operational Observability Testing**:
  - Added `server/routes/__tests__/healthRoutes.test.ts` verifying `/api/health` JSON payload (RSS memory, heap usage, process uptime, Node environment, Gemini/SEC/Firebase configuration flags, and SEC cache telemetry).
- **Master Documentation Reconciliation**:
  - Reconciled `docs/PROJECT_STATUS.md` and `docs/ROADMAP.md` to reflect complete delivery of PR A through PR I.
- Merge SHA: `7b89eff`.

#### PR #76 — Removal of Subscription System & Entitlement Gates ✅
- **Complete Deletion of Subscription System**:
  - Per owner directive, removed all subscription tiers (`Explorer / Free`, `Pro Analyst`, `Institutional Desk`), monthly analysis quotas, model access barriers, and header crown badges.
  - Removed `👑 Institutional` / `Pro` / `Free` crown button and badge from both desktop and mobile headers in `LandingView.tsx` and `App.tsx`.
  - Removed `SubscriptionModal.tsx` and all tier upgrade dialogs.
  - Removed client-side monthly quota checks (`evaluateAnalysisQuota`) and usage tracking (`recordAnalysisUsage`).
  - Removed server-side middleware `enforceAnalyzeEntitlements` from `/api/analyze`, granting unrestricted, unlimited access to all AI models (including Pro) and Deep Think for all authenticated users without quotas.
  - Purged 9 subscription/tier files across `src/domain/`, `src/services/`, `src/utils/`, and `server/middleware/`.
- Merge SHA: `cb87d22`.

### Post-Hardening Review Round 2 PRs

#### PR #78 — CI Gate Hardening (`ci/extend-regression-gate`) ✅
- Expanded CI test runner `scripts/runRegressionTests.mjs` to automatically discover and execute test suites across both `src/` and `server/`.
- Increased test file coverage from 41 to 73 test files executed under the mandatory CI regression gate.
- Added explicit server test execution proof logging for `server/routes/__tests__/fileSecurity.test.ts` and `server/routes/__tests__/healthRoutes.test.ts`.
- Merge SHA: `7e19bc4`.

#### PR #79 — LTM & Period Integrity (`fix/ltm-consecutive-quarters`) ✅
- In `src/services/sec/secFinancialMapper.ts`, enforced strict 4-consecutive-quarters requirement before computing LTM (Last Twelve Months) aggregates; returns unavailable (`null`) when quarterly gaps exist.
- Aligned fiscal year end detection across all quarters.
- Added regression tests verifying LTM fail-closed behavior on missing quarters.
- Merge SHA: `a5b72c2`.

#### PR #80 — Valuation Fail-Closed Hardening (`fix/valuation-fail-closed`) ✅
- Hardened `src/utils/valuationSandboxAdapter.ts` to strictly fail closed (`null`) when cash flow, revenue, or shares outstanding are missing (eliminating all fallback zeroes or estimates).
- Enforced financial sector guard preventing generic FCFF calculation for financial institutions.
- Added comprehensive regression tests proving zero hidden fallbacks.
- Merge SHA: `d6def73`.

#### PR #81 — Reverse DCF Bracketing & Revenue CAGR Metric (`fix/reverse-dcf-bracketing`) ✅
- In `src/utils/decisionEngine.ts`, expanded Reverse DCF bracketing search range (-50% to +100%) and bounded bisection iterations to prevent solver truncation.
- Fixed metric calculations to compute honest historical Revenue CAGR across multi-period statements without fallback defaults.
- Added regression tests verifying Reverse DCF bracketing convergence.
- Merge SHA: `456924e`.

#### PR #82 — Missing vs Zero UI & Solvency Ratios (`fix/missing-vs-zero-corporate-actions`) ✅
- In `src/components/CorporateActionsCard.tsx`, displayed 'Data unavailable' / 'ไม่มีข้อมูล' for missing dividend payout ratios instead of deceptive 0.0%.
- In `src/utils/metricCalculations.ts`, Quick Ratio strictly fails closed (`null`) if cash or current liabilities are missing/undefined.
- Added regression tests verifying Quick Ratio fail-closed behavior.
- Merge SHA: `92deabe`.

#### PR #83 — Valuation Decomposition SEC Diff Adapter (`fix/sec-diff-canonical-adapter`) ✅
- Exported typed canonical adapter `adaptFinancialStatementsToSecPeriodStatements` in `src/utils/secFilingDiffEngine.ts`, eliminating synthetic period hacks.
- Updated `src/components/ValuationDecompositionModal.tsx` to use the canonical adapter.
- Added end-to-end integration test verifying SEC filing diff with real mapper output.
- Merge SHA: `b2b28f9`.

#### PR #84 — DDM & Sector Valuation Honesty (`fix/ddm-sector-valuation-honesty`) ✅
- In `src/utils/valuation/ddmCalculator.ts`, eliminated arbitrary `payout=50` fallback; missing payout returns `null`.
- Tagged synthesized bear/bull scenarios as `system_illustrative`.
- Assigned `canonical_status: 'sourced_non_canonical'` in `modelSelector.ts` for sector models (DDM, REIT AFFO, FinTech P/E, Cyclical, Relative).
- Added regression tests verifying DDM missing payout handling and canonical status routing.
- Merge SHA: `7a78682`.

#### PR #85 — Monitoring & Operations Hardening (`fix/monitoring-operations-hardening`) ✅
- In `server/routes/healthRoutes.ts` and `api/index.js`, public `GET /api/health` returns minimal `{ status, ok, service: "lumina", timestamp }` without leaking deep memory/heap telemetry. `ok` is `true` iff both Gemini and SEC are configured. Detailed telemetry available via `?detailed=true`.
- In `src/utils/costEstimator.ts`, eliminated fabricated FX defaults (returns `null` THB cost when FX rate is absent), default unknown models to `standard` tier, avoid fabricating prompt/completion counts (sets `null` with `isEstimatedBreakdown: true`). Labeled as 'Estimated AI Cost' in `ReportTemplate.tsx`.
- Documented `SecTtlCache` as an in-memory per-instance best-effort warm cache.
- Verified `getLastSeenAccession` in `monitoringEngine.ts` before triggering SEC filing alerts.
- Total regression test runner: 73 test files executed (71 in `src/`, 2 in `server/`) with 149 passing test cases (100% pass rate).
- Merge SHA: `2cc8ae5`.

### Post-Hardening Review Round 3 PRs

#### PR #87 — Health Diagnostic Security & Readiness (`fix/health-diagnostic-security`) ✅
- Removed unauthenticated query-param bypass (`?detailed=true`) for detailed diagnostic telemetry across both Express and Vercel serverless entrypoints (`server/routes/healthRoutes.ts`, `api/index.js`).
- Public `/api/health` unconditionally returns minimal payload (`status`, `ok`, `service`, `timestamp`).
- Reconciled readiness semantics to canonical Firebase configuration resolution (`server/auth/firebaseProject.ts`). Detailed internal telemetry protected behind `INTERNAL_DIAGNOSTICS_KEY` or authenticated admin authority.
- Added regression tests verifying unauthenticated callers receive minimal payloads without internal leaks.
- Merge SHA: `9c051c2`.

#### PR #88 — Valuation Range & Macro Stress Integrity (`fix/valuation-range-macro-stress`) ✅
- In `src/utils/valuation/valuationStore.ts`, eliminated synthetic $\pm 15\%$ fair-value ranges in `relative_only` and `fintech_pe`. Preserved point-only fair values with `null` range boundaries when source range is not explicitly provided.
- In `src/utils/macroStressEngine.ts`, eliminated hidden economic floors (clamping WACC $\ge 4\%$, FCF margin $\ge 1\%$, terminal growth $\ge 0.5\%$). Base Case scenario exactly reproduces canonical base inputs. Stressed scenarios calculate exact mathematical parameters or fail closed with scenario unavailable reason when mathematically invalid ($WACC \le TG$).
- Added regression tests verifying point-value preservation, exact base case parameter reproduction, and fail-closed stress behavior.
- Merge SHA: `77117a5`.

#### PR #89 — SEC Comparison Integrity & Provenance Guards (`fix/sec-comparison-integrity`) ✅
- Enforced strict immediate-prior-year matching for YoY comparisons in `src/utils/secFilingDiffEngine.ts`: annual periods require `prior.fiscalYear === cur.fiscalYear - 1`; quarterly periods require `prior.quarter === cur.quarter && prior.fiscalYear === cur.fiscalYear - 1`. Non-consecutive comparisons (e.g. FY25 vs FY23) return unavailable.
- Added SEC provenance guard on `adaptFinancialStatementsToSecPeriodStatements`: generic or legacy `ReportData` without explicit SEC verification cannot enter the SEC filing diff or claim 'Verified SEC Filing Comparison'.
- Enforced truthful diluted shares comparison: requires historical diluted weighted average shares from verified SEC facts; returns `null` for `shareCountDeltaPct` when comparable historical shares are unavailable, strictly avoiding mixing common shares outstanding with diluted shares.
- Added regression tests for all matching, provenance, and dilution cases.
- Merge SHA: `1adba68`.

#### PR #90 — Ratio Missing-vs-Zero D/E Follow-up (`fix/ratio-missing-vs-zero`) ✅
- In `src/utils/metricCalculations.ts`, updated Debt-to-Equity derivation: prefers verified `total_debt`; only derives from short-term debt + long-term debt when BOTH components are finite verified numerical values. Missing or null components strictly fail closed (`null`) instead of defaulting to zero. Explicit verified zeroes remain supported.
- Audited adjacent solvency and liquidity ratios.
- Added regression tests for all null/finite combinations.
- Merge SHA: `d113399`.

#### PR #91 — Cost Estimator Fail-Closed Truthfulness (`fix/cost-estimator-truthfulness`) ✅
- In `src/utils/costEstimator.ts`, eliminated default/fallback pricing for unknown models and arbitrary regex matching of "pro" to Gemini 1.5 Pro. Unknown models return `null` pricing and `estimateTokenCost` returns `isAvailable: false` with reason.
- Attached pricing catalog metadata: source (`Google Cloud Vertex AI / Gemini API Official Pricing`), effective date, and catalog version.
- When `totalTokens` is provided without prompt/output split, surfaces explicit approximation note: `Approximate token allocation used (75% input / 25% output assumption)`.
- Updated `src/ReportTemplate.tsx` to display 'Unavailable' / 'ไม่พร้อมใช้งาน' for unpriced models and surface the 75/25 token allocation approximation pill and tooltip.
- Merge SHA: `d8d98c0`.

#### PR #92 — DDM Provenance Semantics (`fix/ddm-provenance-semantics`) ✅
- In `src/types.ts` and `src/utils/valuation/ddmCalculator.ts`, separated provenance for verified company facts ($D_0$) from scenario growth, cost of equity ($K_e$), and payout assumptions.
- Eliminated inheritance of `source_type = 'verified_dividend'` for scenario assumptions. Scenario assumptions are labeled `source_assumption` or `system_illustrative`.
- Added regression tests in `universalValuation.test.ts`.
- Merge SHA: `543de70`.

#### PR #93 — Period Parser Consistency (`fix/period-parser-consistency`) ✅
- In `src/utils/statementAggregation.ts`, enhanced `parseQuarterPeriod` regex to accept `Qx FYyy` and `Qx FYyyyy` (e.g. `Q1 FY26`, `FY26-Q1`) while preserving strict consecutive-quarter validation and zero-gap enforcement for LTM aggregation.
- Added strict parsing and window detection tests in `statementAggregation.test.ts`.
- Merge SHA: `b38197a`.

#### PR #94 — Security Audit Triage & Bundle Performance Analysis (`docs/triage-audit-bundle`) ✅
- Created `docs/SECURITY_AUDIT_TRIAGE.md` documenting the vulnerability triage of 10 moderate vulnerabilities (0 critical, 0 high), confirming why `npm audit fix --force` is rejected.
- Analyzed production Vite bundle warning (~2.61 MB minified / 670.5 kB gzip) and proposed safe route-level and modal lazy-loading candidates for a future dedicated PR.
- Merge SHA: `e9080df`.

#### PR #95 — Reconcile Round 3 Status, Reclassify Phases & Report Exact Test Metrics (`docs/round-3-reconciliation`) ✅
- Reconciled Round 3 status, reclassified roadmap phases, and reported exact authoritative test execution metrics.
- Merge SHA: `8b2da525fdce0327d30c345f6c7bcac17f01d91b`.

### Final Integrity Cleanup PRs

#### PR #96 — Verified SEC Canonical Financial Facts Diff, Cash Conversion Semantics & Tab-Specific Modal Provenance (`fix/sec-diff-canonical-facts`) ✅
- **Blocker 1 (Verified SEC Filing Diff Must Use Actual SEC Values)**:
  - Mounted `/api/sec-diff` endpoint querying canonical financials from `fetchSecVerifiedIntegrationPackage(ticker).canonicalFinancials` directly on the server.
  - UI strictly fetches and displays verified SEC canonical facts; report AI financial statements are never used as numeric authority for SEC diff.
  - Preserved SEC source metadata (period, fiscal year, fiscal quarter, form, accession, filed date, period end, metric provenance).
- **Blocker 2 (Cash Conversion Missing Data Semantics & Dilution/Buyback Semantics)**:
  - Missing OCF or Net Income returns `cashConversionStatus = 'neutral'` / `'unavailable'` with summary: *"Cash conversion unavailable — insufficient comparable OCF / Net Income data."* Never labels missing data as healthy.
  - Dilution/buyback domain semantics revised to `buybacks`, `dilution`, `stable`, `unavailable`. Strictly returns `stable` only when verified comparable shares establish near-zero change.
- **Integrity 8 (Modal Provenance Language)**:
  - ValuationDecompositionModal uses truthful tab-specific provenance: Valuation Decomposition (deterministic from recorded inputs), Macro Stress (system-defined illustrative stress assumptions recalculated by canonical DCF), SEC Diff (verified SEC canonical facts).
- Merge SHA: `1439e85d69e00ca9a9cdd7bbeb306802724031b1`.

#### PR #97 — Public vs. Authenticated Health Check Contract Parity & Serverless Parity (`fix/health-contract-parity`) ✅
- **Blocker 3 (Health Contract Parity Across Express & Vercel)**:
  - Extracted shared, zero-dependency `handleHealthCheck` helper in `server/secPreviewHandler.ts` used by both Express (`server/routes/healthRoutes.ts`) and Vercel serverless (`api/index.js`).
  - Contract: `GET /api/health` -> minimal public status (200); `GET /api/health?detailed=true` unauthenticated -> minimal public status (200) without leaking memory/telemetry; `GET /api/health/detailed` unauthenticated -> 401 Unauthorized; authorized requests with `INTERNAL_DIAGNOSTICS_KEY` or admin auth -> detailed telemetry.
  - In `vercel.json`, expanded `includeFiles` to `"{dist/*.cjs,agent/**}"` ensuring `dist/sec-preview.cjs` is packaged into serverless bundle.
  - Dynamically imported `vite` in `server.ts` so `dist/server.cjs` never fails with `MODULE_NOT_FOUND: vite` when running serverless outside development.
  - Added unit test suite `server/routes/__tests__/vercelApiAdapter.test.ts`.
- Merge SHA: `ef8673f29f275637576272a6ff3cdc67ce6534df`.

#### PR #98 — Actual Model AI Cost, Quick Ratio STI Verification, Terminal Growth Transparency & Canonical Sandbox Unification (`fix/final-integrity-cleanups`)
- **Blocker 4 (AI Cost Must Use Actual Model Identity)**:
  - In `src/utils/costEstimator.ts`, removed fallback to `'gemini-3.8-flash'`. Missing model identity fails closed (`isAvailable: false`, `formattedCostUsd: 'N/A'`).
  - Emitted `actualModel`, `requestedModel`, and `pricingCatalogVersion` in server SSE `final_stats` event.
  - UI calculates AI cost strictly from `actualModel`.
- **Blocker 5 (Quick Ratio Must Not Treat Absent ST Investments as Zero)**:
  - In `src/utils/metricCalculations.ts`, removed `short_term_investments === undefined ? 0 : null`. Absent STI field strictly returns `null` (Quick Ratio unavailable). Explicit verified 0 remains supported.
- **Integrity 6 (Terminal Growth Policy Transparency)**:
  - In `src/types.ts` and `src/utils/valuation/dcfMathEngine.ts`, preserved `requestedTerminalGrowthPct`, `usedTerminalGrowthPct`, `terminalGrowthPolicyApplied`, and `terminalGrowthPolicyReason` to expose policy clamping transparently.
- **Integrity 7 (Remove Legacy Parallel Scenario DCF Path)**:
  - In `src/components/ScenarioAnalysisModal.tsx` and `src/components/ReverseDcfCard.tsx`, removed all fallback to parallel calculation functions (`calculateDcfPerShare`, `generateValuationScenarios`, `computeSensitivityMatrix`, `calculateReverseDcf`). Canonical valuation sandbox inputs are the sole execution path.
- **Integrity 9 (History Soft-Delete Truthful UX)**:
  - Updated `src/components/HistoryModal.tsx` confirmation copy: *"This report will be removed from your visible history."* (truthful soft-delete copy).
- **Master Documentation Reconciliation**:
  - Reconciled all metrics, contracts, and status fields across `docs/ROADMAP.md` and `docs/PROJECT_STATUS.md`.
- Merge SHA: `559a4e0789d190001f0a4bc555b5e245574c942b`.

#### PR #99 — Live Quotes Serverless Bundle Routing & Trace (`fix/vercel-live-quotes-handler`) ✅
- Routed `/api/live-quotes` through the self-contained `dist/sec-preview.cjs` bundle with universal request query handling.
- Statically imported core server dependencies (`express`, `firebase-admin/app`, `firebase-admin/auth`, `@google/genai`) in `api/index.js` for serverless bundle resilience.
- Wrapped `createApp` in try/catch to return structured error JSON rather than crashing the lambda invocation.
- Merge SHA: `fa931a46657bd31eeff6eabeca1fa5d3f9d98305`.

#### PR #100 — Master Documentation Reconciliation (`docs/reconcile-pr99`) ✅
- Reconciled PR #99 and final integrity cleanup milestones across `docs/PROJECT_STATUS.md` and `docs/ROADMAP.md`.
- Merge SHA: `55f1733f02b6f6d88baf52dfc79cd37cb35b9753`.

#### PR #101 — SEC Diff Unverified Report Canonical Financials Guard (`fix/sec-diff-unverified-canonical-guard`) ✅
- SEC Filing Diff now prefers verified `report.sec_verification.sec_period_statements` when trusted SEC period statements exist.
- `CanonicalFinancialDataset` inputs are accepted for SEC-specific comparison only when `provenanceStatus === 'verified'` and `generatedBy` proves SEC-XBRL authority (`/sec-xbrl/i`). Raw canonical datasets follow the same fail-closed rule.
- Merge SHA: `d2315f069379dfe946dee0952231005cc6ba9746` (Anchor Historical Baseline).

### Lumina V1 Completion & Repair Milestones (Workstreams V2-A through V2-G & Repairs A–D)

#### PR #104 — Investment Memory Foundation (V2-A) ✅
- Implemented `ResearchMemorySnapshot` schema in `src/domain/investmentMemory.ts` with typed financials, valuation, thesis, conviction, and evidence envelope.
- Merge SHA: `a7d4db3b28b5840d2f00d603a11bf7ec709db13f`.

#### PR #105 — Structured Investment Thesis & Expectations Engine (V2-B) ✅
- Implemented `InvestmentThesisRecord` and `TrackedExpectation` domain models with deterministic evaluation in `src/domain/thesisExpectations.ts` and Firestore/localStorage service in `src/services/thesisExpectationsService.ts`.
- Merge SHA: `be735ec04e57e937d3fa8beec8f5df84b422a578`.

#### PR #106 — What Changed Intelligence Engine (V2-C) ✅
- Implemented empirical delta calculation across financial facts, valuation assumptions, SEC filings, expectations, and risk/catalyst lifecycle in `src/domain/whatChangedEngine.ts`.
- Merge SHA: `4e918c5e6fe7d8ea019a86b5b29074a38f3a388b`.

#### PR #107 — Actionable Decision Context Engine (V2-D) ✅
- Implemented deterministic stance classification (`THESIS_CONDITION_TRIGGERED`, `EXPECTATIONS_REVIEW_NEEDED`, `RE_EVALUATION_WARRANTED`, `MONITORING_CONTINUES_UNCHANGED`) without automated Buy/Sell commands in `src/domain/decisionContextEngine.ts`.
- Merge SHA: `89f2cf05d5494d4d6824dd78be26c1e5ba41f92e`.

#### PR #108 — Thesis-Aware Watchlist Intelligence Engine (V2-E) ✅
- Implemented deterministic watchlist attention scoring (0–100) and ranking in `src/domain/watchlistIntelligence.ts`.
- Merge SHA: `a3be67482a1648f2f1fa2c4d8ced9fd36dd8e1cb`.

#### PR #109 — Report & Portfolio UI Integration (V2-F) ✅
- Integrated `ThesisExpectationsCard` and `ResearchTimelineCard` into `ReportTemplate.tsx`, and connected `PortfolioModal.tsx` to watchlist intelligence.
- Merge SHA: `6e9e7cf5cafa6b8316a88f0c1487897957182340`.

#### PR #110 — Preliminary Completion Documentation (V2-G) ✅
- Master status reconciliation documenting V1 feature completion.
- Merge SHA: `304ebbd44719f83173f67824ea93deb4b8d790e9`.

#### PR #111 — Repair A: Memory SEC Authority & Cache Isolation (`fix/v2-memory-authority-and-cache-isolation`) ✅
- **Blocker A**: Restored strict SEC authority inside `src/domain/investmentMemory.ts` — raw report financials never receive `sec_verified` label merely because an SEC envelope exists.
- **Blocker B**: Missing short-term investments produces `netCash = null` (Missing != 0). Explicit verified 0 permitted.
- **Blocker C**: Prohibited current wall-clock time fabrication for reports without durable timestamps (`rep_<ticker>_unknown`, timestamp `0`).
- **Blocker D**: Scoped local cache strictly by authenticated UID (`lumina_<feature>:user:<UID>:<TICKER>`), preventing foreign-user cache leakage.
- Merge SHA: `824686dc95c31e16ad9ea8b142eb0ac7a9812c78`.

#### PR #112 — Repair B: Thesis Revisions & Hardened Rules (`fix/v2-thesis-revisions-and-firestore-rules`) ✅
- **Blocker E**: Preserved append-only thesis revisions under `/theses/{ticker}/revisions/{revisionId}`. Added `resolveActiveThesisForReport` to resolve truthful active thesis per historical report without losing revisions or retroactively fabricating beliefs.
- **Blocker J**: Hardened `firestore.rules` with explicit allowed paths (`/theses/{ticker}`, `/theses/{ticker}/revisions/{revisionId}` immutable, `/expectations/{expectationId}` with UID spoofing protection). Preserved report immutability.
- Merge SHA: `197664876cee701caaa57b153a06e15497744210`.

#### PR #113 — Repair C: Canonical Expectation Eval & Watchlist Integration (`fix/v2-expectations-and-watchlist-integration`) ✅
- **Blocker F**: Unified runtime expectation evaluation through `evaluateExpectations`, guaranteeing consistent outcome across all cards and engines without rewriting immutable historical intent.
- **Blocker G**: Complete real research context wiring into `PortfolioModal.tsx` (snapshots, previous snapshots, active thesis, evaluated expectations, what-changed, portfolio holding) into `computeWatchlistIntelligence` with bounded session caching. Truthfully handles first-time tickers without fabricating factors.
- **Blocker H**: Synchronized thesis and expectation edits in parent-managed state in `ReportTemplate.tsx` so `ResearchTimelineCard` and `DecisionContext` update immediately without page reload.
- **Blocker I**: Conservative risk/catalyst lifecycle transitions in `matchRiskCatalystTransitions` — semantic rephrasing produces uncertain evolving transitions (`isCertain: false`, `currentState: 'UNKNOWN'`) rather than false certain RESOLVED / NEW.
- Merge SHA: `aee697d976d102f5979ed279a2234397a35164fa`.

#### PR #114 — Repair D: Final Technical Completion Evidence Reconciliation (`docs/v1-technically-complete`) ✅
- Reconciled master status, roadmap, test gate metrics, and final deployment evidence across repository documentation.
- Merge SHA: `e9dec46f4d8c03f635002be1924bf6c73741cf7a`.

#### PR #115 — PR E: Comparable-Period & Share/Provenance Semantics (`fix/memory-comparable-period-and-provenance`) ✅
- **Blocker 1**: Hardened SEC Memory YoY comparable-period resolver in `secFilingDiffEngine.ts` and `investmentMemory.ts` (strictly Annual vs Annual e.g. FY26 vs FY25, Quarter vs Quarter e.g. Q4 26 vs Q4 25; rejects QoQ and non-consecutive years; missing/ineligible comparison sets `revenueYoYPct = null`).
- **Blocker 2**: Preserved independent share counts in `ResearchMemoryFinancials` (`currentSharesOutstandingM` vs `dilutedWeightedAverageSharesM`), never substituting one for the other.
- **Blocker 3**: Truthful report financials provenance (`'unverified'`, never `'calculated'` or `'sec_verified'` merely because values were copied into Memory).
- **Blocker 4**: Added `freeCashFlowPeriodBasis` (`'QUARTER' | 'ANNUAL' | 'LTM' | 'UNKNOWN'`); mixed period bases reject delta comparison (`null`).
- Merge SHA: `6883bcf50a689e11650c8b00b7056900cfd375dd`.

#### PR #116 — PR F: Historical Thesis & Durable Expectations Integration (`fix/thesis-history-and-durable-expectations`) ✅
- **Blocker 5 & 6**: Historical thesis resolution per report via `resolveActiveThesisForReport`. Decision Context `priorBeliefSummary.thesisSummary` strictly uses genuine `previousThesis` (v1), never substituting current active thesis (v2) for yesterday's belief.
- **Blocker 7**: Thesis edit context linkage — `confirmUserThesis` binds new user revision to current report context (`sourceReportId`), increments `version`, updates `updatedAt`, and preserves `thesisId`, `createdAt`, `userId`.
- **Blocker 8 & 9**: Durable expectation terminal outcomes — `MET`, `MISSED`, `EXCEEDED` durably preserved across subsequent reports. Canonical target-period resolver matches `targetPeriod` against historical statements in `periodHistory` or `historicalSnapshots`, never falsely evaluating Q3 target against Q4 actuals.
- **Blocker 10**: Synchronized canonical expectation state across `ThesisExpectationsCard`, `WhatChanged`, `DecisionContext`, and `WatchlistIntelligence`.
- **Blocker 12**: Classified invalidation conditions into `DETERMINISTIC_TRIGGER` vs `MANUAL_REVIEW_TRIGGER`; qualitative free-text conditions require manual review and are never falsely auto-evaluated.
- **Blocker 13 & 14**: Hardened `firestore.rules` on `/expectations/{expectationId}` to reject updates attempting to modify immutable target fields (`userId`, `ticker`, `expectationId`, `targetValue`, `targetPeriod`, `condition`, `origin`, `createdAt`, `sourceReportId`). Added rule contract tests.
- Merge SHA: `0a1c97249d6bc8e69e404dd9f07af421aef2a19b`.

#### PR #117 — PR G: Uncertainty Propagation in Decision Intelligence (`fix/what-changed-uncertainty-propagation`) ✅
- **Blocker 11**: Propagated `isCertain: false` into WhatChanged items for ambiguous or unconfirmed risk/catalyst lifecycle transitions.
- When `isCertain: false`, never state NEW, RESOLVED, or MATERIALIZED as fact. Uses truthful semantics: `POSSIBLE RISK CHANGE`, `Risk Wording Changed — Review Needed`, `POSSIBLE CATALYST CHANGE`, `UNCONFIRMED LIFECYCLE CHANGE`.
- Limits materiality to `LOW` / `MEDIUM`, preventing unconfirmed AI wording changes from fabricating definitive `HIGH` risk alerts or triggering false decision stance revisions.
- Merge SHA: `7dfb0ded14ced56e6c89cdf7c8a6802019cbe9b0`.

#### PR #120 — Pending expectation creation persistence

- `ThesisExpectationsCard.handleAddExpectation` now calls `createAndEvaluateExpectation`: persist new intent first, then evaluate current/historical context. PENDING creation survives reload even when a snapshot exists.
- Regression uses the same service path as the UI and reloads through `loadExpectations()`: future synthetic MSFT Q4 intent remains PENDING against Q3, all intent fields remain unchanged, and repeated evaluation performs no write. Matching Q4 actuals later persist EXCEEDED and survive reload; terminal re-evaluation also performs no write.
- Counted storage writes: one creation write, unchanged at one after repeated PENDING evaluation, two after the terminal transition, unchanged at two after terminal re-evaluation. The existing PR #119 MISSED save/reload regression remains intact; creation without a snapshot is also covered.
- These are isolated persistence-service tests using deserialized local storage, not a claim of authenticated production Firestore write verification.
- Protected PR Verify Lumina run: `34763937163`; merged-main run: `34763997605`. Both passed.

#### Final closure test gate metrics (PR #120)
- **Test files executed**: 82
- **src/ test files executed**: 79
- **Server test files executed**: 3 (`server/routes/__tests__/fileSecurity.test.ts`, `server/routes/__tests__/healthRoutes.test.ts`, `server/routes/__tests__/vercelApiAdapter.test.ts`)
- **Test cases passed**: 254 (repository runner convention, including standalone assertion files counted as one)
- **Test cases failed**: 0
- **Test cases skipped**: 0
- **TypeScript (`tsc --noEmit`)**: PASS (100% clean)
- **Production build (`npm run build`)**: PASS
- **git diff --check**: PASS
- **Vulnerabilities**: 0 critical, 0 high, 10 moderate (triaged in `docs/SECURITY_AUDIT_TRIAGE.md`)
- **Firebase rules preflight**: PASS for project `stock-analyze-a89d0` / database `(default)`
- **npm ci**: PASS; no package/lockfile changes.
- **npm audit --omit=dev**: exit 1 for the existing 10 moderate advisories; 0 high/critical. No `npm audit fix --force` was run.

## Current production health

Application deployment and public endpoint evidence checked on 2026-09-13 at 21:54 Asia/Bangkok. Firebase production rules deployment and active-source evidence were verified on 2026-09-14 at 20:23 Asia/Bangkok:

- **Historical Accepted Baseline SHA**: `d2315f069379dfe946dee0952231005cc6ba9746` (Owner Accepted baseline)
- **Verified behavior-changing production Git SHA**: `2293430b8a642a8da6b0f4f05bbdf24270c557a6` (PR #120; Vercel deployment `dpl_s2QQzm7SjYKyXXTazvCbfMHS8oqi`)
- **Production URL**: `https://stock-ana-ten.vercel.app` (Status: `READY`)
- **Vercel proof**: authenticated deployment metadata reports the exact Git SHA, target `production`, state `READY`, and alias `stock-ana-ten.vercel.app`.
- **Push-to-main `Verify Lumina`**: run `34763997605` passed (82 test files, 254 cases passed, 0 failed, 0 skipped).
- **Authoritative production smokes**:
  - `GET /api/health` -> 200 minimal public payload
  - `GET /api/health?detailed=true` (unauthenticated) -> 200 minimal payload, no telemetry leak
  - `GET /api/health/detailed` (unauthenticated) -> 401 Unauthorized contract
  - `GET /api/live-quotes?symbols=MSFT` -> 200 with a populated MSFT Market Snapshot and `asOf`; no guaranteed real-time claim.
  - `GET /api/sec-diff?ticker=MSFT` -> 200, `ok: true`, `provenanceStatus: verified`, Q4 2026 versus Q4 2025 comparison and SEC filing metadata.
- Authenticated report creation, expectation Firestore writes, and a new SOFI UI journey were not repeated in this closure proof. Regression coverage and historical acceptance evidence remain distinct from these public endpoint smokes.

Known runtime observations:

- Node `[DEP0169] url.parse()` deprecation warnings predate the latest application release and appear to originate from dependency/runtime behavior rather than repository source.
- Earlier Gemini free-tier quota errors (`too_many_requests`) occurred during production Analyze testing. PR #49 expanded the bounded retry window so provider-directed retry waits can be honored longer. Treat provider quota exhaustion as an operational limitation, never as permission to fabricate fallback analysis.

Do not launch an unrelated major dependency upgrade merely to silence the Node deprecation warning.

## Owner Acceptance Record — Lumina Post-Roadmap Integrity Baseline

The owner has explicitly accepted the **Lumina Post-Roadmap Integrity Baseline** represented by production SHA `d2315f069379dfe946dee0952231005cc6ba9746` following PR #101.

### Meaning of Owner Acceptance
- The **post-roadmap integrity-hardening cycle is CLOSED**.
- The current integrity, security, data provenance, and valuation baseline is accepted as the trusted foundation for future product development.
- Phase 4.5 / Post-Roadmap Integrity Stabilization is marked **Owner Accepted** solely because of the owner's explicit acceptance.

### Important Status Distinction
Owner acceptance applies strictly to the **POST-ROADMAP INTEGRITY BASELINE**. It does **NOT** automatically mean:
- Every future Lumina feature is complete.
- No technical debt remains.
- No future bugs are possible.
- The entire Lumina product vision is complete.

A future **Vision Reconciliation** will separately determine:
1. Implemented and Verified
2. Implemented but needs further product maturity
3. Partial
4. Missing
5. Deferred by Design
6. Removed by Owner
7. Out of Scope

Do not preempt that future analysis.

## Known Non-Blocking Technical Debt

The following items are explicitly recorded as non-blocking technical debt, not acceptance blockers:
- **Moderate npm dependency advisories**: 10 moderate vulnerabilities (0 critical, 0 high), triaged in `docs/SECURITY_AUDIT_TRIAGE.md`. `npm audit fix --force` is strictly prohibited.
- **Frontend bundle size / Vite large-chunk warning**: Single JS bundle is ~2.61 MB minified / 670 kB gzip; safe route-level and modal lazy-loading candidates documented for a future dedicated PR.
- **Node `url.parse()` deprecation warning**: Dependency/runtime deprecation `[DEP0169]` originating from upstream packages.
- **Future code splitting / lazy loading**: Planned for a future dedicated performance cycle.
- **Future architecture cleanup**: Modularization and separation improvements documented as P2 items.
- **Other explicitly documented P2 items**: Preserved in issue tracker / documentation.

Hardening must **not** be reopened solely because these non-blocking items exist.

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

The post-roadmap integrity baseline is closed and accepted. Future changes follow disciplined review:
1. Owner uses the production website normally.
2. Owner reports bugs, confusing output, data-quality problems, UI issues, or desired refinements.
3. Review live behavior and current source before changing code.
4. Fix the defect through a focused PR with regression coverage where practical.
5. Verify production again.

Do not treat aesthetic or output-quality feedback as a reason to relax financial-integrity rules.

## Handoff for a new ChatGPT / Codex session

Start with this instruction:

> Continue Lumina / Stock_Ana from `docs/PROJECT_STATUS.md`. Query live `main`, GitHub rules/CI, and Vercel before assuming mutable deployment state. Post-roadmap integrity baseline (PRs #96–#101, main SHA `d2315f069379dfe946dee0952231005cc6ba9746`) is OWNER ACCEPTED and the hardening cycle is CLOSED. Do not reopen hardening for non-blocking technical debt. Preserve financial-integrity and Firebase safety rules. The next owner-authorized task is COIN KING Master Context Bootstrap.

Update this file when the project phase, architecture contract, production acceptance, or major operational state changes. Do not update it merely because a docs-only commit changed the `main` SHA.
