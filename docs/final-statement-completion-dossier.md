# Financial statement completion & dynamic verified analyst — engineering dossier

Verification date: 2026-09-28. This dossier describes the incremental completion task; the earlier rebuild is documented in `verified-statements-rebuild.md`.

## Start and final state

- Repository: jamesTumarai/Stock_Ana; branch: main.
- Starting and final HEAD: `8116a1ba58bd5d10829095b57cf083c05dc6030e`.
- Changes remain in the working tree. No commit, push, merge or deployment was performed for this request.
- The 78 pre-existing dirty files from the prior repair were preserved. This task did not pull/reset or discard that work.
- Dependencies, authentication, Firebase project/rules, Section 1, thesis immutability, Research Timeline and cross-sector valuation policies were not redesigned.

## Scope of changes in this task

| Files | Purpose |
| --- | --- |
| `src/domain/selectedFinancialMetric.ts`, `.test.ts` | Metric registry, semantic deltas, source identity and metric-scoped quality/eligibility |
| `src/domain/financialAnalystContract.ts`, `financialSynthesisGuard.ts` | Strict selected-metric schema, numeric validation, accepted observations, deterministic fallback and request generations |
| `server/services/verifiedMetricAnalyst.ts`, `__tests__/verifiedMetricAnalyst.test.ts` | Runtime Gemini model, structured response, timeout and distinct failure reasons |
| `server/routes/metricRoutes.ts` | Independent SEC authority, auth/rate limits, request validation, source-revision guard and bounded successful-response cache |
| `src/services/sec/secStatementCompletion.ts`, `.test.ts` | Inline filing/earnings completion, precision-aware conflict checks, exact CF cash basis and source-search audit |
| `src/services/sec/secForeignStatements.ts` | Separate annual IFRS ingestion in reported currency |
| `src/services/sec/secIntegration.ts` | Relevant primary filings and earnings retrieval; source-backed sector template |
| `src/services/sec/secFinancialMapper.ts`, `secFilingPresentation.ts`, `secLegacyAdapter.ts` | Financing details, debt components and semantically separate reported concepts |
| `src/domain/verifiedFinancialStatements.ts` | Compatible D&A derivation and separate annual IFRS verification contract |
| `src/domain/financialValue.ts`, `src/types.ts`, `src/utils/financialAiInsights.ts` | Optional provenance/completion/analyst metadata; currency contract |
| `src/components/FinancialStatementsTable.tsx` | Shared selected series/deltas, race-safe analyst, honest engine labels and source-correct labels; existing layout retained |
| `src/services/sec/fixtures/verified-completion-2026.json`, `verified-ifrs-annual-2026.json`, `verified-da-components-2026.json` | Public SEC source excerpts and facts for meaningful regression tests |
| This dossier | Evidence, limitations and source-search/N/A appendix |

`run_logs/` contains ignored verification harnesses, local logs and diagnostic packages. These are not production routes, authenticated report substitutes or artifacts to commit. No `.env` values or credentials are included here.

## Remaining data gaps fixed

The completion search now reads relevant primary filing cohorts, not just the latest missing debt cell. It follows bounded SEC earnings-exhibit indices for missing recent EPS/PPE/D&A and missing historical Q4 EPS. Ambiguous archive indices are recorded as unavailable rather than mistaken for a filing. Up to 20 primary cohorts, two candidate earnings filings per missing period, and three exhibits per filing are retrieved; duplicate accession searches are suppressed.

Companyfacts-only mapping is the comparison baseline in the detailed source table below; it is not a claim that every old UI cell was unavailable. Some financing fields were previously absent from the displayed contract even when a native fact was present.

