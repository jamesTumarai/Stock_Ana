# Verified financial statements rebuild — engineering dossier

## Start state

- Repository: `jamesTumarai/Stock_Ana`
- Working branch: `main`
- Starting HEAD: `8116a1ba58bd5d10829095b57cf083c05dc6030e`
- Existing uncommitted balance-sheet, TTM, peer and terminology repairs are preserved. This work starts from the current preview, without reset or pull.

## Pre-edit data-flow audit

1. `server.ts` obtains a structured report from the research model. Its final bridge extracts valuation assumptions and streams another JSON report; it does not fetch the target's SEC financial package. The client concurrently calls the target preview endpoint and overlays a successful SEC package before final validation; an unsuccessful/missing package leaves model arrays intact. Target SEC ingestion is exposed by `server/secPreviewHandler.ts`; production peer enrichment retrieves SEC packages for peers.
2. Client report validation (`src/utils/reportValidation.ts`) accepts/transposes statement rows into arrays. Source URLs and labels do not independently verify those numbers.
3. `normalizeReport()` in `src/utils/reportIntegrity.ts` constructs a provenance view over the model's arrays when no independent SEC package exists. It retains the numeric arrays. Even when a SEC canonical package exists, it does not rebuild the displayed statement arrays from that package.
4. `adaptSecCanonicalToFinancialStatements()` rejects a mismatching textual label, but selects historical observations by `series[index]`; it does not validate structured fiscal year/quarter, duration, source or instant end date for every historical cell. Only the latest balance sheet uses the strengthened current-instant resolver.
5. `FinancialStatementsTable.tsx` consumes those arrays, falls back to model-supplied Key Indicators, guesses raw currency scaling from revenue magnitude, and computes quarter-times-four ROE/ROA/ROIC and 90-day turnover ratios locally. Calculation details implement additional local formulas.
6. `validateFinancialStatements()` reconciles assets against liabilities plus equity without explicit redeemable/NCI presentation metadata. `impossible_guards_passed` ignores balance-equation failures; the component uses that narrow flag for its green Passed badge. Missing inputs can leave `is_balanced=true` without any completed reconciliation.
7. `financialAiInsights.ts` filters nulls out of history before counting trends, so separated valid observations can be described as consecutive quarters. The table's remote synthesis has no independent numeric-claim acceptance check.

## Root causes supported by code

- Model accounting arrays survive normalization and are directly displayed. This alone permits invented or shifted historical values and mixed cells; merely adding a filing URL is not a verified source overlay.
- SEC companyfacts `fy/fp` describe filing context and can repeat comparative observations. Independent per-concept latest-end selection can place an older observation in a current column when another concept has current data. The table adapter trusts positions rather than a period-wide identity/end-date contract.
- Net income concept aliases and combined equity concepts erase distinctions between total income/common income and stockholders' equity/equity including NCI. Issuance aliases combine employee option proceeds and common issuance. GAAP and non-GAAP cannot be inferred from plausible numbers.
- The green guard flag is logically narrower than the failed-guard list, allowing contradictory trust states.
- UI ratios use different time windows, denominators and cash treatment from canonical Five Pillars. Missing STI/inventory can be treated as zero in some paths.

These are code-level findings. They do not establish that every historical production report suffered every defect; source-backed regression fixtures will test the specified defect shapes.

## Implementation and verification

Implemented on the existing working tree. HEAD remains `8116a1ba58bd5d10829095b57cf083c05dc6030e`; no commit, push, pull, reset or deployment was performed for this request. Verification date: 2026-09-28. The layout remains the existing report layout; changes to visible text concern source identity, accounting definitions, period labels and trust states.

## Source architecture and AI boundary

| Tier | Final behavior |
| --- | --- |
| SEC | Independently retrieved companyfacts/submissions, accession-linked filing URL, fiscal metadata and standard XBRL concepts. The primary filing HTML supplies independently parsed consolidated debt/finance-lease presentation where companyfacts lacks that presentation. |
| Issuer | Higher-quality potential fallback than a generic provider, but an issuer URL attached to a model response is not an independently ingested observation. No issuer-only number is silently promoted by this implementation. |
| Financial provider | Potential lower source tier. Provider TTM is a diagnostic cross-check, not an override of four accepted standalone quarters. An unimplemented provider ingestion contract fails closed. |
| AI | Can explain accepted observations and shared calculations. Model statement arrays, model ratios, model canonical packages and model SEC-verification envelopes cannot become final accounting values in the client generation path. |

