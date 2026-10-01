# Generic financial resolver recovery

Scope: the current working branch, with earlier accounting, thesis, timeline and persistence work preserved. No reset, production ticker whitelist, UI redesign, historical rewrite or deployment.

## 1. Exact root cause

The symptom combined upstream semantic/period gaps with downstream all-or-nothing eligibility. The inspected pre-change NVDA and PLTR SEC responses already contained core financial data. A missing liquidity concept or point-in-time share observation disabled DCF; normalization then discarded independent relative valuation, and the scorer required unrelated inputs before exposing any pillar. Thus a report could look financially empty even when its canonical revenue, earnings and statements were populated.

Additional generic boundaries: a stale preferred concept could outrank a fresh alias; filing fiscal-year conventions could collide with prior quarters; long retail Q4 durations were rejected; and missing provider metadata prevented legitimate quote-based multiples from being admitted.

## 2. Why the previous acceptance companies passed

Those fixtures exercised particular standard concepts, calendar/quarter shapes and sufficiently complete DCF input sets. They did not establish issuer-generic extension acceptance, long retail Q4 support, alternate point-in-time share sources, or independent valuation/scoring eligibility. Passing four examples did not prove those abstractions. The current tests reuse source facts under an unseen symbol and sample the live SEC index independently of the fixed universe.

## 3. Why NVDA / PLTR failed

- NVDA: pre-change DCF coverage reported `SEC_SHORT_TERM_INVESTMENTS_UNAVAILABLE`. Its primary balance sheet labels current `DebtSecuritiesCurrent` as marketable debt **assets**. An unqualified debt-security tag cannot be assumed to mean either borrowing or current liquidity. Exact primary asset-row/context evidence now admits it as short-term investments.
- PLTR: pre-change coverage reported `SEC_CURRENT_SHARES_UNAVAILABLE` and `SEC_TOTAL_DEBT_UNAVAILABLE`. Consolidated instant `CommonStockSharesOutstanding` now provides the missing current shares when DEI cover facts are absent. Debt remains unavailable without a defensible disclosure; it is never assumed zero. Independent multiples and supported Conviction pillars survive that missing DCF dependency.

## 4. First data-loss stage

NVDA: raw liquidity candidate → primary statement semantic acceptance. PLTR: raw standard instant share fact → current-share source selection. The next shared divergence was **downstream eligibility**, not missing revenue ingestion. An earlier passing company with its preferred liquidity/share tags and full required inputs did not hit either boundary.

Diagnostics now locate source retrieval, concept discovery, semantic rejection, standalone-period normalization or canonical population separately. Valid raw YTD facts without the predecessor quarter are period gaps, not proven standalone facts.

## 5. Concept resolver changes

`canonicalMetricDefinitions.ts` owns controlled standard families, aliases, statement kind, units, consolidated-context policy, aggregation rules, archetype applicability and verified-component derivations. The mapper uses exact fiscal ends before concept priority. Non-finite, unit-incompatible, dimensional and unsupported-form candidates fail closed. Conflicting equally ranked facts are rejected instead of letting array order choose a value; a later filed amendment remains separately ranked.

Mapping classifications: `STANDARD_EXACT`, `STANDARD_ALIAS`, `ISSUER_EXTENSION_VERIFIED`, `DERIVED`, `UNRESOLVED`. There is no ticker, company-name or CIK branch in the generic financial resolver. Existing model-selection ticker overrides for maturity/space labels were also removed; disclosed business context drives routing. Public SIC wording for petroleum refining and telephone communications is handled generically.

## 6. Issuer extensions

Exact controlled primary-statement row meaning, statement location, entity context, dimensionlessness, currency/unit, instant/duration and filing fiscal anchors are required. Mapping retains definition, context, accession, document URL and unit evidence. A label-only extension is a discovery candidate with `NO_SEMANTIC_MAPPING`, not an accepted fact. Primary balance tables require balance-sheet structure, including equity; cash-flow and income table rules remain distinct. Segment-only facts cannot replace consolidated totals.

## 7. Fiscal periods and accounting preservation

Non-calendar fiscal identity is corrected using disclosed annual end and filing focus, rather than calendar quarter or raw `fy` alone. Retail Q4 can span 16/17 weeks (112/119 days); other quarters retain their stricter bounds. YTD subtraction requires compatible year/start/currency/source periods. EPS and ratios are non-additive. TTM flow values require exactly four consecutive compatible verified standalone quarters; instant balances are never summed.

