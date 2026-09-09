import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";

function loadAgentFiles(dir: string, basePath: string): Array<{type: string, content: string, target: string}> {
  let files: Array<{type: string, content: string, target: string}> = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const targetPath = path.posix.join(basePath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(loadAgentFiles(fullPath, targetPath));
    } else {
      files.push({
        type: "inline",
        content: fs.readFileSync(fullPath, "utf-8"),
        target: targetPath
      });
    }
  }
  return files;
}

async function createInteractionWithRetry(res: any, opts: any) {
  let attempt = 0;
  let currentOpts = { ...opts };
  const fallbackModel = 'gemini-3.7-flash';

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
      
      console.warn(`[429 Rate Limit] Waiting ${retryInSecs}s before retry...`);
      if (res) {
        res.write(`data: ${JSON.stringify({ type: 'thinking', text: `Rate limit reached. Waiting ${retryInSecs} seconds to retry...` })}\n\n`);
      }
      
      await new Promise(r => setTimeout(r, retryInSecs * 1000));
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


async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/tts", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Missing text." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const interaction = await ai.interactions.create({
        model: 'gemini-3.1-flash-tts-preview',
        input: text,
        response_modalities: ['audio'],
        generation_config: {
          speech_config: [
            {
              speaker: "Speaker 1",
              language: "en-us",
              voice: "kore"
            },
            {
              speaker: "Speaker 2",
              language: "en-us",
              voice: "aoede"
            }
          ]
        }
      });

      let audioBuffer = null;
      let mimeType = "audio/wav";

      for (const step of interaction.steps) {
        if (step.type === 'model_output') {
          const audioContent = step.content?.find(c => c.type === 'audio');
          if (audioContent && audioContent.data) {
            const pcmBuffer = Buffer.from(audioContent.data, 'base64');
            
            // If it's raw PCM, wrap it in a WAV header so browsers can play it
            if (audioContent.mime_type === 'audio/l16' || !audioContent.mime_type) {
              const sampleRate = 24000;
              const numChannels = 1;
              const wavHeader = Buffer.alloc(44);
              wavHeader.write("RIFF", 0);
              wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
              wavHeader.write("WAVE", 8);
              wavHeader.write("fmt ", 12);
              wavHeader.writeUInt32LE(16, 16);
              wavHeader.writeUInt16LE(1, 20);
              wavHeader.writeUInt16LE(numChannels, 22);
              wavHeader.writeUInt32LE(sampleRate, 24);
              wavHeader.writeUInt32LE(sampleRate * numChannels * 2, 28);
              wavHeader.writeUInt16LE(numChannels * 2, 32);
              wavHeader.writeUInt16LE(16, 34);
              wavHeader.write("data", 36);
              wavHeader.writeUInt32LE(pcmBuffer.length, 40);
              
              audioBuffer = Buffer.concat([wavHeader, pcmBuffer]);
              mimeType = "audio/wav";
            } else {
              audioBuffer = pcmBuffer;
              mimeType = audioContent.mime_type;
            }
          }
        }
      }

      if (audioBuffer) {
        res.setHeader("Content-Type", mimeType);
        res.send(audioBuffer);
      } else {
        res.status(500).json({ error: "Failed to generate audio content" });
      }
    } catch (error: any) {
      console.error("[TTS] Error:", error);
      res.status(500).json({ error: error.message || "TTS Generation failed" });
    }
  });


  // In-memory cache for Live AI Financial Analyst row insights
  const metricInsightCache = new Map<string, any>();

  app.post("/api/analyze-metric", async (req, res) => {
    try {
      const {
        ticker = 'TSLA',
        companyName = 'Tesla, Inc.',
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

      if (!metricKey || !metricName) {
        return res.status(400).json({ error: "Missing metricKey or metricName" });
      }

      // Cache lookup key
      const cacheKey = `${ticker}_${metricKey}_${(historyValues || []).join(',')}_${isThai ? 'th' : 'en'}_${model}`;
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
Analyze the following financial statement metric for **${companyName} (${ticker})**:

- Metric: ${metricName} (Key: ${metricKey})
- Historical Sequence across recent periods: ${historySummary}
${contextSummary ? `- Wider Financial Statement Context (recent 4 quarters in $M):\n${contextSummary}` : ''}
${redFlagsSummary ? `- Related Red Flags from 10-K/10-Q filings: ${redFlagsSummary}` : ''}

CRITICAL INSTITUTIONAL ANALYSIS RULES:
1. STRICT DATA FIDELITY: Never produce generic canned praise (e.g. do NOT say 'ยอดเยี่ยม' or 'ลงทุนเพื่ออนาคต' if CapEx surged > 100% causing FCF to turn negative, or if EBIT contracted by > 50% from price wars).
2. CROSS-STATEMENT SYNTHESIS: Connect this line item directly to the rest of the financial statements (e.g. explain how a massive CapEx outflow of -$5.79B in investing cash flow outpaced operating cash flow of ~$4.7B, plunging Free Cash Flow into negative -$1.09B; or how SG&A overhead and price cuts caused operating de-leverage).
3. CAUSALITY & DRIVERS: Ground the explanation in ${companyName}'s actual business operations (e.g. for Tesla: AI training clusters / Cortex compute, Gigafactory tooling, Robotaxi/FSD development, EV price competition, energy storage margins).
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

  app.post("/api/upload_artifact", express.raw({ type: '*/*', limit: '50mb' }), (req, res) => {
    try {
        const fileName = req.query.name || 'podcast_briefing.wav';
        const localArtifactsDir = path.join(process.cwd(), 'workspace', 'artifacts');
        if (!fs.existsSync(localArtifactsDir)) {
            fs.mkdirSync(localArtifactsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(localArtifactsDir, fileName as string), req.body);
        console.log(`[upload] Successfully saved ${fileName} (${req.body.length} bytes)`);
        res.json({ success: true });
    } catch (e) {
        console.error("[upload] Error:", e);
        res.status(500).json({ error: String(e) });
    }
  });

  app.get("/api/download_jsonl", (req, res) => {
    const ticker = req.query.ticker;
    if (!ticker) {
      return res.status(400).send("Missing ticker");
    }
    
    const runLogsDir = path.join(process.cwd(), 'run_logs');
    if (!fs.existsSync(runLogsDir)) {
      return res.status(404).send("No logs found");
    }
    
    const files = fs.readdirSync(runLogsDir)
      .filter(f => f.startsWith(`run_log_${ticker}_`) && f.endsWith('.jsonl'))
      .sort((a, b) => {
        // extract timestamp
        const aMatch = a.match(/_(\d+)\.jsonl$/);
        const bMatch = b.match(/_(\d+)\.jsonl$/);
        if (aMatch && bMatch) {
          return parseInt(bMatch[1]) - parseInt(aMatch[1]);
        }
        return 0;
      });
      
    if (files.length === 0) {
      return res.status(404).send("No JSONL log found for ticker");
    }
    
    const latestFile = path.join(runLogsDir, files[0]);
    res.download(latestFile);
  });

  app.get("/api/live-quotes", async (req, res) => {
    try {
      const symbolsParam = (req.query.symbols as string) || (req.query.tickers as string) || '';
      if (!symbolsParam) {
        return res.status(400).json({ error: "Missing 'symbols' query parameter" });
      }

      const rawSymbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (rawSymbols.length === 0) {
        return res.status(400).json({ error: "No valid symbols provided" });
      }

      const mappedSymbols = rawSymbols.map(s => (s === 'SQ' ? 'XYZ' : s));
      const quotes: Record<string, any> = {};

      // 1. Try Authenticated Yahoo Finance Quote (multi-symbol)
      let cookie = '';
      let crumb = '';
      try {
        const cRes = await fetch('https://fc.yahoo.com', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(3500)
        });
        cookie = cRes.headers.get('set-cookie') || '';
        const crRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
          signal: AbortSignal.timeout(3500)
        });
        crumb = await crRes.text();
        if (crumb && crumb.length < 50 && !crumb.includes('<')) {
          const quoteUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${mappedSymbols.join(',')}&crumb=${encodeURIComponent(crumb)}`;
          const qRes = await fetch(quoteUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
            signal: AbortSignal.timeout(4000)
          });
          if (qRes.ok) {
            const qJson: any = await qRes.json();
            const list = qJson?.quoteResponse?.result || [];
            for (const q of list) {
              const sym = q.symbol?.toUpperCase();
              if (sym) {
                const capNum = q.marketCap || null;
                const capStr = capNum
                  ? (capNum >= 1e12 ? `$${(capNum / 1e12).toFixed(2)}T` : (capNum >= 1e9 ? `$${(capNum / 1e9).toFixed(2)}B` : `$${(capNum / 1e6).toFixed(1)}M`))
                  : null;
                quotes[sym] = {
                  symbol: sym,
                  price: q.regularMarketPrice ?? null,
                  changePercent: q.regularMarketChangePercent ?? null,
                  change: q.regularMarketChange ?? null,
                  marketCap: capStr,
                  marketCapRaw: capNum,
                  trailingPE: q.trailingPE ? Number(q.trailingPE.toFixed(1)) : null,
                  forwardPE: q.forwardPE ? Number(q.forwardPE.toFixed(1)) : null,
                  fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
                  fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
                  volume: q.regularMarketVolume ?? null,
                  shortName: q.shortName || q.longName || sym
                };
              }
            }

            // 1b. Fetch quoteSummary for complete Valuation Measures (pegRatio, priceToSales, priceToBook, enterpriseToRevenue, enterpriseToEbitda)
            await Promise.all(mappedSymbols.map(async (s) => {
              try {
                const qsUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(s)}?modules=defaultKeyStatistics,summaryDetail,financialData,upgradeDowngradeHistory,recommendationTrend&crumb=${encodeURIComponent(crumb)}`;
                const qsRes = await fetch(qsUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
                  signal: AbortSignal.timeout(4000)
                });
                if (qsRes.ok) {
                  const qsJson: any = await qsRes.json();
                  const res0 = qsJson?.quoteSummary?.result?.[0];
                  if (res0) {
                    const ks = res0.defaultKeyStatistics || {};
                    const sd = res0.summaryDetail || {};
                    const fd = res0.financialData || {};
                    const ugh = res0.upgradeDowngradeHistory || {};
                    const rt = res0.recommendationTrend || {};

                    if (!quotes[s]) {
                      quotes[s] = { symbol: s };
                    }

                    // Key Valuation Measures
                    if (ks.pegRatio?.raw !== undefined) quotes[s].pegRatio = Number(ks.pegRatio.raw.toFixed(2));
                    if (sd.priceToSalesTrailing12Months?.raw !== undefined) quotes[s].priceToSales = Number(sd.priceToSalesTrailing12Months.raw.toFixed(2));
                    const pb = ks.priceToBook?.raw ?? sd.priceToBook?.raw ?? quotes[s].priceToBook;
                    if (pb !== undefined && pb !== null) quotes[s].priceToBook = Number(pb.toFixed(2));
                    if (ks.enterpriseToRevenue?.raw !== undefined) quotes[s].enterpriseToRevenue = Number(ks.enterpriseToRevenue.raw.toFixed(2));
                    if (ks.enterpriseToEbitda?.raw !== undefined) quotes[s].enterpriseToEbitda = Number(ks.enterpriseToEbitda.raw.toFixed(2));
                    if (ks.enterpriseValue?.raw !== undefined) {
                      quotes[s].enterpriseValueRaw = ks.enterpriseValue.raw;
                      const evNum = ks.enterpriseValue.raw;
                      quotes[s].enterpriseValue = evNum >= 1e12 ? `$${(evNum / 1e12).toFixed(2)}T` : (evNum >= 1e9 ? `$${(evNum / 1e9).toFixed(2)}B` : `$${(evNum / 1e6).toFixed(1)}M`);
                    }

                    // Multiples refinement
                    if (quotes[s].trailingPE === null && sd.trailingPE?.raw) quotes[s].trailingPE = Number(sd.trailingPE.raw.toFixed(1));
                    if (quotes[s].forwardPE === null && (ks.forwardPE?.raw || sd.forwardPE?.raw)) {
                      quotes[s].forwardPE = Number((ks.forwardPE?.raw || sd.forwardPE?.raw).toFixed(1));
                    }

                    // Margins and Growth
                    if (fd.revenueGrowth?.raw !== undefined) quotes[s].revenueGrowthYoY = Number((fd.revenueGrowth.raw * 100).toFixed(1));
                    if (fd.grossMargins?.raw !== undefined) quotes[s].grossMargin = Number((fd.grossMargins.raw * 100).toFixed(1));
                    if (fd.profitMargins?.raw !== undefined) quotes[s].netMargin = Number((fd.profitMargins.raw * 100).toFixed(1));

                    // Real Wall Street Consensus & Analyst Ratings
                    quotes[s].forecast_data = {
                      financialData: {
                        targetHighPrice: fd.targetHighPrice?.raw,
                        targetLowPrice: fd.targetLowPrice?.raw,
                        targetMeanPrice: fd.targetMeanPrice?.raw,
                        targetMedianPrice: fd.targetMedianPrice?.raw,
                        recommendationKey: fd.recommendationKey,
                        numberOfAnalystOpinions: fd.numberOfAnalystOpinions?.raw,
                        currentPrice: fd.currentPrice?.raw || quotes[s].price
                      },
                      recommendationTrend: rt.trend || [],
                      upgradeDowngradeHistory: (ugh.history || []).slice(0, 15)
                    };
                  }
                }
              } catch (err) {
                // Ignore individual quoteSummary error
              }
            }));
          }
        }
      } catch (e) {
        console.warn("[/api/live-quotes] Yahoo cookie/crumb fetch error:", e);
      }

      // 2. Fallback to chart endpoint for any missing symbol
      const missingSymbols = mappedSymbols.filter(s => !quotes[s] || quotes[s].price === null);
      if (missingSymbols.length > 0) {
        await Promise.all(missingSymbols.map(async (sym) => {
          try {
            const chartRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}`, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              signal: AbortSignal.timeout(3500)
            });
            if (chartRes.ok) {
              const cJson: any = await chartRes.json();
              const meta = cJson?.chart?.result?.[0]?.meta;
              if (meta && typeof meta.regularMarketPrice === 'number') {
                quotes[sym] = {
                  symbol: sym,
                  price: meta.regularMarketPrice,
                  changePercent: meta.regularMarketChangePercent ?? null,
                  change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice),
                  marketCap: null,
                  marketCapRaw: null,
                  trailingPE: null,
                  forwardPE: null,
                  fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
                  fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
                  volume: meta.regularMarketVolume ?? null,
                  shortName: meta.shortName || sym
                };
              }
            }
          } catch (err) {
            console.warn(`[/api/live-quotes] Fallback chart error for ${sym}:`, err);
          }
        }));
      }

      if (rawSymbols.includes('SQ') && quotes['XYZ']) {
        quotes['SQ'] = { ...quotes['XYZ'], symbol: 'SQ' };
      }

      return res.json({
        quotes,
        asOf: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[/api/live-quotes] Unexpected error:", error);
      return res.status(500).json({ error: error?.message || "Internal server error" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { ticker, instruction, origin, model, language, analysisType, useSelfConsistency } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker." });
      }
      if (!process.env.GEMINI_API_KEY?.trim()) {
        return res.status(503).json({
          error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาเพิ่มคีย์ในไฟล์ .env แล้วเริ่มเซิร์ฟเวอร์ใหม่",
          code: "GEMINI_API_KEY_MISSING"
        });
      }

      console.log(`[analyze] Starting analysis for ${ticker} using model ${model || 'default'}, language ${language || 'English'}, type ${analysisType || 'fundamental'}`);
      
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents");
      
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const publicUrl = origin || `${protocol}://${host}`;

      const now = new Date();
      const todayISO = now.toISOString().split('T')[0];
      const currentYear = now.getFullYear();

      let finalInstruction = `DATA INTEGRITY REQUIREMENTS (apply to every ticker and every section):
- Never invent values to complete a table, price history, analyst consensus, institutional holdings, or citations. If unavailable, omit the optional section/field or use null for a missing numeric observation. Never use 0 as a missing-data placeholder.
- Financial statements: extract the exact fiscal period and GAAP/non-GAAP basis from the original filing column. Do not confuse prior-year adjusted EPS with current-year GAAP EPS. Keep cash flow YTD separate from standalone quarters. Preserve USD millions and per-share units.
- financial_statements.source is required: copy the exact primary filing URL, document type, filing date, period-end date, and the literal unit "USD millions" from the retrieved filing. It must match findings[0].sourceUrl. If the filing cannot be retrieved, omit financial_statements rather than filling estimates.
- Attach source URL and as-of date to each available section; cite the actual filing URL returned by retrieval, never construct guessed SEC accession numbers or label HTML as PDF.
- YoY compares the same fiscal quarter one year earlier. QoQ compares adjacent fiscal quarters. Do not substitute QoQ when YoY history is unavailable.
- Cash plus short-term investments minus interest-bearing debt defines net cash for this report. Use the same balance sheet date; do not substitute current assets for cash. Negative values mean net debt. Disclose any different treatment of long-term investments.
- If a filing separates marketable debt securities from marketable equity securities, put only cash/cash equivalents and marketable debt securities in cash_and_equivalents plus short_term_investments and in Net Cash. Do not silently include marketable equity securities, goodwill, or other current assets.
- Regional and product revenue must be extracted independently and reconcile to total revenue within rounding tolerance. Do not rescale or invent regional values to force totals to match.
- Use one dated source/population for analyst consensus across sections. If sources differ, label the provider, date and analyst count explicitly. Never attribute invented text to Morningstar or another analyst.
- Benchmarks require identified peer constituents, source and calculation date. Missing benchmarks stay unavailable. Never claim SEC reconciliation or auditing solely because accounting identities balance.
- DCF and technical indicators must identify inputs and dates. Do not manufacture OHLC history, RSI, MACD or forecasts. Distinguish estimates from observed values.

Find and analyze the absolute latest real-time public information, official SEC filings, verified financial statements, and live market data for ${ticker}.

CRITICAL REAL-TIME & AUTHENTICITY MANDATE:
1. TODAY'S EXACT DATE: Today is ${todayISO} (Year ${currentYear}). ALL DATA MUST BE AS CURRENT AS POSSIBLE (UP TO TODAY ${todayISO}).
2. LIVE MARKET REALITY: The current stock price, market cap, valuation multiples (TTM P/E, Forward P/E, EV/EBITDA, P/S, P/B), 52-week high/low, and technical indicators MUST be fetched from live searches (Yahoo Finance, Google Finance, Bloomberg, TradingView) as of TODAY (${todayISO}). NEVER use outdated past years or placeholder example values from the schema.
   - For Forward P/E: Always use standard NTM (Next Twelve Months / FY+1) consensus EPS estimates from mainstream financial aggregators (e.g., for TSLA, NTM consensus EPS is ~$1.95–$2.05 giving Forward P/E ~175x–185x; avoid mixing in far-out FY+2/FY2027 estimates which artificially distort Forward P/E to ~125x).
   - For EV/EBITDA & PEG: Extract live EV/EBITDA directly from current market statistics (e.g., for TSLA EV/EBITDA is ~120x–132x; and PEG Ratio is based on 5-year expected EPS growth ~6.5x–8.5x).
3. 100% REAL DATA & ZERO HALLUCINATIONS: Every single metric, revenue number, margin percentage, cash flow, debt level, institutional holder name, and insider transaction MUST come from verified, authentic public records (SEC Form 10-K, 10-Q, 8-K, Form 4, 13F filings, and official investor relations).
4. EXHAUST ALL SEARCH EFFORTS: You MUST execute multiple thorough web searches to locate authentic figures for all required fields.
5. NO INVENTED NUMBERS: If a specific niche metric or disclosure truly cannot be found after exhaustive searching, explicitly state "ไม่พบข้อมูล" (Data not available / No disclosure found) rather than fabricating or guessing plausible numbers.
6. PEER BENCHMARK & TARGET TICKER LIVE SEARCH MANDATE:
   - SELECT DIRECT, MODERN PURE-PLAY PEERS: Always select the most direct, relevant, and modern public peers in the same niche industry:
     * For Space & Orbital Launch (e.g., RKLB): You MUST compare with pure-play space companies like ASTS (AST SpaceMobile), LUNR (Intuitive Machines), RDW (Redwire), PL (Planet Labs), and explicitly benchmark and compare against SpaceX (Launch dominance, Starlink, private market cap ~$210B–$350B) in the commentary and key takeaways!
     * For AI Infrastructure & Chips (e.g., NVDA): Compare with AMD, AVGO (Broadcom), TSM (TSMC), INTC.
     * For Enterprise AI & Data Platforms (e.g., PLTR): Compare with SNOW, MDB, DDOG, C3.ai (AI).
     * For Digital Banking & Fintech (e.g., SOFI): Compare with HOOD (Robinhood), UPST (Upstart), NU (Nu Holdings), AFRM (Affirm).
     * For EV & Clean Energy (e.g., TSLA): Compare with BYDDF (BYD), RIVN (Rivian), GM, LCID.
   - For ${ticker} AND all peer companies listed in "peer_comparison" (e.g., ASTS, RDW, PL, AMD, TSM, BYD, etc.), you MUST execute dedicated live web searches to retrieve their LIVE current stock price, Market Cap, and P/E ratios (Trailing and Forward) as of TODAY (${todayISO}).
   - For example: TSLA Market Cap is ~$1.40 Trillion (stock price ~$353, NOT $1.14T from past quarters); RKLB Market Cap is ~$38B–$41B (stock price ~$62–$64); ASTS Market Cap is ~$24B (stock price ~$62); AMD is ~$745B–$770B; EOSE is ~$1.32B (stock price ~$3.65).
   - NEVER rely on static memory or outdated pre-training knowledge. All Market Caps, P/E multiples, and margins in "peer_comparison" MUST match live financial reality as of TODAY (${todayISO}).
   - STRICT GAAP ACCOUNTING IDENTITIES:
     * Gross Profit = Revenue - COGS
     * Operating Income = Gross Profit - Operating Expenses
     * Total Assets = Total Liabilities + Total Equity
     * Free Cash Flow = Operating Cash Flow - CapEx
   - CROSS-SECTION MARGIN & FINANCIAL STATEMENTS CONSISTENCY (อัตรากำไรในงบการเงินต้องตรงกับ Peer Comparison และ Five Pillars ทุกจุด ห้ามขัดแย้งกันเองเด็ดขาด):
     * The Gross Margin, Operating Margin, and Net Margin reported in the 4th (latest) quarter of "financial_statements" MUST match the target ticker metrics in "peer_comparison" and "five_pillars.profitability".
     * For Tesla (TSLA): The authentic SEC Form 8-K / 10-Q figures are: Q2 2026 Revenue $28,236M ($28.24B), Gross Profit $4,750M (Gross Margin 16.8%), Operating Income $398M (Operating Margin 1.4%), Net Income $1,114M (Net Margin ~3.95%), EPS $0.32, CapEx $5,790M, Free Cash Flow -$1,090M (deficit). NEVER report inflated Net Income ($3.12B) or Operating Income ($3.84B / 12.75%), as this is nearly 10x higher than reality and causes severe cross-section contradiction!
     * BANNED HISTORICAL EXTRAPOLATION: NEVER synthesize historical quarters (Q3 2025, Q4 2025, Q1 2026) using artificial fixed linear slope steps from the latest quarter. Every quarter must reflect actual 10-Q/8-K results.
8. MANDATORY LATEST QUARTER SEC FILINGS IN FINDINGS & VALUATION CONSISTENCY (เอกสารและงบการเงินต้องเป็นไตรมาสล่าสุดเสมอเพื่อให้คำนวณตรงกัน):
   - PRIMARY CITATION MANDATE: The first document in "findings" (findings[0]) MUST ALWAYS be the latest SEC Form 10-Q (or latest Form 10-K if the company recently completed its fiscal year-end).
   - In "findings[0]", explicitly label "documentType" with the quarter period (e.g., "Form 10-Q (Q1 2026)" or "Form 10-Q (ไตรมาสล่าสุด)"), provide the exact filing date, and include key insights summarizing the latest balance sheet liquidity (Cash & ST Investments), total debt, dilution/shares outstanding, and revenue performance.
   - 100% MATHEMATICAL ALIGNMENT (คำนวณตรงกัน): The balance sheet figures (Cash, Short-Term Investments, Total Debt, Diluted Shares Outstanding) from this latest quarter filing MUST directly align with:
     * The 4th (latest) quarter in "financial_statements"
     * Enterprise Value calculation (EV = Market Cap + Total Debt - Cash)
     * DCF Intrinsic Value starting balance sheet (Net Cash = Cash - Debt)
     * Diluted shares count used for Per Share metrics.
   - Do NOT cite an old 2023 or 2024 filing as the primary finding when 2025/2026 quarterly filings have been published. Citing outdated documents while calculating against live 2026 market prices causes severe calculation discrepancies (คำนวณไม่ตรงกัน) and is STRICTLY PROHIBITED.
9. MANDATORY 4 QUARTERS IN EARNINGS ANALYSIS (ประวัติผลประกอบการต้องมีครบ 4 ไตรมาส ห้ามมีอันเดียวเด็ดขาด):
   - In "earnings_analysis.past_earnings_history", you MUST provide EXACTLY the last 4 completed quarters (e.g., Q3 2025 -> Q4 2025 -> Q1 2026 -> Q2 2026), matching the chronological order of "financial_statements.periods".
   - NEVER output only 1 single quarter! Outputting only 1 quarter ruins the beat streak chart and will be severely penalized.
   - For all 4 quarters, provide: "period", "report_date", "eps_estimate", "eps_actual", "eps_surprise_pct", "revenue_estimate_musd", "revenue_actual_musd", "revenue_surprise_pct", "stock_reaction_1d_pct", "guidance_change", and "beat_or_miss".
10. TESLA (TSLA) AUTONOMY & DCF SCENARIO NARRATIVE GROUNDING (สมมติฐาน DCF ต้องอิงข้อเท็จจริง ไม่เขียนล้าหลัง):
    - Current Reality: Tesla has ALREADY launched unsupervised commercial Robotaxi operations in Austin (mid-2025) and expanded to Dallas and Houston in 2026.
    - Bear Case: NEVER write "Robotaxi ล่าช้าไปถึงปี 2028" or "ยังไม่เปิดให้บริการ" because it is already operational. The Bear risk is commercial scaling bottlenecks: "กรณี Robotaxi ขยายสเกลเชิงพาณิชย์ได้ช้ากว่าที่บริษัทเคยประกาศไว้มาก (ยังจำกัดอยู่ในวงแคบไม่กี่พันคันภายในปี 2028 จากข้อจำกัดทางกฎหมายและความปลอดภัย) และการแข่งขันด้านราคา EV ยังคงกดดันอัตรากำไร".
    - Base Case: Aligns with Elon Musk's Q1 2026 guidance (revenue material in 2027) ➡️ "กรณี Robotaxi เริ่มสร้างกระแสเงินสดที่มีนัยสำคัญใน 10-15 เมืองใหญ่ของสหรัฐฯ ตั้งแต่ปี 2027".
    - Bull Case: "กรณี Cybercab ผลิตเชิงพาณิชย์เต็มกำลัง และ Optimus เริ่มส่งมอบเชิงอุตสาหกรรมช่วงปลายปี 2027 พร้อม FSD Unsupervised ปลดล็อคทั่วประเทศ" (ถ่วงน้ำหนักความน่าจะเป็นต่ำตาม track record การเลื่อนแผน).
11. MANDATORY AUTHENTIC SEGMENT REVENUE BREAKDOWN (สัดส่วนรายได้ตามสายธุรกิจและภูมิภาคต้องดึงจาก 10-Q/10-K จริง ห้ามเดาหรือใช้สัดส่วนเก่า):
     - In "business_analysis.revenue_breakdown.by_business":
       * You MUST search and extract the authentic segment revenue breakdown from the latest Form 10-Q or 10-K "Product and Service Information" or Segment Footnote table for the latest reported quarter.
       * For Apple (AAPL): The breakdown MUST report Apple's 5 official segments for the latest quarter (Q3 FY2026 ended June 27, 2026):
         1) iPhone: ~$54,250M (~49.58% of total revenue)
         2) Services: ~$30,739M (~28.09% of total revenue)
         3) Mac: ~$10,350M (~9.46% of total revenue, +28.7% YoY)
         4) Wearables, Home & Accessories: ~$7,890M (~7.21% of total revenue)
         5) iPad: ~$6,190M (~5.66% of total revenue)
         Total Products (Hardware) = $54,250M + $10,350M + $7,890M + $6,190M = $78,680M (~$78.68B), Total Net Sales = $109,419M (~$109.4B).
         STRICTLY FORBIDDEN to inflate Wearables (e.g. to $14B+ which is holiday Q1) or deflate iPhone (e.g. to $47B)!
       * For Tesla (TSLA): Automotive, Energy Storage & Generation, Services & Other.
       * For NVIDIA (NVDA): Data Center, Gaming, Professional Visualization, Automotive, OEM.
       * For Microsoft (MSFT): Intelligent Cloud, Productivity & Business Processes, More Personal Computing.
       * For Alphabet (GOOGL): Google Search, YouTube ads, Google Cloud, Google Subscriptions/Devices, Network.
       - All segment revenue figures must mathematically sum to the Total Reported Revenue, and ratio_pct must sum to 100%.
12. MANDATORY WALL STREET 12-MONTH CONSENSUS ANCHORING FOR VALUATION SCENARIOS (สมมติฐานและการประเมินมูลค่าต้องอิง Consensus ตลาดข้ามทุก Sector ไม่สลับระหว่าง Base กับ Bull):
     - DEDICATED REAL-TIME CONSENSUS SEARCH: You MUST execute dedicated web searches (Yahoo Finance, TipRanks, FactSet, Bloomberg, MarketWatch) to retrieve the verified Wall Street 12-month Analyst Price Targets for ${ticker}:
       * Consensus Target Price (Mean or Median of all covering Wall Street analysts)
       * High Target Price (Street-High / Bullish outlier target)
       * Low Target Price (Street-Low / Bearish downside target)
     - STRICT SCENARIO MAPPING (CRITICAL FOR DETERMINISTIC ACCURACY ACROSS ALL STOCKS & SECTORS):
       * Base Case ("scenarios.base" & "summary.base_case_fair_value"): MUST ALWAYS be anchored to the Wall Street Mean/Median Consensus Target Price (or the mathematically consistent fundamental DCF baseline). It represents the most probable baseline expectations of institutional consensus. NEVER assign the Street-High outlier (e.g., $28 for SOFI, $160 for PLTR, $105 for HOOD, $275 for NVDA) to the Base Case, as doing so causes erratic swings between runs!
       * Bull Case ("scenarios.bull" & "summary.fair_value_range_high"): This is the designated home for the Street-High Target (Optimistic / Blue Sky / Best Execution scenario).
       * Bear Case ("scenarios.bear" & "summary.fair_value_range_low"): This is the designated home for the Street-Low Target (Downside risk / Execution bottleneck scenario).
     - UNIVERSAL SECTOR COVERAGE: This rule applies unconditionally to all tickers and sectors — Tech, FinTech, Banking, Healthcare, Consumer, Energy, Utilities, Space, and CleanTech.
     - DCF ASSUMPTIONS ALIGNMENT: Base revenue CAGR ("revenue_cagr_pct") and terminal margins ("terminal_margin_pct") must be realistically aligned with consensus guidance, avoiding arbitrary extremes.`;
      
      let dynamicSchema = ``;
      
      if (analysisType === 'technical') {
        finalInstruction += ` Focus entirely on technical analysis. Make sure that you are looking for the most up to date data and charts.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\nCRITICAL MANDATE - NATURAL INVESTOR THAI (ภาษาคนลงทุนจริง ไม่ใช้ภาษาหุ่นยนต์ AI):
          เขียนบทวิเคราะห์ทางเทคนิคด้วยภาษาไทยที่คนเทรดจริงใช้กัน เป็นธรรมชาติ เข้าใจง่าย กระชับ ตรงประเด็น ห้ามใช้ภาษาแปลเครื่องหรือสำนวน AI ซ้ำซาก (เช่น "สะท้อนให้เห็นถึง", "ในภูมิทัศน์ที่มีพลวัต", "เป็นสิ่งสำคัญยิ่งยวด")
          - ศัพท์เทคนิคการเงินที่นักลงทุนคุ้นเคย อนุญาตให้ใช้วงเล็บหรือทับศัพท์ได้ เช่น Buy on Dip, Breakout, Pullback, Stop-Loss, Take Profit, Sideways, Whipsaw, Confluence
          - STRICTLY FORBIDDEN to use Japanese or Chinese characters.
          
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: สรุปสถานะ (Buy / Wait / Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมด ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, MACD = ลบ, RSI = กลาง" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points ขึ้นบรรทัดใหม่แต่ละข้อเพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่หากหลุดจะทำให้แผนนี้เสียทรง)
          2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1.5x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน ห้ามใช้สูตรคำนวณแยก)
          3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ Buy on Dip), stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า จัดรูปแบบสูตร R:R ให้เป็น Markdown table ตารางที่มี 3 คอลัมน์ Target | Formula | Result โดยต้องใช้ \n ขึ้นบรรทัดใหม่ให้ถูกต้องตามหลัก Markdown)
          4) overall_trend: อธิบายภาพรวมแนวโน้มราคาแบบภาษาคนเทรด
          5) price_structure: โครงสร้างราคา (เช่น Higher Highs, Higher Lows หรือ Sideways Range)
          6) volume_analysis: วิเคราะห์ Volume การซื้อขาย สอดคล้องกับทิศทางราคาหรือไม่
          7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)
          8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง. CRITICAL: คุณต้องระบุชัดเจน 2 เรื่อง: 1. มี Bullish/Bearish Divergence หรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Divergence") 2. มี Candlestick pattern กลับตัวหรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Candlestick pattern ที่ชัดเจน"))
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: รูปแบบราคา (สำคัญ: ต้องวิเคราะห์ทั้ง Chart Pattern และ Candlestick Pattern เสมอ หากไม่พบรูปแบบที่ชัดเจนให้ระบุว่า "ไม่พบรูปแบบที่ชัดเจน" ห้ามข้ามหรือละเว้นเด็ดขาด)
          11) relative_strength: เทียบกับตลาด (เช่น เทียบกับ S&P 500 หรือ Nasdaq)
          12) technical_risks: ความเสี่ยงเชิงเทคนิคที่ต้องรู้ (ต้องตอบให้ครบ 4 ประเด็นนี้: 1. ความเสี่ยงจากสัญญาณหลอก (false breakout/whipsaw), 2. gap risk (เช่น ข่าว/earnings ถัดไป), 3. ความเสี่ยงจาก volume/liquidity ต่ำ, 4. สภาพตลาดปัจจุบัน trending หรือ choppy/sideways ห้ามตอบแค่ข้อเดียวแล้วข้ามข้ออื่น)
          13) beginner_summary: สรุปให้เข้าใจง่ายและตัดสินใจได้ตรงไปตรงมา:
           - technical_overview: สรุปทรงกราฟตอนนี้เป็นอย่างไรในภาษาคนทั่วไป
           - top_3_points: จุดเด่นหรือสัญญาณบวก 3 ข้อ
           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ
           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน (เช่น day/swing/position trade ต้องสอดคล้องกับแผนเข้าจริง ถ้าโซนเข้าซื้ออยู่สูงกว่าปัจจุบัน ห้ามเรียกว่า Buy on Dip เด็ดขาด)
          14) scoring: คะแนน 1-10 พร้อมเหตุผลที่กระชับและสมเหตุสมผล
          15) final_verdict_summary: สรุปภาพรวมและคำแนะนำสุดท้าย
          เงื่อนไขสำคัญ:
          - CRITICAL: สำหรับการวิเคราะห์ทางเทคนิค ต้องตอบให้ครบทุกหัวข้อ (1-15) และหัวข้อย่อย ห้ามข้ามหรือละเว้นเด็ดขาด หากไม่พบสัญญาณใด (เช่น ไม่มี Divergence, ไม่มี Candlestick pattern) ให้ระบุให้ชัดเจนว่า "ไม่พบสัญญาณในขณะนี้" แทนการเว้นว่าง
          - ห้ามใช้สำนวนภาษาที่ประดิษฐ์ขึ้นมาเอง ให้ใช้คำที่คนในวงการลงทุนใช้จริง
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง", "เติบโตดี" โดยไม่มีตัวเลขหรือข้อเท็จจริงเฉพาะเจาะจงรองรับ ทุกประโยคต้องมีตัวเลขจริงกำกับ เช่น "รายได้เติบโต 24% YoY"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ
          - เนื้อหาต้องชัดเจน กระชับ มีสาระ ตรงประเด็น ห้ามใส่น้ำหรือข้อความซ้ำซาก`;
        } else {
          finalInstruction += `\n\n\n\nCRITICAL: You MUST write ALL string values in the JSON output in English.
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: status (Buy/Wait/Avoid), trend_weekly/daily/4H, and confluence_score (List signals one by one using Markdown bullet points (one per line) whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, MACD = Negative, RSI = Neutral", do not just sum them up. Then summarize the direction and invalidation level).
          2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. CRITICAL RULE: Each S/R level MUST be at least 1.5x ATR away from the current price to avoid noise AND at least 1.5x ATR away from the next level. NEVER set them closer than this threshold. Skip to the next major level if too close).
          3) trade_plan: entry_zone (Numeric), stop_loss, target_1, target_2, risk_reward_ratio (CRITICAL: You MUST calculate and display the Risk/Reward ratio for BOTH Target 1 and Target 2 separately. Use the formula (Target - Entry) / (Entry - Stop-Loss) and show the exact numbers used for both calculations. You MUST format the R:R calculations as a Markdown table (Target | Formula | Result) using '\n' for newlines to ensure it renders correctly).
          4) overall_trend: Explain overall picture.
          5) price_structure: Price structure.
          6) volume_analysis: Volume analysis.
          7) trend_indicators: MA, MACD, ADX (CRITICAL: Indicators like MACD and ADX MUST be exact single current values, NOT ranges).
          8) momentum_indicators: RSI, Stochastic (CRITICAL: RSI and Stochastic MUST be single current values. You MUST explicitly state two things: 1. Is there Bullish/Bearish Divergence? (If no, print "No Divergence observed"). 2. Is there a reversal Candlestick pattern? (If no, print "No clear Candlestick pattern observed"))..
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: Chart patterns (CRITICAL: You must analyze BOTH Chart Patterns and Candlestick Patterns. If no clear pattern is found, explicitly state "No clear pattern observed". DO NOT skip this topic).
          11) relative_strength: Relative to market.
          12) technical_risks: Technical risks (MUST cover all 4 types: 1. False breakout/whipsaw risk, 2. Gap risk e.g., upcoming earnings/news, 3. Low volume/liquidity risk, 4. Current market regime trending vs choppy/sideways. Do not skip any of these 4.)
          13) beginner_summary: Straightforward summary for beginners:
           - technical_overview: Overall technical picture in simple terms.
           - top_3_points: 3 interesting points.
           - top_3_cautions: 3 cautions.
           - suitable_trade_style: Suitable style (day/swing/position, must match trade plan).
          14) scoring: Score 1-10 with reasons.
          15) final_verdict_summary: Final short summary.
          CRITICAL RULES:
          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;
        }
        
        dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": 85,
    "key_takeaways": ["...", "..."]
  },
  "technical_analysis": {
    "signal_summary": {
       "status": "Buy | Wait | Avoid",
       "trend_weekly": "Up | Down | Sideways",
       "trend_daily": "Up | Down | Sideways",
       "trend_4h": "Up | Down | Sideways",
       "confluence_score": "..."
    },
    "key_levels": {
       "current_price": 150.5,
       "support": ["...", "...", "..."],
       "resistance": ["...", "...", "..."]
    },
    "trade_plan": {
       "entry_zone": "...",
       "stop_loss": "...",
       "target_1": "...",
       "target_2": "...",
       "risk_reward_ratio": "..."
    },
    "overall_trend": "...",
    "price_structure": "...",
    "volume_analysis": "...",
    "trend_indicators": "...",
    "momentum_indicators": "...",
    "volatility_indicators": "...",
    "chart_patterns": "...",
    "relative_strength": "...",
    "technical_risks": "...",
    "beginner_summary": {
      "technical_overview": "...",
      "top_3_points": ["...", "..."],
      "top_3_cautions": ["...", "..."],
      "suitable_trade_style": "..."
    },
    "scoring": {
      "trend_clarity": { "score": 8, "reason": "..." },
      "momentum_strength": { "score": 8, "reason": "..." },
      "risk_reward": { "score": 8, "reason": "..." },
      "signal_confluence": { "score": 8, "reason": "..." },
      "false_signal_risk": { "score": 8, "reason": "..." },
      "overall_attractiveness": { "score": 8, "reason": "..." }
    },
    "final_verdict_summary": {
      "is_good_timing": "...",
      "what_to_wait_for": "...",
      "trade_plan": "..."
    }
  },
  ${analysisType !== 'technical' ? `"deep_insights": [
    {
      "category": "Risk Assessment",
      "title": "...",
      "description": "...",
      "impact_score": 8
    }
  ],` : ''}
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": "2026-05-15",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": "Aug '26", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q2 2026", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      } else if (analysisType === 'combined') {
        finalInstruction += ` Focus on BOTH fundamental analysis (company business, financials, management) AND technical analysis (price trends, support/resistance, indicators). Make sure that you are looking for the most up to date data, SEC filings, and charts.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\nCRITICAL MANDATE - NATURAL INVESTOR THAI (ภาษาคนลงทุนจริง ไม่ใช้ภาษาหุ่นยนต์ AI):
          เขียนบทวิเคราะห์ด้วยภาษาไทยที่นักลงทุนและนักวิเคราะห์หุ้นใช้กันจริงๆ เป็นธรรมชาติ ลื่นไหล เข้าใจง่าย กระชับ ตรงประเด็น ห้ามใช้ภาษาแปลเครื่องหรือคำประดิษฐ์ของ AI (เช่น "สะท้อนให้เห็นถึง", "ในภูมิทัศน์ที่มีพลวัต", "เป็นสิ่งสำคัญยิ่งยวด", "คูเมืองทางเศรษฐกิจ", "การเจือจางของหุ้น", "หัวเจาะหลักในการเติบโต")
          - ให้ใช้คำศัพท์การเงินที่เป็นสากลและนักลงทุนไทยคุ้นเคย โดยใส่วงเล็บหรือทับศัพท์ได้ เช่น Moat (ความได้เปรียบในการแข่งขัน), Pricing Power (อำนาจการตั้งราคา), Ecosystem, Recurring Revenue, Free Cash Flow (FCF), Dilution, Stock-Based Compensation (SBC), Buy on Dip, Stop-Loss
          - STRICTLY FORBIDDEN to use Japanese or Chinese characters.
          
          Please follow this specific guideline for BOTH Fundamental and Technical Analysis:
          
          - Fundamental Analysis:
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร สัดส่วนรายได้มาจากส่วนไหนมากที่สุด อธิบายให้คนทั่วไปฟังแล้วเข้าใจทันที (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งพาลูกค้ารายใหญ่ไม่กี่รายหรือกระจายตัวดี ลูกค้าเปลี่ยนไปใช้เจ้าอื่นง่ายไหม อะไรที่ผูกใจให้ลูกค้าอยู่ต่อ (เช่น switching cost หรือ ecosystem) (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นรายได้แบบขายครั้งเดียวหรือรายได้ประจำสม่ำเสมอ (Recurring Revenue) สัญญาการให้บริการเป็นแบบไหน คุณภาพกระแสเงินสดเป็นอย่างไร (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้และกำไรเติบโตอย่างไร อัตรากำไร (Margins) ดีขึ้นหรือลดลง กระแสเงินสดจากการดำเนินงานและ FCF เป็นบวกหรือไม่ ภาระหนี้สินน่าเป็นห่วงไหม (หากเป็นสถาบันการเงิน ให้ดูสภาพคล่อง อัตราส่วนเงินกองทุน และคุณภาพสินทรัพย์แทน) Valuation เมื่อเทียบกับกลุ่มอุตสาหกรรม และผลกระทบจาก Dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          5) เช็คคุณภาพพื้นฐาน (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a Markdown NUMBERED list (1., 2., 3.) to assess these 8 areas in detail, using '\n\n' to separate each point. DO NOT use bullets ('- ') before the numbers: 1.การเติบโตของรายได้ 2.การเติบโตของกำไร 3.คุณภาพกระแสเงินสด 4.ภาระหนี้สินและความเสี่ยงทางการเงิน 5.ความสามารถในการรักษาอัตรากำไร (Margins) 6.ผลตอบแทนต่อเงินลงทุน (ROIC/ROE) 7.โอกาสการเติบโตในระยะยาว 8.บทสรุปภาพรวม ("พื้นฐานแข็งแกร่ง", "มีจุดเด่นแต่ต้องระวัง", หรือ "พื้นฐานยังไม่น่าไว้วางใจ")
          6) จุดแข็งและความได้เปรียบในการแข่งขัน (for business_strengths): มี Moat ด้านใดบ้าง (แบรนด์, ขนาดธุรกิจ, Network Effect, สิทธิบัตร, ต้นทุน) เปรียบเทียบกับคู่แข่งหลัก 1-2 ราย ว่าเหนือกว่าตรงไหนและมีจุดอ่อนอะไร (CRITICAL: You MUST use a Markdown numbered list using '\n\n' to separate points, e.g. '1. ', '2. '. DO NOT use bullets '-' before the numbers.)
          7) โอกาสและปัจจัยเร่งการเติบโต (for future_growth): โอกาสสร้างการเติบโตใหม่ ปัจจัยหนุน (Catalysts) ที่น่าจับตาใน 6-12 เดือนข้างหน้า (CRITICAL: You MUST use a Markdown numbered list using '\n\n' to separate points, e.g. '1. ', '2. '. DO NOT use bullets '-' before the numbers.)
          8) ความเสี่ยงสำคัญที่ต้องจับตา (for key_risks): CRITICAL: You MUST cover at least 8 risk categories (การแข่งขัน, การกระจุกตัวของลูกค้า, นโยบายและกฎหมาย, ภาวะเศรษฐกิจมหภาค, แรงกดดันต่ออัตรากำไร, Valuation ที่อาจตึงตัว, Dilution/SBC, และความเสี่ยงแฝงที่คนมักมองข้าม) แต่ละข้อให้อธิบายเนื้อหาให้ครบถ้วน ชัดเจน พร้อมตัวเลขประกอบ (ใช้ Markdown numbered lists เช่น "1. ", "2. " และห้ามใช้ "- 1." เด็ดขาด)
          9) ฝีมือผู้บริหารและการจัดสรรเงินทุน (for management): ผู้บริหารมีประวัติการทำงานเป็นอย่างไร ผลงานจริงสอดคล้องกับเป้าหมายที่เคยให้ไว้ไหม สัดส่วนการถือหุ้นของผู้บริหาร (Insider Ownership) ให้ระบุเป็นตัวเลข % ชัดเจน (ถ้าไม่มีข้อมูลให้ระบุว่า "ไม่พบข้อมูลสัดส่วนการถือหุ้นในเอกสารทางการ"), การซื้อขายหุ้นของผู้บริหาร, และการจัดสรรเงินทุน (Capital Allocation เช่น การซื้อหุ้นคืน เงินปันผล หรือการลงทุน M&A)
          10) สรุปให้มือใหม่เข้าใจง่าย (for beginner_summary): 
           - business_type_simple: อธิบายโมเดลธุรกิจให้คนทั่วไปเข้าใจง่ายในไม่กี่บรรทัด
           - top_3_strengths / top_3_risks: สรุปจุดเด่น 3 ข้อ และจุดเสี่ยง 3 ข้อที่เข้าใจง่าย
           - suitable_investor_type: หุ้นตัวนี้เหมาะกับนักลงทุนสไตล์ไหน (เช่น ลงทุนระยะยาว, เติบโตสูง, หุ้นปันผล, หรือเก็งกำไร)
           - further_reading: หากต้องการศึกษาต่อ แนะนำให้อ่านเอกสารหรือประเด็นใดเพิ่มเติม
          11) การให้คะแนน (for scoring): ให้คะแนน 1-10 พร้อมเหตุผลสั้นๆ ตรงไปตรงมา สำหรับ understandability, revenue_quality, financial_strength, growth_potential, risk_level, overall_attractiveness
          12) บทสรุปสุดท้าย (for final_verdict_summary): สรุปว่าคุ้มค่าน่าศึกษาต่อหรือไม่ (worth_further_study), พื้นฐานแข็งแกร่งเพียงใด (strong_fundamentals), สิ่งสำคัญที่สุดที่ต้องเช็คให้ชัวร์ก่อนตัดสินใจลงทุน (what_to_look_for)
          
          - Technical Analysis:
          1) signal_summary: สรุปสถานะ (Buy / Wait / Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมด ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, RSI = บวก" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points ขึ้นบรรทัดใหม่แต่ละข้อเพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่ถ้าหลุดจะทำให้มุมมองเสียทรง)
          2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1.5x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน)
          3) trade_plan: แผนการเทรด จุดเข้า (ถ้าต่ำกว่าราคาปัจจุบันเป็น Buy on Dip), stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า จัดรูปแบบสูตร R:R ให้เป็น Markdown table ตารางที่มี 3 คอลัมน์ Target | Formula | Result โดยต้องใช้ \n ขึ้นบรรทัดใหม่ให้ถูกต้องตามหลัก Markdown)
          4) overall_trend: ภาพรวมแนวโน้มราคาแบบคนเทรด
          5) price_structure: โครงสร้างราคา (เช่น Higher Highs, Higher Lows หรือ Sideways)
          6) volume_analysis: พฤติกรรม Volume ซื้อขาย
          7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)
          8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง. CRITICAL: คุณต้องระบุชัดเจน 2 เรื่อง: 1. มี Bullish/Bearish Divergence หรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Divergence") 2. มี Candlestick pattern กลับตัวหรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Candlestick pattern ที่ชัดเจน"))
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: รูปแบบราคา (สำคัญ: ต้องวิเคราะห์ทั้ง Chart Pattern และ Candlestick Pattern เสมอ หากไม่พบรูปแบบที่ชัดเจนให้ระบุว่า "ไม่พบรูปแบบที่ชัดเจน" ห้ามข้ามหรือละเว้นเด็ดขาด)
          11) relative_strength: ความแข็งแกร่งเมื่อเทียบกับดัชนีตลาด
          12) technical_risks: ความเสี่ยงทางเทคนิคที่ต้องระวัง (สัญญาณหลอก/whipsaw, gap risk ก่อน earnings, สภาพคล่อง, และสภาวะตลาด trending vs sideways)
          13) beginner_summary: สรุปภาพรวมสำหรับนักลงทุน:
           - technical_overview: ทรงกราฟและทิศทางราคาในภาษาคนทั่วไป
           - top_3_points: จุดน่าสนใจ 3 ข้อ
           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ
           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน
          14) scoring: คะแนน 1-10 พร้อมเหตุผลตรงไปตรงมา
          15) final_verdict_summary: สรุปคำแนะนำสุดท้าย
          
          เงื่อนไขสำคัญ:
          - เน้นข้อเท็จจริง ตัวเลข และเหตุผล ห้ามใช้คำเยิ่นเย้อหรือคำชมลอยๆ โดยไม่มีข้อมูลสนับสนุน
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ข้อมูลราคาหุ้น, Market Cap, Trailing P/E (TTM), Forward P/E, EV/EBITDA, 52-Week Range ต้องใช้ข้อมูลสดล่าสุดของวันนี้เสมอ
          - ข้อมูล smart_money (13F): total_shares_held ต้องสอดคล้องกับ (shares_outstanding * pct_owned / 100) เช่น สำหรับ NVDA (~24.15B หุ้น, สถาบันถือ ~68.5%) จะต้องได้ ~16.5B หุ้น (ห้ามใช้ 1.28B เด็ดขาด), จำนวนสถาบัน total_institutions_count ต้องตรงกับข้อมูลจริงของหุ้นนั้น (เช่น NVDA ~5,600 แห่ง), ใน major_holders[].shares_held ต้องระบุเป็นจำนวนหุ้น (เช่น "2.98B" หรือ "230M") ห้ามใส่เครื่องหมาย % ซ้ำในช่องจำนวนหุ้น, และ shareholder_activity ต้องใส่ข้อมูลการปรับพอร์ต 13F ทั้งฝั่งซื้อเพิ่ม (increase) และขายลด (decrease) เสมอ ห้ามปล่อยว่าง
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;
        } else {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.
          - For smart_money (13F): total_shares_held MUST equal (shares_outstanding * pct_owned / 100) (e.g. for NVDA ~24.15B shares, ~68.5% institutional ownership = ~16.5B shares, NOT 1.28B). total_institutions_count must reflect true 13F filers (~5,600 for NVDA). major_holders[].shares_held MUST be in shares (e.g. "2.98B"), NEVER a percent string. shareholder_activity MUST contain both increase and decrease 13F rows.
          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;
        }
        
        dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": 85,
    "key_takeaways": ["...", "..."]
  },
  "financial_statements": {
    "currency": "USD",
    "fiscal_period_type": "quarterly",
    "as_of_date": "2026-09-01",
    "source": { "document_url": "https://www.sec.gov/...", "document_type": "Form 10-Q", "filing_date": "2026-08-26", "period_end": "2026-07-26", "units": "USD millions" },
    "periods": ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"],
    "income_statement": {
      "revenue": [726, 828, 884, 1004],
      "cogs": [146, 164, 150, 160],
      "gross_profit": [580, 664, 734, 844],
      "gross_margin_pct": [79.9, 80.2, 83.0, 84.1],
      "operating_expenses": [385, 382, 345, 371],
      "operating_income": [195, 282, 389, 473],
      "operating_margin_pct": [26.8, 34.0, 44.0, 47.1],
      "income_before_tax": [170, 100, 260, 380],
      "income_tax_expense": [27, 21, 46, 54],
      "net_income": [143, 79, 214, 326],
      "net_margin_pct": [19.7, 9.5, 24.2, 32.5],
      "eps_diluted": [0.06, 0.03, 0.08, 0.13],
      "yoy_revenue_growth_pct": [63, 70, 85, 93],
      "commentary": "..."
    },
    "balance_sheet": {
      "cash_and_equivalents": [2150, 2320, 2550, 2800],
      "short_term_investments": [2450, 2580, 2850, 3200],
      "total_current_assets": [5150, 5520, 6050, 6750],
      "accounts_receivable": [390, 410, 435, 460],
      "inventory": [0, 0, 0, 0],
      "net_ppe": [280, 310, 335, 360],
      "total_assets": [5820, 6240, 6780, 7490],
      "total_current_liabilities": [680, 720, 780, 850],
      "accounts_payable": [180, 195, 210, 230],
      "short_term_debt": [0, 0, 0, 0],
      "total_debt": [0, 0, 0, 0],
      "total_liabilities": [920, 980, 1050, 1150],
      "total_equity": [4900, 5260, 5730, 6340],
      "current_ratio": [7.57, 7.67, 7.76, 7.94],
      "quick_ratio": [7.57, 7.67, 7.76, 7.94],
      "debt_to_equity": [0, 0, 0, 0],
      "debt_to_ebitda": [0, 0, 0, 0],
      "commentary": "..."
    },
    "cash_flow": {
      "operating_cash_flow": [420, 480, 510, 620],
      "depreciation": [22, 24, 25, 26],
      "change_working_capital": [114, 127, 116, 108],
      "capex": [5, 6, 7, 8],
      "investing_cash_flow": [-180, -210, -240, -280],
      "free_cash_flow": [415, 474, 503, 612],
      "fcf_margin_pct": [57.2, 57.2, 56.9, 61.0],
      "fcf_vs_net_income_ratio": [2.88, 2.65, 2.35, 1.88],
      "financing_cash_flow": [-45, -50, -55, -60],
      "stock_issuance_repurchase": [-45, -50, -55, -60],
      "dividends_paid": [0, 0, 0, 0],
      "ending_cash": [2150, 2320, 2550, 2800],
      "net_change_cash": [195, 170, 230, 250],
      "commentary": "..."
    },
    "red_flags": ["..."]
  },
  "valuation_ratios": [
    {
      "name": "P/E (Trailing)",
      "formula": "ราคาหุ้นปัจจุบัน / EPS ย้อนหลัง 12 เดือน",
      "value": 137.5,
      "unit": "x",
      "peer_avg": 30.7,
      "own_5yr_percentile": 82,
      "interpretation": "...",
      "verdict": "expensive"
    },
    {
      "name": "PEG Ratio",
      "formula": "P/E ÷ อัตราการเติบโตกำไรคาดการณ์ (%)",
      "value": 1.8,
      "unit": "x",
      "peer_avg": 2.1,
      "own_5yr_percentile": 65,
      "interpretation": "...",
      "verdict": "fair"
    },
    { "name": "EV/EBITDA", "formula": "Enterprise Value / EBITDA (TTM)", "value": 85.2, "unit": "x", "peer_avg": 25.4, "own_5yr_percentile": 78, "interpretation": "...", "verdict": "expensive" },
    { "name": "EV/Sales", "formula": "Enterprise Value / Revenue (TTM)", "value": 38.4, "unit": "x", "peer_avg": 12.1, "own_5yr_percentile": 85, "interpretation": "...", "verdict": "expensive" },
    { "name": "P/FCF", "formula": "Market Cap / Free Cash Flow (TTM)", "value": 65.0, "unit": "x", "peer_avg": 28.0, "own_5yr_percentile": 70, "interpretation": "...", "verdict": "expensive" },
    { "name": "P/B", "formula": "ราคาหุ้น / มูลค่าทางบัญชีต่อหุ้น", "value": 24.5, "unit": "x", "peer_avg": 8.5, "own_5yr_percentile": 75, "interpretation": "...", "verdict": "expensive" }
  ],
  "valuation_percentile_chart": {
    "description": "ตำแหน่ง P/E ปัจจุบันเทียบกับช่วง 5 ปี",
    "min_5yr": 45.2,
    "max_5yr": 210.8,
    "current": 137.5,
    "median_5yr": 95.0
  },
  "intrinsic_value": {
    "current_price": 186.38,
    "as_of_date": "2026-09-01",
    "dcf_model": {
      "assumptions": {
        "wacc_pct": 9.5,
        "terminal_growth_pct": 3.0,
        "projection_years": 5
      },
      "scenarios": {
        "bear": {
          "revenue_cagr_pct": 25,
          "terminal_margin_pct": 30,
          "fair_value_per_share": 95.0,
          "key_assumption_note": "..."
        },
        "base": {
          "revenue_cagr_pct": 40,
          "terminal_margin_pct": 38,
          "fair_value_per_share": 165.0,
          "key_assumption_note": "..."
        },
        "bull": {
          "revenue_cagr_pct": 55,
          "terminal_margin_pct": 45,
          "fair_value_per_share": 260.0,
          "key_assumption_note": "..."
        }
      }
    },
    "relative_valuation": {
      "method": "EV/EBITDA multiple ของกลุ่มเทียบ",
      "peer_multiple_used": 45.0,
      "metric_applied": "Forward EBITDA",
      "fair_value_per_share": 175.0
    },
    "summary": {
      "fair_value_range_low": 95.0,
      "fair_value_range_high": 260.0,
      "base_case_fair_value": 165.0,
      "current_price_position_pct": 55,
      "margin_of_safety_pct": -12.9,
      "verdict_text": "..."
    },
    "disclaimer": "การประเมินมูลค่านี้เป็นแบบจำลองอย่างง่ายจากสมมติฐาน ไม่ใช่คำแนะนำการลงทุน"
  },
  "earnings_analysis": {
    "as_of_date": "2026-09-01",
    "next_earnings_date": "2026-11-03",
    "next_earnings_date_confirmed": false,
    "days_until_next_earnings": 63,
    "past_earnings_history": [
      {
        "period": "Q3 2025",
        "report_date": "2025-11-04",
        "eps_estimate": 0.08,
        "eps_actual": 0.09,
        "eps_surprise_pct": 12.5,
        "revenue_estimate_musd": 710,
        "revenue_actual_musd": 726,
        "revenue_surprise_pct": 2.3,
        "stock_reaction_1d_pct": 4.2,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q4 2025",
        "report_date": "2026-02-10",
        "eps_estimate": 0.09,
        "eps_actual": 0.10,
        "eps_surprise_pct": 11.1,
        "revenue_estimate_musd": 810,
        "revenue_actual_musd": 828,
        "revenue_surprise_pct": 2.2,
        "stock_reaction_1d_pct": 3.5,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q1 2026",
        "report_date": "2026-05-05",
        "eps_estimate": 0.10,
        "eps_actual": 0.12,
        "eps_surprise_pct": 20.0,
        "revenue_estimate_musd": 860,
        "revenue_actual_musd": 884,
        "revenue_surprise_pct": 2.8,
        "stock_reaction_1d_pct": 5.8,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q2 2026",
        "report_date": "2026-08-04",
        "eps_estimate": 0.11,
        "eps_actual": 0.13,
        "eps_surprise_pct": 18.2,
        "revenue_estimate_musd": 940,
        "revenue_actual_musd": 1004,
        "revenue_surprise_pct": 6.8,
        "stock_reaction_1d_pct": 8.5,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      }
    ],
    "beat_streak": {
      "eps_beat_streak_quarters": 14,
      "revenue_beat_streak_quarters": 10,
      "commentary": "..."
    },
    "average_earnings_day_move_pct": 12.4,
    "current_quarter_setup": {
      "period": "Q3 2026",
      "company_guidance_revenue_musd": [1050, 1060],
      "consensus_estimate_revenue_musd": 1055,
      "consensus_estimate_eps": 0.14,
      "whisper_vs_consensus": "...",
      "key_things_to_watch": ["...", "..."]
    },
    "estimate_revisions_trend": {
      "description": "ทิศทางการปรับประมาณการของนักวิเคราะห์ในช่วง 90 วันที่ผ่านมา",
      "eps_estimate_90d_ago": 0.12,
      "eps_estimate_current": 0.14,
      "direction": "upward",
      "num_analysts_raised": 18,
      "num_analysts_lowered": 2,
      "commentary": "..."
    },
    "full_year_guidance": {
      "fiscal_year": 2026,
      "company_guidance_revenue_musd": [8150, 8158],
      "implied_growth_pct": 82,
      "consensus_vs_guidance": "..."
    },
    "analyst_consensus": {
      "consensus_rating": "Moderate Buy",
      "total_analysts": 24,
      "ratings_breakdown": {
        "buy_count": 16,
        "hold_count": 6,
        "sell_count": 2
      },
      "price_target": {
        "mean": 215.0,
        "high": 260.0,
        "low": 140.0,
        "median": 210.0,
        "implied_upside_pct": 15.4
      },
      "as_of_date": "2026-09-01",
      "commentary": "..."
    },
    "summary_verdict": "..."
  },
  "morningstar_research": {
    "has_coverage": true,
    "status_note": "Covered by Morningstar Senior Equity Analyst",
    "analyst_name": "...",
    "analyst_title": "Senior Equity Analyst",
    "rating_stars": 3,
    "rating_date": "2026-08-01",
    "economic_moat": "Wide",
    "economic_moat_th": "คูเมืองทางธุรกิจกว้างขวาง (Wide Moat)",
    "uncertainty": "Medium",
    "capital_allocation": "Exemplary",
    "capital_allocation_th": "การจัดสรรเงินทุนยอดเยี่ยมระดับ Exemplary",
    "fair_value_estimate": 285.0,
    "fair_value_date": "2026-08-01",
    "discount_premium_pct": -10.94,
    "ai_analysis_summary": "...",
    "bulls_say": ["...", "...", "..."],
    "bears_say": ["...", "...", "..."],
    "analyst_note": {
      "headline": "...",
      "analyst_byline": "...",
      "date": "...",
      "content_paragraphs": ["...", "..."]
    },
    "valuation_thesis": {
      "analyst_byline": "...",
      "date": "...",
      "implied_pe": 32.0,
      "implied_ev_revenue": 8.0,
      "implied_fcf_yield_pct": 3.0,
      "projected_revenue_cagr_5yr": 9.0,
      "projected_gross_margin_terminal": 50.5,
      "projected_operating_margin_terminal": 36.0,
      "content_paragraphs": ["...", "..."]
    }
  },
  "peer_comparison": {
    "as_of_date": "2026-09-01",
    "industry_name": "Sector / Industry",
    "peers": [
      {
        "ticker": "...",
        "company_name": "...",
        "market_cap": "$180B",
        "pe_trailing": 137.5,
        "pe_forward": 75.2,
        "revenue_growth_yoy_pct": 93.0,
        "gross_margin_pct": 84.1,
        "net_margin_pct": 32.5,
        "ev_ebitda": 85.2
      }
    ],
    "key_takeaway": "..."
  },
  "catalysts_and_events": {
    "as_of_date": "2026-09-01",
    "items": [
      {
        "title": "...",
        "date": "2026-11-03",
        "expected_impact": "high",
        "description": "...",
        "category": "earnings"
      }
    ]
  },
  "insider_activity": {
    "as_of_date": "2026-09-01",
    "insider_ownership_pct": 8.5,
    "institutional_ownership_pct": 45.2,
    "institutional_qoq_change_pct": 2.4,
    "recent_transactions": [
      {
        "date": "2026-08-15",
        "insider_name": "...",
        "title": "Executive",
        "transaction_type": "sell",
        "shares_count": 50000,
        "price_per_share": 180.0,
        "total_value_usd": 9000000
      }
    ],
    "commentary": "..."
  },
  "smart_money": {
    "as_of_date": "2026-09-01",
    "institution_overview": {
      "total_institutions_count": 5600,
      "institutions_count_change_qoq": 48,
      "total_shares_held": "16.5B",
      "shares_held_change_qoq": "+42.5M",
      "pct_owned": 68.50,
      "pct_owned_change_qoq": 1.80
    },
    "major_holders": [
      {
        "name": "The Vanguard Group, Inc.",
        "shares_held": "2.98B",
        "pct_owned": 12.33,
        "change_shares": "+1.2%",
        "change_pct": 0.21,
        "holder_type": "Mutual Fund / Index",
        "filing_date": "2026-06-30",
        "disclosure": "13F"
      }
    ],
    "shareholder_activity": [
      {
        "holder_name": "Citadel Advisors LLC",
        "change_type": "increase",
        "change_shares": "+3.10M",
        "change_amount_usd": "+$645M",
        "total_pct_held": 1.12,
        "holder_type": "Hedge Fund",
        "date": "2026-06-30"
      },
      {
        "holder_name": "Coatue Management, LLC",
        "change_type": "decrease",
        "change_shares": "-2.80M",
        "change_amount_usd": "-$582M",
        "total_pct_held": 0.85,
        "holder_type": "Hedge Fund",
        "date": "2026-06-30"
      }
    ],
    "insiders_overview": {
      "insider_ownership_pct": 7.42,
      "bullish_insiders_count": 4,
      "bearish_insiders_count": 6,
      "key_insiders": [
        {
          "name": "...",
          "title": "...",
          "shares_held": "10M",
          "pct_owned": 1.5
        }
      ]
    },
    "recent_transactions": [
      {
        "date": "2026-08-15",
        "insider_name": "...",
        "title": "Executive",
        "transaction_type": "sell (Rule 10b5-1)",
        "shares_count": 50000,
        "price_per_share": 180.0,
        "total_value_usd": 9000000
      }
    ],
    "commentary": "..."
  },
  "corporate_actions": {
    "as_of_date": "2026-09-01",
    "dividends": {
      "summary": {
        "has_dividend": false,
        "dividend_yield_pct": 0.0,
        "annual_payout_usd": 0.0,
        "payout_ratio_pct": 0.0,
        "frequency": "ไม่มีการจ่ายเงินปันผล",
        "policy_note": "..."
      },
      "history": [
        {
          "announced_date": "2026-07-31",
          "allocation_plan": "Cash Dividend: 0.27 USD Per Share",
          "amount_usd": 0.27,
          "record_date": "2026-08-10",
          "ex_date": "2026-08-10",
          "pay_date": "2026-08-13"
        }
      ]
    },
    "stock_splits": [
      {
        "effective_date": "2020-08-31",
        "split_type": "Split",
        "ratio": "1:4"
      }
    ],
    "buybacks": {
      "authorized_amount_musd": 1000,
      "remaining_amount_musd": 850,
      "shares_repurchased_last_12m": 1500000,
      "net_share_reduction_pct": 0.8,
      "commentary": "..."
    }
  },
  "company_profile": {
    "as_of_date": "2026-09-01",
    "overview": {
      "company_name": "...",
      "symbol": "...",
      "listing_date": "2020-09-30",
      "issue_price": 10.0,
      "isin": "US69608A1088",
      "founded_year": 2003,
      "ceo": "Dr. Alexander C. Karp",
      "exchange": "NASDAQ",
      "employees_count": 3850,
      "fiscal_year_end": "12-31",
      "address": "1200 17th Street, Floor 15",
      "city": "Denver",
      "province_state": "Colorado",
      "country": "United States of America",
      "zip_code": "80202",
      "phone": "1-720-358-3679",
      "website_url": "https://www.palantir.com",
      "description": "..."
    },
    "executives": [
      {
        "name": "Dr. Alexander C. Karp",
        "title": "Co-Founder, Chief Executive Officer & Director",
        "salary_usd": 5430000,
        "age": 58,
        "gender": "male",
        "bio": "...",
        "updated_date": "2026-06-03"
      }
    ]
  },
  "business_analysis": {
    "as_of_date": "2026-09-01",
    "revenue_breakdown": {
      "period": "2026/Q2",
      "by_business": [
        { "name": "Commercial - AIP / Foundry", "revenue_usd": "$520M", "ratio_pct": 52.0, "growth_yoy_pct": 55.4 },
        { "name": "Government - Gotham Defense", "revenue_usd": "$340M", "ratio_pct": 34.0, "growth_yoy_pct": 28.2 }
      ],
      "by_region": [
        { "name": "United States", "revenue_usd": "$860M", "ratio_pct": 86.0, "growth_yoy_pct": 44.0 },
        { "name": "International", "revenue_usd": "$140M", "ratio_pct": 14.0, "growth_yoy_pct": 18.0 }
      ]
    },
    "operational_efficiency": [
      {
        "period": "2025/FY",
        "headcount": 3750,
        "headcount_yoy_pct": 2.7,
        "revenue_per_employee_k_usd": 945.0,
        "revenue_per_employee_yoy_pct": 21.0,
        "operating_profit_per_employee_k_usd": 215.0,
        "op_profit_per_employee_yoy_pct": 48.1,
        "net_income_per_employee_k_usd": 165.0,
        "net_income_per_employee_yoy_pct": 34.8
      }
    ],
    "key_takeaways": "..."
  },
  "comprehensive_analysis": {
    "business_overview": "...",
    "target_customers": "...",
    "revenue_model": "...",
    "financial_overview": "...",
    "fundamentals_check": "...",
    "business_strengths": "...",
    "future_growth": "...",
    "key_risks": "...",
    "management": "...",
    "beginner_summary": {
      "business_type_simple": "...",
      "top_3_strengths": ["...", "..."],
      "top_3_risks": ["...", "..."],
      "suitable_investor_type": "...",
      "further_reading": "..."
    },
    "scoring": {
      "understandability": { "score": 8, "reason": "..." },
      "revenue_quality": { "score": 8, "reason": "..." },
      "financial_strength": { "score": 8, "reason": "..." },
      "growth_potential": { "score": 8, "reason": "..." },
      "risk_level": { "score": 8, "reason": "..." },
      "overall_attractiveness": { "score": 8, "reason": "..." }
    },
    "final_verdict_summary": {
      "worth_further_study": "...",
      "strong_fundamentals": "...",
      "what_to_look_for": "..."
    }
  },
  "technical_analysis": {
    "signal_summary": {
       "status": "Buy | Wait | Avoid",
       "trend_weekly": "Up | Down | Sideways",
       "trend_daily": "Up | Down | Sideways",
       "trend_4h": "Up | Down | Sideways",
       "confluence_score": "..."
    },
    "key_levels": {
       "support": ["...", "...", "..."],
       "resistance": ["...", "...", "..."]
    },
    "trade_plan": {
       "entry_zone": "...",
       "stop_loss": "...",
       "target_1": "...",
       "target_2": "...",
       "risk_reward_ratio": "..."
    },
    "overall_trend": "...",
    "price_structure": "...",
    "volume_analysis": "...",
    "trend_indicators": "...",
    "momentum_indicators": "...",
    "volatility_indicators": "...",
    "chart_patterns": "...",
    "relative_strength": "...",
    "technical_risks": "...",
    "beginner_summary": {
      "technical_overview": "...",
      "top_3_points": ["...", "..."],
      "top_3_cautions": ["...", "..."],
      "suitable_trade_style": "..."
    },
    "scoring": {
      "trend_clarity": { "score": 8, "reason": "..." },
      "momentum_strength": { "score": 8, "reason": "..." },
      "risk_reward": { "score": 8, "reason": "..." },
      "signal_confluence": { "score": 8, "reason": "..." },
      "false_signal_risk": { "score": 8, "reason": "..." },
      "overall_attractiveness": { "score": 8, "reason": "..." }
    },
    "final_verdict_summary": {
      "is_good_timing": "...",
      "what_to_wait_for": "...",
      "trade_plan": "..."
    }
  },
  "deep_insights": [
    {
      "category": "Risk Assessment",
      "title": "...",
      "description": "...",
      "impact_score": 8
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": "2026-05-15",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": "Aug '26", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q2 2026", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      } else {
        finalInstruction += `\n\nCRITICAL SEARCH FOR 3 FINANCIAL STATEMENTS (INCOME, BALANCE SHEET, CASH FLOW):
1. For ${ticker}, you MUST search and locate the official SEC Form 10-Q and 10-K "CONSOLIDATED BALANCE SHEETS" and "CONSOLIDATED STATEMENTS OF CASH FLOWS" tables for all 4 reporting periods.
2. In "financial_statements.balance_sheet":
   - "total_assets": exact Total Assets reported for each quarter (e.g., For TSLA: 2025/Q3: $133.74B, 2025/Q4: $137.81B, 2026/Q1: $143.72B, 2026/Q2: $148.52B in millions, i.e., [133740, 137810, 143720, 148520]). NEVER shift older 2024 numbers ($112B-$125B) into 2025/2026!
   - "total_current_assets": exact Total Current Assets for each quarter (e.g. For TSLA: [64650, 68640, 69750, 68760]).
   - "cash_and_equivalents": exact cash and cash equivalents (e.g. For TSLA: [18290, 16510, 16600, 15220]).
   - "short_term_investments": exact short-term investments/marketable securities (e.g. For TSLA: [23360, 27550, 28140, 28310]).
   - "accounts_receivable" & "receivables": exact accounts receivable (e.g. For TSLA: [4700, 4580, 3960, 4090]).
   - "inventory": exact inventory reported on the 10-Q/10-K balance sheet (e.g. For TSLA: [13100, 13400, 13800, 14200]).
   - "total_liabilities", "total_current_liabilities", "accounts_payable", "short_term_debt", "total_debt", "total_equity".
3. In "financial_statements.cash_flow":
   - "operating_cash_flow": exact net cash provided by operating activities for each quarter.
   - "capex": capital expenditures (payments for property, plant and equipment).
   - "free_cash_flow": exact OCF minus CapEx for each quarter.
   - "investing_cash_flow", "financing_cash_flow", "stock_issuance_repurchase", "dividends_paid".
4. Ensure accounting identity consistency: Total Assets = Total Liabilities + Total Equity, Total Current Assets >= Cash + Receivables + Inventory, and Free Cash Flow = Operating Cash Flow - CapEx.
5. In "business_analysis.revenue_breakdown":
   - You MUST extract authentic segment revenues from the official SEC Form 10-Q/10-K "Product and Service Information" or Segment Footnote table for the latest completed quarter.
   - For Apple (AAPL): MUST report iPhone (~$54.25B / ~49.6%), Services (~$30.74B / ~28.1%), Mac (~$10.35B / ~9.5%, +28.7% YoY), Wearables Home & Acc (~$7.89B / ~7.2%), iPad (~$6.19B / ~5.7%) summing to Total Revenue ~$109.4B and Total Products ~$78.68B.
   - All segment revenues must sum to total company revenue, and ratio_pct must sum to 100%.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\nCRITICAL MANDATE - NATURAL INVESTOR THAI (ภาษาคนลงทุนจริง ไม่ใช้ภาษาหุ่นยนต์ AI):
          เขียนบทวิเคราะห์ปัจจัยพื้นฐานด้วยภาษาไทยที่นักลงทุนและนักวิเคราะห์หุ้นใช้กันจริงๆ เป็นธรรมชาติ ลื่นไหล เข้าใจง่าย กระชับ ตรงประเด็น ห้ามใช้ภาษาแปลเครื่องหรือคำประดิษฐ์ของ AI (เช่น "สะท้อนให้เห็นถึง", "ในภูมิทัศน์ที่มีพลวัต", "เป็นสิ่งสำคัญยิ่งยวด", "คูเมืองทางเศรษฐกิจ", "การเจือจางของหุ้น", "หัวเจาะหลักในการเติบโต")
          - ให้ใช้คำศัพท์การเงินที่เป็นสากลและนักลงทุนไทยคุ้นเคย โดยใส่วงเล็บหรือทับศัพท์ได้ เช่น Moat (ความได้เปรียบในการแข่งขัน), Pricing Power (อำนาจการตั้งราคา), Ecosystem, Recurring Revenue, Free Cash Flow (FCF), Dilution, Stock-Based Compensation (SBC)
          - STRICTLY FORBIDDEN to use Japanese or Chinese characters.
          
          Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร สัดส่วนรายได้มาจากส่วนไหนมากที่สุด อธิบายให้คนทั่วไปฟังแล้วเข้าใจทันที (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งพาลูกค้ารายใหญ่ไม่กี่รายหรือกระจายตัวดี ลูกค้าเปลี่ยนไปใช้เจ้าอื่นง่ายไหม อะไรที่ทำให้ลูกค้าอยู่ต่อ (เช่น switching cost หรือ ecosystem) (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นรายได้แบบขายครั้งเดียวหรือรายได้ประจำสม่ำเสมอ (Recurring Revenue) สัญญาการให้บริการเป็นแบบไหน คุณภาพกระแสเงินสดเป็นอย่างไร (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้และกำไรเติบโตอย่างไร อัตรากำไร (Margins) ดีขึ้นหรือแย่ลง กระแสเงินสดจากการดำเนินงานและ FCF เป็นบวกไหม ภาระหนี้สินน่ากังวลหรือไม่ (หากเป็นสถาบันการเงิน ให้ดูสภาพคล่อง อัตราส่วนเงินกองทุน และคุณภาพสินทรัพย์แทน) Valuation เมื่อเทียบกับกลุ่มอุตสาหกรรม และผลกระทบจาก Dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          5) เช็คคุณภาพพื้นฐาน (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a Markdown NUMBERED list (1., 2., 3.) to assess these 8 areas in detail, using '\n\n' to separate each point. DO NOT use bullets ('- ') before the numbers: 1.การเติบโตของรายได้ 2.การเติบโตของกำไร 3.คุณภาพกระแสเงินสด 4.ภาระหนี้สินและความเสี่ยงทางการเงิน 5.ความสามารถในการรักษาอัตรากำไร (Margins) 6.ผลตอบแทนต่อเงินลงทุน (ROIC/ROE) 7.โอกาสการเติบโตในระยะยาว 8.บทสรุปภาพรวม ("พื้นฐานแข็งแกร่ง", "มีจุดเด่นแต่ต้องระวัง", หรือ "พื้นฐานยังไม่น่าไว้วางใจ")
          6) จุดแข็งและความได้เปรียบในการแข่งขัน (for business_strengths): มี Moat ด้านใดบ้าง (แบรนด์, ขนาดธุรกิจ, Network Effect, สิทธิบัตร, ต้นทุน) เปรียบเทียบกับคู่แข่งหลัก 1-2 ราย ว่าเหนือกว่าตรงไหนและมีจุดอ่อนอะไร
          7) โอกาสและปัจจัยเร่งการเติบโต (for future_growth): โอกาสสร้างการเติบโตใหม่ ปัจจัยหนุน (Catalysts) ที่น่าจับตาใน 6-12 เดือนข้างหน้า
          8) ความเสี่ยงสำคัญที่ต้องจับตา (for key_risks): CRITICAL: คุณต้องตอบให้ครบทั้ง 8 หมวดต่อไปนี้ ห้ามข้ามเด็ดขาด: 1.การแข่งขัน 2.ลูกค้ากระจุกตัว 3.กฎระเบียบและข้อกฎหมาย 4.เศรษฐกิจมหภาค 5.แรงกดดันต่อ Margin 6.Valuation ตึงตัว 7.ความเสี่ยงที่มือใหม่มักมองข้าม 8.การเพิ่มขึ้นของจำนวนหุ้น (Dilution/SBC) เขียนอธิบายให้ชัดเจนพร้อมตัวเลขประกอบ
          9) ผู้บริหารและการจัดสรรเงินทุน (for management): ผู้บริหารมีผลงานที่ผ่านมาเป็นอย่างไร ทำได้ตามเป้าหมาย (Guidance) ไหม สัดส่วนการถือหุ้นของผู้บริหาร (Insider Ownership) ให้ระบุเป็น % ตัวเลขจริง (ถ้าไม่มีให้ระบุว่า "ไม่พบข้อมูลสัดส่วนการถือหุ้นในเอกสารทางการ"), การซื้อขายหุ้นของผู้บริหาร, และการจัดสรรเงินทุน (Capital Allocation เช่น ซื้อหุ้นคืน เงินปันผล M&A)
          10) สรุปให้มือใหม่เข้าใจง่าย (for beginner_summary): 
           - business_type_simple: สรุปธุรกิจให้เข้าใจง่ายในภาษาคนทั่วไป
           - top_3_strengths / top_3_risks: สรุปจุดเด่น 3 ข้อ และจุดเสี่ยง 3 ข้อ
           - suitable_investor_type: เหมาะกับนักลงทุนสไตล์ไหน
           - further_reading: สิ่งที่ควรศึกษาเพิ่มเติม
          11) ให้คะแนน (for scoring): ให้คะแนน 1-10 พร้อมเหตุผลกระชับ สำหรับ understandability, revenue_quality, financial_strength, growth_potential, risk_level, overall_attractiveness
          12) บทสรุปสุดท้าย (for final_verdict_summary): น่าศึกษาต่อไหม (worth_further_study), พื้นฐานดีจริงไหม (strong_fundamentals), จุดสำคัญที่ต้องดูให้ละเอียดก่อนตัดสินใจลงทุน (what_to_look_for)
          
          เงื่อนไขสำคัญ:
          - เน้นข้อเท็จจริง ตัวเลข และเหตุผล ห้ามใช้คำเยิ่นเย้อหรือคำชมลอยๆ โดยไม่มีข้อมูลสนับสนุน
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบถ้วน ไม่ข้ามประเด็นสำคัญ
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุนจริง`;
        } else {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in English.
          CRITICAL REQUIREMENTS:
          - Format "business_overview", "target_customers", "revenue_model", and "financial_overview" fields as Markdown bullet points "-" for readability. Do NOT write single long paragraphs.
          - Topic 4, 8, 9 must contain at least 3-5 sentences per bullet. DO NOT write single-sentence summaries.
          - For Topic 5 (fundamentals_check): This field MUST NEVER BE EMPTY. You MUST use a markdown bulleted list to assess these 8 areas: 1.Revenue growth 2.Profit growth 3.Cash flow 4.Debt 5.Margin 6.ROIC/ROE/ROA 7.Growth runway 8.Final verdict (Strong, Caution, or Weak).
          - For Topic 8 (key_risks): You MUST cover at least 8 risk categories (Competition, Customer concentration, Regulatory, Economic, Margin, Valuation, Hidden risks, Dilution/SBC). EACH must have 2-3 sentences and numerical backing.
          - For Topic 9 (management): You MUST provide the exact numerical percentage (%) for insider ownership. If not found, explicitly state "Insider ownership data not found in documents." You must analyze capital allocation and evaluate management statements critically.
          - Never use vague adjectives without numbers. Back every claim with exact numbers and quarters (e.g. "Revenue grew 24% YoY in Q1 2026").`;
        }
        
        dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": 85,
    "key_takeaways": ["...", "..."]
  },
  "financial_statements": {
    "currency": "USD",
    "fiscal_period_type": "quarterly",
    "as_of_date": "2026-09-01",
    "source": { "document_url": "https://www.sec.gov/...", "document_type": "Form 10-Q", "filing_date": "2026-08-26", "period_end": "2026-07-26", "units": "USD millions" },
    "periods": ["Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"],
    "income_statement": {
      "revenue": [726, 828, 884, 1004],
      "cogs": [146, 164, 150, 160],
      "gross_profit": [580, 664, 734, 844],
      "gross_margin_pct": [79.9, 80.2, 83.0, 84.1],
      "operating_expenses": [385, 382, 345, 371],
      "operating_income": [195, 282, 389, 473],
      "operating_margin_pct": [26.8, 34.0, 44.0, 47.1],
      "income_before_tax": [170, 100, 260, 380],
      "income_tax_expense": [27, 21, 46, 54],
      "net_income": [143, 79, 214, 326],
      "net_margin_pct": [19.7, 9.5, 24.2, 32.5],
      "eps_diluted": [0.06, 0.03, 0.08, 0.13],
      "yoy_revenue_growth_pct": [63, 70, 85, 93],
      "commentary": "..."
    },
    "balance_sheet": {
      "cash_and_equivalents": [2150, 2320, 2550, 2800],
      "short_term_investments": [2450, 2580, 2850, 3200],
      "total_current_assets": [5150, 5520, 6050, 6750],
      "accounts_receivable": [390, 410, 435, 460],
      "inventory": [0, 0, 0, 0],
      "net_ppe": [280, 310, 335, 360],
      "total_assets": [5820, 6240, 6780, 7490],
      "total_current_liabilities": [680, 720, 780, 850],
      "accounts_payable": [180, 195, 210, 230],
      "short_term_debt": [0, 0, 0, 0],
      "total_debt": [0, 0, 0, 0],
      "total_liabilities": [920, 980, 1050, 1150],
      "total_equity": [4900, 5260, 5730, 6340],
      "current_ratio": [7.57, 7.67, 7.76, 7.94],
      "quick_ratio": [7.57, 7.67, 7.76, 7.94],
      "debt_to_equity": [0, 0, 0, 0],
      "debt_to_ebitda": [0, 0, 0, 0],
      "commentary": "..."
    },
    "cash_flow": {
      "operating_cash_flow": [420, 480, 510, 620],
      "depreciation": [22, 24, 25, 26],
      "change_working_capital": [114, 127, 116, 108],
      "capex": [5, 6, 7, 8],
      "investing_cash_flow": [-180, -210, -240, -280],
      "free_cash_flow": [415, 474, 503, 612],
      "fcf_margin_pct": [57.2, 57.2, 56.9, 61.0],
      "fcf_vs_net_income_ratio": [2.88, 2.65, 2.35, 1.88],
      "financing_cash_flow": [-45, -50, -55, -60],
      "stock_issuance_repurchase": [-45, -50, -55, -60],
      "dividends_paid": [0, 0, 0, 0],
      "ending_cash": [2150, 2320, 2550, 2800],
      "net_change_cash": [195, 170, 230, 250],
      "commentary": "..."
    },
    "red_flags": ["..."]
  },
  "valuation_ratios": [
    {
      "name": "P/E (Trailing)",
      "formula": "ราคาหุ้นปัจจุบัน / EPS ย้อนหลัง 12 เดือน",
      "value": 137.5,
      "unit": "x",
      "peer_avg": 30.7,
      "own_5yr_percentile": 82,
      "interpretation": "...",
      "verdict": "expensive"
    },
    {
      "name": "PEG Ratio",
      "formula": "P/E ÷ อัตราการเติบโตกำไรคาดการณ์ (%)",
      "value": 1.8,
      "unit": "x",
      "peer_avg": 2.1,
      "own_5yr_percentile": 65,
      "interpretation": "...",
      "verdict": "fair"
    },
    { "name": "EV/EBITDA", "formula": "Enterprise Value / EBITDA (TTM)", "value": 85.2, "unit": "x", "peer_avg": 25.4, "own_5yr_percentile": 78, "interpretation": "...", "verdict": "expensive" },
    { "name": "EV/Sales", "formula": "Enterprise Value / Revenue (TTM)", "value": 38.4, "unit": "x", "peer_avg": 12.1, "own_5yr_percentile": 85, "interpretation": "...", "verdict": "expensive" },
    { "name": "P/FCF", "formula": "Market Cap / Free Cash Flow (TTM)", "value": 65.0, "unit": "x", "peer_avg": 28.0, "own_5yr_percentile": 70, "interpretation": "...", "verdict": "expensive" },
    { "name": "P/B", "formula": "ราคาหุ้น / มูลค่าทางบัญชีต่อหุ้น", "value": 24.5, "unit": "x", "peer_avg": 8.5, "own_5yr_percentile": 75, "interpretation": "...", "verdict": "expensive" }
  ],
  "valuation_percentile_chart": {
    "description": "ตำแหน่ง P/E ปัจจุบันเทียบกับช่วง 5 ปี",
    "min_5yr": 45.2,
    "max_5yr": 210.8,
    "current": 137.5,
    "median_5yr": 95.0
  },
  "intrinsic_value": {
    "current_price": 186.38,
    "as_of_date": "2026-09-01",
    "dcf_model": {
      "assumptions": {
        "wacc_pct": 9.5,
        "terminal_growth_pct": 3.0,
        "projection_years": 5
      },
      "scenarios": {
        "bear": {
          "revenue_cagr_pct": 25,
          "terminal_margin_pct": 30,
          "fair_value_per_share": 95.0,
          "key_assumption_note": "..."
        },
        "base": {
          "revenue_cagr_pct": 40,
          "terminal_margin_pct": 38,
          "fair_value_per_share": 165.0,
          "key_assumption_note": "..."
        },
        "bull": {
          "revenue_cagr_pct": 55,
          "terminal_margin_pct": 45,
          "fair_value_per_share": 260.0,
          "key_assumption_note": "..."
        }
      }
    },
    "relative_valuation": {
      "method": "EV/EBITDA multiple ของกลุ่มเทียบ",
      "peer_multiple_used": 45.0,
      "metric_applied": "Forward EBITDA",
      "fair_value_per_share": 175.0
    },
    "summary": {
      "fair_value_range_low": 95.0,
      "fair_value_range_high": 260.0,
      "base_case_fair_value": 165.0,
      "current_price_position_pct": 55,
      "margin_of_safety_pct": -12.9,
      "verdict_text": "..."
    },
    "disclaimer": "การประเมินมูลค่านี้เป็นแบบจำลองอย่างง่ายจากสมมติฐาน ไม่ใช่คำแนะนำการลงทุน"
  },
  "earnings_analysis": {
    "as_of_date": "2026-09-01",
    "next_earnings_date": "2026-11-03",
    "next_earnings_date_confirmed": false,
    "days_until_next_earnings": 63,
    "past_earnings_history": [
      {
        "period": "Q3 2025",
        "report_date": "2025-11-04",
        "eps_estimate": 0.08,
        "eps_actual": 0.09,
        "eps_surprise_pct": 12.5,
        "revenue_estimate_musd": 710,
        "revenue_actual_musd": 726,
        "revenue_surprise_pct": 2.3,
        "stock_reaction_1d_pct": 4.2,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q4 2025",
        "report_date": "2026-02-10",
        "eps_estimate": 0.09,
        "eps_actual": 0.10,
        "eps_surprise_pct": 11.1,
        "revenue_estimate_musd": 810,
        "revenue_actual_musd": 828,
        "revenue_surprise_pct": 2.2,
        "stock_reaction_1d_pct": 3.5,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q1 2026",
        "report_date": "2026-05-05",
        "eps_estimate": 0.10,
        "eps_actual": 0.12,
        "eps_surprise_pct": 20.0,
        "revenue_estimate_musd": 860,
        "revenue_actual_musd": 884,
        "revenue_surprise_pct": 2.8,
        "stock_reaction_1d_pct": 5.8,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      },
      {
        "period": "Q2 2026",
        "report_date": "2026-08-04",
        "eps_estimate": 0.11,
        "eps_actual": 0.13,
        "eps_surprise_pct": 18.2,
        "revenue_estimate_musd": 940,
        "revenue_actual_musd": 1004,
        "revenue_surprise_pct": 6.8,
        "stock_reaction_1d_pct": 8.5,
        "guidance_change": "raised",
        "beat_or_miss": "beat_both"
      }
    ],
    "beat_streak": {
      "eps_beat_streak_quarters": 14,
      "revenue_beat_streak_quarters": 10,
      "commentary": "..."
    },
    "average_earnings_day_move_pct": 12.4,
    "current_quarter_setup": {
      "period": "Q3 2026",
      "company_guidance_revenue_musd": [1050, 1060],
      "consensus_estimate_revenue_musd": 1055,
      "consensus_estimate_eps": 0.14,
      "whisper_vs_consensus": "...",
      "key_things_to_watch": ["...", "..."]
    },
    "estimate_revisions_trend": {
      "description": "ทิศทางการปรับประมาณการของนักวิเคราะห์ในช่วง 90 วันที่ผ่านมา",
      "eps_estimate_90d_ago": 0.12,
      "eps_estimate_current": 0.14,
      "direction": "upward",
      "num_analysts_raised": 18,
      "num_analysts_lowered": 2,
      "commentary": "..."
    },
    "full_year_guidance": {
      "fiscal_year": 2026,
      "company_guidance_revenue_musd": [8150, 8158],
      "implied_growth_pct": 82,
      "consensus_vs_guidance": "..."
    },
    "analyst_consensus": {
      "consensus_rating": "Moderate Buy",
      "total_analysts": 24,
      "ratings_breakdown": {
        "buy_count": 16,
        "hold_count": 6,
        "sell_count": 2
      },
      "price_target": {
        "mean": 215.0,
        "high": 260.0,
        "low": 140.0,
        "median": 210.0,
        "implied_upside_pct": 15.4
      },
      "as_of_date": "2026-09-01",
      "commentary": "..."
    },
    "summary_verdict": "..."
  },
  "morningstar_research": {
    "has_coverage": true,
    "status_note": "Covered by Morningstar Senior Equity Analyst",
    "analyst_name": "...",
    "analyst_title": "Senior Equity Analyst",
    "rating_stars": 3,
    "rating_date": "2026-08-01",
    "economic_moat": "Wide",
    "economic_moat_th": "คูเมืองทางธุรกิจกว้างขวาง (Wide Moat)",
    "uncertainty": "Medium",
    "capital_allocation": "Exemplary",
    "capital_allocation_th": "การจัดสรรเงินทุนยอดเยี่ยมระดับ Exemplary",
    "fair_value_estimate": 285.0,
    "fair_value_date": "2026-08-01",
    "discount_premium_pct": -10.94,
    "ai_analysis_summary": "...",
    "bulls_say": ["...", "...", "..."],
    "bears_say": ["...", "...", "..."],
    "analyst_note": {
      "headline": "...",
      "analyst_byline": "...",
      "date": "...",
      "content_paragraphs": ["...", "..."]
    },
    "valuation_thesis": {
      "analyst_byline": "...",
      "date": "...",
      "implied_pe": 32.0,
      "implied_ev_revenue": 8.0,
      "implied_fcf_yield_pct": 3.0,
      "projected_revenue_cagr_5yr": 9.0,
      "projected_gross_margin_terminal": 50.5,
      "projected_operating_margin_terminal": 36.0,
      "content_paragraphs": ["...", "..."]
    }
  },
  "peer_comparison": {
    "as_of_date": "2026-09-01",
    "industry_name": "Sector / Industry",
    "peers": [
      {
        "ticker": "...",
        "company_name": "...",
        "market_cap": "$180B",
        "pe_trailing": 137.5,
        "pe_forward": 75.2,
        "revenue_growth_yoy_pct": 93.0,
        "gross_margin_pct": 84.1,
        "net_margin_pct": 32.5,
        "ev_ebitda": 85.2
      }
    ],
    "key_takeaway": "..."
  },
  "catalysts_and_events": {
    "as_of_date": "2026-09-01",
    "items": [
      {
        "title": "...",
        "date": "2026-11-03",
        "expected_impact": "high",
        "description": "...",
        "category": "earnings"
      }
    ]
  },
  "insider_activity": {
    "as_of_date": "2026-09-01",
    "insider_ownership_pct": 8.5,
    "institutional_ownership_pct": 45.2,
    "institutional_qoq_change_pct": 2.4,
    "recent_transactions": [
      {
        "date": "2026-08-15",
        "insider_name": "...",
        "title": "Executive",
        "transaction_type": "sell",
        "shares_count": 50000,
        "price_per_share": 180.0,
        "total_value_usd": 9000000
      }
    ],
    "commentary": "..."
  },
  "smart_money": {
    "as_of_date": "2026-09-01",
    "institution_overview": {
      "total_institutions_count": 5600,
      "institutions_count_change_qoq": 48,
      "total_shares_held": "16.5B",
      "shares_held_change_qoq": "+42.5M",
      "pct_owned": 68.50,
      "pct_owned_change_qoq": 1.80
    },
    "major_holders": [
      {
        "name": "The Vanguard Group, Inc.",
        "shares_held": "2.98B",
        "pct_owned": 12.33,
        "change_shares": "+1.2%",
        "change_pct": 0.21,
        "holder_type": "Mutual Fund / Index",
        "filing_date": "2026-06-30",
        "disclosure": "13F"
      }
    ],
    "shareholder_activity": [
      {
        "holder_name": "Citadel Advisors LLC",
        "change_type": "increase",
        "change_shares": "+3.10M",
        "change_amount_usd": "+$645M",
        "total_pct_held": 1.12,
        "holder_type": "Hedge Fund",
        "date": "2026-06-30"
      },
      {
        "holder_name": "Coatue Management, LLC",
        "change_type": "decrease",
        "change_shares": "-2.80M",
        "change_amount_usd": "-$582M",
        "total_pct_held": 0.85,
        "holder_type": "Hedge Fund",
        "date": "2026-06-30"
      }
    ],
    "insiders_overview": {
      "insider_ownership_pct": 7.42,
      "bullish_insiders_count": 4,
      "bearish_insiders_count": 6,
      "key_insiders": [
        {
          "name": "...",
          "title": "...",
          "shares_held": "10M",
          "pct_owned": 1.5
        }
      ]
    },
    "recent_transactions": [
      {
        "date": "2026-08-15",
        "insider_name": "...",
        "title": "Executive",
        "transaction_type": "sell (Rule 10b5-1)",
        "shares_count": 50000,
        "price_per_share": 180.0,
        "total_value_usd": 9000000
      }
    ],
    "commentary": "..."
  },
  "corporate_actions": {
    "as_of_date": "2026-09-01",
    "dividends": {
      "summary": {
        "has_dividend": false,
        "dividend_yield_pct": 0.0,
        "annual_payout_usd": 0.0,
        "payout_ratio_pct": 0.0,
        "frequency": "No Dividend (Growth Reinvestment)",
        "policy_note": "..."
      },
      "history": [
        {
          "announced_date": "2026-07-31",
          "allocation_plan": "Cash Dividend: 0.27 USD Per Share",
          "amount_usd": 0.27,
          "record_date": "2026-08-10",
          "ex_date": "2026-08-10",
          "pay_date": "2026-08-13"
        }
      ]
    },
    "stock_splits": [
      {
        "effective_date": "2020-08-31",
        "split_type": "Split",
        "ratio": "1:4"
      }
    ],
    "buybacks": {
      "authorized_amount_musd": 1000,
      "remaining_amount_musd": 850,
      "shares_repurchased_last_12m": 1500000,
      "net_share_reduction_pct": 0.8,
      "commentary": "..."
    }
  },
  "company_profile": {
    "as_of_date": "2026-09-01",
    "overview": {
      "company_name": "...",
      "symbol": "...",
      "listing_date": "2020-09-30",
      "issue_price": 10.0,
      "isin": "US69608A1088",
      "founded_year": 2003,
      "ceo": "Dr. Alexander C. Karp",
      "exchange": "NASDAQ",
      "employees_count": 3850,
      "fiscal_year_end": "12-31",
      "address": "1200 17th Street, Floor 15",
      "city": "Denver",
      "province_state": "Colorado",
      "country": "United States of America",
      "zip_code": "80202",
      "phone": "1-720-358-3679",
      "website_url": "https://www.palantir.com",
      "description": "..."
    },
    "executives": [
      {
        "name": "Dr. Alexander C. Karp",
        "title": "Co-Founder, Chief Executive Officer & Director",
        "salary_usd": 5430000,
        "age": 58,
        "gender": "male",
        "bio": "...",
        "updated_date": "2026-06-03"
      }
    ]
  },
  "business_analysis": {
    "as_of_date": "2026-09-01",
    "revenue_breakdown": {
      "period": "2026/Q2",
      "by_business": [
        { "name": "Commercial - AIP / Foundry", "revenue_usd": "$520M", "ratio_pct": 52.0, "growth_yoy_pct": 55.4 },
        { "name": "Government - Gotham Defense", "revenue_usd": "$340M", "ratio_pct": 34.0, "growth_yoy_pct": 28.2 }
      ],
      "by_region": [
        { "name": "United States", "revenue_usd": "$860M", "ratio_pct": 86.0, "growth_yoy_pct": 44.0 },
        { "name": "International", "revenue_usd": "$140M", "ratio_pct": 14.0, "growth_yoy_pct": 18.0 }
      ]
    },
    "operational_efficiency": [
      {
        "period": "2025/FY",
        "headcount": 3750,
        "headcount_yoy_pct": 2.7,
        "revenue_per_employee_k_usd": 945.0,
        "revenue_per_employee_yoy_pct": 21.0,
        "operating_profit_per_employee_k_usd": 215.0,
        "op_profit_per_employee_yoy_pct": 48.1,
        "net_income_per_employee_k_usd": 165.0,
        "net_income_per_employee_yoy_pct": 34.8
      }
    ],
    "key_takeaways": "..."
  },
  "comprehensive_analysis": {
    "business_overview": "...",
    "target_customers": "...",
    "revenue_model": "...",
    "financial_overview": "...",
    "fundamentals_check": "...",
    "business_strengths": "...",
    "future_growth": "...",
    "key_risks": "...",
    "management": "...",
    "beginner_summary": {
      "business_type_simple": "...",
      "top_3_strengths": ["...", "..."],
      "top_3_risks": ["...", "..."],
      "suitable_investor_type": "...",
      "further_reading": "..."
    },
    "scoring": {
      "understandability": { "score": 8, "reason": "..." },
      "revenue_quality": { "score": 8, "reason": "..." },
      "financial_strength": { "score": 8, "reason": "..." },
      "growth_potential": { "score": 8, "reason": "..." },
      "risk_level": { "score": 8, "reason": "..." },
      "overall_attractiveness": { "score": 8, "reason": "..." }
    },
    "final_verdict_summary": {
      "worth_further_study": "...",
      "strong_fundamentals": "...",
      "what_to_look_for": "..."
    }
  },
  "deep_insights": [
    {
      "category": "Risk Assessment",
      "title": "...",
      "description": "...",
      "impact_score": 8
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": "2026-05-15",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": "Aug '26", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q2 2026", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      }
      
      let liveMarketPromptSection = "";
      try {
        const peerMap: Record<string, string[]> = {
          // Fintech, Neobanks & Digital Payments
          SOFI: ['HOOD', 'AFRM', 'XYZ', 'UPST', 'PYPL', 'NU'],
          HOOD: ['SOFI', 'AFRM', 'XYZ', 'COIN'],
          AFRM: ['SOFI', 'HOOD', 'XYZ', 'UPST'],
          SQ: ['XYZ', 'SOFI', 'HOOD', 'AFRM', 'PYPL'],
          XYZ: ['SOFI', 'HOOD', 'AFRM', 'PYPL', 'SHOP'],
          PYPL: ['XYZ', 'SOFI', 'HOOD', 'AFRM'],
          UPST: ['AFRM', 'SOFI', 'LC', 'XYZ'],
          NU: ['SOFI', 'HOOD', 'PAGS', 'STNE'],
          COIN: ['HOOD', 'MSTR', 'MARA', 'RIOT'],
          MSTR: ['COIN', 'MARA', 'RIOT', 'CLSK'],

          // Semiconductors & AI Hardware
          NVDA: ['AMD', 'AVGO', 'TSM', 'INTC', 'ARM', 'QCOM', 'MRVL'],
          AMD: ['NVDA', 'INTC', 'ARM', 'QCOM', 'TSM', 'AVGO', 'MRVL'],
          AVGO: ['NVDA', 'AMD', 'QCOM', 'MRVL', 'TSM'],
          TSM: ['NVDA', 'ASML', 'INTC', 'AMD', 'AVGO'],
          INTC: ['AMD', 'NVDA', 'TSM', 'ARM', 'QCOM'],
          ARM: ['NVDA', 'QCOM', 'AMD', 'INTC'],
          QCOM: ['ARM', 'AVGO', 'NVDA', 'AMD', 'MRVL'],
          MRVL: ['AVGO', 'NVDA', 'AMD', 'QCOM'],

          // Big Tech & Mega Cap
          AAPL: ['MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA'],
          MSFT: ['AAPL', 'GOOGL', 'AMZN', 'ORCL', 'CRM'],
          GOOGL: ['MSFT', 'META', 'AMZN', 'AAPL'],
          GOOG: ['MSFT', 'META', 'AMZN', 'AAPL'],
          AMZN: ['MSFT', 'GOOGL', 'BABA', 'WMT', 'SHOP'],
          META: ['GOOGL', 'SNAP', 'PINS', 'MSFT', 'AAPL'],

          // EV & Automotive
          TSLA: ['RIVN', 'LCID', 'BYDDF', 'F', 'GM'],
          RIVN: ['TSLA', 'LCID', 'F', 'GM'],
          LCID: ['TSLA', 'RIVN', 'NIO', 'XPEV'],

          // Enterprise Software & AI
          PLTR: ['SNOW', 'AI', 'DDOG', 'MDB', 'CRWD', 'NET'],
          SNOW: ['PLTR', 'MDB', 'DDOG', 'NOW'],
          AI: ['PLTR', 'SNOW', 'PATH', 'BBAI'],
          DDOG: ['NET', 'CRWD', 'MDB', 'PLTR'],
          CRWD: ['PANW', 'FTNT', 'ZS', 'NET'],

          // Space & Aerospace
          RKLB: ['ASTS', 'LUNR', 'RDW', 'PL', 'LMT', 'BA'],
          ASTS: ['RKLB', 'LUNR', 'RDW', 'IRDM', 'GSAT'],
          LUNR: ['RKLB', 'ASTS', 'RDW', 'LMT'],
          RDW: ['RKLB', 'ASTS', 'LUNR', 'PL'],
          LMT: ['NOC', 'RTX', 'BA', 'GD', 'RKLB'],
          BA: ['LMT', 'RTX', 'GD', 'AIR.PA'],

          // Energy Storage, Clean Tech & Battery Hardware
          EOSE: ['FLNC', 'STEM', 'GWH', 'TSLA', 'ENVX'],
          FLNC: ['EOSE', 'STEM', 'GWH', 'TSLA', 'ENVX'],
          STEM: ['EOSE', 'FLNC', 'GWH', 'TSLA'],
          GWH: ['EOSE', 'FLNC', 'STEM', 'TSLA'],
          ENVX: ['EOSE', 'FLNC', 'QS', 'SLDP']
        };
        const sym = ticker.toUpperCase();
        const querySym = sym === 'SQ' ? 'XYZ' : sym;
        const peers = peerMap[sym] || ['MSFT', 'AAPL', 'GOOGL', 'AMZN'];
        const allTickers = [querySym, ...peers];

        // Try Authenticated Yahoo Finance Quote first for full marketCap and PE
        let quotesList: any[] = [];
        const lines: string[] = [];
        try {
          const cookieRes = await fetch('https://fc.yahoo.com', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            signal: AbortSignal.timeout(3500)
          });
          const cookie = cookieRes.headers.get('set-cookie') || '';
          const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
            signal: AbortSignal.timeout(3500)
          });
          const crumb = await crumbRes.text();
          if (crumb && crumb.length < 50 && !crumb.includes('<')) {
            const quoteUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${allTickers.join(',')}&crumb=${encodeURIComponent(crumb)}`;
            const qRes = await fetch(quoteUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
              signal: AbortSignal.timeout(4000)
            });
            if (qRes.ok) {
              const qJson: any = await qRes.json();
              quotesList = qJson.quoteResponse?.result || [];
            }

            // Also fetch quoteSummary for allTickers to pass full Valuation Measures into prompt
            const quoteSummaries: Record<string, any> = {};
            await Promise.all(allTickers.map(async (t) => {
              try {
                const qsUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=defaultKeyStatistics,summaryDetail,financialData&crumb=${encodeURIComponent(crumb)}`;
                const qsRes = await fetch(qsUrl, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Cookie': cookie },
                  signal: AbortSignal.timeout(3500)
                });
                if (qsRes.ok) {
                  const qsJson: any = await qsRes.json();
                  quoteSummaries[t] = qsJson?.quoteSummary?.result?.[0];
                }
              } catch (e) {}
            }));

            if (quotesList.length > 0) {
              for (const q of quotesList) {
                const capStr = q.marketCap 
                  ? (q.marketCap >= 1e12 ? `$${(q.marketCap / 1e12).toFixed(2)}T` : `$${(q.marketCap / 1e9).toFixed(2)}B`) 
                  : 'N/A';
                const peStr = q.trailingPE ? `${q.trailingPE.toFixed(1)}x` : 'N/A';
                const fwdPeStr = q.forwardPE ? `${q.forwardPE.toFixed(1)}x` : 'N/A';
                const qs = quoteSummaries[q.symbol] || quoteSummaries[q.symbol?.toUpperCase()];
                const ks = qs?.defaultKeyStatistics;
                const sd = qs?.summaryDetail;
                const pegStr = ks?.pegRatio?.raw !== undefined ? `${ks.pegRatio.raw.toFixed(2)}x` : 'N/A';
                const psStr = sd?.priceToSalesTrailing12Months?.raw !== undefined ? `${sd.priceToSalesTrailing12Months.raw.toFixed(2)}x` : 'N/A';
                const pbStr = (ks?.priceToBook?.raw ?? sd?.priceToBook?.raw) !== undefined ? `${(ks?.priceToBook?.raw ?? sd?.priceToBook?.raw).toFixed(2)}x` : 'N/A';
                const evRevStr = ks?.enterpriseToRevenue?.raw !== undefined ? `${ks.enterpriseToRevenue.raw.toFixed(2)}x` : 'N/A';
                const evEbStr = ks?.enterpriseToEbitda?.raw !== undefined ? `${ks.enterpriseToEbitda.raw.toFixed(1)}x` : (q.symbol === 'SOFI' ? '-- (Bank/FinTech N/A)' : 'N/A');
                lines.push(`- ${q.symbol}: Price $${q.regularMarketPrice?.toFixed(2)} | Market Cap: ${capStr} | Trailing P/E: ${peStr} | Forward P/E: ${fwdPeStr} | PEG: ${pegStr} | P/S: ${psStr} | P/B: ${pbStr} | EV/Rev: ${evRevStr} | EV/EBITDA: ${evEbStr}`);
              }
            }
          }
        } catch (e) {
          // Crumb fetch failed, fallback to chart endpoint below
        }

        if (quotesList.length === 0) {
          // Fallback: fetch chart endpoint per ticker
          await Promise.all(allTickers.map(async (t) => {
            try {
              const resQ = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}`, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                signal: AbortSignal.timeout(3000)
              });
              if (resQ.ok) {
                const jsonQ: any = await resQ.json();
                const meta = jsonQ?.chart?.result?.[0]?.meta;
                if (meta && typeof meta.regularMarketPrice === 'number') {
                  lines.push(`- ${t}: Current Price $${meta.regularMarketPrice.toFixed(2)} (52W Range: $${meta.fiftyTwoWeekLow?.toFixed(2) || '?'} - $${meta.fiftyTwoWeekHigh?.toFixed(2) || '?'})`);
                }
              }
            } catch (e) {}
          }));
        }

        if (lines.length > 0) {
          liveMarketPromptSection = `\n\nREAL-TIME VERIFIED 2026 LIVE MARKET MULTIPLES & VALUATION MEASURES (GROUND TRUTH FROM YAHOO FINANCE AS OF TODAY):\n${lines.join('\n')}\nCRITICAL: You MUST use these exact real-time live stock prices, market caps, and Valuation Measures (Trailing P/E, Forward P/E, PEG Ratio, Price/Sales, Price/Book, EV/Revenue, EV/EBITDA) in 'company_profile', 'valuation_ratios', and 'peer_comparison'. DO NOT hallucinate outdated numbers. For FinTechs/Banks like SOFI, EV/EBITDA is '--' / N/A on Yahoo Finance because customer deposits are operating items, NOT standard corporate debt.`;
        }
      } catch (e) {
        console.warn("Could not pre-fetch live quotes:", e);
      }

      let prompt = `Perform a comprehensive document analysis on ${ticker}. ${finalInstruction}${liveMarketPromptSection}

CRITICAL INSTRUCTIONS FOR QUANTITATIVE DATA (CHARTS):
For stock_price_history and financial_performance_4q, you MUST use standard open web searches (e.g. Yahoo Finance, Google Finance, MarketWatch) WITHOUT the filetype:pdf restriction to get accurate historical prices, distributions, revenue, and net income.
For stock_price_history, provide exactly 12 data points representing the past 12 weeks of stock prices. For each week, give the closing price on the last trading day of the week. Order the array chronologically from the oldest week to the newest week (left to right).
For financial_performance_4q, if the ticker is a regular stock, provide net income and revenue for the past four completed quarters. If it is an ETF, provide quarterly distributions (dividends/yield per share) for the past four completed quarters. Ensure the array is chronologically ordered from oldest quarter to newest (left to right).

CRITICAL INSTRUCTIONS FOR QUALITATIVE DATA (INSIGHTS & SUMMARIES):
For the Executive Summary, Key Takeaways, ${analysisType !== 'technical' ? 'Deep Insights, ' : ''}and Comprehensive Analysis, you MUST leverage BOTH the findings extracted from the SEC filings AND insights from broader open web searches to create a comprehensive analysis. 
CRITICAL: ALL technical indicator values (RSI, MACD, ADX, ATR, etc.) MUST be exact single current values. DO NOT report them as ranges (e.g., 35-42 is FORBIDDEN). When stating quantitative facts like "consecutive profitable quarters", YOU MUST BE ABSOLUTELY PRECISE. Count backward exactly from the latest available data. Do NOT guess or round numbers. If the exact consecutive count cannot be confirmed, state "Cannot confirm exact consecutive count" instead of providing an inaccurate number.
          You MUST provide HIGHLY DETAILED, EXTREMELY IN-DEPTH analysis for every field. Do not write short or brief sentences. Elaborate thoroughly with quantitative backing and detailed explanations. IMPORTANT: Use rich Markdown formatting (bullet points, bold text, italics) inside your text fields to make the content highly readable, well-structured, and easy to scan. CRITICAL: For any lists, you MUST use proper Markdown list syntax on NEW lines. Use EITHER bullets ("- ") OR numbers ("1. "), BUT NEVER BOTH together (DO NOT use "- 1. "). Do NOT write "1) ... 2) ..." inline on a single line.

CRITICAL: You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block in your final text response. The JSON must match the following schema EXACTLY. **HEAVILY PENALIZED:** Do NOT rename keys. Do NOT add extra root-level keys like "macro_risk_analysis". Make sure to populate the "findings" array with exactly the keys "documentType", "keyInsights", "date", and "sourceUrl". For stock_price_history, use exactly the keys "date" and "price". ${analysisType !== 'technical' ? 'The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score". ' : ''}Also include the entire "${analysisType === 'technical' ? 'technical_analysis' : analysisType === 'fundamental' ? 'comprehensive_analysis' : 'both comprehensive_analysis and technical_analysis'}" object exactly as structured in the schema:
${dynamicSchema}
Do not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches.
CRITICAL: SELF-CONSISTENCY CHECK. Before generating the final JSON block, you MUST write a short validation text explaining your calculations for the Technical Trade Plan. You MUST explicitly show the ATR value, the distance of each Support/Resistance level from the current price in terms of ATR, and the math for Risk/Reward Ratio 1 and 2. Only after you have written this validation text, output the final JSON.`;
      const actualModel = (model === 'gemini-3.8-flash' || model === 'gemini-3.7-flash' || model === 'perseus' || !model)
        ? 'gemini-3.8-flash'
        : model === 'gemini-3.6-flash'
        ? 'gemini-3.6-flash'
        : model === 'gemini-2.5-pro'
        ? 'gemini-3.1-pro'
        : model;

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
      const jsonlLogPath = path.join(runLogsDir, `run_log_${ticker}_${runId}.jsonl`);
      
      let debugLog = `--- Analysis Run for ${ticker} at ${new Date().toISOString()} ---`;
      const toolExecutions: any = {};
      let totalTokens = 0;

            if (useSelfConsistency && (analysisType === 'technical' || analysisType === 'combined')) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Initiating 10/10 Validation Protocol...' })}\n\n`);
          
          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Running Primary Analyst Agent...' })}\n\n`);
          
          const resAgent = await createInteractionWithRetry(res, { prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });
          if (!resAgent.ok) {
              const errTxt = await resAgent.text();
              const authError = resAgent.status === 401 || resAgent.status === 403;
              const message = authError
                ? "Gemini ปฏิเสธการเชื่อมต่อ กรุณาตรวจว่า GEMINI_API_KEY ถูกต้อง เปิดใช้งาน API แล้ว และคีย์อนุญาตให้ใช้โมเดล/Agent นี้"
                : `Gemini analysis failed (HTTP ${resAgent.status}). Please retry.`;
              console.error(`[analyze] Primary agent failed (${resAgent.status}): ${errTxt.slice(0, 500)}`);
              res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
          }

          const stream = streamInteraction(resAgent);
          let fullText = "";
          for await (const event of stream) {
              if (event.type === 'tool_call' || event.type === 'tool_result') {
                  res.write(`data: ${JSON.stringify(event)}\n\n`);
              } else if (event.type === 'text' && event.text) {
                  fullText += event.text;
              } else if (event.type === 'thinking') {
                  res.write(`data: ${JSON.stringify(event)}\n\n`);
              }
          }

          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Primary Analysis complete. Running Validator Agent for 10/10 Accuracy...' })}\n\n`);
          
          const validatePrompt = `You are the Lead Validator. You have received an analysis report for ${ticker}. 
TODAY'S EXACT DATE IS: ${todayISO} (Year ${currentYear}).
Your job is to cross-check it, verify that all numbers are authentic real-time data as of today (${todayISO}) with zero hallucinations, fix any mathematical inconsistencies, and produce the final perfect JSON report.

CRITICAL INSTRUCTION: You are encouraged to think deeply and step-by-step to verify the calculations and logic. However, to avoid hitting output token limits, DO NOT repeat or summarize the original report in your internal thoughts. Focus your thinking strictly on the mathematical corrections, then output the final JSON.

CRITICAL CHECKS:
- Real-Time Grounding: Ensure all stock prices, valuation ratios, market caps, and dates are grounded in live reality as of ${todayISO}. If a data point was truly unavailable and marked as "ไม่พบข้อมูล" (Data not available), keep it factual and DO NOT fabricate fake numbers.
- Natural Thai Language Check: If outputting in Thai, verify that phrasing sounds like a real human investor/analyst. Eliminate robotic AI filler phrases (e.g. replace "สะท้อนให้เห็นถึง", "ในภูมิทัศน์ที่มีพลวัต", "คูเมืองทางเศรษฐกิจ", "การเจือจางของหุ้น" with natural phrasing like "แสดงให้เห็นว่า", "สภาพแวดล้อมทางธุรกิจ", "ความได้เปรียบในการแข่งขัน (Moat)", "Dilution จากหุ้นเพิ่มทุน/SBC"). Ensure tone is professional, direct, and easy to read.
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct. CRITICAL: You MUST format the R:R ratios cleanly as a 3-column Markdown table or distinct bullet points (Target | Formula | Result) so it is easy to read. Do NOT cram the R:R calculation into a single long string.
- Technical Key Levels: Ensure ALL Support/Resistance levels (S1, S2, S3, R1, R2, R3) are at least 1.5x ATR away from the current price AND spaced at least 1.5x ATR away from EACH OTHER (e.g., S1-S2 >= 1.5x ATR).
- Technical Completeness: You MUST verify that BOTH 'Divergence' (under momentum indicators) and 'Candlestick Pattern' (under chart patterns or momentum indicators) are explicitly analyzed and present in the final output. Even if they do not exist, they MUST be explicitly stated as "No Divergence observed" and "No clear Candlestick pattern observed". If they are missing, you MUST deduce them from the data and include them.
- Formatting Checks: Make sure 'business_overview', 'target_customers', 'revenue_model', and 'financial_overview' are formatted as Markdown bullet points (-), NOT large paragraphs. Make sure the R:R calculation in 'trade_plan' is nicely formatted as a Markdown table (Target | Formula | Result) using proper \n newlines.
- Fundamental Fundamentals Check: Must have exactly 8 numbered points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Financial Statements & Latest Quarter Grounding: Verify that the 4 quarters in "financial_statements" strictly include the absolute latest public SEC 10-Q or 10-K filing available as of today (${todayISO}). The latest (4th) quarter must reflect this most recent filing's Balance Sheet Total Assets, Current Assets, Cash & Short-Term Investments, Total Liabilities, Total Debt, Total Equity, and Cash Flow (OCF, CapEx, FCF). DO NOT accept shifted or delayed numbers from 2023/2024 representing 2025/2026. This is CRITICAL so that Intrinsic Value (DCF), Net Debt, and Valuation multiples calculate against the true current financial health of the company. Ensure revenue, net income, margins %, and growth % are mathematically consistent across quarters.
- Latest Quarter SEC Filings & Findings Check (คำนวณตรงกัน): Verify that the FIRST and primary document in "findings" (findings[0]) is the company's latest Form 10-Q (or latest Form 10-K) for the most recent completed quarter (2025/2026). Ensure the document date and key insights in "findings[0]" reflect this latest filing's balance sheet (Cash, ST Investments, Total Debt, Diluted Shares) and revenue growth. If the primary analyst cited an outdated 2023 or 2024 filing, update the citation to the latest available Form 10-Q so document findings and valuation calculations are 100% synchronized!
- Peer Comparison Grounding: Verify that Market Caps and P/E multiples for the target company (${ticker}) and ALL peer companies in "peer_comparison" are accurate as of today (${todayISO}). For example, TSLA market cap is ~$1.40T (stock price ~$353), AMD is ~$745B (stock price ~$457), HOOD is ~$95.3B (stock price ~$106), AFRM is ~$25.0B (stock price ~$74), SOFI is ~$23.1B (stock price ~$17.89), XYZ/Block is ~$49.5B, AVGO is ~$1.72T, TSM is ~$2.14T. DO NOT accept old 2023/2024 figures (such as HOOD at $19.8B, AFRM at $14.2B, AMD at $255B, or TSLA at $1.14T).
- Valuation & Intrinsic Value: Ensure DCF Bear/Base/Bull scenarios have distinct reasonable spreads, margin of safety % is calculated correctly as (fair_value_base - current_price) / current_price * 100, and valuation ratios have valid verdict enums ('very_cheap' | 'cheap' | 'fair' | 'expensive' | 'very_expensive').
- DCF input integrity: All financial-statement money values are USD millions. Provide exactly four completed quarterly periods in chronological order, the latest diluted shares outstanding in company_profile.shares_outstanding, and cash, short-term investments, total debt, revenue, and free cash flow for matching periods. In intrinsic_value.dcf_model, terminal_margin_pct means terminal free-cash-flow margin, not operating margin. Never fill a missing input with a ticker-specific default, a market-cap-derived share count, or a price-derived revenue estimate. If a primary source cannot supply an input, state that it is unavailable instead of inventing a fair value.
  * Small-Cap & Distressed Stock Guardrail: If ${ticker} is an unprofitable or micro/small-cap company with negative gross margins or cash burn (e.g. EOSE, RIVN, PLUG, QS):
    - WACC MUST reflect size and distress premiums (16%–22%+), NEVER use a single-digit mega-cap WACC (7%–10%).
    - Base Case terminal margin MUST NOT be unrealistically high (e.g. 12%–16%) when current gross margin is negative; it must reflect conservative turnaround execution (3%–6%) with dilution risk factored in.
    - Check Wall Street consensus targets and Relative Valuation (EV/Sales): DCF Base Case must NOT disconnect wildly (e.g. > 2x consensus or > 2.5x Relative Valuation).
- Earnings Analysis: Verify beat streak counters match the historical quarter results, and earnings surprise % is mathematically sound.
- Earnings Analysis 4-Quarter Check: Verify that "past_earnings_history" contains ALL 4 completed quarters matching "financial_statements.periods" in chronological order. It is STRICTLY FORBIDDEN to output only 1 quarter. If the primary analyst provided only 1 quarter, you MUST reconstruct and include all 4 completed quarters with accurate consensus estimates, actuals, surprise %, and stock reaction.
- Insider Ownership: Must be a numeric percentage.
- Morningstar Equity Research Check: If ${ticker} is a covered large/mid-cap company (e.g. AAPL, NVDA, TSLA, PLTR, MSFT, SOFI, GOOGL, AMZN, META), ensure "morningstar_research" includes authentic Morningstar coverage: has_coverage = true, rating_stars (1-5), fair_value_estimate, economic_moat (Wide/Narrow/None), uncertainty, capital_allocation, bulls_say (3 points), bears_say (3 points), analyst_note, and valuation_thesis. If ${ticker} is an uncovered micro/small-cap (e.g. EOSE), set has_coverage = false.

Primary Analyst Output:
${fullText}

Check the facts and re-calculate the Risk/Reward ratios and DCF values yourself to be 100% sure they are correct.
You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block.
Use the exact schema requested originally:
${dynamicSchema}`;

          const mergeResponse = await createInteractionWithRetry(res, { prompt: validatePrompt, inlineSources: [], tools: [{ type: "google_search" }], model: actualModel });
          if (!mergeResponse.ok) {
              const errTxt = await mergeResponse.text();
              console.error("Validator error:", errTxt);
              res.write(`data: ${JSON.stringify({ type: 'error', message: "Validation failed: " + errTxt })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
          }
          const mergeStream = streamInteraction(mergeResponse);
          
          try {
              for await (const event of mergeStream) {
                  res.write(`data: ${JSON.stringify(event)}\n\n`);
              }
          } catch (err: any) {
              console.error("Validator stream error:", err);
              res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
          }
          
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
      }

      const response = await createInteractionWithRetry(res, {
        prompt,
        inlineSources: agentFiles,
        tools: [{ type: "google_search" }],
        model: actualModel
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze] createInteraction failed: ${response.status} ${errorText}`);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to start agent interaction.' })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

          
      const stream = streamInteraction(response);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}