`src/App.tsx` removes model-supplied canonical/SEC authority metadata before the independently retrieved package is applied. `normalizeReport()` rebuilds the entire statement package from the accepted canonical dataset. It clears model Key Indicators and marks an absent/old source package unavailable. It never overlays just the successful cells onto an AI history.

The accepted observation boundary requires the current mapping/normalization versions, an independently generated SEC package, USD units, `reported` or `derived` value type, verified status, SEC HTTPS document URL and accession, structured fiscal identity and compatible actual dates. Estimated, unclassified, source-linked-only and legacy values are rejected. Dates/concepts/source components remain in the resulting package. This is an ingestion contract, not a claim that an arbitrary externally supplied JSON document is cryptographically authenticated.

## Canonical period and observation models

Quarter identity is `(fiscalYear, fiscalQuarter)`, with the actual start/end dates and currency retained. A formatted quarter label must resolve to that same identity. Placement uses each observation's identity, not its position in an array. Duplicate/conflicting candidates and conflicting anchor dates fail closed; a relabeled prior-year fact cannot enter a current-year cell.

| Field | Contract |
| --- | --- |
| metric / statement | Explicit concept meaning and income, balance-sheet or cash-flow section |
| value / unit | Finite reported/derived number or null; `USD_M`, per-share, percent or ratio units kept separate |
| fiscal identity | Fiscal year/quarter, display period, actual period start/end, period type, duration days and currency |
| source | SEC filing URL, form, accession, filing/retrieval dates, concept, US GAAP/source authority metadata |
| verification / type | Independently verified, reported or derived; source-linked alone is insufficient |
| derivation | Formula/conversion description and the retained underlying observations |
| period snapshot | Accepted observations and per-metric rejection reasons for one actual period |

Duration facts must become standalone quarters before acceptance. Native quarter facts take precedence. Q2/Q3 can be derived as compatible YTD differences, and Q4 as the compatible fiscal-year total minus Q3 YTD. Subtraction requires matching concept, unit, currency, fiscal start and fiscal identity. EPS/ratios/percentages are non-additive. A 52/53-week issuer uses its actual dates; a valid longer quarter is allowed without forcing calendar quarter dates.

Balance-sheet observations are instants: the actual ending date must match the column. They are neither annualized nor summed. Restatement handling also selects a common filing accession that discloses Assets, Liabilities and equity together; an isolated newer comparative equity fact cannot mix into an older Assets/Liabilities cohort. Debt and investment resolvers respect that same instant cohort. Cells not disclosed within the compatible source package remain null.

The source-backed boundary allows standalone durations of 60–112 days. Four-quarter TTM additionally requires compatible, consecutive fiscal quarters and actual dates. A missing quarter, duplicate, annual/YTD contamination or mismatching unit/date makes that metric's TTM unavailable.

## Income statement

Reported fields include Revenue, COGS, Gross Profit, operating expenses, R&D, SG&A, Operating Income, nonoperating items, interest expense, pretax income, tax expense, total NI, parent NI, common NI and diluted EPS where the matching standard concept is available. Sector-specific reported concepts include net interest income, noninterest income, provision expense, premiums, rent and supported FFO/NOI disclosures.

Safe derived fields are centralized: Gross Profit = Revenue − COGS, or COGS = Revenue − Gross Profit, only from compatible accepted inputs when the target disclosure is absent. A conflicting disclosed target is not healed by that identity. Operating Income and operating expenses are not guessed from unrelated totals in the UI.

The distinctions are explicit:

