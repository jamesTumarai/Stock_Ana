from pathlib import Path

server_path = Path('server.ts')
server = server_path.read_text()

import_anchor = 'import { GoogleGenAI } from "@google/genai";\n'
import_line = 'import { validateDcfAssumptionModel } from "./src/utils/valuation/dcfAssumptionProposal.ts";\n'
if import_line not in server:
    if import_anchor not in server:
        raise SystemExit('server import anchor not found')
    server = server.replace(import_anchor, import_anchor + import_line, 1)

route_anchor = '  app.post("/api/upload_artifact", express.raw({ type: \'*/*\', limit: \'50mb\' }), (req, res) => {'
route = r'''  app.post("/api/dcf-assumptions", async (req, res) => {
    try {
      const { ticker, companyName, businessContext = '', verifiedFinancialContext = {} } = req.body || {};
      const normalizedTicker = typeof ticker === 'string' ? ticker.trim().toUpperCase() : '';
      if (!normalizedTicker || !/^[A-Z0-9.-]{1,12}$/.test(normalizedTicker)) {
        return res.status(400).json({ error: 'Missing or invalid ticker' });
      }
      if (!process.env.GEMINI_API_KEY?.trim()) {
        return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      }

      const sourcePeriod = typeof verifiedFinancialContext?.sourcePeriod === 'string'
        ? verifiedFinancialContext.sourcePeriod.trim().slice(0, 120)
        : '';
      const startingRevenueM = verifiedFinancialContext?.startingRevenueM;
      const trailingFourFreeCashFlowM = verifiedFinancialContext?.trailingFourFreeCashFlowM;
      const historicalFcfMarginPct = verifiedFinancialContext?.historicalFcfMarginPct;
      const verifiedNumbersOk = [startingRevenueM, trailingFourFreeCashFlowM, historicalFcfMarginPct]
        .every(value => typeof value === 'number' && Number.isFinite(value));
      if (!sourcePeriod || !verifiedNumbersOk || startingRevenueM <= 0 || historicalFcfMarginPct < -100 || historicalFcfMarginPct > 100) {
        return res.status(400).json({ error: 'Verified DCF context is incomplete or invalid.' });
      }

      const normalizedCompanyName = typeof companyName === 'string' && companyName.trim()
        ? companyName.trim().slice(0, 200)
        : normalizedTicker;
      const normalizedBusinessContext = typeof businessContext === 'string'
        ? businessContext.trim().slice(0, 7000)
        : '';

      const prompt = `You are the valuation-assumption layer for Lumina, an institutional equity research system.

Your job is ONLY to propose forward-looking DCF assumptions for ${normalizedCompanyName} (${normalizedTicker}). You are not a financial-data provider and you are not allowed to calculate or estimate fair value.

VERIFIED ANCHOR FACTS (provided by the SEC verification layer; do not replace, restate as new facts, or invent alternatives):
- Source period: ${sourcePeriod}
- Trailing revenue: ${startingRevenueM} USD millions
- Trailing free cash flow: ${trailingFourFreeCashFlowM} USD millions
- Historical FCF margin: ${historicalFcfMarginPct}%

QUALITATIVE BUSINESS CONTEXT (research narrative only; treat as context, not verified financial facts):
${normalizedBusinessContext || 'No additional qualitative context supplied.'}

Return ONLY a JSON object with this exact shape:
{
  "assumptions": {
    "wacc_pct": number,
    "terminal_growth_pct": number,
    "projection_years": integer
  },
  "scenarios": {
    "bear": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    },
    "base": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    },
    "bull": {
      "revenue_cagr_pct": number,
      "terminal_margin_pct": number,
      "fair_value_per_share": null,
      "key_assumption_note": "forward-looking assumption note"
    }
  }
}

STRICT RULES:
- These are ASSUMPTIONS, not facts. Say so in every scenario note.
- Never output Revenue, Cash, Debt, Shares, current price, enterprise value, equity value, or any other financial fact beyond the fields above.
- Never calculate fair value. fair_value_per_share MUST be null in all scenarios.
- WACC must be 5% to 30%.
- Terminal growth must be 0% to 5% and lower than WACC.
- Projection years must be an integer from 3 to 10.
- Revenue CAGR must be between -30% and 50%.
- Terminal FCF margin must be between -50% and 80%.
- Bear <= Base <= Bull for both revenue CAGR and terminal FCF margin.
- Bear, Base, and Bull must be meaningfully distinct.
- Anchor margin assumptions to business economics and the verified historical FCF margin without treating the historical margin as a guaranteed future outcome.
- Do not include markdown fences or commentary outside the JSON.`;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const candidateModels = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash'];
      let responseText = '';
      let usedModel = '';
      let lastError: any = null;

      for (const candidateModel of candidateModels) {
        try {
          const generated = await ai.models.generateContent({
            model: candidateModel,
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });
          responseText = generated.text || '';
          usedModel = candidateModel;
          if (responseText.trim()) break;
        } catch (error: any) {
          lastError = error;
          console.warn(`[dcf-assumptions] Model ${candidateModel} unavailable (${error?.status || error?.message || 'unknown'}).`);
        }
      }

      if (!responseText.trim()) {
        throw lastError || new Error('No DCF assumption proposal was generated.');
      }

      const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      const parsed = JSON.parse(fenced?.[1] || responseText.trim());
      const dcfModel = validateDcfAssumptionModel(parsed);
      if (!dcfModel) {
        console.warn('[dcf-assumptions] Proposal failed deterministic validation.');
        return res.status(422).json({ error: 'AI assumption proposal failed deterministic validation.' });
      }

      return res.json({
        ok: true,
        source: 'ai_assumption_proposal',
        model: usedModel,
        dcf_model: dcfModel,
      });
    } catch (error: any) {
      console.error('[dcf-assumptions] Error:', error?.message || error);
      return res.status(502).json({ error: 'DCF assumption proposal unavailable.' });
    }
  });

'''
if '/api/dcf-assumptions' not in server:
    if route_anchor not in server:
        raise SystemExit('server route anchor not found')
    server = server.replace(route_anchor, route + route_anchor, 1)