- Q4 GAAP diluted EPS is directly reported in a filed earnings exhibit. Fiscal Q4 EPS is never FY EPS minus YTD EPS.
- Net PPE comes from exact consolidated balance-sheet labels. The original reported concept, including finance-lease ROU composition, is retained. CapEx and lease footnote subtotals cannot substitute for PPE.
- Compatible pure D&A can be derived from same-period reported depreciation plus intangible amortization. The separate MSFT capture proves Derived EBITDA from operating income plus compatible D&A.
- D&A + impairment and D&A + accretion remain separate. They cannot become pure D&A or Derived EBITDA. Issuer Adjusted EBITDA has `ISSUER_REPORTED_NON_GAAP` provenance in a separate sidecar; it does not fill generic EBITDA margin.
- Financing cash flows retain gross issuance, repayments and finance-lease principal separately. Net debt flow requires both gross components. Broad equity issuance cannot masquerade as common-only issuance; combined employee equity/option proceeds cannot masquerade as option proceeds alone. NCI dividends, distributions and explicitly combined redeemable/NCI payouts have separate concepts.
- Beginning and ending CF cash use the same reported cash/restricted-cash/disposal-group basis and exact opening/closing dates. Ordinary balance-sheet cash is not a fallback.
- Filing-label fallback for cash-flow items is restricted to an actual cash-flow statement table. Equity rollforward distributions cannot replace cash distribution amounts.
- XBRL `decimals` defines rounding tolerance for matching detailed companyfacts to rounded note text. The actual FY2025 tax fact of 1,423M matches a 1,420M note reported at 10M precision; the detailed canonical number is retained. A true conflict fails closed with `SOURCE_CONFLICT`.

## Debt semantics

| Quantity | Canonical meaning |
| --- | --- |
| Current debt | Separately reported current debt; not silently renamed debt plus leases |
| Current finance leases | Separately reported finance-lease principal obligation; operating leases are not debt aliases |
| Current debt + finance leases | Directly reported combined current presentation; never add separate leases a second time |
| Noncurrent debt | Separately reported noncurrent interest-bearing debt |
| Noncurrent finance leases | Separately reported noncurrent finance-lease obligation |
| Noncurrent debt + finance leases | Directly reported combined noncurrent presentation |
| Ratio debt | Shared SEC debt resolver's accepted total: source-backed total or compatible component family, same instant/cohort, with exclusions/ambiguities retained. It does not sum every debt-like label |

Missing lease-only/debt-only components stay null when only a combined figure is disclosed. Deposits, operating lease liabilities and total liabilities are not aliases for canonical ratio debt.

## Change semantics

| Type | Treatment |
| --- | --- |
| Money | `(current - comparable prior) / abs(prior) * 100`; zero prior means unavailable, not infinite growth |
| Percent/rate | Absolute percentage-point change, including a valid zero baseline |
| Bank NIM spreads | Level remains percent; delta is percentage-point difference times 100, labelled bps |
| Ratio/multiple | Absolute x difference; no percentage-growth label |
| Days | Absolute days difference |
| Per share | Absolute reported-currency amount per share; EPS is never a money-in-millions flow |
| Instant balances | Compare period-end levels; never sum to TTM |

Comparison periods are located by fiscal quarter ordinal or consecutive FY labels. Missing Q2 does not make Q3 comparable to Q1 in QoQ mode. Calendar, non-calendar and 52/53-week source identities are preserved. Table, chart axis, tooltip, selected headline and analyst consume the same `metricPeriodChanges`/`formatMetricChange` semantics.

## Selected-metric architecture

`FinancialMetricDefinition` contains key, canonical key, unit, value type, change semantic, dependencies, sector applicability and insight eligibility. Native definitions are registered from SEC mapping specs; derived metrics and aliases are explicit.

`SelectedFinancialMetric` contains selected key, reported currency, accepted values/periods, semantic changes, current value, per-metric quality, related accepted series, source URLs and stable data identity.

Flow: tab/row click → `selectedRowKey` → `selectFinancialMetric` → accepted snapshot/derived calculation → same chart/table/analyst context → bounded authenticated API request. Default tab selections are Revenue, Assets, OCF and Gross Margin, but the analyst follows every subsequent selected key. Unknown metrics receive `UNSUPPORTED_METRIC`; they do not silently display Revenue or Gross Margin analysis. Capital Stock does not alias narrower Common Stock.

Raw/mutated legacy arrays are not authority for selected reported values. Missing independent dataset/snapshots yields null. Indicator calculations read accepted snapshots. A globally partial statement does not disable a fully verified local metric. Conflict matching is exact: a `cash_flow` warning does not count as a conflict in the `cash_and_equivalents` asset. Relevant accounting/source conflicts, missing current data, insufficient history, sector non-applicability and approximate methods remain explicit.

## Gemini analyst contract