- `ProfitLoss` is total NI. `NetIncomeLoss` is NI attributable to the parent. Neither is silently renamed common NI.
- Common NI uses `NetIncomeLossAvailableToCommonStockholdersBasic`. Parent NI can serve as common NI only when same-period preferred equity is explicitly zero and there is no positive preferred allocation. Missing preferred equity is not proof of zero.
- Common equity is parent stockholders' equity less explicitly verified preferred equity. If the common base cannot be independently established, common-equity ROE remains unavailable.
- EPS remains a per-share reported disclosure; FY EPS minus YTD EPS is not a legitimate standalone Q4 EPS derivation. The captured Q4 EPS is therefore unavailable. No annual diluted EPS is fabricated by adding quarter EPS.
- Only the mapped standard US-GAAP accounting concepts enter these statement rows. Non-GAAP adjusted income/EPS/EBITDA and an arbitrary similarly named custom concept cannot masquerade as GAAP.
- Derived EBITDA is visibly named `Derived EBITDA`: Operating Income + accepted D&A. It is distinct from reported/adjusted EBITDA and not a claim of a separately disclosed EBITDA measure.
- EBIT Margin remains unavailable without a separately verified EBIT definition; Operating Income is not silently renamed EBIT.

## Balance sheet and accounting guards

Cash & Cash Equivalents, short-term investments, Cash + STI, debt and Net Cash retain separate meanings. Net Cash = Cash + STI − canonical debt; ordinary cash is not substituted for cash including restricted cash in cash-flow reconciliation.

Assets = Liabilities + equity including NCI + disclosed redeemable/mezzanine equity. Combined equity is counted once. When parent equity is used, NCI must be independently disclosed before adding it; redeemable NCI is separate. Treasury stock/other unmapped equity classes are not forced into a fabricated zero-valued equation. Equity-component deltas are diagnostic unless the complete classification is established.

Other guards include Cash ≤ Assets, bank Deposits ≤ Assets, and canonical Debt ≥ compatible disclosed current debt. Hard balance, debt or cash-flow failures prevent green Passed. Missing reconciliation inputs produce partial/unavailable status, not Passed and not an invented accounting failure. Return ratios suppress the failed balance snapshots they actually use; an unrelated old snapshot does not erase a valid current window.

The source-backed TSLA Q2 fixture reconciles:

`148524 = 61005 + 87465 + 54` (USD millions).

Parent equity is 86858, NCI 607 and combined equity 87465. Cash is 15219, STI 28305 and debt/finance leases 9342. Cash + STI is 43524; Net Cash is 34182. The debt presentation independently identifies current 1418 and noncurrent 7924. Its generic HTML parser requires the filing's entity, period, USD unit and consolidated contexts; wrong-currency/entity/dimensional or conflicting presentations are rejected.

## Cash flow and TTM

OCF, investing CF, financing CF, CapEx, D&A, SBC, working-capital changes, FX and cash change normalize from compatible same-fiscal-year YTD facts into standalone quarters. CapEx cash outflows display with an explicit negative sign. Canonical FCF = OCF − abs(CapEx), regardless of an independently reported FCF that disagrees. OCF and CapEx must belong to the same standalone period.

Issuance of common stock, common-stock repurchase and option-exercise proceeds are separate observations and rows. Proceeds from issuance/options are not relabeled buyback. Restricted-cash beginning/end values and cash change use the same reconciliation basis. Where inputs exist, both `beginning cash + change = ending cash` and `OCF + investing CF + financing CF + FX = change` are checked. Missing inputs keep coverage partial.

`canonicalTtmFlow.ts` is the shared flow aggregator. Revenue, Operating Income, NI, OCF, CapEx, FCF, pretax income, tax expense and supported sector duration metrics are four compatible consecutive standalone quarters. Balance-sheet instants, EPS and ratios are not in that additive path. Provider disagreements retain canonical/provider values, delta, periods and sources rather than changing the canonical value.

Annual/LTM views sum accepted flows, keep ending instants and recalculate ratios. Quarterly reported percentages such as NIM are never summed. A standalone LTM analysis request uses the same annual view even though its label contains quarter names. Legacy ratio arrays resolve the same shared definitions as calculation details.

## Canonical Key Indicators

Inputs below are accepted compatible facts. Missing inputs or a nonmeaningful denominator make the ratio unavailable. TTM uses four quarters; beginning/end averages for TTM returns use the actual prior-year fiscal quarter ending balance and current ending balance. Quarterly day metrics use the previous compatible quarter end and current end; annual day metrics use annual beginning/end. Actual duration days replace an assumed 90 days.

