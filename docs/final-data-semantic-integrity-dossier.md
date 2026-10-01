# Final financial data, semantics and analyst interpretation dossier

Verification date: 2026-09-29. Current checkout and local preview at `http://localhost:3002/`. Existing work was preserved; no branch reset, historical report rewrite or database migration was performed.

## 1. Working-capital root cause

The mapper previously passed normalized SEC taxonomy values straight through to the cash-flow table. `IncreaseDecreaseInAccountsReceivable` and `IncreaseDecreaseInInventories` encode account increases/decreases, whose signs are opposite to the cash effects presented in the statement. The problem originated at the canonical mapping boundary, rather than an additional UI inversion.

In the [actual Q2 filing](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm), the six-month receivables cash contribution is +377M while its raw tagged value is -377M; inventory uses 1,663M while its raw tagged value is +1,663M. Inline presentation signs and taxonomy movement semantics are distinct.

## 2. Files changed for this pass

| Area | Files |
| --- | --- |
| Source semantics and normalization | `src/domain/workingCapitalSemantics.ts`, `src/domain/financialValue.ts`, `src/services/sec/secClient.ts`, `src/services/sec/xbrlNormalizer.ts`, `src/services/sec/secFinancialMapper.ts` |
| Accepted observations and annual safety | `src/domain/verifiedFinancialStatements.ts`, `src/domain/financialSynthesisGuard.ts`, `src/utils/statementAggregation.ts` |
| Labels, policy and context | `src/domain/statementSemanticLabels.ts`, `src/domain/metricAssessmentPolicy.ts`, `src/domain/selectedFinancialMetric.ts`, `src/domain/financialMetricContext.ts`, `src/domain/metricBeginnerEducation.ts` |
| Analyst validation and persistence of cache identity | `src/domain/analystEvidenceGuard.ts`, `src/domain/financialAnalystContract.ts`, `src/domain/metricAiRequest.ts`, `src/services/metricAiClient.ts`, `server/services/verifiedMetricAnalyst.ts`, `server/routes/metricRoutes.ts` |
| Existing report component | `src/components/FinancialStatementsTable.tsx` |
| Regression coverage | `src/services/sec/finalStatementIntegrity.test.ts`, `src/domain/finalMetricAssessment.test.ts`, `src/domain/financialMetricMeaning.test.ts`, `server/services/__tests__/verifiedMetricAnalyst.test.ts` |

The checkout contains other pre-existing modifications from earlier tasks. This table identifies this pass, not every dirty file in the checkout.

## 3. Canonical sign rule before and after

Before: standalone raw fact → scale to millions → present as a cash effect without identifying its semantics.

After: compatible standalone raw fact → explicit taxonomy semantic rule → one conversion to `CASH_FLOW_EFFECT` → scale to millions. Receivables/inventories use multiplier -1 for the audited movement concepts; the audited payables concept uses +1. A source explicitly marked `CASH_FLOW_EFFECT` uses +1 and is not inverted again. Unknown or incompatible semantics fail closed.

Canonical observations retain `valueSemantic`, original `sourceUnit`, and `signNormalization` containing the source semantic, pre-conversion value, concept and multiplier. Neither the renderer nor Gemini re-inverts a working-capital effect. The table reads the accepted series, rather than trusting a saved raw array.

Old unqualified working-capital observations become unavailable; unrelated accepted report lines remain usable. This also applies to saved snapshots and annual aggregation: all four working-capital components must carry verified cash-effect semantics. Historical reports/thesis versions are not rewritten.

## 4. Cumulative normalization

Q1 uses the compatible three-month duration. Q2 = six-month cumulative − Q1; Q3 = nine-month cumulative − six-month cumulative; Q4 = fiscal year − nine-month cumulative. Concept, source unit, currency, accounting basis, fiscal identity, duration boundaries and value semantics must be compatible. Sign conversion occurs after subtraction, exactly once.

Derived observations expose source accessions and the subtraction used. Instant balances, debt, deposits, equity and capital are never summed as cash-flow quarters. Existing fiscal-calendar, 52/53-week, canonical TTM and mixed-period regression suites remain enabled.

## 5. Label and provenance changes

| Line | Truthful label / behavior |
| --- | --- |
| Receivables/inventory | Thai subtitle explicitly identifies the cash-flow effect, not the balance movement; signed amounts and neutral comparison colors |
| Other income | **Other Income (Expense), Net**; not the entire non-operating total |
| Interest | Separate reported-scope interest income and interest expense where independently disclosed; no synthesized total |
| AOCI | **Accumulated Other Comprehensive Income (AOCI)** / **กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสม (AOCI)**; source sign preserved |
| Combined equity receipts | **Stock Option Exercises & Other Stock Issuance Proceeds**; separate from non-cash SBC |
| Investing flow | **Net Cash from Investing Activities**; no unsupported “continuing” qualifier |
| Beginning/ending cash | Restricted-cash and disposal-group qualifiers follow the accepted source basis, not a generic assumption |
| Common/parent income | Hide a parent alias only when source identity and explicit attribution lineage match in all displayed periods |