The broad regression exposed historical redeemable-NCI double counting. Verbatim primary CVX evidence explicitly includes redeemable interest inside NCI. It is now counted once. Without presentation evidence, numerically compatible scope alternatives remain **PARTIAL, scope unresolved**, rather than being declared source verified. A genuine imbalance where neither disclosed equation reconciles still fails. Earlier TSLA EPS, PPE, OCF, CapEx, FCF, working-capital cash-effect, ROIC and balance-sheet tests remain enabled.

## 8. Dependency graph

`VALUATION_DEPENDENCIES` records independent dependencies for P/E, Forward P/E, PEG, EV/EBITDA, EV/Sales, P/FCF, P/B, DCF, ROIC and ROE. P/E uses price / verified standalone diluted EPS, or market capitalization / verified common earnings; common, parent and total earnings are never spliced. A provider-reported trailing multiple is a clearly identified alternative when canonical inputs are absent. Market capitalization and enterprise value use provider raw dollars converted to canonical millions.

ROIC/ROE keep their existing scope-compatible numerator and beginning/ending capital rules. Unknown observations, current cash/debt, or historical denominators are never replaced by zero or a stale quarter.

## 9. Valuation eligibility and negative multiples

DCF-only invalid assumptions quarantine DCF instead of deleting independent relative methods or other observed pillars. Critical accounting/identity/price conflicts retain stronger quarantine. Sector-specific DDM, REIT and cyclical policy remains separate.

Known non-positive EPS/common earnings, EBITDA, FCF, equity or numerator yields `VALUE_AVAILABLE_BUT_NOT_MEANINGFUL_FOR_MULTIPLE_COMPARISON`: numeric comparison value null, diagnostic raw value retained when calculable, N/M badge, no cheap/expensive percentile ranking. Positive provider values cannot override a known negative canonical denominator. Controlled multiple aliases are deduplicated so private AI copies cannot remain beside the canonical result.

PEG uses the same registry eligibility in ratio cards, Five Pillars, executive claims and Conviction. A trailing P/E cannot be divided by incompatible standalone-quarter EPS growth. Missing, turnaround, non-positive growth and not-applicable cases retain distinct reasons.

## 10. Conviction eligibility

Each pillar exposes `AVAILABLE`, `PARTIAL`, `NOT_APPLICABLE` or `INSUFFICIENT_DATA`, input coverage and missing dependencies. Unknown components earn no fabricated points. Growth, financial health and moat/risk can remain visible without valuation. Banking health uses observed ROE, NIM and capital inputs; optimistic AI financial-strength prose is not a substitute. REIT/insurer policies use their actual sector inputs.

Overall score requires at least 60% of original weighted input capacity, at least three supported pillars, and at least 50% coverage of Growth and Health individually. Supported components are normalized with explicit coverage; a partial high score is not represented as complete evidence. The small attributed heuristic-risk component stays labeled. Reports below minimum coverage show supported pillar scores and an unavailable overall score.

## 11. History / persistence findings

Coverage is independent of completion. All 25 source-integration reports pass the **actual** `validateAndPrepareReport` completion contract, then the production persistence splitter/reader with a bounded in-memory storage adapter. History metadata is ready, company/ticker identity is preserved, root byte size is bounded, and restored accounting observations equal the saved observations. These are storage-contract tests, not 25 live Gemini generations or 25 real Firestore writes.

Two live signed-in browser generations were also completed and saved to actual Firebase History: NVDA (374 seconds; save success 2026-09-29 14:18:55 UTC) and PLTR (341 seconds; save success 14:39:32 UTC). After a browser reload, History showed their entries and both reports reopened successfully. NVDA reopened with Q3 FY2026–Q2 FY2027 financial rows; PLTR retained its company identity and partial DCF state. There were no browser console errors on readback. Real report roots were about 4 KB; large canonical sections used bounded artifact chunks because blob storage was unavailable. No historical report or confirmed thesis version was rewritten.

## 12. Metric registry / shared truth

Every central canonical definition has metadata and an interpretation policy, checked separately from fact availability. Current NIM, combined ratio and interest coverage resolve from compatible current verified observations; old interest coverage cannot silently fill a current-period hole. Normalization refreshes cached market, profitability, liquidity and Conviction facts from the current dataset.