| Indicator | Exact definition |
| --- | --- |
| Gross Margin | Gross Profit / Revenue × 100 |
| Operating Margin | Operating Income / Revenue × 100 |
| Net Margin | Common NI / Revenue × 100 when common NI is verified; otherwise Total NI / Revenue × 100 with explicit total-NI basis; no parent-NI proxy |
| EBIT Margin | Unavailable without a separately verified EBIT definition |
| Derived EBITDA Margin | (Operating Income + D&A) / Revenue × 100; explicitly derived |
| Effective Tax Rate | Tax Expense / positive Pretax Income × 100 |
| Current Ratio | Current Assets / Current Liabilities |
| Quick Ratio | (Cash + STI + Receivables) / Current Liabilities; missing STI is not zero |
| D/E | Canonical Debt / parent Stockholders' Equity |
| Equity Ratio | Equity Including NCI / Assets × 100 |
| Debt/Assets | Canonical Debt / Assets × 100; total liabilities are not debt |
| ROE | TTM Common NI / average Common Equity × 100 |
| ROA | TTM Total NI / average Assets × 100 |
| ROIC | TTM Operating Income × (1 − tax rate) / shared invested-capital denominator × 100 |
| Invested capital | Parent Stockholders' Equity + canonical Debt − Cash − STI; verified combined equity is the explicitly retained fallback when parent equity is unavailable |
| ROIC denominator | Shared canonical calculator uses positive beginning/end average when available; otherwise positive ending invested capital, visibly approximate and with the ending denominator in its formula |
| ROIC tax policy | Observed meaningful TTM tax/pretax ratio; deterministic 21% fallback is explicitly approximate. Exact tax fraction used is retained in details, with no premature rounding |
| FCF Margin | (OCF − abs(CapEx)) / Revenue × 100 |
| FCF Conversion | (OCF − abs(CapEx)) / positive Common NI × 100 |
| Asset Turnover | TTM Revenue / average Assets |
| Inventory Turnover | TTM COGS / average Inventory |
| DSO | average AR / period Revenue × actual period days |
| DIO | average Inventory / period COGS × actual period days |
| DPO | average AP / period COGS × actual period days; COGS is an explicit purchases proxy, marked approximate |
| CCC | DSO + DIO − DPO from the same period; approximate because of the purchases proxy |
| Bank NIM | Separately reported NIM, not an annual sum of percentages |
| Bank Total Deposits | Accepted period-ending deposit level; not a percentage growth rate |
| Bank LDR | Net loans held for investment / Deposits × 100 |
| Bank Efficiency Ratio | Reported operating expenses / net Revenue × 100 |

`calculateVerifiedKeyIndicators()` supplies the table, formula details, source-aware metric analysis and compatible Five Pillars values. Peer ROIC uses the same accepted statement calculation. Numeric formula inputs retain units, periods, source URLs, derivation and approximate/unavailable status. Calculation-detail tests recompute ROIC from the exact actual denominator and tax fraction used.

For banks and insurers, generic quick/current ratios, inventory turnover and corporate FCF/ROIC investment interpretation are suppressed. Payment processing is not classified as a deposit-taking bank merely because it is financial technology. REIT classification and the existing valuation policy remain; unsupported FFO/AFFO/NOI are unavailable rather than manufactured from corporate EBITDA. Pre-profit losses and negative FCF remain signed.

## Analyst Synthesis, strengths and watchouts

The metric-analysis API independently retrieves the accepted SEC statement package; submitted client accounting histories are not trusted. Requested periods must exist in that package. Shared calculations and source-backed surrounding Revenue/Operating Income/NI/OCF/CapEx/FCF supply the prompt. Unknown numeric output claims are rejected with HTTP 422; accepted fiscal labels, supported numbers and display scaling are allowed. Authentication/rate limiting remain intact.

Hard reconciliation failure blocks confident synthesis. Partial reconciliation produces a bounded deterministic explanation, explicitly says the value does not establish financial strength or a fully reconciled statement, and does not invent strengths. Gaps are not filtered away to imply consecutive trends. Missing current values do not silently pick an older available value. Currency, EPS, ratios and percentages have distinct formatting.

The numeric guard is an allowlist for supported numbers, not a semantic proof of every generated sentence. The app's wider business narrative is not retroactively SEC-certified. Full authenticated live Gemini report generation was not completed in this session; the browser required login, and an unrelated live model request returned upstream HTTP 503. No authentication bypass or fake saved user report was introduced to obtain a passing screenshot.

## Source-backed regression fixture

