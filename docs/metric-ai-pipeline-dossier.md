# Dynamic Gemini Financial Analyst — verification dossier

Date: 2026-09-29. Scope: selected-metric request/response handling, model policy,
diagnostics, and rendering. Existing accounting calculations and UI layout are
unchanged by this repair.

## Observed failure and root cause

- The baseline `gemini-flash-latest` call returned provider HTTP **503**. Later
  calls returned **429**. These are genuine upstream availability/quota failures.
- The old frontend/provider code collapsed several unrelated errors into
  `AI_PROVIDER_UNAVAILABLE`, preventing accurate diagnosis.
- A supported alternate alias, `gemini-flash-lite-latest`, returned a real
  structured response after approximately 30–40 seconds. A 20–25 second timeout
  could discard such a response. An earlier response also failed strict schema
  validation; the final schema constrains metric/reference keys and explicitly
  requires bilingual status fields.
- The baseline request was already compact: **186 UTF-8 bytes**, not the whole
  statement object. A realistic statement fixture is **5,242,052 bytes**. There
  is no evidence that payload size caused the observed baseline provider 503.
- The new allowlisted request includes explicit verified comparison context:
  **2,114 bytes** for the fixture probe and **2,181 bytes** in the authenticated
  browser Revenue request. Both are below the **32 KiB** guard.

## Final contract and authority

`buildMetricAiRequest` sends identity, ticker/company labels, selected metric
definition, current/history values, supplied changes, a small dependency list,
business archetype, language, and comparison mode. It never sends statement
trees, raw SEC facts, provenance trees, drafts, history or model IDs.

The server authenticates Firebase tokens, applies the user rate limiter,
re-fetches accepted SEC data and checks the data identity and supplied values.
Client numbers/classification never become accounting authority. Global partial
coverage still permits a sufficiently verified selected metric. Existing
sector/approximation/conflict eligibility rules are preserved.

The provider receives immutable selected/dependency values, units, supplied
change semantics and an explicit YoY/QoQ basis. Definitions stay deterministic.
Raw/fenced JSON is parsed, strict bilingual schema/reference keys are validated,
then the existing rounding/unit-conversion numeric allowlist is applied.
No accounting value is accepted from model output.

## Model policy and boundaries

- One server policy resolves `GEMINI_FINANCIAL_MODEL`, then `GEMINI_MODEL`, then
  the existing default `gemini-flash-latest`.
- At most one explicit `GEMINI_FINANCIAL_FALLBACK_MODEL` is attempted. Local
  configuration uses `gemini-flash-lite-latest`; actual successful response
  metadata resolved it to `gemini-3.5-flash-lite`.
- Retry is bounded to that one configured alternate for model/provider errors,
  timeout or provider model quota. Application user rate limits are never retried.
  Malformed/empty/schema/numeric-invalid responses are never retried as another
  model or cached as successes.
- Total provider budget is 65 seconds: when an alternate exists the first
  attempt gets up to 20 seconds and the alternate gets the remaining budget.
  Selection cancellation interrupts immediately even if a mock provider ignores
  the signal. SEC retrieval time is separate. Existing Vercel route budget is
  300 seconds; no global body limit was increased.
- Health exposes only `metricAiConfigured` and `metricAiProvider: Gemini`.
  Model configuration and API keys are server-owned; `.env` remains ignored.
  Deployment needs the same fallback environment setting to use the alternate.

## Error and state behavior

Request/size/auth/rate/configuration/source/model/timeout/provider/empty/JSON/
schema/numeric/stale/data-eligibility errors have separate codes. HTTP 413, 401,
429 and malformed gateway bodies cannot become a generic provider outage.
Fallback text is compact and its tooltip preserves the diagnostic code.

Every success must match request ID, metric key, financial identity and
`selected-verified-metric-v3:analyst-v3`. AbortController plus generation guards
prevent late results from replacing the current selection. Both caches hold
validated successes only and include data, periods, selected/dependency values,
changes, language and context version. Loading starts at request dispatch and
clears when the current request completes. Only accepted current output gets
the `Gemini AI · Live Financial Analyst` badge.

## Verification evidence

