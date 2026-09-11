# Lumina / Stock_Ana — Post-Phase-4 Roadmap

This document defines the long-term direction for Lumina / Stock_Ana. It answers **"Where are we going?"** (while `docs/PROJECT_STATUS.md` answers **"Where are we now?"**).

Directional roadmap only: **Do not start later phases until the owner explicitly authorizes them.**

---

## Authorized Phase Order

1. **Phase 4** — Complete ✅
2. **Phase 4.5 Stabilization** — Current 🔄
3. **Phase 5** — Analysis Quality & Data Coverage
4. **Phase 6** — Report Experience / UX
5. **Phase 7** — Portfolio & User Intelligence
6. **Phase 8** — Monitoring & Alerts
7. **Phase 9** — Comparison & Decision Tools
8. **Phase 10** — Performance, Cost & Reliability
9. **Phase 11** — Productization / Subscription Readiness
10. **Phase 12** — Advanced Investment Intelligence

---

## Current Stage

### Phase 4.5 — Production Stabilization & Product Quality

**Goal:** Make the existing production product trustworthy, stable, understandable, and pleasant to use.

**Work includes:**
- Production bugs
- Incorrect financial output
- Suspicious values
- Unnecessary missing data
- Rendering crashes
- Incorrect units / percentages
- Scoring problems
- Valuation inconsistencies
- History / persistence problems
- Authentication issues
- Provider failures
- Performance
- Mobile / responsive issues
- Confusing report UX
- Thai / English presentation quality

Test multiple issuer profiles over time, not only MSFT. MSFT remains the primary end-to-end reference issuer.

**Exit criteria:** Phase 4.5 ends **ONLY** after explicit owner approval.

---

## Future Direction (Unauthorized Until Approved)

### Phase 5 — Analysis Quality & Data Coverage
**Goals:**
- Stronger SEC / XBRL coverage
- Issuer taxonomy variation support
- Fiscal-period normalization
- Quarterly / annual / LTM alignment
- Debt / cash / investment handling
- CapEx and FCF quality
- Stock-based compensation
- Leases
- Dilution / share count
- Stronger provenance
- DCF assumption explainability
- Deterministic conviction-score audit
- Sector-aware valuation paths
- Appropriate financial-sector valuation instead of forced generic FCFF

**Exit criteria:** Analysis is trustworthy across materially different issuer types without weakening fail-closed integrity.

---

### Phase 6 — Report Experience / UX
**Goals:**
- Stronger information hierarchy:
  - Executive Summary
  - Investment Thesis
  - Valuation
  - Financial Health
  - Growth
  - Business Quality
  - Risks
  - Smart Money
  - Technical Context
  - Sources / Data Integrity
- Clearly distinguish:
  - Verified Data
  - Calculated
  - Assumption
  - Market Data
  - AI Interpretation
  - Unavailable
- Improve progressive disclosure, source visibility, calculation visibility, charts, mobile responsiveness, and Thai / English readability.
- No fake chart series.

---

### Phase 7 — Portfolio & User Intelligence
**Potential scope:**
- Watchlist
- Portfolio holdings (quantity, average cost, market value, unrealized P/L, allocation, concentration, sector exposure)
- Research timeline
- Historical analysis comparison ("What Changed since previous analysis?")
- All historical-change explanations must come from actual evidence.

---

### Phase 8 — Monitoring & Alerts
**Potential monitoring:**
- Earnings releases
- New SEC filings
- Major 8-K events
- Material valuation changes
- Margin-of-safety threshold changes
- Analyst revisions
- Insider activity
- Institutional flow changes
- Thesis-changing metrics
- **Requirements:** Materiality thresholds, deduplication, avoid alert spam, explain why alert fired, link alert to evidence.

---

### Phase 9 — Comparison & Decision Tools
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
