const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf8');

// Replace the if/else logic for analysisType with if/else if/else
const startAnchor = `if (analysisType === 'technical') {`;
const startAnchorIdx = serverCode.indexOf(startAnchor);
const endAnchor = `      const actualModel = model === 'perseus' ? 'gemini-3.6-flash' : model === 'gemini-2.5-pro' ? 'gemini-3.1-pro' : (model || 'gemini-3.5-flash');`;
const endAnchorIdx = serverCode.indexOf(endAnchor);

if (startAnchorIdx === -1 || endAnchorIdx === -1) {
    console.error("Anchors not found");
    process.exit(1);
}

// We will construct the entire new instruction block for dynamicSchema
const newBlock = `if (analysisType === 'technical') {
        finalInstruction += \` Focus entirely on technical analysis. Make sure that you are looking for the most up to date data and charts.\`;
        if (instruction) {
          finalInstruction += \`\n\nAdditional Instructions from user:\n\${instruction}\`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.\n\n          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":\n          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ)\n          2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข\n          3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio\n          4) overall_trend: อธิบายภาพรวม\n          5) price_structure: โครงสร้างราคา\n          6) volume_analysis: วิเคราะห์ Volume\n          7) trend_indicators: MA, MACD, ADX\n          8) momentum_indicators: RSI, Stochastic\n          9) volatility_indicators: Bollinger Bands, ATR\n          10) chart_patterns: รูปแบบราคา\n          11) relative_strength: เทียบกับตลาด\n          12) technical_risks: ความเสี่ยง\n          13) beginner_summary: บทสรุปสำหรับมือใหม่\n          14) scoring: คะแนน 1-10 พร้อมเหตุผล\n          15) final_verdict_summary: สรุปสุดท้าย\`;
        } else {
          finalInstruction += \`\n\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the Technical Analysis structure covering trend, price structure, support/resistance, volume, indicators, relative strength, trading signals, entry/stop targets, and technical risks.\`;
        }
        
        dynamicSchema = \`{
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
  "deep_insights": [],
  "findings": [],
  "financial_charts": {
    "stock_price_4m": [
      { "date": "Oct '24", "price": 150.5 }
    ]
  }
}\`;
      } else if (analysisType === 'combined') {
        finalInstruction += \` Focus on BOTH fundamental analysis (company business, financials, management) AND technical analysis (price trends, support/resistance, indicators). Make sure that you are looking for the most up to date data, SEC filings, and charts.\`;
        if (instruction) {
          finalInstruction += \`\n\nAdditional Instructions from user:\n\${instruction}\`;
        }
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.
          Please follow this specific guideline for BOTH Fundamental and Technical Analysis:
          - Fundamental Analysis:
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร
          2) ลูกค้าของบริษัทคือใคร (for target_customers)
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model)
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หนี้เยอะไหม P/E เช็ค dilution/SBC (ต้องยาว 3-5 ประโยค)
          5) เช็คคุณภาพพื้นฐานแบบง่าย (for fundamentals_check)
          6) จุดแข็งของธุรกิจ (for business_strengths)
          7) Optionality หรือโอกาสโตในอนาคต (for future_growth)
          8) ความเสี่ยงที่ต้องรู้ (for key_risks)
          9) ผู้บริหารและการเล่าเรื่องของบริษัท (for management)
          10) สรุปให้มือใหม่ตัดสินใจ (for beginner_summary): business_type_simple, top_3_strengths, top_3_risks, suitable_investor_type, further_reading
          11) ให้คะแนนแบบง่าย (for scoring)
          12) Final Verdict (for final_verdict_summary)
          - Technical Analysis:
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend, confluence score
          2) key_levels: แนวรับ-แนวต้าน
          3) trade_plan: แผนการเทรด
          4) overall_trend, price_structure, volume_analysis, trend_indicators, momentum_indicators, volatility_indicators, chart_patterns, relative_strength, technical_risks, beginner_summary, scoring, final_verdict_summary

          เงื่อนไขสำคัญ:
          - ห้ามข้ามหัวข้อไหนเด็ดขาด ต้องตอบให้ครบทั้ง fundamental และ technical\`;
        } else {
          finalInstruction += \`\n\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.\`;
        }
        dynamicSchema = \`{
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
    "stock_price_4m": [
      { "date": "Oct '24", "price": 150.5 }
    ],
    "financial_performance_4q": [
      { "quarter": "Q1 2025", "revenue": 10.5, "net_income": 2.1, "distributions": 0.5 }
    ]
  }
}\`;
      } else {
        finalInstruction += \` Make sure that you are looking for the most up to date SEC filings of the existing quarter or the quarter before.\`;
        if (instruction) {
          finalInstruction += \`\n\nAdditional Instructions from user:\n\${instruction}\`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\n\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology.
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
          - แต่ละหัวข้อต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ ถ้าหาไม่ได้ให้ระบุว่า "ไม่พบข้อมูลนี้ในเอกสารที่มี"\`;
        }
        dynamicSchema = \`{
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
}\`;
      }
      
      let prompt = \`Perform a comprehensive document analysis on \${ticker}. \${finalInstruction}

CRITICAL INSTRUCTIONS FOR QUANTITATIVE DATA (CHARTS):
For stock_price_4m and financial_performance_4q, you MUST use standard open web searches (e.g. Yahoo Finance, Google Finance, MarketWatch) WITHOUT the filetype:pdf restriction to get accurate historical prices, distributions, revenue, and net income.
For stock_price_4m, provide exactly 4 data points representing the past 4 months of stock prices. For each month, give the closing price on the last trading day of the month. Order the array chronologically from the oldest month to the newest month (left to right).
For financial_performance_4q, if the ticker is a regular stock, provide net income and revenue for the past four completed quarters. If it is an ETF, provide quarterly distributions (dividends/yield per share) for the past four completed quarters. Ensure the array is chronologically ordered from oldest quarter to newest (left to right).

CRITICAL INSTRUCTIONS FOR QUALITATIVE DATA (INSIGHTS & SUMMARIES):
For the Executive Summary, Key Takeaways, Deep Insights, and Comprehensive Analysis, you MUST leverage BOTH the findings extracted from the SEC filings AND insights from broader open web searches to create a comprehensive analysis.

CRITICAL: You MUST output the final synthesis report as a raw JSON object wrapped in \\\`\\\`\\\`json ... \\\`\\\`\\\` markdown block in your final text response. The JSON must match the following schema EXACTLY. **HEAVILY PENALIZED:** Do NOT rename keys. Do NOT add extra root-level keys like "macro_risk_analysis". Make sure to populate the "findings" array with exactly the keys "documentType", "keyInsights", "date", and "sourceUrl". For stock_price_4m, use exactly the keys "date" and "price". The "deep_insights" array MUST use exactly the keys "category", "title", "description", and "impact_score". Also include the entire "\${analysisType === 'technical' ? 'technical_analysis' : analysisType === 'fundamental' ? 'comprehensive_analysis' : 'both comprehensive_analysis and technical_analysis'}" object exactly as structured in the schema:
\${dynamicSchema}
Do not include multiple sub-agents, just do the analysis yourself based on the retrieved documents and searches.\`;
`;

serverCode = serverCode.substring(0, startAnchorIdx) + newBlock + serverCode.substring(endAnchorIdx);

fs.writeFileSync('server.ts', serverCode);
console.log("Replaced instruction block");

