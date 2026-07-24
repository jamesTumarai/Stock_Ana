# App Overview: Multi-Agent Financial Research System

## Overall Logic
This application functions as an autonomous, multi-agent research research committee. When a user requests an analysis of a stock ticker, the app does not rely on a single, monolithic AI query. Instead, it orchestrates a structured pipeline where analytical workloads are distributed across specialized sub-agents. 

The pipeline runs in a simulated four-tier process:
1. **Tier 1 (Data Gathering & Domain Analysis)**: Domain-specific agents analyze distinct facets of the asset in parallel (e.g., technicals, options, fundamentals).
2. **Tier 2 (Case Construction & scenario impact)**: Agents synthesize the raw data into adversarial upside, downside, and Base cases, simulate scenario impact, and fact-check claims.
3. **Tier 3 (Judgment & Synthesis)**: A final executive agent evaluates the competing cases, resolves tensions, and compiles a structured JSON report.
4. **Tier 4 (Media Production)**: A post-processing agent synthesizes the debate into a multi-speaker audio podcast briefing.

The backend is a Node.js/Express server that constructs a prompt commanding the AI to simulate this multi-agent fan-out process, injecting the specialized instructions (skills) for each agent into the context. The final output is exfiltrated back to the server and parsed as a structured JSON object matching the React frontend's `ReportData` schema, resulting in a rich, interactive dashboard.

---

## Sub-Agents and Their Roles

### Tier 1: Data Gatherers & Domain Experts
These agents act as analysts focused on a specific slice of market data.
* **Fundamentals Agent**: Scores the financial health of the target ticker. Analyzes revenue growth, margins, Free Cash Flow (FCF), debt, and ROIC trends over a 5-year period.
* **Technical Analysis Agent**: Analyzes price structure, including trend, momentum, support/resistance levels, and relative strength versus the broader sector.
* **Options Flow Agent**: Examines unusual options activity, put/call skew, and implied volatility vs. historical averages to gauge market sentiment and expected price movement.
* **Insider & Institutional Agent**: Reviews Form 4 insider transactions and 13F institutional position changes to distinguish routine distribution from actionable conviction signals.
* **Earnings Call Agent**: Parses the last 2-4 earnings call transcripts to find guidance changes, shifts in management tone, and friction points during analyst Q&A.
* **News & Sentiment Agent**: Evaluates the 90-day narrative arc. Identifies what is driving the story, tracks sentiment trajectories, and maps out upcoming known catalysts.
* **Competitive Landscape Agent**: Positions the target ticker against 3-5 peers based on valuation multiples, growth rates, and market share trajectory.
* **scenario Composition Agent**: Evaluates the current sector, factor, and geography exposure of the hypothetical existing holdings to baseline the scenario before a new asset is added.

### Tier 2: Case Construction & Validation
These agents act as scenario managers and headwind officers.
* **upside case Agent**: Constructs the strongest, most honest case for accumulation the asset. It is strictly required to cite which Tier 1 sub-agent's data supports each of its arguments.
* **downside case Agent**: Plays the devil's advocate. Attacks the upside case by finding the weakest assumptions, ignored headwinds, and base-rate failures to construct a strong opposing thesis.
* **Base Case Agent**: Constructs the baseline expectations, modeling steady execution with in-line growth and stable margins against macro pressures.
* **Correlation & Overlap Agent**: Assesses how correlated the candidate stock is to the assets already held in the scenario.
* **scenario impact Simulator Agent**: Models the scenario after a hypothetical purchase at different position sizes (e.g., 2%, 5%, 10%) to estimate changes in exposure, Value at headwind (VaR), and Sharpe ratio.
* **Verifier Agent**: Acts as the compliance officer. Audits the constructed cases by checking every cited number against the underlying Tier 1 agent outputs, flagging unsupported claims or hallucinations.

### Tier 3: Judgment & Synthesis
* **Synthesis & Scoring Agent**: The Chief research Officer. It weighs the verified cases into a final, nuanced assessment. Instead of providing a binary "accumulate/distribute" guidance, it provides a structured view with a conviction score, key tensions, and a monitoring plan.

### Tier 4: Media Production
* **Media Director Agent**: Acts as the production team. It takes the textual debate outputs, creates a debate script, and converts it into a multi-speaker audio podcast briefing (using Gemini Flash audio features).

---

## Data Flow and Output Processing

1. **User Request**: The user selects a stock ticker and active agents in the React UI, which sends a POST request to `/api/analyze`.
2. **Context Assembly**: The Node.js server reads the agent descriptions and injects them into the instruction context for the AI interaction.
3. **LLM Orchestration**: The AI executes the Tier 1-2 fan-out parallel data gathering, runs the Tier 3 judgment layer, and triggers the Tier 4 media production step within a continuous interaction.
4. **Artifacts Exfiltration**: As a critical final step, the AI executes a bash script to exfiltrate generated artifacts (the JSON report objects and `.wav` audio files) back to the Express backend via `curl` requests to the `/api/upload_artifact` endpoint.
5. **Frontend Rendering**: The React application fetches the uploaded artifacts. The UI components (using Recharts and Tailwind CSS) map over this structured data to render:
    * **Executive Verdict**: Summary, Conviction Score, Key Tensions, and Monitoring Plan.
    * **Podcast Briefing**: An embedded audio player serving the rendered multi-speaker summary of the debate.
    * **Case Analysis**: A grid view displaying the upside case, downside case, and Base Case theses.
    * **Multi-Pane Trend (6M)**: A line chart mapping the 6-month price movement.
    * **Fundamentals**: Visualized financial metrics trends.
    * **Options Implied Move**: A visual slider showing expected price volatility.
    * **Sector Exposure Shift**: A pie chart showing the impact on scenario allocation.
    * **90-Day Sentiment Vector**: An area chart plotting sentiment trajectories.
    * **Peer Sorting Matrix**: A grid view comparing the target ticker against peers on valuation multiples and relative premium/discount.
    * **Earnings Call Anomalies**: An accordion list highlighting detected deflections, vague answers, or unusual language patterns in recent management calls.
    * **Critical Catalysts**: Upcoming events and timeline for potential price action triggers.