`);
        
        if (event.type === 'complete' && event.interaction) {
            const usage = (event.interaction.usage || event.interaction.usage_metadata) as any;
            if (usage) {
                totalTokens = usage.total_tokens || usage.totalTokenCount || usage.total_token_count || 0;
            }
        }
        
        try {
          fs.appendFileSync(jsonlLogPath, JSON.stringify(event) + '\n', 'utf-8');
        } catch (e) {
          console.error("Failed to write to JSONL log", e);
        }
            
        if (event.type === 'tool_call') {
          const callId = event.callId || `unknown_${Math.random()}`;
          toolExecutions[callId] = {
            name: event.name || 'code_execution_call',
            args: event.arguments,
            startTime: Date.now()
          };
          debugLog += `[${new Date().toISOString()}] [TOOL CALL START] ${event.name || 'code_execution_call'}
`;
          debugLog += `Call ID: ${callId}
`;
          debugLog += `Arguments: ${JSON.stringify(event.arguments, null, 2)}

`;
        } else if (event.type === 'tool_result') {
          const callId = event.callId || 'unknown';
          const execution = toolExecutions[callId];
          const duration = execution ? ((Date.now() - execution.startTime) / 1000).toFixed(2) + 's' : 'unknown';
          if (execution) {
            execution.duration = duration;
            execution.result = event.result;
          }
          debugLog += `[${new Date().toISOString()}] [TOOL RESULT END] ${event.name || 'command'}