The live TSLA source explicitly uses `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations`, so the disposal-group qualifier remains truthful for this source. It is not added to the narrower restricted-cash concept.

Source tooltips now expose source/form/filing date, observation dates, instant/duration, concept, original and canonical units, normalization and quarter derivation. Formula tooltips retain the common-stockholder numerator/denominator qualifications for Net Margin and FCF/Net Income. No working formula was replaced.

## 6. Completeness repairs

Goodwill Q4 2025 is 257M from the [exact 2025-12-31 annual note](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm). A newer comparative balance sheet omitted the separate goodwill line, causing the previous cohort filter to discard that annual note.

The note now survives only at the same instant, with identical assets, liabilities and equity anchors in the newer comparative filing. Changed anchors reject the older note. No prior-period carry-forward is allowed. Q1/Q2 2026 goodwill remains unavailable.

`InvestmentIncomeInterest` is now accepted as a separately sourced interest component. The live four-quarter interest income series is 439M / 449M / 434M / 422M; interest expense remains 76M / 85M / 92M / 81M; Other Income remains -28M / -592M / -535M / 590M. These are separate observations, not an inferred aggregate. A synthetic regression checks the same separation without company-specific mapping.

## 7. Assessment policies

One policy registry supplies `DIRECT_HIGHER_BETTER`, `DIRECT_LOWER_BETTER`, `CONTEXT_DEPENDENT`, `RANGE_DEPENDENT`, `DIRECTION_DEPENDENT` and `NOT_APPLICABLE`. Assets, debt, inventory, CapEx, cash, R&D, SG&A and expenses do not receive favorable colors or verdicts solely from growth or a positive balance.

Contextual evidence identifies supported relationships, including OCF insufficient to cover CapEx, expense growth versus sales/margins, and asset expansion versus returns/turnover. Qualitative adjacent-period reasoning is explicitly distinguished from supplied YoY changes. Missing relationships remain unclear; no universal liquidity cutoff is invented.

Strengths may be empty. A positive amount, sales scale or verified history does not force an economic benefit. Contextual mixed evidence is neutral; supported pressure is a warning. Numeric/schema validation checks the original response before presentation policy removes unsupported strengths, so stripping a field cannot launder an unsupported number.

## 8. Analyst context and interpretation

Gross Margin receives Revenue, COGS, Gross Profit and Operating Margin. Revenue receives margins, operating profit, OCF and FCF. OPEX receives Revenue, operating profit/margin, R&D and SG&A. Assets receive accepted Revenue, ROA, ROIC, debt, equity and turnover. OCF receives accepted net income, signed working-capital effects, CapEx and FCF.

Related observations are independently checked. Missing, conflicting, approximate or inapplicable companions do not enter the accepted observation context and do not invalidate a verified selected fact. The prompt identifies unavailable educational companions separately. Referenced keys are restricted to supplied observations; an evidence guard additionally rejects explicit trend prose about unavailable companions. Rejection retains the explicit deterministic fallback reason rather than silently accepting or rewriting an accounting claim.

Beginner Meaning retains definition / what it measures / conditional general interpretation / companion metrics. Company-first synthesis remains separate. The prompt prohibits unsupported causal, macroeconomic or competitive claims and distinguishes possible gross-margin drivers from verified causes. Cache context is `analyst-v8` so prior explanations are not reused.

The captured live SEC package has derived-from-verified ROIC; the smaller regression fixture has approximate ROIC. The former can be supplied; the latter remains visible with its methodology but is excluded from Gemini observation context. The underlying formula and each package's accepted numbers remain unchanged.

## 9. Tests added and strengthened

Accounting cases cover exact working-capital signs across raw normalization, canonical observations, adapter, formatter and Gemini; positive/negative cumulative subtraction; already signed source effects; incompatible semantics; unknown concepts; old saved snapshots; annual component semantics; exact goodwill notes and changed-anchor rejection; concept-aware income dedup; separate investment interest; common-income formulas and unchanged canonical ROIC.

Analyst cases exercise Revenue, Gross Margin, OPEX, Operating Margin, Net Income, Assets, Inventory, Debt, OCF, FCF, ROIC and Current Ratio. They cover independent related-fact rejection, neutral isolated amounts/ranges, actual OCF/CapEx/FCF relationships, synthetic expense pressure, empty strengths, unsupported qualitative companion trends and numerical rejection before presentation cleanup. Existing Meaning precedence tests explicitly preserve provider teaching/synthesis while accounting for the new assessment label.

## 10. TSLA acceptance

All amounts below are millions USD, ordered Q3 2025 / Q4 2025 / Q1 2026 / Q2 2026. These are regression expectations, not hard-coded product values.