- Focused suite: compact multi-megabyte fixture; UTF-8 bytes; local oversized
  block; actual Express-parser 413 and contract 413; authenticated HTTP 200;
  401/429; missing key; source outage; empty/raw/fenced/malformed JSON; schema and
  fabricated-number rejection; success-only cache; configured fallback; bounded
  exhausted quota; provider timeout/cancellation; delayed Revenue versus
  Operating Margin; global partial coverage and metric-scoped applicability.
- Full regression gate: **125 files, 825 cases passed**, zero failures/skips.
- `npm run lint`, `npm run build`, `git diff --check`: passed. Build retains the
  existing warning about chunks above 500 kB.
- Browser proof uses the real `FinancialStatementsTable`, signed-in Firebase
  session, live `/api/sec-preview` source, real authenticated metric route and
  actual Google provider; no report is written. The development-only harness
  captures safe Fetch response metadata plus corresponding server diagnostics.
  This is real HTTP evidence, not a mocked success. The available browser tool
  does not expose a DevTools Network panel, so that panel was not claimed as
  manually inspected.
- Confirmed live successful response: request
  `4273f698-9c79-402b-8a81-cefd87a0d1f2`, **2,181 bytes**, HTTP **200**,
  `success=true`, schema/numeric checks passed, resolved model
  `gemini-3.5-flash-lite`; the UI visibly replaced deterministic fields with
  Gemini synthesis, strengths, watchouts and benchmark.
- Final context-v3 browser proof: Operating Margin request
  `933e7056-611c-403d-9487-188d3c0df190`, **2,212 bytes**, HTTP **200**,
  `success=true`, model `gemini-3.5-flash-lite`. The primary returned 429 and the
  configured alternate succeeded. A pending Gross Margin request was aborted
  with `AI_STALE_REQUEST_DISCARDED` on the switch; it did not replace Operating
  Margin. The current UI showed **1.41%** and **−2.69 pp YoY**, synthesis,
  strengths, watchouts and benchmark with no remaining loading badge.
  This final alternate call took **64,490 ms** (total HTTP time **68,614 ms**
  including source retrieval); provider latency was variable throughout the
  session. The timeout is bounded and does not guarantee a quick upstream reply.
- Desktop and 390×844 mobile views were inspected, console error/warning capture
  was empty, and the temporary viewport was reset. Screenshots:
  `run_logs/metric-ai-live-proof.png` and `run_logs/metric-ai-mobile-proof.png`.
- Further live calls verified exact quota/timeout fallback behavior and cleared
  loading. Provider availability remains an upstream dependency, not a promise
  that every live call will succeed.

Development captures and logs are ignored under `run_logs/`. User report data
and existing working-tree changes were preserved. No commit, push or deployment
was performed for this request.

DYNAMIC GEMINI FINANCIAL ANALYST — REQUEST/RESPONSE PIPELINE VERIFIED

## Deep interpretation follow-up

The former prompt capped synthesis at two to four sentences. It encouraged
describing the table instead of explaining business economics. The replacement
asks for three connected paragraphs: meaning, current observation and trend,
then accepted financial relationships and investor implications. It targets
approximately 120–220 Thai words only when context supports that depth.

Strengths must explain an economic benefit, may be empty, and cannot merely
repeat positive figures. Watchouts specify a relationship to check next;
rules of thumb remain conditional on the business model. Price, volume, mix,
working-capital components and competitive advantages are not presumed when
they are absent from the supplied context.

The prompt includes existing sector, industry and caveats, plus separate
canonical units for each accepted related metric. `M` explicitly means millions
of the supplied currency, including when the selected metric itself is a ratio.
This adds presentation metadata without changing any accounting inputs.

Live inspection also found unsigned decline wording: the source supplied
`-2.69 pp`, while the model wrote a decrease of `2.69 pp`. The original numeric
guard correctly rejected it. Instructions now favor qualitative interpretation
over repeated table figures and require exact signs and period labels whenever
numbers are used. The guard was not relaxed and rejected responses still fall
back with their original reason.