server_path.write_text(server)

app_path = Path('src/App.tsx')
app = app_path.read_text()
market_import = "import { fetchLiveQuotes } from './services/marketDataService';\n"
new_imports = "import { fetchDcfAssumptionProposal } from './services/dcfAssumptionService';\nimport { attachDcfAssumptionModel, hasValidDcfAssumptionModel } from './utils/valuation/dcfAssumptionProposal';\n"
if "fetchDcfAssumptionProposal" not in app:
    if market_import not in app:
        raise SystemExit('App import anchor not found')
    app = app.replace(market_import, market_import + new_imports, 1)

old_block = '''            const prepared = validateAndPrepareReport(
              {
                ...finalData,
                ...(secVerification ? { sec_verification: secVerification } : {}),
                analysis_type: aType,
                ticker: requestedTicker,
              },
              requestedTicker,
              {
                marketQuotes: marketResponse?.quotes,
                requireMarketSnapshot: aType !== 'technical',
              },
            );'''
new_block = '''            let reportForValidation = finalData as ReportData;
            if (
              aType !== 'technical'
              && secVerification?.status === 'verified_eligible'
              && !hasValidDcfAssumptionModel(reportForValidation)
            ) {
              const proposal = await fetchDcfAssumptionProposal(
                requestedTicker,
                reportForValidation,
                secVerification,
                controller.signal,
              );
              if (proposal) {
                reportForValidation = attachDcfAssumptionModel(reportForValidation, proposal);
              }
            }

            const prepared = validateAndPrepareReport(
              {
                ...reportForValidation,
                ...(secVerification ? { sec_verification: secVerification } : {}),
                analysis_type: aType,
                ticker: requestedTicker,
              },
              requestedTicker,
              {
                marketQuotes: marketResponse?.quotes,
                requireMarketSnapshot: aType !== 'technical',
              },
            );'''
if old_block in app:
    app = app.replace(old_block, new_block, 1)
elif 'let reportForValidation = finalData as ReportData;' not in app:
    raise SystemExit('App final validation anchor not found')
app_path.write_text(app)

boundary_test = Path('src/utils/dcfAssumptionBoundary.test.ts')
boundary_test.write_text(r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');

assert.match(serverSource, /app\.post\("\/api\/dcf-assumptions"/);
assert.match(serverSource, /validateDcfAssumptionModel\(parsed\)/);
assert.match(serverSource, /fair_value_per_share MUST be null/);
assert.match(appSource, /secVerification\?\.status === 'verified_eligible'/);
assert.match(appSource, /!hasValidDcfAssumptionModel\(reportForValidation\)/);
assert.match(appSource, /fetchDcfAssumptionProposal\(/);
assert.match(appSource, /attachDcfAssumptionModel\(reportForValidation, proposal\)/);

console.log('DCF assumption/fact boundary integration checks passed');
''')
