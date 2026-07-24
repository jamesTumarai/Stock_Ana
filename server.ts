import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

import { createInteraction, streamInteraction } from "./server/lib/agentClient.ts";
import { createInteraction as createInteractionPerseus, streamInteraction as streamInteractionPerseus } from "./server/lib/agentClientPerseus.ts";

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

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  app.post("/api/analyze", async (req, res) => {
    try {
      const { ticker, instruction, origin, model, language } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker." });
      }

      console.log(`[analyze] Starting analysis for ${ticker} using model ${model || 'default'} and language ${language || 'English'}`);
      
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents");
      
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const publicUrl = origin || `${protocol}://${host}`;

      let finalInstruction = `Find and analyze recent SEC filings and public stock documents for ${ticker}. Make sure that you are looking for the most up to date documents of the existing quarter or the quarter before (if documents have not been out yet for the existing quarter, look for the last quarter).`;

      if (instruction) {
        finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
      }

      if (language && language.toLowerCase() === 'thai') {
        finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output (summaries, insights, takeaways, titles, descriptions, etc.) in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats which can remain in English.
        
Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":

1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ
2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ
3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี
4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม P/E หรือ Valuation ปัจจุบัน เทียบกับคู่แข่งหรืออุตสาหกรรมด้วย เช็ค dilution/SBC (ต้องยาว 3-5 ประโยคเฉพาะเจาะจง)
5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check): ประเมินรายได้/กำไร/กระแสเงินสด/หนี้/margin/ROIC/โอกาสโตต่อ และสรุปว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"
6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย
7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน
8) ความเสี่ยงที่ต้องรู้ (for key_risks): แข่งขัน, ลูกค้า, กฎระเบียบ, เศรษฐกิจ, margin, valuation, ความเสี่ยงจาก dilution/SBC (ต้องยาว 3-5 ประโยค)
9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management): เก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม insider ownership/buying capital allocation (M&A, ซื้อหุ้นคืน) การทำตาม guidance (ต้องยาว 3-5 ประโยค)
10) สรุปให้มือใหม่ตัดสินใจ (for beginner_summary): 
 - business_type_simple: หุ้นตัวนี้เป็นธุรกิจแบบไหนในภาษาคนทั่วไป
 - top_3_strengths / top_3_risks: จุดเด่นและเสี่ยงอย่างละ 3 ข้อ
 - suitable_investor_type: เหมาะกับนักลงทุนสายไหน
 - further_reading: ถ้าจะศึกษาต่อ ควรไปอ่านอะไรเพิ่ม
11) ให้คะแนนแบบง่าย (for scoring): ให้คะแนน 1-10 พร้อมเหตุผลสั้น ๆ สำหรับ understandability, revenue_quality, financial_strength, growth_potential, risk_level, overall_attractiveness
12) Final Verdict (for final_verdict_summary): สรุปว่า น่าศึกษาต่อไหม (worth_further_study), พื้นฐานดีจริงไหม (strong_fundamentals), ถ้าเป็นมือใหม่ควรดูอะไรเพิ่มก่อนซื้อ (what_to_look_for)