Executive claims share canonical TTM flow units, current liquidity/debt and resolved trailing/forward/PEG values. An unverified debt-free claim is suppressed; cash-plus-investments remains separate from net cash. Existing verified metric AI context receives accepted observation series rather than model statement arrays. History/timeline and thesis snapshots retain their original source versions.

Earnings actual/estimate beat rate, surprise and market reaction have independent eligibility. Meets are not beats and duplicate/conflicting quarters do not inflate history. New reports discard AI-generated price reactions and use a bounded historical-price endpoint. A real endpoint check returned observed NVDA closes for August 26 → August 27, 2026 and the calculated move. This is **reported-date close to next-session close**, not verification of the earnings release timestamp/session. Missing dates, exchange timezone, intervening splits or provider failure remain unavailable without erasing EPS metrics.

## 13. Files changed in this recovery

Generic SEC engine: `canonicalMetricDefinitions.ts`, `canonicalResolutionAudit.ts`, `secFinancialMapper.ts`, `xbrlNormalizer.ts`, `secShareSnapshot.ts`, `secStatementCompletion.ts`, `secIntegration.ts`. Shared contracts/calculation: `financialValue.ts`, `canonicalTtmFlow.ts`, `verifiedFinancialStatements.ts`, `selectedFinancialMetric.ts`, `canonicalExecutiveSnapshot.ts`, `financialMetricContext.ts`, `valuationDependencies.ts`, `metricRegistry.ts`, `convictionScorer.ts`, `statementValidator.ts`, `reportIntegrity.ts`, `reportValidation.ts`, `modelSelector.ts`, `types.ts`. Earnings: `earningsEligibility.ts`, `earningsReactionClient.ts`, `earningsReactionService.ts`, `marketRoutes.ts`, `App.tsx`. Existing components only received data/status/tooltip guards: Earnings, ValuationPanel and ScoreMethodology. Canary: `secResolverCanary.ts`, `secCanaryPolicy.ts`. Existing dirty work outside this recovery was preserved.

## 14. Tests added / expanded

Public-source 25-company universe and renamed-unseen-issuer invariance; controlled family metadata; primary extension acceptance and label-only rejection; dimensions; equally ranked conflicting facts/amendment; consolidated current shares; missing-YTD predecessor; 52/53-week Q4; actual redeemable-NCI presentation evidence; explicit current narrative units/debt availability; local multiples/provider alternatives/negative semantics; DCF-only quarantine; canonical PEG across consumers; business-context routing without symbol overrides; earnings beat/surprise/reaction independence; historical close/calendar/timezone/split/fetch failure; market-reaction client failure and identity boundaries; rotating sampler policy. Existing TSLA and cross-sector regression files are still executed.

## 15. Broad-universe results

The matrix below uses captured actual public SEC company facts/submissions and actual provider quotes. Five primary filing bundles add controlled public statement context; curated evidence includes source URLs/accessions and content checksums. It is **test data only**. Canonical source capture: 2026-09-29 13:42:51 UTC. Sources/fixtures remain immutable during resolution. All 25 finalize as completed partial source-integration reports and save/reopen using the bounded storage contract. PARTIAL is deliberate: this does not claim every optional historical row is disclosed or verified.

Rotating live index sample (seed `2026-09-29`): SNOA resolved current Q1 FY2027 and passed; CIZN finalized/reopened but its source ended in 2023, explicitly `STALE_SOURCE_HISTORY`; TECK used a foreign-taxonomy policy and stale annual history ending in 2018, explicitly `FOREIGN_TAXONOMY_SEPARATE_POLICY`. Neither stale/foreign result is counted as a fresh complete report. All three preserved identity and had zero explained-family false-negative candidates. Sample selection hashes the current SEC index with a date/seed, not this test list.

## 16. Companies tested

25 fixed actual-source companies across more than 15 SEC SIC codes; three independently selected live canaries, for 28 distinct issuers examined. Two of the fixed controls had full live Gemini → UI → actual Firebase History → reopen verification. A renamed control tests that issuer spelling does not drive the generic mapper. This is substantial cross-sector regression coverage, not a proof that every SEC namespace in the entire market is supported.

## 17. False-N/A count before / after

