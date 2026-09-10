import { API_BASE_URL } from './agentClient.ts';

export interface DcfScenarioAssumption {
  revenue_cagr_pct: number | null;
  terminal_margin_pct: number | null;
  key_assumption_note: string;
}

export interface StructuredValuationAssumptions {
  wacc_pct: number | null;
  terminal_growth_pct: number | null;
  projection_years: number | null;
  scenarios: {
    bear: DcfScenarioAssumption;
    base: DcfScenarioAssumption;
    bull: DcfScenarioAssumption;
  };
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const nullableFinite = (value: unknown, min: number, max: number): number | null | undefined => {
  if (value === null) return null;
  if (!isFiniteNumber(value) || value < min || value > max) return undefined;
  return value;
};

const scenarioFrom = (value: unknown): DcfScenarioAssumption | null => {
  if (!isRecord(value)) return null;
  const revenue = nullableFinite(value.revenue_cagr_pct, -100, 1000);
  const margin = nullableFinite(value.terminal_margin_pct, -100, 100);
  if (revenue === undefined || margin === undefined) return null;
  return {
    revenue_cagr_pct: revenue,
    terminal_margin_pct: margin,
    key_assumption_note: typeof value.key_assumption_note === 'string'
      ? value.key_assumption_note
      : 'AI-proposed valuation assumption; not a verified financial fact.',
  };
};

export function normalizeStructuredValuationAssumptions(value: unknown): StructuredValuationAssumptions | null {
  if (!isRecord(value) || !isRecord(value.scenarios)) return null;

  const wacc = nullableFinite(value.wacc_pct, 0.000001, 100);
  const terminalGrowth = nullableFinite(value.terminal_growth_pct, -100, 100);
  const projectionYearsRaw = value.projection_years;
  const projectionYears = projectionYearsRaw === null
    ? null
    : isFiniteNumber(projectionYearsRaw) && Number.isInteger(projectionYearsRaw) && projectionYearsRaw >= 1 && projectionYearsRaw <= 30
      ? projectionYearsRaw
      : undefined;
  const bear = scenarioFrom(value.scenarios.bear);
  const base = scenarioFrom(value.scenarios.base);
  const bull = scenarioFrom(value.scenarios.bull);

  if (wacc === undefined || terminalGrowth === undefined || projectionYears === undefined || !bear || !base || !bull) {
    return null;
  }
  if (wacc !== null && terminalGrowth !== null && terminalGrowth >= wacc) return null;

  const ordered = (values: Array<number | null>) => {
    const finiteValues = values.filter((item): item is number => item !== null);
    return finiteValues.length < 3 || (values[0] !== null && values[1] !== null && values[2] !== null
      && values[0] <= values[1] && values[1] <= values[2]);
  };
  if (!ordered([bear.revenue_cagr_pct, base.revenue_cagr_pct, bull.revenue_cagr_pct])) return null;
  if (!ordered([bear.terminal_margin_pct, base.terminal_margin_pct, bull.terminal_margin_pct])) return null;

  return {
    wacc_pct: wacc,
    terminal_growth_pct: terminalGrowth,
    projection_years: projectionYears,
    scenarios: { bear, base, bull },
  };
}

export function extractLastJsonObjectFromText(text: string): Record<string, any> | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (let index = fenced.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(fenced[index][1]);
      if (isRecord(parsed)) return parsed;
    } catch {}
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      const parsed = JSON.parse(text.slice(first, last + 1));
      return isRecord(parsed) ? parsed : null;
    } catch {}
  }
  return null;
}

export function hasUsableDcfAssumptions(report: unknown): boolean {
  if (!isRecord(report)) return false;
  const dcf = report.intrinsic_value?.dcf_model;
  const normalized = normalizeStructuredValuationAssumptions({
    wacc_pct: dcf?.assumptions?.wacc_pct ?? null,
    terminal_growth_pct: dcf?.assumptions?.terminal_growth_pct ?? null,
    projection_years: dcf?.assumptions?.projection_years ?? null,
    scenarios: dcf?.scenarios ?? {},
  });
  if (!normalized) return false;
  return normalized.wacc_pct !== null
    && normalized.terminal_growth_pct !== null
    && normalized.projection_years !== null
    && [normalized.scenarios.bear, normalized.scenarios.base, normalized.scenarios.bull].every(
      scenario => scenario.revenue_cagr_pct !== null && scenario.terminal_margin_pct !== null,
    );
}