- Runtime model comes from `GEMINI_FINANCIAL_MODEL`, then `GEMINI_MODEL`, then the provider's `gemini-flash-latest` alias. Provider-returned `modelVersion` is displayed when supplied; the UI has no frozen model-version string.
- Gemini eligibility requires accepted current data, at least two accepted selected periods, applicable sector methodology and no selected conflict/failed guard/approximate methodology. Current-only/approximate explanations remain deterministic and bounded.
- The server independently fetches the SEC package and matches requested actual period labels. Caller accounting values, model names and report prose are not authoritative inputs. A different source identity returns HTTP 409 and requests a report refresh.
- Prompt includes only selected accepted values, semantic deltas, allowed related values, currency, formula/applicability, source links and metric-scoped quality. It does not send the raw report, red flags or independent accounting estimates.
- Required bilingual response: `metricKey`, `synthesis`, `strengths`, `watchouts`, `ruleOfThumb`, `referencedMetricKeys`. Unknown accounting replacement fields, wrong keys, invalid references, malformed/oversized schema and unsupported numeric claims are rejected server-side and again before client rendering.
- Numeric allowlist is selected/related accepted values and supplied deltas, with bounded rounding and million/billion display transformations. Known fiscal period strings are permitted as labels; their year digits are not arbitrary accounting amounts. The model is instructed not to invent numbers, causal explanations, forecasts or universal numeric benchmarks.
- Deadline: 25 seconds; timeout aborts the SDK call. Provider unavailable/rate limit, timeout and invalid response are not reported as missing financial data.
- Fallback reasons: `INSUFFICIENT_VERIFIED_DATA`, `AI_PROVIDER_UNAVAILABLE`, `AI_TIMEOUT`, `AI_VALIDATION_FAILED`, `UNSUPPORTED_METRIC`, `NOT_APPLICABLE`.
- Successful server results only are cached for 15 minutes, bounded to 300 entries. Cache key includes ticker, schema/mapping/context version, all accepted source observations and filing revisions, period set, selected/related values, deltas, language and configured runtime model. `retrievedAt` alone does not invalidate identical facts. Cached success carries actual model metadata exactly like an uncached success.
- Client cache is scoped to selected metric/data/periods/comparison/language. AbortController plus monotonically increasing request generations rejects A-after-B and post-unmount responses. Engine/key/identity/schema/numbers are checked before storing a live result. A new selection immediately shows its own deterministic context/loading state.
- Deterministic definitions/rules/watchouts describe the selected metric; strengths can be empty where none follow from accepted data. The UI explains an empty strengths set instead of manufacturing a moat.

## Truthful UI labels and browser evidence

- Validated accepted Gemini output alone shows **Gemini AI · Live Financial Analyst** and provider runtime model metadata.
- Local fallback/loading/ineligible/failed output shows **Deterministic Financial Analyst** plus quality/fallback reason. It is never branded as Gemini synthesis.
- Actual component browser checks passed Gross Margin → Operating Margin → Revenue → Assets → OCF → ROIC, own titles/values and pp/x/day/per-share units. Source-excerpt harness uses the production component; ticker is blank so it intentionally does not pretend to exercise an authenticated Gemini request.
- Desktop and 390px mobile were checked. A long engine label was found to overflow on mobile and its wrapping was fixed without a layout redesign. End-of-panel scrolling and empty-strength explanations were checked.
- Annual IFRS source view shows FY labels and reported TWD, disables synthetic quarterly selections, preserves IFRS labels and per-share currency. A partial statement is not called completely reconciled.
- Real unauthenticated POST `/api/analyze-metric` returns HTTP 401. Authentication/rate middleware was not bypassed.
- A signed-in saved-report → actual Gemini output browser flow remains unverified. The user was asked to sign in; no authenticated report was made available for that check. Component screenshots are not evidence of that flow.

## Canonical methodology preserved

| Metric | Method and limitation |
| --- | --- |
| ROE | Four compatible standalone quarters of common net income / average compatible beginning-ending common equity, not quarter times four |
| ROA | Canonical TTM total net income / average compatible assets |
| ROIC | Shared `calculateCanonicalRoic`, TTM operating income after accepted tax / compatible average invested capital. Fallback tax or ending-only capital is labelled approximate |
| Invested capital | Compatible equity + canonical debt − cash − short-term investments; no missing STI/debt zero-fill |
| FCF | Accepted OCF − abs(compatible CapEx); bank/insurer generic valuation applicability is guarded |
| Quick Ratio | (Cash + STI + trade receivables) / current liabilities. Inventory or broad trade-and-other receivables are not substituted |
| Equity Ratio | Equity including NCI / total assets; label matches numerator exactly |
| DPO/CCC | COGS-proxy methodology remains labelled approximate; not upgraded to filing-exact |
| TTM flow metrics | Shared four-consecutive-standalone-quarter aggregator. Annual/YTD/instant inputs are not mixed into a TTM sum |