Confirmed pre-change source-backed resolver misses in the two traced controls: **2** (NVDA current investments and PLTR current common shares). PLTR debt is not counted as a proven miss. Both source-backed misses now resolve. The after count is **0** for the controlled semantic families across the 25-source regression and three live canaries. Before/after counts of downstream unavailable outputs are not equivalent to raw-source misses: the old global gates amplified a single missing dependency into many unavailable outputs.

A comparable pre-change *whole-universe* telemetry count was not captured and is not invented. Earlier exploratory XOM candidate suspects were unnormalized YTD, not confirmed compatible standalone quarters; they were reclassified as period gaps, not advertised as recovered facts. Unknown issuer extensions remain explicitly unresolved until their primary semantics are established.

## 18. Remaining intentional unavailable outputs

XOM's captured source has H1 cash flows without the predecessor quarter and no complete four-quarter flow window: no fake TTM revenue/OCF/FCF. PLTR current canonical debt remains unverified. Several issuers lack current compatible liquidity/debt or common shares in the available captured source; those inputs stay missing. Q4 EPS is not obtained by subtracting weighted-average share-based YTD EPS. D&A including impairment is not substituted for pure D&A in EBITDA. Unsupported bank NIM/capital, REIT occupancy/coverage and insurer combined ratios are not invented; minimum-coverage scores may remain unavailable. Parent, common and total equity/earnings do not substitute indiscriminately. PEG with mismatched growth basis remains unavailable/N/M. Missing peer data still cannot produce a comparable median. Stale and non-USD/foreign sources retain their respective policies.

## 19. Quality gates and proof

Final gate results and the generated matrix are recorded below. `npm run lint` is the repository TypeScript check, not ESLint. Production build succeeds with the existing large frontend bundle warning (about 3.55 MB uncompressed / 889 KB gzip); it is not hidden. `git diff --check` passes. `/api/health` returned 200/healthy; bounded historical-price success returned 200; an impossible date returned 400. The owned localhost server was restarted and test tabs reloaded. No push, merge or deployment was performed for this request.

Proof screenshots are local ignored diagnostic artifacts: `run_logs/generic-history-proof.png`, `run_logs/generic-nvda-reopened-proof.png`, `run_logs/generic-pltr-reopened-proof.png`. Source logs contain public financial test evidence only and are not committed.

### Verified 25-company matrix

All values in this matrix come from captured public SEC source and the production resolver/validation/persistence path. `Core` is verified revenue, scoped net income, assets, liabilities, scoped equity, and operating cash flow (out of six). `Statements` being `PARTIAL` describes historical statement coverage, not a failure of available current facts. `Valuation` reports input eligibility and independently available multiple methods, not a generated fair-value assertion. `Persistence` here is the production serialization contract on the bounded test adapter; the real Firebase save/reopen controls are recorded below.

