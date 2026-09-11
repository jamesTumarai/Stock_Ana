import { createInteraction } from './agentClient.ts';

export async function createInteractionWithRetry(res: any, opts: any) {
  let attempt = 0;
  let currentOpts = { ...opts };
  const fallbackModel = 'gemini-3.7-flash';
  // Gemini's free-tier rolling quota can require more than one consecutive
  // Retry-After wait. Keep the total bounded, but long enough to honor those
  // provider-directed waits instead of failing after the first retry.
  const retryBudgetMs = 120_000;
  const retryStartedAt = Date.now();

  while (attempt < 4) {
    const response = await createInteraction(currentOpts);
    if (response.ok) return response;

    const status = response.status;
    const errTxt = await response.text();

    if (status === 429) {
      let retryInSecs = 30;
      const match = errTxt.match(/Please retry in ([\d\.]+)s/);
      if (match && match[1]) {
        retryInSecs = Math.ceil(parseFloat(match[1])) + 1;
      }

      const retryDelayMs = retryInSecs * 1000;
      const remainingBudgetMs = retryBudgetMs - (Date.now() - retryStartedAt);
      if (retryDelayMs > remainingBudgetMs) {
        console.warn(`[429 Rate Limit] Requested retry delay ${retryInSecs}s exceeds remaining retry budget; failing fast.`);
        return new Response(errTxt, { status: response.status, statusText: response.statusText, headers: response.headers });
      }
      console.warn(`[429 Rate Limit] Waiting ${retryInSecs}s before retry...`);
      if (res) {
        res.write(`data: ${JSON.stringify({ type: 'thinking', text: `Rate limit reached. Waiting ${retryInSecs} seconds to retry...` })}\n\n`);
      }

      await new Promise(r => setTimeout(r, retryDelayMs));
      attempt++;
    } else if (
      status === 503 ||
      status === 500 ||
      status === 502 ||
      errTxt.toLowerCase().includes('unreachable') ||
      errTxt.toLowerCase().includes('high demand') ||
      errTxt.toLowerCase().includes('unavailable')
    ) {
      console.warn(`[Model ${currentOpts.model || '3.8'} unavailable (status: ${status})]: ${errTxt.slice(0, 100)}. Retrying attempt ${attempt + 1}...`);
      if (res) {
        res.write(`data: ${JSON.stringify({ type: 'thinking', text: `โมเดล ${currentOpts.model || 'Gemini 3.8'} มีผู้ใช้งานหนาแน่นชั่วคราว กำลังเชื่อมต่อซ้ำอัตโนมัติ...` })}\n\n`);
      }

      await new Promise(r => setTimeout(r, 2500));

      // On attempt >= 2, if 3.8 is still busy, fallback to 3.7
      if (attempt >= 1 && currentOpts.model === 'gemini-3.8-flash') {
        console.warn(`[Model Fallback] Switching from gemini-3.8-flash to ${fallbackModel}`);
        currentOpts.model = fallbackModel;
      }
      attempt++;
    } else {
      // Return response so caller can inspect
      return new Response(errTxt, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  }
  return await createInteraction(currentOpts);
}
