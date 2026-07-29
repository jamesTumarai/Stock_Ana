const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const targetStr = `      const actualModel = model === 'perseus' ? 'gemini-3.6-flash' : model === 'gemini-2.5-pro' ? 'gemini-3.1-pro' : (model || 'gemini-3.5-flash');

      const response = await createInteraction({
        prompt,
        inlineSources: agentFiles,
        tools: [{ type: "google_search" }],
        model: actualModel
      });`;

const replacementStr = `      const actualModel = model === 'perseus' ? 'gemini-3.6-flash' : model === 'gemini-2.5-pro' ? 'gemini-3.1-pro' : (model || 'gemini-3.5-flash');

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

      if (useSelfConsistency) {
          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Initiating 10/10 Self-Consistency Protocol...' })}\\n\\n\`);
          
          async function runAgent(agentId: string) {
              const resAgent = await createInteraction({ prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });
              const stream = streamInteraction(resAgent);
              let fullText = "";
              for await (const event of stream) {
                  if (event.type === 'tool_call') {
                      const modifiedEvent = { ...event, name: event.name === 'google_search' ? \`google_search_Agent_\${agentId}\` : \`\${event.name}_Agent_\${agentId}\` };
                      res.write(\`data: \${JSON.stringify(modifiedEvent)}\\n\\n\`);
                  } else if (event.type === 'tool_result') {
                      res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
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
      });`;

content = content.replace(targetStr, replacementStr);

// Also remove the old headers block to prevent double headers
const oldHeadersStr = `      if (!response.ok) {
        const errorText = await response.text();
        console.error(\`[analyze] createInteraction failed: \${response.status} \${errorText}\`);
        return res.status(500).json({ error: "Failed to start agent interaction." });
      }

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
      const toolExecutions = {};
      let totalTokens = 0;`;

const newHeadersReplacement = `      if (!response.ok) {
        const errorText = await response.text();
        console.error(\`[analyze] createInteraction failed: \${response.status} \${errorText}\`);
        res.write(\`data: \${JSON.stringify({ type: 'error', message: 'Failed to start agent interaction.' })}\\n\\n\`);
        res.write(\`data: [DONE]\\n\\n\`);
        res.end();
        return;
      }`;

content = content.replace(oldHeadersStr, newHeadersReplacement);

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts with self consistency logic');