| Ticker | Archetype | Core Canonical Data | Statements | Key Metrics | Valuation | Conviction | Persistence | Unexpected False-N/A |
|---|---|---:|---|---:|---|---|---|---:|
| TSLA | industrial_manufacturing | 6/6 | PARTIAL | 18 numeric | DCF inputs eligible; 6/6 multiples | 62/100 (78% coverage) | Pass (test adapter) | 0 |
| NVDA | semiconductor | 6/6 | PARTIAL | 20 numeric | DCF inputs eligible; 6/6 multiples | 94/100 (78% coverage) | Pass (test adapter) | 0 |
| AMD | semiconductor | 5/6 | PARTIAL | 16 numeric | DCF inputs eligible; 6/6 multiples | 90/100 (75% coverage) | Pass (test adapter) | 0 |
| MSFT | saas_software | 6/6 | PARTIAL | 17 numeric | DCF inputs eligible; 6/6 multiples | 82/100 (78% coverage) | Pass (test adapter) | 0 |
| AAPL | general_operating | 6/6 | PARTIAL | 15 numeric | DCF inputs eligible; 6/6 multiples | 78/100 (75% coverage) | Pass (test adapter) | 0 |
| GOOGL | general_operating | 6/6 | PARTIAL | 17 numeric | DCF inputs eligible; 6/6 multiples | 73/100 (75% coverage) | Pass (test adapter) | 0 |
| META | general_operating | 6/6 | PARTIAL | 14 numeric | DCF unavailable (debt, shares); 6/6 multiples | 85/100 (63% coverage) | Pass (test adapter) | 0 |
| AMZN | retail | 5/6 | PARTIAL | 17 numeric | DCF inputs eligible; 5/6 multiples | 64/100 (78% coverage) | Pass (test adapter) | 0 |
| PLTR | saas_software | 6/6 | PARTIAL | 14 numeric | DCF unavailable (debt); 6/6 multiples | 100/100 (63% coverage) | Pass (test adapter) | 0 |
| CRM | saas_software | 6/6 | PARTIAL | 13 numeric | DCF unavailable (STI); 6/6 multiples | 69/100 (75% coverage) | Pass (test adapter) | 0 |
| ORCL | saas_software | 5/6 | PARTIAL | 15 numeric | DCF unavailable (debt); 5/6 multiples | 69/100 (63% coverage) | Pass (test adapter) | 0 |
| COST | retail | 6/6 | PARTIAL | 18 numeric | DCF inputs eligible; 6/6 multiples | 66/100 (78% coverage) | Pass (test adapter) | 0 |
| WMT | retail | 5/6 | PARTIAL | 15 numeric | DCF unavailable (STI); 6/6 multiples | 61/100 (75% coverage) | Pass (test adapter) | 0 |
| CAT | industrial_manufacturing | 6/6 | PARTIAL | 15 numeric | DCF unavailable (STI, debt); 6/6 multiples | 82/100 (63% coverage) | Pass (test adapter) | 0 |
| BA | general_operating | 6/6 | PARTIAL | 16 numeric | DCF inputs eligible; 5/6 multiples | 42/100 (78% coverage) | Pass (test adapter) | 0 |
| XOM | energy_commodity | 5/6 | PARTIAL | 5 numeric | DCF unavailable (4Q, revenue, FCF, STI); 5/6 multiples | unavailable (36% coverage) | Pass (test adapter) | 0 |
| CVX | energy_commodity | 6/6 | PARTIAL | 15 numeric | DCF unavailable (cash, STI, debt); 6/6 multiples | 85/100 (66% coverage) | Pass (test adapter) | 0 |
| JPM | bank | 6/6 | PARTIAL | 8 numeric | DCF unavailable (FCF, cash, STI, debt); 4/6 multiples | unavailable (58% coverage) | Pass (test adapter) | 0 |
| BAC | bank | 6/6 | PARTIAL | 7 numeric | DCF unavailable (FCF, cash, STI, debt); 4/6 multiples | unavailable (39% coverage) | Pass (test adapter) | 0 |
| SOFI | general_operating | 6/6 | PARTIAL | 8 numeric | DCF unavailable (STI, debt); 4/6 multiples | unavailable (39% coverage) | Pass (test adapter) | 0 |
| AIG | insurer | 6/6 | PARTIAL | 8 numeric | DCF unavailable (FCF, cash, STI, debt); 5/6 multiples | unavailable (39% coverage) | Pass (test adapter) | 0 |
| PLD | reit | 6/6 | PARTIAL | 10 numeric | DCF unavailable (FCF, STI, debt); 5/6 multiples | unavailable (58% coverage) | Pass (test adapter) | 0 |
| JNJ | healthcare | 6/6 | PARTIAL | 13 numeric | DCF inputs eligible; 6/6 multiples | 81/100 (75% coverage) | Pass (test adapter) | 0 |
| CRSP | general_operating | 6/6 | PARTIAL | 9 numeric | DCF unavailable (debt); 2/6 multiples | unavailable (59% coverage) | Pass (test adapter) | 0 |
| VZ | telecom | 5/6 | PARTIAL | 11 numeric | DCF unavailable (FCF, STI); 5/6 multiples | unavailable (59% coverage) | Pass (test adapter) | 0 |

### Final gates

- `npm test`: 137 test files, 941 cases passed, 0 failed, 0 skipped.
- `npm run lint` (TypeScript check): passed. `npm run build`: passed, with the existing large-bundle warning. `git diff --check`: passed.
- Live server: `/api/health` 200; bounded historical market-price request 200; invalid date 400.
- Actual Gemini and authenticated Firebase History: NVDA and PLTR reports generated, saved, and reopened after reload.
- Rotating live SEC canaries: SNOA current-source path passed and persisted; CIZN was correctly marked stale source history; TECK was correctly separated under foreign-taxonomy policy.
- Boundary: these 25 captured-source results and three rotating canaries validate the generic resolver under their stated source conditions; they do not imply every issuer has complete live source coverage.