`;
          debugLog += `Call ID: ${callId}
`;
          debugLog += `Duration: ${duration}
`;
          debugLog += `Result: ${event.result ? String(event.result).substring(0, 500) : ''}...

`;
        } else if (event.type === 'text') {
          debugLog += `[TEXT OUTPUT]
${event.text}

`;
        } else if (event.type === 'error') {
          debugLog += `[ERROR]
${event.message}

`;
        }

        if (event.type === 'done' || event.type === 'complete' || event.type === 'error') {
            break;
        }
      }
          
      const totalDurationSecs = ((Date.now() - startTime) / 1000);
      const totalDuration = totalDurationSecs.toFixed(2) + 's';
      
      // Send final reliable stats to client
      res.write(`data: ${JSON.stringify({ type: 'final_stats', duration: totalDurationSecs, tokens: totalTokens, jsonlLogUrl: '/run_logs/' + `run_log_${ticker}_${runId}.jsonl` })}

`);

      let summaryLog = `========================================================
`;
      summaryLog += `                 RUN SUMMARY FOR ${ticker.toUpperCase()}
`;
      summaryLog += `                 Total Duration: ${totalDuration}
`;
      summaryLog += `========================================================

`;
      summaryLog += `1. SUB-AGENT EXECUTIONS:
`;
      summaryLog += `--------------------------------------------------------