เงื่อนไขสำคัญ:
- อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
- ถ้าข้อมูลบางจุดไม่ชัด ให้บอกตรง ๆ ว่าไม่ชัด หรือ "ไม่มีข้อมูลเปิดเผย"
- ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี)
- อธิบายศัพท์ยากเป็นภาษาง่ายในวงเล็บ ตอบแบบภาษาคนลงทุน ไม่ใช่ภาษาทางการแข็ง ๆ
- เทียบกับคู่แข่งหรืออุตสาหกรรมในจุดที่ทำได้
- ระวังอคติจากฝั่งผู้บริหาร (management bias) 
- ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง" โดยไม่มีตัวเลข ทุกประโยคต้องมีตัวเลขจริงกำกับ
- แต่ละหัวข้อต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ ถ้าหาไม่ได้ให้ระบุว่า "ไม่พบข้อมูลนี้ในเอกสารที่มี"`;
      }

      const dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": 85,
    "key_takeaways": ["...", "..."]
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
      "documentType": "Form 10-K",
      "keyInsights": ["...", "..."],
      "date": "2023-12-31",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_4m": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;;

      const prompt = `Perform a comprehensive document analysis on ${ticker}. ${finalInstruction}\n\nCRITICAL INSTRUCTIONS FOR QUANTITATIVE DATA (CHARTS):\nFor stock_price_4m and financial_performance_4q, you MUST use standard open web searches (e.g. Yahoo Finance, Google Finance, MarketWatch) WITHOUT the filetype:pdf restriction to get accurate historical prices, distributions, revenue, and net income. Do NOT rely solely on SEC PDFs for this quantitative data.\nFor stock_price_4m, provide exactly 4 data points representing the past 4 months of stock prices. For each month, give the closing price on the last trading day of the month. Order the array chronologically from the oldest month to the newest month (left to right).\nFor financial_performance_4q, if the ticker is a regular stock, provide net income and revenue for the past four completed quarters. If it is an ETF, provide quarterly distributions (dividends/yield per share) for the past four completed quarters. Ensure the array is chronologically ordered from oldest quarter to newest (left to right).\n\nCRITICAL INSTRUCTIONS FOR QUALITATIVE DATA (INSIGHTS & SUMMARIES):\nFor the Executive Summary, Key Takeaways, Deep Insights, and Comprehensive Analysis, you MUST leverage BOTH the findings extracted from the PDF SEC filings AND insights from broader open web searches to create a comprehensive analysis.\n\nCRITICAL: You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block in your final text response. The JSON must match the following schema EXACTLY. **HEAVILY PENALIZED:** Do NOT rename keys. Do NOT add extra root-level keys like "macro_risk_analysis". Make sure to populate the "findings" array with exactly the keys "documentType", "keyInsights", "date", and "sourceUrl". For stock_price_4m, use exactly the keys "date" and "price". The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score". Also include the entire "comprehensive_analysis" object exactly as structured in the schema:\n${dynamicSchema}\nDo not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches.`;

      const actualModel = model === 'perseus' ? 'gemini-3.6-flash' : model === 'gemini-2.5-pro' ? 'gemini-3.1-pro' : (model || 'gemini-3.5-flash');
      const response = await createInteraction({
        prompt,
        inlineSources: agentFiles,
        tools: [{ type: "google_search" }],
        model: actualModel
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[analyze] createInteraction failed: ${response.status} ${errorText}`);
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
      const jsonlLogPath = path.join(runLogsDir, `run_log_${ticker}_${runId}.jsonl`);
      
      let debugLog = `--- Analysis Run for ${ticker} at ${new Date().toISOString()} ---\n\n`;
      const toolExecutions = {};
      let totalTokens = 0;
          
      const stream = streamInteraction(response);
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        
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
          debugLog += `[${new Date().toISOString()}] [TOOL CALL START] ${event.name || 'code_execution_call'}\n`;
          debugLog += `Call ID: ${callId}\n`;
          debugLog += `Arguments: ${JSON.stringify(event.arguments, null, 2)}\n\n`;
        } else if (event.type === 'tool_result') {
          const callId = event.callId || 'unknown';
          const execution = toolExecutions[callId];
          const duration = execution ? ((Date.now() - execution.startTime) / 1000).toFixed(2) + 's' : 'unknown';
          if (execution) {
            execution.duration = duration;
            execution.result = event.result;
          }
          debugLog += `[${new Date().toISOString()}] [TOOL RESULT END] ${event.name || 'command'}\n`;
          debugLog += `Call ID: ${callId}\n`;
          debugLog += `Duration: ${duration}\n`;
          debugLog += `Result: ${event.result ? String(event.result).substring(0, 500) : ''}...\n\n`;
        } else if (event.type === 'text') {
          debugLog += `[TEXT OUTPUT]\n${event.text}\n\n`;
        } else if (event.type === 'error') {
          debugLog += `[ERROR]\n${event.message}\n\n`;
        }

        if (event.type === 'done' || event.type === 'complete' || event.type === 'error') {
            break;
        }
      }
          
      const totalDurationSecs = ((Date.now() - startTime) / 1000);
      const totalDuration = totalDurationSecs.toFixed(2) + 's';
      
      // Send final reliable stats to client
      res.write(`data: ${JSON.stringify({ type: 'final_stats', duration: totalDurationSecs, tokens: totalTokens, jsonlLogUrl: '/run_logs/' + `run_log_${ticker}_${runId}.jsonl` })}\n\n`);

      let summaryLog = `========================================================\n`;
      summaryLog += `                 RUN SUMMARY FOR ${ticker.toUpperCase()}\n`;
      summaryLog += `                 Total Duration: ${totalDuration}\n`;
      summaryLog += `========================================================\n\n`;
      summaryLog += `1. SUB-AGENT EXECUTIONS:\n`;
      summaryLog += `--------------------------------------------------------\n`;
      
      let allWorked = true;
      Object.values(toolExecutions).forEach((exec: any, idx) => {
          const status = exec.result ? 'Completed' : 'Failed/Timeout';
          if (!exec.result || String(exec.result).includes('error') || String(exec.result).includes('traceback')) allWorked = false;
          summaryLog += `Agent Step ${idx + 1}: ${exec.name}\n`;
          summaryLog += `Status: ${status}\n`;
          summaryLog += `Duration: ${exec.duration || 'unknown'}\n`;
          summaryLog += `Arguments: ${JSON.stringify(exec.args)}\n`;
          const resultStr = exec.result ? String(exec.result) : '';
          summaryLog += `Output Preview: ${resultStr ? resultStr.substring(0, 200).replace(/\n/g, ' ') + '...' : 'None'}\n`;
          summaryLog += `--------------------------------------------------------\n`;
      });
      
      summaryLog += `\n2. OVERALL AGENT STATUS: ${allWorked ? 'SUCCESS' : 'WITH ERRORS'}\n`;
      summaryLog += `\n3. GENERATED MEDIA ARTIFACTS:\n`;
      summaryLog += `Audio Briefing Link: /artifacts/podcast_briefing.wav\n`;
      summaryLog += `\n========================================================\n\n`;
      summaryLog += `RAW EXECUTION LOGS:\n\n`;

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
