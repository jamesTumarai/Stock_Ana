from pathlib import Path

server_path = Path('server.ts')
server = server_path.read_text()

def replace_once(old: str, new: str, label: str):
    global server
    count = server.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    server = server.replace(old, new, 1)

replace_once(
    'import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";\n',
    'import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";\n'
    'import {\n'
    '  extractLastJsonObjectFromText,\n'
    '  extractStructuredValuationAssumptions,\n'
    '  hasUsableDcfAssumptions,\n'
    '  mergeStructuredValuationAssumptions,\n'
    '} from "./server/lib/valuationAssumptionBridge.ts";\n',
    'bridge import',
)

replace_once(
    "  const fallbackModel = 'gemini-3.7-flash';\n\n  while (attempt < 4) {",
    "  const fallbackModel = 'gemini-3.7-flash';\n"
    "  const retryBudgetMs = 45_000;\n"
    "  const retryStartedAt = Date.now();\n\n"
    "  while (attempt < 4) {",
    'retry budget declarations',
)

replace_once(
    "      console.warn(`[429 Rate Limit] Waiting ${retryInSecs}s before retry...`);\n"
    "      if (res) {\n"
    "        res.write(`data: ${JSON.stringify({ type: 'thinking', text: `Rate limit reached. Waiting ${retryInSecs} seconds to retry...` })}\\n\\n`);\n"
    "      }\n"
    "      \n"
    "      await new Promise(r => setTimeout(r, retryInSecs * 1000));\n"
    "      attempt++;",
    "      const retryDelayMs = retryInSecs * 1000;\n"
    "      const remainingBudgetMs = retryBudgetMs - (Date.now() - retryStartedAt);\n"
    "      if (retryDelayMs > remainingBudgetMs) {\n"
    "        console.warn(`[429 Rate Limit] Requested retry delay ${retryInSecs}s exceeds remaining retry budget; failing fast.`);\n"
    "        return new Response(errTxt, { status: response.status, statusText: response.statusText, headers: response.headers });\n"
    "      }\n"
    "      console.warn(`[429 Rate Limit] Waiting ${retryInSecs}s before retry...`);\n"
    "      if (res) {\n"
    "        res.write(`data: ${JSON.stringify({ type: 'thinking', text: `Rate limit reached. Waiting ${retryInSecs} seconds to retry...` })}\\n\\n`);\n"
    "      }\n"
    "      \n"
    "      await new Promise(r => setTimeout(r, retryDelayMs));\n"
    "      attempt++;",
    '429 budget guard',
)

helper_anchor = "      let debugLog = `--- Analysis Run for ${ticker} at ${new Date().toISOString()} ---`;\n      const toolExecutions: any = {};\n      let totalTokens = 0;\n"
helper = helper_anchor + "\n      const appendCanonicalValuationIfNeeded = async (researchText: string) => {\n        if (analysisType === 'technical' || !researchText.trim()) return;\n        const parsedReport = extractLastJsonObjectFromText(researchText);\n        if (!parsedReport || hasUsableDcfAssumptions(parsedReport)) return;\n\n        res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Normalizing valuation assumptions into Lumina DCF contract...' })}\\n\\n`);\n        const assumptions = await extractStructuredValuationAssumptions(researchText, actualModel);\n        if (!assumptions || assumptions.wacc_pct === null || assumptions.terminal_growth_pct === null || assumptions.projection_years === null\n          || [assumptions.scenarios.bear, assumptions.scenarios.base, assumptions.scenarios.bull].some(\n            scenario => scenario.revenue_cagr_pct === null || scenario.terminal_margin_pct === null,\n          )) {\n          console.warn('[valuation-assumptions] Complete structured DCF assumptions unavailable; valuation remains fail-closed.');\n          return;\n        }\n\n        const canonicalReport = mergeStructuredValuationAssumptions(parsedReport, assumptions);\n        const canonicalText = '\\n\\n```json\\n' + JSON.stringify(canonicalReport) + '\\n```\\n';\n        res.write(`data: ${JSON.stringify({ type: 'text', text: canonicalText })}\\n\\n`);\n        console.log('[valuation-assumptions] Appended canonical DCF assumption contract; fair values remain deterministic-only.');\n      };\n"
replace_once(helper_anchor, helper, 'canonical valuation helper')