`verified-tsla-2026q2.json` retains actual SEC companyfacts observations, accession metadata and a primary-filing inline-XBRL excerpt. The cross-sector fixture retains captured actual SEC facts. Synthetic fixtures used for malformed/conflicting inputs are confined to tests and explicitly satisfy the independent ingestion test-double contract; they are never production fallback accounting data.

All money below is USD millions; EPS is USD/share.

| Metric | Q3 2025 | Q4 2025 | Q1 2026 | Q2 2026 |
| --- | ---: | ---: | ---: | ---: |
| Period end | 2025-09-30 | 2025-12-31 | 2026-03-31 | 2026-06-30 |
| Revenue | 28095 | 24901 | 22387 | 28236 |
| Gross Profit | 5054 | 5009 | 4720 | 4751 |
| Operating Income | 1624 | 1409 | 941 | 398 |
| Total NI | 1389 | 856 | 491 | 1128 |
| Common NI | 1373 | 840 | 477 | 1114 |
| Diluted EPS | 0.39 | unavailable | 0.13 | 0.32 |
| OCF | 6238 | 3813 | 3937 | 4697 |
| CapEx outflow | -2248 | -2393 | -2493 | -5789 |
| FCF | 3990 | 1420 | 1444 | -1092 |

Canonical TTM Revenue = **103619**, exactly `28095 + 24901 + 22387 + 28236`. TTM Common NI = 3804; TTM Total NI = 3864. ROE = `3804 / ((77314 + 86858) / 2) × 100` = **4.63%**. The capture's ROIC is **6.15%, approximate ending-capital basis**, because its compatible beginning debt/capital disclosure is incomplete; the UI does not claim an average-capital result for that fixture.

Primary documents: [Q3 2025](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm), [FY 2025 / Q4 derivation](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm), [Q1 2026](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm), [Q2 2026](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm).

Own actual period dates/source accessions, shuffled-series tests, relabeling rejection tests and the source-backed expected four-column matrix establish that a Q3 2024 observation cannot pass as Q3 2025. The restatement regression also injects an isolated newer comparative equity disclosure and proves it cannot contaminate the existing instant cohort.

The captured TSLA package has 324 accepted source-backed cells out of 336 considered mapped cells; 12 are unavailable. This is **coverage within the mapped package**, not a claim that all possible financial concepts are present. The fixture's disclosed balance equation passes, but complete statement reconciliation is **partial**, so no green full Passed status is shown.

## Cross-sector results

The restarted localhost `/api/sec-preview?ticker=TSLA` returned HTTP 200 with independently retrieved Revenue `[28095, 24901, 22387, 28236]`, canonical TTM `103619`, mapping `period-true-statements-v2` and the actual current filing source/end/date. Source captures were fetched successfully from SEC in this session after setting the user-authorized SEC contact in the ignored local environment. Primary SEC JSON and the target primary HTML returned HTTP 200. Source/date assertions and all cross-sector regression cases pass.

| Archetype / capture | Verified behavior | TTM Revenue (USD M) | Honest remaining coverage |
| --- | --- | ---: | --- |
| Standard / MSFT | June fiscal end, actual fiscal quarters, shared ratios | 331839 | ROE unavailable without independently verified common-equity/allocation proof; no complete accounting Passed claim |
| SaaS / CRM | FY26 Q3/Q4 and FY27 Q1/Q2 actual Oct/Jan/Apr/Jul ends | 43938 | Common base/debt-capital gaps suppress ROE/ROIC |
| Semiconductor / NVDA | 52/53-week actual dates, four consecutive quarters | 302969 | ROE 117.21%; ROIC unavailable for incomplete compatible capital inputs |
| Bank / JPM | Common NI 20752 differs from parent NI 21155; preferred allocations retained | 199408 | ROE 18.43%; corporate ROIC suppressed |
| Fintech lender / SOFI | Net bank revenue priority and deposits-based policy | 4305.695 | Generic corporate FCF/ROIC policy suppressed; common-equity gaps remain unavailable |
| Payments / V | Standard operating business, not deposit-taking banking | 43027 | Missing separate STI/common-equity proof makes some ratios unavailable; reconciliation partial |
| Insurer / PGR | Insurance applicability policy preserved | 91055 | Corporate FCF/ROIC interpretation suppressed; specialized concepts can be missing |
| REIT / PLD | Profile-based REIT classification preserved on report normalization | 8948.185 | FFO/AFFO/NOI custom-definition gaps are not invented; partial reconciliation |
| Pre-profit biotech / CRSP | Negative parent NI and FCF retained, absent debt not zero | 13.392 | ROIC unavailable; parent loss not falsely renamed common NI |
| Foreign IFRS / TSM | Unsupported 20-F/IFRS/local-currency package fails closed | unavailable | Source bundle retained, no invented USD US-GAAP quarterly statements |

