const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /const response = await createInteraction\(\{\s*prompt,\s*inlineSources: agentFiles,\s*tools: \[\{ type: "google_search" \}\],\s*model: actualModel\s*\}\);\s*if \(!response\.ok\) \{\s*const errorText = await response\.text\(\);\s*console\.error\(`\[analyze\] createInteraction failed: \$\{response\.status\} \$\{errorText\}`\);\s*return res\.status\(500\)\.json\(\{ error: "Failed to start agent interaction\." \}\);\s*\}\s*res\.setHeader\('Content-Type', 'text\/event-stream'\);\s*res\.setHeader\('Cache-Control', 'no-cache'\);\s*res\.setHeader\('Connection', 'keep-alive'\);\s*res\.flushHeaders\(\);\s*const startTime = Date\.now\(\);\s*const runLogsDir = path\.join\(process\.cwd\(\), 'run_logs'\);\s*if \(!fs\.existsSync\(runLogsDir\)\) \{\s*fs\.mkdirSync\(runLogsDir, \{ recursive: true \}\);\s*\}\s*const runId = Date\.now\(\);\s*const jsonlLogPath = path\.join\(runLogsDir, `run_log_\$\{ticker\}_\$\{runId\}\.jsonl`\);\s*let debugLog = `--- Analysis Run for \$\{ticker\} at \$\{new Date\(\)\.toISOString\(\)\} ---`;\s*const toolExecutions:? any = \{\};\s*let totalTokens = 0;/g;

const replacement = `
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
      
      const startTime = Date.now();
      const runLogsDir = path.join(process.cwd(), 'run_logs');
      if (!fs.existsSync(runLogsDir)) {
          fs.mkdirSync(runLogsDir, { recursive: true });
      }
      const runId = Date.now();
      const jsonlLogPath = path.join(runLogsDir, \`run_log_\${ticker}_\${runId}.jsonl\`);
      
      let debugLog = \`--- Analysis Run for \${ticker} at \${new Date().toISOString()} ---\`;
      const toolExecutions: any = {};
      let totalTokens = 0;

      if (useSelfConsistency && (analysisType === 'technical' || analysisType === 'combined')) {
          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Initiating 10/10 Self-Consistency Protocol...' })}\\n\\n\`);
          
          async function runAgent(agentId: string) {
              const resAgent = await createInteraction({ prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });
              const stream = streamInteraction(resAgent);
              let fullText = "";
              for await (const event of stream) {
                  if (event.type === 'tool_call') {
                      const modifiedEvent = { ...event, name: event.name === 'google_search' ? \`google_search_Agent_\${agentId}\` : \`\${event.name}_Agent_\${agentId}\`, callId: \`\${event.callId}_\${agentId}\` };
                      res.write(\`data: \${JSON.stringify(modifiedEvent)}\\n\\n\`);
                  } else if (event.type === 'tool_result') {
                      const modifiedEvent = { ...event, callId: \`\${event.callId}_\${agentId}\` };
                      res.write(\`data: \${JSON.stringify(modifiedEvent)}\\n\\n\`);
                  } else if (event.type === 'text' && event.text) {
                      fullText += event.text;
                  } else if (event.type === 'thinking') {
                      const modifiedEvent = { ...event, text: \`[Agent \${agentId}] \${event.text}\` };
                      res.write(\`data: \${JSON.stringify(modifiedEvent)}\\n\\n\`);
                  }
              }
              return fullText;
          }

          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Spawning Agent A and Agent B for independent analysis...' })}\\n\\n\`);
          
          const [resultA, resultB] = await Promise.all([runAgent('A'), runAgent('B')]);
          
          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Both agents completed. Cross-checking and validating mathematically...' })}\\n\\n\`);
          
          const mergePrompt = \`You are the Lead Analyst. You have received two independent analysis reports for \${ticker}. 
Your job is to cross-check them, fix any inconsistencies, and produce the final perfect JSON report.

CRITICAL CHECKS:
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct: (Target - Entry) / (Entry - Stop-Loss). Check the math exactly.
- Technical Key Levels: Ensure Support/Resistance levels are at least 1.5x ATR away from current price.
- Fundamental Fundamentals Check: Must have exactly 8 bullet points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Insider Ownership: Must be a numeric percentage.

Agent A Output:
\${resultA}

Agent B Output:
\${resultB}

Synthesize the best, most accurate facts from both. Re-calculate the Risk/Reward ratios yourself to be 100% sure they are correct.
You MUST output the final synthesis report as a raw JSON object wrapped in \\\`\\\`\\\`json ... \\\`\\\`\\\` markdown block.
Use the exact schema requested originally:
\${dynamicSchema}\`;

          const mergeResponse = await createInteraction({ prompt: mergePrompt, inlineSources: [], model: actualModel });
          const mergeStream = streamInteraction(mergeResponse);
          
          for await (const event of mergeStream) {
              res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
          }
          
          res.write(\`data: [DONE]\\n\\n\`);
          res.end();
          return;
      }

      const response = await createInteraction({
        prompt,
        inlineSources: agentFiles,
        tools: [{ type: "google_search" }],
        model: actualModel
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(\`[analyze] createInteraction failed: \${response.status} \${errorText}\`);
        res.write(\`data: \${JSON.stringify({ type: 'error', message: 'Failed to start agent interaction.' })}\\n\\n\`);
        res.write(\`data: [DONE]\\n\\n\`);
        res.end();
        return;
      }
`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts with Regex self consistency logic');
