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
  while (attempt < 3) {
    const response = await createInteraction(opts);
    if (response.ok) return response;
    
    if (response.status === 429) {
      const errTxt = await response.text();
      let retryInSecs = 40;
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
    } else {
      // Re-construct the response so the caller can read .text()
      const errTxt = await response.text();
      return new Response(errTxt, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
  }
  return await createInteraction(opts);
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
      const { ticker, instruction, origin, model, language, analysisType, useSelfConsistency } = req.body;
      if (!ticker) {
        return res.status(400).json({ error: "Missing ticker." });
      }

      console.log(`[analyze] Starting analysis for ${ticker} using model ${model || 'default'}, language ${language || 'English'}, type ${analysisType || 'fundamental'}`);
      
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents");
      
      const host = req.get('host');
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const publicUrl = origin || `${protocol}://${host}`;

      let finalInstruction = `Find and analyze recent public information, news, and stock data for ${ticker}.`;
      
      let dynamicSchema = ``;
      
      if (analysisType === 'technical') {
        finalInstruction += ` Focus entirely on technical analysis. Make sure that you are looking for the most up to date data and charts.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\n\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats. STRICTLY FORBIDDEN to use Japanese, Chinese (e.g., 鏈, 網, 幣), or any other languages. YOU MUST REMOVE ALL CHINESE CHARACTERS. Translate terms like 'zone' to Thai (โซน).
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมดจากหัวข้อข้างต้น ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, MACD = ลบ, RSI = กลาง" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points (ขึ้นบรรทัดใหม่แต่ละข้อ) เพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level)
          2) key_levels: current_price (ราคาปัจจุบันเป็นตัวเลข), support 3 ระดับ, resistance 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1.5x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน ห้ามใช้สูตรคำนวณแยก)
          3) trade_plan: แผนการเทรด โซนเข้า (ระบุราคา ถ้าต่ำกว่าราคาปัจจุบันต้องเป็นการย่อเพื่อซื้อ), stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown table (ตาราง) ที่มี 3 คอลัมน์ (Target | Formula | Result) โดยต้องใช้ \n ขึ้นบรรทัดใหม่ให้ถูกต้องตามหลัก Markdown)
          4) overall_trend: อธิบายภาพรวม
          5) price_structure: โครงสร้างราคา
          6) volume_analysis: วิเคราะห์ Volume
          7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)
          8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง. CRITICAL: คุณต้องระบุชัดเจน 2 เรื่อง: 1. มี Bullish/Bearish Divergence หรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Divergence") 2. มี Candlestick pattern กลับตัวหรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Candlestick pattern ที่ชัดเจน"))
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: รูปแบบราคา (สำคัญ: ต้องวิเคราะห์ทั้ง Chart Pattern และ Candlestick Pattern เสมอ หากไม่พบรูปแบบที่ชัดเจนให้ระบุว่า "ไม่พบรูปแบบที่ชัดเจน" ห้ามข้ามหรือละเว้นเด็ดขาด)
          11) relative_strength: เทียบกับตลาด
          12) technical_risks: ความเสี่ยงเชิงเทคนิคที่ต้องรู้ (ต้องตอบให้ครบ 4 ประเด็นนี้: 1. ความเสี่ยงจากสัญญาณหลอก (false breakout/whipsaw), 2. gap risk (เช่น ข่าว/earnings ถัดไป), 3. ความเสี่ยงจาก volume/liquidity ต่ำ, 4. regime ปัจจุบัน (trending หรือ choppy/sideways) ห้ามตอบแค่ข้อเดียวแล้วข้ามข้ออื่น)
          13) beginner_summary: สรุปให้มือใหม่ตัดสินใจแบบตรงไปตรงมา:
           - technical_overview: ภาพรวมเทคนิคอลตอนนี้เป็นแบบไหนในภาษาคนทั่วไป
           - top_3_points: จุดที่น่าสนใจ 3 ข้อ
           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ
           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน (เช่น day/swing/position trade ต้องสอดคล้องกับแผนเข้าจริง ถ้าโซนเข้าซื้ออยู่สูงกว่าปัจจุบัน ห้ามเรียกว่า Buy on Dip เด็ดขาด)
          14) scoring: คะแนน 1-10 พร้อมเหตุผล
          15) final_verdict_summary: สรุปสุดท้าย
          เงื่อนไขสำคัญ:
          - CRITICAL: สำหรับการวิเคราะห์ทางเทคนิค ต้องตอบให้ครบทุกหัวข้อ (1-15) และหัวข้อย่อย ห้ามข้ามหรือละเว้นเด็ดขาด หากไม่พบสัญญาณใด (เช่น ไม่มี Divergence, ไม่มี Candlestick pattern) ให้ระบุให้ชัดเจนว่า "ไม่พบสัญญาณในขณะนี้" แทนการเว้นว่าง
          - อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง", "เติบโตดี" โดยไม่มีตัวเลขหรือข้อเท็จจริงเฉพาะเจาะจงรองรับ ทุกประโยคต้องมีตัวเลขจริงกำกับ เช่น "รายได้เติบโต 24% YoY"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ โดยเฉพาะ dilution/SBC, insider ownership, capital allocation, การเทียบกับคู่แข่ง
          - หัวข้อ 4 (งบการเงิน), 8 (ความเสี่ยง), 9 (ผู้บริหาร) ต้องมีความยาวอย่างน้อย 3-5 ประโยคที่มีเนื้อหาเฉพาะเจาะจงต่อ bullet ห้ามสรุปทั้งหัวข้อด้วยประโยคเดียว
          - ระวังอคติจากฝั่งผู้บริหาร (management bias) 
          - ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี) กำกับตัวเลขสำคัญ
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;
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
      "documentType": "Form 10-K",
      "keyInsights": ["...", "..."],
      "date": "2023-12-31",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      } else if (analysisType === 'combined') {
        finalInstruction += ` Focus on BOTH fundamental analysis (company business, financials, management) AND technical analysis (price trends, support/resistance, indicators). Make sure that you are looking for the most up to date data, SEC filings, and charts.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats. STRICTLY FORBIDDEN to use Japanese, Chinese (e.g., 鏈, 網, 幣), or any other languages. YOU MUST REMOVE ALL CHINESE CHARACTERS. Translate terms like 'zone' to Thai (โซน).
          Please follow this specific guideline for BOTH Fundamental and Technical Analysis:
          
          - Fundamental Analysis:
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้พูดถึงสภาพคล่องและเงินกองทุนแทน แต่ห้ามข้ามเด็ดขาด) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a Markdown NUMBERED list (1., 2., 3.) to assess these 8 areas in detail, using '\n\n' to separate each point. DO NOT use bullets ('- ') before the numbers: 1.รายได้โตจริงไหม 2.กำไรโตตามไหม 3.กระแสเงินสด 4.หนี้สินน่ากังวลไหม 5.Margin 6.ROIC/ROE/ROA 7.โอกาสโตต่อ 8.สรุปฟันธงว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"
          6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร (brand, scale, data, etc.) ของจริงหรือแค่ story เทียบกับคู่แข่งหลัก 1-2 ราย (CRITICAL: You MUST use a Markdown numbered list using '\n\n' to separate points, e.g. '1. ', '2. '. DO NOT use bullets '-' before the numbers.)
          7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน (CRITICAL: You MUST use a Markdown numbered list using '\n\n' to separate points, e.g. '1. ', '2. '. DO NOT use bullets '-' before the numbers.)
          8) ความเสี่ยงที่ต้องรู้ (for key_risks): CRITICAL: You MUST cover at least 8 risk categories (including competition, customer concentration, regulatory, economic, margin, valuation, dilution/SBC, and hidden risks for beginners). EACH bullet MUST contain at least 3-5 sentences of detailed explanation. DO NOT write single-sentence bullets. (ใช้ Markdown numbered lists เช่น "1. ", "2. " และห้ามใช้ "- 1." เด็ดขาด)
          9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management): เก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม insider ownership/buying capital allocation (M&A, ซื้อหุ้นคืน) การทำตาม guidance (ต้องยาว 3-5 ประโยค). CRITICAL: For insider ownership, you MUST provide the exact numerical percentage (%). DO NOT use vague adjectives without real numbers.
          10) สรุปให้มือใหม่ตัดสินใจ (for beginner_summary): 
           - business_type_simple: หุ้นตัวนี้เป็นธุรกิจแบบไหนในภาษาคนทั่วไป
           - top_3_strengths / top_3_risks: จุดเด่นและเสี่ยงอย่างละ 3 ข้อ
           - suitable_investor_type: เหมาะกับนักลงทุนสายไหน
           - further_reading: ถ้าจะศึกษาต่อ ควรไปอ่านอะไรเพิ่ม
          11) ให้คะแนนแบบง่าย (for scoring): ให้คะแนน 1-10 พร้อมเหตุผลสั้น ๆ สำหรับ understandability, revenue_quality, financial_strength, growth_potential, risk_level, overall_attractiveness
          12) Final Verdict (for final_verdict_summary): สรุปว่า น่าศึกษาต่อไหม (worth_further_study), พื้นฐานดีจริงไหม (strong_fundamentals), ถ้าเป็นมือใหม่ควรดูอะไรเพิ่มก่อนซื้อ (what_to_look_for)
          
          - Technical Analysis:
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (รวมสัญญาณทั้งหมดจากหัวข้อข้างต้น ลิสต์เป็นรายการทีละสัญญาณว่าอันไหนบวก ลบ หรือกลาง เช่น "MA Cross = บวก, RSI = บวก" ห้ามสรุปแค่ตัวเลขรวมโดยไม่แสดงรายการที่นับมาก่อน โดยต้องใช้ Markdown bullet points (ขึ้นบรรทัดใหม่แต่ละข้อ) เพื่อให้อ่านง่าย จากนั้นสรุปทิศทางรวม และระบุ Invalidation level ระดับราคาที่ถ้าหลุด/break จะทำให้มุมมองเปลี่ยนไป)
          2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข (CRITICAL RULE: แต่ละระดับ S/R จะต้องมีระยะห่างจากราคาปัจจุบันอย่างน้อย 1.5 เท่าของค่า ATR (1.5x ATR) เพื่อหลีกเลี่ยง Noise และห่างจากระดับถัดไปอย่างน้อย 1.5x ATR ห้ามระบุระดับที่ใกล้กว่าเกณฑ์นี้อย่างเด็ดขาด ให้ปัดไปหาระดับแนวรับแนวต้านหลักที่ไกลออกไปแทน)
          3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio (CRITICAL: ต้องคำนวณ risk/reward ratio แยกกันให้ครบทั้ง 2 Targets คือ R:R สำหรับ Target 1 และ R:R สำหรับ Target 2 โดยใช้สูตร (Target - Entry) / (Entry - Stop-Loss) และแสดงตัวเลขที่ใช้คำนวณกำกับไว้ให้ชัดเจนทั้งสองค่า คุณต้องจัดรูปแบบสูตร R:R ให้เป็น Markdown table (ตาราง) ที่มี 3 คอลัมน์ (Target | Formula | Result) โดยต้องใช้ \n ขึ้นบรรทัดใหม่ให้ถูกต้องตามหลัก Markdown)
          4) overall_trend: อธิบายภาพรวม
          5) price_structure: โครงสร้างราคา
          6) volume_analysis: วิเคราะห์ Volume
          7) trend_indicators: MA, MACD, ADX (สำคัญ: MACD, ADX ต้องระบุเป็นค่าตัวเลขเดียว ณ ปัจจุบัน ห้ามรายงานเป็นช่วงกว้างเด็ดขาด)
          8) momentum_indicators: RSI, Stochastic (สำคัญ: RSI, Stochastic ต้องระบุเป็นค่าตัวเลขเดียว ห้ามเป็นช่วงกว้าง. CRITICAL: คุณต้องระบุชัดเจน 2 เรื่อง: 1. มี Bullish/Bearish Divergence หรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Divergence") 2. มี Candlestick pattern กลับตัวหรือไม่ (ถ้าไม่มีบังคับพิมพ์ "ไม่พบ Candlestick pattern ที่ชัดเจน"))
          9) volatility_indicators: Bollinger Bands, ATR (ระวังอย่าให้ค่า ATR และ MACD สลับกันหรือซ้ำกัน)
          10) chart_patterns: รูปแบบราคา (สำคัญ: ต้องวิเคราะห์ทั้ง Chart Pattern และ Candlestick Pattern เสมอ หากไม่พบรูปแบบที่ชัดเจนให้ระบุว่า "ไม่พบรูปแบบที่ชัดเจน" ห้ามข้ามหรือละเว้นเด็ดขาด)
          11) relative_strength: เทียบกับตลาด
          12) technical_risks: ความเสี่ยงเชิงเทคนิคที่ต้องรู้ (ต้องตอบให้ครบ 4 ประเด็นนี้: 1. ความเสี่ยงจากสัญญาณหลอก (false breakout/whipsaw), 2. gap risk (เช่น ข่าว/earnings ถัดไป), 3. ความเสี่ยงจาก volume/liquidity ต่ำ, 4. regime ปัจจุบัน (trending หรือ choppy/sideways) ห้ามตอบแค่ข้อเดียวแล้วข้ามข้ออื่น)
          13) beginner_summary: สรุปให้มือใหม่ตัดสินใจแบบตรงไปตรงมา:
           - technical_overview: ภาพรวมเทคนิคอลตอนนี้เป็นแบบไหนในภาษาคนทั่วไป
           - top_3_points: จุดที่น่าสนใจ 3 ข้อ
           - top_3_cautions: จุดที่ต้องระวัง 3 ข้อ
           - suitable_trade_style: เหมาะกับสไตล์การเทรดแบบไหน (เช่น day/swing/position trade ต้องสอดคล้องกับแผนเข้าจริง ถ้าโซนเข้าซื้ออยู่สูงกว่าปัจจุบัน ห้ามเรียกว่า Buy on Dip เด็ดขาด)
          14) scoring: คะแนน 1-10 พร้อมเหตุผล
          15) final_verdict_summary: สรุปสุดท้าย

          เงื่อนไขสำคัญ:
          - อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง", "เติบโตดี" โดยไม่มีตัวเลขหรือข้อเท็จจริงเฉพาะเจาะจงรองรับ ทุกประโยคต้องมีตัวเลขจริงกำกับ เช่น "รายได้เติบโต 24% YoY"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ โดยเฉพาะ dilution/SBC, insider ownership, capital allocation, การเทียบกับคู่แข่ง
          - หัวข้อ 4 (งบการเงิน), 8 (ความเสี่ยง), 9 (ผู้บริหาร) ต้องมีความยาวอย่างน้อย 3-5 ประโยคที่มีเนื้อหาเฉพาะเจาะจงต่อ bullet ห้ามสรุปทั้งหัวข้อด้วยประโยคเดียว
          - ระวังอคติจากฝั่งผู้บริหาร (management bias) 
          - ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี) กำกับตัวเลขสำคัญ
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;
        } else {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.
          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;
        }
        
        dynamicSchema = `{
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
      "documentType": "Form 10-K",
      "keyInsights": ["...", "..."],
      "date": "2023-12-31",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      } else {
        finalInstruction += ` Make sure that you are looking for the most up to date SEC filings of the existing quarter or the quarter before.`;
        if (instruction) {
          finalInstruction += `\n\nAdditional Instructions from user:\n${instruction}`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology. STRICTLY FORBIDDEN to use Japanese, Chinese (e.g., 鏈, 網, 幣), or any other languages. YOU MUST REMOVE ALL CHINESE CHARACTERS. Translate terms like 'zone' to Thai (โซน).
          Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประเด็น รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม (หากเป็นธนาคาร/สถาบันการเงิน ให้ใช้ ROE, NIM, อัตราส่วนเงินฝากต่อสินเชื่อแทน) P/E หรือ Valuation เทียบกับอุตสาหกรรม เช็ค dilution/SBC (CRITICAL: คุณต้องจัดรูปแบบคำตอบเป็น Markdown bullet points "-" เพื่อให้อ่านง่าย ห้ามเขียนเป็นพารากราฟยาวรวดเดียว)
          5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check): CRITICAL: This field MUST NEVER BE EMPTY. You MUST use a Markdown NUMBERED list (1., 2., 3.) to assess these 8 areas in detail, using '\n\n' to separate each point. DO NOT use bullets ('- ') before the numbers: 1.รายได้โตจริงไหม 2.กำไรโตตามไหม 3.กระแสเงินสด 4.หนี้สินน่ากังวลไหม 5.Margin 6.ROIC/ROE/ROA 7.โอกาสโตต่อ 8.สรุปฟันธงว่า "พื้นฐานดี", "ดีแต่มีจุดต้องระวัง", หรือ "ยังไม่แข็งแรง"
          6) จุดแข็งของธุรกิจ (for business_strengths): มี moat หรือความได้เปรียบอะไร ของจริงหรือแค่ story ช่วยยกตัวอย่างคู่แข่งหลัก 1-2 ราย และบอกว่าบริษัทนี้เหนือกว่าหรือด้อยกว่าคู่แข่งตรงไหน
          7) Optionality หรือโอกาสโตในอนาคต (for future_growth): โตเพิ่มจากอะไร upside ที่ตลาดมองไม่เต็ม ปัจจัยเร่ง (Catalysts) ใน 6-12 เดือน
          8) ความเสี่ยงที่ต้องรู้ (for key_risks): CRITICAL: คุณต้องตอบให้ครบทั้ง 8 หมวดต่อไปนี้ ห้ามข้ามเด็ดขาด แต่ละหมวดต้องเขียนอย่างน้อย 2-3 ประโยคพร้อมตัวเลขรองรับ: 1.การแข่งขัน 2.ลูกค้ากระจุกตัว 3.กฎระเบียบ 4.เศรษฐกิจ 5.margin ลด 6.valuation แพงเกินไป 7.ความเสี่ยงที่มือใหม่มักมองข้าม 8.การลดสัดส่วนผู้ถือหุ้น (dilution)/SBC
          9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management): CRITICAL: คุณต้องเขียนอย่างน้อย 3-5 ประโยค ตอบให้ครบ: ผู้บริหารเก่งเรื่องอะไร ทำได้จริงไหม สอดคล้องกับตัวเลขไหม, สัดส่วน insider ownership ต้องระบุเป็น % ตัวเลขจริง (ถ้าไม่พบให้เขียน "ไม่พบข้อมูลสัดส่วนการถือหุ้นผู้บริหารในเอกสารที่มี"), insider buying/selling, การจัดสรรเงินทุน (capital allocation) เช่น M&A/ซื้อหุ้นคืน, ตรวจสอบคำพูดผู้บริหารแบบตั้งคำถาม (critical) ว่าเคยพลาดเป้าจาก guidance ไหม
          10) สรุปให้มือใหม่ตัดสินใจ (for beginner_summary): 
           - business_type_simple: หุ้นตัวนี้เป็นธุรกิจแบบไหนในภาษาคนทั่วไป
           - top_3_strengths / top_3_risks: จุดเด่นและเสี่ยงอย่างละ 3 ข้อ
           - suitable_investor_type: เหมาะกับนักลงทุนสายไหน
           - further_reading: ถ้าจะศึกษาต่อ ควรไปอ่านอะไรเพิ่ม
          11) ให้คะแนนแบบง่าย (for scoring): ให้คะแนน 1-10 พร้อมเหตุผลสั้น ๆ สำหรับ understandability, revenue_quality, financial_strength, growth_potential, risk_level, overall_attractiveness
          12) Final Verdict (for final_verdict_summary): สรุปว่า น่าศึกษาต่อไหม (worth_further_study), พื้นฐานดีจริงไหม (strong_fundamentals), ถ้าเป็นมือใหม่ควรดูอะไรเพิ่มก่อนซื้อ (what_to_look_for)

          เงื่อนไขสำคัญ:
          - อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
          - ตัวเลขประเภท "นับต่อเนื่อง" ต้องแม่นยำเป๊ะ ห้ามประมาณ ถ้านับไม่ได้ให้บอกว่า "ไม่สามารถยืนยันจำนวนไตรมาสที่แน่นอนได้"
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง", "เติบโตดี" โดยไม่มีตัวเลขหรือข้อเท็จจริงเฉพาะเจาะจงรองรับ ทุกประโยคต้องมีตัวเลขจริงกำกับ เช่น "รายได้เติบโต 24% YoY"
          - แต่ละหัวข้อ (1-12) ต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ โดยเฉพาะ dilution/SBC, insider ownership, capital allocation, การเทียบกับคู่แข่ง
          - หัวข้อ 4 (งบการเงิน), 8 (ความเสี่ยง), 9 (ผู้บริหาร) ต้องมีความยาวอย่างน้อย 3-5 ประโยคที่มีเนื้อหาเฉพาะเจาะจงต่อ bullet ห้ามสรุปทั้งหัวข้อด้วยประโยคเดียว
          - ระวังอคติจากฝั่งผู้บริหาร (management bias) 
          - ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี) กำกับตัวเลขสำคัญ
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;
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
    "stock_price_history": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}`;
      }
      
      let prompt = `Perform a comprehensive document analysis on ${ticker}. ${finalInstruction}

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
      const actualModel = (model === 'gemini-3.7-flash' || model === 'perseus' || !model)
        ? 'gemini-3.7-flash'
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
              res.write(`data: ${JSON.stringify({ type: 'error', message: "Primary agent failed: " + errTxt })}\n\n`);
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
Your job is to cross-check it, fix any mathematical inconsistencies, and produce the final perfect JSON report.

CRITICAL INSTRUCTION: You are encouraged to think deeply and step-by-step to verify the calculations and logic. However, to avoid hitting output token limits, DO NOT repeat or summarize the original report in your internal thoughts. Focus your thinking strictly on the mathematical corrections, then output the final JSON.

CRITICAL CHECKS:
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct. CRITICAL: You MUST format the R:R ratios cleanly as a 3-column Markdown table or distinct bullet points (Target | Formula | Result) so it is easy to read. Do NOT cram the R:R calculation into a single long string.
- Technical Key Levels: Ensure ALL Support/Resistance levels (S1, S2, S3, R1, R2, R3) are at least 1.5x ATR away from the current price AND spaced at least 1.5x ATR away from EACH OTHER (e.g., S1-S2 >= 1.5x ATR).
- Technical Completeness: You MUST verify that BOTH 'Divergence' (under momentum indicators) and 'Candlestick Pattern' (under chart patterns or momentum indicators) are explicitly analyzed and present in the final output. Even if they do not exist, they MUST be explicitly stated as "No Divergence observed" and "No clear Candlestick pattern observed". If they are missing, you MUST deduce them from the data and include them.
- Formatting Checks: Make sure 'business_overview', 'target_customers', 'revenue_model', and 'financial_overview' are formatted as Markdown bullet points (-), NOT large paragraphs. Make sure the R:R calculation in 'trade_plan' is nicely formatted as a Markdown table (Target | Formula | Result) using proper \n newlines.
- Fundamental Fundamentals Check: Must have exactly 8 bullet points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Insider Ownership: Must be a numeric percentage.

Primary Analyst Output:
${fullText}

Check the facts and re-calculate the Risk/Reward ratios yourself to be 100% sure they are correct.
You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block.
Use the exact schema requested originally:
${dynamicSchema}`;

          const mergeResponse = await createInteractionWithRetry(res, { prompt: validatePrompt, inlineSources: [], model: actualModel });
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
