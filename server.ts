try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv/config");
} catch {
  // Dotenv is optional in serverless/production environments where environment variables are injected
}
import express from "express";
import path from "path";
import fs from "fs";
import { createRequireFirebaseAuth } from "./server/auth/firebaseAuth.ts";
import { createUserConcurrencyLimiter, createUserRateLimiter } from "./server/middleware/userRateLimit.ts";
import {
  normalizeAnalysisLanguage,
  normalizeAnalysisType,
  normalizeBoolean,
  normalizeGeminiModel,
  normalizeOptionalText,
  normalizeTicker,
} from "./server/security/requestSecurity.ts";
import { registerTtsRoutes } from "./server/routes/ttsRoutes.ts";
import { registerMetricRoutes } from "./server/routes/metricRoutes.ts";
import { registerDcfRoutes } from "./server/routes/dcfRoutes.ts";
import { registerFileRoutes } from "./server/routes/fileRoutes.ts";
import { registerMarketRoutes } from "./server/routes/marketRoutes.ts";
import { registerSecRoutes } from "./server/routes/secRoutes.ts";
import { registerHealthRoutes } from "./server/routes/healthRoutes.ts";
import { registerMaterialNewsRoutes, handleMaterialEvents } from "./server/routes/materialNewsRoutes.ts";
export { handleMaterialEvents };

import { streamInteraction } from "./server/lib/agentClient.ts";
import { loadAgentFiles } from "./server/lib/agentFiles.ts";
import { createInteractionWithRetry } from "./server/lib/agentRetry.ts";
import {
  extractLastJsonObjectFromText,
  extractStructuredValuationAssumptions,
  hasUsableDcfAssumptions,
  mergeStructuredValuationAssumptions,
} from "./server/lib/valuationAssumptionBridge.ts";
import { LatencyTracker } from "./src/utils/latencyTracker.ts";
import { PRICING_CATALOG_METADATA } from "./src/utils/costEstimator.ts";