Existing tests cover Section 1 synchronization, current balance-sheet snapshots, TTM invariants, cross-section policy, thesis immutability and timeline behavior. This task does not introduce an independent valuation arithmetic path.

## Cross-sector evidence

| Model | Source-backed regression evidence |
| --- | --- |
| Standard | TSLA completion fixture + MSFT native snapshot assertions |
| SaaS | CRM non-calendar fiscal ends and canonical quarterly revenue |
| Semiconductor | NVDA 52/53-week durations, consecutive quarter TTM |
| Bank/lender | JPM and SOFI banking applicability, deposits/NII and common allocation; industrial ROIC/FCF guards |
| Insurer | PGR insurance template and industry applicability |
| REIT | PLD source-backed SEC SIC 6798 / REIT template and industry metrics; no ticker production override |
| Pre-profit | CRSP signed losses/FCF and unavailable debt kept null |
| Foreign issuer | TSM separate annual IFRS/TWD capture, supported local Revenue/Margin context; no USD relabel or synthetic quarters |

These are captured-source accounting/dynamic-context tests, not successful live Gemini outputs for every company. Foreign annual-only returns needing a four-quarter canonical TTM and USD valuation requiring verified FX remain unavailable with explicit reasons.

## Regression and quality gates

Final gate results are recorded below after completion. Focused suites cover directly reported Q4 EPS, PPE, compatible D&A, impairment/accretion separation, debt and financing/cash-basis semantics, rounded tax notes, equity-table contamination, pp/bps/days/x/per-share changes, six selected metrics, local verification under global partial coverage, mutated/unverified arrays, exact conflict scoping, stale request generations, filing/cache invalidation, malformed/unsupported numeric output, provider failure and timeout.

## Known limitations and completion status

1. Real Gemini generation returned HTTP **503 / UNAVAILABLE** (high demand) for the runtime alias and independently checked available models. No useful real Gemini synthesis was accepted. An unavailable legacy model also returned 404; it was not configured as the fix. Existing background material-news enrichment separately logged HTTP 429 for its own model/quota. Neither failure is labelled a financial-data gap.
2. Numeric/schema validation is deterministic. It cannot independently prove every qualitative natural-language causal claim. The prompt forbids unsupported causality/forecasting; accepted accounting inputs remain immutable.
3. Source retrieval is bounded and SEC-based. The N/A audit reports **retrieved** source paths, not a claim to have exhaustively searched every issuer IR site or unfiled document. Ambiguous layouts, units, entity dimensions, concepts, combined components and missing periods fail closed.
4. IFRS ingestion currently supports compatible SEC annual 20-F/40-F facts in reported currency. It does not manufacture 6-K quarter histories, FX conversions or annualized return ratios. The captured TSM source's latest available period is FY2024; that is not a real-time freshness claim.
5. Production build retains the existing large frontend chunk warning (~3.3MB before gzip). Local Vite reports the pre-existing HMR WebSocket/24678 conflict; HTTP 3002 and component interactions work, and frontend changes were manually reloaded. No unrelated process was killed.
6. Firebase preflight verifies the repository target only. It is not a live Firebase rule deployment or a successful signed-in report test.
7. Final completion criterion 27 (useful real Gemini synthesis) is blocked; live engine-specific prose/strengths/watchouts/rule validation and the complete authenticated browser path cannot be claimed verified. Implementation and injected-provider tests are not substituted for those live proofs.

## Source-backed completion and N/A appendix

The appendix below is generated from the final independently retrieved SEC package. It includes every native mapping metric/period audit, grouped only where the reason and attempted source set are identical. `COMPLETED_VERIFIED` is omitted from the N/A table; source-backed completion facts are listed separately. UI-only unsupported/derived rows additionally use the metric registry or indicator reason, rather than replacing missing values with another metric.

### Final quality gate

