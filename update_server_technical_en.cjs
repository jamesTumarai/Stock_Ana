const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const newInstruction = `\\n\\nCRITICAL: You MUST write ALL string values in the JSON output in English.
          Please follow this specific Technical Analysis guideline for the JSON fields in "technical_analysis":
          1) signal_summary: status (Buy/Wait/Avoid), trend_weekly/daily/4H, and confluence_score (List signals one by one whether they are positive, negative, or neutral, e.g. "MA Cross = Positive, MACD = Negative, RSI = Neutral", do not just sum them up. Then summarize the direction and invalidation level).
          2) key_levels: current_price (numeric), support 3 levels, resistance 3 levels (Numeric. S1 and R1 must be closest to current price. Must not be too close to each other, use ATR for significance).
          3) trade_plan: entry_zone (Numeric. If lower than current price, it's a buy on dip), stop_loss, target_1, target_2, risk_reward_ratio.
          4) overall_trend: Explain overall picture.
          5) price_structure: Price structure.
          6) volume_analysis: Volume analysis.
          7) trend_indicators: MA, MACD, ADX.
          8) momentum_indicators: RSI, Stochastic.
          9) volatility_indicators: Bollinger Bands, ATR (Single value, not a range).
          10) chart_patterns: Chart patterns.
          11) relative_strength: Relative to market.
          12) technical_risks: Risks (false breakout, gap risk, low volume).
          13) beginner_summary: Straightforward summary for beginners:
           - technical_overview: Overall technical picture in simple terms.
           - top_3_points: 3 interesting points.
           - top_3_cautions: 3 cautions.
           - suitable_trade_style: Suitable style (day/swing/position, must match trade plan).
          14) scoring: Score 1-10 with reasons.
          15) final_verdict_summary: Final short summary.`;

content = content.replace(/CRITICAL: You MUST write ALL string values in the JSON output in English\..*?and technical risks\./s, newInstruction);

fs.writeFileSync('server.ts', content);
