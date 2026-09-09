---
name: lumina-development
description: Develop, audit, debug, and verify Stock_Ana / COIN KING Lumina, an AI-powered US equity research app. Use for React/TypeScript UI, Express APIs, Gemini prompts/streaming, financial statements, valuation, Firebase history, data integrity, tests, and production hardening in this repository. Do not use for standalone stock research or unrelated projects.
---

# Lumina Development Skill

Lumina is a personal US-equity research system under COIN KING. Its product principle is:

> **Verified data -> deterministic validation/calculation -> AI interpretation -> explainable report.**

AI analyzes data; AI is not the database. Read root `AGENTS.md` before editing. Use this skill as the project-specific execution checklist.

## 1. Non-negotiable financial integrity

Apply these rules to every change touching financial data, prompts, valuation, reports, or history:

- **Missing means missing.** Never replace unavailable financial data with plausible defaults, zero, peer placeholders, current-price multipliers, synthetic holders, ratings, analyst counts, targets, dates, or scores.
- In canonical financial data, distinguish a real `0` from missing `null`/`undefined`. Do not use `0` as an unavailable sentinel.
- Calculations that require missing or invalid critical inputs must **fail closed** and return unavailable/invalid state rather than a credible-looking number.
- AI may propose/explain assumptions, but deterministic code must perform DCF, ratios, scoring, portfolio math, and validation whenever possible.
- Production prompts must contain **rules, retrieval instructions, and null-shaped schema examples**, not ticker-specific current prices, market caps, quarterly results, analyst estimates, valuation ranges, or other facts that can become stale and anchor the model.
- Never instruct AI to reconstruct a missing quarter from a trend. Retrieve and verify the exact period; if it cannot be verified, leave it unavailable and flag incomplete history.
- Never claim a source is SEC/XBRL/verified merely because numbers pass arithmetic checks. Provenance must come from actual source metadata.
- Keep reported, derived, and estimated values conceptually distinct. Do not present a derived or estimated figure as reported.
- Track fiscal period, period end, currency, units, per-share basis, provider/source, and as-of/retrieval time whenever the data model supports them.
- Distinguish current/basic shares outstanding, diluted weighted-average shares, and fully diluted shares. Do not silently substitute one for another in valuation.

## 2. Work from the real pipeline

Before editing a financial flow, trace the actual producer and consumers. Typical current path:

`server.ts / agent instructions -> streamed model output -> JSON extraction/parsing -> report normalization/validation -> valuation -> React report -> Firebase History`

Do not assume `overview.md` is perfectly current. Inspect implementation first.

When changing a field or behavior, check all affected layers:

- prompt / agent instruction
- extraction / parsing
- runtime validation
- `src/types.ts`
- normalization / harmonization
- statement validation
- valuation / scoring
- UI rendering and print/PDF
- Firebase persistence / legacy history
- tests

## 3. Validation boundary

Treat all AI/network/provider output as untrusted input.

- Prefer runtime schemas for financial-critical payloads; TypeScript interfaces alone are not runtime validation.
- Validate numeric types, nullability, finite numbers, periods, units, currency, required valuation inputs, and critical cross-section consistency.
- Use severity such as `info`, `warning`, and `critical` when the architecture supports it.
- A critical issue should block only dependent calculations/sections where possible, not fabricate a replacement or unnecessarily destroy the whole report.
- Existing deterministic validators should be wired into the production path before creating duplicate validation logic.
- Check cross-section conflicts such as current price, revenue/FCF inputs, shares, fiscal periods, currencies, DCF outputs, and summary text that quotes valuation values.

## 4. Valuation rules

For valuation-related work:

- Use one explicit source of truth for each market/financial input.
- DCF requires valid revenue, FCF, cash, debt, shares, WACC, terminal growth, and scenario assumptions according to the engine contract.
- Enforce `terminal growth < WACC` for perpetual-growth DCF and reject NaN/Infinity/impossible denominators.
- Relative valuation must use real identified peers and observed/verified multiples. No `PEER_1`, default medians, or `currentPrice * multiplier` fair values.
- Visualization-only chart bounds may derive from current price if clearly presentation-only and never reused as valuation output.
- If a model is not valid for the company or inputs are insufficient, mark the model unavailable rather than forcing an answer.

## 5. AI prompt and explanation rules

Lumina should explain finance simply without inventing facts.

For metric/event explanations, prefer:

`What happened? -> What does it mean? -> Why does it matter? -> Positive/Neutral/Caution/Negative/Insufficient data -> Compared with what? -> What to watch next?`

