const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const analyzeStart = code.indexOf('app.post("/api/analyze"');
const letPrompt = code.indexOf('let prompt =', analyzeStart);

const beforeIf = code.substring(0, code.indexOf("if (analysisType === 'technical')", analyzeStart));
const afterPrompt = code.substring(letPrompt);

const newIfBlock = `if (analysisType === 'technical') {
        finalInstruction += \` Focus entirely on technical analysis. Make sure that you are looking for the most up to date data and charts.\`;
        if (instruction) {
          finalInstruction += \`\\n\\nAdditional Instructions from user:\\n\${instruction}\`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ)
          2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข
          3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio
          4) overall_trend: อธิบายภาพรวม
          5) price_structure: โครงสร้างราคา
          6) volume_analysis: วิเคราะห์ Volume
          7) trend_indicators: MA, MACD, ADX
          8) momentum_indicators: RSI, Stochastic
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: รูปแบบราคา
          11) relative_strength: เทียบกับตลาด
          12) technical_risks: ความเสี่ยง
          13) beginner_summary: บทสรุปสำหรับมือใหม่
          14) scoring: คะแนน 1-10 พร้อมเหตุผล
          15) final_verdict_summary: สรุปสุดท้าย\`;
        } else {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the Technical Analysis structure covering trend, price structure, support/resistance, volume, indicators, relative strength, trading signals, entry/stop targets, and technical risks.\`;
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
      } else if (analysisType === 'combined') {
        finalInstruction += \` Focus on BOTH fundamental analysis (company business, financials, management) AND technical analysis (price trends, support/resistance, indicators). Make sure that you are looking for the most up to date data, SEC filings, and charts.\`;
        if (instruction) {
          finalInstruction += \`\\n\\nAdditional Instructions from user:\\n\${instruction}\`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology, tickers, and standard date formats.
          Please follow this specific guideline for BOTH Fundamental and Technical Analysis:
          
          - Fundamental Analysis:
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
          
          - Technical Analysis:
          1) signal_summary: สรุปสถานะ (Buy/Wait/Avoid), trend รายสัปดาห์/วัน/4H, และ confluence score (เช่น 5 บวก / 2 ลบ)
          2) key_levels: แนวรับ (support) 3 ระดับ, แนวต้าน (resistance) 3 ระดับ เป็นตัวเลข
          3) trade_plan: แผนการเทรด จุดเข้า, stop loss, target 1, target 2, และ Risk/Reward ratio
          4) overall_trend: อธิบายภาพรวม
          5) price_structure: โครงสร้างราคา
          6) volume_analysis: วิเคราะห์ Volume
          7) trend_indicators: MA, MACD, ADX
          8) momentum_indicators: RSI, Stochastic
          9) volatility_indicators: Bollinger Bands, ATR
          10) chart_patterns: รูปแบบราคา
          11) relative_strength: เทียบกับตลาด
          12) technical_risks: ความเสี่ยง
          13) beginner_summary: บทสรุปสำหรับมือใหม่
          14) scoring: คะแนน 1-10 พร้อมเหตุผล
          15) final_verdict_summary: สรุปสุดท้าย

          เงื่อนไขสำคัญ:
          - ห้ามข้ามหัวข้อไหนเด็ดขาด ต้องตอบให้ครบทั้ง fundamental และ technical
          - อย่าตอบกว้าง ๆ หรือชมสวยหรู ใช้ Fact จาก Data
          - ถ้าข้อมูลบางจุดไม่ชัด ให้บอกตรง ๆ ว่าไม่ชัด หรือ "ไม่มีข้อมูลเปิดเผย"
          - ใช้ตัวเลขล่าสุดเท่าที่หาได้ ระบุแหล่งที่มาและช่วงเวลา (ไตรมาส/ปี)
          - อธิบายศัพท์ยากเป็นภาษาง่ายในวงเล็บ ตอบแบบภาษาคนลงทุน ไม่ใช่ภาษาทางการแข็ง ๆ
          - เทียบกับคู่แข่งหรืออุตสาหกรรมในจุดที่ทำได้
          - ระวังอคติจากฝั่งผู้บริหาร (management bias) 
          - ห้ามตอบด้วยคำคุณศัพท์ลอยๆ เช่น "แข็งแกร่ง" โดยไม่มีตัวเลข ทุกประโยคต้องมีตัวเลขจริงกำกับ
          - แต่ละหัวข้อต้องตอบครบทุก bullet ห้ามข้ามเงียบๆ ถ้าหาไม่ได้ให้ระบุว่า "ไม่พบข้อมูลนี้ในเอกสารที่มี"\`;
        } else {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering both Fundamental and Technical aspects completely.\`;
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
          finalInstruction += \`\\n\\nAdditional Instructions from user:\\n\${instruction}\`;
        }
        
        if (language && language.toLowerCase() === 'thai') {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in Thai language (ภาษาไทย), EXCEPT for specific financial terminology.
          Please follow this specific Fundamental Analysis guideline for the JSON fields in "comprehensive_analysis":
          1) บริษัทนี้ทำธุรกิจอะไร (for business_overview): หาเงินจากอะไร สินค้าหรือบริการหลักคืออะไร รายได้แบ่งเป็นกี่ส่วน ส่วนไหนเป็นรายได้หลักสุด ธุรกิจนี้เข้าใจง่ายแบบคนทั่วไปฟังแล้วเห็นภาพ
          2) ลูกค้าของบริษัทคือใคร (for target_customers): ลูกค้าหลักเป็นใคร พึ่งลูกค้ารายใหญ่ไม่กี่รายหรือกระจายดี ลูกค้าเปลี่ยนเจ้าง่ายไหม อะไรทำให้ลูกค้าอยู่กับบริษัทต่อ
          3) โมเดลรายได้และคุณภาพรายได้ (for revenue_model): เป็นแบบขายครั้งเดียวหรือ recurring revenue สม่ำเสมอไหม ธุรกิจโตจากอะไร แบบไหนคุณภาพดี
          4) ภาพรวมงบการเงินล่าสุด (for financial_overview): รายได้/กำไรโตไหม margin ดีขึ้นหรือแย่ลง cash flow ดีไหม หหนี้เยอะไหม P/E หรือ Valuation ปัจจุบัน เทียบกับคู่แข่งหรืออุตสาหกรรมด้วย เช็ค dilution/SBC (ต้องยาว 3-5 ประโยคเฉพาะเจาะจง)
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
        } else {
          finalInstruction += \`\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in English. Please follow the structure covering Fundamental aspects completely.\`;
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
      
      `;

fs.writeFileSync('server.ts', beforeIf + newIfBlock + afterPrompt);
console.log("Fixed server.ts!");