Every tested accepted observation's own fiscal identity/end/source period matches its snapshot. The captures have no hard accounting failed guards; that alone **does not** imply complete reconciliation. Several captures have unavailable reconciliation because not every necessary component is mapped/disclosed. Their accepted facts remain separately source-backed.

## Cache, migration and performance

- Current statement mapping is `period-true-statements-v2`; normalization is `standalone-source-v2`; canonical financial schema is version 2 with an independent SEC generator marker.
- Report schema is version 3, with the current period-true report generation identity. Old report schema 2 and missing/old statement versions cannot become newly verified simply by loading them.
- Source coverage/provenance is recalculated from accepted cells. An eligible valuation package does not certify an unrelated model statement table.
- Companyfacts/submissions and filing/accession document retrieval are bundled/cached. The table does not fetch each financial cell separately. Metric prose requests may independently retrieve the cached source bundle.
- No dependency/lockfile changes, forced audit fixes, Firebase-project/rules relaxation or credential publication were used.

## Tests and browser evidence

Regression cases cover calendar and non-calendar fiscal years, 52/53-week companies, missing/duplicate quarters, shifted cell identity, mixed end dates, YTD contamination, incompatible concepts/units/currencies, non-additive EPS/NIM, source versions, estimated/unverified rejection, source conflicts, safe derived identities, preferred/common NI and equity proof, NCI/mezzanine, restatement cohorts, CapEx/FCF, cash reconciliation, annual instants, TTM disagreement, shared formulas, source-aware synthesis and legacy report boundaries.

Earlier tests that asserted AI/legacy accounting arrays as authoritative were updated to explicit independently ingested synthetic source fixtures. Their business/period/valuation assertions remain. Cases for unverified raw arrays and old source versions directly exercise rejection. The statement validator's old ticker/M&A heuristics were replaced with accounting equation, source coverage, missing-input and hard-failure cases; accounting values are not altered to fit an expected ticker narrative.

Browser verification used the **actual production `FinancialStatementsTable` component** with the actual independently captured SEC package in an ignored development-only harness. It did not inject a synthetic authenticated user, save a user report or replace the production report flow. Verified interactions include statement tabs, quarter/annual/LTM switching, actual source/end/filed dates, unavailable Q4 EPS, ROE formula inputs/result, separate cash-flow issuance/repurchase rows, partial guard labels and mobile header wrapping and scrolling to/selecting a statement row. Full authenticated AI report generation is a separate unverified limitation.

## Quality gate

Final gate status is recorded after the last source/formula metadata repair:

| Gate | Result |
| --- | --- |
| Focused mapper / adapter / statements / cross-sector / table boundary | 50 tests passed, 0 failures/skips |
| Full regression | 119 files, 774 cases passed; 0 failed, 0 skipped |
| TypeScript (`npm run lint`) | Passed (`tsc --noEmit`) |
| Production build | Passed; existing chunk-size and CJS import.meta warnings retained |
| Firebase rules preflight | Passed for repository target `stock-analyze-a89d0 / (default)`; not live project identity/deployment verification |
| `git diff --check` | Passed; 17 new source/document/fixture files have no trailing whitespace. Existing whitespace outside changed lines was preserved |
| `npm audit --omit=dev` | 8 moderate transitive advisories; no high/critical. Existing UUID / Google Cloud dependency chain requires a separately assessed upgrade, potentially breaking. No `audit fix --force` used |

Build warnings are retained: chunks over 500 kB and two CJS `import.meta` warnings. They are not hidden or treated as failed source verification.

## Known limitations and current behavior

