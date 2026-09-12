# Lumina / Stock_Ana — Post-Phase-4 Roadmap

This document defines the long-term direction for Lumina / Stock_Ana. It answers **"Where are we going?"** (while `docs/PROJECT_STATUS.md` answers **"Where are we now?"**).

Directional roadmap only: **Do not start later phases until the owner explicitly authorizes them.**

---

## Authorized Phase Order & Current Status

1. **Phases 1–4: Core Platform Foundation** — Complete ✅
2. **Phase 4.5: Post-Roadmap Integrity Stabilization** — Complete ✅
   - PR A: Security Boundary & Cross-User Log Isolation (P0-4) — Complete ✅ (PR #67)
   - PR B: Phase 9 Valuation Integrity & Fallback Removal (P0-1) — Complete ✅ (PR #68)
   - PR C: Phase 12 Deterministic Revaluation Bridge (P0-2, P0-3) — Complete ✅ (PR #69)
   - PR D: SEC Filing Diff & Comparable-Period Matching (P1-1, P1-2) — Complete ✅ (PR #70)
   - PR E: Portfolio & History Record Hydration (P1-3, P1-4, P1-5) — Complete ✅ (PR #71)
   - PR F: Monitoring & Alerts Semantics (P1-8) — Complete ✅ (PR #72)
   - PR G: Sector-Aware Valuation Architecture (P0-6) — Complete ✅ (PR #73)
   - PR H: Server-Side Entitlement Authority (P0-5) — Complete ✅ (PR #74)
   - PR I: Operational Observability & Documentation Reconciliation (P1-10, P2) — Complete ✅ (PR #75)
3. **Phase 5: Analysis Quality & Data Coverage** — Complete ✅ (PR #56–#58, PR #70)
4. **Phase 6: Report Experience & UI Polish** — Complete ✅ (PR #59, #60)
5. **Phase 7: Portfolio & User Intelligence** — Complete ✅ (PR #61, PR #71)
6. **Phase 8: Monitoring & Alerts** — Complete ✅ (PR #62, PR #72)
7. **Phase 9: Comparison & Decision Tools** — Complete ✅ (PR #63, PR #68)
8. **Phase 10: Performance, Cost & Reliability** — Complete ✅ (PR #64, PR #75)
9. **Phase 11: Productization / Subscription** — Removed per owner directive (PR #76) (Unlimited Platform Access)
10. **Phase 12: Advanced Investment Intelligence** — Complete ✅ (PR #66, PR #69, PR #70, PR #73)

---

## Current Priority

### Post-Roadmap Integrity Hardening (Complete ✅)

**Goal Achieved:** All heuristic valuation fallbacks eliminated, cross-user security isolation established, decomposition rebuilt on true sequential revaluation, server-side entitlement authority enforced, and institutional financial integrity baseline locked before further feature development.
- Zero interference with deterministic financial calculations.
- 140 automated regression tests passing across entire repository.

---

### Phase 6 — Report Experience / UX (Complete ✅)
**Delivered Capabilities:**
- Stronger information hierarchy:
  - Executive Summary
  - Financial Statements & Indicators
  - Valuation & 5 Fundamental Pillars
  - Earnings & Equity Research
  - Fundamentals & Business Model
  - Peers, Smart Money & Corporate Actions
  - Historical Price & Performance Charts
  - Technical Analysis & Trade Plan
  - Deep Insights
  - SEC Citations & Document Findings
  - Data Provenance & Disclaimers
- ProvenanceBadge classification hierarchy across all report sections:
  - Verified Data (🛡️ Verified SEC XBRL/Filing facts)
  - Calculated (📐 Deterministic formulas: FCF, Margins, Ratios, Base DCF)
  - Assumption (⚙️ Explicit forward inputs: WACC, Terminal Growth, Forecast CAGR)
  - Market Data (📈 Live market quotes, Beta, Price range)
  - AI Interpretation (💡 AI qualitative thesis, moat commentary)
  - Unavailable (⚪ Explicitly missing/null per integrity rules)
- CalculationModal: interactive calculation transparency with mathematical formulas, period inputs, and financial significance for FCF, Gross/Operating/Net margins, Current/Quick ratios, Debt-to-Equity, ROE, and Margin of Safety.
- Scroll-Spy activeNav navigation with container offset (`scroll-mt-28`) ensuring headers never hide behind sticky navbar.
- Mobile table scroll hints for multi-period swipe discovery.

---

### Phase 7 — Portfolio & User Intelligence (Complete ✅)
**Delivered capabilities:**
- Watchlist management (pure localStorage fallback + user scoped persistence).
- Portfolio holdings tracking (ticker, quantity, average cost, live market value, unrealized P/L ($ and %), allocation %, sector exposure).
- Institutional concentration risk alert (automatically flags when top holding weight >= 30%).
- Portfolio-weighted Margin of Safety (combines live quotes and fundamental DCF fair values across portfolio assets).
- Pure mathematical empirical deltas: "What Changed since previous analysis?" comparing price, base fair value, conviction score, YoY revenue growth, operating margin, and free cash flow without AI narrative hallucination.
- Research timeline: chronological view of all previous analyses for the active ticker.
- Bilingual English/Thai localization across all portfolio & timeline components.

---

### Phase 8 — Monitoring & Alerts (Complete ✅)
**Delivered capabilities:**
- Institutional Monitoring & Alerts Engine (`monitoringEngine.ts`) with deterministic rules and materiality thresholds.
- Valuation & MoS Breach Tracking (fires when price trades significantly below DCF Base Fair Value or exceeds threshold).
- Valuation Overvalued Warnings (detects when price exceeds fair value by >= 15% premium).
- Conviction Score Shift Monitoring (detects material upgrades or downgrades >= 10 points).
- SEC Filing Alerts (monitors and links new 10-K, 10-Q, and material 8-K filings with SEC citations).
- Portfolio Concentration Risk Alerts (flags when any asset weight >= 30% of total portfolio).
- Interactive Alerts Modal with unread badges, filter tabs, single/bulk read actions, and configurable materiality thresholds to prevent alert fatigue.
- Full bilingual English/Thai presentation and unit test coverage.

---

### Phase 9 — Comparison & Decision Tools (Complete ✅)
**Delivered capabilities:**
- Reverse DCF Engine: back-solves implied annual FCF growth hurdle baked into current price and tests institutional feasibility.
- Interactive Scenario & Sensitivity Sandbox (`ScenarioAnalysisModal`): real-time recalculation of fair value and Margin of Safety across adjustable Growth, WACC, and Terminal Growth sliders.
- 2D Sensitivity Matrix: 5x5 grid evaluating WACC vs Terminal Growth with color-coded value discount/premium indicators.
- Deterministic 3-Stage Scenarios (Bear, Base, Bull) with explicit financial parameter attribution.
- Normalized peer comparison extractor (`extractNormalizedPeers`) enforcing the invariant to never create fake peer data.
- Full bilingual English/Thai presentation and unit test coverage.

---

### Phase 10 — Performance, Cost & Reliability (Complete ✅)
**Delivered capabilities:**
- Safe reuse / caching of verified datasets: Institutional bounded in-memory TTL cache (`SecTtlCache`) with LRU eviction for SEC EDGAR company facts, submissions, and packages. Eliminates redundant multi-megabyte network transfers.
- AI usage & cost visibility (`costEstimator.ts`): Model pricing catalog (Flash & Pro tiers), prompt/completion token cost calculation, and formatted USD/THB currency metrics.
- Executive Summary 5-Column Metrics Grid in `ReportTemplate.tsx`: Displays Docs, Time, Runs, Tokens, and live AI Cost with localized tooltips and USD/THB FX conversion.
- Structured diagnostics & health endpoint (`GET /api/health`): Telemetry covering memory (RSS, heap), process uptime, Gemini / SEC / Firebase configuration status, and SEC cache performance (hits, misses, size).
- Stage-level latency tracking (`LatencyTracker`): Measures timings for market snapshots, Gemini stream, and valuation assumption normalization; transmits structured breakdown via SSE `final_stats` event and writes to run logs.
- Full unit test coverage across all newly introduced modules with 62 passing test suites.

---

### Phase 11 — Productization / Subscription Readiness (Removed per owner directive)
- **Removal Decision**: Removed all subscription tiers, monthly analysis quotas, model access barriers, and header crown badges. All authenticated users have unrestricted, unlimited access to all platform features and models without subscription modals or paywalls.

---

### Phase 12 — Advanced Investment Intelligence (Complete ✅)
**Delivered capabilities:**
- Pure Deterministic Valuation Decomposition Engine (`src/utils/valuationDecompositionEngine.ts`):
  - Empirical marginal driver attribution decomposing historical Fair Value shifts ($\Delta$ Cash Flow Growth, $\Delta$ Operating Margin, $\Delta$ WACC / Discount Rate, $\Delta$ Terminal Growth, $\Delta$ Capital Structure & Dilution).
  - Mathematical integrity guarantee: Driver impacts sum deterministically to total $\Delta \text{Fair Value}$ without qualitative AI hallucination.
  - Investment Thesis Health Classification (`upgraded`, `intact`, `under_pressure`, `macro_driven`) correlating DCF shifts with conviction scores.
- Macroeconomic Stress-Testing Sandbox (`src/utils/macroStressEngine.ts`):
  - 5 standard institutional macro stress scenarios: Base Case, Stagflation Shock (+150 bps WACC, -200 bps margin), Recessionary Demand Contraction (-10% rev drop, +100 bps credit spread), Higher-for-Longer Rates (+200 bps WACC), and AI & Productivity Wave (+400 bps rev growth, +250 bps margin).
  - Real-time recalculation of Stressed Fair Value and Stressed Margin of Safety.
- SEC Filing Period-over-Period Diff Engine (`src/utils/secFilingDiffEngine.ts`):
  - Factual YoY topline and bottomline growth derivation across verified 10-K/10-Q filing periods.
  - Operating margin expansion/compression tracking in basis points (bps).
  - Diluted share count and net buyback vs dilution pace calculation.
  - Cash conversion divergence alert (flags working capital strain when revenue accelerates but operating cash flow contracts).
- Interactive Institutional Modal (`src/components/ValuationDecompositionModal.tsx`):
  - 3-tab analysis suite (Valuation Waterfall, Macro Stress Sandbox, SEC Filing YoY Diff).
  - Full bilingual English/Thai localized presentation.
  - Integrated into Section 3 (Valuation & DCF) of `src/ReportTemplate.tsx`.
- Comprehensive Unit Test Suites: 95 passing tests with 100% success rate across all modules.

---

## Operating Principles for Roadmap Execution

1. **Financial Integrity:** Verified Data → Deterministic Calculations → User Context / History → AI Interpretation. AI never invents financial facts.
2. **Deterministic Ownership:** DCF math, margin of safety, ratios, canonical valuation, and conviction score remain 100% deterministic code.
3. **Bug-Fix Discipline:** Reproduce → Root cause → Focused fix → Regression protection → PR → Verify Lumina → Protected merge → Exact-SHA production deployment → Production smoke.
4. **Phase Discipline:** Do NOT begin Phase 5 until the owner explicitly authorizes Phase 5.