The shared analyst context/cache version is now `analyst-v4`, preventing reuse
of terse synthesis. The renderer preserves paragraph and watchout line breaks.
The response shape and validation, verified source resolution, selected-metric architecture,
numeric allowlist, provider policy, cancellation and deterministic fallback are
unchanged. Regression coverage includes multiline bilingual output, empty
strengths, rejected invented figures, signed changes and related-metric units
for a different currency. Development probes remain ignored in `run_logs/`.

Follow-up verification:
- Full regression gate: 125 files / 830 cases passed, zero failures or skips.
- Final focused analyst/client/HTTP/selection suites: 37 cases passed.
- TypeScript lint, production build and `git diff --check` passed. The existing
  frontend chunk-size warning remains.
- Authenticated live Operating Margin request
  `10f3586d-7689-40e7-b630-dd98885f76f5`: 2,209 bytes, HTTP 200, engine GEMINI,
  model `gemini-3.5-flash-lite`. The UI rendered three synthesis paragraphs,
  no forced strengths, specific watchouts and a business-aware rule of thumb.
- Revenue also returned HTTP 200 through the real authenticated API and rendered
  its distinct selected-metric synthesis. Primary-model quota errors and rejected
  numeric claims retained their original bounded fallback behavior.
- Desktop proof: `run_logs/deep-analyst-final-desktop.png`. Responsive proof used
  the actual component in a 390×844 same-origin iframe: its synthesis was 259 px
  wide with 259 px scroll width and three preserved paragraphs. Captures:
  `run_logs/deep-analyst-mobile-layout.json` and
  `run_logs/deep-analyst-final-mobile.png`. The browser viewport override did not
  apply to the hidden tab, so this was an iframe layout check, not device emulation.
  Desktop console capture was empty. The iframe automation emitted a
  MutationObserver error; this is recorded separately from the successful API
  and layout checks, rather than claiming an entirely clean mobile console.

## Rich metric meaning follow-up

The verified analyst contract previously contained synthesis but no educational
meaning fields. Rendering therefore retained a local metric title or formula,
even when Gemini analysis succeeded. The contract now requires `what_is_it_th`
and `what_is_it_en`; the renderer gives these resolved fields precedence over the
local definition. The existing component layout is unchanged.

`financialMetricMeaning.ts` supplies bilingual educational metadata for every
currently selectable registry metric, including aliases and sector measures.
The provider receives the canonical name, definition, existing formula/period
methodology, business archetype and registry dependency keys. These are semantic
metadata: they never calculate, replace or persist new financial facts. Cash
reconciliation balances retain their restricted-cash basis and are distinct from
cash equivalents, cash plus investments and net cash.

Meaning validation checks length, substance beyond the title, selected-metric
English or trusted Thai naming, generic-label patterns and the existing numeric
allowlist. An invalid or absent meaning is replaced per language with the rich
canonical definition, without another provider request or losing valid synthesis.
Other fields still pass the exact schema and original numeric/reference checks.
Accounting replacement fields and stale request identities remain rejected. The
request/cache context version is now `analyst-v5`, preventing old terse responses
from being reused. Development diagnostics record only provider/canonical field
origin, never prompts, authentication tokens or private data.

Verification includes Revenue, Operating Margin, OCF, Total Assets, Current Ratio
and ROIC, canonical formula/selection immutability, distinct meanings on switching,
Thai naming, title-only/empty/malformed/unsupported-number repair, independent
language precedence, all registry definitions, financial-sector applicability
and restricted-cash terminology. Regression logs are ignored in `run_logs/`.

Live proof used the actual component, authenticated API and SEC source adapter:
- Revenue: request `f1b46647-b4ff-4c8e-adae-4d077591f752`, 2,178 bytes,
  HTTP 200, model `gemini-3.5-flash-lite`; both meanings came from the provider.
- Operating Margin: request `9874c83b-6700-44a0-bea7-b8779d0d2fdf`, 2,209 bytes,
  HTTP 200, same actual model; both meanings came from the provider and replaced
  the previous metric's explanation. Primary-model quota errors followed the
  existing configured single alternate-model policy.
- Captures: `run_logs/metric-meaning-revenue-desktop.png`,
  `run_logs/metric-meaning-margin-desktop.png`,
  `run_logs/metric-meaning-live-network.json`.