replace_once(
    "          const mergeStream = streamInteraction(mergeResponse);\n          \n          try {\n              for await (const event of mergeStream) {\n                  res.write(`data: ${JSON.stringify(event)}\\n\\n`);\n              }\n          } catch (err: any) {",
    "          const mergeStream = streamInteraction(mergeResponse);\n          let validatedText = '';\n          \n          try {\n              for await (const event of mergeStream) {\n                  res.write(`data: ${JSON.stringify(event)}\\n\\n`);\n                  if (event.type === 'text' && event.text) validatedText += event.text;\n              }\n          } catch (err: any) {",
    'validator text accumulation',
)

replace_once(
    "          }\n          \n          res.write(`data: [DONE]\\n\\n`);\n          res.end();\n          return;\n      }\n\n      const response = await createInteractionWithRetry(res, {",
    "          }\n\n          await appendCanonicalValuationIfNeeded(validatedText || fullText);\n          \n          res.write(`data: [DONE]\\n\\n`);\n          res.end();\n          return;\n      }\n\n      const response = await createInteractionWithRetry(res, {",
    'validator bridge call',
)

replace_once(
    "      const stream = streamInteraction(response);\n      for await (const event of stream) {",
    "      const stream = streamInteraction(response);\n      let fullText = '';\n      for await (const event of stream) {",
    'single-pass text accumulator declaration',
)

replace_once(
    "        } else if (event.type === 'text') {\n",
    "        } else if (event.type === 'text') {\n          if (event.text) fullText += event.text;\n",
    'single-pass text accumulation',
)

replace_once(
    "      }\n          \n      const totalDurationSecs = ((Date.now() - startTime) / 1000);",
    "      }\n\n      await appendCanonicalValuationIfNeeded(fullText);\n          \n      const totalDurationSecs = ((Date.now() - startTime) / 1000);",
    'single-pass bridge call',
)

replace_once(
    "        fs.writeFileSync(path.join(runLogsDir, logFileName), finalLog, 'utf-8');\n        // Maintain backwards compatibility with the old txt file\n        fs.writeFileSync(path.join(process.cwd(), `sub_agents_debug_${ticker}.txt`), finalLog, 'utf-8');",
    "        fs.writeFileSync(path.join(runLogsDir, logFileName), finalLog, 'utf-8');\n        // /var/task is read-only on Vercel. Keep the legacy local debug file only in writable local runtimes.\n        if (process.env.VERCEL !== '1') {\n          fs.writeFileSync(path.join(process.cwd(), `sub_agents_debug_${ticker}.txt`), finalLog, 'utf-8');\n        }",
    'Vercel debug write guard',
)

server_path.write_text(server)

prompt_test = Path('src/utils/serverPromptIntegrity.test.ts')
text = prompt_test.read_text()
marker = "console.log('Production prompt integrity checks passed');"
addition = r'''
// Managed-agent prose is research output, not a machine contract. Fundamental/Combined
// requests must have a structured-assumption bridge before deterministic DCF preparation.
assert.match(serverSource, /extractStructuredValuationAssumptions/);
assert.match(serverSource, /appendCanonicalValuationIfNeeded/);
assert.match(serverSource, /mergeStructuredValuationAssumptions/);
assert.match(serverSource, /retryBudgetMs = 45_000/);
assert.match(serverSource, /process\.env\.VERCEL !== '1'/);

'''
if marker not in text:
    raise SystemExit('prompt test marker missing')
text = text.replace(marker, addition + marker, 1)
prompt_test.write_text(text)
