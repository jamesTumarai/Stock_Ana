const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const retryFunction = `
async function createInteractionWithRetry(res: any, opts: any) {
  let attempt = 0;
  while (attempt < 3) {
    const response = await createInteraction(opts);
    if (response.ok) return response;
    
    if (response.status === 429) {
      const errTxt = await response.text();
      let retryInSecs = 40;
      const match = errTxt.match(/Please retry in ([\\d\\.]+)s/);
      if (match && match[1]) {
        retryInSecs = Math.ceil(parseFloat(match[1])) + 1;
      }
      
      console.warn(\`[429 Rate Limit] Waiting \${retryInSecs}s before retry...\`);
      if (res) {
        res.write(\`data: \${JSON.stringify({ type: 'thinking', text: \`Rate limit reached. Waiting \${retryInSecs} seconds to retry...\` })}\\n\\n\`);
      }
      
      await new Promise(r => setTimeout(r, retryInSecs * 1000));
      attempt++;
    } else {
      // Re-construct the response so the caller can read .text()
      const errTxt = await response.text();
      return new Response(errTxt, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  }
  return await createInteraction(opts);
}
`;

// Insert after loadAgentFiles
content = content.replace(/(function loadAgentFiles.*?return files;\n})/s, "$1\n" + retryFunction);

// Replace calls
content = content.replace(/await createInteraction\(\{ prompt, inlineSources: agentFiles, tools: \[\{ type: "google_search" \}\], model: actualModel \}\);/g, 'await createInteractionWithRetry(res, { prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });');
content = content.replace(/await createInteraction\(\{ prompt: validatePrompt, inlineSources: \[\], model: actualModel \}\);/g, 'await createInteractionWithRetry(res, { prompt: validatePrompt, inlineSources: [], model: actualModel });');
content = content.replace(/await createInteraction\(\{([\s\S]*?)prompt,([\s\S]*?)inlineSources: agentFiles,([\s\S]*?)tools: \[\{ type: "google_search" \}\],([\s\S]*?)model: actualModel([\s\S]*?)\}\);/g, 'await createInteractionWithRetry(res, {$1prompt,$2inlineSources: agentFiles,$3tools: [{ type: "google_search" }],$4model: actualModel$5});');

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts with createInteractionWithRetry');