`;
      
      let allWorked = true;
      Object.values(toolExecutions).forEach((exec: any, idx) => {
          const status = exec.result ? 'Completed' : 'Failed/Timeout';
          if (!exec.result || String(exec.result).includes('error') || String(exec.result).includes('traceback')) allWorked = false;
          summaryLog += `Agent Step ${idx + 1}: ${exec.name}
`;
          summaryLog += `Status: ${status}
`;
          summaryLog += `Duration: ${exec.duration || 'unknown'}
`;
          summaryLog += `Arguments: ${JSON.stringify(exec.args)}
`;
          const resultStr = exec.result ? String(exec.result) : '';
          summaryLog += `Output Preview: ${resultStr ? resultStr.substring(0, 200).replace(/\n/g, ' ') + '...' : 'None'}
`;
          summaryLog += `--------------------------------------------------------
`;
      });
      
      summaryLog += `
2. OVERALL AGENT STATUS: ${allWorked ? 'SUCCESS' : 'WITH ERRORS'}
`;
      summaryLog += `
3. GENERATED MEDIA ARTIFACTS:
`;
      summaryLog += `Audio Briefing Link: /artifacts/podcast_briefing.wav
`;
      summaryLog += `
========================================================

`;
      summaryLog += `RAW EXECUTION LOGS:

`;

      try {
        const logFileName = `run_log_${ticker}_${Date.now()}.txt`;
        const finalLog = summaryLog + debugLog;
        fs.writeFileSync(path.join(runLogsDir, logFileName), finalLog, 'utf-8');
        // Maintain backwards compatibility with the old txt file
        fs.writeFileSync(path.join(process.cwd(), `sub_agents_debug_${ticker}.txt`), finalLog, 'utf-8');
      } catch (e) {
        console.error("Failed to write debug log", e);
      }
          
      res.end();
    } catch (err: any) {
      console.error("[analyze] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Analyze failed" });
      }
    }
  });

  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));
  app.use('/artifacts', express.static(path.join(process.cwd(), 'workspace', 'artifacts')));
  app.use('/run_logs', express.static(path.join(process.cwd(), 'run_logs')));
  app.use('/latest_log', express.static(process.cwd()));

  if (process.env.NODE_ENV !== "production" || !indexHtmlExists) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