| Gate | Result |
| --- | --- |
| Focused regression set | **50 passed, 0 failed, 0 skipped**; financial source/selection/analyst and existing invariant suites |
| Full tests | 122/122 files; **794 passed, 0 failed, 0 skipped** |
| TypeScript lint | Passed (`tsc --noEmit`) |
| Production build | Passed; existing ~3.3MB frontend bundle warning retained |
| Diff whitespace check | Passed |
| Firebase rules preflight | Passed with explicit `--project stock-analyze-a89d0`; repository target only |
| Actual SEC completion | 22 documents / 32 attempts retrieved; no fetch failures, source conflicts or failed accounting guards in the final TSLA package |
| Actual Gemini accepted synthesis | **Blocked: provider HTTP 503** |
| Authenticated saved-report browser flow | Not verified; no signed-in report supplied |

The owned development server was restarted after the final code changes on port 3002. The fresh homepage returned HTTP 200 and the unauthenticated metric endpoint returned HTTP 401. The production component was reloaded and checked at 390×844: selecting Operating Margin showed 1.41%, −2.69 pp YoY, its own formula and watchouts, and the truthful deterministic engine label. The panel remained readable through the bottom of the page. The temporary source-only tab was closed and the viewport override reset. Screenshot: `run_logs/final-statements-mobile.png` (ignored local verification artifact).

### Detailed source-backed facts

Values are canonical USD millions unless EPS. The `before` column means raw companyfacts-only mapping; it is explicitly not a reconstruction of an earlier deployed UI.

| Metric | Period | Raw-only before | Accepted now | Concept / method | Verified source |
| --- | --- | --- | --- | --- | --- |
| income_statement.eps_diluted | Q3 2025 | 0.39 | 0.39 | EarningsPerShareDiluted | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| income_statement.eps_diluted | Q4 2025 | N/A | 0.24 | FiledEarningsTable:GAAPDilutedEPS | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003837/exhibit991.htm) |
| income_statement.eps_diluted | Q1 2026 | 0.13 | 0.13 | EarningsPerShareDiluted | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| income_statement.eps_diluted | Q2 2026 | 0.32 | 0.32 | EarningsPerShareDiluted | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.net_ppe | Q3 2025 | 39407 | 39407 | PropertyPlantAndEquipmentNet | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| balance_sheet.net_ppe | Q4 2025 | N/A | 40643 | us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.net_ppe | Q1 2026 | N/A | 43213 | us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| balance_sheet.net_ppe | Q2 2026 | N/A | 47255 | us-gaap:PropertyPlantAndEquipmentAndFinanceLeaseRightOfUseAssetAfterAccumulatedDepreciationAndAmortization | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.depreciation_amortization_and_impairment | Q3 2025 | N/A | 1625 | tsla:DepreciationAmortizationAndImpairment | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.depreciation_amortization_and_impairment | Q4 2025 | N/A | 1643 | tsla:DepreciationAmortizationAndImpairment | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.depreciation_amortization_and_impairment | Q1 2026 | N/A | 1590 | tsla:DepreciationAmortizationAndImpairment | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.depreciation_amortization_and_impairment | Q2 2026 | N/A | 1619 | tsla:DepreciationAmortizationAndImpairment | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.total_debt | Q3 2025 | N/A | 7702 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| balance_sheet.total_debt | Q4 2025 | N/A | 8376 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.total_debt | Q1 2026 | N/A | 9229 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| balance_sheet.total_debt | Q2 2026 | N/A | 9342 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.current_debt_and_finance_leases | Q3 2025 | N/A | 1924 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| balance_sheet.current_debt_and_finance_leases | Q4 2025 | N/A | 1640 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| balance_sheet.current_debt_and_finance_leases | Q1 2026 | N/A | 1447 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| balance_sheet.current_debt_and_finance_leases | Q2 2026 | N/A | 1418 | tsla:LongTermDebtAndFinanceLeasesCurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| balance_sheet.noncurrent_debt_and_finance_leases | Q3 2025 | N/A | 5778 | tsla:LongTermDebtAndFinanceLeasesNoncurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| balance_sheet.noncurrent_debt_and_finance_leases | Q4 2025 | N/A | 6736 | tsla:LongTermDebtAndFinanceLeasesNoncurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| balance_sheet.noncurrent_debt_and_finance_leases | Q1 2026 | N/A | 7782 | tsla:LongTermDebtAndFinanceLeasesNoncurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| balance_sheet.noncurrent_debt_and_finance_leases | Q2 2026 | N/A | 7924 | tsla:LongTermDebtAndFinanceLeasesNoncurrent | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.debt_issuance | Q3 2025 | 1182 | 1182 | ProceedsFromIssuanceOfDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.debt_issuance | Q4 2025 | 1354 | 1354 | ProceedsFromIssuanceOfDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.debt_issuance | Q1 2026 | 4331 | 4331 | ProceedsFromIssuanceOfDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.debt_issuance | Q2 2026 | 348 | 348 | ProceedsFromIssuanceOfDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.debt_repayments | Q3 2025 | N/A | 669 | us-gaap:RepaymentsOfConvertibleDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.debt_repayments | Q4 2025 | N/A | 748 | us-gaap:RepaymentsOfConvertibleDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.debt_repayments | Q1 2026 | N/A | 3530 | us-gaap:RepaymentsOfConvertibleDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.debt_repayments | Q2 2026 | N/A | 392 | us-gaap:RepaymentsOfConvertibleDebt | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.finance_lease_payments | Q3 2025 | 18 | 18 | FinanceLeasePrincipalPayments | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.finance_lease_payments | Q4 2025 | 19 | 19 | FinanceLeasePrincipalPayments | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.finance_lease_payments | Q1 2026 | 18 | 18 | FinanceLeasePrincipalPayments | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.finance_lease_payments | Q2 2026 | 19 | 19 | FinanceLeasePrincipalPayments | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.distributions_to_noncontrolling_interests | Q3 2025 | 20 | 20 | PaymentsToMinorityShareholders | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.distributions_to_noncontrolling_interests | Q4 2025 | 22 | 22 | PaymentsToMinorityShareholders | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.distributions_to_noncontrolling_interests | Q1 2026 | 70 | 70 | PaymentsToMinorityShareholders | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.distributions_to_noncontrolling_interests | Q2 2026 | 21 | 21 | PaymentsToMinorityShareholders | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |
| cash_flow.equity_compensation_and_option_proceeds | Q3 2025 | 512 | 512 | ProceedsFromIssuanceOfSharesUnderIncentiveAndShareBasedCompensationPlansIncludingStockOptions | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm) |
| cash_flow.equity_compensation_and_option_proceeds | Q4 2025 | 146 | 146 | ProceedsFromIssuanceOfSharesUnderIncentiveAndShareBasedCompensationPlansIncludingStockOptions | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm) |
| cash_flow.equity_compensation_and_option_proceeds | Q1 2026 | 361 | 361 | ProceedsFromIssuanceOfSharesUnderIncentiveAndShareBasedCompensationPlansIncludingStockOptions | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm) |
| cash_flow.equity_compensation_and_option_proceeds | Q2 2026 | 107 | 107 | ProceedsFromIssuanceOfSharesUnderIncentiveAndShareBasedCompensationPlansIncludingStockOptions | [verified](https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm) |

