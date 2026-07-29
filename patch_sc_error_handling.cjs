const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regex = /const mergeResponse = await createInteraction\(\{\s*prompt: mergePrompt, inlineSources: \[\], model: actualModel \}\);\s*const mergeStream = streamInteraction\(mergeResponse\);\s*for await \(const event of mergeStream\) \{\s*res\.write\(\`data: \$\{JSON\.stringify\(event\)\}\\n\\n\`\);\s*\}/g;

const replacement = `          const mergeResponse = await createInteraction({ prompt: mergePrompt, inlineSources: [], model: actualModel });
          if (!mergeResponse.ok) {
              const errTxt = await mergeResponse.text();
              console.error("Merge error:", errTxt);
              res.write(\`data: \${JSON.stringify({ type: 'error', message: "Merge failed: " + errTxt })}\\n\\n\`);
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
              console.error("Merge stream error:", err);
              res.write(\`data: \${JSON.stringify({ type: 'error', message: err.message })}\\n\\n\`);
          }`;

content = content.replace(regex, replacement);

fs.writeFileSync('server.ts', content);
console.log('Patched error handling in server.ts');