| Metric / area | Archetype | Source limitation | Current behavior |
| --- | --- | --- | --- |
| Standalone Q4 / annual EPS | All | No verified native standalone or annual per-share source in this adapter | Unavailable; no FY−YTD or quarterly sum |
| Common NI / common equity / ROE | All, notably preferred issuers | Native common allocation or independently verified preferred-equity base absent | Parent NI remains separately visible; common NI/ROE unavailable unless the required proof exists |
| Goodwill/intangibles/equity classes/CF changes | All | Only separately mapped standard concepts are ingested | Missing remains unavailable; no missing-to-zero conversion |
| Beginning invested capital | Corporate | Compatible beginning debt/STI/parent-equity input absent or nonpositive | Shared positive ending-capital method is explicitly approximate, with the correct denominator in the formula; otherwise unavailable |
| Tax rate for ROIC | Corporate | Meaningful observed tax/pretax not available | Explicit approximate policy fallback, not invented reported tax expense |
| DPO/CCC | Corporate | Verified purchases often absent | COGS proxy marked approximate |
| EBIT / reported EBITDA / adjusted measures | Corporate | Separate accepted definition/source absent | EBIT unavailable; derived EBITDA has a distinct label; no adjusted-to-GAAP mixing |
| NIM/CET1/combined ratio/FFO/AFFO/NOI | Banks, insurers, REITs | Many real issuers use custom tags or issuer definitions outside mapped US-GAAP concepts | Missing/source-specific KPI unavailable; no unsupported generic sector substitution |
| Issuer/provider-only financial data | All | No independently approved full ingestion contract implemented here | Fails closed, even if a model supplies a plausible source URL |
| Foreign issuer statements | IFRS / 20-F / 6-K / non-USD | Compatible IFRS/currency/period ingestion not implemented | Source retained, final unsupported statement table unavailable |
| Whole-statement reconciliation | All | Missing restricted-cash/equity/other components | Partial/unavailable trust state; never an unconditional green Passed |
| Numeric prose guard | All | Number membership cannot prove semantic correctness of every sentence | Unsupported numbers rejected; broader narrative not retroactively SEC certified |
| Live complete report / sign-in | Application | Browser did not complete authenticated generation; observed upstream model 503 | No claim of full live AI success. Source retrieval, deterministic pipeline, component UI and regression tests are separately verified |
| Local development HMR | Application | Another process occupies Vite's default websocket port | Page/API work on port 3002; unrelated process preserved. Reload after edits; startup warning is separate from accounting data integrity |

## Completion evidence mapping

| User criteria | Evidence |
| --- | --- |
| 1–6: AI exclusion, structured identity, source, safe placement and no mixed fiscal column | Independent whole-package rebuild; shifted/relabeled/shuffled/conflicting period tests |
| 7–14: backed four-quarter history, missing-not-zero, GAAP/NI separation, normalization and FCF | Actual four-quarter source fixture, cross-sector captures, preferred allocation, non-additive EPS and compatible YTD/OCF/CapEx tests |
| 15–21: instant/end identity, NCI/mezzanine, hard guards, CF and annual semantics | Source cohort and instant adapter; equation/cash/issuance/annual tests; honest partial status |
| 22–32: shared formulas and appropriately qualified metrics | Shared indicator service, calculation-detail/Five Pillars equality, exact ROIC denominator reproduction and approximate DPO/ending ROIC |
| 33–36: synthesis, coverage and migration | API independent-source input guard, numeric rejection, failed/partial local synthesis, source coverage and schema rejection tests |
| 37–43: cross-sector, foreign safe handling, no ticker-specific production patch | Captured MSFT/CRM/NVDA/JPM/SOFI/V/PGR/PLD/CRSP/TSM tests; generic production mappings |
| 44–49: quality gates | Final status table above |

## Working-tree file inventory

The inventory below records the final working tree, including preserved changes from earlier balance-sheet, TTM, peer, terminology and UI work. It is not an assertion that every diff originated in this request. Current-task core files are the verified statement/indicator/synthesis domain modules, SEC mapper/normalizer/adapter/resolvers, source provenance/report validation, shared metric calculations/annual aggregation, metric API, statement table and their source-backed regression fixtures.

<!-- WORKTREE_FILES -->