The final CF cash basis is `CASH_AND_RESTRICTED_CASH_INCLUDING_DISPOSAL_GROUP`.

| Period | Opening date | Beginning | Closing date | Ending | Change |
| --- | --- | --- | --- | --- | --- |
| Q3 2025 | 2025-06-30 | 16735 | 2025-09-30 | 19584 | 2849 |
| Q4 2025 | 2025-09-30 | 19584 | 2025-12-31 | 17616 | -1968 |
| Q1 2026 | 2025-12-31 | 17616 | 2026-03-31 | 17655 | 39 |
| Q2 2026 | 2026-03-31 | 17655 | 2026-06-30 | 16425 | -1230 |

### Selected metric evidence on the final full-filing package

| Selection | Current accepted value | Quality | Live-AI eligible |
| --- | --- | --- | --- |
| gross_margin | 16.83 | DERIVED_FROM_VERIFIED | true (local inputs accepted) |
| operating_margin | 1.41 | DERIVED_FROM_VERIFIED | true (local inputs accepted) |
| revenue | 28236 | DERIVED_FROM_VERIFIED | true (local inputs accepted) |
| total_assets | 148524 | VERIFIED | true (local inputs accepted) |
| ocf | 4697 | DERIVED_FROM_VERIFIED | true (local inputs accepted) |
| roic | 6.45 | DERIVED_FROM_VERIFIED | true (local inputs accepted) |

ROIC values use the shared formula even where earlier selected history contains an approximate tax/capital basis. The current final full-filing ROIC is 6.45%, derived from operating income TTM 4,372M, average invested capital 50,214M and accepted TTM effective tax rate. It was not changed to an independently calculated UI formula.

### Native persistent N/A — all captured periods

