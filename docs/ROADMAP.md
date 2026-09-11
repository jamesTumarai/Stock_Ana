# Lumina / Stock_Ana — Post-Phase-4 Roadmap

This document defines the long-term direction for Lumina / Stock_Ana. It answers **"Where are we going?"** (while `docs/PROJECT_STATUS.md` answers **"Where are we now?"**).

Directional roadmap only: **Do not start later phases until the owner explicitly authorizes them.**

---

## Authorized Phase Order

1. **Phase 4** — Complete ✅
2. **Phase 4.5 Stabilization** — Complete ✅
3. **Phase 5** — Analysis Quality & Data Coverage — Complete ✅
4. **Phase 6** — Report Experience / UX — Complete ✅
5. **Phase 7** — Portfolio & User Intelligence — Complete ✅
6. **Phase 8** — Monitoring & Alerts — Complete ✅
7. **Phase 9** — Comparison & Decision Tools — Complete ✅
8. **Phase 10** — Performance, Cost & Reliability — Complete ✅
9. **Phase 11** — Productization / Subscription Readiness 🔄 Active
10. **Phase 12** — Advanced Investment Intelligence

---

## Current Stage

### Phase 11 — Productization / Subscription Readiness (Active 🔄)

**Goal:** Establish subscription tiers, quota entitlements, account management, and institutional access controls while strictly isolating entitlements from canonical valuation calculations.

**Work includes:**
- Usage tiers & quota governance (Free, Pro, Institutional)
- User entitlement evaluation boundary
- Onboarding & account profile management
- Billing foundations & usage monitoring
- Privacy, disclosures, and regulatory compliance readiness
- Zero interference with deterministic financial calculations

**Exit criteria:** Tiered access and entitlement guards operate seamlessly without altering underlying valuation mathematics or verified financial data integrity.

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

### Phase 11 — Productization / Subscription Readiness (Complete ✅)
**Delivered capabilities:**
- Subscription Tier Architecture (`src/domain/subscriptionTiers.ts`): 3 institutional tiers (Explorer / Free, Pro Analyst, Institutional Desk) with feature sets, monthly quotas, model access, and SLA indicators.
- Pure Deterministic Entitlement Engine (`src/utils/entitlementEngine.ts`): feature gating, monthly quota evaluation, and portfolio holdings limit enforcement. Strict architectural invariant: entitlements operate strictly at the access boundary; canonical DCF formulas, SEC filings integrity, and mathematical calculations are never altered or degraded by tier.
- Client Subscription & Usage Service (`src/services/subscriptionService.ts`): local storage & Node test runner compatible tracking of billing cycles (YYYY-MM), monthly analysis counts, and token consumption.
- Institutional Subscription Modal (`src/components/SubscriptionModal.tsx`): interactive tier selector, live monthly quota consumption progress bar, feature comparison matrix, and financial integrity guarantee.
- UI & Flow Integration (`LandingView.tsx`, `App.tsx`): Crown tier badge pill in desktop & mobile headers, pre-analysis quota checks, automatic usage recording upon report generation, and tier upgrade flows.
- Comprehensive Unit Test Suites: 100% test pass rate across tier definitions, entitlement logic, and usage services.

---

### Phase 12 — Advanced Investment Intelligence (Active 🔄)
**Potential scope:**
- Investment thesis tracking and milestone verification
- Historical valuation & thesis change decomposition (decomposing fair-value shifts across financial statements, FCF, shares, market price, growth assumptions, margin assumptions, WACC, and terminal growth without invented narrative)
- Earnings-call interpretation and tone analysis
- SEC filing change detection (10-K/10-Q diffing against prior periods)
- Management guidance tracking vs reported performance
- Macro and sector sensitivity stress-testing
- Portfolio-level aggregated intelligence and sector concentration analytics

---

## Operating Principles for Roadmap Execution

1. **Financial Integrity:** Verified Data → Deterministic Calculations → User Context / History → AI Interpretation. AI never invents financial facts.
2. **Deterministic Ownership:** DCF math, margin of safety, ratios, canonical valuation, and conviction score remain 100% deterministic code.
3. **Bug-Fix Discipline:** Reproduce → Root cause → Focused fix → Regression protection → PR → Verify Lumina → Protected merge → Exact-SHA production deployment → Production smoke.
4. **Phase Discipline:** Do NOT begin Phase 5 until the owner explicitly authorizes Phase 5.