- Contextual AI should receive a small structured verified context for the clicked metric/card whenever possible.
- Do not make high/low automatically good/bad; compare with history, peers, growth, balance sheet, sector, and business context.
- Keep statuses nuanced: Positive, Neutral, Caution, Negative, Insufficient data.
- Never advertise Lumina as an AI that guarantees what to buy. It is an explainable equity-research and decision-support platform.

## 6. Firebase History and production data safety

User history may contain valuable long-lived reports. Treat saved data as persistent production data.

- Never delete, rewrite, migrate, or overwrite historical reports silently.
- Prefer backward-compatible reads and explicit `schemaVersion` / `generatedByVersion` metadata when adding versions.
- Reports created before integrity validation should be treated as legacy/unverified when they cannot be proven compliant; recommend re-analysis rather than silently changing historical values.
- Keep immutable report snapshots where feasible. Large future schema changes require an explicit migration plan and rollback path.
- Do not change Firebase project, rules, ownership semantics, or production collections just to make local testing easier.
- Separate code deployment from data migration. A normal deploy must not imply destructive database changes.

## 7. API, auth, filesystem, and secrets

- `GEMINI_API_KEY` is server-only. Keep it in environment or a gitignored `.env`; never place it in frontend `VITE_*`, source code, tests, screenshots, logs, artifacts, prompts returned to users, or Git history.
- Never commit `.env`, credentials, service-account material, tokens, `run_logs/`, generated artifacts, `node_modules/`, or `dist/`.
- Validate API inputs at boundaries, especially ticker, URLs, filenames/paths, body sizes, model identifiers, and financial payloads.
- For user-bearing/cost-bearing endpoints, preserve or add authentication, authorization, and rate limits according to the current phase; never weaken security to make a test pass.
- File routes must sanitize names and ensure resolved paths remain inside the intended directory. Production logs must not expose prompts, provider responses, reports, or secrets publicly.

## 8. UI / brand constraints

- Preserve the current COIN KING / Lumina identity unless the user explicitly requests a redesign.
- Lumina remains US-equity focused. Do not mix Aurum/XAU, Satoshi/BTC, Edge journal, or Command Center features into the stock report unless integration is explicitly requested.
- Data clarity beats decoration: show unavailable/invalid states visibly, preserve source/as-of context, and avoid making uncertain data look precise.
- Motion must not block usage and should respect `prefers-reduced-motion`.
- Maintain desktop/mobile usability and print/PDF behavior when touching report components.

## 9. Phase-aware execution

Do not jump ahead because a later idea looks useful. Respect the requested phase/checkpoint.

Typical foundation order:

1. remove fabricated fallbacks and stale prompt anchors
2. runtime schemas, systematic nullability, statement/cross-section validation
3. canonical verified data/providers, source provenance, live market snapshot, deterministic valuation integrity
4. auth/rate limits/filesystem hardening/backend maintainability/CI/data safety
5. feature expansion such as Thesis Tracker, What Changed, Watchlist Intelligence, Reverse DCF, Portfolio Risk, alerts, contextual AI
6. UI/motion polish after the financial foundation is stable

If the user asks for a bounded phase, finish it, run verification, summarize, and stop before the next phase.

## 10. Editing workflow

1. Locate repository root; do not hardcode the owner's Windows path.
2. Inspect `git status`/diff when `.git` is available. For ZIP snapshots, explicitly note that Git history/status is unavailable.
3. Read the relevant files and tests before changing behavior.
4. Make the smallest coherent fix; do not hide issues with `any`, broad try/catch, or fallback values.
5. Add focused regression tests for financial-integrity or production-path bugs.
6. Use npm and the existing lockfile. Do not switch package manager or churn dependencies without reason.
7. For TypeScript/React/API work, run as applicable:
   - project tests already present
   - `npm run lint`
   - `npm run build`
   - `git diff --check` when Git is available
8. For full-app testing use `npm run dev` (Express + Vite), not standalone Vite. Test happy path, missing-data path, and intentionally invalid data path relevant to the change.
9. If live AI testing is used, report only whether the key/provider call worked; never print the secret.
10. Review the final diff for accidental financial constants, credentials, generated output, unrelated refactors, and data-destructive behavior.

## 11. Delivery checklist

Report concisely in Thai:

- what changed and important files
- financial/data behavior before vs after when relevant
- tests/lint/build/dev-server results actually run
- warnings or limitations that remain
- whether Git commit/push/deploy was performed (only when explicitly requested)
- next phase only as a recommendation; do not start it automatically

Never say a flow is verified if it was not actually exercised.