There are 1116 audited native metric/period cells. Grouping preserves every period and reason. Source paths include the metric-specific SEC companyfacts search and the retrieved documents/indices listed below. Missing disclosure is not zero. Combined D&A/equity proceeds are not separable without an explicit compatible source.

| Metric | Periods with this reason | Reason code | Attempted source paths |
| --- | --- | --- | --- |
| balance_sheet.cash_and_restricted_cash | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.cash_and_restricted_cash; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.interest_income | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.interest_income; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.accrued_and_other_current_liabilities | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.accrued_and_other_current_liabilities; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.option_exercise_proceeds | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | COMBINED_EQUITY_OPTION_PROCEEDS_NOT_SEPARABLE | SEC companyfacts/cash_flow.option_exercise_proceeds; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.exchange_rate_effect | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.exchange_rate_effect; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.change_payables | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.change_payables; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.eps_diluted | Q1 2024, Q2 2024, Q4 2024 | SOURCE_CONFLICT | SEC companyfacts/income_statement.eps_diluted; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.goodwill | Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.goodwill; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.long_term_debt_and_finance_leases | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.long_term_debt_and_finance_leases; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.depreciation | Q3 2023 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.depreciation; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.depreciation | Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | COMBINED_IMPAIRMENT_COMPONENT_NOT_SEPARABLE | SEC companyfacts/cash_flow.depreciation; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.depreciation_amortization_and_accretion | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.depreciation_amortization_and_accretion; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.depreciation_amortization_and_impairment | Q3 2023 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.depreciation_amortization_and_impairment; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.amortization_of_intangibles | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.amortization_of_intangibles; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.dividends_paid | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.dividends_paid; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.repurchase_of_common_stock | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.repurchase_of_common_stock; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.issuance_of_common_stock | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | COMBINED_EQUITY_OPTION_PROCEEDS_NOT_SEPARABLE | SEC companyfacts/cash_flow.issuance_of_common_stock; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.equity_issuance_proceeds | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.equity_issuance_proceeds; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.debt_repayments | Q3 2023 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.debt_repayments; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.dividends_to_noncontrolling_interests | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.dividends_to_noncontrolling_interests; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.distributions_to_noncontrolling_and_redeemable_interests | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.distributions_to_noncontrolling_and_redeemable_interests; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| cash_flow.other_financing | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/cash_flow.other_financing; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.net_interest_income | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.net_interest_income; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.non_interest_income | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.non_interest_income; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.provision_for_credit_losses | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.provision_for_credit_losses; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.net_interest_margin_pct | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.net_interest_margin_pct; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.deposits | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.deposits; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.loans_held_for_investment | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.loans_held_for_investment; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.tier1_capital_ratio | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.tier1_capital_ratio; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.cet1_ratio | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.cet1_ratio; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.ffo | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.ffo; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.noi | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.noi; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.rental_revenue | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.rental_revenue; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.combined_ratio_pct | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.combined_ratio_pct; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| income_statement.net_premiums_earned | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/income_statement.net_premiums_earned; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |
| balance_sheet.loss_reserve | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | NOT_DISCLOSED_IN_RETRIEVED_SOURCES | SEC companyfacts/balance_sheet.loss_reserve; S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34, S35, S36, S37, S38, S39, S40, S41, S42, S43, S44, S45, S46, S47, S48, S49, S50, S51, S52, S53, S54 |

### Additional derived / legacy field N/A

For rows outside the native source mapping, these are the selected-metric reason codes, not guessed replacements. The selected metric cannot become eligible merely because some other row has data.

| Metric | Unavailable captured periods | Reason |
| --- | --- | --- |
| investment_securities | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| loans_held_for_sale | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| available_for_sale_securities | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| tax_payable | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| capital_stock | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| provision_addback | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| non_cash_items | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| change_in_loans_held_for_sale | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| investment_purchase | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| other_investing | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| change_in_deposits | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| debt_issuance_payments | Q3 2023 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| change_working_capital | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| change_other_ca | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| change_other_cl | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | UNSUPPORTED_METRIC: no independently verified mapping |
| ebit_margin | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| ebitda_margin | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| roe | Q3 2023, Q4 2023, Q1 2024, Q2 2024 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| roa | Q3 2023, Q4 2023, Q1 2024, Q2 2024 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| roic | Q3 2023, Q4 2023, Q1 2024 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| asset_turnover | Q3 2023, Q4 2023, Q1 2024, Q2 2024 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| inventory_turnover | Q3 2023, Q4 2023, Q1 2024, Q2 2024 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| dso | Q3 2023 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| dio | Q3 2023 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| dpo | Q3 2023 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| ccc | Q3 2023 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| nim | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| deposit_growth | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |
| loan_deposit_ratio | Q3 2023, Q4 2023, Q1 2024, Q2 2024, Q3 2024, Q4 2024, Q1 2025, Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026 | Compatible accepted inputs / meaningful denominator unavailable; sector applicability applies. |

