# Lumina / Stock_Ana — Post-Phase-4 Roadmap

This document defines the long-term direction for Lumina / Stock_Ana. It answers **"Where are we going?"** (while `docs/PROJECT_STATUS.md` answers **"Where are we now?"**).

Directional roadmap only: **Do not start later phases until the owner explicitly authorizes them.**

---

## Authorized Phase Order

1. **Phase 4** — Complete ✅
2. **Phase 4.5 Stabilization** — Complete ✅
3. **Phase 5** — Analysis Quality & Data Coverage — Complete ✅
4. **Phase 6** — Report Experience / UX 🔄 Active
5. **Phase 7** — Portfolio & User Intelligence
6. **Phase 8** — Monitoring & Alerts
7. **Phase 9** — Comparison & Decision Tools
8. **Phase 10** — Performance, Cost & Reliability
9. **Phase 11** — Productization / Subscription Readiness
10. **Phase 12** — Advanced Investment Intelligence

---

## Current Stage

### Phase 6 — Report Experience / UX (Active)

**Goal:** Establish rigorous information hierarchy, progressive disclosure, source visibility, and clear classification badges distinguishing Verified Data, Calculated Formulas, Model Assumptions, Market Quotes, and AI Qualitative Interpretation.

**Work includes:**
- Stronger SEC / XBRL coverage (SBC, Depreciation/Amortization, Common Stock, Retained Earnings, Leases)
- Issuer taxonomy variation support (Operating vs Financial / FinTech institutions)
- Fiscal-period normalization and standalone quarter derivation
- Quarterly / annual / LTM alignment
- Debt / cash / investment handling (safe non-overlapping resolution)
- CapEx and FCF quality (deterministic FCF from verified OCF and CapEx outflows)
- Stock-based compensation (SBC) explicit accounting and schema inclusion
- Stronger provenance and SEC accession linkage
- Sector-aware valuation paths (prohibiting generic FCFF on banks/lenders, recommending sector models)
- DCF assumption explainability and Financial Sector Guard

**Exit criteria:** Analysis is trustworthy across materially different issuer types without weakening fail-closed integrity.

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

### Phase 9 — Comparison & Decision Tools (Active 🔄)
**Potential capabilities:**
- Normalized peer comparison
- Sector-aware peer selection
- Growth, margin, FCF, balance-sheet, valuation, and conviction-pillar comparisons
- Deterministic scenario analysis
- Sensitivity analysis
- Reverse DCF / market-implied expectations
- Never create fake peer data.

---

### Phase 10 — Performance, Cost & Reliability
**Goals:**
- Lower Analyze latency
- Safe reuse / caching of verified datasets
- Better quota handling
- AI usage / cost visibility
- Bounded retry observability
- Structured production metrics and failure classification
- SEC / market data / Firebase / renderer health monitoring
- Stage-level latency tracking
- Never trade financial integrity for faster results.

---

### Phase 11 — Productization / Subscription Readiness
**Potential scope:**
- Usage tiers
- Quotas and entitlements
- Billing
- Onboarding
- Account management
- Privacy and legal / disclosure readiness
- Security reviews and production scaling
- Entitlements must remain separate from canonical financial calculations.

---

### Phase 12 — Advanced Investment Intelligence
**Long-term capabilities:**
- Investment thesis tracking
- Earnings-call interpretation
- SEC filing change detection
- Management guidance tracking
- Analyst estimate revisions
- Macro sensitivity
- Portfolio-level research intelligence
- Historical valuation / thesis change decomposition (e.g. decomposing fair-value change into financial statements, FCF, shares, market price, growth assumptions, margin assumptions, WACC, terminal growth without invented narrative).

---

## Operating Principles for Roadmap Execution

1. **Financial Integrity:** Verified Data → Deterministic Calculations → User Context / History → AI Interpretation. AI never invents financial facts.
2. **Deterministic Ownership:** DCF math, margin of safety, ratios, canonical valuation, and conviction score remain 100% deterministic code.
3. **Bug-Fix Discipline:** Reproduce → Root cause → Focused fix → Regression protection → PR → Verify Lumina → Protected merge → Exact-SHA production deployment → Production smoke.
4. **Phase Discipline:** Do NOT begin Phase 5 until the owner explicitly authorizes Phase 5.