export async function createApp(options: { serveFrontend?: boolean } = {}) {
  const app = express();
  const requireFirebaseAuth = createRequireFirebaseAuth();
  const rateWindowMs = 15 * 60 * 1000;
  const analyzeRateLimit = createUserRateLimiter({ scope: 'analyze', limit: 8, windowMs: rateWindowMs });
  const analyzeConcurrencyLimit = createUserConcurrencyLimiter({ scope: 'analyze', maxConcurrent: 1 });
  const dcfAssumptionRateLimit = createUserRateLimiter({ scope: 'dcf-assumptions', limit: 16, windowMs: rateWindowMs });
  const metricRateLimit = createUserRateLimiter({ scope: 'analyze-metric', limit: 60, windowMs: rateWindowMs });
  const ttsRateLimit = createUserRateLimiter({ scope: 'tts', limit: 30, windowMs: rateWindowMs });

  app.use(express.json({ limit: '1mb' }));
  app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', error: 'Request payload is too large.' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ code: 'INVALID_JSON', error: 'Request body must contain valid JSON.' });
    }
    return next(error);
  });


  registerTtsRoutes(app, requireFirebaseAuth, ttsRateLimit);
  registerMetricRoutes(app, requireFirebaseAuth, metricRateLimit);
  registerDcfRoutes(app, requireFirebaseAuth, dcfAssumptionRateLimit);
  registerFileRoutes(app, requireFirebaseAuth);
  registerMarketRoutes(app);
  registerSecRoutes(app);
  registerHealthRoutes(app);
  registerMaterialNewsRoutes(app);

  app.post("/api/analyze", requireFirebaseAuth, analyzeRateLimit, analyzeConcurrencyLimit, async (req, res) => {
    try {
      const body = req.body || {};
      const ticker = normalizeTicker(body.ticker);
      const instruction = normalizeOptionalText(body.instruction, 4000);
      const model = normalizeGeminiModel(body.model);
      const language = normalizeAnalysisLanguage(body.language);
      const analysisType = normalizeAnalysisType(body.analysisType);
      const useSelfConsistency = normalizeBoolean(body.useSelfConsistency, false);
      if (!ticker || instruction === null || !model || !language || !analysisType || useSelfConsistency === null) {
        return res.status(400).json({
          code: 'INVALID_ANALYZE_REQUEST',
          error: 'Invalid ticker, model, language, analysis type, instruction, or self-consistency setting.',
        });
      }
      if (!process.env.GEMINI_API_KEY?.trim()) {
        return res.status(503).json({
          error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY กรุณาเพิ่มคีย์ในไฟล์ .env แล้วเริ่มเซิร์ฟเวอร์ใหม่",
          code: "GEMINI_API_KEY_MISSING"
        });
      }

      const latencyTracker = new LatencyTracker();
      console.log(`[analyze] Starting analysis for ${ticker} using model ${model || 'default'}, language ${language || 'English'}, type ${analysisType || 'fundamental'}`);
      
      // The runtime prompt below is the authoritative output contract. Do not inject
      // legacy agent configuration/instruction files into the managed-agent environment,
      // where they can compete with the current dynamic JSON schema.
      const legacyAgentRuntimeFiles = new Set([
        '/.agents/AGENTS.md',
        '/.agents/agent.yaml',
        '/.agents/requirements.txt',
      ]);
      const agentFiles = loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents")
        .filter((source) => !legacyAgentRuntimeFiles.has(source.target));
      
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
   - For Forward P/E: Retrieve the current standard NTM (Next Twelve Months / FY+1) consensus EPS from an identified, dated financial source. Do not mix it with a later fiscal-year estimate, and never use numerical examples from the prompt as market data.
   - For EV/EBITDA and PEG: Retrieve the current figures and their calculation basis from identified, dated market sources. If the provider does not publish a value, leave it unavailable.
3. 100% REAL DATA & ZERO HALLUCINATIONS: Every single metric, revenue number, margin percentage, cash flow, debt level, institutional holder name, and insider transaction MUST come from verified, authentic public records (SEC Form 10-K, 10-Q, 8-K, Form 4, 13F filings, and official investor relations).
4. EXHAUST ALL SEARCH EFFORTS (MULTI-QUERY DEEP SEARCH PROTOCOL): You MUST execute multiple thorough, targeted web searches to locate authentic figures for all required fields. Do NOT give up on a critical metric (such as balance sheet items, cash & short-term investments, debt, shares outstanding, free cash flow, institutional holders, valuation multiples) on a single failed search. You MUST attempt alternative targeted search angles (e.g., Query 1: SEC EDGAR Form 10-Q/10-K filing; Query 2: Investor Relations press release/earnings deck; Query 3: Financial portal data from Yahoo Finance / Macrotrends / StockAnalysis) before deciding that public disclosure is absent.
5. NO INVENTED NUMBERS: Only if exhaustive targeted search attempts across multiple sources yield no verified public disclosure, explicitly state "ไม่พบข้อมูล" (Data not available / No disclosure found) or null rather than fabricating or guessing plausible numbers.
6. PEER BENCHMARK & TARGET TICKER LIVE SEARCH MANDATE:
   - SELECT DIRECT, MODERN PURE-PLAY PEERS: Always select the most direct, relevant, and modern public peers in the same niche industry:
     * For Space & Orbital Launch (e.g., RKLB): You may compare with pure-play space companies such as ASTS, LUNR, RDW, and PL. Compare a private company such as SpaceX only when a dated, identified private-market source supports the comparison; never assume a private valuation.
     * For AI Infrastructure & Chips (e.g., NVDA): Compare with AMD, AVGO (Broadcom), TSM (TSMC), INTC.
     * For Enterprise AI & Data Platforms (e.g., PLTR): Compare with SNOW, MDB, DDOG, C3.ai (AI).
     * For Digital Banking & Fintech (e.g., SOFI): Compare with HOOD (Robinhood), UPST (Upstart), NU (Nu Holdings), AFRM (Affirm).
     * For EV & Clean Energy (e.g., TSLA): Compare with BYDDF (BYD), RIVN (Rivian), GM, LCID.
   - For ${ticker} AND all peer companies listed in "peer_comparison" (e.g., ASTS, RDW, PL, AMD, TSM, BYD, etc.), you MUST execute dedicated live web searches to retrieve their LIVE current stock price, Market Cap, and P/E ratios (Trailing and Forward) as of TODAY (${todayISO}).
   - Retrieve the current price, market capitalization, and valuation multiples independently for every selected peer from identified sources dated as of ${todayISO}. Never use a ticker-specific price or market-cap figure embedded in a prompt.
   - NEVER rely on static memory or outdated pre-training knowledge. All Market Caps, P/E multiples, and margins in "peer_comparison" MUST match live financial reality as of TODAY (${todayISO}).
   - STRICT GAAP ACCOUNTING IDENTITIES:
     * Gross Profit = Revenue - COGS
     * Operating Income = Gross Profit - Operating Expenses
     * Total Assets = Total Liabilities + Total Equity
     * Free Cash Flow = Operating Cash Flow - CapEx
   - CROSS-SECTION MARGIN & FINANCIAL STATEMENTS CONSISTENCY (อัตรากำไรในงบการเงินต้องตรงกับ Peer Comparison และ Five Pillars ทุกจุด ห้ามขัดแย้งกันเองเด็ดขาด):
     * The Gross Margin, Operating Margin, and Net Margin reported in the 4th (latest) quarter of "financial_statements" MUST match the target ticker metrics in "peer_comparison" and "five_pillars.profitability".
     * Retrieve every target-company statement figure directly from its identified filing for the exact fiscal period. Cross-check all derived margins against those retrieved figures; never treat ticker-specific numbers in a prompt as reference truth.
     * BANNED HISTORICAL EXTRAPOLATION: NEVER synthesize historical quarters using artificial trends or fixed linear steps from the latest quarter. Retrieve and independently verify each quarter from a dated filing or earnings release; leave an unverified quarter unavailable and flag the history as incomplete.
8. MANDATORY LATEST QUARTER SEC FILINGS IN FINDINGS & VALUATION CONSISTENCY (เอกสารและงบการเงินต้องเป็นไตรมาสล่าสุดเสมอเพื่อให้คำนวณตรงกัน):
   - PRIMARY CITATION MANDATE: The first document in "findings" (findings[0]) MUST ALWAYS be the latest SEC Form 10-Q (or latest Form 10-K if the company recently completed its fiscal year-end).
   - In "findings[0]", explicitly label "documentType" with the retrieved fiscal quarter or annual period, provide the exact filing date, and include key insights summarizing the latest balance sheet liquidity, total debt, diluted shares outstanding, and revenue performance.
   - 100% MATHEMATICAL ALIGNMENT (คำนวณตรงกัน): The balance sheet figures (Cash, Short-Term Investments, Total Debt, Diluted Shares Outstanding) from this latest quarter filing MUST directly align with:
     * The 4th (latest) quarter in "financial_statements"
     * Enterprise Value calculation (EV = Market Cap + Total Debt - Cash)
     * DCF Intrinsic Value starting balance sheet (Net Cash = Cash - Debt)
     * Diluted shares count used for Per Share metrics.
   - Do not cite an older filing as the primary finding when a newer quarterly or annual filing is available. Mixing stale filing inputs with current market data is prohibited.
9. EARNINGS HISTORY VERIFICATION (ประวัติผลประกอบการต้องตรวจสอบแยกทีละไตรมาส):
   - Attempt to retrieve the last four completed quarters for "earnings_analysis.past_earnings_history" in chronological order, aligned with "financial_statements.periods".
   - Independently verify each quarter's report date, consensus estimates, actual results, surprise percentages, and one-day reaction from identified dated sources. Never reconstruct or extrapolate a missing quarter from trends.
   - If any quarter cannot be verified, use null for its unavailable observations, flag the history as incomplete, and calculate streaks or averages only from verified observations.
10. COMPANY-SPECIFIC PRODUCT AND FORECAST GROUNDING:
    - Retrieve current product launches, operating status, management guidance, and scenario assumptions for ${ticker} from identified dated sources. Do not embed or reuse ticker-specific narrative facts from this prompt.
11. MANDATORY AUTHENTIC SEGMENT REVENUE BREAKDOWN (สัดส่วนรายได้ตามสายธุรกิจและภูมิภาคต้องดึงจาก 10-Q/10-K จริง ห้ามเดาหรือใช้สัดส่วนเก่า):
     - In "business_analysis.revenue_breakdown.by_business":
       * You MUST search and extract the authentic segment revenue breakdown from the latest Form 10-Q or 10-K "Product and Service Information" or Segment Footnote table for the latest reported quarter.
       * Use the issuer's exact segment names for the selected fiscal period. Retrieve each segment value from the same identified filing table; do not carry product figures across quarters.
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
       * Base Case ("scenarios.base" & "summary.base_case_fair_value"): Anchor it to a dated Wall Street mean/median consensus target or a mathematically consistent fundamental DCF baseline. Do not map a retrieved Street-High outlier into the Base Case.
       * Bull Case ("scenarios.bull" & "summary.fair_value_range_high"): This is the designated home for the Street-High Target (Optimistic / Blue Sky / Best Execution scenario).
       * Bear Case ("scenarios.bear" & "summary.fair_value_range_low"): This is the designated home for the Street-Low Target (Downside risk / Execution bottleneck scenario).
     - UNIVERSAL SECTOR COVERAGE: This rule applies unconditionally to all tickers and sectors — Tech, FinTech, Banking, Healthcare, Consumer, Energy, Utilities, Space, and CleanTech.
     - DCF ASSUMPTIONS ALIGNMENT: Base revenue CAGR ("revenue_cagr_pct") and terminal margins ("terminal_margin_pct") must be realistically aligned with consensus guidance, avoiding arbitrary extremes.
     - DCF OUTPUT CONTRACT (MANDATORY): For Fundamental and Combined analysis, "intrinsic_value.dcf_model" MUST always preserve the exact object shape shown in the JSON schema. "assumptions" MUST exist with "wacc_pct", "terminal_growth_pct", and "projection_years"; "scenarios" MUST exist with "bear", "base", and "bull", each containing "revenue_cagr_pct", "terminal_margin_pct", "fair_value_per_share", and "key_assumption_note".
     - DCF FACT/ASSUMPTION SEPARATION: WACC, terminal growth, projection years, revenue CAGR, and terminal FCF margin are valuation assumptions, not verified financial facts. You may propose them only when economically defensible from retrieved context and must explain them in "key_assumption_note". If you cannot form a defensible assumption, output null. NEVER insert ticker-specific defaults or plausible-looking fallback values. "fair_value_per_share" and the fair-value fields in "intrinsic_value.summary" may remain null because Lumina recomputes valuation deterministically after verified financial and market inputs are attached.`;

      finalInstruction += `\n13. JSON ARRAY ITEM CONTRACT:
   - Object entries shown inside schema arrays define the canonical field names only; they are not rows that must be emitted.
   - Never emit an empty placeholder row. If an item has no verified identifier and no verified observations, omit that item; use [] when the entire collection is unavailable.
   - Use null only for an unavailable field inside an otherwise verified, identifiable item.`;
      
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
    "conviction_score": null,
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
       "current_price": null,
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
      "trend_clarity": { "score": null, "reason": "..." },
      "momentum_strength": { "score": null, "reason": "..." },
      "risk_reward": { "score": null, "reason": "..." },
      "signal_confluence": { "score": null, "reason": "..." },
      "false_signal_risk": { "score": null, "reason": "..." },
      "overall_attractiveness": { "score": null, "reason": "..." }
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
      "impact_score": null
    }
  ],` : ''}
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": "...",
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [],
    "financial_performance_4q": []
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
          - ข้อมูล smart_money (13F): ใส่เฉพาะตัวเลขที่ตรวจสอบได้จากเอกสาร 13F/เอกสารบริษัทพร้อมวันที่อ้างอิงเท่านั้น total_shares_held ต้องสอดคล้องกับ shares_outstanding และ pct_owned ในงวดเดียวกัน ห้ามสร้างรายชื่อผู้ถือหุ้น จำนวนสถาบัน จำนวนหุ้น หรือกิจกรรมซื้อขายขึ้นมาเอง หากตรวจสอบไม่ได้ให้ใช้ null หรือ []
          - อธิบายศัพท์ยากเป็นภาษาง่าย ตอบแบบภาษาคนลงทุน`;
        } else {
          finalInstruction += `\n\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.
          - For smart_money (13F): include only figures verified from dated 13F/company filings. total_shares_held must reconcile with shares_outstanding and pct_owned from the same period. Never invent holders, filer counts, share counts, or activity rows; use null or [] when the source data is unavailable.
          - Technical Analysis MUST rely ONLY on price, volume, and technical indicators. NEVER include or reference fundamental data (e.g., 10-K, 10-Q, annual reports, business models, moats, or credit risks) in the technical analysis section.`;
        }
        
        dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": null,
    "key_takeaways": ["...", "..."]
  },
  "financial_statements": {
    "currency": "USD",
    "fiscal_period_type": "quarterly",
    "as_of_date": null,
    "source": { "document_url": null, "document_type": null, "filing_date": null, "period_end": null, "units": "USD millions" },
    "periods": [],
    "income_statement": {
      "revenue": [],
      "cogs": [],
      "gross_profit": [],
      "gross_margin_pct": [],
      "operating_expenses": [],
      "operating_income": [],
      "operating_margin_pct": [],
      "income_before_tax": [],
      "income_tax_expense": [],
      "net_income": [],
      "net_margin_pct": [],
      "eps_diluted": [],
      "yoy_revenue_growth_pct": [],
      "net_interest_income": [],
      "non_interest_income": [],
      "provision_for_credit_losses": [],
      "commentary": "..."
    },
    "balance_sheet": {
      "cash_and_equivalents": [],
      "short_term_investments": [],
      "total_current_assets": [],
      "accounts_receivable": [],
      "inventory": [],
      "net_ppe": [],
      "goodwill": [],
      "total_assets": [],
      "total_current_liabilities": [],
      "accounts_payable": [],
      "short_term_debt": [],
      "long_term_debt": [],
      "total_debt": [],
      "operating_lease_liabilities": [],
      "total_liabilities": [],
      "deposits": [],
      "loans_held_for_investment": [],
      "total_equity": [],
      "common_stock": [],
      "retained_earnings": [],
      "aoci": [],
      "current_ratio": [],
      "quick_ratio": [],
      "debt_to_equity": [],
      "debt_to_ebitda": [],
      "commentary": "..."
    },
    "cash_flow": {
      "operating_cash_flow": [],
      "depreciation": [],
      "stock_based_compensation": [],
      "change_working_capital": [],
      "capex": [],
      "investing_cash_flow": [],
      "free_cash_flow": [],
      "fcf_margin_pct": [],
      "fcf_vs_net_income_ratio": [],
      "financing_cash_flow": [],
      "stock_issuance_repurchase": [],
      "dividends_paid": [],
      "ending_cash": [],
      "net_change_cash": [],
      "commentary": "..."
    },
    "red_flags": ["..."]
  },
  "valuation_ratios": [
    {
      "name": "P/E (Trailing)",
      "formula": "ราคาหุ้นปัจจุบัน / EPS ย้อนหลัง 12 เดือน",
      "value": null,
      "unit": "x",
      "peer_avg": null,
      "own_5yr_percentile": null,
      "interpretation": "...",
      "verdict": "expensive"
    },
    {
      "name": "PEG Ratio",
      "formula": "P/E ÷ อัตราการเติบโตกำไรคาดการณ์ (%)",
      "value": null,
      "unit": "x",
      "peer_avg": null,
      "own_5yr_percentile": null,
      "interpretation": "...",
      "verdict": "fair"
    },
    { "name": "EV/EBITDA", "formula": "Enterprise Value / EBITDA (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "EV/Sales", "formula": "Enterprise Value / Revenue (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "P/FCF", "formula": "Market Cap / Free Cash Flow (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "P/B", "formula": "ราคาหุ้น / มูลค่าทางบัญชีต่อหุ้น", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null }
  ],
  "valuation_percentile_chart": {
    "description": "ตำแหน่ง P/E ปัจจุบันเทียบกับช่วง 5 ปี",
    "min_5yr": null,
    "max_5yr": null,
    "current": null,
    "median_5yr": null
  },
  "intrinsic_value": {
    "current_price": null,
    "as_of_date": null,
    "dcf_model": {
      "assumptions": {
        "wacc_pct": null,
        "terminal_growth_pct": null,
        "projection_years": null
      },
      "scenarios": {
        "bear": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "base": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "bull": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        }
      }
    },
    "summary": {
      "fair_value_range_low": null,
      "fair_value_range_high": null,
      "base_case_fair_value": null,
      "margin_of_safety_pct": null,
      "verdict_text": "..."
    }
  },
  "earnings_analysis": {
    "as_of_date": null,
    "next_earnings_date": null,
    "next_earnings_date_confirmed": false,
    "days_until_next_earnings": null,
    "past_earnings_history": [],
    "beat_streak": {
      "eps_beat_streak_quarters": null,
      "revenue_beat_streak_quarters": null,
      "commentary": "..."
    },
    "average_earnings_day_move_pct": null,
    "current_quarter_setup": {
      "period": null,
      "company_guidance_revenue_musd": [],
      "consensus_estimate_revenue_musd": null,
      "consensus_estimate_eps": null,
      "whisper_vs_consensus": "...",
      "key_things_to_watch": ["...", "..."]
    },
    "estimate_revisions_trend": {
      "description": "ทิศทางการปรับประมาณการของนักวิเคราะห์ในช่วง 90 วันที่ผ่านมา",
      "eps_estimate_90d_ago": null,
      "eps_estimate_current": null,
      "direction": "upward",
      "num_analysts_raised": null,
      "num_analysts_lowered": null,
      "commentary": "..."
    },
    "full_year_guidance": {
      "fiscal_year": null,
      "company_guidance_revenue_musd": [],
      "implied_growth_pct": null,
      "consensus_vs_guidance": "..."
    },
    "analyst_consensus": {
      "consensus_rating": "Moderate Buy",
      "total_analysts": null,
      "ratings_breakdown": {
        "buy_count": null,
        "hold_count": null,
        "sell_count": null
      },
      "price_target": {
        "mean": null,
        "high": null,
        "low": null,
        "median": null,
        "implied_upside_pct": null
      },
      "as_of_date": null,
      "commentary": "..."
    },
    "summary_verdict": "..."
  },
  "morningstar_research": {
    "has_coverage": false,
    "status_note": "Data unavailable unless verified from a dated Morningstar source",
    "analyst_name": null,
    "analyst_title": null,
    "rating_stars": null,
    "rating_date": null,
    "economic_moat": null,
    "economic_moat_th": null,
    "uncertainty": null,
    "capital_allocation": null,
    "capital_allocation_th": null,
    "fair_value_estimate": null,
    "fair_value_date": null,
    "discount_premium_pct": null,
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
      "implied_pe": null,
      "implied_ev_revenue": null,
      "implied_fcf_yield_pct": null,
      "projected_revenue_cagr_5yr": null,
      "projected_gross_margin_terminal": null,
      "projected_operating_margin_terminal": null,
      "content_paragraphs": ["...", "..."]
    }
  },
  "peer_comparison": {
    "as_of_date": null,
    "industry_name": "Sector / Industry",
    "peers": [
      {
        "ticker": "...",
        "company_name": "...",
        "market_cap": null,
        "pe_trailing": null,
        "pe_forward": null,
        "revenue_growth_yoy_pct": null,
        "gross_margin_pct": null,
        "net_margin_pct": null,
        "ev_ebitda": null
      }
    ],
    "key_takeaway": "..."
  },
  "catalysts_and_events": {
    "as_of_date": null,
    "items": [
      {
        "title": "...",
        "date": null,
        "expected_impact": "high",
        "description": "...",
        "category": "earnings"
      }
    ]
  },
  "insider_activity": {
    "as_of_date": null,
    "insider_ownership_pct": null,
    "institutional_ownership_pct": null,
    "institutional_qoq_change_pct": null,
    "recent_transactions": [],
    "commentary": null
  },
  "smart_money": {
    "as_of_date": "...",
    "institution_overview": null,
    "holder_type_breakdown": [
      {
        "type": null,
        "pct": null
      }
    ],
    "major_holders": [
      {
        "name": null,
        "shares_held": null,
        "pct_owned": null,
        "change_shares": null,
        "change_pct": null,
        "holder_type": null,
        "filing_date": null,
        "disclosure": null
      }
    ],
    "shareholder_activity": [],
    "insiders_overview": null,
    "recent_transactions": [],
    "commentary": "Omit unavailable figures; never populate this section from examples or estimates."
  },
  "corporate_actions": {
    "as_of_date": null,
    "dividends": {
      "summary": {
        "has_dividend": false,
        "dividend_yield_pct": null,
        "annual_payout_usd": null,
        "payout_ratio_pct": null,
        "frequency": null,
        "policy_note": "..."
      },
      "history": [
        {
          "announced_date": null,
          "allocation_plan": null,
          "amount_usd": null,
          "record_date": null,
          "ex_date": null,
          "pay_date": null
        }
      ]
    },
    "stock_splits": [
      {
        "effective_date": null,
        "split_type": null,
        "ratio": null
      }
    ],
    "buybacks": {
      "authorized_amount_musd": null,
      "remaining_amount_musd": null,
      "shares_repurchased_last_12m": null,
      "net_share_reduction_pct": null,
      "commentary": "..."
    }
  },
  "company_profile": {
    "as_of_date": null,
    "overview": {
      "company_name": "...",
      "symbol": "...",
      "listing_date": null,
      "issue_price": null,
      "isin": null,
      "founded_year": null,
      "ceo": null,
      "exchange": null,
      "employees_count": null,
      "fiscal_year_end": null,
      "address": null,
      "city": null,
      "province_state": null,
      "country": null,
      "zip_code": null,
      "phone": null,
      "website_url": null,
      "description": "..."
    },
    "executives": [
      {
        "name": null,
        "title": null,
        "salary_usd": null,
        "age": null,
        "gender": null,
        "bio": "...",
        "updated_date": null
      }
    ]
  },
  "business_analysis": {
    "as_of_date": null,
    "revenue_breakdown": {
      "period": null,
      "by_business": [
        {
          "name": null,
          "revenue_usd": null,
          "ratio_pct": null,
          "growth_yoy_pct": null
        }
      ],
      "by_region": [
        {
          "name": null,
          "revenue_usd": null,
          "ratio_pct": null,
          "growth_yoy_pct": null
        }
      ]
    },
    "operational_efficiency": [
      {
        "period": null,
        "headcount": null,
        "headcount_yoy_pct": null,
        "revenue_per_employee_k_usd": null,
        "revenue_per_employee_yoy_pct": null,
        "operating_profit_per_employee_k_usd": null,
        "operating_profit_per_employee_yoy_pct": null,
        "net_income_per_employee_k_usd": null,
        "net_income_per_employee_yoy_pct": null
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
      "understandability": { "score": null, "reason": "..." },
      "revenue_quality": { "score": null, "reason": "..." },
      "financial_strength": { "score": null, "reason": "..." },
      "growth_potential": { "score": null, "reason": "..." },
      "risk_level": { "score": null, "reason": "..." },
      "overall_attractiveness": { "score": null, "reason": "..." }
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
      "trend_clarity": { "score": null, "reason": "..." },
      "momentum_strength": { "score": null, "reason": "..." },
      "risk_reward": { "score": null, "reason": "..." },
      "signal_confluence": { "score": null, "reason": "..." },
      "false_signal_risk": { "score": null, "reason": "..." },
      "overall_attractiveness": { "score": null, "reason": "..." }
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
      "impact_score": null
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": null,
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [
      { "date": null, "price": null }
    ],
    "financial_performance_4q": []
  }
}`;
      } else {
        finalInstruction += `\n\nCRITICAL SEARCH FOR 3 FINANCIAL STATEMENTS (INCOME, BALANCE SHEET, CASH FLOW):
1. For ${ticker}, you MUST search and locate the official SEC Form 10-Q and 10-K "CONSOLIDATED BALANCE SHEETS" and "CONSOLIDATED STATEMENTS OF CASH FLOWS" tables for all 4 reporting periods.
2. In "financial_statements.balance_sheet" and "financial_statements.income_statement":
   - "total_assets", "total_current_assets", "cash_and_equivalents", "short_term_investments", "accounts_receivable", "receivables", and "inventory" must contain exact values independently retrieved for each fiscal period from identified dated filings.
   - Never shift a value from another period, reconstruct a missing balance-sheet observation, or use numerical examples from a prompt as reference data. An unverified observation must remain null/unavailable.
   - "total_liabilities", "total_current_liabilities", "accounts_payable", "short_term_debt", "total_debt", "total_equity".
   - For banks/fintech (e.g. SOFI): extract "net_interest_income", "non_interest_income", "provision_for_credit_losses", "deposits", and "loans_held_for_investment".
   - For acquisitive or profitable corporations (e.g. MSFT, AAPL, NVDA): extract "goodwill", "common_stock", and "retained_earnings" if disclosed in filing tables.
3. In "financial_statements.cash_flow":
   - "operating_cash_flow": exact net cash provided by operating activities for each quarter.
   - "capex": capital expenditures (payments for property, plant and equipment).
   - "free_cash_flow": exact OCF minus CapEx for each quarter.
   - "investing_cash_flow", "financing_cash_flow", "stock_issuance_repurchase", "dividends_paid", "stock_based_compensation".
4. Ensure accounting identity consistency: Total Assets = Total Liabilities + Total Equity, Total Current Assets >= Cash + Receivables + Inventory, and Free Cash Flow = Operating Cash Flow - CapEx.
5. In "business_analysis.revenue_breakdown":
   - You MUST extract authentic segment revenues from the official SEC Form 10-Q/10-K "Product and Service Information" or Segment Footnote table for the latest completed quarter.
   - Use the issuer's segment names and exact values from the same retrieved filing period. Never import ticker-specific segment values from this prompt.
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
          - Never use vague adjectives without retrieved evidence. Back every claim with exact figures and fiscal periods from identified dated sources; do not copy numerical examples from the prompt.`;
        }
        
        dynamicSchema = `{
  "verdict": {
    "summary": "...",
    "conviction_score": null,
    "key_takeaways": ["...", "..."]
  },
  "financial_statements": {
    "currency": "USD",
    "fiscal_period_type": "quarterly",
    "as_of_date": null,
    "source": { "document_url": null, "document_type": null, "filing_date": null, "period_end": null, "units": "USD millions" },
    "periods": [],
    "income_statement": {
      "revenue": [],
      "cogs": [],
      "gross_profit": [],
      "gross_margin_pct": [],
      "operating_expenses": [],
      "operating_income": [],
      "operating_margin_pct": [],
      "income_before_tax": [],
      "income_tax_expense": [],
      "net_income": [],
      "net_margin_pct": [],
      "eps_diluted": [],
      "yoy_revenue_growth_pct": [],
      "net_interest_income": [],
      "non_interest_income": [],
      "provision_for_credit_losses": [],
      "commentary": "..."
    },
    "balance_sheet": {
      "cash_and_equivalents": [],
      "short_term_investments": [],
      "total_current_assets": [],
      "accounts_receivable": [],
      "inventory": [],
      "net_ppe": [],
      "goodwill": [],
      "total_assets": [],
      "total_current_liabilities": [],
      "accounts_payable": [],
      "short_term_debt": [],
      "long_term_debt": [],
      "total_debt": [],
      "operating_lease_liabilities": [],
      "total_liabilities": [],
      "deposits": [],
      "loans_held_for_investment": [],
      "total_equity": [],
      "common_stock": [],
      "retained_earnings": [],
      "aoci": [],
      "current_ratio": [],
      "quick_ratio": [],
      "debt_to_equity": [],
      "debt_to_ebitda": [],
      "commentary": "..."
    },
    "cash_flow": {
      "operating_cash_flow": [],
      "depreciation": [],
      "stock_based_compensation": [],
      "change_working_capital": [],
      "capex": [],
      "investing_cash_flow": [],
      "free_cash_flow": [],
      "fcf_margin_pct": [],
      "fcf_vs_net_income_ratio": [],
      "financing_cash_flow": [],
      "stock_issuance_repurchase": [],
      "dividends_paid": [],
      "ending_cash": [],
      "net_change_cash": [],
      "commentary": "..."
    },
    "red_flags": ["..."]
  },
  "valuation_ratios": [
    {
      "name": "P/E (Trailing)",
      "formula": "ราคาหุ้นปัจจุบัน / EPS ย้อนหลัง 12 เดือน",
      "value": null,
      "unit": "x",
      "peer_avg": null,
      "own_5yr_percentile": null,
      "interpretation": "...",
      "verdict": "expensive"
    },
    {
      "name": "PEG Ratio",
      "formula": "P/E ÷ อัตราการเติบโตกำไรคาดการณ์ (%)",
      "value": null,
      "unit": "x",
      "peer_avg": null,
      "own_5yr_percentile": null,
      "interpretation": "...",
      "verdict": "fair"
    },
    { "name": "EV/EBITDA", "formula": "Enterprise Value / EBITDA (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "EV/Sales", "formula": "Enterprise Value / Revenue (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "P/FCF", "formula": "Market Cap / Free Cash Flow (TTM)", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null },
    { "name": "P/B", "formula": "ราคาหุ้น / มูลค่าทางบัญชีต่อหุ้น", "value": null, "unit": "x", "peer_avg": null, "own_5yr_percentile": null, "interpretation": "...", "verdict": null }
  ],
  "valuation_percentile_chart": {
    "description": "ตำแหน่ง P/E ปัจจุบันเทียบกับช่วง 5 ปี",
    "min_5yr": null,
    "max_5yr": null,
    "current": null,
    "median_5yr": null
  },
  "intrinsic_value": {
    "current_price": null,
    "as_of_date": null,
    "dcf_model": {
      "assumptions": {
        "wacc_pct": null,
        "terminal_growth_pct": null,
        "projection_years": null
      },
      "scenarios": {
        "bear": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "base": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        },
        "bull": {
          "revenue_cagr_pct": null,
          "terminal_margin_pct": null,
          "fair_value_per_share": null,
          "key_assumption_note": "..."
        }
      }
    },
    "summary": {
      "fair_value_range_low": null,
      "fair_value_range_high": null,
      "base_case_fair_value": null,
      "margin_of_safety_pct": null,
      "verdict_text": "..."
    }
  },
  "earnings_analysis": {
    "as_of_date": null,
    "next_earnings_date": null,
    "next_earnings_date_confirmed": false,
    "days_until_next_earnings": null,
    "past_earnings_history": [],
    "beat_streak": {
      "eps_beat_streak_quarters": null,
      "revenue_beat_streak_quarters": null,
      "commentary": "..."
    },
    "average_earnings_day_move_pct": null,
    "current_quarter_setup": {
      "period": null,
      "company_guidance_revenue_musd": [],
      "consensus_estimate_revenue_musd": null,
      "consensus_estimate_eps": null,
      "whisper_vs_consensus": "...",
      "key_things_to_watch": ["...", "..."]
    },
    "estimate_revisions_trend": {
      "description": "ทิศทางการปรับประมาณการของนักวิเคราะห์ในช่วง 90 วันที่ผ่านมา",
      "eps_estimate_90d_ago": null,
      "eps_estimate_current": null,
      "direction": "upward",
      "num_analysts_raised": null,
      "num_analysts_lowered": null,
      "commentary": "..."
    },
    "full_year_guidance": {
      "fiscal_year": null,
      "company_guidance_revenue_musd": [],
      "implied_growth_pct": null,
      "consensus_vs_guidance": "..."
    },
    "analyst_consensus": {
      "consensus_rating": "Moderate Buy",
      "total_analysts": null,
      "ratings_breakdown": {
        "buy_count": null,
        "hold_count": null,
        "sell_count": null
      },
      "price_target": {
        "mean": null,
        "high": null,
        "low": null,
        "median": null,
        "implied_upside_pct": null
      },
      "as_of_date": null,
      "commentary": "..."
    },
    "summary_verdict": "..."
  },
  "morningstar_research": {
    "has_coverage": false,
    "status_note": "Data unavailable unless verified from a dated Morningstar source",
    "analyst_name": null,
    "analyst_title": null,
    "rating_stars": null,
    "rating_date": null,
    "economic_moat": null,
    "economic_moat_th": null,
    "uncertainty": null,
    "capital_allocation": null,
    "capital_allocation_th": null,
    "fair_value_estimate": null,
    "fair_value_date": null,
    "discount_premium_pct": null,
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
      "implied_pe": null,
      "implied_ev_revenue": null,
      "implied_fcf_yield_pct": null,
      "projected_revenue_cagr_5yr": null,
      "projected_gross_margin_terminal": null,
      "projected_operating_margin_terminal": null,
      "content_paragraphs": ["...", "..."]
    }
  },
  "peer_comparison": {
    "as_of_date": null,
    "industry_name": "Sector / Industry",
    "peers": [
      {
        "ticker": "...",
        "company_name": "...",
        "market_cap": null,
        "pe_trailing": null,
        "pe_forward": null,
        "revenue_growth_yoy_pct": null,
        "gross_margin_pct": null,
        "net_margin_pct": null,
        "ev_ebitda": null
      }
    ],
    "key_takeaway": "..."
  },
  "catalysts_and_events": {
    "as_of_date": null,
    "items": [
      {
        "title": "...",
        "date": null,
        "expected_impact": "high",
        "description": "...",
        "category": "earnings"
      }
    ]
  },
  "insider_activity": {
    "as_of_date": null,
    "insider_ownership_pct": null,
    "institutional_ownership_pct": null,
    "institutional_qoq_change_pct": null,
    "recent_transactions": [],
    "commentary": null
  },
  "smart_money": {
    "as_of_date": "...",
    "institution_overview": null,
    "holder_type_breakdown": [
      {
        "type": null,
        "pct": null
      }
    ],
    "major_holders": [
      {
        "name": null,
        "shares_held": null,
        "pct_owned": null,
        "change_shares": null,
        "change_pct": null,
        "holder_type": null,
        "filing_date": null,
        "disclosure": null
      }
    ],
    "shareholder_activity": [],
    "insiders_overview": null,
    "recent_transactions": [],
    "commentary": "Omit unavailable figures; never populate this section from examples or estimates."
  },
  "corporate_actions": {
    "as_of_date": null,
    "dividends": {
      "summary": {
        "has_dividend": false,
        "dividend_yield_pct": null,
        "annual_payout_usd": null,
        "payout_ratio_pct": null,
        "frequency": null,
        "policy_note": "..."
      },
      "history": [
        {
          "announced_date": null,
          "allocation_plan": null,
          "amount_usd": null,
          "record_date": null,
          "ex_date": null,
          "pay_date": null
        }
      ]
    },
    "stock_splits": [
      {
        "effective_date": null,
        "split_type": null,
        "ratio": null
      }
    ],
    "buybacks": {
      "authorized_amount_musd": null,
      "remaining_amount_musd": null,
      "shares_repurchased_last_12m": null,
      "net_share_reduction_pct": null,
      "commentary": "..."
    }
  },
  "company_profile": {
    "as_of_date": null,
    "overview": {
      "company_name": "...",
      "symbol": "...",
      "listing_date": null,
      "issue_price": null,
      "isin": null,
      "founded_year": null,
      "ceo": null,
      "exchange": null,
      "employees_count": null,
      "fiscal_year_end": null,
      "address": null,
      "city": null,
      "province_state": null,
      "country": null,
      "zip_code": null,
      "phone": null,
      "website_url": null,
      "description": "..."
    },
    "executives": [
      {
        "name": null,
        "title": null,
        "salary_usd": null,
        "age": null,
        "gender": null,
        "bio": "...",
        "updated_date": null
      }
    ]
  },
  "business_analysis": {
    "as_of_date": null,
    "revenue_breakdown": {
      "period": null,
      "by_business": [
        {
          "name": null,
          "revenue_usd": null,
          "ratio_pct": null,
          "growth_yoy_pct": null
        }
      ],
      "by_region": [
        {
          "name": null,
          "revenue_usd": null,
          "ratio_pct": null,
          "growth_yoy_pct": null
        }
      ]
    },
    "operational_efficiency": [
      {
        "period": null,
        "headcount": null,
        "headcount_yoy_pct": null,
        "revenue_per_employee_k_usd": null,
        "revenue_per_employee_yoy_pct": null,
        "operating_profit_per_employee_k_usd": null,
        "operating_profit_per_employee_yoy_pct": null,
        "net_income_per_employee_k_usd": null,
        "net_income_per_employee_yoy_pct": null
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
      "understandability": { "score": null, "reason": "..." },
      "revenue_quality": { "score": null, "reason": "..." },
      "financial_strength": { "score": null, "reason": "..." },
      "growth_potential": { "score": null, "reason": "..." },
      "risk_level": { "score": null, "reason": "..." },
      "overall_attractiveness": { "score": null, "reason": "..." }
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
      "impact_score": null
    }
  ],
  "findings": [
    {
      "documentType": "Form 10-Q (Latest Completed Quarter)",
      "keyInsights": ["...", "..."],
      "date": null,
      "sourceUrl": "..."
    }
  ],
  "financial_charts": {
    "stock_price_history": [],
    "financial_performance_4q": []
  }
}`;
      }
      
      let liveMarketPromptSection = "";
      const stopMarketSnapshot = latencyTracker.startStage('market_snapshot');
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
          liveMarketPromptSection = `\n\nLIVE MARKET MULTIPLES & VALUATION MEASURES RETRIEVED FROM YAHOO FINANCE AS OF ${todayISO}:\n${lines.join('\n')}\nUse only these retrieved values in 'company_profile', 'valuation_ratios', and 'peer_comparison'. Preserve unavailable values as N/A and do not replace them with prompt examples or memory. For banks and similar financial institutions, keep EV/EBITDA unavailable when the source does not report a meaningful value.`;
        }
      } catch (e) {
        console.warn("Could not pre-fetch live quotes:", e);
      } finally {
        stopMarketSnapshot();
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
      const runLogsDir = process.env.VERCEL === '1' ? path.join('/tmp', 'run_logs') : path.join(process.cwd(), 'run_logs');
      if (!fs.existsSync(runLogsDir)) {
          fs.mkdirSync(runLogsDir, { recursive: true });
      }
      const runId = Date.now();
      const jsonlLogPath = path.join(runLogsDir, `run_log_${ticker}_${runId}.jsonl`);
      
      let debugLog = `--- Analysis Run for ${ticker} at ${new Date().toISOString()} ---`;
      const toolExecutions: any = {};
      let totalTokens = 0;

      const appendCanonicalValuationIfNeeded = async (researchText: string) => {
        if (analysisType === 'technical' || !researchText.trim()) return;
        const parsedReport = extractLastJsonObjectFromText(researchText);
        if (!parsedReport || hasUsableDcfAssumptions(parsedReport)) return;

        res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Normalizing valuation assumptions into Lumina DCF contract...' })}\n\n`);
        const assumptions = await extractStructuredValuationAssumptions(researchText, actualModel);
        if (!assumptions || assumptions.wacc_pct === null || assumptions.terminal_growth_pct === null || assumptions.projection_years === null
          || [assumptions.scenarios.bear, assumptions.scenarios.base, assumptions.scenarios.bull].some(
            scenario => scenario.revenue_cagr_pct === null || scenario.terminal_margin_pct === null,
          )) {
          console.warn('[valuation-assumptions] Complete structured DCF assumptions unavailable; valuation remains fail-closed.');
          return;
        }

        const canonicalReport = mergeStructuredValuationAssumptions(parsedReport, assumptions);
        const canonicalText = '\n\n```json\n' + JSON.stringify(canonicalReport) + '\n```\n';
        res.write(`data: ${JSON.stringify({ type: 'text', text: canonicalText })}\n\n`);
        console.log('[valuation-assumptions] Appended canonical DCF assumption contract; fair values remain deterministic-only.');
      };

      const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      }, 15000);

      if (useSelfConsistency && (analysisType === 'technical' || analysisType === 'combined')) {
          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Initiating 10/10 Validation Protocol...' })}\n\n`);

          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Running Primary Analyst Agent...' })}\n\n`);

          const resAgent = await createInteractionWithRetry(res, { prompt, inlineSources: agentFiles, tools: [{ type: "google_search" }], model: actualModel });
          if (!resAgent.ok) {
              clearInterval(heartbeat);
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

          res.write(`data: ${JSON.stringify({ type: 'thinking', text: 'Primary Analysis complete. Running Lead Validator Agent to verify calculations and actively retrieve any missing data...' })}\n\n`);

          const validatePrompt = `You are the Lead Validator & Senior Data Auditor. You have received an analysis report for ${ticker}.
TODAY'S EXACT DATE IS: ${todayISO} (Year ${currentYear}).
Your job is to cross-check it, verify that all numbers are authentic real-time data as of today (${todayISO}) with zero hallucinations, actively search for and fill in any missing data gaps, fix any mathematical inconsistencies, and produce the final perfect JSON report.

CRITICAL INSTRUCTION: You are encouraged to verify the calculations and logic step-by-step. Keep your internal thinking concise (under 150 words). DO NOT repeat or summarize the original report in your internal thoughts. Once numbers are checked and missing data retrieved, immediately output the final JSON report wrapped in \`\`\`json ... \`\`\` without delay.

CRITICAL CHECKS & DATA COMPLETION MANDATE:
- Active Gap-Filling & Data Completion: Carefully inspect the Primary Analyst Output above. If any required section, ratio, balance sheet item, shares count, cash/debt figure, institutional holding, or peer valuation multiple was left as null, "ไม่พบข้อมูล", or omitted, you are explicitly directed and authorized to execute targeted Google Search queries right now to find the missing authentic numbers. Fill in those missing values before synthesizing the final JSON report. Keep strict zero-hallucination standards: only fill in numbers if verified from live search. If a metric truly has no public disclosure or does not apply to this company's business model (e.g. bank FCFF or non-dividend stock), keep it null.
- Real-Time Grounding: Ensure all stock prices, valuation ratios, market caps, and dates are grounded in live reality as of ${todayISO}. If a data point was truly unavailable and marked as "ไม่พบข้อมูล" (Data not available), keep it factual and DO NOT fabricate fake numbers.
- Natural Thai Language Check: If outputting in Thai, verify that phrasing sounds like a real human investor/analyst. Eliminate robotic AI filler phrases (e.g. replace "สะท้อนให้เห็นถึง", "ในภูมิทัศน์ที่มีพลวัต", "คูเมืองทางเศรษฐกิจ", "การเจือจางของหุ้น" with natural phrasing like "แสดงให้เห็นว่า", "สภาพแวดล้อมทางธุรกิจ", "ความได้เปรียบในการแข่งขัน (Moat)", "Dilution จากหุ้นเพิ่มทุน/SBC"). Ensure tone is professional, direct, and easy to read.
- Technical Trade Plan: Ensure Risk/Reward ratio for BOTH Target 1 and Target 2 is mathematically correct. CRITICAL: You MUST format the R:R ratios cleanly as a 3-column Markdown table or distinct bullet points (Target | Formula | Result) so it is easy to read. Do NOT cram the R:R calculation into a single long string.
- Technical Key Levels: Ensure ALL Support/Resistance levels (S1, S2, S3, R1, R2, R3) are at least 1.5x ATR away from the current price AND spaced at least 1.5x ATR away from EACH OTHER (e.g., S1-S2 >= 1.5x ATR).
- Technical Completeness: You MUST verify that BOTH 'Divergence' (under momentum indicators) and 'Candlestick Pattern' (under chart patterns or momentum indicators) are explicitly analyzed and present in the final output. Even if they do not exist, they MUST be explicitly stated as "No Divergence observed" and "No clear Candlestick pattern observed". If they are missing, you MUST deduce them from the data and include them.
- Formatting Checks: Make sure 'business_overview', 'target_customers', 'revenue_model', and 'financial_overview' are formatted as Markdown bullet points (-), NOT large paragraphs. Make sure the R:R calculation in 'trade_plan' is nicely formatted as a Markdown table (Target | Formula | Result) using proper \n newlines.
- Fundamental Fundamentals Check: Must have exactly 8 numbered points.
- Fundamental Key Risks: Must have exactly 8 risk categories.
- Financial Statements & Latest Quarter Grounding: Attempt to retrieve four completed fiscal quarters, including the latest public Form 10-Q or Form 10-K available as of ${todayISO}. Every period must reflect its own identified filing. Never shift a value between periods or reconstruct a missing period. If a period cannot be verified, leave its observations null and flag the history as incomplete. Ensure all available revenue, net income, margins, growth, balance-sheet, and cash-flow figures are mathematically consistent.
- Latest Quarter SEC Filings & Findings Check (คำนวณตรงกัน): Verify that the FIRST and primary document in "findings" (findings[0]) is the company's latest available Form 10-Q or Form 10-K for the most recent completed period. Ensure its URL, filing date, period end, and key figures agree with the report. Replace an older citation only after retrieving and verifying the newer filing; otherwise flag the source as unavailable.
- Peer Comparison Grounding: Independently retrieve and verify current prices, market capitalizations, and valuation multiples for ${ticker} and every company in "peer_comparison" from identified sources dated as of ${todayISO}. Never use numerical examples from this prompt as market data, and leave unavailable values null.
- Valuation & Intrinsic Value: Ensure DCF Bear/Base/Bull scenarios have distinct reasonable spreads, margin of safety % is calculated correctly as (fair_value_base - current_price) / current_price * 100, and valuation ratios have valid verdict enums ('very_cheap' | 'cheap' | 'fair' | 'expensive' | 'very_expensive').
- DCF input integrity: All financial-statement money values are USD millions. Attempt to retrieve four completed quarterly periods in chronological order, the latest diluted shares outstanding in company_profile.shares_outstanding, and cash, short-term investments, total debt, revenue, and free cash flow for matching periods. In intrinsic_value.dcf_model, terminal_margin_pct means terminal free-cash-flow margin, not operating margin. Never fill a missing input with a ticker-specific default, a market-cap-derived share count, or a price-derived revenue estimate. If a primary source cannot supply an input, leave it unavailable and do not produce a fair value.
  * Small-Cap & Distressed Stock Guardrail: If ${ticker} is an unprofitable or micro/small-cap company with negative gross margins or cash burn (e.g. EOSE, RIVN, PLUG, QS):
    - WACC MUST reflect size and distress premiums (16%–22%+), NEVER use a single-digit mega-cap WACC (7%–10%).
    - Base Case terminal margin MUST NOT be unrealistically high (e.g. 12%–16%) when current gross margin is negative; it must reflect conservative turnaround execution (3%–6%) with dilution risk factored in.
    - Check Wall Street consensus targets and Relative Valuation (EV/Sales): DCF Base Case must NOT disconnect wildly (e.g. > 2x consensus or > 2.5x Relative Valuation).
- Earnings Analysis: Verify beat streak counters match the historical quarter results, and earnings surprise % is mathematically sound.
- Earnings Analysis History Check: Attempt to retrieve the last four completed quarters matching "financial_statements.periods" in chronological order. Independently verify every missing quarter from identified dated filings, earnings releases, and consensus sources. Never extrapolate or reconstruct a quarter from trends. If a quarter cannot be verified, leave its observations null/unavailable, flag the history as incomplete, and calculate streaks and averages only from verified quarters.
- Insider Ownership: Use a numeric percentage only when an identified dated source supplies it; otherwise leave it null/unavailable.
- Morningstar Equity Research Check: include Morningstar fields only when an accessible dated Morningstar source verifies the exact ticker, analyst, rating, fair value, and research text. Company size or ticker identity is never evidence of coverage. If any coverage claim cannot be verified, set has_coverage = false and leave rating, analyst, fair value, moat, uncertainty, allocation, and thesis fields absent.

Primary Analyst Output:
${fullText}

Check the facts, actively fill any missing metrics with search, and re-calculate the Risk/Reward ratios and DCF values yourself to be 100% sure they are correct.
You MUST output the final synthesis report as a raw JSON object wrapped in \`\`\`json ... \`\`\` markdown block.
Use the exact schema requested originally:
${dynamicSchema}`;

          const mergeResponse = await createInteractionWithRetry(res, { prompt: validatePrompt, inlineSources: [], tools: [{ type: "google_search" }], model: actualModel });
          if (!mergeResponse.ok) {
              clearInterval(heartbeat);
              const errTxt = await mergeResponse.text();
              console.error("Validator error:", errTxt);
              if (fullText && fullText.includes('{')) {
                  console.warn('[analyze] Validator start failed. Falling back to Primary Analyst output.');
                  res.write(`data: ${JSON.stringify({ type: 'text', text: fullText })}\n\n`);
                  await appendCanonicalValuationIfNeeded(fullText);
                  res.write(`data: [DONE]\n\n`);
                  res.end();
                  return;
              }
              res.write(`data: ${JSON.stringify({ type: 'error', message: "Validation failed: " + errTxt })}\n\n`);
              res.write(`data: [DONE]\n\n`);
              res.end();
              return;
          }
          const mergeStream = streamInteraction(mergeResponse);
          let validatedText = '';

          try {
              for await (const event of mergeStream) {
                  res.write(`data: ${JSON.stringify(event)}\n\n`);
                  if (event.type === 'text' && event.text) validatedText += event.text;
              }
          } catch (err: any) {
              console.error("Validator stream error:", err);
              res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
          } finally {
              clearInterval(heartbeat);
          }

          // Fallback: If validator did not produce JSON, stream Primary Analyst output so the client gets a complete report
          if (!validatedText || !validatedText.includes('{')) {
              if (fullText && fullText.includes('{')) {
                  console.warn('[analyze] Validator output lacked JSON. Falling back to Primary Analyst output.');
                  res.write(`data: ${JSON.stringify({ type: 'text', text: fullText })}\n\n`);
                  validatedText = fullText;
              }
          }

          await appendCanonicalValuationIfNeeded(validatedText || fullText);

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
        clearInterval(heartbeat);
        const errorText = await response.text();
        console.error(`[analyze] createInteraction failed: ${response.status} ${errorText}`);
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to start agent interaction.' })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

          
      const stopGeminiStream = latencyTracker.startStage('gemini_stream');
      const stream = streamInteraction(response);
      let fullText = '';
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
          if (event.text) fullText += event.text;
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

      stopGeminiStream();

      const stopAssumptions = latencyTracker.startStage('valuation_assumptions');
      await appendCanonicalValuationIfNeeded(fullText);
      stopAssumptions();
          
      const totalDurationSecs = ((Date.now() - startTime) / 1000);
      const totalDuration = totalDurationSecs.toFixed(2) + 's';
      const timing = latencyTracker.getTimingBreakdown();
      
      // Send final reliable stats to client
      res.write(`data: ${JSON.stringify({
        type: 'final_stats',
        duration: totalDurationSecs,
        tokens: totalTokens,
        timing,
        actualModel,
        requestedModel: model,
        pricingCatalogVersion: PRICING_CATALOG_METADATA.version,
      })}\n\n`);

      let summaryLog = `========================================================\n`;
      summaryLog += `                 RUN SUMMARY FOR ${ticker.toUpperCase()}\n`;
      summaryLog += `                 Total Duration: ${totalDuration}\n`;
      summaryLog += `                 Stage Timings: ${latencyTracker.formatSummary()}\n`;
      summaryLog += `========================================================\n\n`;
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
        // /var/task is read-only on Vercel. Keep the legacy local debug file only in writable local runtimes.
        if (process.env.VERCEL !== '1') {
          fs.writeFileSync(path.join(process.cwd(), `sub_agents_debug_${ticker}.txt`), finalLog, 'utf-8');
        }
      } catch (e) {
        console.error("Failed to write debug log", e);
      } finally {
        clearInterval(heartbeat);
      }

      res.end();
    } catch (err: any) {
      console.error("[analyze] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "Analyze failed" });
      }
    }
  });

  if (options.serveFrontend !== false) {
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlExists = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV !== "production" || !indexHtmlExists) {
    const { createServer: createViteServer } = await import("vite");
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

  }

  return app;
}

if (process.env.VERCEL !== "1") {
  createApp({ serveFrontend: true })
    .then((app) => {
      const PORT = Number(process.env.PORT || 3000);
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start server", error);
      process.exitCode = 1;
    });
}