```text
docs/verified-statements-rebuild.md
server.ts
server/routes/metricRoutes.ts
server/services/__tests__/peerFinancialEnrichmentService.test.ts
server/services/peerFinancialEnrichmentService.ts
src/App.tsx
src/components/FinancialStatementsTable.tsx
src/components/__tests__/keyIndicatorEmptyStateUi.test.tsx
src/domain/__tests__/verifiedFixtureBuilder.ts
src/domain/canonicalExecutiveSnapshot.ts
src/domain/canonicalTtmFlow.test.ts
src/domain/canonicalTtmFlow.ts
src/domain/cashTerminology.test.ts
src/domain/cashTerminology.ts
src/domain/currentBalanceSheetSnapshot.ts
src/domain/decisionContextEngine.ts
src/domain/financialMetricContext.ts
src/domain/financialSynthesisGuard.ts
src/domain/financialValue.ts
src/domain/investmentMemory.ts
src/domain/thesisExpectations.ts
src/domain/valuation/__tests__/adaptiveFivePillarsCrossSector.test.ts
src/domain/valuation/__tests__/canonicalPeriodIntegrity.test.ts
src/domain/valuation/__tests__/canonicalSection1Integrity.test.ts
src/domain/valuation/__tests__/currentBalanceSheetSnapshot.test.ts
src/domain/valuation/__tests__/finalFivePillarsConsistency.test.ts
src/domain/valuation/__tests__/fivePillarsFinalDataIntegrity.test.ts
src/domain/valuation/__tests__/fivePillarsPeriodRoicIntegrity.test.ts
src/domain/valuation/__tests__/productionFivePillarsRuntime.test.ts
src/domain/valuation/__tests__/systemWideIntegrityInvariants.test.ts
src/domain/valuation/__tests__/verifiedDataCompletionPipeline.test.ts
src/domain/valuation/canonicalQuarterWindow.ts
src/domain/valuation/canonicalRoic.ts
src/domain/valuation/fivePillarsResolver.ts
src/domain/valuation/metricRegistry.ts
src/domain/valuation/peerDiscoveryEngine.ts
src/domain/verifiedFinancialStatements.test.ts
src/domain/verifiedFinancialStatements.ts
src/domain/verifiedKeyIndicators.ts
src/services/sec/fixtures/verified-cross-sector-2026.json
src/services/sec/fixtures/verified-tsla-2026q2.json
src/services/sec/secClient.ts
src/services/sec/secDcfInputs.test.ts
src/services/sec/secDcfInputs.ts
src/services/sec/secDebtResolver.test.ts
src/services/sec/secDebtResolver.ts
src/services/sec/secFilingPresentation.test.ts
src/services/sec/secFilingPresentation.ts
src/services/sec/secFinancialMapper.test.ts
src/services/sec/secFinancialMapper.ts
src/services/sec/secIntegration.ts
src/services/sec/secInvestmentResolver.ts
src/services/sec/secLegacyAdapter.test.ts
src/services/sec/secLegacyAdapter.ts
src/services/sec/verifiedCrossSector.test.ts
src/services/sec/xbrlNormalizer.ts
src/types.ts
src/utils/__tests__/metricCalculations.test.ts
src/utils/__tests__/secFilingDiffEngine.test.ts
src/utils/__tests__/statementAggregation.test.ts
src/utils/financialAiInsights.ts
src/utils/financialDataCoverage.test.ts
src/utils/metricCalculations.ts
src/utils/reportIntegrity.test.ts
src/utils/reportIntegrity.ts
src/utils/reportProvenance.test.ts
src/utils/reportProvenance.ts
src/utils/reportRowShapeBoundary.test.ts
src/utils/reportValidation.test.ts
src/utils/reportValidation.ts
src/utils/statementAggregation.ts
src/utils/statementValidator.ts
src/utils/valuation/__tests__/convictionScorer.test.ts
src/utils/valuation/__tests__/financialStatementsHarmonizer.test.ts
src/utils/valuation/__tests__/statementValidator.test.ts
src/utils/valuation/convictionScorer.ts
src/utils/valuation/dcfMathEngine.ts
src/utils/valuationDecompositionEngine.ts
```

The 49 requested deterministic implementation/quality criteria are supported by the evidence above, within the stated source coverage and safe-unavailability boundaries. This does not certify untested authenticated model generation, universal concept completeness or live deployment.

VERIFIED FINANCIAL STATEMENTS & KEY INDICATORS — REBUILT, PERIOD-TRUE, AND VERIFIED
