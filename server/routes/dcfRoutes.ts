import type { Express, RequestHandler } from 'express';
import { GoogleGenAI } from '@google/genai';
import { validateDcfAssumptionModel } from '../../src/utils/valuation/dcfAssumptionProposal.ts';

export function registerDcfRoutes(
  app: Express,
  requireFirebaseAuth: RequestHandler,
  dcfAssumptionRateLimit: RequestHandler,
) {
  app.post("/api/dcf-assumptions", requireFirebaseAuth, dcfAssumptionRateLimit, async (req, res) => {
    try {
      const { ticker, companyName, businessContext = '', verifiedFinancialContext = {} } = req.body || {};
      const normalizedTicker = typeof ticker === 'string' ? ticker.trim().toUpperCase() : '';
      if (!normalizedTicker || !/^[A-Z0-9.-]{1,12}$/.test(normalizedTicker)) {
        return res.status(400).json({ error: 'Missing or invalid ticker' });
      }
      if (!process.env.GEMINI_API_KEY?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const sourcePeriod = typeof verifiedFinancialContext?.sourcePeriod === 'string'
        ? verifiedFinancialContext.sourcePeriod.trim().slice(0, 120)
        : '';
      const startingRevenueM = verifiedFinancialContext?.startingRevenueM;
      const trailingFourFreeCashFlowM = verifiedFinancialContext?.trailingFourFreeCashFlowM;
      const historicalFcfMarginPct = verifiedFinancialContext?.historicalFcfMarginPct;
      const verifiedNumbersOk = [startingRevenueM, trailingFourFreeCashFlowM, historicalFcfMarginPct]
        .every(value => typeof value === 'number' && Number.isFinite(value));
      if (!sourcePeriod || !verifiedNumbersOk || startingRevenueM <= 0 || historicalFcfMarginPct < -100 || historicalFcfMarginPct > 100) {
        return res.status(400).json({ error: 'Verified DCF context is incomplete or invalid.' });
      }

      const normalizedCompanyName = typeof companyName === 'string' && companyName.trim()
        ? companyName.trim().slice(0, 200)
        : normalizedTicker;
      const normalizedBusinessContext = typeof businessContext === 'string'
        ? businessContext.trim().slice(0, 7000)
        : '';

      const prompt = `You are the valuation-assumption layer for Lumina, an institutional equity research system.

Your job is ONLY to propose forward-looking DCF assumptions for ${normalizedCompanyName} (${normalizedTicker}). You are not a financial-data provider and you are not allowed to calculate or estimate fair value.

VERIFIED ANCHOR FACTS (provided by the SEC verification layer; do not replace, restate as new facts, or invent alternatives):
- Source period: ${sourcePeriod}
- Trailing revenue: ${startingRevenueM} USD millions
- Trailing free cash flow: ${trailingFourFreeCashFlowM} USD millions
- Historical FCF margin: ${historicalFcfMarginPct}%

QUALITATIVE BUSINESS CONTEXT (research narrative only; treat as context, not verified financial facts):
${normalizedBusinessContext || 'No additional qualitative context supplied.'}

Return ONLY a JSON object with this exact shape:
{
  "assumptions": {
    "wacc_pct": number,
    "terminal_growth_pct": number,
    "projection_years": integer
  },
  "scenarios": {
    "bear": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    },
    "base": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    },
    "bull": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    }
  }
}

STRICT RULES:
- These are ASSUMPTIONS, not facts. Say so in every scenario note.
- Never output Revenue, Cash, Debt, Shares, current price, enterprise value, equity value, or any other financial fact beyond the fields above.
- Never calculate fair value. fair_value_per_share MUST be null in all scenarios.
- WACC must be 5% to 30%.
- Terminal growth must be 0% to 5% and lower than WACC.
- Projection years must be an integer from 3 to 10.
- Revenue CAGR must be between -30% and 50%.
- Terminal FCF margin must be between -50% and 80%.
- Bear <= Base <= Bull for both revenue CAGR and terminal FCF margin.
- Bear, Base, and Bull must be meaningfully distinct.
- Anchor margin assumptions to business economics and the verified historical FCF margin without treating the historical margin as a guaranteed future outcome.
- Do not include markdown fences or commentary outside the JSON.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
      let responseText = '';
      let usedModel = '';
      let lastError: any = null;

      for (const candidateModel of candidateModels) {
        try {
          const generated = await ai.models.generateContent({
            model: candidateModel,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });
          responseText = generated.text || '';
          usedModel = candidateModel;
          if (responseText.trim()) break;
        } catch (error: any) {
          lastError = error;
          console.warn(`[dcf-assumptions] Model ${candidateModel} unavailable (${error?.status || error?.message || 'unknown'}).`);
        }
      }

      if (!responseText.trim()) {
        throw lastError || new Error('No DCF assumption proposal was generated.');
      }

      const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const parsed = JSON.parse(fenced?.[1] || responseText.trim());
      const dcfModel = validateDcfAssumptionModel(parsed);
      if (!dcfModel) {
        console.warn('[dcf-assumptions] Proposal failed deterministic validation.');
        return res.status(422).json({ error: 'AI assumption proposal failed deterministic validation.' });
      }

      return res.json({
        ok: true,
        source: 'ai_assumption_proposal',
        model: usedModel,
        dcf_model: dcfModel,
      });
    } catch (error: any) {
      console.error('[dcf-assumptions] Error:', error?.message || error);
      return res.status(502).json({ error: 'DCF assumption proposal unavailable.' });
    }
  });

}