- Responsive layout: actual component in a 390 px same-origin iframe, meaning
  box width and scroll width both 258 px, height 200 px; full text wrapped without
  horizontal overflow. This is a breakpoint layout check, not device emulation.
  Evidence: `run_logs/metric-meaning-mobile-layout.json`. Desktop console was clean.
- Lint and production build passed; the existing bundle-size warning remains.
  Final full regression gate: 126 files / 844 cases passed, zero failures or skips.
  Final regression evidence is `run_logs/metric-meaning-verified-regression.log`.
  The local server was restarted and the main localhost:3002 tab refreshed.

## Beginner-first meaning follow-up (2026-09-29)

The canonical meaning registry now includes bilingual educational metadata:
plain definition, what the metric measures, conditional general interpretation,
and relevant companion metrics. Curated definitions cover the requested income,
cash-flow, balance-sheet, return, turnover and sector-specific metrics. Existing
accounting-line definitions retain their scope, with explicit teaching sections
and cautious direction guidance. All prose is independent of current company
figures; cash, debt, shareholder attribution and restricted-cash scopes remain
distinct. AFFO, Occupancy, Cash Burn and Runway educational entries do not make
unsupported observations selectable or eligible for AI, and introduce no formulas.

Gemini keeps the same ten-field contract and verified selected-metric context.
Its teaching fields must include the three section labels after a plain definition.
Validation repairs short, circular, unrelated, jargon-first or incomplete meanings
per language; current company numbers are excluded even when they would be allowed
in synthesis. The opening definition must identify the selected subject: naming
Revenue only as a companion cannot qualify a Gross Margin definition. Existing
schema, numerical, source, period, sector, request-size and cancellation guards
remain intact.

Synthesis begins with the company condition instead of teaching the metric again.
An obvious leading textbook definition is trimmed only after the complete original
response passes numeric validation. Mixed paragraphs retain their current-condition
suffix; definition-only responses use the existing honest deterministic fallback.
Meaning labels preserve line breaks in the existing box, with no layout redesign.
Cache context is `analyst-v6` so an old brief explanation cannot be reused.

Verification:
- Focused gate: 57 cases passed. All nine requested metrics have four teaching
  ideas, distinct meanings on switching, no company figures, and separate synthesis.
  Additional regressions cover stale full definitions, allowed-but-misplaced
  numbers, circular teaching, sector applicability, unsupported eligibility,
  company-first prose and numeric validation before trimming.
- Full regression gate: 126 files / 850 cases passed, zero failures or skips.
  `npm run lint`, `npm run build` and `git diff --check` passed. The existing
  greater-than-500-kB build warning remains; no warning was suppressed.
- Live Revenue: authenticated request `66ed3b48-b12b-4d99-840a-f85be110752b`,
  2,178 bytes, HTTP 200, actual model `gemini-3.5-flash-lite`. Both teaching
  languages passed directly from the provider.
- Live Operating Margin: authenticated request
  `0fb342ec-6d07-40a9-b7b2-60ce222aa005`, 2,209 bytes, HTTP 200, same model,
  both teaching languages provider-sourced. Switching immediately replaced
  Revenue teaching with Operating Margin teaching during loading, then accepted
  the corresponding Gemini result. Primary-model 429s used the existing single
  configured alternate, without changing model policy or weakening validation.
- Both runs used the actual FinancialStatementsTable and independently fetched
  SEC statements through the authenticated API; no report was saved. Current
  missing/partial accounting coverage notices remain visible.
- Responsive check used the actual component in a 390-px same-origin iframe
  (a layout check, not device emulation): meaning width and scroll width both
  258 px; height about 357 px; all four ideas wrap and remain visible. Desktop
  and narrow-layout browser error/warning logs were empty.
- Ignored evidence: `run_logs/beginner-meaning-focused.log`,
  `run_logs/beginner-meaning-regression.log`, `run_logs/beginner-meaning-lint.log`,
  `run_logs/beginner-meaning-build.log`, `run_logs/beginner-meaning-server.log`,
  `run_logs/beginner-meaning-live-network.json`,
  `run_logs/beginner-meaning-mobile-layout.json`, and desktop/mobile PNG captures.
  The local server was restarted on port 3002 with the current server code.
