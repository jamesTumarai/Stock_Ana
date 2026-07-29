const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /if \(useSelfConsistency && \(analysisType === 'technical' \|\| analysisType === 'combined'\)\) \{[\s\S]*?res\.end\(\);\s*return;\s*\}/g;

const replacement = `      if (useSelfConsistency && (analysisType === 'technical' || analysisType === 'combined')) {
          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Initiating 10/10 Self-Consistency & Validation Protocol...' })}\\n\\n\`);
          
          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Running Primary Analyst Agent...' })}\\n\\n\`);
          
          const resAgent = await createInteraction({ prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });
          const stream = streamInteraction(resAgent);
          let fullText = "";
          for await (const event of stream) {
              if (event.type === 'tool_call' || event.type === 'tool_result') {
                  res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
              } else if (event.type === 'text' && event.text) {
                  fullText += event.text;
              } else if (event.type === 'thinking') {
                  res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
              }
          }

          res.write(\`data: \${JSON.stringify({ type: 'thinking', text: 'Primary Analysis complete. Running Validator Agent for 10/10 Accuracy...' })}\\n\\n\`);
          
          const validatePrompt = \`You are the Lead Validator. You have received an analysis report for \${ticker}. 
Your job is to cross-check it, fix any mathematical inconsistencies, and produce the final perfect JSON report.

CRITICAL CHECKS:
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct: (Target - Entry) / (Entry - Stop-Loss) or (Entry - Target) / (Stop-Loss - Entry) for shorts. Check the math exactly.
- Technical Key Levels: Ensure Support/Resistance levels are at least 1.5x ATR away from current price.
- Fundamental Fundamentals Check: Must have exactly 8 bullet points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Insider Ownership: Must be a numeric percentage.

Primary Analyst Output:
\${fullText}

Check the facts and re-calculate the Risk/Reward ratios yourself to be 100% sure they are correct.
You MUST output the final synthesis report as a raw JSON object wrapped in \\\`\\\`\\\`json ... \\\`\\\`\\\` markdown block.
Use the exact schema requested originally:
\${dynamicSchema}\`;

          const mergeResponse = await createInteraction({ prompt: validatePrompt, inlineSources: [], model: actualModel });
          if (!mergeResponse.ok) {
              const errTxt = await mergeResponse.text();
              console.error("Validator error:", errTxt);
              res.write(\`data: \${JSON.stringify({ type: 'error', message: "Validation failed: " + errTxt })}\\n\\n\`);
              res.write(\`data: [DONE]\\n\\n\`);
              res.end();
              return;
          }
          const mergeStream = streamInteraction(mergeResponse);
          
          try {
              for await (const event of mergeStream) {
                  res.write(\`data: \${JSON.stringify(event)}\\n\\n\`);
              }
          } catch (err: any) {
              console.error("Validator stream error:", err);
              res.write(\`data: \${JSON.stringify({ type: 'error', message: err.message })}\\n\\n\`);
          }
          
          res.write(\`data: [DONE]\\n\\n\`);
          res.end();
          return;
      }`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts with Validator SC logic');