| Metric | Accepted sequence |
| --- | --- |
| Receivables cash effect | **-907 / +45 / +561 / -184** |
| Inventory cash effect | **+1991 / -214 / -2255 / +592** |
| OCF | **6238 / 3813 / 3937 / 4697** |
| CapEx outflow in adapter/UI/analyst | **-2248 / -2393 / -2493 / -5789** |
| FCF | **3990 / 1420 / 1444 / -1092** |
| Diluted EPS, USD/share | **0.39 / 0.24 / 0.13 / 0.32** |
| Net PPE | **39407 / 40643 / 43213 / 47255** |
| Goodwill | **257 / 257 / unavailable / unavailable** |

The source CapEx purchase amount remains positive in its original canonical expense convention; the existing signed-outflow adapter and OCF − absolute CapEx formula are preserved. This pass does not add another CapEx inversion.

Current-preview checks cover all four tabs, pp changes for rates, x changes for ratios, the ROIC calculation dialog, common-income qualifications, exact goodwill, debt/finance-lease separation and source labels. Real authenticated Gemini requests verify that receivables -184M consumes cash and that positive OCF with larger CapEx leaves negative FCF. Assets use returns/funding/turnover context rather than an automatic “good” verdict.

## 11. Cross-sector scope

Automated policy/context smoke tests cover industrial/manufacturing, SaaS, banks, lenders, insurers, REITs and pre-profit/early-stage companies. Existing archetype/applicability, financial-sector valuation, insurer and REIT suites also run in the full regression gate. These are fixtures/context tests, not claims of seven additional live SEC/model runs. Live browser/source verification uses TSLA through the same generic pipeline.

## 12. Verification and artifacts

`npm run lint` **PASS** (TypeScript). `npm run build` **PASS** (frontend and production server/SEC handler). The final full regression gate **PASS: 128 files, 875 cases, zero failures and zero skipped cases**. The focused accounting, annual aggregation, Meaning and assessment gate also passed (46 cases).

The existing Vite warning about chunks larger than 500 kB remains visible. It is not hidden or presented as a failed build. The dev server is restarted after server changes. Real API requests remain authenticated, small and bounded; no full financial object is sent to the metric endpoint.

Development verification artifacts are ignored under `run_logs/`: `final-integrity-final-tests.log`, `final-integrity-lint.log`, `final-integrity-build.log`, `final-integrity-targeted-final.log`, captured public SEC source/canonical packages, browser proof and console checks. No credentials or auth headers are included in these proofs. No report was saved during verification.

Final-server authenticated Revenue, Gross Margin and Assets requests returned HTTP 200 with engine `GEMINI`, model `gemini-3.5-flash-lite`, and request sizes 3,322, 2,496 and 3,877 bytes respectively. Gross Margin retains four-part beginner Meaning and a separate provider synthesis, while its unsupported strengths remain empty. Assets explicitly show mixed context with returns/turnover relationships and empty strengths, not automatic approval for growth. The configured primary model sometimes returned 429/503; the existing bounded alternate-model policy recovered successfully. Previous live requests also verified OCF and receivables. These were actual provider calls, not mocked responses.

The final-server OCF request also returned HTTP 200 / `GEMINI` with a 3,325-byte request. Its visible synthesis correctly relates positive OCF to larger CapEx and negative FCF, labels the evidence mixed, and leaves strengths empty. Final public request metadata is saved in `run_logs/final-integrity-browser-api-proof.json`.

The 390 CSS-pixel responsive iframe uses the real report component and API: its main width and scroll width are both 390; the 760-pixel financial table scrolls within its 341-pixel container. This is responsive-layout verification, not a claim of physical-device testing. Desktop proof: `run_logs/final-gross-margin-proof.png` and `run_logs/final-assets-analyst-proof.png`; corrected cash-flow proof: `run_logs/final-cash-flow-proof.png`; responsive proof: `run_logs/final-mobile-analyst-proof.png`.

Desktop verification captured no console errors or warnings. The separate iframe harness emitted an unlocalized startup `MutationObserver.observe` TypeError; its source was not exposed by the browser logger and was not conclusively attributed to the application or automation runtime. The actual component loaded and produced the verified responsive results above. This harness-only observation is retained as a verification limitation, rather than claiming a completely clean mobile console. `git diff --check` passed.

## 13. Intentionally unavailable and partial coverage

Q1/Q2 goodwill lacks an accepted exact-date separate disclosure. Pure D&A cannot be separated from the disclosed D&A+impairment line and is not substituted into EBITDA. Option-only and stock-issuance-only receipts cannot be extracted from the combined proceeds line. Some payable adjustments, FX effects, other cash-flow components and broad accrued-liability aliases are not separately disclosed in the accepted package. Missing values remain unavailable, not zero or guessed residuals.

Bank/insurer/REIT-specific deposit, capital, lending, premium, reserve and FFO/NOI metrics are not fabricated for an operating manufacturer. The narrower restricted-cash metric is not substituted for the explicitly broader cash concept. An unavailable alias does not mean every related disclosed component is absent.

**Balance equation: PASS** describes only the disclosed total anchors. **Coverage: PARTIAL** describes missing line-item coverage and incomplete detailed bridges. These independent statements can coexist without claiming complete source coverage.
