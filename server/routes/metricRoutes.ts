import type { Express, RequestHandler } from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  getMetricInterpretationContext,
  buildFinancialMetricAnalysisPrompt,
  MetricInterpretationContext
} from '../../src/domain/financialMetricContext';

export function registerMetricRoutes(
  app: Express,
  requireFirebaseAuth: RequestHandler,
  metricRateLimit: RequestHandler,
) {
  // In-memory cache for Live AI Financial Analyst row insights
  const metricInsightCache = new Map<string, any>();

  app.post("/api/analyze-metric", requireFirebaseAuth, metricRateLimit, async (req, res) => {
    try {
      const {
        ticker,
        companyName,
        metricKey,
        metricName,
        metricNameTh,
        periods = [],
        historyValues = [],
        yoyPcts = [],
        unit = '',
        isCurrency = false,
        context = {},
        metricContext: incomingMetricContext,
        reportData,
        redFlags = [],
        isThai = true,
        model = 'gemini-3.8-flash'
      } = req.body;

      const normalizedTicker = typeof ticker === 'string' ? ticker.trim().toUpperCase() : '';
      if (!normalizedTicker || !/^[A-Z0-9.-]{1,12}$/.test(normalizedTicker)) {
        return res.status(400).json({ error: "Missing or invalid ticker" });
      }
      if (!metricKey || !metricName) {
        return res.status(400).json({ error: "Missing metricKey or metricName" });
      }
      const normalizedCompanyName = typeof companyName === 'string' && companyName.trim()
        ? companyName.trim()
        : normalizedTicker;

      // Deterministically resolve business-aware interpretation context
      const metricContext: MetricInterpretationContext = incomingMetricContext || getMetricInterpretationContext({
        metricKey,
        metricName,
        metricNameTh,
        reportData,
        ticker: normalizedTicker,
        periods,
        historyValues,
        yoyPcts,
        unit,
        isCurrency,
        isThai
      });

      // Cache lookup key includes business archetype and period sequence to prevent stale cache
      const cacheKey = `${normalizedTicker}_${metricContext.businessArchetype}_${metricKey}_${(historyValues || []).join(',')}_${(periods || []).join(',')}_${isThai ? 'th' : 'en'}_${model}`;
      if (metricInsightCache.has(cacheKey)) {
        const cached = metricInsightCache.get(cacheKey);
        if (cached && (!cached.what_is_it_th || cached.what_is_it_th.trim() === '')) {
          metricInsightCache.delete(cacheKey);
        } else {
          return res.json({ success: true, cached: true, insight: cached, metricContext });
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
      }

      const prompt = buildFinancialMetricAnalysisPrompt(metricContext, {
        normalizedCompanyName,
        normalizedTicker,
        periods,
        historyValues,
        yoyPcts,
        unit,
        isCurrency,
        widerContext: context,
        redFlags,
        isThai
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const candidateModels = [
        model || 'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.7-flash',
        'gemini-3.6-flash'
      ].filter((m, idx, self) => self.indexOf(m) === idx);

      let geminiRes: any = null;
      let usedModel = 'gemini-3.5-flash';
      let lastErr: any = null;

      for (const m of candidateModels) {
        try {
          geminiRes = await ai.models.generateContent({
            model: m,
            contents: prompt
          });
          usedModel = m;
          break;
        } catch (e: any) {
          console.warn(`[analyze-metric] Model ${m} unavailable (${e.status || e.message?.slice(0, 100)}), trying fallback...`);
          lastErr = e;
        }
      }

      if (!geminiRes) {
        throw lastErr || new Error("All Gemini models unavailable");
      }

      const responseText = geminiRes.text || '';
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, responseText.trim()];
      const cleanJson = jsonMatch[1] || responseText.trim();
      const parsedInsight = JSON.parse(cleanJson);
      parsedInsight.model = usedModel;

      if (!parsedInsight.what_is_it_th || parsedInsight.what_is_it_th.trim() === '') {
        parsedInsight.what_is_it_th = `ตัวเลขทางการเงินแสดงมูลค่าหรืออัตราส่วนของ ${metricName} ตามมาตรฐานการจัดทำงบการเงินสากล`;
      }
      if (!parsedInsight.what_is_it_en || parsedInsight.what_is_it_en.trim() === '') {
        parsedInsight.what_is_it_en = `Standard financial statement metric representing ${metricName}`;
      }

      metricInsightCache.set(cacheKey, parsedInsight);
      return res.json({ success: true, cached: false, insight: parsedInsight, model: usedModel });
    } catch (err: any) {
      console.error("[analyze-metric] Error:", err?.message || err);
      return res.status(500).json({ error: err.message || "Failed to analyze metric" });
    }
  });

}