export function mergeStructuredValuationAssumptions(
  report: Record<string, any>,
  assumptions: StructuredValuationAssumptions,
): Record<string, any> {
  const existingIntrinsic = isRecord(report.intrinsic_value) ? report.intrinsic_value : {};
  const existingSummary = isRecord(existingIntrinsic.summary) ? existingIntrinsic.summary : {};
  const scenario = (item: DcfScenarioAssumption) => ({
    revenue_cagr_pct: item.revenue_cagr_pct,
    terminal_margin_pct: item.terminal_margin_pct,
    fair_value_per_share: null,
    key_assumption_note: item.key_assumption_note,
  });

  return {
    ...report,
    intrinsic_value: {
      ...existingIntrinsic,
      current_price: isFiniteNumber(existingIntrinsic.current_price) && existingIntrinsic.current_price > 0
        ? existingIntrinsic.current_price
        : null,
      dcf_model: {
        assumptions: {
          wacc_pct: assumptions.wacc_pct,
          terminal_growth_pct: assumptions.terminal_growth_pct,
          projection_years: assumptions.projection_years,
        },
        scenarios: {
          bear: scenario(assumptions.scenarios.bear),
          base: scenario(assumptions.scenarios.base),
          bull: scenario(assumptions.scenarios.bull),
        },
      },
      summary: {
        ...existingSummary,
        fair_value_range_low: null,
        fair_value_range_high: null,
        base_case_fair_value: null,
        margin_of_safety_pct: null,
        verdict_text: typeof existingSummary.verdict_text === 'string'
          ? existingSummary.verdict_text
          : 'Valuation pending deterministic calculation from verified financial and market inputs.',
      },
    },
  };
}

const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const nullableInteger = { anyOf: [{ type: 'integer' }, { type: 'null' }] };

const valuationAssumptionSchema = {
  type: 'object',
  properties: {
    wacc_pct: { ...nullableNumber, description: 'AI-proposed discount-rate assumption in percent.' },
    terminal_growth_pct: { ...nullableNumber, description: 'AI-proposed terminal growth assumption in percent.' },
    projection_years: { ...nullableInteger, description: 'Explicit forecast horizon in whole years.' },
    scenarios: {
      type: 'object',
      properties: {
        bear: {
          type: 'object',
          properties: {
            revenue_cagr_pct: nullableNumber,
            terminal_margin_pct: { ...nullableNumber, description: 'Terminal free-cash-flow margin in percent.' },
            key_assumption_note: { type: 'string' },
          },
          required: ['revenue_cagr_pct', 'terminal_margin_pct', 'key_assumption_note'],
        },
        base: {
          type: 'object',
          properties: {
            revenue_cagr_pct: nullableNumber,
            terminal_margin_pct: { ...nullableNumber, description: 'Terminal free-cash-flow margin in percent.' },
            key_assumption_note: { type: 'string' },
          },
          required: ['revenue_cagr_pct', 'terminal_margin_pct', 'key_assumption_note'],
        },
        bull: {
          type: 'object',
          properties: {
            revenue_cagr_pct: nullableNumber,
            terminal_margin_pct: { ...nullableNumber, description: 'Terminal free-cash-flow margin in percent.' },
            key_assumption_note: { type: 'string' },
          },
          required: ['revenue_cagr_pct', 'terminal_margin_pct', 'key_assumption_note'],
        },
      },
      required: ['bear', 'base', 'bull'],
    },
  },
  required: ['wacc_pct', 'terminal_growth_pct', 'projection_years', 'scenarios'],
};

const outputTextFromInteraction = (body: any): string => {
  if (typeof body?.output_text === 'string' && body.output_text) return body.output_text;

  const steps = Array.isArray(body?.steps) ? body.steps : [];
  const text = steps
    .filter((step: any) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step: any) => step.content)
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('');
  if (text) return text;

  const outputs = Array.isArray(body?.outputs) ? body.outputs : [];
  return outputs
    .filter((part: any) => part?.type === 'text' && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('');
};

export async function extractStructuredValuationAssumptions(
  researchText: string,
  model = 'gemini-3.8-flash',
): Promise<StructuredValuationAssumptions | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !researchText.trim()) return null;

  const prompt = `You are Lumina's valuation-assumption extraction step. The research text below came from a separate research agent and may use an unstable JSON layout. Return only valuation ASSUMPTIONS for a deterministic FCFF DCF.\n\nRules:\n- Do not return or invent Revenue, FCF, Cash, Investments, Debt, Shares, Current Price, FX, or fair value. Those facts come from verified providers and deterministic calculations later.\n- WACC, terminal growth, projection years, scenario revenue CAGR, and terminal FCF margin are assumptions, not verified facts.\n- terminal_margin_pct means terminal FREE-CASH-FLOW margin, not operating margin.\n- Use null when the research does not support a defensible assumption.\n- When scenario values are available, enforce Bear <= Base <= Bull for both revenue CAGR and terminal FCF margin.\n- If WACC and terminal growth are both available, terminal growth must be lower than WACC.\n- Keep notes concise and label the economic rationale; do not cite a number as a verified fact unless the research explicitly supports the context.\n\nRESEARCH OUTPUT:\n${researchText}`;

  try {
    const response = await fetch(`${API_BASE_URL}/interactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Api-Revision': '2026-05-20',
      },
      body: JSON.stringify({
        model,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: valuationAssumptionSchema,
        },
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      console.warn(`[valuation-assumptions] Structured model extraction failed with HTTP ${response.status}.`);
      return null;
    }
    const body = await response.json();
    const text = outputTextFromInteraction(body);
    if (!text) return null;
    return normalizeStructuredValuationAssumptions(JSON.parse(text));
  } catch (error: any) {
    console.warn(`[valuation-assumptions] Structured model extraction unavailable: ${error?.message || error}`);
    return null;
  }
}
