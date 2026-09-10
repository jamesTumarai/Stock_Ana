import type { Express, RequestHandler } from 'express';
import { GoogleGenAI } from '@google/genai';

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
        periods = [],
        historyValues = [],
        yoyPcts = [],
        unit = '',
        isCurrency = false,
        context = {},
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

      // Cache lookup key
      const cacheKey = `${normalizedTicker}_${metricKey}_${(historyValues || []).join(',')}_${isThai ? 'th' : 'en'}_${model}`;
      if (metricInsightCache.has(cacheKey)) {
        const cached = metricInsightCache.get(cacheKey);
        if (cached && (!cached.what_is_it_th || cached.what_is_it_th.trim() === '')) {
          metricInsightCache.delete(cacheKey);
        } else {
          return res.json({ success: true, cached: true, insight: cached });
        }
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
      }

      // Format periods and history values
      const historySummary = (periods || []).map((p: string, idx: number) => {
        const val = historyValues[idx];
        const yoy = yoyPcts[idx];
        if (val === null || val === undefined) return `${p}: -`;
        let valStr = '';
        if (isCurrency || unit === '$' || unit === 'M') {
          const abs = Math.abs(val);
          const sign = val < 0 ? '-' : '';
          valStr = abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(2)}B` : `${sign}$${abs.toFixed(2)}M`;
        } else if (unit === '%') {
          valStr = `${val.toFixed(1)}%`;
        } else {
          valStr = `${val}${unit ? ' ' + unit : ''}`;
        }
        const yoyStr = yoy !== null && yoy !== undefined ? ` (${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% YoY)` : '';
        return `${p}: ${valStr}${yoyStr}`;
      }).join(', ');

      const contextSummary = Object.entries(context || {})
        .filter(([_, v]) => Array.isArray(v) && v.length > 0)
        .map(([k, v]) => `${k}: ${(v as any[]).slice(-4).join(', ')}`)
        .join('\n');

      const redFlagsSummary = (redFlags || []).slice(0, 3).join('; ');

      const prompt = `You are an elite Senior Wall Street Equity Research Analyst (CFA Charterholder) known for rigorous, quantitative financial statement dissection.
Analyze the following financial statement metric for **${normalizedCompanyName} (${normalizedTicker})**:

- Metric: ${metricName} (Key: ${metricKey})
- Historical Sequence across recent periods: ${historySummary}
${contextSummary ? `- Wider Financial Statement Context (recent 4 quarters in $M):\n${contextSummary}` : ''}
${redFlagsSummary ? `- Related Red Flags from 10-K/10-Q filings: ${redFlagsSummary}` : ''}

CRITICAL INSTITUTIONAL ANALYSIS RULES:
1. STRICT DATA FIDELITY: Never produce generic canned praise. Tie every conclusion to retrieved, dated figures from this report and explain when deterioration in revenue, margins, or cash flow changes the conclusion.
2. CROSS-STATEMENT SYNTHESIS: Connect this line item directly to the other retrieved financial statements. Compare CapEx with operating cash flow, explain the resulting free cash flow, and connect operating expenses with operating leverage without importing numerical examples from this prompt.
3. CAUSALITY & DRIVERS: Ground the explanation only in ${normalizedCompanyName}'s actual retrieved business operations and sourced context. Do not import examples from unrelated companies.
4. PROFESSIONAL TONE: ${isThai ? 'ตอบเป็นภาษาไทยระดับนักวิเคราะห์การเงินสถาบัน (IB/Equity Research) ชัดเจน กระชับ ตรงประเด็น' : 'Respond in professional Wall Street Equity Research English.'}

OUTPUT FORMAT:
Respond STRICTLY with a raw JSON object wrapped in \`\`\`json ... \`\`\` matching this schema:
{
  "status": "warning" | "neutral" | "good" | "excellent",
  "status_label_th": "สรุปสถานะสั้นๆ 3-7 คำ (เช่น 'CapEx เร่งตัวฉุด FCF ติดลบ' หรือ 'Operating De-leverage')",
  "status_label_en": "Short status label 3-7 words (e.g. 'CapEx Surge Drives FCF Negative')",
  "what_is_it_th": "คำจำกัดความ/ความหมายของบรรทัดนี้ในงบการเงิน 1 ประโยคชัดเจนและเข้าใจง่าย (เช่น 'มูลค่ายอดขายรวมสุทธิจากการส่งมอบสินค้าและบริการทั้งหมดของบริษัทในรอบระยะเวลา')",
  "what_is_it_en": "Clear 1-sentence definition of this financial statement line item",
  "interpretation_th": "วิเคราะห์เชิงลึก 2-4 ประโยค ระบุตัวเลขจริง ชี้สาเหตุต้นตอ และผลกระทบข้ามงบการเงิน (เช่น OCF, FCF, Margin)",
  "interpretation_en": "In-depth 2-4 sentence analysis citing actual figures and cross-statement impact",
  "pros_th": ["ข้อดีหรือผลเชิงบวกที่เป็นจริง 2 ข้อ"],
  "pros_en": ["Realistic positive aspects 2 bullets"],
  "benchmark_th": "เกณฑ์มาตรฐานหรือมุมมองเปรียบเทียบในอุตสาหกรรม/กลุ่มคู่แข่ง",
  "benchmark_en": "Industry benchmark context",
  "watchouts_th": "จุดเฝ้าระวังและความเสี่ยงทางการเงินที่ต้องจับตาอย่างใกล้ชิด",
  "watchouts_en": "Key financial risks and watch items"
}`;

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
