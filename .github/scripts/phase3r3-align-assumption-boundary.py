from pathlib import Path

server_path = Path('server.ts')
server = server_path.read_text()

def remove_once(fragment: str, label: str):
    global server
    count = server.count(fragment)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    server = server.replace(fragment, '', 1)

remove_once(
    'import {\n'
    '  extractLastJsonObjectFromText,\n'
    '  extractStructuredValuationAssumptions,\n'
    '  hasUsableDcfAssumptions,\n'
    '  mergeStructuredValuationAssumptions,\n'
    '} from "./server/lib/valuationAssumptionBridge.ts";\n',
    'redundant bridge import',
)

helper_start = "      const appendCanonicalValuationIfNeeded = async (researchText: string) => {\n"
helper_end = "      };\n\n"
start = server.find(helper_start)
if start < 0:
    raise SystemExit('bridge helper start missing')
end = server.find(helper_end, start)
if end < 0:
    raise SystemExit('bridge helper end missing')
server = server[:start] + server[end + len(helper_end):]

for fragment, label in [
    ("          let validatedText = '';\n", 'validated text declaration'),
    ("                  if (event.type === 'text' && event.text) validatedText += event.text;\n", 'validated text accumulation'),
    ("          await appendCanonicalValuationIfNeeded(validatedText || fullText);\n", 'validator bridge call'),
    ("      let fullText = '';\n", 'single-pass text declaration'),
    ("          if (event.text) fullText += event.text;\n", 'single-pass text accumulation'),
    ("      await appendCanonicalValuationIfNeeded(fullText);\n", 'single-pass bridge call'),
]:
    remove_once(fragment, label)

server_path.write_text(server)

prompt_test = Path('src/utils/serverPromptIntegrity.test.ts')
text = prompt_test.read_text()
block = r'''// Managed-agent prose is research output, not a machine contract. Fundamental/Combined
// requests must have a structured-assumption bridge before deterministic DCF preparation.
assert.match(serverSource, /extractStructuredValuationAssumptions/);
assert.match(serverSource, /appendCanonicalValuationIfNeeded/);
assert.match(serverSource, /mergeStructuredValuationAssumptions/);
assert.match(serverSource, /retryBudgetMs = 45_000/);
assert.match(serverSource, /process\.env\.VERCEL !== '1'/);

'''
if text.count(block) != 1:
    raise SystemExit('bridge prompt-test block missing')
text = text.replace(block, '', 1)
marker = "console.log('Production prompt integrity checks passed');"
addition = r'''// Runtime reliability hardening retained from Phase 3R.2.
assert.match(serverSource, /retryBudgetMs = 45_000/);
assert.match(serverSource, /process\.env\.VERCEL !== '1'/);

'''
if marker not in text:
    raise SystemExit('prompt test marker missing')
text = text.replace(marker, addition + marker, 1)
prompt_test.write_text(text)