### Attempted SEC source paths

Companyfacts is fetched from the SEC XBRL companyfacts endpoint for the source CIK and mapped metric; the paths below are the actual filing/exhibit/index retrieval audit. `retrieved` describes retrieval, not that every table discloses every metric.

- **S1**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm [retrieved]
- **S2**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm [retrieved]
- **S3**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm [retrieved]
- **S4**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm [retrieved]
- **S5**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025035806/tsla-20250630.htm [retrieved]
- **S6**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025018911/tsla-20250331.htm [retrieved]
- **S7**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025003063/tsla-20241231.htm [retrieved]
- **S8**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024043486/tsla-20240930.htm [retrieved]
- **S9**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024032662/tsla-20240630.htm [retrieved]
- **S10**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024017503/tsla-20240331.htm [retrieved]
- **S11**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024002390/tsla-20231231.htm [retrieved]
- **S12**: https://www.sec.gov/Archives/edgar/data/1318605/000162828023034847/tsla-20230930.htm [retrieved]
- **S13**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025045861/index.json [retrieved]
- **S14**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025045861/exhibit991.htm [retrieved]
- **S15**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025043530/index.json [retrieved]
- **S16**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025043530/exhibit991111.htm [retrieved]
- **S17**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026003837/index.json [retrieved]
- **S18**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026003837/exhibit991.htm [retrieved]
- **S19**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026000016/index.json [retrieved]
- **S20**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026000016/exhibit9914.htm [retrieved]
- **S21**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026026551/index.json [retrieved]
- **S22**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026026551/exhibit991.htm [retrieved]
- **S23**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026022956/index.json [retrieved]
- **S24**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026022956/exhibit9911111.htm [retrieved]
- **S25**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026049213/index.json [retrieved]
- **S26**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026049213/exhibit991.htm [retrieved]
- **S27**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026046717/index.json [retrieved]
- **S28**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026046717/exhibit99111111.htm [retrieved]
- **S29**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025002993/index.json [retrieved]
- **S30**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025002993/exhibit991.htm [retrieved]
- **S31**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025000007/index.json [retrieved]
- **S32**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025000007/exhibit991.htm [retrieved]
- **S33**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026049270/tsla-20260630.htm
- **S34**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026026673/tsla-20260331.htm
- **S35**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026003952/tsla-20251231.htm
- **S36**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025045968/tsla-20250930.htm
- **S37**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025035806/tsla-20250630.htm
- **S38**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025018911/tsla-20250331.htm
- **S39**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025003063/tsla-20241231.htm
- **S40**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024043486/tsla-20240930.htm
- **S41**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024032662/tsla-20240630.htm
- **S42**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024017503/tsla-20240331.htm
- **S43**: https://www.sec.gov/Archives/edgar/data/1318605/000162828024002390/tsla-20231231.htm
- **S44**: https://www.sec.gov/Archives/edgar/data/1318605/000162828023034847/tsla-20230930.htm
- **S45**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025045861/exhibit991.htm
- **S46**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025043530/exhibit991111.htm
- **S47**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026003837/exhibit991.htm
- **S48**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026000016/exhibit9914.htm
- **S49**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026026551/exhibit991.htm
- **S50**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026022956/exhibit9911111.htm
- **S51**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026049213/exhibit991.htm
- **S52**: https://www.sec.gov/Archives/edgar/data/1318605/000162828026046717/exhibit99111111.htm
- **S53**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025002993/exhibit991.htm
- **S54**: https://www.sec.gov/Archives/edgar/data/1318605/000162828025000007/exhibit991.htm

### Final completion decision

Deterministic implementation, source completion, UI component interactions, regression gates and provider-failure handling are verified. The required real useful Gemini synthesis and full authenticated rendering path are not verified. The requested all-criteria completion line would therefore be inaccurate.

BLOCKED: Gemini generation returned HTTP 503 / UNAVAILABLE (high demand); no accepted real synthesis or authenticated report-to-Gemini browser proof is available.
