from pathlib import Path

server = Path('server.ts')
text = server.read_text()
old = '  "intrinsic_value": null,'
count = text.count(old)
if count < 1:
    raise SystemExit('Expected at least one intrinsic_value null schema placeholder')

new = '''  "intrinsic_value": {
    "current_price": null,
    "as_of_date": null,
    "dcf_model": {
      "assumptions": {
        "wacc_pct": null,
        "terminal_growth_pct": null,
        "projection_years": null
      },
      "scenarios": {
        "bear": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "base": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "bull": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        }
      }
    },
    "summary": {
      "fair_value_range_low": null,
      "fair_value_range_high": null,
      "base_case_fair_value": null,
      "margin_of_safety_pct": null,
      "verdict_text": "..."
    }
  },'''
text = text.replace(old, new)

anchor = '     - DCF ASSUMPTIONS ALIGNMENT: Base revenue CAGR ("revenue_cagr_pct") and terminal margins ("terminal_margin_pct") must be realistically aligned with consensus guidance, avoiding arbitrary extremes.`;'
if text.count(anchor) != 1:
    raise SystemExit(f'Expected one DCF assumptions alignment anchor, found {text.count(anchor)}')
replacement = '''     - DCF ASSUMPTIONS ALIGNMENT: Base revenue CAGR ("revenue_cagr_pct") and terminal margins ("terminal_margin_pct") must be realistically aligned with consensus guidance, avoiding arbitrary extremes.
     - DCF OUTPUT CONTRACT (MANDATORY): For Fundamental and Combined analysis, "intrinsic_value.dcf_model" MUST always preserve the exact object shape shown in the JSON schema. "assumptions" MUST exist with "wacc_pct", "terminal_growth_pct", and "projection_years"; "scenarios" MUST exist with "bear", "base", and "bull", each containing "revenue_cagr_pct", "terminal_margin_pct", "fair_value_per_share", and "key_assumption_note".
     - DCF FACT/ASSUMPTION SEPARATION: WACC, terminal growth, projection years, revenue CAGR, and terminal FCF margin are valuation assumptions, not verified financial facts. You may propose them only when economically defensible from retrieved context and must explain them in "key_assumption_note". If you cannot form a defensible assumption, output null. NEVER insert ticker-specific defaults or plausible-looking fallback values. "fair_value_per_share" and the fair-value fields in "intrinsic_value.summary" may remain null because Lumina recomputes valuation deterministically after verified financial and market inputs are attached.`;'''
text = text.replace(anchor, replacement)
server.write_text(text)

test = Path('src/utils/serverPromptIntegrity.test.ts')
test_text = test.read_text()
sentinel = "console.log('Production prompt integrity checks passed');"
if test_text.count(sentinel) != 1:
    raise SystemExit('Prompt integrity test sentinel not found exactly once')
assertions = r'''

// Fundamental/Combined output must expose the complete DCF assumption/scenario contract.
// Numeric schema placeholders remain null so the prompt cannot seed plausible-looking defaults.
assert.match(serverSource, /"intrinsic_value"\s*:\s*\{/);
assert.match(serverSource, /"dcf_model"\s*:\s*\{/);
assert.match(serverSource, /"assumptions"\s*:\s*\{/);
assert.match(serverSource, /"wacc_pct"\s*:\s*null/);
assert.match(serverSource, /"terminal_growth_pct"\s*:\s*null/);
assert.match(serverSource, /"projection_years"\s*:\s*null/);
assert.match(serverSource, /DCF OUTPUT CONTRACT \(MANDATORY\)/);
assert.match(serverSource, /DCF FACT\/ASSUMPTION SEPARATION/);
assert.doesNotMatch(serverSource, /"wacc_pct"\s*:\s*\d/);
assert.doesNotMatch(serverSource, /"terminal_growth_pct"\s*:\s*\d/);
assert.doesNotMatch(serverSource, /"projection_years"\s*:\s*\d/);
'''
test.write_text(test_text.replace(sentinel, assertions + '\n' + sentinel, 1))
print(f'Replaced {count} intrinsic_value null placeholder(s)')
